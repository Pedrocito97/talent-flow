import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

interface RouteParams {
  params: Promise<{ batchId: string }>;
}

// GET /api/imports/[batchId] - Get import batch details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId } = await params;

    const batch = await db.importBatch.findUnique({
      where: { id: batchId },
      include: {
        pipeline: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            candidate: {
              select: { id: true, fullName: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
    }

    return NextResponse.json({ batch });
  } catch (error) {
    console.error('Error fetching import batch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/imports/[batchId] - Delete an import batch
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_DELETE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { batchId } = await params;

    const batch = await db.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
    }

    // Only allow deletion of pending or failed batches
    if (batch.status === 'PROCESSING') {
      return NextResponse.json(
        { error: 'Cannot delete a batch that is currently processing' },
        { status: 400 }
      );
    }

    // Delete batch (cascades to items)
    await db.importBatch.delete({
      where: { id: batchId },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'IMPORT_BATCH_DELETED',
        entityType: 'IMPORT_BATCH',
        entityId: batchId,
        metadata: { pipelineId: batch.pipelineId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting import batch:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
