import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const reorderSchema = z.object({
  stageIds: z.array(z.string()).min(1, 'At least one stage ID required'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/pipelines/[id]/stages/reorder - Reorder stages
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pipelineId } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'STAGE_UPDATE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = reorderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { stageIds } = validationResult.data;

    // Verify pipeline exists
    const pipeline = await db.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: true,
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Verify all stage IDs belong to this pipeline
    const pipelineStageIds = new Set(pipeline.stages.map((s) => s.id));
    const allStagesExist = stageIds.every((id) => pipelineStageIds.has(id));

    if (!allStagesExist) {
      return NextResponse.json(
        { error: 'One or more stage IDs do not belong to this pipeline' },
        { status: 400 }
      );
    }

    // Verify all stages are included
    if (stageIds.length !== pipeline.stages.length) {
      return NextResponse.json(
        { error: 'All stages must be included in the reorder' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const uniqueIds = new Set(stageIds);
    if (uniqueIds.size !== stageIds.length) {
      return NextResponse.json({ error: 'Duplicate stage IDs are not allowed' }, { status: 400 });
    }

    // Update all stages with new order indices using a transaction
    await db.$transaction(
      stageIds.map((stageId, index) =>
        db.stage.update({
          where: { id: stageId },
          data: { orderIndex: index },
        })
      )
    );

    // Fetch updated stages
    const updatedStages = await db.stage.findMany({
      where: { pipelineId },
      orderBy: { orderIndex: 'asc' },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'STAGES_REORDERED',
        entityType: 'PIPELINE',
        entityId: pipelineId,
        metadata: { newOrder: stageIds },
      },
    });

    return NextResponse.json({ stages: updatedStages });
  } catch (error) {
    console.error('Error reordering stages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
