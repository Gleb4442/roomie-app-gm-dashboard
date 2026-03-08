import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

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

  return normalizedHost.includes('admin-panel') || normalizedHost.startsWith('admin.');
}

export default async function RootPage() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = forwardedHost || requestHeaders.get('host') || '';
  const hostname = hostHeader.split(':')[0];

  if (isAdminDomain(hostname)) {
    redirect('/admin/login');
  }

  redirect('/login');
}
