import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const moveSchema = z.object({
  stageId: z.string().min(1, 'Stage ID is required'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/candidates/[id]/move - Move candidate to a different stage
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'CANDIDATE_MOVE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = moveSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { stageId: newStageId } = validationResult.data;

    // Get candidate with current stage
    const candidate = await db.candidate.findUnique({
      where: { id },
      include: {
        stage: true,
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    if (candidate.deletedAt) {
      return NextResponse.json({ error: 'Cannot move deleted candidate' }, { status: 400 });
    }

    // Verify new stage exists and belongs to same pipeline
    const newStage = await db.stage.findFirst({
      where: {
        id: newStageId,
        pipelineId: candidate.pipelineId,
      },
    });

    if (!newStage) {
      return NextResponse.json({ error: 'Stage not found in this pipeline' }, { status: 400 });
    }

    // Skip if already in this stage
    if (candidate.stageId === newStageId) {
      return NextResponse.json({
        candidate,
        message: 'Candidate is already in this stage',
      });
    }

    const previousStageId = candidate.stageId;

    // Update candidate stage
    const updatedCandidate = await db.candidate.update({
      where: { id },
      data: { stageId: newStageId },
      include: {
        stage: {
          select: { id: true, name: true, color: true, orderIndex: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: {
          select: { notes: true, attachments: true },
        },
      },
    });

    // Create stage history entry
    await db.candidateStageHistory.create({
      data: {
        candidateId: id,
        fromStageId: previousStageId,
        toStageId: newStageId,
        movedByUserId: session.user.id,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CANDIDATE_MOVED',
        entityType: 'CANDIDATE',
        entityId: id,
        metadata: {
          fullName: candidate.fullName,
          fromStageId: previousStageId,
          fromStageName: candidate.stage.name,
          toStageId: newStageId,
          toStageName: newStage.name,
        },
      },
    });

    return NextResponse.json({
      candidate: updatedCandidate,
      moved: {
        from: { id: previousStageId, name: candidate.stage.name },
        to: { id: newStageId, name: newStage.name },
      },
    });
  } catch (error) {
    console.error('Error moving candidate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
