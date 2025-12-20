'use client';

import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Stage {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface StageHistoryEntry {
  id: string;
  movedAt: string;
  fromStage: Stage | null;
  toStage: Stage;
  movedBy: User | null;
}

interface StageHistoryProps {
  history: StageHistoryEntry[];
}

export function StageHistory({ history }: StageHistoryProps) {
  if (history.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-4">No stage history yet.</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">Stage History</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-4">
          {history.map((entry, _index) => (
            <div key={entry.id} className="relative flex gap-4 pl-6">
              {/* Timeline dot */}
              <div className="absolute left-0 top-1">
                <Circle
                  className="h-4 w-4"
                  fill={entry.toStage.color}
                  color={entry.toStage.color}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {entry.fromStage ? (
                    <>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: entry.fromStage.color,
                          color: entry.fromStage.color,
                        }}
                      >
                        {entry.fromStage.name}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: `${entry.toStage.color}20`,
                          borderColor: entry.toStage.color,
                          color: entry.toStage.color,
                        }}
                      >
                        {entry.toStage.name}
                      </Badge>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">Added to</span>
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: `${entry.toStage.color}20`,
                          borderColor: entry.toStage.color,
                          color: entry.toStage.color,
                        }}
                      >
                        {entry.toStage.name}
                      </Badge>
                    </>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {entry.movedBy ? (
                    <span>by {entry.movedBy.name || entry.movedBy.email} &bull; </span>
                  ) : null}
                  {formatDistanceToNow(new Date(entry.movedAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
