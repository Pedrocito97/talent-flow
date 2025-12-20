import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional(),
});

// GET /api/tags - List all tags
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tags = await db.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { candidates: true },
        },
      },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tags - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = createTagSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, color } = validationResult.data;

    // Check if tag with same name exists
    const existing = await db.tag.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json({ error: 'Tag with this name already exists' }, { status: 409 });
    }

    // Create tag
    const tag = await db.tag.create({
      data: {
        name,
        color: color || '#6B7280',
      },
      include: {
        _count: {
          select: { candidates: true },
        },
      },
    });

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
