'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  User,
  MapPin,
  Loader2,
  MoreHorizontal,
  Trash2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator as _Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  NotesSection,
  AttachmentsSection,
  TagsSection,
  StageHistory,
  EmailsSection,
  Note,
  Attachment,
  Tag,
  StageHistoryEntry,
} from '@/components/candidates';

interface Stage {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Pipeline {
  id: string;
  name: string;
}

interface Candidate {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string | null;
  source: string | null;
  isRejected: boolean;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pipeline: Pipeline;
  stage: Stage;
  assignedTo: User | null;
  tags: { tag: Tag }[];
  notes: Note[];
  attachments: Attachment[];
  stageHistory: StageHistoryEntry[];
  _count: {
    notes: number;
    attachments: number;
  };
}

interface Session {
  user: {
    id: string;
    role: string;
  };
}

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params.id as string;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCandidate = useCallback(async () => {
    try {
      const response = await fetch(`/api/candidates/${candidateId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load candidate');
        return;
      }

      setCandidate(data.candidate);
    } catch (err) {
      setError('Failed to load candidate');
      console.error(err);
    }
  }, [candidateId]);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      setSession(data);
    } catch (err) {
      console.error('Failed to fetch session:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchCandidate(), fetchSession()]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchCandidate, fetchSession]);

  const handleReject = async () => {
    if (!candidate) return;

    try {
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isRejected: !candidate.isRejected,
        }),
      });

      if (response.ok) {
        const { candidate: updated } = await response.json();
        setCandidate(updated);
      }
    } catch (error) {
      console.error('Failed to update rejection status:', error);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/candidates/${candidateId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push(`/pipelines/${candidate?.pipeline.id}`);
      }
    } catch (error) {
      console.error('Failed to delete candidate:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleNoteAdded = (note: Note) => {
    if (!candidate) return;
    setCandidate({
      ...candidate,
      notes: [note, ...candidate.notes],
      _count: { ...candidate._count, notes: candidate._count.notes + 1 },
    });
  };

  const handleNoteUpdated = (updatedNote: Note) => {
    if (!candidate) return;
    setCandidate({
      ...candidate,
      notes: candidate.notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)),
    });
  };

  const handleNoteDeleted = (noteId: string) => {
    if (!candidate) return;
    setCandidate({
      ...candidate,
      notes: candidate.notes.filter((n) => n.id !== noteId),
      _count: { ...candidate._count, notes: candidate._count.notes - 1 },
    });
  };

  const handleAttachmentAdded = (attachment: Attachment) => {
    if (!candidate) return;
    setCandidate({
      ...candidate,
      attachments: [attachment, ...candidate.attachments],
      _count: { ...candidate._count, attachments: candidate._count.attachments + 1 },
    });
  };

  const handleAttachmentDeleted = (attachmentId: string) => {
    if (!candidate) return;
    setCandidate({
      ...candidate,
      attachments: candidate.attachments.filter((a) => a.id !== attachmentId),
      _count: { ...candidate._count, attachments: candidate._count.attachments - 1 },
    });
  };

  const handleTagsChanged = (newTags: Tag[]) => {
    if (!candidate) return;
    setCandidate({
      ...candidate,
      tags: newTags.map((tag) => ({ tag })),
    });
  };

  const isAdmin = session?.user?.role === 'OWNER' || session?.user?.role === 'ADMIN';
  const currentUserId = session?.user?.id || '';

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-[400px]" />
          </div>
          <div>
            <Skeleton className="h-[300px]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center">
        <p className="text-lg font-medium text-muted-foreground">
          {error || 'Candidate not found'}
        </p>
        <Button asChild className="mt-4">
          <Link href="/pipelines">Go to Pipelines</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link
            href={`/pipelines/${candidate.pipeline.id}`}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {candidate.pipeline.name}
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{candidate.fullName}</h1>
              {candidate.isRejected && <Badge variant="destructive">Rejected</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {candidate.email && (
                <a
                  href={`mailto:${candidate.email}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Mail className="h-4 w-4" />
                  {candidate.email}
                </a>
              )}
              {candidate.phoneE164 && (
                <a
                  href={`tel:${candidate.phoneE164}`}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="h-4 w-4" />
                  {candidate.phoneE164}
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/pipelines/${candidate.pipeline.id}`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View in Pipeline
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleReject}>
                  {candidate.isRejected ? (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restore Candidate
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Reject Candidate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - main content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="notes">
            <TabsList>
              <TabsTrigger value="notes">Notes ({candidate._count.notes})</TabsTrigger>
              <TabsTrigger value="files">Files ({candidate._count.attachments})</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="mt-4">
              <NotesSection
                candidateId={candidateId}
                notes={candidate.notes}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onNoteAdded={handleNoteAdded}
                onNoteUpdated={handleNoteUpdated}
                onNoteDeleted={handleNoteDeleted}
              />
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <AttachmentsSection
                candidateId={candidateId}
                attachments={candidate.attachments}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onAttachmentAdded={handleAttachmentAdded}
                onAttachmentDeleted={handleAttachmentDeleted}
              />
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <EmailsSection
                candidateId={candidateId}
                candidateName={candidate.fullName}
                candidateEmail={candidate.email}
              />
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <StageHistory history={candidate.stageHistory} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column - sidebar */}
        <div className="space-y-6">
          {/* Stage */}
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Current Stage</h3>
            <Badge
              variant="secondary"
              className="text-sm"
              style={{
                backgroundColor: `${candidate.stage.color}20`,
                borderColor: candidate.stage.color,
                color: candidate.stage.color,
              }}
            >
              {candidate.stage.name}
            </Badge>
          </div>

          {/* Tags */}
          <div className="rounded-lg border p-4">
            <TagsSection
              candidateId={candidateId}
              tags={candidate.tags.map((t) => t.tag)}
              onTagsChanged={handleTagsChanged}
            />
          </div>

          {/* Details */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium">Details</h3>

            <div className="space-y-3 text-sm">
              {candidate.assignedTo && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">Assigned To</div>
                    <div>{candidate.assignedTo.name || candidate.assignedTo.email}</div>
                  </div>
                </div>
              )}

              {candidate.source && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground">Source</div>
                    <div className="capitalize">{candidate.source}</div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <div className="text-muted-foreground">Added</div>
                  <div>{format(new Date(candidate.createdAt), 'PPP')}</div>
                </div>
              </div>

              {candidate.isRejected && candidate.rejectedAt && (
                <div className="flex items-start gap-3">
                  <Trash2 className="h-4 w-4 mt-0.5 text-destructive" />
                  <div>
                    <div className="text-muted-foreground">Rejected</div>
                    <div>{format(new Date(candidate.rejectedAt), 'PPP')}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {candidate.fullName}? This action cannot
              be undone and will remove all associated notes and attachments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
