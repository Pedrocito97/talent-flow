import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission } from '@/lib/auth/rbac';
import { z } from 'zod';

type UserRole = 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validation schema for updating templates
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
});

// GET /api/templates/[id] - Get a single template
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'TEMPLATE_VIEW')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const template = await db.emailTemplate.findUnique({
      where: { id, deletedAt: null },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            emailLogs: true,
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/templates/[id] - Update a template
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'TEMPLATE_UPDATE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check if template exists
    const existing = await db.emailTemplate.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.subject !== undefined) updateData.subject = parsed.data.subject;
    if (parsed.data.body !== undefined) {
      updateData.body = parsed.data.body;
      // Re-extract variables when body changes
      const extractedVariables = extractVariablesFromTemplate(parsed.data.body);
      updateData.variables = [
        ...new Set([...(parsed.data.variables || []), ...extractedVariables]),
      ];
    } else if (parsed.data.variables !== undefined) {
      updateData.variables = parsed.data.variables;
    }

    const template = await db.emailTemplate.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TEMPLATE_UPDATE',
        entityType: 'EMAIL_TEMPLATE',
        entityId: template.id,
        metadata: { changes: Object.keys(updateData) },
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/templates/[id] - Soft delete a template
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as UserRole;
    if (!hasPermission(userRole, 'TEMPLATE_DELETE')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    // Check if template exists
    const existing = await db.emailTemplate.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Soft delete
    await db.emailTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TEMPLATE_DELETE',
        entityType: 'EMAIL_TEMPLATE',
        entityId: id,
        metadata: { name: existing.name },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to extract {{variable}} patterns from template
function extractVariablesFromTemplate(template: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}
