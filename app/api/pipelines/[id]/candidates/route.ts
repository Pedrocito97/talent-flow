import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

const createCandidateSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  email: z.string().email('Invalid email').optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  stageId: z.string().optional(), // If not provided, use default stage
  source: z.string().max(50).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Valid sort fields
const SORT_FIELDS = ['fullName', 'email', 'createdAt', 'updatedAt', 'stage'] as const;
type SortField = (typeof SORT_FIELDS)[number];

// GET /api/pipelines/[id]/candidates - List candidates for a pipeline
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pipelineId } = await params;
    const { searchParams } = new URL(request.url);

    // Query parameters
    const stageId = searchParams.get('stageId');
    const search = searchParams.get('search');
    const assignedToMe = searchParams.get('assignedToMe') === 'true';
    const assignedToUserId = searchParams.get('assignedToUserId');
    const includeRejected = searchParams.get('includeRejected') === 'true';
    const view = searchParams.get('view') || 'kanban'; // 'kanban' or 'table'

    // Pagination (for table view)
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 100);

    // Sorting (for table view)
    const sortField = (searchParams.get('sortField') || 'createdAt') as SortField;
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Verify pipeline exists
    const pipeline = await db.pipeline.findUnique({
      where: { id: pipelineId },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    // Build query filters
    const where: {
      pipelineId: string;
      stageId?: string;
      isRejected?: boolean;
      assignedToUserId?: string | null;
      deletedAt?: null;
      mergedIntoId?: null;
      OR?: Array<{
        fullName?: { contains: string; mode: 'insensitive' };
        email?: { contains: string; mode: 'insensitive' };
        phoneE164?: { contains: string; mode: 'insensitive' };
      }>;
    } = {
      pipelineId,
      deletedAt: null,
      mergedIntoId: null,
    };

    if (stageId) {
      where.stageId = stageId;
    }

    if (!includeRejected) {
      where.isRejected = false;
    }

    if (assignedToMe) {
      where.assignedToUserId = session.user.id;
    } else if (assignedToUserId) {
      where.assignedToUserId = assignedToUserId === 'unassigned' ? null : assignedToUserId;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phoneE164: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy based on sort field
    type OrderByType = {
      stage?: { orderIndex: 'asc' | 'desc' };
      fullName?: 'asc' | 'desc';
      email?: 'asc' | 'desc';
      createdAt?: 'asc' | 'desc';
      updatedAt?: 'asc' | 'desc';
    };
    let orderBy: OrderByType | OrderByType[];

    if (sortField === 'stage') {
      orderBy = [{ stage: { orderIndex: sortOrder } }, { createdAt: 'desc' }];
    } else if (SORT_FIELDS.includes(sortField)) {
      orderBy = { [sortField]: sortOrder };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    // Get total count for pagination
    const totalCount = await db.candidate.count({ where });

    // Fetch candidates
    const candidates = await db.candidate.findMany({
      where,
      include: {
        stage: {
          select: { id: true, name: true, color: true, orderIndex: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        _count: {
          select: { notes: true, attachments: true },
        },
      },
      orderBy,
      ...(view === 'table' && {
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    });

    // Group by stage for kanban view
    const candidatesByStage =
      view === 'kanban'
        ? candidates.reduce(
            (acc, candidate) => {
              const stageId = candidate.stageId;
              if (!acc[stageId]) {
                acc[stageId] = [];
              }
              acc[stageId].push(candidate);
              return acc;
            },
            {} as Record<string, typeof candidates>
          )
        : undefined;

    return NextResponse.json({
      candidates,
      candidatesByStage,
      total: totalCount,
      pagination:
        view === 'table'
          ? {
              page,
              pageSize,
              totalPages: Math.ceil(totalCount / pageSize),
              totalCount,
            }
          : undefined,
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/pipelines/[id]/candidates - Create a new candidate
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: pipelineId } = await params;
    const userRole = session.user.role as UserRole;

    if (!hasPermission(userRole, 'CANDIDATE_CREATE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = createCandidateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    // Verify pipeline exists and get default stage
    const pipeline = await db.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: {
          where: { isDefault: true },
          take: 1,
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const { fullName, email, phone, stageId, source } = validationResult.data;

    // Determine which stage to use
    let targetStageId = stageId;
    if (!targetStageId) {
      if (pipeline.stages.length === 0) {
        // No default stage, get first stage
        const firstStage = await db.stage.findFirst({
          where: { pipelineId },
          orderBy: { orderIndex: 'asc' },
        });
        if (!firstStage) {
          return NextResponse.json({ error: 'Pipeline has no stages' }, { status: 400 });
        }
        targetStageId = firstStage.id;
      } else {
        targetStageId = pipeline.stages[0].id;
      }
    }

    // Verify stage belongs to pipeline
    const stage = await db.stage.findFirst({
      where: { id: targetStageId, pipelineId },
    });

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found in this pipeline' }, { status: 400 });
    }

    // Create candidate
    const candidate = await db.candidate.create({
      data: {
        fullName,
        email: email || null,
        phoneE164: phone || null,
        pipelineId,
        stageId: targetStageId,
        source: source || 'manual',
        assignedToUserId: session.user.id, // Assign to creator
      },
      include: {
        stage: {
          select: { id: true, name: true, color: true, orderIndex: true },
        },
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    // Create initial stage history entry
    await db.candidateStageHistory.create({
      data: {
        candidateId: candidate.id,
        fromStageId: null,
        toStageId: targetStageId,
        movedByUserId: session.user.id,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CANDIDATE_CREATED',
        entityType: 'CANDIDATE',
        entityId: candidate.id,
        metadata: { fullName, pipelineId, stageId: targetStageId },
      },
    });

    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    console.error('Error creating candidate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
