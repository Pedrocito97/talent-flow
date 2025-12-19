'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Settings,
  Users,
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Loader2,
  LayoutGrid,
  List,
} from 'lucide-react';
import { SortingState, Updater } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { KanbanBoard, CandidatePanel, Candidate, Stage } from '@/components/kanban';
import { CandidatesTable, TableCandidate } from '@/components/table';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Assignment {
  id: string;
  userId: string;
  user: User;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  stages: Stage[];
  assignments: Assignment[];
  _count: {
    candidates: number;
  };
}

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

type ViewMode = 'kanban' | 'table';

export default function PipelineDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pipelineId = params.id as string;

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [candidatesByStage, setCandidatesByStage] = useState<Record<string, Candidate[]>>({});
  const [tableCandidates, setTableCandidates] = useState<TableCandidate[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) || 'kanban'
  );

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  // Table sorting
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  // Candidate panel
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Add candidate modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addToStageId, setAddToStageId] = useState<string | null>(null);
  const [newCandidate, setNewCandidate] = useState({ fullName: '', email: '', phone: '' });
  const [isCreating, setIsCreating] = useState(false);

  const fetchPipeline = useCallback(async () => {
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load pipeline');
        return;
      }

      setPipeline(data.pipeline);
    } catch (err) {
      setError('Failed to load pipeline');
      console.error(err);
    }
  }, [pipelineId]);

  const fetchCandidates = useCallback(
    async (page = 1, pageSize = 50) => {
      try {
        const urlParams = new URLSearchParams();
        urlParams.set('view', viewMode);

        if (searchQuery) urlParams.set('search', searchQuery);
        if (stageFilter && stageFilter !== 'all') urlParams.set('stageId', stageFilter);

        if (viewMode === 'table') {
          urlParams.set('page', String(page));
          urlParams.set('pageSize', String(pageSize));

          if (sorting.length > 0) {
            const sort = sorting[0];
            urlParams.set('sortField', sort.id);
            urlParams.set('sortOrder', sort.desc ? 'desc' : 'asc');
          }
        }

        const response = await fetch(`/api/pipelines/${pipelineId}/candidates?${urlParams}`);
        const data = await response.json();

        if (response.ok) {
          if (viewMode === 'kanban') {
            setCandidatesByStage(data.candidatesByStage || {});
          } else {
            setTableCandidates(data.candidates || []);
            setPagination(data.pagination || null);
          }
          setTotalCandidates(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch candidates:', err);
      }
    },
    [pipelineId, searchQuery, stageFilter, viewMode, sorting]
  );

  useEffect(() => {
    if (pipelineId) {
      Promise.all([fetchPipeline(), fetchCandidates()]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [pipelineId, fetchPipeline, fetchCandidates]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading) {
        fetchCandidates();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, stageFilter, isLoading, fetchCandidates]);

  // Refetch when view mode changes
  useEffect(() => {
    if (!isLoading && pipeline) {
      fetchCandidates();
    }
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    const url = new URL(window.location.href);
    url.searchParams.set('view', mode);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  const handleCandidateMove = async (candidateId: string, newStageId: string) => {
    // Optimistic update for kanban view
    const previousState = { ...candidatesByStage };

    let movedCandidate: Candidate | null = null;
    const newCandidatesByStage = { ...candidatesByStage };

    for (const [stageId, candidates] of Object.entries(newCandidatesByStage)) {
      const index = candidates.findIndex((c) => c.id === candidateId);
      if (index !== -1) {
        movedCandidate = { ...candidates[index], stageId: newStageId };
        newCandidatesByStage[stageId] = candidates.filter((c) => c.id !== candidateId);
        break;
      }
    }

    if (movedCandidate) {
      if (!newCandidatesByStage[newStageId]) {
        newCandidatesByStage[newStageId] = [];
      }
      newCandidatesByStage[newStageId] = [movedCandidate, ...newCandidatesByStage[newStageId]];
      setCandidatesByStage(newCandidatesByStage);
    }

    try {
      const response = await fetch(`/api/candidates/${candidateId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: newStageId }),
      });

      if (!response.ok) {
        setCandidatesByStage(previousState);
        const data = await response.json();
        console.error('Failed to move candidate:', data.error);
      }
    } catch (error) {
      setCandidatesByStage(previousState);
      console.error('Failed to move candidate:', error);
    }
  };

  const handleBulkAction = async (
    action: string,
    candidateIds: string[],
    data?: Record<string, unknown>
  ) => {
    try {
      const response = await fetch('/api/candidates/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateIds,
          action,
          ...data,
        }),
      });

      if (response.ok) {
        // Refresh candidates
        fetchCandidates(pagination?.page || 1, pagination?.pageSize || 50);
      } else {
        const result = await response.json();
        alert(result.error || 'Action failed');
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  const handleCandidateClick = (candidate: Candidate | TableCandidate) => {
    setSelectedCandidateId(candidate.id);
    setIsPanelOpen(true);
  };

  const handleAddCandidate = (stageId: string) => {
    setAddToStageId(stageId);
    setNewCandidate({ fullName: '', email: '', phone: '' });
    setIsAddModalOpen(true);
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidate.fullName.trim() || !addToStageId) return;

    setIsCreating(true);
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newCandidate.fullName,
          email: newCandidate.email || undefined,
          phone: newCandidate.phone || undefined,
          stageId: addToStageId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (viewMode === 'kanban') {
          setCandidatesByStage((prev) => ({
            ...prev,
            [addToStageId]: [data.candidate, ...(prev[addToStageId] || [])],
          }));
        } else {
          fetchCandidates(1, pagination?.pageSize || 50);
        }
        setTotalCandidates((prev) => prev + 1);
        setIsAddModalOpen(false);
      }
    } catch (error) {
      console.error('Failed to create candidate:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRejectCandidate = async (candidateId: string) => {
    await handleBulkAction('reject', [candidateId]);
    setIsPanelOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-[600px]" />
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
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/pipelines">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{pipeline.name}</h1>
            {pipeline.description && (
              <p className="text-sm text-muted-foreground">{pipeline.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{totalCandidates} candidates</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/pipelines/${pipeline.id}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stage Filter */}
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {pipeline.stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => handleViewModeChange(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="kanban">
              <LayoutGrid className="mr-2 h-4 w-4" />
              Board
            </TabsTrigger>
            <TabsTrigger value="table">
              <List className="mr-2 h-4 w-4" />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button onClick={() => handleAddCandidate(pipeline.stages[0]?.id || '')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Candidate
        </Button>
      </div>

      {/* Assigned Users */}
      {pipeline.assignments.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Assigned:</span>
          <div className="flex flex-wrap gap-1">
            {pipeline.assignments.map((assignment) => (
              <Badge key={assignment.id} variant="secondary" className="text-xs">
                {assignment.user.name || assignment.user.email}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 -mx-6 px-6">
        {viewMode === 'kanban' ? (
          <KanbanBoard
            stages={pipeline.stages}
            candidatesByStage={candidatesByStage}
            onCandidateMove={handleCandidateMove}
            onCandidateClick={handleCandidateClick}
            onAddCandidate={handleAddCandidate}
          />
        ) : (
          <CandidatesTable
            candidates={tableCandidates}
            stages={pipeline.stages}
            onCandidateClick={handleCandidateClick}
            onBulkAction={handleBulkAction}
            pagination={pagination || undefined}
            onPageChange={(page) => fetchCandidates(page, pagination?.pageSize || 50)}
            onPageSizeChange={(pageSize) => fetchCandidates(1, pageSize)}
            sorting={sorting}
            onSortingChange={(updater: Updater<SortingState>) => {
              const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
              setSorting(newSorting);
              // Sorting change triggers a refetch via useEffect
            }}
          />
        )}
      </div>

      {/* Candidate Panel */}
      <CandidatePanel
        candidateId={selectedCandidateId}
        open={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          setSelectedCandidateId(null);
        }}
        onReject={handleRejectCandidate}
      />

      {/* Add Candidate Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <form onSubmit={handleCreateCandidate}>
            <DialogHeader>
              <DialogTitle>Add Candidate</DialogTitle>
              <DialogDescription>
                Add a new candidate to the pipeline.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={newCandidate.fullName}
                  onChange={(e) =>
                    setNewCandidate((prev) => ({ ...prev, fullName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={newCandidate.email}
                  onChange={(e) =>
                    setNewCandidate((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+32 123 456 789"
                  value={newCandidate.phone}
                  onChange={(e) =>
                    setNewCandidate((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !newCandidate.fullName.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Candidate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
