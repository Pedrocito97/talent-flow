import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';
import { getResend, EMAIL_FROM } from '@/lib/email/resend';
import { z } from 'zod';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validation schema for sending email
const sendEmailSchema = z.object({
  templateId: z.string().optional(),
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Body is required'),
  toEmail: z.string().email('Invalid email address').optional(),
});

// GET /api/candidates/[id]/emails - List emails sent to candidate
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'CANDIDATE_VIEW')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if candidate exists
    const candidate = await db.candidate.findUnique({
      where: { id, deletedAt: null },
      select: { id: true },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    const emails = await db.emailLog.findMany({
      where: { candidateId: id },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
        sentBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
    });

    return NextResponse.json({ emails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/candidates/[id]/emails - Send email to candidate
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'TEMPLATE_SEND')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = sendEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get candidate with email
    const candidate = await db.candidate.findUnique({
      where: { id, deletedAt: null },
      include: {
        pipeline: {
          select: { name: true },
        },
        stage: {
          select: { name: true },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    // Use provided email or candidate's email
    const toEmail = parsed.data.toEmail || candidate.email;

    if (!toEmail) {
      return NextResponse.json(
        { error: 'Candidate has no email address' },
        { status: 400 }
      );
    }

    // Replace template variables
    const variableValues: Record<string, string> = {
      fullName: candidate.fullName,
      firstName: candidate.fullName.split(' ')[0],
      lastName: candidate.fullName.split(' ').slice(1).join(' ') || '',
      email: toEmail,
      pipelineName: candidate.pipeline.name,
      stageName: candidate.stage.name,
    };

    const subject = replaceTemplateVariables(parsed.data.subject, variableValues);
    const emailBody = replaceTemplateVariables(parsed.data.body, variableValues);

    // Create email log entry (pending)
    const emailLog = await db.emailLog.create({
      data: {
        candidateId: id,
        templateId: parsed.data.templateId,
        sentByUserId: session.user.id,
        toEmail,
        subject,
        body: emailBody,
        status: 'PENDING',
      },
    });

    try {
      // Send via Resend
      const resend = getResend();
      const result = await resend.emails.send({
        from: EMAIL_FROM,
        to: toEmail,
        subject,
        html: emailBody.replace(/\n/g, '<br>'),
      });

      // Update email log with success
      await db.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'SENT',
          providerMessageId: result.data?.id,
        },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'EMAIL_SENT',
          entityType: 'CANDIDATE',
          entityId: id,
          metadata: {
            emailLogId: emailLog.id,
            toEmail,
            subject,
            templateId: parsed.data.templateId,
          },
        },
      });

      return NextResponse.json({
        success: true,
        emailLog: {
          id: emailLog.id,
          status: 'SENT',
          toEmail,
          subject,
        },
      });
    } catch (sendError) {
      // Update email log with failure
      await db.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'FAILED',
          errorMessage: sendError instanceof Error ? sendError.message : 'Unknown error',
        },
      });

      console.error('Error sending email:', sendError);

      return NextResponse.json(
        {
          error: 'Failed to send email',
          emailLog: {
            id: emailLog.id,
            status: 'FAILED',
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing email request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to replace {{variable}} with actual values
function replaceTemplateVariables(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
    return values[variable] || match;
  });
}
