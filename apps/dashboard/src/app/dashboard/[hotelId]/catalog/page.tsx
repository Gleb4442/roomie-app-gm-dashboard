'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi, type ServiceCategoryFull, type ServiceItemFull } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useI18n } from '@/lib/i18n';

export default function CatalogPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editingCat, setEditingCat] = useState<Partial<ServiceCategoryFull> | null>(null);
  const [editingItem, setEditingItem] = useState<{ catId: string; item: Partial<ServiceItemFull> } | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['service-catalog', hotelId],
    queryFn: () => dashboardApi.getServiceCatalog(hotelId, token!),
    enabled: !!token,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['service-catalog', hotelId] });

  const saveCatMut = useMutation({
    mutationFn: (cat: Partial<ServiceCategoryFull>) =>
      cat.id
        ? dashboardApi.updateServiceCategory(hotelId, cat.id, token!, cat)
        : dashboardApi.createServiceCategory(hotelId, token!, cat),
    onSuccess: () => { invalidate(); setEditingCat(null); },
  });

  const deleteCatMut = useMutation({
    mutationFn: (catId: string) => dashboardApi.deleteServiceCategory(hotelId, catId, token!),
    onSuccess: invalidate,
  });

  const saveItemMut = useMutation({
    mutationFn: ({ catId, item }: { catId: string; item: Partial<ServiceItemFull> }) =>
      item.id
        ? dashboardApi.updateServiceItem(hotelId, catId, item.id, token!, item)
        : dashboardApi.createServiceItem(hotelId, catId, token!, item),
    onSuccess: () => { invalidate(); setEditingItem(null); },
  });

  const deleteItemMut = useMutation({
    mutationFn: ({ catId, itemId }: { catId: string; itemId: string }) =>
      dashboardApi.deleteServiceItem(hotelId, catId, itemId, token!),
    onSuccess: invalidate,
  });

  return (
    <div className="p-6 max-w-[1000px] animate-fade-in">
      <PageHeader
        title={t('catalog.title')}
        subtitle={t('catalog.subtitle', { n: categories?.length ?? 0 })}
        actions={
          <button
            onClick={() => setEditingCat({ name: '', slug: '', icon: '', sortOrder: 0 })}
            className="px-4 py-2 rounded-lg text-xs font-600 font-display transition-all"
            style={{ background: '#F0A500', color: '#000' }}
          >
            + {t('catalog.addCategory')}
          </button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 shimmer rounded-xl" />)}
        </div>
      ) : !categories?.length ? (
        <div className="card flex items-center justify-center h-40 text-ink-500 text-sm">{t('catalog.noCategories')}</div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => (
            <div key={cat.id} className="card overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-xl">{cat.icon || '📋'}</span>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-600 text-white">{cat.name}</span>
                    {!cat.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-600" style={{ background: 'rgba(100,116,139,0.15)', color: '#94A3B8' }}>
                        {t('catalog.inactive')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-400 mt-0.5">
                    <span>{t('catalog.items', { n: cat.items.length })}</span>
                    <span>{t('catalog.requests', { n: cat._count.requests })}</span>
                    {cat.autoAccept && <span className="text-teal">Auto-accept</span>}
                    {cat.estimatedMinutes && <span>~{cat.estimatedMinutes}min</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingCat(cat); }}
                    className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}
                  >
                    Edit
                  </button>
                  <svg
                    width="14" height="14" fill="none" viewBox="0 0 24 24"
                    stroke="#64748B" strokeWidth="2"
                    className="transition-transform"
                    style={{ transform: expandedCat === cat.id ? 'rotate(180deg)' : '' }}
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </div>
              </button>

              {/* Items list */}
              {expandedCat === cat.id && (
                <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {cat.items.length === 0 ? (
                    <div className="px-5 py-6 text-center text-ink-500 text-xs">{t('catalog.noItems')}</div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      {cat.items.map(item => (
                        <div key={item.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.01] transition-colors">
                          {/* Photo or icon */}
                          {item.photoUrl ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0"
                              style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                              <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0"
                              style={{ background: 'rgba(255,255,255,0.04)' }}>
                              {item.icon || '•'}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white font-500">{item.name}</span>
                              {!item.isActive && (
                                <span className="text-[10px] px-1 rounded" style={{ background: 'rgba(100,116,139,0.15)', color: '#94A3B8' }}>off</span>
                              )}
                            </div>
                            {item.description && <p className="text-xs text-ink-400 truncate">{item.description}</p>}
                          </div>
                          <span className="num text-sm font-600 shrink-0" style={{ color: item.price > 0 ? '#10B981' : '#64748B' }}>
                            {item.price > 0 ? `${item.price} ${item.currency}` : 'Free'}
                          </span>
                          <button
                            onClick={() => setEditingItem({ catId: cat.id, item })}
                            className="text-xs text-ink-400 hover:text-white transition-colors px-2 py-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteItemMut.mutate({ catId: cat.id, itemId: item.id })}
                            className="text-xs text-ink-500 hover:text-rose transition-colors px-1 py-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    <button
                      onClick={() => setEditingItem({ catId: cat.id, item: { name: '', price: 0, currency: 'UAH', sortOrder: 0 } })}
                      className="text-xs font-600 transition-colors"
                      style={{ color: '#F0A500' }}
                    >
                      + {t('catalog.addItem')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Category modal */}
      {editingCat && (
        <CategoryModal
          cat={editingCat}
          onSave={c => saveCatMut.mutate(c)}
          onDelete={editingCat.id ? () => { deleteCatMut.mutate(editingCat.id!); setEditingCat(null); } : undefined}
          onClose={() => setEditingCat(null)}
          saving={saveCatMut.isPending}
          t={t}
        />
      )}

      {/* Item modal */}
      {editingItem && (
        <ItemModal
          item={editingItem.item}
          onSave={item => saveItemMut.mutate({ catId: editingItem.catId, item })}
          onClose={() => setEditingItem(null)}
          saving={saveItemMut.isPending}
          t={t}
        />
      )}
    </div>
  );
}

// ── Category Edit Modal ──────────────────────────────────────

function CategoryModal({
  cat, onSave, onDelete, onClose, saving, t,
}: {
  cat: Partial<ServiceCategoryFull>;
  onSave: (c: Partial<ServiceCategoryFull>) => void;
  onDelete?: () => void;
  onClose: () => void;
  saving: boolean;
  t: (k: string) => string;
}) {
  const [form, setForm] = useState(cat);
  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="rounded-xl p-6 w-[480px] max-h-[85vh] overflow-y-auto" style={{ background: '#1C2230', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-700 text-white mb-4 font-display">{form.id ? t('catalog.editCategory') : t('catalog.addCategory')}</h3>

        <div className="space-y-3">
          <ModalField label={t('catalog.name')}>
            <input value={form.name ?? ''} onChange={e => set('name', e.target.value)} className="w-full text-sm" style={{ padding: '8px 12px' }} />
          </ModalField>
          <ModalField label={t('catalog.slug')}>
            <input value={form.slug ?? ''} onChange={e => set('slug', e.target.value)} className="w-full text-sm" style={{ padding: '8px 12px' }} />
          </ModalField>
          <div className="grid grid-cols-2 gap-3">
            <ModalField label={t('catalog.icon')}>
              <input value={form.icon ?? ''} onChange={e => set('icon', e.target.value)} className="w-full text-sm" style={{ padding: '8px 12px' }} placeholder="🍽️" />
            </ModalField>
            <ModalField label={t('catalog.estimatedMinutes')}>
              <input type="number" value={form.estimatedMinutes ?? ''} onChange={e => set('estimatedMinutes', parseInt(e.target.value) || null)} className="w-full text-sm" style={{ padding: '8px 12px' }} />
            </ModalField>
          </div>
          <ModalField label={t('catalog.description')}>
            <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={2} className="w-full text-sm resize-none" style={{ padding: '8px 12px' }} />
          </ModalField>
          <div className="flex flex-wrap gap-4 py-2">
            <ToggleSmall label={t('catalog.requiresRoom')} checked={form.requiresRoom ?? true} onChange={v => set('requiresRoom', v)} />
            <ToggleSmall label={t('catalog.requiresTimeSlot')} checked={form.requiresTimeSlot ?? false} onChange={v => set('requiresTimeSlot', v)} />
            <ToggleSmall label={t('catalog.autoAccept')} checked={form.autoAccept ?? false} onChange={v => set('autoAccept', v)} />
            <ToggleSmall label={t('catalog.active')} checked={form.isActive ?? true} onChange={v => set('isActive', v)} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5">
          {onDelete && (
            <button onClick={onDelete} className="px-3 py-2 rounded-lg text-xs font-600 text-rose" style={{ background: 'rgba(244,63,94,0.08)' }}>
              {t('catalog.delete')}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-600 text-ink-400" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {t('catalog.cancel')}
          </button>
          <button onClick={() => onSave(form)} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-600" style={{ background: '#F0A500', color: '#000' }}>
            {saving ? t('catalog.saving') : t('catalog.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item Edit Modal ──────────────────────────────────────────

function ItemModal({
  item, onSave, onClose, saving, t,
}: {
  item: Partial<ServiceItemFull>;
  onSave: (i: Partial<ServiceItemFull>) => void;
  onClose: () => void;
  saving: boolean;
  t: (k: string) => string;
}) {
  const [form, setForm] = useState(item);
  const set = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="rounded-xl p-6 w-[480px] max-h-[85vh] overflow-y-auto" style={{ background: '#1C2230', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-700 text-white mb-4 font-display">{form.id ? t('catalog.editItem') : t('catalog.addItem')}</h3>

        <div className="space-y-3">
          <ModalField label={t('catalog.name')}>
            <input value={form.name ?? ''} onChange={e => set('name', e.target.value)} className="w-full text-sm" style={{ padding: '8px 12px' }} />
          </ModalField>
          <ModalField label={t('catalog.description')}>
            <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={2} className="w-full text-sm resize-none" style={{ padding: '8px 12px' }} />
          </ModalField>
          <div className="grid grid-cols-3 gap-3">
            <ModalField label={t('catalog.price')}>
              <input type="number" value={form.price ?? 0} onChange={e => set('price', parseFloat(e.target.value) || 0)} className="w-full text-sm" style={{ padding: '8px 12px' }} />
            </ModalField>
            <ModalField label={t('catalog.currency')}>
              <input value={form.currency ?? 'UAH'} onChange={e => set('currency', e.target.value)} className="w-full text-sm" style={{ padding: '8px 12px' }} />
            </ModalField>
            <ModalField label={t('catalog.maxQuantity')}>
              <input type="number" value={form.maxQuantity ?? 10} onChange={e => set('maxQuantity', parseInt(e.target.value) || 1)} className="w-full text-sm" style={{ padding: '8px 12px' }} />
            </ModalField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ModalField label={t('catalog.icon')}>
              <input value={form.icon ?? ''} onChange={e => set('icon', e.target.value)} className="w-full text-sm" style={{ padding: '8px 12px' }} placeholder="🍕" />
            </ModalField>
            <ModalField label={t('catalog.photoUrl')}>
              <input value={form.photoUrl ?? ''} onChange={e => set('photoUrl', e.target.value)} className="w-full text-sm" style={{ padding: '8px 12px' }} placeholder="https://..." />
            </ModalField>
          </div>
          {form.photoUrl && (
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <img src={form.photoUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-ink-400">Preview</span>
            </div>
          )}
          <ToggleSmall label={t('catalog.active')} checked={form.isActive ?? true} onChange={v => set('isActive', v)} />
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-600 text-ink-400" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {t('catalog.cancel')}
          </button>
          <button onClick={() => onSave(form)} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-600" style={{ background: '#F0A500', color: '#000' }}>
            {saving ? t('catalog.saving') : t('catalog.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared components ────────────────────────────────────────

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-ink-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ToggleSmall({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="w-8 h-4 rounded-full transition-all relative"
        style={{ background: checked ? '#F0A500' : 'rgba(255,255,255,0.1)' }}
      >
        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: checked ? '17px' : '2px' }} />
      </button>
      <span className="text-xs text-ink-300">{label}</span>
    </label>
  );
}
