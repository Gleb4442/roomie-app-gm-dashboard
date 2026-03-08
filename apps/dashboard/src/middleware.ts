import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_HOSTNAMES = (process.env.ADMIN_HOSTNAME || 'roomie-app-admin-panel.vercel.app')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

function isAdminDomain(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const exactOrWildcardMatch = ADMIN_HOSTNAMES.some((value) => {
    if (value.startsWith('*.')) {
      const domain = value.slice(2);
      return normalizedHost === domain || normalizedHost.endsWith(`.${domain}`);
    }
    return normalizedHost === value;
  });
  if (exactOrWildcardMatch) return true;

  // Fallback for preview/custom admin hostnames when env is not configured.
  return normalizedHost.includes('admin-panel') || normalizedHost.startsWith('admin.');
}

export function middleware(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = forwardedHost || request.headers.get('host') || '';
  const hostname = hostHeader.split(':')[0];
  const { pathname } = request.nextUrl;
  const adminDomain = isAdminDomain(hostname);

  // Root "/" — redirect based on domain
  if (pathname === '/') {
    const target = adminDomain ? '/admin/login' : '/login';
    return NextResponse.redirect(new URL(target, request.url));
  }

  // On admin domain: redirect /login → /admin/login
  if (adminDomain && pathname === '/login') {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // On dashboard domain: redirect /admin/login → /login (optional, comment out if not needed)
  // if (!adminDomain && pathname === '/admin/login') {
  //   return NextResponse.redirect(new URL('/login', request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/admin/login'],
};
