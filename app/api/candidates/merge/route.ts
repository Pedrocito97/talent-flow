import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';
import { z } from 'zod';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const mergeSchema = z.object({
  targetId: z.string().min(1, 'Target candidate ID is required'),
  sourceIds: z.array(z.string()).min(1, 'At least one source candidate is required'),
  // Optional: specify which fields to take from which candidate
  fieldOverrides: z
    .object({
      fullName: z.string().optional(),
      email: z.string().email().optional().nullable(),
      phoneE164: z.string().optional().nullable(),
    })
    .optional(),
});

// POST /api/candidates/merge - Merge candidates
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_MERGE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = mergeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { targetId, sourceIds, fieldOverrides } = parsed.data;

    // Ensure target is not in sources
    if (sourceIds.includes(targetId)) {
      return NextResponse.json(
        { error: 'Target candidate cannot be in source list' },
        { status: 400 }
      );
    }

    // Get target candidate
    const target = await db.candidate.findUnique({
      where: { id: targetId, deletedAt: null, mergedIntoId: null },
      include: {
        tags: true,
        notes: true,
        attachments: true,
        stageHistory: true,
        emailLogs: true,
      },
    });

    if (!target) {
      return NextResponse.json(
        { error: 'Target candidate not found or already merged' },
        { status: 404 }
      );
    }

    // Get source candidates
    const sources = await db.candidate.findMany({
      where: {
        id: { in: sourceIds },
        deletedAt: null,
        mergedIntoId: null,
      },
      include: {
        tags: true,
        notes: true,
        attachments: true,
        stageHistory: true,
        emailLogs: true,
      },
    });

    if (sources.length !== sourceIds.length) {
      return NextResponse.json(
        { error: 'Some source candidates not found or already merged' },
        { status: 404 }
      );
    }

    // Perform merge in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Update target with field overrides if provided
      const updateData: Record<string, unknown> = {};
      if (fieldOverrides?.fullName) updateData.fullName = fieldOverrides.fullName;
      if (fieldOverrides?.email !== undefined) updateData.email = fieldOverrides.email;
      if (fieldOverrides?.phoneE164 !== undefined) updateData.phoneE164 = fieldOverrides.phoneE164;

      // Fill in missing fields from sources (first non-null value)
      if (!target.email && !fieldOverrides?.email) {
        const sourceEmail = sources.find((s) => s.email)?.email;
        if (sourceEmail) updateData.email = sourceEmail;
      }
      if (!target.phoneE164 && !fieldOverrides?.phoneE164) {
        const sourcePhone = sources.find((s) => s.phoneE164)?.phoneE164;
        if (sourcePhone) updateData.phoneE164 = sourcePhone;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.candidate.update({
          where: { id: targetId },
          data: updateData,
        });
      }

      // 2. Move all tags from sources to target (avoiding duplicates)
      const existingTagIds = new Set(target.tags.map((t) => t.tagId));
      const newTags = sources.flatMap((s) => s.tags).filter((t) => !existingTagIds.has(t.tagId));

      if (newTags.length > 0) {
        await tx.candidateTag.createMany({
          data: newTags.map((t) => ({
            candidateId: targetId,
            tagId: t.tagId,
          })),
          skipDuplicates: true,
        });
      }

      // 3. Move all notes from sources to target
      for (const source of sources) {
        await tx.note.updateMany({
          where: { candidateId: source.id },
          data: { candidateId: targetId },
        });
      }

      // 4. Move all attachments from sources to target
      for (const source of sources) {
        await tx.attachment.updateMany({
          where: { candidateId: source.id },
          data: { candidateId: targetId },
        });
      }

      // 5. Move all email logs from sources to target
      for (const source of sources) {
        await tx.emailLog.updateMany({
          where: { candidateId: source.id },
          data: { candidateId: targetId },
        });
      }

      // 6. Move stage history from sources to target
      for (const source of sources) {
        await tx.candidateStageHistory.updateMany({
          where: { candidateId: source.id },
          data: { candidateId: targetId },
        });
      }

      // 7. Mark source candidates as merged
      for (const source of sources) {
        await tx.candidate.update({
          where: { id: source.id },
          data: { mergedIntoId: targetId },
        });

        // 8. Create merge log entry
        await tx.mergeLog.create({
          data: {
            sourceCandidateId: source.id,
            targetCandidateId: targetId,
            mergedByUserId: session.user.id,
          },
        });
      }

      // 9. Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CANDIDATE_MERGE',
          entityType: 'CANDIDATE',
          entityId: targetId,
          metadata: {
            targetId,
            sourceIds,
            sourceCount: sourceIds.length,
          },
        },
      });

      return {
        targetId,
        mergedCount: sourceIds.length,
      };
    });

    // Fetch updated target
    const updatedTarget = await db.candidate.findUnique({
      where: { id: targetId },
      include: {
        pipeline: { select: { name: true } },
        stage: { select: { name: true, color: true } },
        tags: { include: { tag: true } },
        _count: {
          select: { notes: true, attachments: true, emailLogs: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      merged: result.mergedCount,
      candidate: updatedTarget,
    });
  } catch (error) {
    console.error('Error merging candidates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
