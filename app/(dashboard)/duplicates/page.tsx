'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Phone,
  Loader2,
  GitMerge,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Paperclip,
  Users,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface Candidate {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string | null;
  pipelineId: string;
  pipeline: { name: string };
  stage: { name: string; color: string };
  createdAt: string;
  source: string | null;
  _count: { notes: number; attachments: number };
}

interface DuplicateGroup {
  key: string;
  type: 'email' | 'phone';
  value: string;
  candidates: Candidate[];
}

interface Pipeline {
  id: string;
  name: string;
}

export default function DuplicatesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [stats, setStats] = useState({ totalGroups: 0, totalDuplicates: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Merge state
  const [mergingGroup, setMergingGroup] = useState<DuplicateGroup | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [isMerging, setIsMerging] = useState(false);

  // Fetch pipelines
  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        const response = await fetch('/api/pipelines');
        if (response.ok) {
          const { pipelines } = await response.json();
          setPipelines(pipelines);
        }
      } catch (error) {
        console.error('Failed to fetch pipelines:', error);
      }
    };
    fetchPipelines();
  }, []);

  // Fetch duplicates
  const fetchDuplicates = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPipelineId) params.set('pipelineId', selectedPipelineId);

      const response = await fetch(`/api/candidates/duplicates?${params}`);
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups);
        setStats(data.stats);
        // Auto-expand first few groups
        const initialExpanded = new Set<string>(data.groups.slice(0, 3).map((g: DuplicateGroup) => g.key));
        setExpandedGroups(initialExpanded);
      }
    } catch (error) {
      console.error('Failed to fetch duplicates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPipelineId]);

  useEffect(() => {
    fetchDuplicates();
  }, [fetchDuplicates]);

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const openMergeDialog = (group: DuplicateGroup) => {
    setMergingGroup(group);
    // Default to the oldest candidate (first created) as target
    setSelectedTargetId(group.candidates[0].id);
  };

  const handleMerge = async () => {
    if (!mergingGroup || !selectedTargetId) return;

    const sourceIds = mergingGroup.candidates
      .filter((c) => c.id !== selectedTargetId)
      .map((c) => c.id);

    setIsMerging(true);
    try {
      const response = await fetch('/api/candidates/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: selectedTargetId,
          sourceIds,
        }),
      });

      if (response.ok) {
        // Refresh the list
        fetchDuplicates();
        setMergingGroup(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to merge candidates');
      }
    } catch (error) {
      console.error('Failed to merge:', error);
      alert('Failed to merge candidates');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Duplicate Candidates</h1>
          <p className="text-muted-foreground mt-1">
            Find and merge duplicate candidate records
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select
          value={selectedPipelineId || '__all__'}
          onValueChange={(v) => setSelectedPipelineId(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-[250px] bg-card/50 backdrop-blur-sm border-border/50 rounded-xl h-10">
            <SelectValue placeholder="All Pipelines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Pipelines</SelectItem>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => fetchDuplicates()} className="rounded-xl">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-card relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent" />
          <CardHeader className="relative pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-medium">Duplicate Groups</CardDescription>
            <CardTitle className="text-4xl font-bold">{stats.totalGroups}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-0 shadow-card relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent" />
          <CardHeader className="relative pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-medium">Total Duplicates</CardDescription>
            <CardTitle className="text-4xl font-bold">{stats.totalDuplicates}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Duplicate Groups */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="text-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full blur-xl opacity-30 animate-pulse" />
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4 relative" />
            </div>
            <p className="text-muted-foreground">Scanning for duplicates...</p>
          </div>
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-0 shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-semibold">No duplicates found</h3>
            <p className="text-muted-foreground mt-2 text-center max-w-sm">
              All candidates have unique email addresses and phone numbers.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.key} className="border-0 shadow-card overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleGroup(group.key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedGroups.has(group.key) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex items-center gap-2">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${group.type === 'email' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
                        {group.type === 'email' ? (
                          <Mail className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Phone className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <span className="font-medium">{group.value}</span>
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      <Users className="h-3 w-3 mr-1" />
                      {group.candidates.length}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      openMergeDialog(group);
                    }}
                  >
                    <GitMerge className="mr-2 h-4 w-4" />
                    Merge
                  </Button>
                </div>
              </CardHeader>

              {expandedGroups.has(group.key) && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {group.candidates.map((candidate, index) => (
                      <div
                        key={candidate.id}
                        className="flex items-center justify-between p-4 rounded-xl border bg-gradient-to-r from-muted/30 to-transparent hover:from-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{candidate.fullName}</span>
                            {index === 0 && (
                              <Badge variant="outline" className="text-xs rounded-full bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                                Oldest
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{candidate.pipeline.name}</span>
                            <Badge
                              variant="secondary"
                              className="rounded-full text-xs"
                              style={{
                                backgroundColor: `${candidate.stage.color}15`,
                                borderColor: candidate.stage.color,
                                color: candidate.stage.color,
                              }}
                            >
                              {candidate.stage.name}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {candidate._count.notes}
                            </span>
                            <span className="flex items-center gap-1">
                              <Paperclip className="h-3 w-3" />
                              {candidate._count.attachments}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="font-medium">{candidate.source || 'manual'}</div>
                          <div>
                            {formatDistanceToNow(new Date(candidate.createdAt), {
                              addSuffix: true,
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Merge Dialog */}
      <AlertDialog open={!!mergingGroup} onOpenChange={() => setMergingGroup(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Merge Candidates</AlertDialogTitle>
            <AlertDialogDescription>
              Select the primary record to keep. All notes, attachments, and emails from
              other candidates will be moved to this record.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {mergingGroup && (
            <div className="py-4">
              <Label className="text-sm font-medium">Keep as primary:</Label>
              <RadioGroup
                value={selectedTargetId}
                onValueChange={setSelectedTargetId}
                className="mt-3 space-y-2"
              >
                {mergingGroup.candidates.map((candidate, index) => (
                  <div
                    key={candidate.id}
                    className="flex items-center space-x-3 rounded-xl border p-4 hover:bg-muted/30 transition-colors"
                  >
                    <RadioGroupItem value={candidate.id} id={candidate.id} />
                    <Label htmlFor={candidate.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{candidate.fullName}</span>
                          {index === 0 && (
                            <Badge variant="outline" className="ml-2 text-xs rounded-full bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {candidate._count.notes} notes, {candidate._count.attachments} files
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {candidate.email || 'No email'} &bull; {candidate.pipeline.name}
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3 text-sm">
                  <AlertCircle className="h-5 w-5 mt-0.5 text-amber-500" />
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-400">What will happen:</p>
                    <ul className="mt-2 list-disc list-inside text-amber-600 dark:text-amber-500 space-y-1">
                      <li>
                        {mergingGroup.candidates.length - 1} candidate(s) will be marked as
                        merged
                      </li>
                      <li>All notes and attachments will be moved to the primary record</li>
                      <li>Email history will be consolidated</li>
                      <li>Tags will be combined</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMerging} className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMerge} disabled={isMerging} className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600">
              {isMerging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Merge Candidates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
