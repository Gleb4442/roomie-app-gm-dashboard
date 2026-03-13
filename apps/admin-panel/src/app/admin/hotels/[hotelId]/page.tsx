'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { adminApi, type AdminStaffMember, type CreateAdminStaffData, type AdminRoom, type BulkRoomInput, type AdminTask, type AdminTemplate, type TemplateInput, type WidgetConfig, type WidgetRoom, type WidgetServiceItem, type HotelChain, type HotelSearchResult } from '@/lib/api/admin';
import { PageHeader } from '@/components/ui/PageHeader';
import Link from 'next/link';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'general', label: 'General' },
  { key: 'branding', label: 'Branding' },
  { key: 'widget', label: '💬 Widget' },
  { key: 'pms', label: 'PMS' },
  { key: 'sms', label: 'SMS' },
  { key: 'pos', label: 'POS' },
  { key: 'tms', label: 'Task Mgmt' },
  { key: 'qr', label: 'QR Codes' },
  { key: 'services', label: 'Services' },
  { key: 'staff', label: 'Staff' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'templates', label: 'Templates' },
  { key: 'network', label: '🏨 Network' },
];

export default function HotelConfigPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useAdminAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);

  const { data: hotel, isLoading } = useQuery({
    queryKey: ['admin-hotel', hotelId],
    queryFn: () => adminApi.getHotel(token!, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState<{ name: string; location: string; timezone: string }>({
    name: '', location: '', timezone: 'UTC',
  });

  // Sync form when hotel loads
  const [synced, setSynced] = useState(false);
  if (hotel && !synced) {
    setForm({ name: hotel.name, location: hotel.location ?? '', timezone: hotel.timezone });
    setSynced(true);
  }

  const saveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateHotel(token!, hotelId, form);
      qc.invalidateQueries({ queryKey: ['admin-hotel', hotelId] });
      toast.success('Hotel updated');
    } catch {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-6"><div className="card h-32 shimmer" /></div>;
  if (!hotel) return <div className="p-6 text-rose">Hotel not found</div>;

  return (
    <div className="p-6 max-w-[900px] animate-fade-in">
      <div className="flex items-center gap-2 text-xs text-ink-500 mb-4">
        <Link href="/admin" className="hover:text-white transition-colors">Hotels</Link>
        <span>/</span>
        <span className="text-white">{hotel.name}</span>
      </div>
      <PageHeader title={hotel.name} subtitle={hotel.location ?? hotel.slug} />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-600 font-display border-b-2 transition-colors -mb-px"
            style={{
              color: tab === t.key ? '#F43F5E' : '#64748B',
              borderBottomColor: tab === t.key ? '#F43F5E' : 'transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && (
        <form onSubmit={saveGeneral} className="card p-6 space-y-4 max-w-[500px]">
          <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
          <Field label="Location" value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="City, Country" />
          <div>
            <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Timezone</label>
            <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
              {['UTC', 'Europe/Kyiv', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'Asia/Dubai'].map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <SaveBtn saving={saving} />
        </form>
      )}

      {/* Branding */}
      {tab === 'branding' && <BrandingTab hotelId={hotelId} hotel={hotel} token={token!} />}
      {tab === 'widget' && <WidgetTab hotelId={hotelId} token={token!} />}
      {tab === 'pms' && <PMSTab hotelId={hotelId} token={token!} />}
      {tab === 'sms' && <SMSTab hotelId={hotelId} token={token!} />}
      {tab === 'pos' && <POSTab hotelId={hotelId} token={token!} />}
      {tab === 'tms' && <TMSTab hotelId={hotelId} token={token!} />}
      {tab === 'qr' && <QRTab hotelId={hotelId} token={token!} />}
      {tab === 'services' && <ServicesTab hotelId={hotelId} token={token!} />}
      {tab === 'staff' && <StaffTab hotelId={hotelId} token={token!} />}
      {tab === 'housekeeping' && <HousekeepingTab hotelId={hotelId} token={token!} />}
      {tab === 'tasks' && <TasksTab hotelId={hotelId} token={token!} />}
      {tab === 'templates' && <TemplatesTab hotelId={hotelId} token={token!} />}
      {tab === 'network' && <NetworkTab hotelId={hotelId} token={token!} currentChainId={hotel.chainId ?? null} />}
    </div>
  );
}

// ─── Branding ──────────────────────────────────────────────────────────────

function BrandingTab({ hotelId, hotel, token }: { hotelId: string; hotel: { accentColor: string | null; logoUrl: string | null }; token: string }) {
  const qc = useQueryClient();
  const [color, setColor] = useState(hotel.accentColor ?? '#F0A500');
  const [welcome, setWelcome] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const saveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateBranding(token, hotelId, { accentColor: color, welcomeMessage: welcome });
      toast.success('Branding saved');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await adminApi.uploadLogo(token, hotelId, file);
      qc.invalidateQueries({ queryKey: ['admin-hotel', hotelId] });
      toast.success('Logo uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div className="space-y-4 max-w-[500px]">
      <form onSubmit={saveBranding} className="card p-6 space-y-4">
        <div>
          <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Accent Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer p-1" style={{ background: 'transparent', border: 'none' }} />
            <input value={color} onChange={e => setColor(e.target.value)} placeholder="#F0A500" className="flex-1" />
            <div className="w-10 h-10 rounded-lg border" style={{ background: color, borderColor: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
        <Field label="Welcome Message" value={welcome} onChange={setWelcome} placeholder="Welcome to our hotel!" />
        <SaveBtn saving={saving} />
      </form>

      <div className="card p-6">
        <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-3 font-display">Hotel Logo</label>
        {hotel.logoUrl && (
          <div className="mb-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-xs text-ink-400 break-all">{hotel.logoUrl}</p>
          </div>
        )}
        <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg cursor-pointer transition-colors text-sm"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)', color: uploading ? '#64748B' : '#94A3B8' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          {uploading ? 'Uploading...' : 'Upload Logo (PNG/SVG)'}
          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
        </label>
      </div>
    </div>
  );
}

// ─── Widget ─────────────────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'UAH', 'GBP', 'AED'];

const EMPTY_ROOM: Omit<WidgetRoom, 'id'> = {
  name: '', description: '', price: 0, currency: 'USD',
  area: null, maxGuests: 2, photos: [''],
};

const EMPTY_SERVICE: Omit<WidgetServiceItem, 'id'> = {
  name: '', description: '', price: 0, currency: 'USD',
  category: '', photo: '',
};

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div className="text-sm font-500 text-white">{label}</div>
        {hint && <div className="text-xs text-ink-400 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? '#F43F5E' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6">
      <div className="text-xs font-700 uppercase tracking-widest font-display" style={{ color: '#F43F5E' }}>{children}</div>
      <div className="flex-1 h-px" style={{ background: 'rgba(244,63,94,0.2)' }} />
    </div>
  );
}

function WidgetTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useQuery({
    queryKey: ['admin-widget', hotelId],
    queryFn: () => adminApi.getWidgetConfig(token, hotelId),
    enabled: !!token,
  });

  // General settings
  const [hotelInfo, setHotelInfo] = useState('');
  const [showBranding, setShowBranding] = useState(true);
  const [showTelegram, setShowTelegram] = useState(true);
  const [inAppMode, setInAppMode] = useState(false);
  const [operatorEnabled, setOperatorEnabled] = useState(false);
  const [operatorName, setOperatorName] = useState('');
  const [menuEnabled, setMenuEnabled] = useState(false);
  const [menuType, setMenuType] = useState<'link' | 'pdf'>('link');
  const [menuUrl, setMenuUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Room/service modals
  const [roomModal, setRoomModal] = useState<{ open: boolean; data: Omit<WidgetRoom, 'id'>; editId: string | null }>({
    open: false, data: { ...EMPTY_ROOM }, editId: null,
  });
  const [serviceModal, setServiceModal] = useState<{ open: boolean; data: Omit<WidgetServiceItem, 'id'>; editId: string | null }>({
    open: false, data: { ...EMPTY_SERVICE }, editId: null,
  });
  const [savingRoom, setSavingRoom] = useState(false);
  const [savingService, setSavingService] = useState(false);

  // Sync state when config loads
  const [synced, setSynced] = useState(false);
  if (cfg && !synced) {
    setHotelInfo(cfg.hotelInfo);
    setShowBranding(cfg.showBranding);
    setShowTelegram(cfg.showTelegram);
    setInAppMode(cfg.inAppMode);
    setOperatorEnabled(cfg.operatorMode.enabled);
    setOperatorName(cfg.operatorMode.name);
    setMenuEnabled(cfg.menu.enabled);
    setMenuType(cfg.menu.type);
    setMenuUrl(cfg.menu.url);
    setSynced(true);
  }

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await adminApi.updateWidgetConfig(token, hotelId, {
        hotelInfo,
        showBranding,
        showTelegram,
        inAppMode,
        operatorMode: { enabled: operatorEnabled, name: operatorName },
        menu: { enabled: menuEnabled, type: menuType, url: menuUrl },
      });
      qc.invalidateQueries({ queryKey: ['admin-widget', hotelId] });
      toast.success('Widget settings saved');
    } catch { toast.error('Failed to save'); }
    finally { setSavingSettings(false); }
  };

  const openAddRoom = () => setRoomModal({ open: true, data: { ...EMPTY_ROOM, photos: [''] }, editId: null });
  const openEditRoom = (r: WidgetRoom) => setRoomModal({ open: true, data: { ...r }, editId: r.id });
  const openAddService = () => setServiceModal({ open: true, data: { ...EMPTY_SERVICE }, editId: null });
  const openEditService = (s: WidgetServiceItem) => setServiceModal({ open: true, data: { ...s }, editId: s.id });

  const saveRoom = async () => {
    if (!roomModal.data.name.trim()) return;
    setSavingRoom(true);
    try {
      const photos = roomModal.data.photos.filter(Boolean);
      const data = { ...roomModal.data, photos };
      if (roomModal.editId) {
        await adminApi.updateWidgetRoom(token, hotelId, roomModal.editId, data);
      } else {
        await adminApi.addWidgetRoom(token, hotelId, data);
      }
      qc.invalidateQueries({ queryKey: ['admin-widget', hotelId] });
      setRoomModal(m => ({ ...m, open: false }));
      toast.success(roomModal.editId ? 'Room updated' : 'Room added');
    } catch { toast.error('Failed'); }
    finally { setSavingRoom(false); }
  };

  const deleteRoom = async (id: string) => {
    if (!confirm('Delete this room type?')) return;
    await adminApi.deleteWidgetRoom(token, hotelId, id);
    qc.invalidateQueries({ queryKey: ['admin-widget', hotelId] });
    toast.success('Deleted');
  };

  const saveService = async () => {
    if (!serviceModal.data.name.trim()) return;
    setSavingService(true);
    try {
      if (serviceModal.editId) {
        await adminApi.updateWidgetService(token, hotelId, serviceModal.editId, serviceModal.data);
      } else {
        await adminApi.addWidgetService(token, hotelId, serviceModal.data);
      }
      qc.invalidateQueries({ queryKey: ['admin-widget', hotelId] });
      setServiceModal(m => ({ ...m, open: false }));
      toast.success(serviceModal.editId ? 'Service updated' : 'Service added');
    } catch { toast.error('Failed'); }
    finally { setSavingService(false); }
  };

  const deleteService = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    await adminApi.deleteWidgetService(token, hotelId, id);
    qc.invalidateQueries({ queryKey: ['admin-widget', hotelId] });
    toast.success('Deleted');
  };

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <div className="max-w-[680px] space-y-1">

      {/* ── Settings form ─────────────────────────────────────────────── */}
      <form onSubmit={saveSettings}>

        <SectionTitle>AI Context</SectionTitle>
        <div className="card p-4">
          <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">
            Hotel Info for AI
          </label>
          <textarea
            value={hotelInfo}
            onChange={e => setHotelInfo(e.target.value)}
            rows={5}
            placeholder="Describe the hotel: amenities, rules, check-in times, nearby attractions..."
            className="w-full resize-none text-sm"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', color: '#E2E8F0', lineHeight: 1.6 }}
          />
          <p className="text-xs text-ink-400 mt-2">Used by AI to answer guest questions about the hotel.</p>
        </div>

        <SectionTitle>Display Settings</SectionTitle>
        <div className="card p-4">
          <Toggle label="Powered by Roomie" hint="Show branding in widget footer" checked={showBranding} onChange={setShowBranding} />
          <Toggle label="Telegram Button" hint="Show Telegram link in widget header" checked={showTelegram} onChange={setShowTelegram} />
          <Toggle label="In-App Mode" hint="Hide app download buttons (when used inside native app)" checked={inAppMode} onChange={setInAppMode} />
        </div>

        <SectionTitle>Operator Mode</SectionTitle>
        <div className="card p-4">
          <Toggle label="Enable Operator Mode" hint="Simulate live operator responses" checked={operatorEnabled} onChange={setOperatorEnabled} />
          {operatorEnabled && (
            <div className="mt-3">
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Operator Name</label>
              <input value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="e.g. Denis" className="w-full" />
            </div>
          )}
        </div>

        <SectionTitle>Restaurant Menu</SectionTitle>
        <div className="card p-4">
          <Toggle label="Show Menu Button" hint="Display a menu access button in widget" checked={menuEnabled} onChange={setMenuEnabled} />
          {menuEnabled && (
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                {(['link', 'pdf'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setMenuType(type)}
                    className="px-4 py-1.5 rounded-lg text-sm font-600 transition-colors"
                    style={{ background: menuType === type ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.05)', color: menuType === type ? '#F43F5E' : '#94A3B8', border: `1px solid ${menuType === type ? 'rgba(244,63,94,0.3)' : 'transparent'}` }}>
                    {type === 'link' ? '🔗 URL Link' : '📄 PDF URL'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">
                  {menuType === 'link' ? 'Menu URL' : 'PDF URL'}
                </label>
                <input value={menuUrl} onChange={e => setMenuUrl(e.target.value)} placeholder="https://..." className="w-full" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button type="submit" disabled={savingSettings}
            className="px-6 py-2.5 rounded-lg text-sm font-700 transition-all"
            style={{ background: '#F43F5E', color: '#fff', opacity: savingSettings ? 0.6 : 1 }}>
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* ── Room Types ────────────────────────────────────────────────── */}
      <SectionTitle>Room Types</SectionTitle>
      <div className="space-y-2">
        {cfg?.rooms.map(room => (
          <div key={room.id} className="card p-4 flex items-center gap-4">
            {room.photos[0] && (
              <img src={room.photos[0]} alt={room.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }} onError={e => (e.currentTarget.style.display = 'none')} />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-600 text-white">{room.name}</div>
              <div className="text-xs text-ink-400 mt-0.5">
                {room.price} {room.currency}/night
                {room.area ? ` · ${room.area} m²` : ''}
                {` · max ${room.maxGuests} guests`}
              </div>
              {room.description && <div className="text-xs text-ink-500 mt-1 truncate">{room.description}</div>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => openEditRoom(room)} className="px-3 py-1.5 rounded-lg text-xs font-600 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>Edit</button>
              <button onClick={() => deleteRoom(room.id)} className="px-3 py-1.5 rounded-lg text-xs font-600 transition-colors"
                style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}>Delete</button>
            </div>
          </div>
        ))}
        <button onClick={openAddRoom}
          className="w-full py-3 rounded-xl text-sm font-600 transition-colors flex items-center justify-center gap-2"
          style={{ border: '1px dashed rgba(255,255,255,0.12)', color: '#64748B' }}>
          <span style={{ fontSize: 18 }}>+</span> Add Room Type
        </button>
      </div>

      {/* ── Services ──────────────────────────────────────────────────── */}
      <SectionTitle>Additional Services</SectionTitle>
      <div className="space-y-2">
        {cfg?.services.map(svc => (
          <div key={svc.id} className="card p-4 flex items-center gap-4">
            {svc.photo && (
              <img src={svc.photo} alt={svc.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }} onError={e => (e.currentTarget.style.display = 'none')} />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-600 text-white">{svc.name}</div>
              <div className="text-xs text-ink-400 mt-0.5">
                {svc.price > 0 ? `${svc.price} ${svc.currency}` : 'Free'}
                {svc.category ? ` · ${svc.category}` : ''}
              </div>
              {svc.description && <div className="text-xs text-ink-500 mt-1 truncate">{svc.description}</div>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => openEditService(svc)} className="px-3 py-1.5 rounded-lg text-xs font-600 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>Edit</button>
              <button onClick={() => deleteService(svc.id)} className="px-3 py-1.5 rounded-lg text-xs font-600 transition-colors"
                style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}>Delete</button>
            </div>
          </div>
        ))}
        <button onClick={openAddService}
          className="w-full py-3 rounded-xl text-sm font-600 transition-colors flex items-center justify-center gap-2"
          style={{ border: '1px dashed rgba(255,255,255,0.12)', color: '#64748B' }}>
          <span style={{ fontSize: 18 }}>+</span> Add Service
        </button>
      </div>

      {/* ── Room Modal ───────────────────────────────────────────────── */}
      {roomModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-4"
            style={{ background: '#1A1F2E', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="text-base font-700 text-white">{roomModal.editId ? 'Edit Room Type' : 'Add Room Type'}</h3>

            <Field label="Name *" value={roomModal.data.name} onChange={v => setRoomModal(m => ({ ...m, data: { ...m.data, name: v } }))} placeholder="e.g. Deluxe Suite" />
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Description</label>
              <textarea value={roomModal.data.description} onChange={e => setRoomModal(m => ({ ...m, data: { ...m.data, description: e.target.value } }))}
                rows={3} placeholder="Room features, view, amenities..." className="w-full resize-none text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', color: '#E2E8F0' }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Price/night</label>
                <input type="number" min={0} value={roomModal.data.price} onChange={e => setRoomModal(m => ({ ...m, data: { ...m.data, price: Number(e.target.value) } }))} className="w-full" />
              </div>
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Currency</label>
                <select value={roomModal.data.currency} onChange={e => setRoomModal(m => ({ ...m, data: { ...m.data, currency: e.target.value } }))}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Max Guests</label>
                <input type="number" min={1} value={roomModal.data.maxGuests} onChange={e => setRoomModal(m => ({ ...m, data: { ...m.data, maxGuests: Number(e.target.value) } }))} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Area (m²)</label>
              <input type="number" min={0} value={roomModal.data.area ?? ''} onChange={e => setRoomModal(m => ({ ...m, data: { ...m.data, area: e.target.value ? Number(e.target.value) : null } }))} placeholder="Optional" className="w-full" />
            </div>

            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Photo URLs</label>
              {roomModal.data.photos.map((photo, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={photo} onChange={e => {
                    const photos = [...roomModal.data.photos];
                    photos[i] = e.target.value;
                    setRoomModal(m => ({ ...m, data: { ...m.data, photos } }));
                  }} placeholder="https://..." className="flex-1" />
                  {roomModal.data.photos.length > 1 && (
                    <button type="button" onClick={() => {
                      const photos = roomModal.data.photos.filter((_, idx) => idx !== i);
                      setRoomModal(m => ({ ...m, data: { ...m.data, photos } }));
                    }} className="px-2 text-sm" style={{ color: '#F43F5E' }}>✕</button>
                  )}
                </div>
              ))}
              {roomModal.data.photos.length < 5 && (
                <button type="button" onClick={() => setRoomModal(m => ({ ...m, data: { ...m.data, photos: [...m.data.photos, ''] } }))}
                  className="text-xs text-ink-400 hover:text-white transition-colors">+ Add photo URL</button>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveRoom} disabled={savingRoom}
                className="px-6 py-2 rounded-lg text-sm font-700 transition-all"
                style={{ background: '#F43F5E', color: '#fff', opacity: savingRoom ? 0.6 : 1 }}>
                {savingRoom ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setRoomModal(m => ({ ...m, open: false }))}
                className="px-6 py-2 rounded-lg text-sm font-600 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Service Modal ─────────────────────────────────────────────── */}
      {serviceModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-4"
            style={{ background: '#1A1F2E', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="text-base font-700 text-white">{serviceModal.editId ? 'Edit Service' : 'Add Service'}</h3>

            <Field label="Name *" value={serviceModal.data.name} onChange={v => setServiceModal(m => ({ ...m, data: { ...m.data, name: v } }))} placeholder="e.g. Airport Transfer" />
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Description</label>
              <textarea value={serviceModal.data.description} onChange={e => setServiceModal(m => ({ ...m, data: { ...m.data, description: e.target.value } }))}
                rows={3} placeholder="Service details..." className="w-full resize-none text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 12px', color: '#E2E8F0' }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Price</label>
                <input type="number" min={0} value={serviceModal.data.price} onChange={e => setServiceModal(m => ({ ...m, data: { ...m.data, price: Number(e.target.value) } }))} className="w-full" />
              </div>
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Currency</label>
                <select value={serviceModal.data.currency} onChange={e => setServiceModal(m => ({ ...m, data: { ...m.data, currency: e.target.value } }))}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Category</label>
                <input value={serviceModal.data.category} onChange={e => setServiceModal(m => ({ ...m, data: { ...m.data, category: e.target.value } }))} placeholder="e.g. Transfer" className="w-full" />
              </div>
            </div>
            <Field label="Photo URL" value={serviceModal.data.photo} onChange={v => setServiceModal(m => ({ ...m, data: { ...m.data, photo: v } }))} placeholder="https://..." />

            <div className="flex gap-3 pt-2">
              <button onClick={saveService} disabled={savingService}
                className="px-6 py-2 rounded-lg text-sm font-700 transition-all"
                style={{ background: '#F43F5E', color: '#fff', opacity: savingService ? 0.6 : 1 }}>
                {savingService ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setServiceModal(m => ({ ...m, open: false }))}
                className="px-6 py-2 rounded-lg text-sm font-600 transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── PMS ───────────────────────────────────────────────────────────────────

function PMSTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: pms, isLoading } = useQuery({
    queryKey: ['admin-pms', hotelId],
    queryFn: () => adminApi.getPmsConfig(token, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState({ pmsType: 'SERVIO', pmsHotelId: '', syncMode: 'POLLING', apiUrl: '', apiKey: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced2, setSynced2] = useState(false);

  if (pms && !synced2) {
    setForm({
      pmsType: pms.pmsType,
      pmsHotelId: pms.pmsHotelId,
      syncMode: pms.syncMode,
      apiUrl: (pms.credentials?.apiUrl as string) ?? '',
      apiKey: (pms.credentials?.apiKey as string) ?? '',
    });
    setSynced2(true);
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { apiUrl, apiKey, pmsType, pmsHotelId, syncMode } = form;
      await adminApi.upsertPmsConfig(token, hotelId, {
        pmsType: pmsType as 'SERVIO' | 'EASYMS' | 'MEWS' | 'OPERA' | 'CLOUDBEDS',
        pmsHotelId,
        syncMode: syncMode as 'WEBHOOK' | 'POLLING' | 'MANUAL' | 'DISABLED',
        credentials: { apiUrl, apiKey },
      });
      qc.invalidateQueries({ queryKey: ['admin-pms', hotelId] });
      toast.success('PMS config saved');
    } catch { toast.error('Failed to save PMS config'); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await adminApi.testPmsConnection(token, hotelId);
      toast.success(r.message || 'Connection successful');
    } catch { toast.error('Connection failed'); }
    finally { setTesting(false); }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await adminApi.syncPms(token, hotelId);
      toast.success('Sync triggered');
    } catch { toast.error('Sync failed'); }
    finally { setSyncing(false); }
  };

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <form onSubmit={save} className="card p-6 space-y-4 max-w-[520px]">
      <h3 className="font-display font-700 text-sm text-white">PMS Integration</h3>
      <div>
        <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">PMS Type</label>
        <select value={form.pmsType} onChange={e => setForm(f => ({ ...f, pmsType: e.target.value }))}>
          {['SERVIO', 'EASYMS', 'MEWS', 'OPERA', 'CLOUDBEDS'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <Field label="PMS Hotel ID" value={form.pmsHotelId} onChange={v => setForm(f => ({ ...f, pmsHotelId: v }))} placeholder="e.g. 42" required />
      <div>
        <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Sync Mode</label>
        <select value={form.syncMode} onChange={e => setForm(f => ({ ...f, syncMode: e.target.value }))}>
          {['WEBHOOK', 'POLLING', 'MANUAL', 'DISABLED'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <Field label="API URL" value={form.apiUrl} onChange={v => setForm(f => ({ ...f, apiUrl: v }))} placeholder="https://pms.hotel.com/api" />
      <Field label="API Key" value={form.apiKey} onChange={v => setForm(f => ({ ...f, apiKey: v }))} placeholder="Bearer token or key" />
      <div className="flex gap-2 pt-2">
        <SaveBtn saving={saving} />
        {pms && (
          <>
            <button type="button" onClick={test} disabled={testing}
              className="px-4 h-10 rounded-lg text-sm font-600 font-display shrink-0 transition-all"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
              {testing ? 'Testing...' : 'Test'}
            </button>
            <button type="button" onClick={syncNow} disabled={syncing}
              className="px-4 h-10 rounded-lg text-sm font-600 font-display shrink-0 transition-all"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </>
        )}
      </div>
      {pms?.lastSyncAt && (
        <p className="text-xs text-ink-500">Last sync: {pms.lastSyncAt}</p>
      )}
    </form>
  );
}

// ─── SMS ───────────────────────────────────────────────────────────────────

function SMSTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: sms } = useQuery({
    queryKey: ['admin-sms', hotelId],
    queryFn: () => adminApi.getSmsConfig(token, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState({ provider: 'TWILIO', senderName: '', accountSid: '', authToken: '', from: '' });
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [synced2, setSynced2] = useState(false);

  if (sms && !synced2) {
    setForm({
      provider: sms.provider,
      senderName: sms.senderName ?? '',
      accountSid: (sms.credentials?.accountSid as string) ?? '',
      authToken: (sms.credentials?.authToken as string) ?? '',
      from: (sms.credentials?.from as string) ?? '',
    });
    setSynced2(true);
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { senderName, provider, accountSid, authToken, from } = form;
      await adminApi.upsertSmsConfig(token, hotelId, { provider: provider as 'TWILIO' | 'TURBOSMS', senderName, credentials: { accountSid, authToken, from } });
      qc.invalidateQueries({ queryKey: ['admin-sms', hotelId] });
      toast.success('SMS config saved');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const testSMS = async () => {
    if (!testPhone) return toast.error('Enter a phone number');
    setTesting(true);
    try {
      await adminApi.testSms(token, hotelId, testPhone);
      toast.success('Test SMS sent!');
    } catch { toast.error('SMS sending failed'); }
    finally { setTesting(false); }
  };

  return (
    <div className="space-y-4 max-w-[520px]">
      <form onSubmit={save} className="card p-6 space-y-4">
        <h3 className="font-display font-700 text-sm text-white">SMS Configuration</h3>
        <div>
          <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Provider</label>
          <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
            {['TWILIO', 'TURBOSMS', 'ESPUTNIK', 'LOG'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <Field label="Sender Name" value={form.senderName} onChange={v => setForm(f => ({ ...f, senderName: v }))} placeholder="HotelMol" />
        {form.provider === 'TWILIO' && (
          <>
            <Field label="Account SID" value={form.accountSid} onChange={v => setForm(f => ({ ...f, accountSid: v }))} placeholder="ACxxxxxxxxxx" />
            <Field label="Auth Token" value={form.authToken} onChange={v => setForm(f => ({ ...f, authToken: v }))} placeholder="••••••••" />
            <Field label="From Number" value={form.from} onChange={v => setForm(f => ({ ...f, from: v }))} placeholder="+1234567890" />
          </>
        )}
        {form.provider === 'TURBOSMS' && (
          <Field label="API Key" value={form.authToken} onChange={v => setForm(f => ({ ...f, authToken: v }))} placeholder="TurboSMS API key" />
        )}
        <SaveBtn saving={saving} />
      </form>

      <div className="card p-5">
        <h3 className="font-display font-700 text-sm text-white mb-4">Send Test SMS</h3>
        <div className="flex gap-2">
          <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+380501234567" className="flex-1" />
          <button type="button" onClick={testSMS} disabled={testing}
            className="px-4 h-[42px] rounded-lg text-sm font-600 font-display shrink-0"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
            {testing ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── POS ───────────────────────────────────────────────────────────────────

const POS_TYPE_URLS: Record<string, string> = {
  poster: 'https://joinposter.com/api',
};
const OUR_CATEGORIES = ['restaurant', 'bar', 'food_drink', 'spa', 'transport', 'housekeeping', 'other'];

function POSTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: pos, isLoading } = useQuery({
    queryKey: ['admin-pos', hotelId],
    queryFn: () => adminApi.getPosConfig(token, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState({
    posType: 'poster',
    apiUrl: 'https://joinposter.com/api',
    accessToken: '',
    spotId: '',
    syncEnabled: false,
    syncInterval: 60,
  });
  const [synced2, setSynced2] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [savingMap, setSavingMap] = useState(false);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});

  if (pos && !synced2) {
    setForm({
      posType: pos.posType ?? 'poster',
      apiUrl: pos.apiUrl ?? POS_TYPE_URLS['poster'],
      accessToken: '',
      spotId: pos.spotId ?? '',
      syncEnabled: pos.syncEnabled ?? false,
      syncInterval: pos.syncInterval ?? 60,
    });
    setCategoryMap((pos.categoryMap as Record<string, string>) ?? {});
    setSynced2(true);
  }

  const { data: posCats = [] } = useQuery({
    queryKey: ['admin-pos-cats', hotelId],
    queryFn: () => adminApi.getPosCategories(token, hotelId),
    enabled: !!pos,
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const payload: Record<string, unknown> = {
        posType: form.posType,
        apiUrl: form.apiUrl,
        spotId: form.spotId || undefined,
        syncEnabled: form.syncEnabled,
        syncInterval: form.syncInterval,
      };
      if (form.accessToken) payload.accessToken = form.accessToken;
      await adminApi.upsertPosConfig(token, hotelId, payload as unknown as import('@/types/admin').POSConfig);
      qc.invalidateQueries({ queryKey: ['admin-pos', hotelId] });
      toast.success('POS config saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminApi.testPosConnection(token, hotelId);
      const d = (res?.data ?? res) as { success: boolean; message: string };
      setTestResult({ ok: d.success, msg: d.message });
    } catch { setTestResult({ ok: false, msg: 'Request failed' }); }
    finally { setTesting(false); }
  };

  const syncMenu = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await adminApi.syncPosMenu(token, hotelId);
      const d = (res?.data ?? res) as { synced?: number };
      setSyncResult(d?.synced !== undefined ? `Synced ${d.synced} items` : 'Sync triggered');
      qc.invalidateQueries({ queryKey: ['admin-pos', hotelId] });
      qc.invalidateQueries({ queryKey: ['admin-pos-cats', hotelId] });
    } catch { setSyncResult('Sync failed'); }
    finally { setSyncing(false); }
  };

  const saveMapping = async () => {
    setSavingMap(true);
    try {
      await adminApi.upsertPosConfig(token, hotelId, { categoryMap } as import('@/types/admin').POSConfig);
      toast.success('Category mapping saved');
    } catch { toast.error('Failed'); }
    finally { setSavingMap(false); }
  };

  if (isLoading) return <div className="card h-32 shimmer" />;

  const lastSync = pos?.lastSyncAt ? new Date(pos.lastSyncAt).toLocaleString() : null;

  return (
    <div className="space-y-4 max-w-[560px]">
      {/* Config form */}
      <form onSubmit={save} className="card p-6 space-y-4">
        <h3 className="font-display font-700 text-sm text-white">POS Integration</h3>

        <div>
          <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">POS Type</label>
          <select value={form.posType} onChange={e => {
            const t = e.target.value;
            setForm(f => ({ ...f, posType: t, apiUrl: POS_TYPE_URLS[t] ?? '' }));
          }}>
            <option value="poster">Poster</option>
            <option value="syrve" disabled>Syrve (soon)</option>
            <option value="rkeeper" disabled>R-Keeper (soon)</option>
          </select>
        </div>

        <Field label="API URL" value={form.apiUrl} onChange={v => setForm(f => ({ ...f, apiUrl: v }))} placeholder="https://joinposter.com/api" />

        <div>
          <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">API Token</label>
          <input
            type="password"
            value={form.accessToken}
            onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}
            placeholder={pos ? '[SAVED — enter new to change]' : 'Poster access token'}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">
            Spot ID <span className="normal-case text-ink-500 font-400">(optional, for multi-location accounts)</span>
          </label>
          <input value={form.spotId} onChange={e => setForm(f => ({ ...f, spotId: e.target.value }))} placeholder="e.g. 1" className="w-full" />
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="syncEnabled" checked={form.syncEnabled}
            onChange={e => setForm(f => ({ ...f, syncEnabled: e.target.checked }))}
            className="w-4 h-4 accent-rose-500" />
          <label htmlFor="syncEnabled" className="text-sm text-ink-200 font-display font-600">Auto-sync enabled</label>
        </div>

        {form.syncEnabled && (
          <div>
            <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Sync interval (minutes)</label>
            <input type="number" min={15} max={1440} value={form.syncInterval}
              onChange={e => setForm(f => ({ ...f, syncInterval: Number(e.target.value) }))}
              className="w-32" />
          </div>
        )}

        <SaveBtn saving={saving} />
      </form>

      {/* Actions + status */}
      {pos && (
        <div className="card p-5 space-y-3">
          <h3 className="font-display font-700 text-sm text-white">Actions</h3>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={testConnection} disabled={testing}
              className="px-4 h-10 rounded-lg text-sm font-600 font-display"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button type="button" onClick={syncMenu} disabled={syncing}
              className="px-4 h-10 rounded-lg text-sm font-600 font-display"
              style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
              {syncing ? 'Syncing...' : 'Sync Menu Now'}
            </button>
          </div>

          {testResult && (
            <p className="text-sm" style={{ color: testResult.ok ? '#10B981' : '#F43F5E' }}>
              {testResult.ok ? '✓' : '✗'} {testResult.msg}
            </p>
          )}
          {syncResult && (
            <p className="text-sm" style={{ color: syncResult.includes('failed') ? '#F43F5E' : '#10B981' }}>
              {syncResult}
            </p>
          )}

          <div className="text-xs text-ink-500 space-y-0.5 pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p>Last sync: {lastSync ?? 'Never'}</p>
            {pos.lastError && <p style={{ color: '#F43F5E' }}>Error: {pos.lastError}</p>}
          </div>
        </div>
      )}

      {/* Category mapping */}
      {pos && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-700 text-sm text-white">Category Mapping</h3>
            <span className="text-xs text-ink-500">POS category → app category</span>
          </div>

          {posCats.length === 0 ? (
            <p className="text-xs text-ink-500">Sync menu first to load POS categories.</p>
          ) : (
            <div className="space-y-2">
              {posCats.map(cat => (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-sm text-ink-200 w-40 shrink-0 truncate" title={cat.name}>{cat.name}</span>
                  <span className="text-ink-500 text-xs">→</span>
                  <select
                    value={categoryMap[cat.name] ?? ''}
                    onChange={e => setCategoryMap(m => ({ ...m, [cat.name]: e.target.value }))}
                    className="flex-1 text-sm"
                  >
                    <option value="">— auto detect —</option>
                    {OUR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {posCats.length > 0 && (
            <button type="button" onClick={saveMapping} disabled={savingMap}
              className="px-4 h-10 rounded-lg text-sm font-600 font-display"
              style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}>
              {savingMap ? 'Saving...' : 'Save Mapping'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Task Management (TMS) ─────────────────────────────────────────────────

const TMS_PROVIDERS = ['BUILT_IN', 'HOTELKIT', 'FLEXKEEPING', 'HOTSOS', 'GENERIC_WEBHOOK'];
const TMS_MODES = [
  { value: 'BUILT_IN', label: 'Built-in TMS', desc: 'Use HotelMol\'s own task management system' },
  { value: 'EXTERNAL', label: 'External TMS', desc: 'Route all tasks to an external system via API' },
  { value: 'HYBRID', label: 'Hybrid', desc: 'Some categories go to built-in, others to external TMS' },
];

function TMSTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useQuery({
    queryKey: ['admin-tms', hotelId],
    queryFn: () => adminApi.getTmsConfig(token, hotelId),
    enabled: !!token,
  });

  const [form, setForm] = useState({
    mode: 'BUILT_IN',
    provider: 'BUILT_IN',
    enabled: false,
    apiUrl: '',
    apiKey: '',
    webhookSecret: '',
    outgoingWebhookUrl: '',
    pollingEnabled: false,
    pollingIntervalMs: 30000,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [synced, setSynced] = useState(false);

  if (cfg && !synced) {
    setForm({
      mode: cfg.mode ?? 'BUILT_IN',
      provider: cfg.provider ?? 'BUILT_IN',
      enabled: cfg.enabled ?? false,
      apiUrl: (cfg.credentials?.apiUrl as string) ?? '',
      apiKey: (cfg.credentials?.apiKey as string) ?? '',
      webhookSecret: cfg.webhookSecret ?? '',
      outgoingWebhookUrl: cfg.outgoingWebhookUrl ?? '',
      pollingEnabled: cfg.pollingEnabled ?? false,
      pollingIntervalMs: cfg.pollingIntervalMs ?? 30000,
    });
    setSynced(true);
  }

  const isExternal = form.mode === 'EXTERNAL' || form.mode === 'HYBRID';

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.upsertTmsConfig(token, hotelId, {
        mode: form.mode as 'BUILT_IN' | 'EXTERNAL' | 'HYBRID',
        provider: isExternal ? form.provider : 'BUILT_IN',
        enabled: form.enabled,
        credentials: { apiUrl: form.apiUrl, apiKey: form.apiKey },
        webhookSecret: form.webhookSecret || undefined,
        outgoingWebhookUrl: form.outgoingWebhookUrl || undefined,
        pollingEnabled: form.pollingEnabled,
        pollingIntervalMs: form.pollingIntervalMs,
      });
      qc.invalidateQueries({ queryKey: ['admin-tms', hotelId] });
      toast.success('TMS config saved');
    } catch { toast.error('Failed to save TMS config'); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true);
    try {
      const r = await adminApi.testTmsConnection(token, hotelId);
      toast.success(r.message || 'Connection successful');
    } catch { toast.error('Connection test failed'); }
    finally { setTesting(false); }
  };

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <form onSubmit={save} className="space-y-4 max-w-[560px]">
      {/* Mode */}
      <div className="card p-5 space-y-3">
        <h3 className="font-display font-700 text-sm text-white">TMS Mode</h3>
        <div className="space-y-2">
          {TMS_MODES.map(m => (
            <label key={m.value}
              className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
              style={{
                background: form.mode === m.value ? 'rgba(240,165,0,0.07)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${form.mode === m.value ? 'rgba(240,165,0,0.25)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              <input
                type="radio"
                name="tms-mode"
                value={m.value}
                checked={form.mode === m.value}
                onChange={() => setForm(f => ({ ...f, mode: m.value, provider: m.value === 'BUILT_IN' ? 'BUILT_IN' : f.provider === 'BUILT_IN' ? 'HOTELKIT' : f.provider }))}
                className="mt-0.5 accent-gold"
              />
              <div>
                <p className="text-sm font-600 text-white">{m.label}</p>
                <p className="text-xs text-ink-400 mt-0.5">{m.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-sm font-600 text-white">Enable TMS</p>
            <p className="text-xs text-ink-400">Tasks will be routed according to the selected mode</p>
          </div>
          <button type="button" onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
            className="relative w-11 h-6 rounded-full transition-colors shrink-0"
            style={{ background: form.enabled ? '#F0A500' : 'rgba(255,255,255,0.1)' }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              style={{ left: form.enabled ? '22px' : '2px' }} />
          </button>
        </div>
      </div>

      {/* External settings */}
      {isExternal && (
        <div className="card p-5 space-y-4">
          <h3 className="font-display font-700 text-sm text-white">External TMS Settings</h3>

          <div>
            <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Provider</label>
            <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}>
              {TMS_PROVIDERS.filter(p => p !== 'BUILT_IN').map(p => (
                <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <Field label="API URL" value={form.apiUrl} onChange={v => setForm(f => ({ ...f, apiUrl: v }))} placeholder="https://api.hotelkit.net/v1" />
          <Field label="API Key / Token" value={form.apiKey} onChange={v => setForm(f => ({ ...f, apiKey: v }))} placeholder="Bearer token or API key" />

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <p className="text-xs font-600 uppercase tracking-widest text-ink-300 mb-3 font-display">Webhook</p>
            <div className="space-y-3">
              <Field label="Webhook Secret (incoming)" value={form.webhookSecret} onChange={v => setForm(f => ({ ...f, webhookSecret: v }))} placeholder="Secret for verifying incoming webhooks" />
              <Field label="Outgoing Webhook URL" value={form.outgoingWebhookUrl} onChange={v => setForm(f => ({ ...f, outgoingWebhookUrl: v }))} placeholder="https://yourtms.com/webhook/hotelmol" />
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-600 text-white">Polling</p>
                <p className="text-xs text-ink-400">Poll external TMS for status updates</p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, pollingEnabled: !f.pollingEnabled }))}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                style={{ background: form.pollingEnabled ? '#3B82F6' : 'rgba(255,255,255,0.1)' }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: form.pollingEnabled ? '22px' : '2px' }} />
              </button>
            </div>
            {form.pollingEnabled && (
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Interval (ms)</label>
                <select value={form.pollingIntervalMs} onChange={e => setForm(f => ({ ...f, pollingIntervalMs: Number(e.target.value) }))}>
                  {[15000, 30000, 60000, 120000, 300000].map(v => (
                    <option key={v} value={v}>{v / 1000}s</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <SaveBtn saving={saving} />
        {cfg && isExternal && (
          <button type="button" onClick={test} disabled={testing}
            className="px-4 h-10 rounded-lg text-sm font-600 font-display shrink-0 transition-all"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        )}
      </div>

      {cfg && (
        <p className="text-xs text-ink-500">
          Current mode: <span className="text-ink-300">{cfg.mode}</span>
          {cfg.provider !== 'BUILT_IN' && <> · Provider: <span className="text-ink-300">{cfg.provider}</span></>}
          {cfg.enabled ? <span className="text-teal ml-2">● Enabled</span> : <span className="text-rose ml-2">○ Disabled</span>}
        </p>
      )}
    </form>
  );
}

// ─── QR ────────────────────────────────────────────────────────────────────

function QRTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: qrCodes, isLoading } = useQuery({
    queryKey: ['admin-qr', hotelId],
    queryFn: () => adminApi.listQR(token, hotelId),
    enabled: !!token,
  });

  const [genForm, setGenForm] = useState({ type: 'in_room', label: '', roomNumber: '' });
  const [bulkRooms, setBulkRooms] = useState('');
  const [generating, setGenerating] = useState(false);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await adminApi.generateQR(token, hotelId, genForm);
      qc.invalidateQueries({ queryKey: ['admin-qr', hotelId] });
      toast.success('QR code generated');
      setGenForm({ type: 'in_room', label: '', roomNumber: '' });
    } catch { toast.error('Generation failed'); }
    finally { setGenerating(false); }
  };

  const generateBulk = async () => {
    const rooms = bulkRooms.split(',').map(r => r.trim()).filter(Boolean);
    if (!rooms.length) return toast.error('Enter comma-separated room numbers');
    setGenerating(true);
    try {
      await adminApi.generateQRBulk(token, hotelId, rooms);
      qc.invalidateQueries({ queryKey: ['admin-qr', hotelId] });
      toast.success(`Generated ${rooms.length} QR codes`);
      setBulkRooms('');
    } catch { toast.error('Bulk generation failed'); }
    finally { setGenerating(false); }
  };

  const deleteQR = async (id: string) => {
    if (!confirm('Delete this QR code?')) return;
    try {
      await adminApi.deleteQR(token, hotelId, id);
      qc.invalidateQueries({ queryKey: ['admin-qr', hotelId] });
      toast.success('QR deleted');
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Single generate */}
        <form onSubmit={generate} className="card p-5 space-y-3">
          <h3 className="font-display font-700 text-sm text-white">Generate QR</h3>
          <div>
            <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Type</label>
            <select value={genForm.type} onChange={e => setGenForm(f => ({ ...f, type: e.target.value }))}>
              {['in_room', 'lobby', 'restaurant', 'spa', 'elevator'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Field label="Label" value={genForm.label} onChange={v => setGenForm(f => ({ ...f, label: v }))} placeholder="Room 301" required />
          <Field label="Room Number (optional)" value={genForm.roomNumber} onChange={v => setGenForm(f => ({ ...f, roomNumber: v }))} placeholder="301" />
          <SaveBtn saving={generating} label="Generate" />
        </form>

        {/* Bulk generate */}
        <div className="card p-5 space-y-3">
          <h3 className="font-display font-700 text-sm text-white">Bulk Generate (Rooms)</h3>
          <Field label="Room Numbers (comma-separated)" value={bulkRooms} onChange={setBulkRooms} placeholder="301, 302, 303, 304" />
          <button type="button" onClick={generateBulk} disabled={generating}
            className="w-full h-10 rounded-lg text-sm font-600 font-display transition-all"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
            {generating ? 'Generating...' : 'Generate Bulk'}
          </button>
        </div>
      </div>

      {/* QR list */}
      {!isLoading && qrCodes && qrCodes.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b text-xs font-600 text-ink-400 font-display uppercase tracking-widest" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {qrCodes.length} QR Codes
          </div>
          <table className="data-table">
            <thead>
              <tr><th>Label</th><th>Type</th><th>Room</th><th>Scans</th><th>Active</th><th></th></tr>
            </thead>
            <tbody>
              {qrCodes.map(qr => (
                <tr key={qr.id}>
                  <td className="text-white font-600">{qr.label}</td>
                  <td className="text-ink-400 capitalize">{qr.type.replace('_', ' ')}</td>
                  <td className="num text-ink-300">{qr.roomNumber || '—'}</td>
                  <td className="num text-ink-300">{qr.scanCount}</td>
                  <td>{qr.isActive ? <span className="text-teal text-xs">✓</span> : <span className="text-rose text-xs">✗</span>}</td>
                  <td>
                    <button onClick={() => deleteQR(qr.id)} className="text-ink-500 hover:text-rose transition-colors">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Services ──────────────────────────────────────────────────────────────

function ServicesTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const { data: categories, isLoading } = useQuery({
    queryKey: ['admin-services', hotelId],
    queryFn: () => adminApi.listServiceCategories(token, hotelId),
    enabled: !!token,
  });

  const [seeding, setSeeding] = useState(false);
  const [newItem, setNewItem] = useState<{ catId: string; name: string; price: string } | null>(null);

  const seed = async () => {
    setSeeding(true);
    try {
      await adminApi.seedServiceCategories(token, hotelId);
      qc.invalidateQueries({ queryKey: ['admin-services', hotelId] });
      toast.success('Default categories seeded');
    } catch { toast.error('Seed failed'); }
    finally { setSeeding(false); }
  };

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem) return;
    try {
      await adminApi.createServiceItem(token, hotelId, newItem.catId, { name: newItem.name, price: parseFloat(newItem.price), currency: 'USD', isAvailable: true });
      qc.invalidateQueries({ queryKey: ['admin-services', hotelId] });
      toast.success('Item added');
      setNewItem(null);
    } catch { toast.error('Failed to add item'); }
  };

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={seed} disabled={seeding}
          className="px-4 py-2 rounded-lg text-xs font-600 font-display"
          style={{ background: 'rgba(168,85,247,0.1)', color: '#A855F7', border: '1px solid rgba(168,85,247,0.2)' }}>
          {seeding ? 'Seeding...' : 'Seed Default Categories'}
        </button>
      </div>

      {!categories?.length ? (
        <div className="card flex items-center justify-center h-32 text-ink-500 text-sm">No categories yet</div>
      ) : (
        categories.map(cat => (
          <div key={cat.id} className="card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <span className="text-lg">{cat.icon}</span>
              <span className="font-display font-700 text-sm text-white">{cat.name}</span>
              <span className="text-xs text-ink-500 ml-auto">{cat.items?.length ?? 0} items</span>
              <button onClick={() => setNewItem({ catId: cat.id, name: '', price: '' })}
                className="text-xs text-gold hover:text-gold-dim transition-colors ml-2">+ Add item</button>
            </div>
            {cat.items?.length > 0 && (
              <table className="data-table">
                <thead><tr><th>Name</th><th>Price</th><th>Available</th></tr></thead>
                <tbody>
                  {cat.items.map(item => (
                    <tr key={item.id}>
                      <td className="text-white">{item.name}</td>
                      <td className="num text-ink-300">${item.price}</td>
                      <td>{item.isAvailable ? <span className="text-teal text-xs">✓</span> : <span className="text-ink-500 text-xs">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {newItem?.catId === cat.id && (
              <form onSubmit={createItem} className="px-5 py-3 flex gap-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <input value={newItem.name} onChange={e => setNewItem(n => n ? { ...n, name: e.target.value } : n)} placeholder="Item name" className="flex-1" required />
                <input value={newItem.price} onChange={e => setNewItem(n => n ? { ...n, price: e.target.value } : n)} placeholder="Price" type="number" step="0.01" className="w-24" required />
                <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-600 font-display" style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500' }}>Add</button>
                <button type="button" onClick={() => setNewItem(null)} className="text-ink-500 text-xs">✕</button>
              </form>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Staff ─────────────────────────────────────────────────────────────────

const ROLES = ['LINE_STAFF', 'SUPERVISOR', 'HEAD_OF_DEPT', 'RECEPTIONIST', 'GENERAL_MANAGER'];
const DEPARTMENTS = ['HOUSEKEEPING', 'MAINTENANCE', 'FOOD_AND_BEVERAGE', 'FRONT_OFFICE', 'SECURITY', 'MANAGEMENT'];

const ROLE_COLOR: Record<string, string> = {
  LINE_STAFF: '#64748B', SUPERVISOR: '#3B82F6', HEAD_OF_DEPT: '#8B5CF6',
  RECEPTIONIST: '#10B981', GENERAL_MANAGER: '#F0A500',
};

const DEPT_SHORT: Record<string, string> = {
  HOUSEKEEPING: 'HK', MAINTENANCE: 'MNT', FOOD_AND_BEVERAGE: 'F&B',
  FRONT_OFFICE: 'FO', SECURITY: 'SEC', MANAGEMENT: 'MGT',
};

const EMPTY_STAFF: CreateAdminStaffData = {
  email: '', firstName: '', lastName: '', phone: '',
  role: 'LINE_STAFF', department: 'HOUSEKEEPING',
  password: '', assignedFloor: '',
};

function StaffTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminStaffMember | null>(null);
  const [form, setForm] = useState<CreateAdminStaffData>(EMPTY_STAFF);
  const [pinModal, setPinModal] = useState<{ staffId: string; name: string } | null>(null);
  const [newPin, setNewPin] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [filterDept, setFilterDept] = useState('');

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['admin-staff', hotelId],
    queryFn: () => adminApi.listStaff(token, hotelId),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateAdminStaffData) => adminApi.createStaff(token, hotelId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-staff', hotelId] }); closeModal(); toast.success('Staff member created'); },
    onError: () => toast.error('Failed to create staff member'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAdminStaffData> }) =>
      adminApi.updateStaff(token, hotelId, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-staff', hotelId] }); closeModal(); toast.success('Staff member updated'); },
    onError: () => toast.error('Failed to update staff member'),
  });

  const deactivateMut = useMutation({
    mutationFn: (staffId: string) => adminApi.deactivateStaff(token, hotelId, staffId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-staff', hotelId] }); toast.success('Staff member deactivated'); },
    onError: () => toast.error('Failed to deactivate'),
  });

  const pinMut = useMutation({
    mutationFn: ({ staffId, pin }: { staffId: string; pin: string }) =>
      adminApi.resetStaffPin(token, hotelId, staffId, pin),
    onSuccess: () => { setPinModal(null); setNewPin(''); toast.success('PIN updated'); },
    onError: () => toast.error('Failed to update PIN'),
  });

  function openCreate() { setEditTarget(null); setForm(EMPTY_STAFF); setShowModal(true); }

  function openEdit(s: AdminStaffMember) {
    setEditTarget(s);
    setForm({ email: s.email, firstName: s.firstName, lastName: s.lastName ?? '', phone: s.phone ?? '', role: s.role, department: s.department, password: '', assignedFloor: s.assignedFloor ?? '' });
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); setEditTarget(null); setForm(EMPTY_STAFF); }

  function submit() {
    if (editTarget) {
      const { password, ...rest } = form;
      const data: Partial<CreateAdminStaffData> = rest;
      if (password) data.password = password;
      updateMut.mutate({ id: editTarget.id, data });
    } else {
      createMut.mutate(form);
    }
  }

  const filtered = staff.filter(s => {
    if (filterActive === 'active' && !s.isActive) return false;
    if (filterActive === 'inactive' && s.isActive) return false;
    if (filterDept && s.department !== filterDept) return false;
    return true;
  });

  const isOnShift = (s: AdminStaffMember) => s.shifts && s.shifts.some(sh => sh.isActive);
  const isPending = createMut.isPending || updateMut.isPending;

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border text-xs font-600 font-display" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {(['all', 'active', 'inactive'] as const).map(v => (
            <button key={v} onClick={() => setFilterActive(v)}
              className="px-3 py-1.5 capitalize transition-colors"
              style={{ background: filterActive === v ? 'rgba(244,63,94,0.15)' : 'transparent', color: filterActive === v ? '#F43F5E' : '#64748B' }}>
              {v}
            </button>
          ))}
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="text-xs h-8 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: filterDept ? '#fff' : '#64748B' }}>
          <option value="">All departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-ink-500">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={openCreate}
            className="h-8 px-4 rounded-lg text-xs font-600 font-display transition-all"
            style={{ background: 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff', boxShadow: '0 0 12px rgba(244,63,94,0.2)' }}>
            + Add Staff
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card flex items-center justify-center h-32 text-ink-500 text-sm">No staff members</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Dept</th><th>Floor</th><th>Status</th><th>Shift</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="flex flex-col">
                      <span className="text-white font-600 text-sm">{s.firstName} {s.lastName ?? ''}</span>
                      <span className="text-ink-500 text-xs">{s.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className="text-xs font-600 px-2 py-0.5 rounded-full font-display"
                      style={{ background: `${ROLE_COLOR[s.role]}18`, color: ROLE_COLOR[s.role] ?? '#94A3B8' }}>
                      {s.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="text-ink-300 text-xs font-600">{DEPT_SHORT[s.department] ?? s.department}</td>
                  <td className="text-ink-400 text-xs">{s.assignedFloor ?? '—'}</td>
                  <td>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.isActive ? '#10B981' : '#475569' }} />
                      <span style={{ color: s.isActive ? '#10B981' : '#475569' }}>{s.isActive ? 'Active' : 'Inactive'}</span>
                    </span>
                  </td>
                  <td className="text-xs" style={{ color: isOnShift(s) ? '#F0A500' : '#475569' }}>
                    {isOnShift(s) ? 'On Shift' : '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="text-ink-400 hover:text-white transition-colors text-xs">Edit</button>
                      <button onClick={() => setPinModal({ staffId: s.id, name: `${s.firstName} ${s.lastName ?? ''}` })}
                        className="text-ink-400 hover:text-gold transition-colors text-xs">PIN</button>
                      {s.isActive && (
                        <button onClick={() => { if (confirm(`Deactivate ${s.firstName}?`)) deactivateMut.mutate(s.id); }}
                          className="text-ink-400 hover:text-rose transition-colors text-xs">Off</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md p-6 space-y-4" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-700 text-white">{editTarget ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
              <button onClick={closeModal} className="text-ink-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} required />
              <Field label="Last Name" value={form.lastName ?? ''} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
            </div>
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Email</label>
              <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required disabled={!!editTarget}
                style={editTarget ? { opacity: 0.5, cursor: 'not-allowed' } : {}} />
            </div>
            <Field label="Phone" value={form.phone ?? ''} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+380501234567" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Department</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
            </div>
            <Field label="Assigned Floor" value={form.assignedFloor ?? ''} onChange={v => setForm(f => ({ ...f, assignedFloor: v }))} placeholder="e.g. 3" />
            <Field label={editTarget ? 'New Password (leave blank to keep)' : 'Password'} value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} required={!editTarget} />
            <div className="flex gap-2 pt-2">
              <button onClick={submit} disabled={isPending}
                className="flex-1 h-10 rounded-lg text-sm font-600 font-display transition-all"
                style={{ background: isPending ? 'rgba(244,63,94,0.4)' : 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff' }}>
                {isPending ? 'Saving...' : editTarget ? 'Save Changes' : 'Create'}
              </button>
              <button onClick={closeModal} className="px-4 h-10 rounded-lg text-sm font-600 font-display"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Reset Modal */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-700 text-white">Reset PIN</h3>
              <button onClick={() => { setPinModal(null); setNewPin(''); }} className="text-ink-500 hover:text-white text-lg">✕</button>
            </div>
            <p className="text-xs text-ink-400">{pinModal.name}</p>
            <Field label="New PIN (4–8 digits)" value={newPin} onChange={setNewPin} placeholder="1234" />
            <button onClick={() => pinMut.mutate({ staffId: pinModal.staffId, pin: newPin })}
              disabled={pinMut.isPending || newPin.length < 4}
              className="w-full h-10 rounded-lg text-sm font-600 font-display"
              style={{ background: newPin.length >= 4 ? 'rgba(240,165,0,0.15)' : 'rgba(255,255,255,0.04)', color: newPin.length >= 4 ? '#F0A500' : '#475569', border: `1px solid ${newPin.length >= 4 ? 'rgba(240,165,0,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
              {pinMut.isPending ? 'Updating...' : 'Set PIN'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Housekeeping ──────────────────────────────────────────────────────────

const HK_STATUS_COLORS: Record<string, string> = {
  DIRTY: '#F43F5E', CLEANING: '#F0A500', CLEANED: '#3B82F6',
  INSPECTED: '#8B5CF6', READY: '#10B981', OOO: '#64748B', DND: '#94A3B8',
};

const HK_STATUSES = ['DIRTY', 'CLEANING', 'CLEANED', 'INSPECTED', 'READY', 'OOO', 'DND'];

function HousekeepingTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const [bulkInput, setBulkInput] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['admin-rooms', hotelId],
    queryFn: () => adminApi.listRooms(token, hotelId),
    enabled: !!token,
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ roomId, status }: { roomId: string; status: string }) =>
      adminApi.updateRoomStatus(token, hotelId, roomId, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-rooms', hotelId] }); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteMut = useMutation({
    mutationFn: (roomId: string) => adminApi.deleteRoom(token, hotelId, roomId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-rooms', hotelId] }); toast.success('Room removed'); },
    onError: () => toast.error('Failed to remove room'),
  });

  const bulkMut = useMutation({
    mutationFn: (rooms: BulkRoomInput[]) => adminApi.bulkCreateRooms(token, hotelId, rooms),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-rooms', hotelId] });
      toast.success(`${data?.length ?? 0} rooms created/updated`);
      setBulkInput('');
      setShowBulk(false);
    },
    onError: () => toast.error('Failed to create rooms'),
  });

  function parseBulk() {
    const lines = bulkInput.trim().split('\n').filter(Boolean);
    const rooms: BulkRoomInput[] = [];
    for (const line of lines) {
      const [roomNumber, floor, roomType] = line.split(',').map(s => s.trim());
      if (!roomNumber || !floor) { toast.error(`Invalid line: "${line}"`); return; }
      rooms.push({ roomNumber, floor: Number(floor), roomType: roomType || undefined });
    }
    if (rooms.length === 0) { toast.error('No valid rooms'); return; }
    bulkMut.mutate(rooms);
  }

  const filtered = filterStatus ? rooms.filter(r => r.housekeepingStatus === filterStatus) : rooms;
  const byFloor = filtered.reduce<Record<number, AdminRoom[]>>((acc, r) => {
    (acc[r.floor] = acc[r.floor] ?? []).push(r);
    return acc;
  }, {});

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-xs h-8 px-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: filterStatus ? '#fff' : '#64748B' }}>
          <option value="">All statuses</option>
          {HK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-ink-500">{filtered.length} rooms</span>
        <div className="ml-auto">
          <button onClick={() => setShowBulk(v => !v)}
            className="h-8 px-4 rounded-lg text-xs font-600 font-display"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}>
            + Bulk Add Rooms
          </button>
        </div>
      </div>

      {showBulk && (
        <div className="card p-4 space-y-3">
          <p className="text-xs text-ink-400">One room per line: <span className="text-ink-200 font-mono">roomNumber, floor, roomType</span> (roomType optional)</p>
          <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} rows={6}
            placeholder={'101, 1, Standard\n102, 1, Deluxe\n201, 2'}
            className="w-full text-sm font-mono"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: '8px', padding: '8px 12px', resize: 'vertical' }} />
          <div className="flex gap-2">
            <button onClick={parseBulk} disabled={bulkMut.isPending}
              className="h-8 px-4 rounded-lg text-xs font-600 font-display"
              style={{ background: 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff' }}>
              {bulkMut.isPending ? 'Creating...' : 'Create Rooms'}
            </button>
            <button onClick={() => setShowBulk(false)} className="h-8 px-3 rounded-lg text-xs" style={{ color: '#64748B' }}>Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card flex items-center justify-center h-32 text-ink-500 text-sm">No rooms found</div>
      ) : (
        Object.entries(byFloor).sort(([a], [b]) => Number(a) - Number(b)).map(([floor, floorRooms]) => (
          <div key={floor}>
            <p className="text-xs font-700 font-display text-ink-400 uppercase tracking-widest mb-2">Floor {floor}</p>
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr><th>Room</th><th>Type</th><th>HK Status</th><th>Occupancy</th><th>Cleaner</th><th>Rush</th><th></th></tr>
                </thead>
                <tbody>
                  {floorRooms.map(r => (
                    <tr key={r.id}>
                      <td className="text-white font-600">{r.roomNumber}</td>
                      <td className="text-ink-400 text-xs">{r.roomType ?? '—'}</td>
                      <td>
                        <select value={r.housekeepingStatus}
                          onChange={e => updateStatusMut.mutate({ roomId: r.id, status: e.target.value })}
                          className="text-xs h-7 px-2 rounded-lg"
                          style={{ background: `${HK_STATUS_COLORS[r.housekeepingStatus] ?? '#64748B'}18`, color: HK_STATUS_COLORS[r.housekeepingStatus] ?? '#94A3B8', border: `1px solid ${HK_STATUS_COLORS[r.housekeepingStatus] ?? '#64748B'}33` }}>
                          {HK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="text-xs" style={{ color: r.occupancyStatus === 'OCCUPIED' ? '#F0A500' : '#64748B' }}>
                        {r.occupancyStatus}
                      </td>
                      <td className="text-xs text-ink-400">
                        {r.assignedCleaner ? `${r.assignedCleaner.firstName} ${r.assignedCleaner.lastName ?? ''}` : '—'}
                      </td>
                      <td>
                        {r.isRush && <span className="text-xs font-600 px-1.5 py-0.5 rounded" style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E' }}>Rush</span>}
                      </td>
                      <td>
                        <button onClick={() => { if (confirm(`Remove room ${r.roomNumber}?`)) deleteMut.mutate(r.id); }}
                          className="text-xs text-ink-500 hover:text-rose transition-colors">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

const TASK_STATUS_COLORS: Record<string, string> = {
  NEW: '#64748B', ASSIGNED: '#3B82F6', ACCEPTED: '#6366F1', IN_PROGRESS: '#F0A500',
  ON_HOLD: '#F59E0B', COMPLETED: '#10B981', INSPECTED: '#8B5CF6', CLOSED: '#475569',
  CANCELLED: '#F43F5E', ESCALATED: '#EF4444',
};

const TASK_STATUSES = ['NEW', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'INSPECTED', 'CLOSED', 'CANCELLED', 'ESCALATED'];

function TasksTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['admin-tasks', hotelId],
    queryFn: () => adminApi.listTasks(token, hotelId),
    enabled: !!token,
    refetchInterval: 30000,
  });

  const updateMut = useMutation({
    mutationFn: ({ taskType, taskId, status }: { taskType: string; taskId: string; status: string }) =>
      adminApi.updateTaskStatus(token, hotelId, taskType, taskId, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tasks', hotelId] }); toast.success('Status updated'); },
    onError: () => toast.error('Failed to update'),
  });

  const filtered = tasks.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  });

  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="text-xs h-8 px-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: filterType ? '#fff' : '#64748B' }}>
          <option value="">All types</option>
          <option value="INTERNAL">Internal</option>
          <option value="ORDER">Orders</option>
          <option value="SERVICE_REQUEST">Service Requests</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="text-xs h-8 px-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: filterStatus ? '#fff' : '#64748B' }}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <span className="text-xs text-ink-500">{filtered.length} tasks</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card flex items-center justify-center h-32 text-ink-500 text-sm">No tasks</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr><th>Title</th><th>Type</th><th>Dept</th><th>Room</th><th>Assigned</th><th>Priority</th><th>Status</th><th>Created</th></tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td className="text-white text-sm max-w-xs truncate">{t.title}</td>
                  <td>
                    <span className="text-xs font-600 px-1.5 py-0.5 rounded font-display"
                      style={{ background: t.type === 'INTERNAL' ? 'rgba(99,102,241,0.15)' : t.type === 'ORDER' ? 'rgba(240,165,0,0.15)' : 'rgba(16,185,129,0.15)', color: t.type === 'INTERNAL' ? '#6366F1' : t.type === 'ORDER' ? '#F0A500' : '#10B981' }}>
                      {t.type === 'SERVICE_REQUEST' ? 'SR' : t.type}
                    </span>
                  </td>
                  <td className="text-ink-400 text-xs">{t.department ?? '—'}</td>
                  <td className="text-ink-400 text-xs">{t.roomNumber ?? '—'}</td>
                  <td className="text-ink-400 text-xs">
                    {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName ?? ''}` : '—'}
                  </td>
                  <td>
                    <span className="text-xs font-600" style={{ color: t.priority === 'URGENT' ? '#F43F5E' : t.priority === 'HIGH' ? '#F0A500' : '#64748B' }}>
                      {t.priority}
                    </span>
                  </td>
                  <td>
                    <select value={t.status}
                      onChange={e => updateMut.mutate({ taskType: t.type, taskId: t.id, status: e.target.value })}
                      className="text-xs h-7 px-2 rounded-lg"
                      style={{ background: `${TASK_STATUS_COLORS[t.status] ?? '#64748B'}18`, color: TASK_STATUS_COLORS[t.status] ?? '#94A3B8', border: `1px solid ${TASK_STATUS_COLORS[t.status] ?? '#64748B'}33` }}>
                      {TASK_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </td>
                  <td className="text-ink-500 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Templates ─────────────────────────────────────────────────────────────

const TEMPLATE_DEPTS = ['HOUSEKEEPING', 'MAINTENANCE', 'FOOD_AND_BEVERAGE', 'FRONT_OFFICE', 'SECURITY', 'MANAGEMENT'];
const TEMPLATE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const EMPTY_TEMPLATE: TemplateInput = {
  name: '', department: 'HOUSEKEEPING', defaultPriority: 'MEDIUM',
  estimatedMinutes: undefined, checklistItems: [],
};

function TemplatesTab({ hotelId, token }: { hotelId: string; token: string }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminTemplate | null>(null);
  const [form, setForm] = useState<TemplateInput>(EMPTY_TEMPLATE);
  const [checklistText, setChecklistText] = useState('');

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin-templates', hotelId],
    queryFn: () => adminApi.listTemplates(token, hotelId),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: (data: TemplateInput) => adminApi.createTemplate(token, hotelId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-templates', hotelId] }); closeModal(); toast.success('Template created'); },
    onError: () => toast.error('Failed to create template'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TemplateInput> }) =>
      adminApi.updateTemplate(token, hotelId, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-templates', hotelId] }); closeModal(); toast.success('Template updated'); },
    onError: () => toast.error('Failed to update template'),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => adminApi.deactivateTemplate(token, hotelId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-templates', hotelId] }); toast.success('Template deactivated'); },
    onError: () => toast.error('Failed to deactivate'),
  });

  function openCreate() { setEditTarget(null); setForm(EMPTY_TEMPLATE); setChecklistText(''); setShowModal(true); }
  function openEdit(t: AdminTemplate) {
    setEditTarget(t);
    setForm({ name: t.name, department: t.department, defaultPriority: t.defaultPriority, estimatedMinutes: t.estimatedMinutes ?? undefined, checklistItems: t.checklistItems });
    setChecklistText(t.checklistItems.map(c => c.text).join('\n'));
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditTarget(null); setForm(EMPTY_TEMPLATE); setChecklistText(''); }

  function submit() {
    const items = checklistText.split('\n').map((text, i) => ({ text: text.trim(), order: i })).filter(c => c.text);
    const data = { ...form, checklistItems: items };
    if (editTarget) updateMut.mutate({ id: editTarget.id, data });
    else createMut.mutate(data);
  }

  const isPending = createMut.isPending || updateMut.isPending;
  if (isLoading) return <div className="card h-32 shimmer" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-500">{templates.filter(t => t.isActive).length} active templates</span>
        <button onClick={openCreate}
          className="h-8 px-4 rounded-lg text-xs font-600 font-display"
          style={{ background: 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff', boxShadow: '0 0 12px rgba(244,63,94,0.2)' }}>
          + New Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="card flex items-center justify-center h-32 text-ink-500 text-sm">No templates</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Dept</th><th>Priority</th><th>Est. Time</th><th>Checklist</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id}>
                  <td className="text-white font-600 text-sm">{t.name}</td>
                  <td className="text-ink-400 text-xs">{t.department.replace(/_/g, ' ')}</td>
                  <td>
                    <span className="text-xs font-600" style={{ color: t.defaultPriority === 'URGENT' ? '#F43F5E' : t.defaultPriority === 'HIGH' ? '#F0A500' : '#64748B' }}>
                      {t.defaultPriority}
                    </span>
                  </td>
                  <td className="text-ink-400 text-xs">{t.estimatedMinutes ? `${t.estimatedMinutes} min` : '—'}</td>
                  <td className="text-ink-500 text-xs">{t.checklistItems.length} items</td>
                  <td>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.isActive ? '#10B981' : '#475569' }} />
                      <span style={{ color: t.isActive ? '#10B981' : '#475569' }}>{t.isActive ? 'Active' : 'Inactive'}</span>
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(t)} className="text-ink-400 hover:text-white text-xs transition-colors">Edit</button>
                      {t.isActive && (
                        <button onClick={() => { if (confirm(`Deactivate "${t.name}"?`)) deactivateMut.mutate(t.id); }}
                          className="text-ink-400 hover:text-rose text-xs transition-colors">Off</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-md p-6 space-y-4" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-700 text-white">{editTarget ? 'Edit Template' : 'New Template'}</h3>
              <button onClick={closeModal} className="text-ink-500 hover:text-white text-lg">✕</button>
            </div>
            <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Department</label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  {TEMPLATE_DEPTS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Priority</label>
                <select value={form.defaultPriority ?? 'MEDIUM'} onChange={e => setForm(f => ({ ...f, defaultPriority: e.target.value }))}>
                  {TEMPLATE_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <Field label="Estimated Minutes" value={form.estimatedMinutes?.toString() ?? ''} onChange={v => setForm(f => ({ ...f, estimatedMinutes: v ? Number(v) : undefined }))} placeholder="30" />
            <div>
              <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">Checklist Items (one per line)</label>
              <textarea value={checklistText} onChange={e => setChecklistText(e.target.value)} rows={5}
                placeholder={'Check bathroom\nReplace towels\nVacuum floor'}
                className="w-full text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: '8px', padding: '8px 12px', resize: 'vertical' }} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={submit} disabled={isPending}
                className="flex-1 h-10 rounded-lg text-sm font-600 font-display"
                style={{ background: isPending ? 'rgba(244,63,94,0.4)' : 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff' }}>
                {isPending ? 'Saving...' : editTarget ? 'Save Changes' : 'Create'}
              </button>
              <button onClick={closeModal} className="px-4 h-10 rounded-lg text-sm font-600 font-display"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Network Tab ────────────────────────────────────────────────────────────

function NetworkTab({ hotelId, token, currentChainId }: { hotelId: string; token: string; currentChainId: string | null }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(!!currentChainId);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<HotelSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [creatingChain, setCreatingChain] = useState(false);

  const { data: chains = [] } = useQuery({
    queryKey: ['admin-chains'],
    queryFn: () => adminApi.listChains(token),
  });

  const currentChain = chains.find(c => c.id === currentChainId) ?? null;

  const handleToggle = async () => {
    if (enabled && currentChainId) {
      // Detach from chain
      try {
        await adminApi.setHotelChain(token, hotelId, null);
        qc.invalidateQueries({ queryKey: ['admin-hotel', hotelId] });
        qc.invalidateQueries({ queryKey: ['admin-chains'] });
        setEnabled(false);
        toast.success('Отель отключён от сети');
      } catch { toast.error('Ошибка'); }
    } else {
      setEnabled(true);
    }
  };

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const results = await adminApi.searchHotels(token, searchQ);
      setSearchResults(results.filter(h => h.id !== hotelId));
    } catch { toast.error('Ошибка поиска'); }
    finally { setSearching(false); }
  };

  const joinChain = async (chainId: string) => {
    try {
      await adminApi.setHotelChain(token, hotelId, chainId);
      qc.invalidateQueries({ queryKey: ['admin-hotel', hotelId] });
      qc.invalidateQueries({ queryKey: ['admin-chains'] });
      toast.success('Отель добавлен в сеть');
    } catch { toast.error('Ошибка'); }
  };

  const addHotelToChain = async (targetHotelId: string, chainId: string) => {
    try {
      await adminApi.setHotelChain(token, targetHotelId, chainId);
      qc.invalidateQueries({ queryKey: ['admin-chains'] });
      toast.success('Отель добавлен в сеть');
    } catch { toast.error('Ошибка'); }
  };

  const removeHotelFromChain = async (targetHotelId: string) => {
    try {
      await adminApi.setHotelChain(token, targetHotelId, null);
      qc.invalidateQueries({ queryKey: ['admin-chains'] });
      toast.success('Отель удалён из сети');
    } catch { toast.error('Ошибка'); }
  };

  const createChain = async () => {
    if (!newChainName.trim()) return;
    setCreatingChain(true);
    try {
      const chain = await adminApi.createChain(token, newChainName.trim());
      await adminApi.setHotelChain(token, hotelId, chain.id);
      qc.invalidateQueries({ queryKey: ['admin-hotel', hotelId] });
      qc.invalidateQueries({ queryKey: ['admin-chains'] });
      setNewChainName('');
      toast.success('Сеть создана и отель добавлен');
    } catch { toast.error('Ошибка создания сети'); }
    finally { setCreatingChain(false); }
  };

  return (
    <div className="space-y-6 max-w-[600px]">
      {/* Toggle */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-600 font-display text-white">Сетевой режим</p>
            <p className="text-xs text-ink-400 mt-0.5">Объединяйте отели с одним названием в сеть</p>
          </div>
          <button
            onClick={handleToggle}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{ background: enabled ? '#F43F5E' : 'rgba(255,255,255,0.1)' }}>
            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
              style={{ transform: enabled ? 'translateX(22px)' : 'translateX(2px)' }} />
          </button>
        </div>
      </div>

      {enabled && (
        <>
          {/* Current chain info */}
          {currentChain ? (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-400 uppercase tracking-widest font-display mb-1">Текущая сеть</p>
                  <p className="font-600 text-white text-lg">{currentChain.name}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{currentChain.hotels.length} отел{currentChain.hotels.length === 1 ? 'ь' : currentChain.hotels.length < 5 ? 'я' : 'ей'} в сети</p>
                </div>
              </div>

              {/* Hotels in chain */}
              <div className="space-y-2">
                {currentChain.hotels.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <p className="text-sm font-600 text-white">{h.name}</p>
                      <p className="text-xs text-ink-400">{h.location ?? h.slug}</p>
                    </div>
                    {h.id !== hotelId && (
                      <button onClick={() => removeHotelFromChain(h.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded"
                        style={{ background: 'rgba(244,63,94,0.1)' }}>
                        Удалить
                      </button>
                    )}
                    {h.id === hotelId && (
                      <span className="text-xs text-ink-500 px-2 py-1">текущий</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Search to add hotels */}
              <div>
                <p className="text-xs text-ink-400 uppercase tracking-widest font-display mb-2">Добавить отель в сеть</p>
                <div className="flex gap-2">
                  <input
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Поиск по названию..."
                    className="flex-1"
                  />
                  <button onClick={handleSearch} disabled={searching}
                    className="px-4 py-2 rounded-lg text-sm font-600 font-display transition-all"
                    style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.3)' }}>
                    {searching ? '...' : 'Найти'}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {searchResults.map(h => (
                      <div key={h.id} className="flex items-center justify-between p-3 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div>
                          <p className="text-sm font-600 text-white">{h.name}</p>
                          <p className="text-xs text-ink-400">{h.location ?? h.slug}</p>
                          {h.chainId && h.chainId !== currentChain.id && (
                            <p className="text-xs text-amber-400 mt-0.5">Уже в другой сети</p>
                          )}
                          {h.chainId === currentChain.id && (
                            <p className="text-xs text-emerald-400 mt-0.5">Уже в этой сети</p>
                          )}
                        </div>
                        {h.chainId !== currentChain.id && (
                          <button onClick={() => addHotelToChain(h.id, currentChain.id)}
                            className="text-xs font-600 px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff' }}>
                            + Добавить
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* No chain yet — create or join */
            <div className="space-y-4">
              {/* Create new chain */}
              <div className="card p-6 space-y-3">
                <p className="font-600 font-display text-white">Создать новую сеть</p>
                <p className="text-xs text-ink-400">Введите название сети и этот отель станет первым участником</p>
                <div className="flex gap-2">
                  <input
                    value={newChainName}
                    onChange={e => setNewChainName(e.target.value)}
                    placeholder="Название сети (напр. Hilton Ukraine)"
                    className="flex-1"
                  />
                  <button onClick={createChain} disabled={creatingChain || !newChainName.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-600 font-display transition-all"
                    style={{ background: 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff', opacity: creatingChain || !newChainName.trim() ? 0.5 : 1 }}>
                    {creatingChain ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </div>

              {/* Join existing chain */}
              {chains.length > 0 && (
                <div className="card p-6 space-y-3">
                  <p className="font-600 font-display text-white">Присоединиться к существующей сети</p>
                  <div className="space-y-2">
                    {chains.map(chain => (
                      <div key={chain.id} className="flex items-center justify-between p-3 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div>
                          <p className="text-sm font-600 text-white">{chain.name}</p>
                          <p className="text-xs text-ink-400">{chain.hotels.length} отел{chain.hotels.length === 1 ? 'ь' : chain.hotels.length < 5 ? 'я' : 'ей'}</p>
                        </div>
                        <button onClick={() => joinChain(chain.id)}
                          className="text-xs font-600 px-3 py-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.3)' }}>
                          Войти в сеть
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-600 uppercase tracking-widest text-ink-300 mb-2 font-display">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}

function SaveBtn({ saving, label = 'Save Changes' }: { saving: boolean; label?: string }) {
  return (
    <button type="submit" disabled={saving}
      className="h-10 px-5 rounded-lg text-sm font-600 font-display transition-all"
      style={{ background: saving ? 'rgba(244,63,94,0.4)' : 'linear-gradient(135deg, #F43F5E, #FF6B8A)', color: '#fff', boxShadow: saving ? 'none' : '0 0 16px rgba(244,63,94,0.2)' }}>
      {saving ? 'Saving...' : label}
    </button>
  );
}
