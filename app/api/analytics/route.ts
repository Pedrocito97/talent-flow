import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

// GET /api/analytics - Get dashboard analytics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'PIPELINE_VIEW')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    // Build pipeline filter based on role
    const isFullAccess = userRole === 'OWNER' || userRole === 'ADMIN';
    const pipelineWhere = isFullAccess
      ? pipelineId
        ? { id: pipelineId, isArchived: false }
        : { isArchived: false }
      : {
          ...(pipelineId ? { id: pipelineId } : {}),
          isArchived: false,
          assignments: { some: { userId: session.user.id } },
        };

    // Get accessible pipeline IDs
    const accessiblePipelines = await db.pipeline.findMany({
      where: pipelineWhere,
      select: { id: true },
    });
    const pipelineIds = accessiblePipelines.map((p) => p.id);

    // Base candidate filter
    const candidateWhere = {
      pipelineId: { in: pipelineIds },
      deletedAt: null,
      mergedIntoId: null,
    };

    // 1. KPI Metrics
    const [
      totalCandidates,
      activePipelines,
      candidatesThisPeriod,
      candidatesPreviousPeriod,
      rejectedCandidates,
      hiredCandidates,
      pendingImports,
      emailsSent,
    ] = await Promise.all([
      // Total candidates
      db.candidate.count({ where: candidateWhere }),
      // Active pipelines
      db.pipeline.count({ where: { ...pipelineWhere, isArchived: false } }),
      // Candidates this period
      db.candidate.count({
        where: {
          ...candidateWhere,
          createdAt: { gte: startDate, lte: endDate },
        },
      }),
      // Candidates previous period (for comparison)
      db.candidate.count({
        where: {
          ...candidateWhere,
          createdAt: {
            gte: subDays(startDate, days),
            lt: startDate,
          },
        },
      }),
      // Rejected candidates
      db.candidate.count({
        where: {
          ...candidateWhere,
          rejectedAt: { not: null },
        },
      }),
      // Hired candidates (in a "Hired" stage)
      db.candidate.count({
        where: {
          ...candidateWhere,
          stage: { name: { contains: 'Hired', mode: 'insensitive' } },
        },
      }),
      // Pending imports
      db.importBatch.count({
        where: {
          pipelineId: { in: pipelineIds },
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      }),
      // Emails sent this period
      db.emailLog.count({
        where: {
          candidate: { pipelineId: { in: pipelineIds } },
          sentAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    // Calculate growth percentage
    const candidateGrowth =
      candidatesPreviousPeriod > 0
        ? Math.round(
            ((candidatesThisPeriod - candidatesPreviousPeriod) /
              candidatesPreviousPeriod) *
              100
          )
        : candidatesThisPeriod > 0
        ? 100
        : 0;

    // 2. Pipeline Funnel - candidates per stage for each pipeline
    const pipelinesWithStages = await db.pipeline.findMany({
      where: pipelineWhere,
      include: {
        stages: {
          orderBy: { orderIndex: 'asc' },
          include: {
            _count: {
              select: {
                candidates: {
                  where: { deletedAt: null, mergedIntoId: null },
                },
              },
            },
          },
        },
      },
    });

    const pipelineFunnels = pipelinesWithStages.map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      stages: pipeline.stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        color: stage.color,
        count: stage._count.candidates,
      })),
    }));

    // 3. Candidates over time (daily for the period)
    const candidatesOverTime = await db.candidate.groupBy({
      by: ['createdAt'],
      where: {
        ...candidateWhere,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
    });

    // Group by date
    const dailyCounts: Record<string, number> = {};
    for (let i = 0; i <= days; i++) {
      const date = format(subDays(new Date(), days - i), 'yyyy-MM-dd');
      dailyCounts[date] = 0;
    }

    candidatesOverTime.forEach((item) => {
      const date = format(new Date(item.createdAt), 'yyyy-MM-dd');
      if (dailyCounts[date] !== undefined) {
        dailyCounts[date] += item._count.id;
      }
    });

    const timeSeriesData = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      count,
    }));

    // 4. Source breakdown
    const sourceBreakdown = await db.candidate.groupBy({
      by: ['source'],
      where: candidateWhere,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const sources = sourceBreakdown.map((item) => ({
      source: item.source || 'manual',
      count: item._count.id,
    }));

    // 5. Recent activity (last 10 audit log entries)
    const recentActivity = await db.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'CANDIDATE' },
          { entityType: 'PIPELINE' },
          { entityType: 'STAGE' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // 6. Top recruiters (by candidates added)
    const topRecruiters = await db.candidate.groupBy({
      by: ['assignedToUserId'],
      where: {
        ...candidateWhere,
        assignedToUserId: { not: null },
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const recruiterIds = topRecruiters
      .map((r) => r.assignedToUserId)
      .filter((id): id is string => id !== null);

    const recruiters = await db.user.findMany({
      where: { id: { in: recruiterIds } },
      select: { id: true, name: true, email: true },
    });

    const recruiterMap = new Map(recruiters.map((r) => [r.id, r]));
    const topRecruitersData = topRecruiters.map((item) => ({
      user: recruiterMap.get(item.assignedToUserId!) || {
        id: item.assignedToUserId,
        name: 'Unknown',
        email: '',
      },
      count: item._count.id,
    }));

    // 7. Average time in stage (for conversion metrics)
    const stageHistory = await db.candidateStageHistory.findMany({
      where: {
        candidate: { pipelineId: { in: pipelineIds }, deletedAt: null },
        movedAt: { gte: startDate, lte: endDate },
      },
      select: {
        fromStageId: true,
        toStageId: true,
        movedAt: true,
        candidate: {
          select: { createdAt: true },
        },
      },
      orderBy: { movedAt: 'asc' },
    });

    // Calculate conversion rate (candidates that moved at least once)
    const candidatesWithMovement = new Set(
      stageHistory.map((h) => h.candidate.createdAt.toISOString())
    ).size;
    const conversionRate =
      totalCandidates > 0
        ? Math.round((candidatesWithMovement / totalCandidates) * 100)
        : 0;

    return NextResponse.json({
      period: { start: startDate, end: endDate, days },
      kpis: {
        totalCandidates,
        activePipelines,
        candidatesThisPeriod,
        candidateGrowth,
        rejectedCandidates,
        hiredCandidates,
        pendingImports,
        emailsSent,
        conversionRate,
      },
      pipelineFunnels,
      timeSeriesData,
      sources,
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        user: log.user,
        createdAt: log.createdAt,
        metadata: log.metadata,
      })),
      topRecruiters: topRecruitersData,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
