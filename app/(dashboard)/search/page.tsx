'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Filter,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  Star,
  Trash2,
  Mail,
  Phone,
  FileText,
  Paperclip,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Candidate {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string | null;
  pipeline: { id: string; name: string };
  stage: { id: string; name: string; color: string };
  assignedTo: { id: string; name: string | null; email: string } | null;
  tags: { id: string; name: string; color: string }[];
  source: string | null;
  rejectedAt: string | null;
  createdAt: string;
  _count: { notes: number; attachments: number; emailLogs: number };
}

interface FilterOptions {
  pipelines: { id: string; name: string }[];
  stages: { id: string; name: string; color: string }[];
  tags: { id: string; name: string; color: string }[];
  sources: { source: string; count: number }[];
  recruiters: { id: string; name: string | null; email: string }[];
}

interface SavedSearch {
  id: string;
  name: string;
  filters: Filters;
  isDefault: boolean;
  createdAt: string;
}

interface Filters {
  q?: string;
  pipelineId?: string;
  stageId?: string;
  tagIds?: string[];
  source?: string;
  assignedToUserId?: string;
  status?: 'active' | 'rejected' | 'all';
  dateFrom?: string;
  dateTo?: string;
  hasEmail?: 'true' | 'false';
  hasPhone?: 'true' | 'false';
  hasNotes?: 'true' | 'false';
  hasAttachments?: 'true' | 'false';
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    pipelines: [],
    stages: [],
    tags: [],
    sources: [],
    recruiters: [],
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);

  // Filters state
  const [filters, setFilters] = useState<Filters>({
    q: searchParams.get('q') || '',
    pipelineId: searchParams.get('pipelineId') || '',
    stageId: searchParams.get('stageId') || '',
    tagIds: searchParams.getAll('tagId'),
    source: searchParams.get('source') || '',
    assignedToUserId: searchParams.get('assignedToUserId') || '',
    status: (searchParams.get('status') as Filters['status']) || 'all',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    hasEmail: searchParams.get('hasEmail') as Filters['hasEmail'],
    hasPhone: searchParams.get('hasPhone') as Filters['hasPhone'],
    hasNotes: searchParams.get('hasNotes') as Filters['hasNotes'],
    hasAttachments: searchParams.get('hasAttachments') as Filters['hasAttachments'],
  });

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newSearchName, setNewSearchName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch saved searches
  useEffect(() => {
    const fetchSavedSearches = async () => {
      try {
        const response = await fetch('/api/saved-searches');
        if (response.ok) {
          const { searches } = await response.json();
          setSavedSearches(searches);
        }
      } catch (error) {
        console.error('Failed to fetch saved searches:', error);
      }
    };
    fetchSavedSearches();
  }, []);

  // Build search params from filters
  const buildSearchParams = useCallback((f: Filters, page: number) => {
    const params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.pipelineId) params.set('pipelineId', f.pipelineId);
    if (f.stageId) params.set('stageId', f.stageId);
    if (f.tagIds && f.tagIds.length > 0) {
      f.tagIds.forEach((id) => params.append('tagId', id));
    }
    if (f.source) params.set('source', f.source);
    if (f.assignedToUserId) params.set('assignedToUserId', f.assignedToUserId);
    if (f.status && f.status !== 'all') params.set('status', f.status);
    if (f.dateFrom) params.set('dateFrom', f.dateFrom);
    if (f.dateTo) params.set('dateTo', f.dateTo);
    if (f.hasEmail) params.set('hasEmail', f.hasEmail);
    if (f.hasPhone) params.set('hasPhone', f.hasPhone);
    if (f.hasNotes) params.set('hasNotes', f.hasNotes);
    if (f.hasAttachments) params.set('hasAttachments', f.hasAttachments);
    params.set('page', page.toString());
    return params;
  }, []);

  // Search function
  const performSearch = useCallback(
    async (f: Filters, page: number = 1) => {
      setIsLoading(true);
      try {
        const params = buildSearchParams(f, page);
        const response = await fetch(`/api/search?${params}`);
        if (response.ok) {
          const data = await response.json();
          setCandidates(data.candidates);
          setPagination(data.pagination);
          setFilterOptions(data.filterOptions);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [buildSearchParams]
  );

  // Initial search and when filters change
  useEffect(() => {
    performSearch(filters);
  }, []); // Only on mount

  // Handle search submit
  const handleSearch = () => {
    performSearch(filters, 1);
    // Update URL
    const params = buildSearchParams(filters, 1);
    router.push(`/search?${params}`, { scroll: false });
  };

  // Handle filter change
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      q: '',
      pipelineId: '',
      stageId: '',
      tagIds: [],
      source: '',
      assignedToUserId: '',
      status: 'all',
      dateFrom: '',
      dateTo: '',
      hasEmail: undefined,
      hasPhone: undefined,
      hasNotes: undefined,
      hasAttachments: undefined,
    });
  };

  // Apply saved search
  const applySavedSearch = (search: SavedSearch) => {
    setFilters(search.filters);
    performSearch(search.filters);
  };

  // Save current search
  const handleSaveSearch = async () => {
    if (!newSearchName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSearchName,
          filters,
        }),
      });

      if (response.ok) {
        const { search } = await response.json();
        setSavedSearches((prev) => [search, ...prev]);
        setSaveDialogOpen(false);
        setNewSearchName('');
      }
    } catch (error) {
      console.error('Failed to save search:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete saved search
  const handleDeleteSearch = async (id: string) => {
    try {
      const response = await fetch(`/api/saved-searches/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSavedSearches((prev) => prev.filter((s) => s.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete search:', error);
    }
  };

  // Toggle tag
  const toggleTag = (tagId: string) => {
    setFilters((prev) => ({
      ...prev,
      tagIds: prev.tagIds?.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...(prev.tagIds || []), tagId],
    }));
  };

  // Count active filters
  const activeFilterCount = [
    filters.pipelineId,
    filters.stageId,
    filters.tagIds && filters.tagIds.length > 0,
    filters.source,
    filters.assignedToUserId,
    filters.status && filters.status !== 'all',
    filters.dateFrom,
    filters.dateTo,
    filters.hasEmail,
    filters.hasPhone,
    filters.hasNotes,
    filters.hasAttachments,
  ].filter(Boolean).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Search Candidates</h1>
          <p className="text-muted-foreground">
            Find candidates across all pipelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Saved Searches Dropdown */}
          {savedSearches.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Star className="mr-2 h-4 w-4" />
                  Saved Searches
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {savedSearches.map((search) => (
                  <DropdownMenuItem
                    key={search.id}
                    className="flex items-center justify-between"
                  >
                    <button
                      className="flex-1 text-left"
                      onClick={() => applySavedSearch(search)}
                    >
                      {search.name}
                      {search.isDefault && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Default
                        </Badge>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSearch(search.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Save Search Button */}
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Save className="mr-2 h-4 w-4" />
                Save Search
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Search</DialogTitle>
                <DialogDescription>
                  Save your current filters for quick access later.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="search-name">Search Name</Label>
                <Input
                  id="search-name"
                  value={newSearchName}
                  onChange={(e) => setNewSearchName(e.target.value)}
                  placeholder="e.g., Active Sales Candidates"
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSaveDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveSearch} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone, or notes..."
            value={filters.q || ''}
            onChange={(e) => updateFilter('q', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch}>
          <Search className="mr-2 h-4 w-4" />
          Search
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
          {showFilters ? (
            <ChevronUp className="ml-2 h-4 w-4" />
          ) : (
            <ChevronDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Filters</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Pipeline */}
              <div>
                <Label>Pipeline</Label>
                <Select
                  value={filters.pipelineId || '__all__'}
                  onValueChange={(v) => {
                    updateFilter('pipelineId', v === '__all__' ? '' : v);
                    updateFilter('stageId', ''); // Reset stage
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All Pipelines" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Pipelines</SelectItem>
                    {filterOptions.pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stage */}
              <div>
                <Label>Stage</Label>
                <Select
                  value={filters.stageId || '__all__'}
                  onValueChange={(v) => updateFilter('stageId', v === '__all__' ? '' : v)}
                  disabled={!filters.pipelineId}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All Stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Stages</SelectItem>
                    {filterOptions.stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div>
                <Label>Status</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(v) => updateFilter('status', v as Filters['status'])}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source */}
              <div>
                <Label>Source</Label>
                <Select
                  value={filters.source || '__all__'}
                  onValueChange={(v) => updateFilter('source', v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Sources</SelectItem>
                    {filterOptions.sources.map((s) => (
                      <SelectItem key={s.source} value={s.source}>
                        {s.source} ({s.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To */}
              <div>
                <Label>Assigned To</Label>
                <Select
                  value={filters.assignedToUserId || '__all__'}
                  onValueChange={(v) => updateFilter('assignedToUserId', v === '__all__' ? '' : v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Anyone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Anyone</SelectItem>
                    {filterOptions.recruiters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name || r.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div>
                <Label>Created After</Label>
                <Input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Date To */}
              <div>
                <Label>Created Before</Label>
                <Input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <Label>Has...</Label>
                <div className="flex flex-wrap gap-4 mt-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasEmail"
                      checked={filters.hasEmail === 'true'}
                      onCheckedChange={(checked) =>
                        updateFilter('hasEmail', checked ? 'true' : undefined)
                      }
                    />
                    <Label htmlFor="hasEmail" className="text-sm font-normal">
                      Email
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasPhone"
                      checked={filters.hasPhone === 'true'}
                      onCheckedChange={(checked) =>
                        updateFilter('hasPhone', checked ? 'true' : undefined)
                      }
                    />
                    <Label htmlFor="hasPhone" className="text-sm font-normal">
                      Phone
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasNotes"
                      checked={filters.hasNotes === 'true'}
                      onCheckedChange={(checked) =>
                        updateFilter('hasNotes', checked ? 'true' : undefined)
                      }
                    />
                    <Label htmlFor="hasNotes" className="text-sm font-normal">
                      Notes
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasAttachments"
                      checked={filters.hasAttachments === 'true'}
                      onCheckedChange={(checked) =>
                        updateFilter('hasAttachments', checked ? 'true' : undefined)
                      }
                    />
                    <Label htmlFor="hasAttachments" className="text-sm font-normal">
                      Files
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            {filterOptions.tags.length > 0 && (
              <div className="mt-4">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {filterOptions.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={filters.tagIds?.includes(tag.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      style={
                        filters.tagIds?.includes(tag.id)
                          ? { backgroundColor: tag.color }
                          : { borderColor: tag.color, color: tag.color }
                      }
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <div className="space-y-4">
        {/* Results Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              'Searching...'
            ) : (
              <>
                Found <strong>{pagination.total.toLocaleString()}</strong> candidates
              </>
            )}
          </p>
        </div>

        {/* Results List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : candidates.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No candidates found</p>
              <p className="text-muted-foreground">
                Try adjusting your search or filters
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => (
              <Card key={candidate.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/candidates/${candidate.id}`}
                          className="font-medium hover:underline"
                        >
                          {candidate.fullName}
                        </Link>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: `${candidate.stage.color}20`,
                            borderColor: candidate.stage.color,
                            color: candidate.stage.color,
                          }}
                        >
                          {candidate.stage.name}
                        </Badge>
                        {candidate.rejectedAt && (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{candidate.pipeline.name}</span>
                        {candidate.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {candidate.email}
                          </span>
                        )}
                        {candidate.phoneE164 && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {candidate.phoneE164}
                          </span>
                        )}
                      </div>
                      {candidate.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {candidate.tags.map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="text-xs"
                              style={{ borderColor: tag.color, color: tag.color }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {candidate._count.notes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {candidate._count.attachments}
                      </span>
                      <span>
                        {formatDistanceToNow(new Date(candidate.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => performSearch(filters, pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => performSearch(filters, pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
