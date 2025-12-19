import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

interface DuplicateGroup {
  key: string;
  type: 'email' | 'phone';
  value: string;
  candidates: {
    id: string;
    fullName: string;
    email: string | null;
    phoneE164: string | null;
    pipelineId: string;
    pipeline: { name: string };
    stage: { name: string; color: string };
    createdAt: Date;
    source: string | null;
    _count: { notes: number; attachments: number };
  }[];
}

// GET /api/candidates/duplicates - Find duplicate candidates
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_MERGE')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');

    // Build base where clause
    const baseWhere = {
      deletedAt: null,
      mergedIntoId: null, // Exclude already merged candidates
      ...(pipelineId && { pipelineId }),
    };

    // Find candidates with duplicate emails
    const candidatesWithEmail = await db.candidate.findMany({
      where: {
        ...baseWhere,
        email: { not: null },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        pipelineId: true,
        pipeline: { select: { name: true } },
        stage: { select: { name: true, color: true } },
        createdAt: true,
        source: true,
        _count: { select: { notes: true, attachments: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Find candidates with duplicate phones
    const candidatesWithPhone = await db.candidate.findMany({
      where: {
        ...baseWhere,
        phoneE164: { not: null },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneE164: true,
        pipelineId: true,
        pipeline: { select: { name: true } },
        stage: { select: { name: true, color: true } },
        createdAt: true,
        source: true,
        _count: { select: { notes: true, attachments: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by email
    const emailGroups = new Map<string, typeof candidatesWithEmail>();
    for (const candidate of candidatesWithEmail) {
      const email = candidate.email!.toLowerCase();
      const existing = emailGroups.get(email) || [];
      existing.push(candidate);
      emailGroups.set(email, existing);
    }

    // Group by phone
    const phoneGroups = new Map<string, typeof candidatesWithPhone>();
    for (const candidate of candidatesWithPhone) {
      const phone = candidate.phoneE164!;
      const existing = phoneGroups.get(phone) || [];
      existing.push(candidate);
      phoneGroups.set(phone, existing);
    }

    // Build duplicate groups (only where count > 1)
    const duplicateGroups: DuplicateGroup[] = [];
    const seenCandidateIds = new Set<string>();

    // Add email duplicates
    for (const [email, candidates] of emailGroups) {
      if (candidates.length > 1) {
        // Check if we've already included these candidates in another group
        const newCandidates = candidates.filter((c) => !seenCandidateIds.has(c.id));
        if (newCandidates.length > 1) {
          duplicateGroups.push({
            key: `email:${email}`,
            type: 'email',
            value: email,
            candidates: candidates,
          });
          candidates.forEach((c) => seenCandidateIds.add(c.id));
        }
      }
    }

    // Add phone duplicates (that aren't already in email groups)
    for (const [phone, candidates] of phoneGroups) {
      if (candidates.length > 1) {
        const newCandidates = candidates.filter((c) => !seenCandidateIds.has(c.id));
        if (newCandidates.length > 1) {
          duplicateGroups.push({
            key: `phone:${phone}`,
            type: 'phone',
            value: phone,
            candidates: newCandidates,
          });
          newCandidates.forEach((c) => seenCandidateIds.add(c.id));
        } else if (newCandidates.length === 1 && candidates.length > 1) {
          // Some candidates are already in email groups, add full group for context
          duplicateGroups.push({
            key: `phone:${phone}`,
            type: 'phone',
            value: phone,
            candidates: candidates,
          });
        }
      }
    }

    // Sort by number of duplicates (most first)
    duplicateGroups.sort((a, b) => b.candidates.length - a.candidates.length);

    return NextResponse.json({
      groups: duplicateGroups,
      stats: {
        totalGroups: duplicateGroups.length,
        totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.candidates.length, 0),
      },
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
