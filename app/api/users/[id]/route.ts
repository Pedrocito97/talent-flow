import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';
import { z } from 'zod';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'RECRUITER', 'VIEWER']).optional(),
});

// GET /api/users/[id] - Get a single user
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    const { id } = await params;

    // Users can view their own profile, admins can view anyone
    if (id !== session.user.id && !hasPermission(userRole, 'USER_VIEW')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const user = await db.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        invitedAt: true,
        activatedAt: true,
        createdAt: true,
        updatedAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        pipelineAssignments: {
          include: {
            pipeline: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignedCandidates: true,
            createdNotes: true,
            sentEmails: true,
            uploadedAttachments: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'USER_UPDATE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await db.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent changing own role (security)
    if (id === session.user.id && parsed.data.role) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Only OWNER can create/demote OWNERs
    const newRole = parsed.data.role;
    const isPromotingToOwner = newRole === 'OWNER';
    const isDemotingOwner = existing.role === 'OWNER' && newRole && newRole !== 'OWNER';

    if (isPromotingToOwner || isDemotingOwner) {
      if (userRole !== 'OWNER') {
        return NextResponse.json(
          { error: 'Only owners can manage owner roles' },
          { status: 403 }
        );
      }
    }

    // Prevent demoting the last OWNER
    if (isDemotingOwner) {
      const ownerCount = await db.user.count({
        where: { role: 'OWNER', deletedAt: null },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the last owner' },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        activatedAt: true,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'USER_UPDATE',
        entityType: 'USER',
        entityId: id,
        metadata: { changes: Object.keys(updateData) },
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Soft delete a user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'USER_DELETE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await db.user.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting the last OWNER
    if (existing.role === 'OWNER') {
      const ownerCount = await db.user.count({
        where: { role: 'OWNER', deletedAt: null },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last owner' },
          { status: 400 }
        );
      }
    }

    // Soft delete
    await db.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'USER_DELETE',
        entityType: 'USER',
        entityId: id,
        metadata: { email: existing.email },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
