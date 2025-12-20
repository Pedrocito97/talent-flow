'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  Clock,
  UserPlus,
  Loader2,
  MoreHorizontal,
  Trash2,
  Mail,
  CheckCircle,
  AlertCircle,
  Search as _Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, format as _format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'OWNER' | 'ADMIN' | 'RECRUITER' | 'VIEWER';
  invitedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  _count: {
    assignedCandidates: number;
    createdNotes: number;
    sentEmails: number;
  };
}

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
  VIEWER: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-500',
  ADMIN: 'bg-blue-500',
  RECRUITER: 'bg-green-500',
  VIEWER: 'bg-gray-500',
};

export default function SettingsPage() {
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState({ total: 0, active: 0, pending: 0 });
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPagination, setAuditPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [auditFilters, setAuditFilters] = useState({
    actionTypes: [] as string[],
    entityTypes: [] as string[],
  });
  const [selectedActionType, setSelectedActionType] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Dialog states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('RECRUITER');
  const [editRole, setEditRole] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setUserStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(
    async (page = 1) => {
      setIsLoadingLogs(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: '20',
        });
        if (selectedActionType) params.set('action', selectedActionType);
        if (selectedEntityType) params.set('entityType', selectedEntityType);

        const response = await fetch(`/api/audit-logs?${params}`);
        if (response.ok) {
          const data = await response.json();
          setAuditLogs(data.logs);
          setAuditPagination(data.pagination);
          setAuditFilters(data.filters);
        }
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
      } finally {
        setIsLoadingLogs(false);
      }
    },
    [selectedActionType, selectedEntityType]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchAuditLogs(1);
  }, [fetchAuditLogs]);

  // Invite user
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName || undefined,
          role: inviteRole,
        }),
      });

      if (response.ok) {
        fetchUsers();
        setIsInviteOpen(false);
        setInviteEmail('');
        setInviteName('');
        setInviteRole('RECRUITER');
        toast.success('Invitation sent successfully');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Failed to invite user:', error);
      toast.error('Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update user role
  const handleUpdateRole = async () => {
    if (!editingUser || !editRole) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole }),
      });

      if (response.ok) {
        fetchUsers();
        setEditingUser(null);
        toast.success('User role updated successfully');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error('Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchUsers();
        toast.success('User removed successfully');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    } finally {
      setIsSubmitting(false);
      setDeletingUser(null);
    }
  };

  // Resend invitation
  const handleResendInvite = async (user: User) => {
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.name || undefined,
          role: user.role,
        }),
      });

      if (response.ok) {
        toast.success('Invitation resent successfully');
        fetchUsers();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to resend invitation');
      }
    } catch (error) {
      console.error('Failed to resend invitation:', error);
      toast.error('Failed to resend invitation');
    }
  };

  const getRoleBadge = (role: string) => (
    <Badge className={`${ROLE_COLORS[role]} text-white`}>{ROLE_LABELS[role]}</Badge>
  );

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your team and view system activity</p>
      </div>

      <Tabs defaultValue="team">
        <TabsList>
          <TabsTrigger value="team">
            <Users className="mr-2 h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="audit">
            <Clock className="mr-2 h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Team Tab */}
        <TabsContent value="team" className="mt-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Users</CardDescription>
                <CardTitle className="text-3xl">{userStats.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active</CardDescription>
                <CardTitle className="text-3xl text-green-600">{userStats.active}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Invitations</CardDescription>
                <CardTitle className="text-3xl text-orange-500">{userStats.pending}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Users List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage your team and their permissions</CardDescription>
              </div>
              <Button onClick={() => setIsInviteOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite User
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.name || 'No name'}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell>
                          {user.activatedAt ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">Active</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-orange-500">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-sm">Pending</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {user._count.assignedCandidates} candidates
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingUser(user);
                                  setEditRole(user.role);
                                }}
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                              {!user.activatedAt && (
                                <DropdownMenuItem onClick={() => handleResendInvite(user)}>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Resend Invitation
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeletingUser(user)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>View all system activity and changes</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <Select value={selectedActionType} onValueChange={setSelectedActionType}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Actions</SelectItem>
                    {auditFilters.actionTypes.map((action) => (
                      <SelectItem key={action} value={action}>
                        {formatAction(action)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    {auditFilters.entityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLoadingLogs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No activity logs found</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant="outline">{formatAction(log.action)}</Badge>
                          </TableCell>
                          <TableCell>
                            {log.user ? (
                              <span>{log.user.name || log.user.email}</span>
                            ) : (
                              <span className="text-muted-foreground">System</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="text-muted-foreground">{log.entityType}</span>
                              <span className="ml-1 font-mono text-xs">
                                {log.entityId.substring(0, 8)}...
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(auditPagination.page - 1) * auditPagination.pageSize + 1} to{' '}
                      {Math.min(
                        auditPagination.page * auditPagination.pageSize,
                        auditPagination.total
                      )}{' '}
                      of {auditPagination.total} entries
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAuditLogs(auditPagination.page - 1)}
                        disabled={auditPagination.page <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAuditLogs(auditPagination.page + 1)}
                        disabled={auditPagination.page >= auditPagination.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new team member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-name">Name (Optional)</Label>
              <Input
                id="invite-name"
                placeholder="John Doe"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin - Full access</SelectItem>
                  <SelectItem value="RECRUITER">Recruiter - Manage candidates</SelectItem>
                  <SelectItem value="VIEWER">Viewer - Read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={isSubmitting || !inviteEmail.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {editingUser?.name || editingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner - All permissions</SelectItem>
                  <SelectItem value="ADMIN">Admin - Full access</SelectItem>
                  <SelectItem value="RECRUITER">Recruiter - Manage candidates</SelectItem>
                  <SelectItem value="VIEWER">Viewer - Read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deletingUser?.name || deletingUser?.email} from the
              team? They will lose access to the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
