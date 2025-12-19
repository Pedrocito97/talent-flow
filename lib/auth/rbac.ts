import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

// Role hierarchy - higher index = more permissions
const ROLE_HIERARCHY: UserRole[] = ['VIEWER', 'RECRUITER', 'ADMIN', 'OWNER'];

/**
 * Check if a role has at least the minimum required permission level
 */
export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const minimumIndex = ROLE_HIERARCHY.indexOf(minimumRole);
  return userIndex >= minimumIndex;
}

/**
 * Check if a user has one of the allowed roles
 */
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Permission definitions for different operations
 */
export const PERMISSIONS = {
  // User management
  USER_INVITE: ['OWNER', 'ADMIN'] as UserRole[],
  USER_UPDATE: ['OWNER', 'ADMIN'] as UserRole[],
  USER_DELETE: ['OWNER'] as UserRole[],
  USER_VIEW: ['OWNER', 'ADMIN'] as UserRole[],

  // Pipeline management
  PIPELINE_CREATE: ['OWNER', 'ADMIN'] as UserRole[],
  PIPELINE_UPDATE: ['OWNER', 'ADMIN'] as UserRole[],
  PIPELINE_DELETE: ['OWNER', 'ADMIN'] as UserRole[],
  PIPELINE_VIEW: ['OWNER', 'ADMIN', 'RECRUITER', 'VIEWER'] as UserRole[],

  // Stage management
  STAGE_CREATE: ['OWNER', 'ADMIN'] as UserRole[],
  STAGE_UPDATE: ['OWNER', 'ADMIN'] as UserRole[],
  STAGE_DELETE: ['OWNER', 'ADMIN'] as UserRole[],

  // Candidate management
  CANDIDATE_CREATE: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[],
  CANDIDATE_UPDATE: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[],
  CANDIDATE_DELETE: ['OWNER', 'ADMIN'] as UserRole[],
  CANDIDATE_VIEW: ['OWNER', 'ADMIN', 'RECRUITER', 'VIEWER'] as UserRole[],
  CANDIDATE_MOVE: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[],
  CANDIDATE_MERGE: ['OWNER', 'ADMIN'] as UserRole[],

  // Import
  IMPORT_CREATE: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[],
  IMPORT_VIEW: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[],

  // Email templates
  TEMPLATE_CREATE: ['OWNER', 'ADMIN'] as UserRole[],
  TEMPLATE_UPDATE: ['OWNER', 'ADMIN'] as UserRole[],
  TEMPLATE_DELETE: ['OWNER', 'ADMIN'] as UserRole[],
  TEMPLATE_VIEW: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[],
  TEMPLATE_SEND: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[],

  // Notes
  NOTE_CREATE: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[],
  NOTE_UPDATE: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[], // Own notes only for RECRUITER
  NOTE_DELETE: ['OWNER', 'ADMIN'] as UserRole[],
  NOTE_VIEW: ['OWNER', 'ADMIN', 'RECRUITER', 'VIEWER'] as UserRole[],

  // Tags
  TAG_CREATE: ['OWNER', 'ADMIN'] as UserRole[],
  TAG_UPDATE: ['OWNER', 'ADMIN'] as UserRole[],
  TAG_DELETE: ['OWNER', 'ADMIN'] as UserRole[],
  TAG_ASSIGN: ['OWNER', 'ADMIN', 'RECRUITER'] as UserRole[],

  // Audit logs
  AUDIT_VIEW: ['OWNER', 'ADMIN'] as UserRole[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Check if user has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(userRole);
}

/**
 * API route handler wrapper that checks authentication
 */
export function withAuth<T>(
  handler: (
    request: NextRequest,
    context: T & { user: { id: string; email: string; role: UserRole } }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: T) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return handler(request, {
      ...context,
      user: {
        id: session.user.id,
        email: session.user.email!,
        role: session.user.role as UserRole,
      },
    });
  };
}

/**
 * API route handler wrapper that checks authentication and permission
 */
export function withPermission<T>(
  permission: Permission,
  handler: (
    request: NextRequest,
    context: T & { user: { id: string; email: string; role: UserRole } }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: T) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, permission)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return handler(request, {
      ...context,
      user: {
        id: session.user.id,
        email: session.user.email!,
        role: userRole,
      },
    });
  };
}

/**
 * API route handler wrapper that checks authentication and role
 */
export function withRole<T>(
  allowedRoles: UserRole[],
  handler: (
    request: NextRequest,
    context: T & { user: { id: string; email: string; role: UserRole } }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: T) => {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;

    if (!hasRole(userRole, allowedRoles)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    return handler(request, {
      ...context,
      user: {
        id: session.user.id,
        email: session.user.email!,
        role: userRole,
      },
    });
  };
}
