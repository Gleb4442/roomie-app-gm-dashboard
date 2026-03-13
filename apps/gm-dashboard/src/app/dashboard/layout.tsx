'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardAuthProvider, useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { dashboardApi } from '@/lib/api/dashboard';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function Sidebar({ hotelId }: { hotelId: string }) {
  const { manager, activeHotel, setActiveHotel, logout, token } = useDashboardAuth();
  const pathname = usePathname();
  const base = `/dashboard/${hotelId}`;
  const { t } = useI18n();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteAccount = async () => {
    if (!token) return;
    try {
      await dashboardApi.deleteAccount(token);
      logout();
    } catch {
      alert(t('nav.deleteAccountError'));
    }
    setShowDeleteConfirm(false);
  };

  const NAV = [
    { href: '', label: t('nav.overview'), icon: OverviewIcon },
    { href: '/guests', label: t('nav.guests'), icon: GuestsIcon },
    { href: '/orders', label: t('nav.orders'), icon: OrdersIcon },
    { href: '/services', label: t('nav.services'), icon: ServicesIcon },
    { href: '/qr', label: t('nav.qr'), icon: QRIcon },
    { href: '/stats', label: t('nav.statistics'), icon: StatsIcon },
    { href: '/sms', label: t('nav.smsLogs'), icon: SMSIcon },
    { href: '/housekeeping', label: t('nav.housekeeping'), icon: HousekeepingIcon },
    { href: '/staff', label: t('nav.staff'), icon: StaffIcon },
    { href: '/templates', label: t('nav.templates'), icon: TemplatesIcon },
    { href: '/tasks', label: t('nav.tmsTasks'), icon: TasksIcon },
    { href: '/bookings', label: t('nav.bookings'), icon: BookingsIcon },
    { href: '/catalog', label: t('nav.catalog'), icon: CatalogIcon },
    { href: '/reviews', label: t('nav.reviews'), icon: ReviewsIcon },
    { href: '/offers', label: t('nav.offers'), icon: OffersIcon },
    { href: '/notifications', label: t('nav.notifications'), icon: NotificationsIcon },
    { href: '/settings', label: t('nav.settings'), icon: SettingsIcon },
    { href: '/loyalty', label: 'Loyalty', icon: LoyaltyIcon },
  ];

  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 flex flex-col border-r" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#0F141A' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #F0A500, #FFD166)', boxShadow: '0 0 12px rgba(240,165,0,0.2)' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#0D1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="9,22 9,12 15,12 15,22" stroke="#0D1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="font-display font-700 text-sm text-white">HotelMol</span>
      </div>

      {/* Hotel picker */}
      {manager && manager.hotels.length > 1 && (
        <div className="px-3 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <select
            value={activeHotel?.id ?? hotelId}
            onChange={e => {
              const h = manager.hotels.find(x => x.id === e.target.value);
              if (h) setActiveHotel(h);
            }}
            className="w-full text-xs"
            style={{ background: '#1C2230', padding: '7px 10px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px' }}
          >
            {manager.hotels.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Active hotel label */}
      <div className="px-5 py-3">
        <p className="text-xs font-600 uppercase tracking-widest text-ink-400 font-display mb-0.5">{t('nav.property')}</p>
        <p className="text-sm font-600 text-white truncate">{activeHotel?.name ?? t('nav.loading')}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const to = base + href;
          const isActive = href === '' ? pathname === base || pathname === base + '/' : pathname.startsWith(to);
          return (
            <Link
              key={href}
              href={to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150"
              style={{
                color: isActive ? '#F0A500' : '#94A3B8',
                background: isActive ? 'rgba(240,165,0,0.08)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon active={isActive} />
              {label}
              {href === '/orders' && (
                <span className="ml-auto">
                  <LiveDot />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 font-display shrink-0"
              style={{ background: 'rgba(240,165,0,0.15)', color: '#F0A500' }}>
              {manager?.username[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-600 text-white truncate">{manager?.username}</p>
              <p className="text-xs text-ink-400">{manager?.role}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
          <button onClick={logout} className="text-xs text-ink-400 hover:text-rose transition-colors py-1 flex items-center gap-1.5">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t('nav.signOut')}
          </button>
        </div>
        <button onClick={() => setShowDeleteConfirm(true)} className="w-full text-xs text-ink-500 hover:text-rose transition-colors py-1 mt-1 text-center">
          {t('nav.deleteAccount')}
        </button>
      </div>

      {/* Delete account confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl p-6 w-80" style={{ background: '#1C2230', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="text-sm font-700 text-white mb-2">{t('nav.deleteAccount')}</h3>
            <p className="text-xs text-ink-400 mb-4">{t('nav.deleteAccountConfirm')}</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-3 py-2 rounded-lg text-xs font-600 text-white" style={{ background: 'rgba(255,255,255,0.08)' }}>
                {t('nav.cancel')}
              </button>
              <button onClick={handleDeleteAccount} className="flex-1 px-3 py-2 rounded-lg text-xs font-600 text-white" style={{ background: '#E11D48' }}>
                {t('nav.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function LiveDot() {
  return (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-teal live-dot" />
    </span>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useDashboardAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hotelId = pathname.split('/')[2] ?? '';

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar hotelId={hotelId} />
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardAuthProvider>
      <QueryClientProvider client={queryClient}>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </QueryClientProvider>
    </DashboardAuthProvider>
  );
}

// Icons
function OverviewIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function GuestsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function OrdersIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  );
}
function ServicesIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
    </svg>
  );
}
function QRIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3v3M21 21h-3M16 16v5M11 3v5M3 11h5M11 11h2v2M13 13v2h2M15 11h5M11 16h2M11 21v-2"/>
    </svg>
  );
}
function StatsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}
function SMSIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}
function StaffIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function TemplatesIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  );
}
function TasksIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  );
}
function HousekeepingIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  );
}
function ReviewsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}
function OffersIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
    </svg>
  );
}
function CatalogIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  );
}
function NotificationsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}
function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}
function BookingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function LoyaltyIcon({ active }: { active: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
