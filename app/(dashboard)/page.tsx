'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Mail,
  UserCheck,
  ArrowRight,
  Loader2,
  Activity,
  Sparkles,
  Target,
  Zap,
  BarChart3,
  Clock,
  Briefcase,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Analytics {
  period: { start: string; end: string; days: number };
  kpis: {
    totalCandidates: number;
    activePipelines: number;
    candidatesThisPeriod: number;
    candidateGrowth: number;
    rejectedCandidates: number;
    hiredCandidates: number;
    pendingImports: number;
    emailsSent: number;
    conversionRate: number;
  };
  pipelineFunnels: {
    id: string;
    name: string;
    stages: { id: string; name: string; color: string; count: number }[];
  }[];
  timeSeriesData: { date: string; count: number }[];
  sources: { source: string; count: number }[];
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    user: { id: string; name: string | null; email: string };
    createdAt: string;
    metadata: Record<string, unknown>;
  }[];
  topRecruiters: {
    user: { id: string; name: string | null; email: string };
    count: number;
  }[];
}

interface Pipeline {
  id: string;
  name: string;
}

const CHART_COLORS = ['#0d9488', '#06b6d4', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string>('30');
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedPipelineId) params.set('pipelineId', selectedPipelineId);
        params.set('days', selectedDays);

        const response = await fetch(`/api/analytics?${params}`);
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [selectedPipelineId, selectedDays]);

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full blur-xl opacity-30 animate-pulse" />
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4 relative" />
          </div>
          <p className="text-muted-foreground font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-4">
            <Activity className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Failed to load analytics</p>
        </div>
      </div>
    );
  }

  const { kpis, pipelineFunnels, timeSeriesData, sources, recentActivity, topRecruiters } =
    analytics;

  const primaryFunnel = pipelineFunnels[0];

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your recruiting performance and team activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedPipelineId || '__all__'}
            onValueChange={(v) => setSelectedPipelineId(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[180px] bg-card/50 backdrop-blur-sm border-border/50 shadow-sm rounded-xl h-10">
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
          <Select value={selectedDays} onValueChange={setSelectedDays}>
            <SelectTrigger className="w-[140px] bg-card/50 backdrop-blur-sm border-border/50 shadow-sm rounded-xl h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid gap-4 grid-cols-12 auto-rows-[minmax(120px,auto)]">
        {/* Hero KPI - Total Candidates */}
        <Card className="col-span-12 md:col-span-6 lg:col-span-4 row-span-2 relative overflow-hidden border-0 shadow-card hover-lift group">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-600" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform -translate-x-10 translate-y-10" />
          </div>
          <CardContent className="relative h-full flex flex-col justify-between p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/70 font-medium text-sm uppercase tracking-wider">
                  Total Candidates
                </p>
                <h2 className="text-5xl font-bold mt-2 tracking-tight">
                  {kpis.totalCandidates.toLocaleString()}
                </h2>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Users className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-auto">
              {kpis.candidateGrowth >= 0 ? (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <TrendingUp className="h-4 w-4" />
                  <span className="font-semibold">+{kpis.candidateGrowth}%</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <TrendingDown className="h-4 w-4" />
                  <span className="font-semibold">{kpis.candidateGrowth}%</span>
                </div>
              )}
              <span className="text-white/60 text-sm">vs last period</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Pipelines */}
        <Card className="col-span-6 lg:col-span-4 relative overflow-hidden border-0 shadow-card hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/10" />
          <CardContent className="relative p-5 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Briefcase className="h-5 w-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{kpis.activePipelines}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Pipelines
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <span className="text-sm text-muted-foreground">New this period</span>
              <Badge variant="secondary" className="rounded-full font-semibold">
                {kpis.candidatesThisPeriod}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Hired Card */}
        <Card className="col-span-6 lg:col-span-4 relative overflow-hidden border-0 shadow-card hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10" />
          <CardContent className="relative p-5 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                <UserCheck className="h-5 w-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-emerald-600">{kpis.hiredCandidates}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Hired
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Rejected</span>
              <Badge
                variant="secondary"
                className="rounded-full font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
              >
                {kpis.rejectedCandidates}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Emails & Conversion */}
        <Card className="col-span-6 lg:col-span-4 relative overflow-hidden border-0 shadow-card hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10" />
          <CardContent className="relative p-5 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{kpis.emailsSent}</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Emails Sent
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Conversion</span>
              <Badge variant="secondary" className="rounded-full font-semibold">
                {kpis.conversionRate}%
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Time Chart - Large */}
        <Card className="col-span-12 lg:col-span-8 row-span-2 border-0 shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Candidates Over Time</CardTitle>
                  <CardDescription>New candidates added per day</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full">
                <Clock className="h-3 w-3 mr-1" />
                {selectedDays} days
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeriesData}>
                  <defs>
                    <linearGradient id="colorTeal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => {
                      const d = new Date(date);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    }}
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorTeal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sources Breakdown */}
        <Card className="col-span-12 md:col-span-6 lg:col-span-4 row-span-2 border-0 shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Candidate Sources</CardTitle>
                <CardDescription>Where talent comes from</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {sources.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sources}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="source"
                    >
                      {sources.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm">No source data</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {sources.slice(0, 4).map((source, index) => (
                <Badge
                  key={source.source}
                  variant="secondary"
                  className="rounded-full px-3 py-1.5 text-xs"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mr-2"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  {source.source}: {source.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Funnel */}
        {primaryFunnel && (
          <Card className="col-span-12 lg:col-span-6 row-span-2 border-0 shadow-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Pipeline Funnel</CardTitle>
                    <CardDescription>{primaryFunnel.name}</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-full" asChild>
                  <Link href={`/pipelines/${primaryFunnel.id}`}>
                    View
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={primaryFunnel.stages} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={90}
                      stroke="#94a3b8"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                      {primaryFunnel.stages.map((stage) => (
                        <Cell key={stage.id} fill={stage.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Recruiters */}
        <Card className="col-span-12 md:col-span-6 lg:col-span-6 border-0 shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Top Recruiters</CardTitle>
                  <CardDescription>Most active team members</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topRecruiters.length > 0 ? (
              <div className="space-y-3">
                {topRecruiters.slice(0, 4).map((recruiter, index) => (
                  <div
                    key={recruiter.user.id}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="text-sm font-bold text-muted-foreground/50 w-5">
                      {index + 1}
                    </div>
                    <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                      <AvatarFallback className="bg-gradient-to-br from-teal-400 to-cyan-500 text-white text-xs font-semibold">
                        {(recruiter.user.name || recruiter.user.email)
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {recruiter.user.name || recruiter.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">{recruiter.count} processed</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      {recruiter.count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Users className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm">No recruiter activity</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-12 md:col-span-6 lg:col-span-6 border-0 shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-500/10 to-emerald-500/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                  <CardDescription>Latest actions in the system</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.slice(0, 4).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mt-0.5">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">
                          {activity.user?.name || activity.user?.email || 'System'}
                        </span>{' '}
                        <span className="text-muted-foreground">
                          {formatAction(activity.action)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(activity.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] rounded-full shrink-0">
                      {activity.entityType}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[150px] text-muted-foreground">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Activity className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm">No recent activity</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
