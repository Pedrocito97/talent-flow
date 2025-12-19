'use client';

import { useState, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Upload,
  Loader2,
  Trash2,
  FileText,
  Image as ImageIcon,
  File,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: User | null;
  downloadUrl: string | null;
}

interface AttachmentsSectionProps {
  candidateId: string;
  attachments: Attachment[];
  currentUserId: string;
  isAdmin: boolean;
  onAttachmentAdded: (attachment: Attachment) => void;
  onAttachmentDeleted: (attachmentId: string) => void;
}

export function AttachmentsSection({
  candidateId,
  attachments,
  currentUserId,
  isAdmin,
  onAttachmentAdded,
  onAttachmentDeleted,
}: AttachmentsSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    if (
      mimeType.includes('word') ||
      mimeType.includes('document')
    ) {
      return <FileText className="h-5 w-5 text-blue-600" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/candidates/${candidateId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const { attachment } = await response.json();
        onAttachmentAdded(attachment);
      } else {
        const data = await response.json();
        setUploadError(data.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      setUploadError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    if (!deletingAttachmentId) return;

    try {
      const response = await fetch(
        `/api/candidates/${candidateId}/attachments?attachmentId=${deletingAttachmentId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        onAttachmentDeleted(deletingAttachmentId);
      }
    } catch (error) {
      console.error('Failed to delete attachment:', error);
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const canDelete = (attachment: Attachment) => {
    return isAdmin || attachment.uploadedBy?.id === currentUserId;
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Files ({attachments.length})</h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload File
          </Button>
        </div>
      </div>

      {uploadError && (
        <p className="text-sm text-destructive">{uploadError}</p>
      )}

      {attachments.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-4">
          No files uploaded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                {getFileIcon(attachment.mimeType)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{attachment.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(attachment.sizeBytes)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px]">
                        {attachment.uploadedBy
                          ? getInitials(attachment.uploadedBy.name, attachment.uploadedBy.email)
                          : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {attachment.uploadedBy?.name || attachment.uploadedBy?.email || 'Unknown'}
                    </span>
                    <span>
                      {formatDistanceToNow(new Date(attachment.uploadedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                {attachment.downloadUrl && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                  >
                    <a href={attachment.downloadUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {canDelete(attachment) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeletingAttachmentId(attachment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deletingAttachmentId}
        onOpenChange={() => setDeletingAttachmentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
