'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  Updater,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Mail,
  Phone,
  Trash2,
  UserMinus,
  ArrowRight,
  RotateCcw,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Stage {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

export interface TableCandidate {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string | null;
  stageId: string;
  isRejected: boolean;
  createdAt: string;
  updatedAt: string;
  stage: Stage;
  assignedTo: User | null;
  tags: { tag: Tag }[];
  _count: {
    notes: number;
    attachments: number;
  };
}

interface CandidatesTableProps {
  candidates: TableCandidate[];
  stages: Stage[];
  isLoading?: boolean;
  onCandidateClick: (candidate: TableCandidate) => void;
  onBulkAction: (action: string, candidateIds: string[], data?: Record<string, unknown>) => Promise<void>;
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  sorting?: SortingState;
  onSortingChange?: (updater: Updater<SortingState>) => void;
}

export function CandidatesTable({
  candidates,
  stages,
  isLoading,
  onCandidateClick,
  onBulkAction,
  pagination,
  onPageChange,
  onPageSizeChange,
  sorting: externalSorting,
  onSortingChange,
}: CandidatesTableProps) {
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);

  const sorting = externalSorting ?? internalSorting;
  const setSorting = onSortingChange ?? setInternalSorting;

  const columns: ColumnDef<TableCandidate>[] = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: 'fullName',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const candidate = row.original;
          const initials = candidate.fullName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{candidate.fullName}</div>
                {candidate.isRejected && (
                  <Badge variant="destructive" className="text-[10px]">
                    Rejected
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'email',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const email = row.original.email;
          if (!email) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[200px]">{email}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'phoneE164',
        header: 'Phone',
        cell: ({ row }) => {
          const phone = row.original.phoneE164;
          if (!phone) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span>{phone}</span>
            </div>
          );
        },
      },
      {
        accessorKey: 'stage',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Stage
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const stage = row.original.stage;
          return (
            <Badge
              variant="outline"
              style={{
                borderColor: stage.color,
                backgroundColor: `${stage.color}15`,
              }}
            >
              <span
                className="mr-1.5 h-2 w-2 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              {stage.name}
            </Badge>
          );
        },
        sortingFn: (rowA, rowB) => {
          return rowA.original.stage.orderIndex - rowB.original.stage.orderIndex;
        },
      },
      {
        accessorKey: 'assignedTo',
        header: 'Assigned To',
        cell: ({ row }) => {
          const user = row.original.assignedTo;
          if (!user) return <span className="text-muted-foreground">Unassigned</span>;
          return <span>{user.name || user.email}</span>;
        },
      },
      {
        accessorKey: 'tags',
        header: 'Tags',
        cell: ({ row }) => {
          const tags = row.original.tags;
          if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 2).map(({ tag }) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="text-xs"
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
              {tags.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{tags.length - 2}
                </Badge>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4"
          >
            Added
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const date = new Date(row.original.createdAt);
          return (
            <span className="text-muted-foreground">
              {date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const candidate = row.original;

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onCandidateClick(candidate)}>
                  View details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onBulkAction(
                      candidate.isRejected ? 'unreject' : 'reject',
                      [candidate.id]
                    );
                  }}
                >
                  {candidate.isRejected ? (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Restore
                    </>
                  ) : (
                    <>
                      <UserMinus className="mr-2 h-4 w-4" />
                      Reject
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this candidate?')) {
                      onBulkAction('delete', [candidate.id]);
                    }
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [onCandidateClick, onBulkAction]
  );

  const table = useReactTable({
    data: candidates,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: pagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    manualPagination: !!pagination,
    manualSorting: !!onSortingChange,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const selectedIds = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original.id);

  // Reset selection when candidates change
  useEffect(() => {
    setRowSelection({});
  }, [candidates]);

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowRight className="mr-2 h-4 w-4" />
                Move to Stage
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {stages.map((stage) => (
                <DropdownMenuItem
                  key={stage.id}
                  onClick={() => onBulkAction('move', selectedIds, { stageId: stage.id })}
                >
                  <span
                    className="mr-2 h-2 w-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkAction('reject', selectedIds)}
          >
            <UserMinus className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Delete ${selectedIds.length} candidates?`)) {
                onBulkAction('delete', selectedIds);
              }
            }}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      )}

      {/* Column Visibility */}
      <div className="flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id === 'phoneE164' ? 'Phone' : column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'cursor-pointer',
                    row.original.isRejected && 'opacity-60'
                  )}
                  onClick={() => onCandidateClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No candidates found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {pagination
              ? `Showing ${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.totalCount
                )} of ${pagination.totalCount}`
              : `${table.getFilteredRowModel().rows.length} candidates`}
          </span>
          {pagination && onPageSizeChange && (
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pagination && onPageChange ? (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(1)}
                disabled={pagination.page === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(pagination.totalPages)}
                disabled={pagination.page === pagination.totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
