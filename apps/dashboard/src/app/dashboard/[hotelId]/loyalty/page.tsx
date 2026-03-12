'use client';
import { use, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import {
  dashboardApi,
  type LoyaltySettings,
  type LoyaltyAccount,
} from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import toast from 'react-hot-toast';

const TIER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  BRONZE:   { bg: 'rgba(180,120,60,0.15)',  text: '#CD7F32', label: 'Bronze' },
  SILVER:   { bg: 'rgba(150,150,180,0.15)', text: '#A0AEC0', label: 'Silver' },
  GOLD:     { bg: 'rgba(240,165,0,0.15)',   text: '#F0A500', label: 'Gold' },
  PLATINUM: { bg: 'rgba(100,180,220,0.15)', text: '#68D1F5', label: 'Platinum' },
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'members',  label: 'Members' },
  { key: 'settings', label: 'Settings' },
];

export default function LoyaltyPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['loyalty-stats', hotelId],
    queryFn: () => dashboardApi.getLoyaltyStats(hotelId, token!),
    enabled: !!token,
  });

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['loyalty-settings', hotelId],
    queryFn: () => dashboardApi.getLoyaltySettings(hotelId, token!),
    enabled: !!token,
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['loyalty-members', hotelId],
    queryFn: () => dashboardApi.getLoyaltyMembers(hotelId, token!, { limit: 100 }),
    enabled: !!token && tab === 'members',
  });

  return (
    <div className="p-6 max-w-[1100px] animate-fade-in">
      <PageHeader
        title="Loyalty Program"
        subtitle={settingsData?.programName ?? 'Night-based tier system'}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-600 font-display border-b-2 transition-colors -mb-px"
            style={{
              borderColor: tab === t.key ? '#F0A500' : 'transparent',
              color: tab === t.key ? '#F0A500' : '#64748B',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab stats={stats} settings={settingsData} loading={statsLoading} />
      )}
      {tab === 'members' && (
        <MembersTab
          accounts={membersData?.accounts ?? []}
          total={membersData?.total ?? 0}
          loading={membersLoading}
          hotelId={hotelId}
          token={token!}
          onAdjusted={() => { qc.invalidateQueries({ queryKey: ['loyalty-members', hotelId] }); qc.invalidateQueries({ queryKey: ['loyalty-stats', hotelId] }); }}
        />
      )}
      {tab === 'settings' && (
        <SettingsTab
          settings={settingsData}
          loading={settingsLoading}
          hotelId={hotelId}
          token={token!}
          onSaved={() => qc.invalidateQueries({ queryKey: ['loyalty-settings', hotelId] })}
        />
      )}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  stats,
  settings,
  loading,
}: {
  stats?: { totalMembers: number; totalNightsThisYear: number; totalLifetimeNights: number; byTier: Record<string, number> };
  settings?: LoyaltySettings;
  loading: boolean;
}) {
  if (loading) return <div className="card h-48 shimmer" />;
  if (!stats) return null;

  const tierOrder = ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Members" value={stats.totalMembers.toLocaleString()} icon={MembersIcon} />
        <StatCard label="Nights This Year" value={stats.totalNightsThisYear.toLocaleString()} icon={MoonIcon} />
        <StatCard label="Lifetime Nights" value={stats.totalLifetimeNights.toLocaleString()} icon={TrophyIcon} />
      </div>

      {/* Tier requirements info */}
      {settings && (
        <div className="card p-5">
          <h3 className="text-sm font-700 font-display text-white mb-3">Tier Requirements (nights/year)</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl p-4 text-center" style={{ background: TIER_COLORS.BRONZE.bg }}>
              <div className="text-lg font-800 font-display" style={{ color: TIER_COLORS.BRONZE.text }}>0+</div>
              <div className="text-xs font-600 mt-1" style={{ color: TIER_COLORS.BRONZE.text }}>Bronze</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: TIER_COLORS.SILVER.bg }}>
              <div className="text-lg font-800 font-display" style={{ color: TIER_COLORS.SILVER.text }}>{settings.silverNightsRequired}+</div>
              <div className="text-xs font-600 mt-1" style={{ color: TIER_COLORS.SILVER.text }}>Silver</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: TIER_COLORS.GOLD.bg }}>
              <div className="text-lg font-800 font-display" style={{ color: TIER_COLORS.GOLD.text }}>{settings.goldNightsRequired}+</div>
              <div className="text-xs font-600 mt-1" style={{ color: TIER_COLORS.GOLD.text }}>Gold</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: TIER_COLORS.PLATINUM.bg }}>
              <div className="text-lg font-800 font-display" style={{ color: TIER_COLORS.PLATINUM.text }}>{settings.platinumNightsRequired}+</div>
              <div className="text-xs font-600 mt-1" style={{ color: TIER_COLORS.PLATINUM.text }}>Platinum</div>
            </div>
          </div>
        </div>
      )}

      {/* Tier breakdown */}
      <div className="card p-5">
        <h3 className="text-sm font-700 font-display text-white mb-4">Members by Tier</h3>
        <div className="grid grid-cols-4 gap-3">
          {tierOrder.map(tier => {
            const count = stats.byTier[tier] ?? 0;
            const c = TIER_COLORS[tier];
            return (
              <div key={tier} className="rounded-xl p-4 text-center" style={{ background: c.bg }}>
                <div className="text-2xl font-800 font-display" style={{ color: c.text }}>{count}</div>
                <div className="text-xs font-600 mt-1" style={{ color: c.text }}>{c.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.FC }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(240,165,0,0.1)' }}>
        <Icon />
      </div>
      <div>
        <div className="text-2xl font-800 font-display text-white">{value}</div>
        <div className="text-xs text-ink-400 font-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ── Members Tab ───────────────────────────────────────────────────────────────

function MembersTab({
  accounts,
  total,
  loading,
  hotelId,
  token,
  onAdjusted,
}: {
  accounts: LoyaltyAccount[];
  total: number;
  loading: boolean;
  hotelId: string;
  token: string;
  onAdjusted: () => void;
}) {
  const [adjusting, setAdjusting] = useState<LoyaltyAccount | null>(null);
  const [adjNights, setAdjNights] = useState('');
  const [adjDesc, setAdjDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdjust = async () => {
    if (!adjusting) return;
    const n = Number(adjNights);
    if (!n || !adjDesc) return;
    setSaving(true);
    try {
      await dashboardApi.manualLoyaltyAdjust(hotelId, token, {
        guestId: adjusting.guestId,
        nights: n,
        description: adjDesc,
      });
      toast.success('Nights adjusted');
      setAdjusting(null);
      setAdjNights('');
      setAdjDesc('');
      onAdjusted();
    } catch {
      toast.error('Failed to adjust nights');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card h-64 shimmer" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-400">{total} members</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {['Guest', 'Tier', 'Nights (Year)', 'Total Nights', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-600 font-display text-ink-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-400 text-sm">
                  No members yet
                </td>
              </tr>
            )}
            {accounts.map(account => {
              const t = TIER_COLORS[account.tier];
              const name = [account.guest.firstName, account.guest.lastName].filter(Boolean).join(' ');
              return (
                <tr key={account.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-600 text-white text-sm">{name || '—'}</div>
                    <div className="text-xs text-ink-400">{account.guest.email || account.guest.phone || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-xs font-700 font-display"
                      style={{ background: t.bg, color: t.text }}>
                      {t.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-700 text-white">{account.nightsThisYear}</td>
                  <td className="px-4 py-3 text-ink-400">{account.totalNights}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setAdjusting(account); setAdjNights(''); setAdjDesc(''); }}
                      className="text-xs text-gold hover:text-gold/80 font-600 transition-colors"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Adjust modal */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setAdjusting(null); }}
        >
          <div className="card p-6 w-full max-w-sm animate-fade-in">
            <h3 className="text-base font-700 font-display text-white mb-1">Adjust Nights</h3>
            <p className="text-xs text-ink-400 mb-4">
              {adjusting.guest.firstName} {adjusting.guest.lastName} — this year: {adjusting.nightsThisYear}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ink-400 font-500 block mb-1">Nights (use negative to deduct)</label>
                <input
                  type="number"
                  value={adjNights}
                  onChange={e => setAdjNights(e.target.value)}
                  placeholder="e.g. 5 or -2"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-ink-400 font-500 block mb-1">Reason</label>
                <input
                  type="text"
                  value={adjDesc}
                  onChange={e => setAdjDesc(e.target.value)}
                  placeholder="Compensation, correction..."
                  className="input w-full"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setAdjusting(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleAdjust} disabled={saving || !adjNights || !adjDesc} className="btn-primary flex-1">
                {saving ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({
  settings,
  loading,
  hotelId,
  token,
  onSaved,
}: {
  settings?: LoyaltySettings;
  loading: boolean;
  hotelId: string;
  token: string;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<LoyaltySettings>>({});
  const [synced, setSynced] = useState(false);
  const [saving, setSaving] = useState(false);

  if (settings && !synced) {
    setForm({ ...settings });
    setSynced(true);
  }

  const set = (key: keyof LoyaltySettings, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await dashboardApi.updateLoyaltySettings(hotelId, token, form);
      toast.success('Settings saved');
      onSaved();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card h-64 shimmer" />;

  return (
    <div className="space-y-5 max-w-[680px]">
      {/* Enable toggle */}
      <div className="card p-5 flex items-center justify-between">
        <div>
          <div className="text-sm font-700 text-white">Enable Loyalty Program</div>
          <div className="text-xs text-ink-400 mt-0.5">When disabled, guests won't see their loyalty tier</div>
        </div>
        <button
          onClick={() => set('isEnabled', !form.isEnabled)}
          className="w-11 h-6 rounded-full relative transition-colors"
          style={{ background: form.isEnabled ? '#F0A500' : 'rgba(255,255,255,0.1)' }}
        >
          <span className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"
            style={{ left: form.isEnabled ? '24px' : '4px' }} />
        </button>
      </div>

      {/* Program name */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-700 font-display text-white">Branding</h3>
        <Field label="Program Name">
          <input className="input w-full max-w-[320px]" value={form.programName ?? ''} onChange={e => set('programName', e.target.value)} />
        </Field>
      </div>

      {/* Night requirements per tier */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-700 font-display text-white">Tier Requirements</h3>
        <p className="text-xs text-ink-400">Minimum nights per year to achieve and maintain each tier. Bronze is the default tier (0 nights).</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Silver (nights/year)">
            <input type="number" className="input w-full" value={form.silverNightsRequired ?? 10}
              onChange={e => set('silverNightsRequired', Number(e.target.value))} />
          </Field>
          <Field label="Gold (nights/year)">
            <input type="number" className="input w-full" value={form.goldNightsRequired ?? 25}
              onChange={e => set('goldNightsRequired', Number(e.target.value))} />
          </Field>
          <Field label="Platinum (nights/year)">
            <input type="number" className="input w-full" value={form.platinumNightsRequired ?? 50}
              onChange={e => set('platinumNightsRequired', Number(e.target.value))} />
          </Field>
        </div>

        {/* Visual tier ladder */}
        <div className="flex items-center gap-2 mt-2">
          {(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const).map((tier, i) => {
            const c = TIER_COLORS[tier];
            const req = tier === 'BRONZE' ? 0
              : tier === 'SILVER' ? (form.silverNightsRequired ?? 10)
              : tier === 'GOLD' ? (form.goldNightsRequired ?? 25)
              : (form.platinumNightsRequired ?? 50);
            return (
              <div key={tier} className="flex items-center gap-2">
                {i > 0 && <span className="text-ink-400 text-xs">→</span>}
                <div className="px-3 py-1.5 rounded-lg text-xs font-700" style={{ background: c.bg, color: c.text }}>
                  {c.label} ({req}+)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-ink-400 font-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function MembersIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#F0A500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#F0A500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#F0A500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
      <path d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
    </svg>
  );
}
