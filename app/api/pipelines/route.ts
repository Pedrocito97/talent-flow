import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const createPipelineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  stages: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional(),
      })
    )
    .optional(),
});

// GET /api/pipelines - List all pipelines
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;

    // OWNER and ADMIN can see all pipelines
    // RECRUITER and VIEWER can only see assigned pipelines
    let pipelines;

    if (['OWNER', 'ADMIN'].includes(userRole)) {
      pipelines = await db.pipeline.findMany({
        where: { isArchived: false },
        include: {
          stages: {
            orderBy: { orderIndex: 'asc' },
          },
          _count: {
            select: { candidates: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      pipelines = await db.pipeline.findMany({
        where: {
          isArchived: false,
          assignments: {
            some: { userId: session.user.id },
          },
        },
        include: {
          stages: {
            orderBy: { orderIndex: 'asc' },
          },
          _count: {
            select: { candidates: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json({ pipelines });
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/pipelines - Create a new pipeline
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'PIPELINE_CREATE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = createPipelineSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, stages } = validationResult.data;

    // Default stages if not provided
    const defaultStages = [
      { name: 'Inbox', color: '#6B7280', isDefault: true },
      { name: 'Screening', color: '#3B82F6' },
      { name: 'Interview', color: '#8B5CF6' },
      { name: 'Offer', color: '#F59E0B' },
      { name: 'Hired', color: '#10B981' },
      { name: 'Rejected', color: '#EF4444' },
    ];

    const stagesToCreate = stages?.length
      ? stages.map((s, index) => ({
          name: s.name,
          color: s.color || '#6B7280',
          orderIndex: index,
          isDefault: index === 0,
        }))
      : defaultStages.map((s, index) => ({
          name: s.name,
          color: s.color,
          orderIndex: index,
          isDefault: s.isDefault || false,
        }));

    const pipeline = await db.pipeline.create({
      data: {
        name,
        description,
        stages: {
          create: stagesToCreate,
        },
      },
      include: {
        stages: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PIPELINE_CREATED',
        entityType: 'PIPELINE',
        entityId: pipeline.id,
        metadata: { name, stageCount: stagesToCreate.length },
      },
    });

    return NextResponse.json({ pipeline }, { status: 201 });
  } catch (error) {
    console.error('Error creating pipeline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
