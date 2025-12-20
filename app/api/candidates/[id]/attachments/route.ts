import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';
import { uploadToR2, generateS3Key, getDownloadUrl, deleteFromR2 } from '@/lib/r2';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
];

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/candidates/[id]/attachments - List attachments for a candidate
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: candidateId } = await params;

    // Verify candidate exists
    const candidate = await db.candidate.findUnique({
      where: { id: candidateId, deletedAt: null },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Fetch attachments with uploader info
    const attachments = await db.attachment.findMany({
      where: { candidateId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    // Add download URLs
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        try {
          const downloadUrl = await getDownloadUrl(attachment.s3Key);
          return { ...attachment, downloadUrl };
        } catch {
          return { ...attachment, downloadUrl: null };
        }
      })
    );

    return NextResponse.json({ attachments: attachmentsWithUrls });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/candidates/[id]/attachments - Upload an attachment
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: candidateId } = await params;

    // Verify candidate exists
    const candidate = await db.candidate.findUnique({
      where: { id: candidateId, deletedAt: null },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed. Allowed types: PDF, Word, images, text.' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate S3 key and upload
    const s3Key = generateS3Key(candidateId, file.name);
    await uploadToR2(s3Key, buffer, file.type);

    // Create attachment record
    const attachment = await db.attachment.create({
      data: {
        candidateId,
        filename: file.name,
        s3Key,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedByUserId: session.user.id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Get download URL
    const downloadUrl = await getDownloadUrl(s3Key);

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ATTACHMENT_UPLOADED',
        entityType: 'ATTACHMENT',
        entityId: attachment.id,
        metadata: {
          candidateId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      },
    });

    return NextResponse.json({ attachment: { ...attachment, downloadUrl } }, { status: 201 });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/candidates/[id]/attachments - Delete an attachment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    const { id: candidateId } = await params;
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachmentId');

    if (!attachmentId) {
      return NextResponse.json(
        { error: 'attachmentId query parameter is required' },
        { status: 400 }
      );
    }

    // Get the attachment
    const attachment = await db.attachment.findFirst({
      where: { id: attachmentId, candidateId },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Only allow the uploader or admin/owner to delete
    const isOwner = attachment.uploadedByUserId === session.user.id;
    const isAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only delete your own attachments' },
        { status: 403 }
      );
    }

    // Delete from R2
    try {
      await deleteFromR2(attachment.s3Key);
    } catch (error) {
      console.error('Error deleting from R2:', error);
      // Continue with database deletion even if R2 delete fails
    }

    // Delete from database
    await db.attachment.delete({
      where: { id: attachmentId },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ATTACHMENT_DELETED',
        entityType: 'ATTACHMENT',
        entityId: attachmentId,
        metadata: {
          candidateId,
          filename: attachment.filename,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
