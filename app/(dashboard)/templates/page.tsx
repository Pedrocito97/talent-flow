'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, Pencil, Trash2, Loader2, Search, Copy, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  _count: {
    emailLogs: number;
  };
}

const AVAILABLE_VARIABLES = [
  { name: 'fullName', description: 'Full name of the candidate' },
  { name: 'firstName', description: 'First name of the candidate' },
  { name: 'lastName', description: 'Last name of the candidate' },
  { name: 'email', description: 'Email address of the candidate' },
  { name: 'pipelineName', description: 'Name of the pipeline' },
  { name: 'stageName', description: 'Current stage name' },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<EmailTemplate | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/templates');
      if (response.ok) {
        const { templates } = await response.json();
        setTemplates(templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreateOpen = () => {
    setFormName('');
    setFormSubject('');
    setFormBody('');
    setIsCreateOpen(true);
  };

  const handleEditOpen = (template: EmailTemplate) => {
    setFormName(template.name);
    setFormSubject(template.subject);
    setFormBody(template.body);
    setEditingTemplate(template);
  };

  const handleClose = () => {
    setIsCreateOpen(false);
    setEditingTemplate(null);
    setFormName('');
    setFormSubject('');
    setFormBody('');
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSubject.trim() || !formBody.trim()) return;

    setIsSaving(true);

    try {
      const url = editingTemplate ? `/api/templates/${editingTemplate.id}` : '/api/templates';

      const response = await fetch(url, {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          subject: formSubject,
          body: formBody,
        }),
      });

      if (response.ok) {
        fetchTemplates();
        handleClose();
      }
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;

    try {
      const response = await fetch(`/api/templates/${deletingTemplate.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to delete template:', error);
    } finally {
      setDeletingTemplate(null);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('form-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formBody;
      const before = text.substring(0, start);
      const after = text.substring(end);
      setFormBody(`${before}{{${variable}}}${after}`);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    } else {
      setFormBody(formBody + `{{${variable}}}`);
    }
  };

  const filteredTemplates = templates.filter(
    (template) =>
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Email Templates</h1>
          <p className="text-muted-foreground">
            Create and manage email templates for candidate communication
          </p>
        </div>
        <Button onClick={handleCreateOpen}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No templates yet</p>
            <p className="text-muted-foreground mb-4">
              Create your first email template to get started
            </p>
            <Button onClick={handleCreateOpen}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    <CardDescription className="truncate">{template.subject}</CardDescription>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPreviewTemplate(template)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEditOpen(template)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingTemplate(template)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                  {template.body.substring(0, 150)}
                  {template.body.length > 150 ? '...' : ''}
                </p>
                {template.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.variables.map((variable) => (
                      <Badge key={variable} variant="secondary" className="text-xs">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {template._count.emailLogs} email{template._count.emailLogs !== 1 ? 's' : ''}{' '}
                    sent
                  </span>
                  <span>
                    {formatDistanceToNow(new Date(template.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingTemplate} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              Create an email template with variable placeholders for personalization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-name">Template Name</Label>
              <Input
                id="form-name"
                placeholder="e.g., Interview Invitation"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-subject">Subject Line</Label>
              <Input
                id="form-subject"
                placeholder="e.g., Interview Invitation - {{pipelineName}}"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="form-body">Email Body</Label>
              <Textarea
                id="form-body"
                placeholder="Write your email content here. Use {{variable}} for personalization."
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                rows={10}
              />
            </div>

            {/* Variable Buttons */}
            <div className="space-y-2">
              <Label className="text-sm">Insert Variables</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((v) => (
                  <Button
                    key={v.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(v.name)}
                    title={v.description}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    {`{{${v.name}}}`}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !formName.trim() || !formSubject.trim() || !formBody.trim()}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            <DialogDescription>Template Preview</DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Subject</Label>
                <p className="font-medium">{previewTemplate.subject}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Body</Label>
                <div className="mt-1 p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {previewTemplate.body}
                </div>
              </div>
              {previewTemplate.variables.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Variables Used</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {previewTemplate.variables.map((v) => (
                      <Badge key={v} variant="secondary">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (previewTemplate) {
                  handleEditOpen(previewTemplate);
                  setPreviewTemplate(null);
                }
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTemplate} onOpenChange={() => setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? This action
              cannot be undone. Existing email logs will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
