import { LayoutDashboard } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <LayoutDashboard className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">Talent Flow</span>
      </div>

      {/* Auth content */}
      <div className="w-full max-w-md">{children}</div>

      {/* Footer */}
      <p className="mt-8 text-sm text-muted-foreground">RTT Commerce BV - Recruiting CRM</p>
    </div>
  );
}
