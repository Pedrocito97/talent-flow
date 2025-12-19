import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';
import { uploadToR2 } from '@/lib/r2';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types for CVs
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

interface RouteParams {
  params: Promise<{ batchId: string }>;
}

// POST /api/imports/[batchId]/upload - Upload files to a batch
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

    // Verify batch exists and is in pending state
    const batch = await db.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
    }

    if (batch.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Cannot add files to a batch that has already started processing' },
        { status: 400 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const results: {
      filename: string;
      success: boolean;
      error?: string;
      itemId?: string;
    }[] = [];

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        results.push({
          filename: file.name,
          success: false,
          error: 'File too large (max 10MB)',
        });
        continue;
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        results.push({
          filename: file.name,
          success: false,
          error: 'Invalid file type. Allowed: PDF, Word, TXT',
        });
        continue;
      }

      try {
        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate S3 key
        const timestamp = Date.now();
        const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const s3Key = `imports/${batchId}/${timestamp}-${sanitizedFilename}`;

        // Upload to R2
        await uploadToR2(s3Key, buffer, file.type);

        // Create import item record
        const item = await db.importItem.create({
          data: {
            importBatchId: batchId,
            filename: file.name,
            s3Key,
            status: 'QUEUED',
          },
        });

        results.push({
          filename: file.name,
          success: true,
          itemId: item.id,
        });
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        results.push({
          filename: file.name,
          success: false,
          error: 'Upload failed',
        });
      }
    }

    // Update batch file count
    const successCount = results.filter((r) => r.success).length;
    await db.importBatch.update({
      where: { id: batchId },
      data: {
        totalFiles: { increment: successCount },
      },
    });

    return NextResponse.json({
      results,
      uploaded: successCount,
      failed: results.length - successCount,
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
