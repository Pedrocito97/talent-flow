'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn, Stage } from './kanban-column';
import { CandidateCard, Candidate } from './candidate-card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface KanbanBoardProps {
  stages: Stage[];
  candidatesByStage: Record<string, Candidate[]>;
  onCandidateMove: (candidateId: string, newStageId: string) => Promise<void>;
  onCandidateClick: (candidate: Candidate) => void;
  onAddCandidate: (stageId: string) => void;
}

export function KanbanBoard({
  stages,
  candidatesByStage,
  onCandidateMove,
  onCandidateClick,
  onAddCandidate,
}: KanbanBoardProps) {
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const findCandidate = useCallback(
    (id: string): Candidate | undefined => {
      for (const candidates of Object.values(candidatesByStage)) {
        const found = candidates.find((c) => c.id === id);
        if (found) return found;
      }
      return undefined;
    },
    [candidatesByStage]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const candidate = findCandidate(active.id as string);
    if (candidate) {
      setActiveCandidate(candidate);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id as string | null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveCandidate(null);
    setOverId(null);

    if (!over) return;

    const candidateId = active.id as string;
    const candidate = findCandidate(candidateId);
    if (!candidate) return;

    // Determine the target stage ID
    let targetStageId: string | null = null;

    // Check if dropped on a column
    const isColumn = stages.some((s) => s.id === over.id);
    if (isColumn) {
      targetStageId = over.id as string;
    } else {
      // Dropped on another candidate - find its stage
      const targetCandidate = findCandidate(over.id as string);
      if (targetCandidate) {
        targetStageId = targetCandidate.stageId;
      }
    }

    // Only move if dropping to a different stage
    if (targetStageId && targetStageId !== candidate.stageId) {
      await onCandidateMove(candidateId, targetStageId);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="h-[calc(100vh-220px)] w-full">
        <div className="flex gap-4 p-1">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              candidates={candidatesByStage[stage.id] || []}
              onCandidateClick={onCandidateClick}
              onAddCandidate={onAddCandidate}
              isOver={overId === stage.id}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Drag Overlay */}
      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeCandidate ? (
          <div className="w-[280px] rotate-2 scale-105">
            <CandidateCard candidate={activeCandidate} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
