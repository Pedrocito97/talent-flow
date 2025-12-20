'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Mail, Phone, User, MessageSquare, Paperclip, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface CandidateTag {
  tag: Tag;
}

interface AssignedUser {
  id: string;
  name: string | null;
  email: string;
}

export interface Candidate {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string | null;
  stageId: string;
  isRejected: boolean;
  createdAt: string;
  assignedTo: AssignedUser | null;
  tags: CandidateTag[];
  _count?: {
    notes: number;
    attachments: number;
  };
}

interface CandidateCardProps {
  candidate: Candidate;
  onClick?: () => void;
  isDragging?: boolean;
}

export function CandidateCard({ candidate, onClick, isDragging }: CandidateCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: candidate.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const initials = candidate.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const dragging = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative rounded-xl border bg-card p-3 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing',
        dragging && 'opacity-60 shadow-xl ring-2 ring-primary scale-105 rotate-1',
        candidate.isRejected && 'opacity-60'
      )}
    >
      {/* Drag indicator */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Card Content */}
      <div className="cursor-pointer pl-3" onClick={onClick}>
        {/* Header with name and avatar */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-medium leading-tight">{candidate.fullName}</h4>
            {candidate.email && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="truncate">{candidate.email}</span>
              </div>
            )}
            {candidate.phoneE164 && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{candidate.phoneE164}</span>
              </div>
            )}
          </div>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </div>

        {/* Tags */}
        {candidate.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {candidate.tags.slice(0, 3).map(({ tag }) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                  borderColor: tag.color,
                }}
              >
                {tag.name}
              </Badge>
            ))}
            {candidate.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{candidate.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Footer with meta info */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {candidate._count && candidate._count.notes > 0 && (
              <div className="flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                <span>{candidate._count.notes}</span>
              </div>
            )}
            {candidate._count && candidate._count.attachments > 0 && (
              <div className="flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" />
                <span>{candidate._count.attachments}</span>
              </div>
            )}
          </div>
          {candidate.assignedTo && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[80px]">
                {candidate.assignedTo.name || candidate.assignedTo.email.split('@')[0]}
              </span>
            </div>
          )}
        </div>

        {/* Rejected indicator */}
        {candidate.isRejected && (
          <Badge variant="destructive" className="mt-2 text-xs">
            Rejected
          </Badge>
        )}
      </div>
    </div>
  );
}
