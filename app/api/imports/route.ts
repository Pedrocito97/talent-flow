import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const createBatchSchema = z.object({
  pipelineId: z.string().min(1, 'Pipeline ID is required'),
  defaultCountryCode: z.string().length(2).optional(),
});

// GET /api/imports - List import batches
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');

    const batches = await db.importBatch.findMany({
      where: pipelineId ? { pipelineId } : undefined,
      include: {
        pipeline: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ batches });
  } catch (error) {
    console.error('Error fetching import batches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/imports - Create a new import batch
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validationResult = createBatchSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { pipelineId, defaultCountryCode } = validationResult.data;

    // Verify pipeline exists
    const pipeline = await db.pipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Create import batch
    const batch = await db.importBatch.create({
      data: {
        pipelineId,
        createdByUserId: session.user.id,
        defaultCountryCode: defaultCountryCode || 'BE',
        status: 'PENDING',
      },
      include: {
        pipeline: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'IMPORT_BATCH_CREATED',
        entityType: 'IMPORT_BATCH',
        entityId: batch.id,
        metadata: { pipelineId },
      },
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    console.error('Error creating import batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
