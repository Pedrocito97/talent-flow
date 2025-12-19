'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagsSectionProps {
  candidateId: string;
  tags: Tag[];
  onTagsChanged: (tags: Tag[]) => void;
}

export function TagsSection({ candidateId, tags, onTagsChanged }: TagsSectionProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Fetch all available tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags');
        if (response.ok) {
          const { tags: fetchedTags } = await response.json();
          setAllTags(fetchedTags);
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    };
    fetchTags();
  }, []);

  const handleAddTag = async (tagId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/candidates/${candidateId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      });

      if (response.ok) {
        const { tag } = await response.json();
        onTagsChanged([...tags, tag]);
      }
    } catch (error) {
      console.error('Failed to add tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const response = await fetch(
        `/api/candidates/${candidateId}/tags?tagId=${tagId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        onTagsChanged(tags.filter((t) => t.id !== tagId));
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (response.ok) {
        const { tag } = await response.json();
        setAllTags([...allTags, tag]);
        // Also add to candidate
        await handleAddTag(tag.id);
        setNewTagName('');
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const availableTags = allTags.filter(
    (tag) => !tags.some((t) => t.id === tag.id)
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">Tags</h4>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search tags..." />
              <CommandList>
                <CommandEmpty>
                  <div className="p-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      No tags found. Create a new one:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Tag name"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        className="h-8"
                      />
                      <Button
                        size="sm"
                        onClick={handleCreateTag}
                        disabled={!newTagName.trim() || isCreating}
                      >
                        {isCreating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {availableTags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      onSelect={() => {
                        handleAddTag(tag.id);
                        setIsOpen(false);
                      }}
                      disabled={isLoading}
                    >
                      <div
                        className="mr-2 h-3 w-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
              <div className="border-t p-2">
                <p className="text-xs text-muted-foreground mb-2">Create new tag:</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateTag();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 ? (
          <span className="text-sm text-muted-foreground">No tags</span>
        ) : (
          tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 pr-1"
              style={{
                backgroundColor: `${tag.color}20`,
                borderColor: tag.color,
                color: tag.color,
              }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-black/10"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
