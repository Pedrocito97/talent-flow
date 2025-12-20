'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CandidateCard, Candidate } from './candidate-card';
import { cn } from '@/lib/utils';

export interface Stage {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
  isDefault: boolean;
}

interface KanbanColumnProps {
  stage: Stage;
  candidates: Candidate[];
  onCandidateClick: (candidate: Candidate) => void;
  onAddCandidate: (stageId: string) => void;
  isOver?: boolean;
}

export function KanbanColumn({
  stage,
  candidates,
  onCandidateClick,
  onAddCandidate,
  isOver,
}: KanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: stage.id,
    data: { type: 'column', stage },
  });

  const highlighted = isOver || isDroppableOver;

  return (
    <div
      className={cn(
        'flex h-full w-[300px] shrink-0 flex-col rounded-xl border bg-muted/30 transition-all duration-200',
        highlighted && 'ring-2 ring-primary ring-offset-2 bg-primary/5 scale-[1.02]'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="font-medium">{stage.name}</h3>
          {stage.isDefault && (
            <Badge variant="secondary" className="text-[10px]">
              Default
            </Badge>
          )}
        </div>
        <Badge variant="outline">{candidates.length}</Badge>
      </div>

      {/* Column Content */}
      <div ref={setNodeRef} className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <SortableContext
            items={candidates.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 p-2 min-h-[100px]">
              {candidates.length === 0 ? (
                <div
                  className={cn(
                    'flex h-24 items-center justify-center rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors',
                    highlighted && 'border-primary bg-primary/5 text-primary'
                  )}
                >
                  {highlighted ? 'Drop here' : 'No candidates'}
                </div>
              ) : (
                candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    onClick={() => onCandidateClick(candidate)}
                  />
                ))
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </div>

      {/* Add Button */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => onAddCandidate(stage.id)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add candidate
        </Button>
      </div>
    </div>
  );
}
