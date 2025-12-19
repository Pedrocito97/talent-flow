import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const updatePipelineSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isArchived: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/pipelines/[id] - Get a single pipeline
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userRole = session.user.role as UserRole;

    const pipeline = await db.pipeline.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { orderIndex: 'asc' },
          include: {
            _count: {
              select: { candidates: true },
            },
          },
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        _count: {
          select: { candidates: true },
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Check access for non-admin users
    if (!['OWNER', 'ADMIN'].includes(userRole)) {
      const hasAccess = pipeline.assignments.some(
        (a) => a.userId === session.user.id
      );
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this pipeline' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ pipeline });
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/pipelines/[id] - Update a pipeline
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'PIPELINE_UPDATE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = updatePipelineSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const existingPipeline = await db.pipeline.findUnique({
      where: { id },
    });

    if (!existingPipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const { name, description, isArchived } = validationResult.data;

    const pipeline = await db.pipeline.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isArchived !== undefined && { isArchived }),
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
        action: isArchived ? 'PIPELINE_ARCHIVED' : 'PIPELINE_UPDATED',
        entityType: 'PIPELINE',
        entityId: pipeline.id,
        metadata: {
          changes: validationResult.data,
          previousName: existingPipeline.name,
        },
      },
    });

    return NextResponse.json({ pipeline });
  } catch (error) {
    console.error('Error updating pipeline:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/pipelines/[id] - Delete a pipeline
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'PIPELINE_DELETE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const pipeline = await db.pipeline.findUnique({
      where: { id },
      include: {
        _count: {
          select: { candidates: true },
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Prevent deletion if pipeline has candidates
    if (pipeline._count.candidates > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete pipeline with candidates',
          message: `This pipeline has ${pipeline._count.candidates} candidates. Archive it instead or move candidates first.`,
        },
        { status: 400 }
      );
    }

    await db.pipeline.delete({
      where: { id },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PIPELINE_DELETED',
        entityType: 'PIPELINE',
        entityId: id,
        metadata: { name: pipeline.name },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pipeline:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
