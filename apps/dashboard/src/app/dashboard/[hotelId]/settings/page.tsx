'use client';
import { use, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useI18n } from '@/lib/i18n';
import type { HotelSettings } from '@/types/dashboard';

const TABS = ['general', 'branding', 'widget', 'cancellation'] as const;
type Tab = typeof TABS[number];

const TIMEZONES = [
  'UTC', 'Europe/Kyiv', 'Europe/Moscow', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Istanbul', 'Asia/Dubai', 'Asia/Bangkok',
  'Asia/Singapore', 'Asia/Tokyo', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles',
];

export default function SettingsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('general');
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hotel-settings', hotelId],
    queryFn: () => dashboardApi.getSettings(hotelId, token!),
    enabled: !!token,
  });

  const [form, setForm] = useState<Partial<HotelSettings>>({});
  const [widgetConfig, setWidgetConfig] = useState<Record<string, unknown>>({});
  const [cancellation, setCancellation] = useState({
    policy: '',
    freeCancellationHours: 24,
    penaltyPercent: 100,
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        location: data.location,
        description: data.description,
        timezone: data.timezone,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        accentColor: data.accentColor,
        imageUrl: data.imageUrl,
      });
      const settings = (data.settings ?? {}) as Record<string, unknown>;
      const wc = (settings.widgetConfig ?? {}) as Record<string, unknown>;
      setWidgetConfig(wc);
      const cp = (settings.cancellation ?? {}) as Record<string, unknown>;
      setCancellation({
        policy: (cp.policy as string) ?? '',
        freeCancellationHours: (cp.freeCancellationHours as number) ?? 24,
        penaltyPercent: (cp.penaltyPercent as number) ?? 100,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload: Partial<HotelSettings>) =>
      dashboardApi.updateSettings(hotelId, token!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-settings', hotelId] });
      setToast(t('settings.saved'));
      setTimeout(() => setToast(null), 2500);
    },
    onError: () => setToast(t('settings.failedSave')),
  });

  const handleSave = () => {
    const existingSettings = (data?.settings ?? {}) as Record<string, unknown>;
    const payload: Partial<HotelSettings> = {
      ...form,
      settings: {
        ...existingSettings,
        widgetConfig,
        cancellation,
      } as Record<string, unknown>,
    };
    mutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-[900px] animate-fade-in">
        <div className="h-8 w-48 shimmer rounded-lg mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[900px] animate-fade-in">
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="px-5 py-2 rounded-lg text-sm font-600 font-display transition-all"
            style={{
              background: mutation.isPending ? 'rgba(240,165,0,0.08)' : '#F0A500',
              color: mutation.isPending ? '#F0A500' : '#000',
            }}
          >
            {mutation.isPending ? t('settings.saving') : t('settings.save')}
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(tb => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className="flex-1 px-4 py-2 rounded-lg text-xs font-600 font-display transition-all capitalize"
            style={{
              background: tab === tb ? 'rgba(240,165,0,0.12)' : 'transparent',
              color: tab === tb ? '#F0A500' : '#64748B',
            }}
          >
            {t(`settings.${tb}`)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card p-6">
        {tab === 'general' && (
          <GeneralTab form={form} setForm={setForm} t={t} slug={data?.slug ?? ''} />
        )}
        {tab === 'branding' && (
          <BrandingTab form={form} setForm={setForm} t={t} />
        )}
        {tab === 'widget' && (
          <WidgetTab config={widgetConfig} setConfig={setWidgetConfig} t={t} />
        )}
        {tab === 'cancellation' && (
          <CancellationTab state={cancellation} setState={setCancellation} t={t} />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 px-4 py-2.5 rounded-xl text-sm font-600 animate-fade-in z-50"
          style={{
            background: toast === t('settings.saved') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: toast === t('settings.saved') ? '#10B981' : '#EF4444',
            border: `1px solid ${toast === t('settings.saved') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Field helpers ──────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-600 text-ink-300 mb-1.5 font-display uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full text-sm"
      style={{ padding: '10px 14px' }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-sm resize-none"
      style={{ padding: '10px 14px' }}
    />
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer py-2">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full transition-all relative"
        style={{ background: checked ? '#F0A500' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
      <span className="text-sm text-ink-200">{label}</span>
    </label>
  );
}

// ── Tab components ─────────────────────────────────────────────

function GeneralTab({ form, setForm, t, slug }: {
  form: Partial<HotelSettings>;
  setForm: (f: Partial<HotelSettings>) => void;
  t: (k: string) => string;
  slug: string;
}) {
  const set = (key: keyof HotelSettings, val: string) => setForm({ ...form, [key]: val });
  return (
    <>
      <Field label={t('settings.hotelName')}>
        <Input value={form.name ?? ''} onChange={v => set('name', v)} />
      </Field>
      <Field label={t('settings.slug')}>
        <Input value={slug} onChange={() => {}} disabled />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('settings.location')}>
          <Input value={form.location ?? ''} onChange={v => set('location', v)} placeholder={t('settings.locationPlaceholder')} />
        </Field>
        <Field label={t('settings.timezone')}>
          <select
            value={form.timezone ?? 'UTC'}
            onChange={e => set('timezone', e.target.value)}
            className="w-full text-sm"
            style={{ padding: '10px 14px' }}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('settings.description')}>
        <TextArea value={form.description ?? ''} onChange={v => set('description', v)} placeholder={t('settings.descriptionPlaceholder')} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('settings.contactEmail')}>
          <Input value={form.contactEmail ?? ''} onChange={v => set('contactEmail', v)} type="email" />
        </Field>
        <Field label={t('settings.contactPhone')}>
          <Input value={form.contactPhone ?? ''} onChange={v => set('contactPhone', v)} type="tel" />
        </Field>
      </div>
    </>
  );
}

function BrandingTab({ form, setForm, t }: {
  form: Partial<HotelSettings>;
  setForm: (f: Partial<HotelSettings>) => void;
  t: (k: string) => string;
}) {
  const set = (key: keyof HotelSettings, val: string) => setForm({ ...form, [key]: val });
  return (
    <>
      <Field label={t('settings.accentColor')}>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.accentColor ?? '#1152d4'}
            onChange={e => set('accentColor', e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
            style={{ background: 'transparent' }}
          />
          <Input value={form.accentColor ?? '#1152d4'} onChange={v => set('accentColor', v)} />
          {/* Color preview */}
          <div className="flex gap-2">
            {['#1152d4', '#F0A500', '#10B981', '#EF4444', '#8B5CF6', '#F97316'].map(c => (
              <button
                key={c}
                onClick={() => set('accentColor', c)}
                className="w-7 h-7 rounded-full transition-all"
                style={{
                  background: c,
                  outline: form.accentColor === c ? '2px solid white' : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>
      </Field>
      <Field label={t('settings.logo')}>
        <Input value={form.imageUrl ?? ''} onChange={v => set('imageUrl', v)} placeholder={t('settings.logoPlaceholder')} />
        {form.imageUrl && (
          <div className="mt-3 flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={form.imageUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xs text-ink-400">{t('settings.preview')}</span>
          </div>
        )}
      </Field>
    </>
  );
}

function WidgetTab({ config, setConfig, t }: {
  config: Record<string, unknown>;
  setConfig: (c: Record<string, unknown>) => void;
  t: (k: string) => string;
}) {
  const set = (key: string, val: unknown) => setConfig({ ...config, [key]: val });
  const operatorConfig = (config.operatorMode ?? {}) as Record<string, unknown>;

  return (
    <>
      <Field label={t('settings.widgetInfo')}>
        <TextArea
          value={(config.hotelInfo as string) ?? ''}
          onChange={v => set('hotelInfo', v)}
          placeholder={t('settings.widgetInfoPlaceholder')}
          rows={4}
        />
      </Field>
      <Toggle
        label={t('settings.showBranding')}
        checked={(config.showBranding as boolean) ?? true}
        onChange={v => set('showBranding', v)}
      />
      <Toggle
        label={t('settings.inAppMode')}
        checked={(config.inAppMode as boolean) ?? false}
        onChange={v => set('inAppMode', v)}
      />
      <div className="border-t pt-4 mt-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <Toggle
          label={t('settings.operatorMode')}
          checked={(operatorConfig.enabled as boolean) ?? false}
          onChange={v => set('operatorMode', { ...operatorConfig, enabled: v })}
        />
        {Boolean(operatorConfig.enabled) && (
          <div className="ml-13 mt-2">
            <Field label={t('settings.operatorName')}>
              <Input
                value={(operatorConfig.name as string) ?? ''}
                onChange={v => set('operatorMode', { ...operatorConfig, name: v })}
              />
            </Field>
          </div>
        )}
      </div>
    </>
  );
}

function CancellationTab({ state, setState, t }: {
  state: { policy: string; freeCancellationHours: number; penaltyPercent: number };
  setState: (s: typeof state) => void;
  t: (k: string) => string;
}) {
  return (
    <>
      <Field label={t('settings.cancellationPolicy')}>
        <TextArea
          value={state.policy}
          onChange={v => setState({ ...state, policy: v })}
          placeholder={t('settings.cancellationPolicyPlaceholder')}
          rows={5}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t('settings.freeCancellationHours')}>
          <Input
            value={String(state.freeCancellationHours)}
            onChange={v => setState({ ...state, freeCancellationHours: parseInt(v) || 0 })}
            type="number"
          />
        </Field>
        <Field label={t('settings.penaltyPercent')}>
          <Input
            value={String(state.penaltyPercent)}
            onChange={v => setState({ ...state, penaltyPercent: parseInt(v) || 0 })}
            type="number"
          />
        </Field>
      </div>
      {/* Visual preview */}
      <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs text-ink-400 mb-2 font-display uppercase tracking-wider">{t('settings.preview')}</p>
        <div className="space-y-2 text-sm text-ink-200">
          {state.freeCancellationHours > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal" />
              <span>Free cancellation up to <strong className="text-white">{state.freeCancellationHours}h</strong> before check-in</span>
            </div>
          )}
          {state.penaltyPercent > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose" />
              <span>Late cancellation penalty: <strong className="text-white">{state.penaltyPercent}%</strong> of first night</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
