import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const updateCandidateSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  assignedToUserId: z.string().nullable().optional(),
  isRejected: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/candidates/[id] - Get a single candidate
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const candidate = await db.candidate.findUnique({
      where: { id },
      include: {
        pipeline: {
          select: { id: true, name: true },
        },
        stage: {
          select: { id: true, name: true, color: true, orderIndex: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        rejectedBy: {
          select: { id: true, name: true, email: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        notes: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { uploadedAt: 'desc' },
        },
        stageHistory: {
          include: {
            fromStage: { select: { id: true, name: true, color: true } },
            toStage: { select: { id: true, name: true, color: true } },
            movedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { movedAt: 'desc' },
        },
        _count: {
          select: { notes: true, attachments: true },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    return NextResponse.json({ candidate });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/candidates/[id] - Update a candidate
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = updateCandidateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const existingCandidate = await db.candidate.findUnique({
      where: { id },
    });

    if (!existingCandidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const { fullName, email, phone, assignedToUserId, isRejected } =
      validationResult.data;

    // Build update data
    const updateData: {
      fullName?: string;
      email?: string | null;
      phoneE164?: string | null;
      assignedToUserId?: string | null;
      isRejected?: boolean;
      rejectedAt?: Date | null;
      rejectedByUserId?: string | null;
    } = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phoneE164 = phone;
    if (assignedToUserId !== undefined)
      updateData.assignedToUserId = assignedToUserId;

    // Handle rejection status change
    if (isRejected !== undefined) {
      updateData.isRejected = isRejected;
      if (isRejected) {
        updateData.rejectedAt = new Date();
        updateData.rejectedByUserId = session.user.id;
      } else {
        updateData.rejectedAt = null;
        updateData.rejectedByUserId = null;
      }
    }

    const candidate = await db.candidate.update({
      where: { id },
      data: updateData,
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
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: isRejected ? 'CANDIDATE_REJECTED' : 'CANDIDATE_UPDATED',
        entityType: 'CANDIDATE',
        entityId: candidate.id,
        metadata: { changes: validationResult.data },
      },
    });

    return NextResponse.json({ candidate });
  } catch (error) {
    console.error('Error updating candidate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/candidates/[id] - Delete (soft) a candidate
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'CANDIDATE_DELETE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const candidate = await db.candidate.findUnique({
      where: { id },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Soft delete
    await db.candidate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CANDIDATE_DELETED',
        entityType: 'CANDIDATE',
        entityId: id,
        metadata: { fullName: candidate.fullName },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
