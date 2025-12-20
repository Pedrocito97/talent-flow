'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Play,
  AlertCircle as _AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

interface Pipeline {
  id: string;
  name: string;
}

interface ImportItem {
  id: string;
  filename: string;
  status: 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  errorMessage: string | null;
  candidate: {
    id: string;
    fullName: string;
    email: string | null;
  } | null;
}

interface ImportBatch {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalFiles: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
  completedAt: string | null;
  pipeline: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  items?: ImportItem[];
  _count?: {
    items: number;
  };
}

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [activeBatch, setActiveBatch] = useState<ImportBatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [_uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  // Fetch pipelines
  useEffect(() => {
    const fetchPipelines = async () => {
      try {
        const response = await fetch('/api/pipelines');
        if (response.ok) {
          const { pipelines } = await response.json();
          setPipelines(pipelines);
          if (pipelines.length > 0 && !selectedPipelineId) {
            setSelectedPipelineId(pipelines[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch pipelines:', error);
      }
    };
    fetchPipelines();
  }, []);

  // Fetch batches
  const fetchBatches = useCallback(async () => {
    try {
      const response = await fetch('/api/imports');
      if (response.ok) {
        const { batches } = await response.json();
        setBatches(batches);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Poll for updates when processing
  useEffect(() => {
    if (!activeBatch || activeBatch.status !== 'PROCESSING') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/imports/${activeBatch.id}`);
        if (response.ok) {
          const { batch } = await response.json();
          setActiveBatch(batch);
          if (batch.status !== 'PROCESSING') {
            fetchBatches();
          }
        }
      } catch (error) {
        console.error('Failed to poll batch:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBatch, fetchBatches]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedPipelineId) return;

    setIsUploading(true);
    setUploadedFiles([]);

    try {
      // Create batch
      const batchResponse = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineId: selectedPipelineId }),
      });

      if (!batchResponse.ok) {
        throw new Error('Failed to create import batch');
      }

      const { batch } = await batchResponse.json();
      setActiveBatch(batch);

      // Upload files
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });

      const uploadResponse = await fetch(`/api/imports/${batch.id}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        const { results } = await uploadResponse.json();
        setUploadedFiles(
          results
            .filter((r: { success: boolean }) => r.success)
            .map((r: { filename: string }) => r.filename)
        );

        // Refresh batch
        const refreshResponse = await fetch(`/api/imports/${batch.id}`);
        if (refreshResponse.ok) {
          const { batch: updated } = await refreshResponse.json();
          setActiveBatch(updated);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleProcess = async () => {
    if (!activeBatch) return;

    setIsProcessing(true);

    try {
      const response = await fetch(`/api/imports/${activeBatch.id}/process`, {
        method: 'POST',
      });

      if (response.ok) {
        // Refresh batch
        const refreshResponse = await fetch(`/api/imports/${activeBatch.id}`);
        if (refreshResponse.ok) {
          const { batch } = await refreshResponse.json();
          setActiveBatch(batch);
        }
        fetchBatches();
      }
    } catch (error) {
      console.error('Processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!deletingBatchId) return;

    try {
      const response = await fetch(`/api/imports/${deletingBatchId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (activeBatch?.id === deletingBatchId) {
          setActiveBatch(null);
        }
        fetchBatches();
      }
    } catch (error) {
      console.error('Failed to delete batch:', error);
    } finally {
      setDeletingBatchId(null);
    }
  };

  const handleNewImport = () => {
    setActiveBatch(null);
    setUploadedFiles([]);
  };

  const getStatusBadge = (status: ImportBatch['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge variant="default">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
    }
  };

  const getItemStatusIcon = (status: ImportItem['status']) => {
    switch (status) {
      case 'QUEUED':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'PROCESSING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'SUCCEEDED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Import CVs</h1>
        <p className="text-muted-foreground">Upload CV files to automatically create candidates</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
            <CardDescription>Supported formats: PDF, Word (.doc, .docx), Text</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Target Pipeline</label>
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!activeBatch ? (
              <Button
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedPipelineId || isUploading}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Select Files
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {activeBatch.totalFiles} file(s) uploaded
                  </span>
                  {getStatusBadge(activeBatch.status)}
                </div>

                {activeBatch.status === 'PROCESSING' && (
                  <div className="space-y-1">
                    <Progress value={(activeBatch.processedCount / activeBatch.totalFiles) * 100} />
                    <p className="text-xs text-muted-foreground">
                      Processing {activeBatch.processedCount} of {activeBatch.totalFiles}
                    </p>
                  </div>
                )}

                {activeBatch.status === 'COMPLETED' && (
                  <div className="rounded-lg border p-3 bg-muted/50">
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">{activeBatch.successCount} succeeded</span>
                      {activeBatch.failedCount > 0 && (
                        <span className="text-destructive">{activeBatch.failedCount} failed</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {activeBatch.status === 'PENDING' && (
                    <>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        disabled={isUploading}
                      >
                        Add More Files
                      </Button>
                      <Button
                        onClick={handleProcess}
                        disabled={activeBatch.totalFiles === 0 || isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        Process
                      </Button>
                    </>
                  )}

                  {(activeBatch.status === 'COMPLETED' || activeBatch.status === 'FAILED') && (
                    <>
                      <Button onClick={handleNewImport} variant="outline">
                        New Import
                      </Button>
                      <Button onClick={() => router.push(`/pipelines/${activeBatch.pipeline.id}`)}>
                        View Pipeline
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Batch Details */}
        {activeBatch && activeBatch.items && activeBatch.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {activeBatch.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border p-2">
                    {getItemStatusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.filename}</p>
                      {item.status === 'SUCCEEDED' && item.candidate && (
                        <p className="text-xs text-muted-foreground truncate">
                          → {item.candidate.fullName}
                          {item.candidate.email && ` (${item.candidate.email})`}
                        </p>
                      )}
                      {item.status === 'FAILED' && item.errorMessage && (
                        <p className="text-xs text-destructive truncate">{item.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Import History */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Import History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : batches.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No imports yet. Upload some files to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{batch.pipeline.name}</span>
                        {getStatusBadge(batch.status)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {batch.totalFiles} files &bull; {batch.successCount} succeeded &bull;{' '}
                        {formatDistanceToNow(new Date(batch.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        fetch(`/api/imports/${batch.id}`)
                          .then((r) => r.json())
                          .then(({ batch }) => setActiveBatch(batch));
                      }}
                    >
                      View
                    </Button>
                    {batch.status !== 'PROCESSING' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeletingBatchId(batch.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingBatchId} onOpenChange={() => setDeletingBatchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Import Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this import batch? This will not delete the candidates
              that were created from this import.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBatch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
