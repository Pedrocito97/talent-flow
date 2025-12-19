import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const updateSearchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  filters: z
    .object({
      q: z.string().optional(),
      pipelineId: z.string().optional(),
      stageId: z.string().optional(),
      tagIds: z.array(z.string()).optional(),
      source: z.string().optional(),
      assignedToUserId: z.string().optional(),
      status: z.enum(['active', 'rejected', 'all']).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      hasEmail: z.enum(['true', 'false']).optional(),
      hasPhone: z.enum(['true', 'false']).optional(),
      hasNotes: z.enum(['true', 'false']).optional(),
      hasAttachments: z.enum(['true', 'false']).optional(),
    })
    .optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/saved-searches/[id] - Get a single saved search
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const search = await db.savedSearch.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!search) {
      return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
    }

    return NextResponse.json({ search });
  } catch (error) {
    console.error('Error fetching saved search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/saved-searches/[id] - Update a saved search
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.savedSearch.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, filters, isDefault } = parsed.data;

    // If setting as default, unset other defaults
    if (isDefault === true) {
      await db.savedSearch.updateMany({
        where: { userId: session.user.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const search = await db.savedSearch.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(filters && { filters }),
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    return NextResponse.json({ search });
  } catch (error) {
    console.error('Error updating saved search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/saved-searches/[id] - Delete a saved search
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.savedSearch.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
    }

    await db.savedSearch.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
