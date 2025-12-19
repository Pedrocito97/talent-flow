import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const updateNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000),
});

interface RouteParams {
  params: Promise<{ id: string; noteId: string }>;
}

// GET /api/candidates/[id]/notes/[noteId] - Get a single note
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: candidateId, noteId } = await params;

    const note = await db.note.findFirst({
      where: { id: noteId, candidateId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error fetching note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/candidates/[id]/notes/[noteId] - Update a note
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    const { id: candidateId, noteId } = await params;

    // Get the existing note
    const existingNote = await db.note.findFirst({
      where: { id: noteId, candidateId },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Only allow the creator or admin/owner to edit
    const isOwner = existingNote.createdByUserId === session.user.id;
    const isAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only edit your own notes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = updateNoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { content } = validationResult.data;

    // Update note (notes don't have updatedAt in schema, so just update content)
    const note = await db.note.update({
      where: { id: noteId },
      data: { content },
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
        action: 'NOTE_UPDATED',
        entityType: 'NOTE',
        entityId: noteId,
        metadata: { candidateId, noteId },
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/candidates/[id]/notes/[noteId] - Delete a note
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    const { id: candidateId, noteId } = await params;

    // Get the existing note
    const existingNote = await db.note.findFirst({
      where: { id: noteId, candidateId },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Only allow the creator or admin/owner to delete
    const isOwner = existingNote.createdByUserId === session.user.id;
    const isAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only delete your own notes' },
        { status: 403 }
      );
    }

    // Delete note
    await db.note.delete({
      where: { id: noteId },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'NOTE_DELETED',
        entityType: 'NOTE',
        entityId: noteId,
        metadata: { candidateId, noteId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
