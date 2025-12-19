import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const updateStageSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional(),
  isDefault: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string; stageId: string }>;
}

// GET /api/pipelines/[id]/stages/[stageId] - Get a single stage
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pipelineId, stageId } = await params;

    const stage = await db.stage.findFirst({
      where: {
        id: stageId,
        pipelineId,
      },
      include: {
        _count: {
          select: { candidates: true },
        },
      },
    });

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    return NextResponse.json({ stage });
  } catch (error) {
    console.error('Error fetching stage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/pipelines/[id]/stages/[stageId] - Update a stage
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pipelineId, stageId } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'STAGE_UPDATE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = updateStageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const existingStage = await db.stage.findFirst({
      where: {
        id: stageId,
        pipelineId,
      },
    });

    if (!existingStage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    const { name, color, isDefault } = validationResult.data;

    // If setting this as default, unset previous default
    if (isDefault === true) {
      await db.stage.updateMany({
        where: {
          pipelineId,
          isDefault: true,
          id: { not: stageId },
        },
        data: { isDefault: false },
      });
    }

    const stage = await db.stage.update({
      where: { id: stageId },
      data: {
        ...(name !== undefined && { name }),
        ...(color !== undefined && { color }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'STAGE_UPDATED',
        entityType: 'STAGE',
        entityId: stage.id,
        metadata: {
          pipelineId,
          changes: validationResult.data,
          previousName: existingStage.name,
        },
      },
    });

    return NextResponse.json({ stage });
  } catch (error) {
    console.error('Error updating stage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/pipelines/[id]/stages/[stageId] - Delete a stage
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pipelineId, stageId } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'STAGE_DELETE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const stage = await db.stage.findFirst({
      where: {
        id: stageId,
        pipelineId,
      },
      include: {
        _count: {
          select: { candidates: true },
        },
        pipeline: {
          include: {
            stages: true,
          },
        },
      },
    });

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 });
    }

    // Prevent deletion if stage has candidates
    if (stage._count.candidates > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete stage with candidates',
          message: `This stage has ${stage._count.candidates} candidates. Move them first.`,
        },
        { status: 400 }
      );
    }

    // Prevent deletion if it's the only stage
    if (stage.pipeline.stages.length <= 1) {
      return NextResponse.json(
        {
          error: 'Cannot delete the only stage',
          message: 'A pipeline must have at least one stage.',
        },
        { status: 400 }
      );
    }

    // Prevent deletion of default stage unless another exists
    if (stage.isDefault) {
      return NextResponse.json(
        {
          error: 'Cannot delete default stage',
          message: 'Set another stage as default first.',
        },
        { status: 400 }
      );
    }

    const deletedOrderIndex = stage.orderIndex;

    await db.stage.delete({
      where: { id: stageId },
    });

    // Reorder remaining stages
    await db.stage.updateMany({
      where: {
        pipelineId,
        orderIndex: { gt: deletedOrderIndex },
      },
      data: {
        orderIndex: { decrement: 1 },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'STAGE_DELETED',
        entityType: 'STAGE',
        entityId: stageId,
        metadata: { pipelineId, name: stage.name },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting stage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
