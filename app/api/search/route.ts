import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';
import { Prisma } from '@prisma/client';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

// GET /api/search - Global search across candidates
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_VIEW')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);

    // Search parameters
    const query = searchParams.get('q') || '';
    const pipelineId = searchParams.get('pipelineId');
    const stageId = searchParams.get('stageId');
    const tagIds = searchParams.getAll('tagId');
    const source = searchParams.get('source');
    const assignedToUserId = searchParams.get('assignedToUserId');
    const status = searchParams.get('status'); // active, rejected, all
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const hasEmail = searchParams.get('hasEmail');
    const hasPhone = searchParams.get('hasPhone');
    const hasNotes = searchParams.get('hasNotes');
    const hasAttachments = searchParams.get('hasAttachments');

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '25', 10), 100);
    const skip = (page - 1) * pageSize;

    // Sorting
    const sortField = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build pipeline filter based on role
    const isFullAccess = userRole === 'OWNER' || userRole === 'ADMIN';

    // Get accessible pipeline IDs
    let accessiblePipelineIds: string[] = [];
    if (!isFullAccess) {
      const assignments = await db.pipelineAssignment.findMany({
        where: { userId: session.user.id },
        select: { pipelineId: true },
      });
      accessiblePipelineIds = assignments.map((a) => a.pipelineId);
    }

    // Build where clause
    const where: Prisma.CandidateWhereInput = {
      deletedAt: null,
      mergedIntoId: null,
    };

    // Pipeline access control
    if (!isFullAccess) {
      where.pipelineId = { in: accessiblePipelineIds };
    }

    // Specific pipeline filter
    if (pipelineId) {
      if (!isFullAccess && !accessiblePipelineIds.includes(pipelineId)) {
        return NextResponse.json({ error: 'Pipeline access denied' }, { status: 403 });
      }
      where.pipelineId = pipelineId;
    }

    // Stage filter
    if (stageId) {
      where.stageId = stageId;
    }

    // Text search (name, email, phone)
    if (query.trim()) {
      const searchTerms = query.trim().toLowerCase();
      where.OR = [
        { fullName: { contains: searchTerms, mode: 'insensitive' } },
        { email: { contains: searchTerms, mode: 'insensitive' } },
        { phoneE164: { contains: searchTerms } },
        { notes: { some: { content: { contains: searchTerms, mode: 'insensitive' } } } },
      ];
    }

    // Tag filter
    if (tagIds.length > 0) {
      where.tags = {
        some: {
          tagId: { in: tagIds },
        },
      };
    }

    // Source filter
    if (source) {
      where.source = source;
    }

    // Assigned recruiter filter
    if (assignedToUserId) {
      where.assignedToUserId = assignedToUserId;
    }

    // Status filter
    if (status === 'active') {
      where.rejectedAt = null;
    } else if (status === 'rejected') {
      where.rejectedAt = { not: null };
    }

    // Date range filter
    if (dateFrom) {
      where.createdAt = {
        ...((where.createdAt as Prisma.DateTimeFilter) || {}),
        gte: new Date(dateFrom),
      };
    }
    if (dateTo) {
      where.createdAt = {
        ...((where.createdAt as Prisma.DateTimeFilter) || {}),
        lte: new Date(dateTo),
      };
    }

    // Has email filter
    if (hasEmail === 'true') {
      where.email = { not: null };
    } else if (hasEmail === 'false') {
      where.email = null;
    }

    // Has phone filter
    if (hasPhone === 'true') {
      where.phoneE164 = { not: null };
    } else if (hasPhone === 'false') {
      where.phoneE164 = null;
    }

    // Has notes filter
    if (hasNotes === 'true') {
      where.notes = { some: {} };
    } else if (hasNotes === 'false') {
      where.notes = { none: {} };
    }

    // Has attachments filter
    if (hasAttachments === 'true') {
      where.attachments = { some: {} };
    } else if (hasAttachments === 'false') {
      where.attachments = { none: {} };
    }

    // Build orderBy
    const orderBy: Prisma.CandidateOrderByWithRelationInput = {};
    const validSortFields = ['fullName', 'email', 'createdAt', 'updatedAt'];
    if (validSortFields.includes(sortField)) {
      orderBy[sortField as keyof typeof orderBy] = sortOrder as 'asc' | 'desc';
    } else if (sortField === 'pipeline') {
      orderBy.pipeline = { name: sortOrder as 'asc' | 'desc' };
    } else if (sortField === 'stage') {
      orderBy.stage = { name: sortOrder as 'asc' | 'desc' };
    } else {
      orderBy.createdAt = 'desc';
    }

    // Execute query
    const [candidates, total] = await Promise.all([
      db.candidate.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          pipeline: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true, color: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
          _count: {
            select: { notes: true, attachments: true, emailLogs: true },
          },
        },
      }),
      db.candidate.count({ where }),
    ]);

    // Get filter options for the UI
    const [pipelines, stages, tags, sources, recruiters] = await Promise.all([
      // Pipelines
      db.pipeline.findMany({
        where: {
          isArchived: false,
          ...(isFullAccess ? {} : { id: { in: accessiblePipelineIds } }),
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      // Stages (for selected pipeline or all)
      pipelineId
        ? db.stage.findMany({
            where: { pipelineId },
            select: { id: true, name: true, color: true },
            orderBy: { orderIndex: 'asc' },
          })
        : [],
      // Tags
      db.tag.findMany({
        select: { id: true, name: true, color: true },
        orderBy: { name: 'asc' },
      }),
      // Sources
      db.candidate.groupBy({
        by: ['source'],
        where: { deletedAt: null, mergedIntoId: null, source: { not: null } },
        _count: { id: true },
      }),
      // Recruiters
      db.user.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      candidates: candidates.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        phoneE164: c.phoneE164,
        pipeline: c.pipeline,
        stage: c.stage,
        assignedTo: c.assignedTo,
        tags: c.tags.map((t) => t.tag),
        source: c.source,
        rejectedAt: c.rejectedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        _count: c._count,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      filterOptions: {
        pipelines,
        stages,
        tags,
        sources: sources.map((s) => ({ source: s.source, count: s._count.id })),
        recruiters,
      },
    });
  } catch (error) {
    console.error('Error searching candidates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
