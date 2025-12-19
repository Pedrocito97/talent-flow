import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/candidates/[id]/notes - List notes for a candidate
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

    // Fetch notes with author info
    const notes = await db.note.findMany({
      where: { candidateId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/candidates/[id]/notes - Create a new note
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_UPDATE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id: candidateId } = await params;
    const body = await request.json();
    const validationResult = createNoteSchema.safeParse(body);

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

    const { content } = validationResult.data;

    // Create note
    const note = await db.note.create({
      data: {
        candidateId,
        content,
        createdByUserId: session.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'NOTE_CREATED',
        entityType: 'NOTE',
        entityId: note.id,
        metadata: { candidateId, noteId: note.id },
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
