import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getResend, EMAIL_FROM } from '@/lib/email/resend';
import {
  getInviteEmailSubject,
  getInviteEmailHtml,
  getInviteEmailText,
} from '@/lib/email/templates/invite';

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['ADMIN', 'RECRUITER', 'VIEWER']),
  pipelineIds: z.array(z.string().uuid()).optional(),
});

// Token expires in 7 days
const INVITE_TOKEN_EXPIRY_DAYS = 7;

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only OWNER and ADMIN can invite users
    if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = inviteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { email, name, role, pipelineIds } = validationResult.data;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (existingUser.activatedAt) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
      }

      // User was invited but hasn't activated - we can resend
      // Continue to regenerate token and resend email
    }

    // Generate secure invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpires = new Date(
      Date.now() + INVITE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    // Get inviter's name
    const inviter = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });

    const inviterName = inviter?.name || inviter?.email || 'A team member';

    // Create or update user
    const user = await db.user.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        name: name || null,
        role,
        inviteToken,
        inviteTokenExpires,
        invitedAt: new Date(),
        // Password will be set when user accepts invitation
      },
      update: {
        name: name || undefined,
        role,
        inviteToken,
        inviteTokenExpires,
        invitedAt: new Date(),
      },
    });

    // Assign pipelines if specified
    if (pipelineIds && pipelineIds.length > 0) {
      // Remove existing assignments for this user
      await db.pipelineAssignment.deleteMany({
        where: { userId: user.id },
      });

      // Create new assignments
      await db.pipelineAssignment.createMany({
        data: pipelineIds.map((pipelineId) => ({
          userId: user.id,
          pipelineId,
        })),
      });
    }

    // Build invite URL
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

    // Send invitation email
    const { error: emailError } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: normalizedEmail,
      subject: getInviteEmailSubject(),
      html: getInviteEmailHtml({
        inviteeName: name || '',
        inviterName,
        inviteUrl,
        expiresIn: `${INVITE_TOKEN_EXPIRY_DAYS} days`,
      }),
      text: getInviteEmailText({
        inviteeName: name || '',
        inviterName,
        inviteUrl,
        expiresIn: `${INVITE_TOKEN_EXPIRY_DAYS} days`,
      }),
    });

    if (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the request - user was created, email can be resent
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'USER_INVITED',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          invitedEmail: normalizedEmail,
          role,
          pipelineIds: pipelineIds || [],
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      emailSent: !emailError,
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
