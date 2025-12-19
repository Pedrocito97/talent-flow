import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const createStageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional()
    .default('#6B7280'),
  orderIndex: z.number().int().min(0).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/pipelines/[id]/stages - List all stages for a pipeline
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pipelineId } = await params;

    const pipeline = await db.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: {
          orderBy: { orderIndex: 'asc' },
          include: {
            _count: {
              select: { candidates: true },
            },
          },
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    return NextResponse.json({ stages: pipeline.stages });
  } catch (error) {
    console.error('Error fetching stages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/pipelines/[id]/stages - Create a new stage
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pipelineId } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'STAGE_CREATE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = createStageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const pipeline = await db.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: {
          orderBy: { orderIndex: 'desc' },
          take: 1,
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const { name, color } = validationResult.data;

    // Calculate orderIndex - either specified or append to end
    let orderIndex = validationResult.data.orderIndex;
    if (orderIndex === undefined) {
      const maxOrderIndex = pipeline.stages[0]?.orderIndex ?? -1;
      orderIndex = maxOrderIndex + 1;
    } else {
      // Shift existing stages if inserting at specific position
      await db.stage.updateMany({
        where: {
          pipelineId,
          orderIndex: { gte: orderIndex },
        },
        data: {
          orderIndex: { increment: 1 },
        },
      });
    }

    const stage = await db.stage.create({
      data: {
        pipelineId,
        name,
        color,
        orderIndex,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'STAGE_CREATED',
        entityType: 'STAGE',
        entityId: stage.id,
        metadata: { pipelineId, name, orderIndex },
      },
    });

    return NextResponse.json({ stage }, { status: 201 });
  } catch (error) {
    console.error('Error creating stage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
