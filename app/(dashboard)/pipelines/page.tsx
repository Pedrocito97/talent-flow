'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Settings,
  Users,
  MoreHorizontal,
  Archive,
  Trash2,
  Kanban,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Stage {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  stages: Stage[];
  _count: {
    candidates: number;
  };
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPipeline, setNewPipeline] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchPipelines();
  }, []);

  async function fetchPipelines() {
    try {
      const response = await fetch('/api/pipelines');
      const data = await response.json();
      if (response.ok) {
        setPipelines(data.pipelines);
      }
    } catch (error) {
      console.error('Error fetching pipelines:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreatePipeline(e: React.FormEvent) {
    e.preventDefault();
    if (!newPipeline.name.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPipeline.name,
          description: newPipeline.description || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPipelines((prev) => [data.pipeline, ...prev]);
        setNewPipeline({ name: '', description: '' });
        setIsCreateOpen(false);
      }
    } catch (error) {
      console.error('Error creating pipeline:', error);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleArchivePipeline(id: string) {
    try {
      const response = await fetch(`/api/pipelines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });

      if (response.ok) {
        setPipelines((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (error) {
      console.error('Error archiving pipeline:', error);
    }
  }

  async function handleDeletePipeline(id: string) {
    if (!confirm('Are you sure you want to delete this pipeline? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/pipelines/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPipelines((prev) => prev.filter((p) => p.id !== id));
      } else {
        const data = await response.json();
        alert(data.message || data.error);
      }
    } catch (error) {
      console.error('Error deleting pipeline:', error);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8 p-1">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-40" />
            <Skeleton className="mt-2 h-5 w-72" />
          </div>
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const gradientColors = [
    { bg: 'from-teal-500/10 via-cyan-500/5 to-transparent', accent: 'teal' },
    { bg: 'from-violet-500/10 via-purple-500/5 to-transparent', accent: 'violet' },
    { bg: 'from-rose-500/10 via-pink-500/5 to-transparent', accent: 'rose' },
    { bg: 'from-amber-500/10 via-orange-500/5 to-transparent', accent: 'amber' },
    { bg: 'from-emerald-500/10 via-green-500/5 to-transparent', accent: 'emerald' },
    { bg: 'from-blue-500/10 via-indigo-500/5 to-transparent', accent: 'blue' },
  ];

  return (
    <div className="space-y-8 p-1">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground mt-1">
            Manage your recruitment pipelines and track candidate progress
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/25">
              <Plus className="mr-2 h-5 w-5" />
              New Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleCreatePipeline}>
              <DialogHeader>
                <DialogTitle className="text-xl">Create Pipeline</DialogTitle>
                <DialogDescription>
                  Create a new recruitment pipeline with default stages.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Pipeline Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Sales Recruitment"
                    value={newPipeline.name}
                    onChange={(e) =>
                      setNewPipeline((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="h-11 rounded-xl"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this pipeline..."
                    value={newPipeline.description}
                    onChange={(e) =>
                      setNewPipeline((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    rows={3}
                    className="resize-none rounded-xl"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Pipeline'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline Grid */}
      {pipelines.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
              <Kanban className="h-10 w-10 text-teal-600" />
            </div>
            <h3 className="text-xl font-semibold">No pipelines yet</h3>
            <p className="mt-2 text-center text-muted-foreground max-w-sm">
              Create your first pipeline to start organizing and tracking candidates through your recruitment process.
            </p>
            <Button
              size="lg"
              className="mt-6 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/25"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Your First Pipeline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((pipeline, index) => {
            const gradient = gradientColors[index % gradientColors.length];

            return (
              <Card
                key={pipeline.id}
                className="group relative border-0 shadow-card hover-lift overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient.bg}`} />
                <CardHeader className="pb-3 relative">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        <Link
                          href={`/pipelines/${pipeline.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {pipeline.name}
                        </Link>
                      </CardTitle>
                      {pipeline.description && (
                        <CardDescription className="line-clamp-2">
                          {pipeline.description}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href={`/pipelines/${pipeline.id}/settings`}>
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleArchivePipeline(pipeline.id)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeletePipeline(pipeline.id)}
                          className="text-destructive focus:text-destructive"
                          disabled={pipeline._count.candidates > 0}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  {/* Candidate count */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <span className="text-2xl font-bold">
                        {pipeline._count.candidates}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {pipeline._count.candidates === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </div>
                  </div>

                  {/* Stages */}
                  <div className="flex flex-wrap gap-1.5">
                    {pipeline.stages.map((stage) => (
                      <Badge
                        key={stage.id}
                        variant="secondary"
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${stage.color}15`,
                          color: stage.color,
                        }}
                      >
                        <span
                          className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </Badge>
                    ))}
                  </div>

                  {/* View button */}
                  <div className="mt-5">
                    <Button
                      asChild
                      variant="outline"
                      className="w-full rounded-xl group-hover:bg-gradient-to-r group-hover:from-teal-500 group-hover:to-cyan-500 group-hover:text-white group-hover:border-transparent transition-all"
                    >
                      <Link href={`/pipelines/${pipeline.id}`}>
                        View Pipeline
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
