import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = [
  '/dashboard',
  '/profile',
  '/saved',
  '/messages',
  '/chat',
  '/notifications',
  '/payment',
];

function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return true;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const { exp } = JSON.parse(json);
    if (!exp) return false;
    return exp * 1000 < Date.now();
  } catch {
    return false; // allow through if decode fails — Firebase client SDK validates fully
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Check for Firebase auth session cookie
  const session = request.cookies.get('__session')?.value ||
                  request.cookies.get('syph-auth')?.value;
  if (!session || isTokenExpired(session)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/profile/:path*', '/saved/:path*', '/messages/:path*', '/chat/:path*', '/notifications/:path*', '/payment/:path*'],
};
