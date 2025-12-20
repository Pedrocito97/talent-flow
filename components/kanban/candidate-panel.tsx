'use client';

import { useEffect, useState } from 'react';
import {
  Mail,
  Phone,
  User,
  Calendar,
  Tag,
  MessageSquare,
  Paperclip,
  Clock,
  ChevronRight,
  X,
  Loader2,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  content: string;
  createdAt: string;
  createdBy: User | null;
}

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: User | null;
}

interface StageHistory {
  id: string;
  fromStage: Stage | null;
  toStage: Stage;
  movedAt: string;
  movedBy: User | null;
}

interface CandidateDetail {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string | null;
  source: string | null;
  isRejected: boolean;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pipeline: { id: string; name: string };
  stage: Stage;
  assignedTo: User | null;
  rejectedBy: User | null;
  tags: { tag: Tag }[];
  notes: Note[];
  attachments: Attachment[];
  stageHistory: StageHistory[];
}

interface CandidatePanelProps {
  candidateId: string | null;
  open: boolean;
  onClose: () => void;
  onReject?: (candidateId: string) => void;
}

export function CandidatePanel({ candidateId, open, onClose, onReject }: CandidatePanelProps) {
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (candidateId && open) {
      fetchCandidate(candidateId);
    }
  }, [candidateId, open]);

  async function fetchCandidate(id: string) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/candidates/${id}`);
      const data = await response.json();
      if (response.ok) {
        setCandidate(data.candidate);
      }
    } catch (error) {
      console.error('Error fetching candidate:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const initials = candidate?.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[500px] p-0 sm:max-w-[500px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : candidate ? (
          <div className="flex h-full flex-col">
            {/* Header */}
            <SheetHeader className="border-b p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-left">{candidate.fullName}</SheetTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: candidate.stage.color,
                          backgroundColor: `${candidate.stage.color}15`,
                        }}
                      >
                        <span
                          className="mr-1.5 h-2 w-2 rounded-full"
                          style={{ backgroundColor: candidate.stage.color }}
                        />
                        {candidate.stage.name}
                      </Badge>
                      {candidate.isRejected && <Badge variant="destructive">Rejected</Badge>}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>

            {/* Content */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Contact Info */}
                <div className="space-y-2">
                  {candidate.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${candidate.email}`}
                        className="text-primary hover:underline"
                      >
                        {candidate.email}
                      </a>
                    </div>
                  )}
                  {candidate.phoneE164 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`tel:${candidate.phoneE164}`}
                        className="text-primary hover:underline"
                      >
                        {candidate.phoneE164}
                      </a>
                    </div>
                  )}
                  {candidate.assignedTo && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Assigned to{' '}
                        <span className="font-medium">
                          {candidate.assignedTo.name || candidate.assignedTo.email}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Added {formatDate(candidate.createdAt)}</span>
                  </div>
                  {candidate.source && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Tag className="h-4 w-4" />
                      <span>Source: {candidate.source}</span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {candidate.tags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {candidate.tags.map(({ tag }) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Tabs for Notes, Attachments, History */}
                <Tabs defaultValue="notes">
                  <TabsList className="w-full">
                    <TabsTrigger value="notes" className="flex-1">
                      <MessageSquare className="mr-1 h-3 w-3" />
                      Notes ({candidate.notes.length})
                    </TabsTrigger>
                    <TabsTrigger value="files" className="flex-1">
                      <Paperclip className="mr-1 h-3 w-3" />
                      Files ({candidate.attachments.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex-1">
                      <Clock className="mr-1 h-3 w-3" />
                      History
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="notes" className="mt-4 space-y-3">
                    {candidate.notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
                    ) : (
                      candidate.notes.map((note) => (
                        <div key={note.id} className="rounded-lg border p-3">
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {note.createdBy?.name || note.createdBy?.email || 'Unknown'}
                            </span>
                            <span>•</span>
                            <span>{formatDate(note.createdAt)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="files" className="mt-4 space-y-2">
                    {candidate.attachments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No attachments yet
                      </p>
                    ) : (
                      candidate.attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{file.filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.sizeBytes)} • {formatDate(file.uploadedAt)}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="mt-4">
                    {candidate.stageHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No stage changes yet
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {candidate.stageHistory.map((entry) => (
                          <div key={entry.id} className="flex items-start gap-3">
                            <div
                              className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: entry.toStage.color }}
                            />
                            <div className="flex-1">
                              <p className="text-sm">
                                {entry.fromStage ? (
                                  <>
                                    Moved from{' '}
                                    <span className="font-medium">{entry.fromStage.name}</span> to{' '}
                                    <span className="font-medium">{entry.toStage.name}</span>
                                  </>
                                ) : (
                                  <>
                                    Added to{' '}
                                    <span className="font-medium">{entry.toStage.name}</span>
                                  </>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entry.movedBy?.name || entry.movedBy?.email || 'System'} •{' '}
                                {formatDate(entry.movedAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="border-t p-4 flex gap-2">
              <Button variant="outline" className="flex-1">
                Edit
              </Button>
              {!candidate.isRejected && onReject && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onReject(candidate.id)}
                >
                  Reject
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a candidate to view details
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
