'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Send, Loader2, CheckCircle, XCircle, Clock, Eye, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface EmailLog {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'FAILED';
  sentAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
  errorMessage: string | null;
  template: {
    id: string;
    name: string;
  } | null;
  sentBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

interface EmailsSectionProps {
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
}

export function EmailsSection({ candidateId, candidateName, candidateEmail }: EmailsSectionProps) {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [viewingEmail, setViewingEmail] = useState<EmailLog | null>(null);

  // Compose form
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchEmails = useCallback(async () => {
    try {
      const response = await fetch(`/api/candidates/${candidateId}/emails`);
      if (response.ok) {
        const { emails } = await response.json();
        setEmails(emails);
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setIsLoading(false);
    }
  }, [candidateId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/templates');
      if (response.ok) {
        const { templates } = await response.json();
        setTemplates(templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
    fetchTemplates();
  }, [fetchEmails, fetchTemplates]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setSubject(template.subject);
        setBody(template.body);
      }
    } else {
      setSubject('');
      setBody('');
    }
  };

  const handleComposeOpen = () => {
    setSelectedTemplateId('');
    setSubject('');
    setBody('');
    setIsComposeOpen(true);
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !body.trim()) return;

    setIsSending(true);

    try {
      const response = await fetch(`/api/candidates/${candidateId}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplateId || undefined,
          subject,
          body,
        }),
      });

      if (response.ok) {
        fetchEmails();
        setIsComposeOpen(false);
        toast.success('Email sent successfully');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      toast.error('Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const getStatusIcon = (status: EmailLog['status']) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'SENT':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'DELIVERED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'OPENED':
        return <Eye className="h-4 w-4 text-green-600" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: EmailLog['status']) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary">Pending</Badge>;
      case 'SENT':
        return <Badge variant="default">Sent</Badge>;
      case 'DELIVERED':
        return (
          <Badge variant="default" className="bg-green-500">
            Delivered
          </Badge>
        );
      case 'OPENED':
        return (
          <Badge variant="default" className="bg-green-600">
            Opened
          </Badge>
        );
      case 'FAILED':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Emails</h3>
        <Button
          size="sm"
          onClick={handleComposeOpen}
          disabled={!candidateEmail}
          title={!candidateEmail ? 'Candidate has no email address' : undefined}
        >
          <Mail className="mr-2 h-4 w-4" />
          Send Email
        </Button>
      </div>

      {!candidateEmail && (
        <p className="text-sm text-muted-foreground">
          No email address available for this candidate.
        </p>
      )}

      {emails.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No emails have been sent to this candidate yet.
        </p>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => (
            <div
              key={email.id}
              className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
              onClick={() => setViewingEmail(email)}
            >
              {getStatusIcon(email.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{email.subject}</p>
                <p className="text-xs text-muted-foreground truncate">To: {email.toEmail}</p>
                {email.errorMessage && (
                  <p className="text-xs text-destructive mt-1">{email.errorMessage}</p>
                )}
              </div>
              <div className="text-right">
                {getStatusBadge(email.status)}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(email.sentAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Email</DialogTitle>
            <DialogDescription>
              Send an email to {candidateName} ({candidateEmail})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template (Optional)</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template or write from scratch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No template</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Email subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-body">Body</Label>
              <Textarea
                id="email-body"
                placeholder="Write your message..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
              />
              <p className="text-xs text-muted-foreground">
                Variables like {'{{fullName}}'} will be replaced with actual values.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={isSending || !subject.trim() || !body.trim()}
            >
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Email Dialog */}
      <Dialog open={!!viewingEmail} onOpenChange={() => setViewingEmail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>

          {viewingEmail && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {getStatusBadge(viewingEmail.status)}
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(viewingEmail.sentAt), { addSuffix: true })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">To</Label>
                  <p>{viewingEmail.toEmail}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Sent By</Label>
                  <p>{viewingEmail.sentBy?.name || viewingEmail.sentBy?.email || 'Unknown'}</p>
                </div>
                {viewingEmail.template && (
                  <div>
                    <Label className="text-muted-foreground">Template</Label>
                    <p>{viewingEmail.template.name}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-muted-foreground">Subject</Label>
                <p className="font-medium">{viewingEmail.subject}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Body</Label>
                <div className="mt-1 p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {viewingEmail.body}
                </div>
              </div>

              {viewingEmail.errorMessage && (
                <div>
                  <Label className="text-destructive">Error</Label>
                  <p className="text-sm text-destructive">{viewingEmail.errorMessage}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingEmail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
