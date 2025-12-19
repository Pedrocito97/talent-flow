'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Upload,
  Mail,
  Settings,
  Kanban,
  GitMerge,
  Search,
  Waves,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    gradient: 'from-teal-400 to-cyan-500',
  },
  {
    name: 'Pipelines',
    href: '/pipelines',
    icon: Kanban,
    gradient: 'from-violet-400 to-purple-500',
  },
  {
    name: 'Candidates',
    href: '/candidates',
    icon: Users,
    gradient: 'from-rose-400 to-pink-500',
  },
  {
    name: 'Search',
    href: '/search',
    icon: Search,
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    name: 'Duplicates',
    href: '/duplicates',
    icon: GitMerge,
    gradient: 'from-emerald-400 to-green-500',
  },
  {
    name: 'Import',
    href: '/import',
    icon: Upload,
    gradient: 'from-blue-400 to-indigo-500',
  },
  {
    name: 'Templates',
    href: '/templates',
    icon: Mail,
    gradient: 'from-fuchsia-400 to-pink-500',
  },
];

const adminNavigation = [
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    gradient: 'from-slate-400 to-zinc-500',
  },
];

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = true }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-72 flex-col bg-sidebar relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-teal-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-rose-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }} />
      </div>

      {/* Logo Section */}
      <div className="relative flex h-20 items-center gap-3.5 px-6 border-b border-sidebar-border/50">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-xl blur opacity-40 group-hover:opacity-60 transition-opacity" />
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 via-teal-500 to-cyan-500 shadow-lg">
            <Waves className="h-5 w-5 text-white" />
          </div>
        </div>
        <div>
          <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
            Talent Flow
          </span>
          <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-widest font-medium">
            Recruiting CRM
          </p>
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="mb-3 px-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
            Navigation
          </span>
        </div>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300',
                  isActive
                    ? 'text-white'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                {/* Active background */}
                {isActive && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500/90 to-cyan-500/90 rounded-xl" />
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-cyan-400/20 rounded-xl blur-lg" />
                  </>
                )}

                {/* Icon container */}
                <div
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300',
                    isActive
                      ? 'bg-white/20 shadow-inner'
                      : 'bg-sidebar-accent/80 group-hover:bg-sidebar-accent'
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-[18px] w-[18px] transition-all duration-300',
                      isActive
                        ? 'text-white'
                        : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground'
                    )}
                  />
                </div>

                {/* Label */}
                <span className="relative flex-1 truncate">{item.name}</span>

                {/* Active indicator */}
                {isActive && (
                  <ChevronRight className="relative h-4 w-4 text-white/70" />
                )}
              </Link>
            );
          })}
        </nav>

        {isAdmin && (
          <>
            <div className="mb-3 mt-8 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                System
              </span>
            </div>
            <nav className="space-y-1">
              {adminNavigation.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300',
                      isActive
                        ? 'text-white'
                        : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                    )}
                  >
                    {isActive && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/90 to-cyan-500/90 rounded-xl" />
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-400/20 to-cyan-400/20 rounded-xl blur-lg" />
                      </>
                    )}

                    <div
                      className={cn(
                        'relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300',
                        isActive
                          ? 'bg-white/20 shadow-inner'
                          : 'bg-sidebar-accent/80 group-hover:bg-sidebar-accent'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'h-[18px] w-[18px] transition-all duration-300',
                          isActive
                            ? 'text-white'
                            : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground'
                        )}
                      />
                    </div>

                    <span className="relative flex-1 truncate">{item.name}</span>

                    {isActive && (
                      <ChevronRight className="relative h-4 w-4 text-white/70" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </ScrollArea>

      {/* Footer with organization info */}
      <div className="relative border-t border-sidebar-border/50 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-sidebar-accent/60 to-sidebar-accent/40 p-3 backdrop-blur-sm">
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-lg blur opacity-40" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              RTT Commerce BV
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 font-medium">
              Professional Plan
            </p>
          </div>
          <div className="flex h-6 items-center rounded-full bg-teal-500/20 px-2">
            <span className="text-[9px] font-bold text-teal-400 uppercase tracking-wide">Pro</span>
          </div>
        </div>
      </div>
    </div>
  );
}
