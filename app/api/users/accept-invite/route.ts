import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required').optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = acceptInviteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { token, password, name } = validationResult.data;

    // Find user with this token
    const user = await db.user.findFirst({
      where: {
        inviteToken: token,
        activatedAt: null, // Not yet activated
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (user.inviteTokenExpires && user.inviteTokenExpires < new Date()) {
      return NextResponse.json(
        { error: 'Invitation token has expired' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Activate the user
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        name: name || user.name,
        activatedAt: new Date(),
        inviteToken: null, // Clear the token
        inviteTokenExpires: null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_ACTIVATED',
        entityType: 'USER',
        entityId: user.id,
        metadata: {
          email: user.email,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account activated successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to validate token without accepting
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        inviteToken: token,
        activatedAt: null,
      },
      select: {
        email: true,
        name: true,
        inviteTokenExpires: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired invitation token' },
        { status: 400 }
      );
    }

    if (user.inviteTokenExpires && user.inviteTokenExpires < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'Invitation token has expired' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: user.email,
      name: user.name,
    });
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
