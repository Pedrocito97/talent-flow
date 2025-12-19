'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Waves, Mail, Lock, ArrowRight, Loader2, CheckCircle2, Users, BarChart3, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(
    error === 'CredentialsSignin' ? 'Invalid email or password' : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await signIn('credentials', {
        email: email.toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setErrorMessage('Invalid email or password');
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setErrorMessage('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding with Mesh Gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-mesh relative overflow-hidden">
        {/* Animated orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-rose-400/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
        </div>

        {/* Dot pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          {/* Logo */}
          <div className="flex items-center gap-3.5 mb-12">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-white/20 rounded-2xl blur-lg opacity-60" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-2xl">
                <Waves className="h-7 w-7 text-white" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-bold text-white tracking-tight">Talent Flow</span>
              <p className="text-xs text-white/50 uppercase tracking-widest font-medium">Recruiting CRM</p>
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Streamline your
            <br />
            <span className="text-white/70">recruiting process</span>
          </h1>

          <p className="text-lg text-white/60 max-w-md mb-10">
            Manage candidates, track progress through pipelines, and hire the best talent with our powerful recruiting CRM.
          </p>

          <div className="flex flex-col gap-4">
            {[
              { icon: BarChart3, text: 'Visual pipeline management' },
              { icon: Users, text: 'Team collaboration tools' },
              { icon: Zap, text: 'Automated workflows' },
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-4 group">
                <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-white/80" />
                </div>
                <span className="text-white/80 font-medium">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="flex gap-8 mt-12 pt-12 border-t border-white/10">
            <div>
              <p className="text-3xl font-bold text-white">10k+</p>
              <p className="text-sm text-white/50">Candidates managed</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">500+</p>
              <p className="text-sm text-white/50">Companies</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">98%</p>
              <p className="text-sm text-white/50">Satisfaction</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-background via-background to-muted/30">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25">
              <Waves className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold">Talent Flow</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-2">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm text-center dark:bg-rose-950/50 dark:border-rose-900 dark:text-rose-400">
                {errorMessage}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm focus:bg-background transition-colors"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm focus:bg-background transition-colors"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl text-base font-medium bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/25 transition-all hover:shadow-xl hover:shadow-teal-500/30"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50">
              <CheckCircle2 className="h-4 w-4 text-teal-500" />
              <p className="text-sm text-muted-foreground">
                Demo:{' '}
                <code className="px-1.5 py-0.5 rounded bg-background text-xs font-mono">
                  admin@talentflow.com
                </code>
                {' / '}
                <code className="px-1.5 py-0.5 rounded bg-background text-xs font-mono">
                  admin123
                </code>
              </p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border/50">
            <p className="text-center text-xs text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full blur-xl opacity-30 animate-pulse" />
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4 relative" />
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
