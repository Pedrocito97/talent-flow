import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

// GET /api/users - List all users
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'USER_VIEW')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const users = await db.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        invitedAt: true,
        activatedAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            assignedCandidates: true,
            createdNotes: true,
            sentEmails: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    // Count pending invitations
    const pendingInvitations = users.filter((u) => u.invitedAt && !u.activatedAt).length;

    return NextResponse.json({
      users,
      stats: {
        total: users.length,
        active: users.filter((u) => u.activatedAt).length,
        pending: pendingInvitations,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
