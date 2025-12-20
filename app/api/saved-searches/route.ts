import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod';

const createSearchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  filters: z.object({
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
  }),
  isDefault: z.boolean().optional(),
});

// GET /api/saved-searches - List user's saved searches
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searches = await db.savedSearch.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json({ searches });
  } catch (error) {
    console.error('Error fetching saved searches:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/saved-searches - Create a new saved search
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, filters, isDefault } = parsed.data;

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.savedSearch.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const search = await db.savedSearch.create({
      data: {
        userId: session.user.id,
        name,
        filters,
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({ search }, { status: 201 });
  } catch (error) {
    console.error('Error creating saved search:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
