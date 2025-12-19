'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  GripVertical,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

interface Stage {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
  isDefault: boolean;
  _count?: {
    candidates: number;
  };
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  stages: Stage[];
}

// Color palette for stages
const STAGE_COLORS = [
  '#6B7280', // Gray
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#10B981', // Green
  '#EF4444', // Red
  '#06B6D4', // Cyan
];

interface SortableStageProps {
  stage: Stage;
  onUpdate: (id: string, data: { name?: string; color?: string }) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

function SortableStage({ stage, onUpdate, onDelete, onSetDefault }: SortableStageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(stage.name);
  const [editColor, setEditColor] = useState(stage.color);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    onUpdate(stage.id, { name: editName, color: editColor });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(stage.name);
    setEditColor(stage.color);
    setIsEditing(false);
  };

  const candidateCount = stage._count?.candidates ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-background p-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {isEditing ? (
        <>
          <input
            type="color"
            value={editColor}
            onChange={(e) => setEditColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border-0"
          />
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8 flex-1"
            autoFocus
          />
          <Button size="icon" variant="ghost" onClick={handleSave}>
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </>
      ) : (
        <>
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="flex-1 font-medium">{stage.name}</span>

          {stage.isDefault && (
            <Badge variant="secondary" className="text-xs">
              Default
            </Badge>
          )}

          <Badge variant="outline" className="text-xs">
            {candidateCount} {candidateCount === 1 ? 'candidate' : 'candidates'}
          </Badge>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          {!stage.isDefault && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSetDefault(stage.id)}
              className="text-xs"
            >
              Set Default
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(stage.id)}
            disabled={stage.isDefault || candidateCount > 0}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

export default function PipelineSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const pipelineId = params.id as string;

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for pipeline details
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDescription, setPipelineDescription] = useState('');

  // New stage form
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#6B7280');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchPipeline = useCallback(async () => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load pipeline');
        return;
      }

      setPipeline(data.pipeline);
      setStages(data.pipeline.stages);
      setPipelineName(data.pipeline.name);
      setPipelineDescription(data.pipeline.description || '');
    } catch (err) {
      setError('Failed to load pipeline');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    if (pipelineId) {
      fetchPipeline();
    }
  }, [pipelineId, fetchPipeline]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stages.findIndex((s) => s.id === active.id);
      const newIndex = stages.findIndex((s) => s.id === over.id);

      const newStages = arrayMove(stages, oldIndex, newIndex);
      setStages(newStages);

      // Save new order to backend
      try {
        await fetch(`/api/pipelines/${pipelineId}/stages/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stageIds: newStages.map((s) => s.id) }),
        });
      } catch (error) {
        console.error('Error reordering stages:', error);
        // Revert on error
        setStages(stages);
      }
    }
  };

  const handleUpdatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(`/api/pipelines/${pipelineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pipelineName,
          description: pipelineDescription || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPipeline(data.pipeline);
      }
    } catch (error) {
      console.error('Error updating pipeline:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;

    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStageName,
          color: newStageColor,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStages((prev) => [...prev, data.stage]);
        setNewStageName('');
        setNewStageColor(STAGE_COLORS[stages.length % STAGE_COLORS.length]);
      }
    } catch (error) {
      console.error('Error adding stage:', error);
    }
  };

  const handleUpdateStage = async (id: string, data: { name?: string; color?: string }) => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/stages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        setStages((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...result.stage } : s))
        );
      }
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  const handleDeleteStage = async (id: string) => {
    if (!confirm('Are you sure you want to delete this stage?')) return;

    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/stages/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setStages((prev) => prev.filter((s) => s.id !== id));
      } else {
        const data = await response.json();
        alert(data.message || data.error);
      }
    } catch (error) {
      console.error('Error deleting stage:', error);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/stages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (response.ok) {
        setStages((prev) =>
          prev.map((s) => ({
            ...s,
            isDefault: s.id === id,
          }))
        );
      }
    } catch (error) {
      console.error('Error setting default stage:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive">{error || 'Pipeline not found'}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/pipelines">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pipelines
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/pipelines/${pipelineId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Pipeline Settings</h1>
          <p className="text-muted-foreground">{pipeline.name}</p>
        </div>
      </div>

      {/* Pipeline Details */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Details</CardTitle>
          <CardDescription>
            Update the pipeline name and description
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePipeline} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={pipelineDescription}
                onChange={(e) => setPipelineDescription(e.target.value)}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stages Management */}
      <Card>
        <CardHeader>
          <CardTitle>Stages</CardTitle>
          <CardDescription>
            Drag and drop to reorder stages. New candidates will be added to the
            default stage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stage List */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={stages.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {stages.map((stage) => (
                  <SortableStage
                    key={stage.id}
                    stage={stage}
                    onUpdate={handleUpdateStage}
                    onDelete={handleDeleteStage}
                    onSetDefault={handleSetDefault}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Separator />

          {/* Add New Stage */}
          <form onSubmit={handleAddStage} className="flex items-end gap-3">
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-1">
                {STAGE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      newStageColor === color
                        ? 'border-primary scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewStageColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="newStage">New Stage Name</Label>
              <Input
                id="newStage"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="Enter stage name..."
              />
            </div>
            <Button type="submit" disabled={!newStageName.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Stage
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions. Proceed with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Archive Pipeline</p>
              <p className="text-sm text-muted-foreground">
                Hide this pipeline from the list. Can be restored later.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                await fetch(`/api/pipelines/${pipelineId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ isArchived: true }),
                });
                router.push('/pipelines');
              }}
            >
              Archive
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive p-4">
            <div>
              <p className="font-medium text-destructive">Delete Pipeline</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete this pipeline. Only possible if no candidates
                exist.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={async () => {
                if (
                  !confirm(
                    'Are you sure? This action cannot be undone.'
                  )
                )
                  return;
                const response = await fetch(`/api/pipelines/${pipelineId}`, {
                  method: 'DELETE',
                });
                if (response.ok) {
                  router.push('/pipelines');
                } else {
                  const data = await response.json();
                  alert(data.message || data.error);
                }
              }}
            >
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
