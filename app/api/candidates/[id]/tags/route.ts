import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const assignTagSchema = z.object({
  tagId: z.string().min(1, 'Tag ID is required'),
});

const assignTagsSchema = z.object({
  tagIds: z.array(z.string()).min(1, 'At least one tag ID required'),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/candidates/[id]/tags - List tags for a candidate
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: candidateId } = await params;

    // Verify candidate exists
    const candidate = await db.candidate.findUnique({
      where: { id: candidateId, deletedAt: null },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Fetch candidate tags
    const candidateTags = await db.candidateTag.findMany({
      where: { candidateId },
      include: {
        tag: true,
      },
      orderBy: { assignedAt: 'desc' },
    });

    const tags = candidateTags.map((ct) => ct.tag);

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching candidate tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/candidates/[id]/tags - Add a tag to candidate
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: candidateId } = await params;
    const body = await request.json();
    const validationResult = assignTagSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Verify candidate exists
    const candidate = await db.candidate.findUnique({
      where: { id: candidateId, deletedAt: null },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const { tagId } = validationResult.data;

    // Verify tag exists
    const tag = await db.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Check if already assigned
    const existing = await db.candidateTag.findUnique({
      where: { candidateId_tagId: { candidateId, tagId } },
    });

    if (existing) {
      return NextResponse.json({ error: 'Tag already assigned to candidate' }, { status: 409 });
    }

    // Assign tag
    await db.candidateTag.create({
      data: { candidateId, tagId },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TAG_ASSIGNED',
        entityType: 'CANDIDATE',
        entityId: candidateId,
        metadata: { candidateId, tagId, tagName: tag.name },
      },
    });

    return NextResponse.json({ success: true, tag }, { status: 201 });
  } catch (error) {
    console.error('Error assigning tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/candidates/[id]/tags - Replace all tags (bulk update)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: candidateId } = await params;
    const body = await request.json();
    const validationResult = assignTagsSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Verify candidate exists
    const candidate = await db.candidate.findUnique({
      where: { id: candidateId, deletedAt: null },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const { tagIds } = validationResult.data;

    // Verify all tags exist
    const tags = await db.tag.findMany({
      where: { id: { in: tagIds } },
    });

    if (tags.length !== tagIds.length) {
      return NextResponse.json({ error: 'One or more tags not found' }, { status: 404 });
    }

    // Replace all tags in a transaction
    await db.$transaction([
      // Remove all existing tags
      db.candidateTag.deleteMany({
        where: { candidateId },
      }),
      // Add new tags
      db.candidateTag.createMany({
        data: tagIds.map((tagId) => ({ candidateId, tagId })),
      }),
    ]);

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TAGS_UPDATED',
        entityType: 'CANDIDATE',
        entityId: candidateId,
        metadata: { candidateId, tagIds },
      },
    });

    return NextResponse.json({ success: true, tags });
  } catch (error) {
    console.error('Error updating tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/candidates/[id]/tags - Remove a tag from candidate
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: candidateId } = await params;
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('tagId');

    if (!tagId) {
      return NextResponse.json({ error: 'tagId query parameter is required' }, { status: 400 });
    }

    // Verify candidate exists
    const candidate = await db.candidate.findUnique({
      where: { id: candidateId, deletedAt: null },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Check if tag is assigned
    const existing = await db.candidateTag.findUnique({
      where: { candidateId_tagId: { candidateId, tagId } },
      include: { tag: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Tag not assigned to candidate' }, { status: 404 });
    }

    // Remove tag
    await db.candidateTag.delete({
      where: { candidateId_tagId: { candidateId, tagId } },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TAG_REMOVED',
        entityType: 'CANDIDATE',
        entityId: candidateId,
        metadata: { candidateId, tagId, tagName: existing.tag.name },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
