import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple auth middleware that checks for session cookie
// The actual auth validation happens in the API routes
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public routes that don't require authentication
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/invite') ||
    pathname.startsWith('/api/auth');

  // Check for session token (NextAuth uses this cookie name)
  const sessionToken =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;

  // Allow public routes
  if (isPublicRoute) {
    // Redirect to pipelines if already logged in and trying to access login
    if (pathname.startsWith('/login') && sessionToken) {
      return NextResponse.redirect(new URL('/pipelines', request.url));
    }
    return NextResponse.next();
  }

  // Redirect to login if no session token
  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
