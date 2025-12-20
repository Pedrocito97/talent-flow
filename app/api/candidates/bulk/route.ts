import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const bulkActionSchema = z.object({
  candidateIds: z.array(z.string()).min(1, 'At least one candidate required'),
  action: z.enum(['move', 'reject', 'unreject', 'delete', 'assign']),
  stageId: z.string().optional(), // Required for 'move' action
  assignedToUserId: z.string().nullable().optional(), // Required for 'assign' action
});

// POST /api/candidates/bulk - Perform bulk actions on candidates
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    const body = await request.json();
    const validationResult = bulkActionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { candidateIds, action, stageId, assignedToUserId } = validationResult.data;

    // Verify all candidates exist and are not deleted
    const candidates = await db.candidate.findMany({
      where: {
        id: { in: candidateIds },
        deletedAt: null,
      },
      include: {
        stage: true,
      },
    });

    if (candidates.length !== candidateIds.length) {
      return NextResponse.json({ error: 'One or more candidates not found' }, { status: 404 });
    }

    // Verify all candidates are in the same pipeline
    const pipelineIds = new Set(candidates.map((c) => c.pipelineId));
    if (pipelineIds.size > 1) {
      return NextResponse.json(
        { error: 'All candidates must be in the same pipeline' },
        { status: 400 }
      );
    }

    const pipelineId = candidates[0].pipelineId;
    let result: { success: boolean; affected: number; message?: string };

    switch (action) {
      case 'move': {
        if (!hasPermission(userRole, 'CANDIDATE_MOVE')) {
          return NextResponse.json(
            { error: 'Insufficient permissions to move candidates' },
            { status: 403 }
          );
        }

        if (!stageId) {
          return NextResponse.json(
            { error: 'stageId is required for move action' },
            { status: 400 }
          );
        }

        // Verify stage exists and belongs to the same pipeline
        const stage = await db.stage.findFirst({
          where: { id: stageId, pipelineId },
        });

        if (!stage) {
          return NextResponse.json({ error: 'Stage not found in this pipeline' }, { status: 404 });
        }

        // Move candidates
        await db.$transaction(async (tx) => {
          // Update all candidates
          await tx.candidate.updateMany({
            where: { id: { in: candidateIds } },
            data: { stageId },
          });

          // Create stage history entries
          for (const candidate of candidates) {
            if (candidate.stageId !== stageId) {
              await tx.candidateStageHistory.create({
                data: {
                  candidateId: candidate.id,
                  fromStageId: candidate.stageId,
                  toStageId: stageId,
                  movedByUserId: session.user.id,
                },
              });
            }
          }

          // Create audit log
          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: 'CANDIDATES_BULK_MOVED',
              entityType: 'CANDIDATE',
              entityId: candidateIds[0],
              metadata: {
                candidateIds,
                toStageId: stageId,
                toStageName: stage.name,
                count: candidateIds.length,
              },
            },
          });
        });

        result = {
          success: true,
          affected: candidateIds.length,
          message: `Moved ${candidateIds.length} candidates to ${stage.name}`,
        };
        break;
      }

      case 'reject': {
        if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
          return NextResponse.json(
            { error: 'Insufficient permissions to reject candidates' },
            { status: 403 }
          );
        }

        await db.$transaction(async (tx) => {
          await tx.candidate.updateMany({
            where: { id: { in: candidateIds } },
            data: {
              isRejected: true,
              rejectedAt: new Date(),
              rejectedByUserId: session.user.id,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: 'CANDIDATES_BULK_REJECTED',
              entityType: 'CANDIDATE',
              entityId: candidateIds[0],
              metadata: { candidateIds, count: candidateIds.length },
            },
          });
        });

        result = {
          success: true,
          affected: candidateIds.length,
          message: `Rejected ${candidateIds.length} candidates`,
        };
        break;
      }

      case 'unreject': {
        if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
          return NextResponse.json(
            { error: 'Insufficient permissions to unreject candidates' },
            { status: 403 }
          );
        }

        await db.$transaction(async (tx) => {
          await tx.candidate.updateMany({
            where: { id: { in: candidateIds } },
            data: {
              isRejected: false,
              rejectedAt: null,
              rejectedByUserId: null,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: 'CANDIDATES_BULK_UNREJECTED',
              entityType: 'CANDIDATE',
              entityId: candidateIds[0],
              metadata: { candidateIds, count: candidateIds.length },
            },
          });
        });

        result = {
          success: true,
          affected: candidateIds.length,
          message: `Restored ${candidateIds.length} candidates`,
        };
        break;
      }

      case 'delete': {
        if (!hasPermission(userRole, 'CANDIDATE_DELETE')) {
          return NextResponse.json(
            { error: 'Insufficient permissions to delete candidates' },
            { status: 403 }
          );
        }

        await db.$transaction(async (tx) => {
          // Soft delete
          await tx.candidate.updateMany({
            where: { id: { in: candidateIds } },
            data: { deletedAt: new Date() },
          });

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: 'CANDIDATES_BULK_DELETED',
              entityType: 'CANDIDATE',
              entityId: candidateIds[0],
              metadata: { candidateIds, count: candidateIds.length },
            },
          });
        });

        result = {
          success: true,
          affected: candidateIds.length,
          message: `Deleted ${candidateIds.length} candidates`,
        };
        break;
      }

      case 'assign': {
        if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
          return NextResponse.json(
            { error: 'Insufficient permissions to assign candidates' },
            { status: 403 }
          );
        }

        // Verify user exists if assigning
        if (assignedToUserId) {
          const user = await db.user.findUnique({
            where: { id: assignedToUserId },
          });
          if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
          }
        }

        await db.$transaction(async (tx) => {
          await tx.candidate.updateMany({
            where: { id: { in: candidateIds } },
            data: { assignedToUserId: assignedToUserId || null },
          });

          await tx.auditLog.create({
            data: {
              userId: session.user.id,
              action: 'CANDIDATES_BULK_ASSIGNED',
              entityType: 'CANDIDATE',
              entityId: candidateIds[0],
              metadata: {
                candidateIds,
                assignedToUserId: assignedToUserId || null,
                count: candidateIds.length,
              },
            },
          });
        });

        result = {
          success: true,
          affected: candidateIds.length,
          message: assignedToUserId
            ? `Assigned ${candidateIds.length} candidates`
            : `Unassigned ${candidateIds.length} candidates`,
        };
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error performing bulk action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
