import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { parseCV, normalizePhone } from '@/lib/parsing';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

interface RouteParams {
  params: Promise<{ batchId: string }>;
}

// Get R2 client
function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not configured');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

async function downloadFromR2(s3Key: string): Promise<Buffer> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new Error('R2_BUCKET_NAME not configured');
  }

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    })
  );

  if (!response.Body) {
    throw new Error('Empty response from R2');
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const reader = response.Body.transformToWebStream().getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

// POST /api/imports/[batchId]/process - Process all files in a batch
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_CREATE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { batchId } = await params;

    // Get batch with items
    const batch = await db.importBatch.findUnique({
      where: { id: batchId },
      include: {
        pipeline: {
          include: {
            stages: {
              where: { isDefault: true },
              take: 1,
            },
          },
        },
        items: {
          where: { status: 'QUEUED' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
    }

    if (batch.status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Batch is already being processed' },
        { status: 400 }
      );
    }

    if (batch.items.length === 0) {
      return NextResponse.json(
        { error: 'No files to process' },
        { status: 400 }
      );
    }

    // Get default stage
    let defaultStageId: string | undefined = batch.pipeline.stages[0]?.id;
    if (!defaultStageId) {
      const firstStage = await db.stage.findFirst({
        where: { pipelineId: batch.pipelineId },
        orderBy: { orderIndex: 'asc' },
      });
      if (firstStage) {
        defaultStageId = firstStage.id;
      }
    }

    if (!defaultStageId) {
      return NextResponse.json(
        { error: 'Pipeline has no stages' },
        { status: 400 }
      );
    }

    // At this point defaultStageId is guaranteed to be a string
    const stageId = defaultStageId;

    // Update batch status
    await db.importBatch.update({
      where: { id: batchId },
      data: { status: 'PROCESSING' },
    });

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // Process each item
    for (const item of batch.items) {
      try {
        // Update item status
        await db.importItem.update({
          where: { id: item.id },
          data: { status: 'PROCESSING' },
        });

        // Download file from R2
        const buffer = await downloadFromR2(item.s3Key);
        const mimeType = getMimeType(item.filename);

        // Parse CV
        const parsed = await parseCV(buffer, mimeType);

        // Generate name if not found
        const fullName = parsed.fullName || `Candidate from ${item.filename}`;

        // Check for duplicate email
        let existingCandidate = null;
        if (parsed.email) {
          existingCandidate = await db.candidate.findFirst({
            where: {
              email: parsed.email,
              pipelineId: batch.pipelineId,
              deletedAt: null,
            },
          });
        }

        if (existingCandidate) {
          // Update existing candidate with parsed data
          await db.candidate.update({
            where: { id: existingCandidate.id },
            data: {
              extractedText: parsed.extractedText,
              parsingConfidence: parsed.confidence,
            },
          });

          await db.importItem.update({
            where: { id: item.id },
            data: {
              status: 'SUCCEEDED',
              candidateId: existingCandidate.id,
              processedAt: new Date(),
            },
          });
        } else {
          // Create new candidate
          const candidate = await db.candidate.create({
            data: {
              fullName,
              email: parsed.email,
              phoneE164: parsed.phone ? normalizePhone(parsed.phone, batch.defaultCountryCode) : null,
              pipelineId: batch.pipelineId,
              stageId,
              source: 'import',
              extractedText: parsed.extractedText,
              parsingConfidence: parsed.confidence,
              assignedToUserId: session.user.id,
            },
          });

          // Create stage history
          await db.candidateStageHistory.create({
            data: {
              candidateId: candidate.id,
              fromStageId: null,
              toStageId: stageId,
              movedByUserId: session.user.id,
            },
          });

          await db.importItem.update({
            where: { id: item.id },
            data: {
              status: 'SUCCEEDED',
              candidateId: candidate.id,
              processedAt: new Date(),
            },
          });
        }

        successCount++;
      } catch (error) {
        console.error(`Error processing item ${item.id}:`, error);

        await db.importItem.update({
          where: { id: item.id },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            processedAt: new Date(),
          },
        });

        failedCount++;
      }

      processedCount++;

      // Update batch progress
      await db.importBatch.update({
        where: { id: batchId },
        data: {
          processedCount,
          successCount,
          failedCount,
        },
      });
    }

    // Mark batch as completed
    await db.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'IMPORT_BATCH_COMPLETED',
        entityType: 'IMPORT_BATCH',
        entityId: batchId,
        metadata: {
          totalFiles: batch.totalFiles,
          successCount,
          failedCount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      processed: processedCount,
      succeeded: successCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error('Error processing import batch:', error);

    // Try to mark batch as failed
    try {
      const { batchId } = await params;
      await db.importBatch.update({
        where: { id: batchId },
        data: { status: 'FAILED' },
      });
    } catch {
      // Ignore
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
