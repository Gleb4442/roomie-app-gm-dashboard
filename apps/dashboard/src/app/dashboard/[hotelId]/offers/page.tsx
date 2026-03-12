'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

type OfferStatus = 'all' | 'DRAFT' | 'ACTIVE' | 'SENT' | 'EXPIRED' | 'REDEEMED';

const STATUS_FILTERS: { value: OfferStatus; key: string }[] = [
  { value: 'all', key: 'offers.all' },
  { value: 'DRAFT', key: 'offers.draft' },
  { value: 'ACTIVE', key: 'offers.active' },
  { value: 'SENT', key: 'offers.sent' },
  { value: 'EXPIRED', key: 'offers.expired' },
  { value: 'REDEEMED', key: 'offers.redeemed' },
];

const DISCOUNT_TYPES = [
  { value: 'percent', key: 'offers.percent' },
  { value: 'fixed', key: 'offers.fixed' },
  { value: 'upgrade', key: 'offers.upgrade' },
  { value: 'freebie', key: 'offers.freebie' },
];

const TRIGGERS = [
  { value: '', key: 'offers.manual' },
  { value: 'post_stay', key: 'offers.postStay' },
  { value: 'inactive_30d', key: 'offers.inactive30d' },
  { value: 'birthday', key: 'offers.birthday' },
];

interface OfferForm {
  title: string;
  description: string;
  discountType: string;
  discountValue: number;
  code: string;
  validUntil: string;
  triggerRule: string;
  status: string;
  guestId: string;
}

const emptyForm: OfferForm = {
  title: '',
  description: '',
  discountType: 'percent',
  discountValue: 10,
  code: '',
  validUntil: '',
  triggerRule: '',
  status: 'DRAFT',
  guestId: '',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: 'rgba(100,116,139,0.1)', color: '#94A3B8' },
  ACTIVE: { bg: 'rgba(16,185,129,0.1)', color: '#10B981' },
  SENT: { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6' },
  VIEWED: { bg: 'rgba(99,102,241,0.1)', color: '#818CF8' },
  REDEEMED: { bg: 'rgba(240,165,0,0.1)', color: '#F0A500' },
  EXPIRED: { bg: 'rgba(239,68,68,0.1)', color: '#EF4444' },
};

export default function OffersPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [status, setStatus] = useState<OfferStatus>('all');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['offers', hotelId, status, page],
    queryFn: () => dashboardApi.getOffers(hotelId, token!, { status: status === 'all' ? undefined : status, page, limit: LIMIT }),
    enabled: !!token,
  });

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => dashboardApi.createOffer(hotelId, token!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers', hotelId] }); setModal(null); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => dashboardApi.updateOffer(hotelId, id, token!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers', hotelId] }); setModal(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dashboardApi.deleteOffer(hotelId, id, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['offers', hotelId] }),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal('create');
  };

  const openEdit = (offer: Record<string, unknown>) => {
    setForm({
      title: String(offer.title || ''),
      description: String(offer.description || ''),
      discountType: String(offer.discountType || 'percent'),
      discountValue: Number(offer.discountValue || 0),
      code: String(offer.code || ''),
      validUntil: offer.validUntil ? String(offer.validUntil).slice(0, 10) : '',
      triggerRule: String(offer.triggerRule || ''),
      status: String(offer.status || 'DRAFT'),
      guestId: String(offer.guestId || ''),
    });
    setEditId(String(offer.id));
    setModal('edit');
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      discountType: form.discountType,
      discountValue: form.discountValue,
      code: form.code || undefined,
      validUntil: form.validUntil,
      triggerRule: form.triggerRule || undefined,
      status: form.status,
    };
    if (form.guestId) payload.guestId = form.guestId;

    if (modal === 'edit' && editId) {
      updateMut.mutate({ id: editId, d: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title={t('offers.title')}
        subtitle={t('offers.subtitle', { n: data?.total ?? 0 })}
        actions={
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-xl text-xs font-700 font-display transition-all"
            style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.2)' }}
          >
            + {t('offers.create')}
          </button>
        }
      />

      {/* Status filter pills */}
      <div className="flex gap-1.5 mb-5">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setStatus(f.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
            style={{
              background: status === f.value ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
              color: status === f.value ? '#F0A500' : '#64748B',
              border: `1px solid ${status === f.value ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
            }}
          >
            {t(f.key)}
          </button>
        ))}
      </div>

      {/* Offers list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 shimmer rounded-xl" />)
        ) : !data?.offers?.length ? (
          <div className="card flex items-center justify-center h-40 text-ink-500 text-sm">
            {t('offers.noOffers')}
          </div>
        ) : (
          data.offers.map((o: {
            id: string;
            title: string;
            description: string;
            discountType: string;
            discountValue: number;
            code?: string;
            status: string;
            guestId?: string;
            guestName?: string;
            validUntil: string;
            triggerRule?: string;
            sentAt?: string;
            viewedAt?: string;
            redeemedAt?: string;
            createdAt: string;
          }) => {
            const sc = STATUS_COLORS[o.status] || STATUS_COLORS.DRAFT;
            return (
              <div key={o.id} className="card p-5">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: 'rgba(240,165,0,0.08)' }}>
                    🎁
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-600 text-white">{o.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-600" style={{ background: sc.bg, color: sc.color }}>
                        {o.status}
                      </span>
                    </div>
                    <p className="text-xs text-ink-400 truncate">{o.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-ink-500">
                      {o.guestName
                        ? <span>👤 {o.guestName}</span>
                        : <span>{t('offers.broadcastAll')}</span>}
                      {o.code && <span className="num font-600 uppercase" style={{ color: '#818CF8' }}>#{o.code}</span>}
                      {o.triggerRule && <span className="capitalize">{o.triggerRule.replace('_', ' ')}</span>}
                    </div>
                  </div>

                  {/* Discount */}
                  <div className="text-right shrink-0">
                    <span className="text-lg font-700 num" style={{ color: '#F0A500' }}>
                      {o.discountType === 'percent' ? `${o.discountValue}%` : o.discountType === 'fixed' ? `$${o.discountValue}` : o.discountType === 'upgrade' ? '↑' : '🎁'}
                    </span>
                    <p className="text-[10px] text-ink-500 num mt-0.5">until {formatDate(o.validUntil)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(o as unknown as Record<string, unknown>)}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-ink-400 hover:text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      {t('offers.edit')}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${o.title}"?`)) deleteMut.mutate(o.id); }}
                      className="px-2 py-1.5 rounded-lg text-xs text-ink-500 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            limit={LIMIT}
            onPage={setPage}
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="card w-full max-w-lg p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-700 text-white font-display mb-5">
              {modal === 'edit' ? t('offers.edit') : t('offers.create')}
            </h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs text-ink-400 mb-1 block">{t('offers.offerTitle')}</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full" style={{ padding: '8px 12px' }} />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-ink-400 mb-1 block">{t('offers.description')}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full" rows={2} style={{ padding: '8px 12px' }} />
              </div>

              {/* Discount type + value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">{t('offers.discountType')}</label>
                  <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))} className="w-full" style={{ padding: '8px 12px' }}>
                    {DISCOUNT_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{t(dt.key)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">{t('offers.discountValue')}</label>
                  <input type="number" value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))} className="w-full" style={{ padding: '8px 12px' }} />
                </div>
              </div>

              {/* Code + Valid Until */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">{t('offers.code')}</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="SUMMER2026" className="w-full" style={{ padding: '8px 12px' }} />
                </div>
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">{t('offers.validUntil')}</label>
                  <input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} className="w-full" style={{ padding: '8px 12px' }} />
                </div>
              </div>

              {/* Trigger + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">{t('offers.triggerRule')}</label>
                  <select value={form.triggerRule} onChange={e => setForm(f => ({ ...f, triggerRule: e.target.value }))} className="w-full" style={{ padding: '8px 12px' }}>
                    {TRIGGERS.map(tr => (
                      <option key={tr.value} value={tr.value}>{t(tr.key)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-ink-400 mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full" style={{ padding: '8px 12px' }}>
                    <option value="DRAFT">{t('offers.draft')}</option>
                    <option value="ACTIVE">{t('offers.active')}</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-xs text-ink-400 hover:text-white transition-colors">
                {t('offers.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.title || !form.validUntil}
                className="px-5 py-2 rounded-xl text-xs font-700 font-display transition-all disabled:opacity-40"
                style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.2)' }}
              >
                {isSaving ? t('offers.saving') : t('offers.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
