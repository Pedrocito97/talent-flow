'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Loader2, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  createdBy: User | null;
}

interface NotesSectionProps {
  candidateId: string;
  notes: Note[];
  currentUserId: string;
  isAdmin: boolean;
  onNoteAdded: (note: Note) => void;
  onNoteUpdated: (note: Note) => void;
  onNoteDeleted: (noteId: string) => void;
}

export function NotesSection({
  candidateId,
  notes,
  currentUserId,
  isAdmin,
  onNoteAdded,
  onNoteUpdated,
  onNoteDeleted,
}: NotesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/candidates/${candidateId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });

      if (response.ok) {
        const { note } = await response.json();
        onNoteAdded(note);
        setNewNoteContent('');
        setIsAdding(false);
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/candidates/${candidateId}/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (response.ok) {
        const { note } = await response.json();
        onNoteUpdated(note);
        setEditingNoteId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Failed to update note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!deletingNoteId) return;

    try {
      const response = await fetch(`/api/candidates/${candidateId}/notes/${deletingNoteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onNoteDeleted(deletingNoteId);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setDeletingNoteId(null);
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const canEditOrDelete = (note: Note) => {
    return isAdmin || note.createdBy?.id === currentUserId;
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
        <h3 className="font-medium">Notes ({notes.length})</h3>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="space-y-2 rounded-lg border p-3">
          <Textarea
            placeholder="Write a note..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            rows={3}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewNoteContent('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNoteContent.trim() || isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Note
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 && !isAdding ? (
        <p className="text-center text-sm text-muted-foreground py-4">
          No notes yet. Add one to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border p-3">
              {editingNoteId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingNoteId(null);
                        setEditContent('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdateNote(note.id)}
                      disabled={!editContent.trim() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {note.createdBy
                            ? getInitials(note.createdBy.name, note.createdBy.email)
                            : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">
                            {note.createdBy?.name || note.createdBy?.email || 'Unknown'}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(note.createdAt), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {canEditOrDelete(note) && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => startEditing(note)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeletingNoteId(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{note.content}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deletingNoteId} onOpenChange={() => setDeletingNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
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
