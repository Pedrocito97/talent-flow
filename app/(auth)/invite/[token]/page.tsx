'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface InviteData {
  valid: boolean;
  email: string;
  name: string | null;
  error?: string;
}

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch(`/api/users/accept-invite?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invalid invitation');
          setInviteData(null);
        } else {
          setInviteData(data);
          if (data.name) {
            setName(data.name);
          }
        }
      } catch {
        setError('Failed to validate invitation');
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      validateToken();
    }
  }, [token]);

  const validatePassword = (): string[] => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    setError(null);

    const errors = validatePassword();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/users/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          name: name || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to activate account');
        return;
      }

      setSuccess(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error && !inviteData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">{error}</p>
              <p className="text-sm mt-1">
                This invitation link may have expired or already been used.
                Please contact your administrator for a new invitation.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => router.push('/login')}>
            Go to Login
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Account Activated!</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-4 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="font-medium">Your account has been activated</p>
              <p className="text-sm mt-1">
                Redirecting you to the login page...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Set Up Your Account</CardTitle>
        <CardDescription>
          Welcome to Talent Flow! Create a password to activate your account.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {(error || validationErrors.length > 0) && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">
                  {error || 'Please fix the following errors:'}
                </span>
              </div>
              {validationErrors.length > 0 && (
                <ul className="mt-2 ml-6 list-disc">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={inviteData?.email || ''}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters with uppercase, lowercase, and a number
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isSubmitting}
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Activate Account
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
