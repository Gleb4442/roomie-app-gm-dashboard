'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { StageBadge } from '@/components/ui/StageBadge';
import { formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import Link from 'next/link';

export default function GuestDetailPage({ params }: { params: Promise<{ hotelId: string; guestId: string }> }) {
  const { hotelId, guestId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [newTag, setNewTag] = useState('');
  const [showPush, setShowPush] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushSent, setPushSent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['guest-detail', hotelId, guestId],
    queryFn: () => dashboardApi.getGuestDetail(hotelId, guestId, token!),
    enabled: !!token,
  });

  const addTagMut = useMutation({
    mutationFn: (tag: string) => dashboardApi.addGuestTag(hotelId, guestId, tag, token!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guest-detail', hotelId, guestId] }); setNewTag(''); },
  });

  const removeTagMut = useMutation({
    mutationFn: (tagId: string) => dashboardApi.removeGuestTag(hotelId, guestId, tagId, token!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guest-detail', hotelId, guestId] }),
  });

  const pushMut = useMutation({
    mutationFn: (d: { title: string; body: string }) => dashboardApi.sendNotification(hotelId, token!, { ...d, guestId }),
    onSuccess: () => { setPushTitle(''); setPushBody(''); setPushSent(true); setTimeout(() => setPushSent(false), 3000); setShowPush(false); },
  });

  if (isLoading) {
    return <div className="p-6 max-w-[1000px] animate-fade-in"><div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 shimmer rounded-xl" />)}</div></div>;
  }

  if (!data) return null;

  const { guest, currentStay, stays, orders, serviceRequests, reviews, offers } = data;
  const profile = guest.guestProfile;
  const loyalty = guest.loyaltyAccounts?.[0];
  const isCheckedIn = !!currentStay;

  return (
    <div className="p-6 max-w-[1000px] animate-fade-in">
      {/* Back link */}
      <Link href={`/dashboard/${hotelId}/guests`} className="text-xs text-ink-400 hover:text-white transition-colors mb-4 inline-flex items-center gap-1">
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        {t('guests.title')}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-5 mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-700 shrink-0"
          style={{ background: isCheckedIn ? 'rgba(16,185,129,0.12)' : 'rgba(240,165,0,0.1)', color: isCheckedIn ? '#10B981' : '#F0A500', fontFamily: 'var(--font-syne)' }}>
          {guest.firstName[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-700 text-white font-display">{guest.firstName} {guest.lastName || ''}</h1>
          <div className="flex items-center gap-3 text-xs text-ink-400 mt-1">
            {guest.phone && <span className="num">{guest.phone}</span>}
            {guest.email && <span>{guest.email}</span>}
            <span>ID: {guest.id.slice(0, 8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isCheckedIn && currentStay && (
            <div className="card px-4 py-3">
              <StageBadge stage={currentStay.stage} />
              <p className="text-xs text-ink-300 mt-1 num">Rm #{currentStay.roomNumber}</p>
            </div>
          )}
          <button
            onClick={() => setShowPush(!showPush)}
            className="p-2.5 rounded-xl transition-all"
            style={{ background: showPush ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${showPush ? 'rgba(240,165,0,0.2)' : 'transparent'}` }}
            title="Send push notification"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={showPush ? '#F0A500' : '#64748B'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Push notification quick send */}
      {pushSent && (
        <div className="mb-4 px-4 py-2 rounded-xl text-xs font-600 animate-fade-in" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
          ✓ Notification sent
        </div>
      )}
      {showPush && (
        <div className="card p-4 mb-5 animate-fade-in">
          <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-3 font-display">Send Push Notification</h3>
          <div className="space-y-2">
            <input
              value={pushTitle}
              onChange={e => setPushTitle(e.target.value)}
              placeholder="Title..."
              className="w-full text-xs"
              style={{ padding: '6px 10px' }}
            />
            <textarea
              value={pushBody}
              onChange={e => setPushBody(e.target.value)}
              placeholder="Message..."
              rows={2}
              className="w-full text-xs"
              style={{ padding: '6px 10px' }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { if (pushTitle.trim() && pushBody.trim()) pushMut.mutate({ title: pushTitle.trim(), body: pushBody.trim() }); }}
                disabled={pushMut.isPending || !pushTitle.trim() || !pushBody.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-600 transition-all disabled:opacity-40"
                style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500' }}
              >
                {pushMut.isPending ? 'Sending...' : 'Send'}
              </button>
              <button onClick={() => setShowPush(false)} className="px-3 py-1.5 text-xs text-ink-500 hover:text-ink-300 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Left column — Profile + Tags */}
        <div className="col-span-1 space-y-4">
          {/* Profile card */}
          <div className="card p-4">
            <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-3 font-display">{t('guestDetail.profile')}</h3>
            <div className="space-y-2 text-sm">
              {profile?.gender && <InfoRow label="Gender" value={profile.gender} />}
              {profile?.ageRange && <InfoRow label="Age" value={profile.ageRange} />}
              {profile?.country && <InfoRow label="Location" value={`${profile.city || ''} ${profile.country}`} />}
              {profile?.budget && <InfoRow label="Budget" value={profile.budget} />}
              {profile?.travelStyle && <InfoRow label="Style" value={profile.travelStyle} />}
              {profile?.totalBookings > 0 && <InfoRow label="Bookings" value={String(profile.totalBookings)} />}
              {profile?.totalSpent > 0 && <InfoRow label="Total Spent" value={`$${profile.totalSpent.toFixed(0)}`} />}
              {profile?.avgStayNights > 0 && <InfoRow label="Avg Stay" value={`${profile.avgStayNights.toFixed(1)} nights`} />}
              {profile?.favoriteRoomType && <InfoRow label="Fav Room" value={profile.favoriteRoomType} />}
              <InfoRow label="Language" value={guest.language || 'uk'} />
              <InfoRow label="Joined" value={formatDate(guest.createdAt)} />
            </div>
            {profile?.interests?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {profile.interests.map((i: string) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}>{i}</span>
                ))}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="card p-4">
            <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-3 font-display">{t('guestDetail.tags')}</h3>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {guest.tags?.map((tag: { id: string; tag: string; source: string }) => (
                <span key={tag.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ background: tag.source === 'auto' ? 'rgba(16,185,129,0.1)' : 'rgba(240,165,0,0.1)', color: tag.source === 'auto' ? '#10B981' : '#F0A500' }}>
                  {tag.tag}
                  <button onClick={() => removeTagMut.mutate(tag.id)} className="hover:opacity-70 text-[10px]">x</button>
                </span>
              ))}
            </div>
            <form onSubmit={e => { e.preventDefault(); if (newTag.trim()) addTagMut.mutate(newTag.trim()); }} className="flex gap-1.5">
              <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder={t('guestDetail.addTag')} className="flex-1 text-xs" style={{ padding: '6px 10px' }} />
              <button type="submit" className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500' }}>+</button>
            </form>
          </div>

          {/* Loyalty */}
          {loyalty && (
            <div className="card p-4">
              <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-2 font-display">{t('guestDetail.loyalty')}</h3>
              <div className="flex items-center gap-3">
                <span className="text-lg font-700 num" style={{ color: '#F0A500' }}>{loyalty.nightsThisYear}</span>
                <span className="text-xs text-ink-400">nights/year</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-600"
                  style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500' }}>{loyalty.tier}</span>
              </div>
              <p className="text-xs text-ink-500 mt-1">Total: {loyalty.totalNights} nights</p>
            </div>
          )}
        </div>

        {/* Right column — Current stay, history, orders */}
        <div className="col-span-2 space-y-4">
          {/* Current Stay or Not Checked In */}
          <div className="card p-5">
            <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-3 font-display">{t('guestDetail.currentStay')}</h3>
            {currentStay ? (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <StageBadge stage={currentStay.stage} />
                    {currentStay.subStage && <span className="text-xs text-ink-500">{currentStay.subStage}</span>}
                  </div>
                  <p className="text-sm text-ink-200">Room <strong className="text-white">#{currentStay.roomNumber}</strong> · {currentStay.roomType || 'Standard'}</p>
                  <p className="text-xs text-ink-400 mt-1 num">{formatDate(currentStay.checkIn)} — {formatDate(currentStay.checkOut)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-700 num text-teal">${Number(currentStay.totalSpentDuringStay).toFixed(0)}</p>
                  <p className="text-xs text-ink-400">spent this stay</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-500">{t('guestDetail.notCheckedIn')}</p>
            )}
          </div>

          {/* Active Offers */}
          {offers?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-3 font-display">{t('guestDetail.offers')}</h3>
              <div className="space-y-2">
                {offers.map((o: { id: string; title: string; discountValue: number; discountType: string; status: string; validUntil: string }) => (
                  <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(240,165,0,0.06)', border: '1px solid rgba(240,165,0,0.1)' }}>
                    <span className="text-sm font-600 text-white flex-1">{o.title}</span>
                    <span className="num text-sm font-700" style={{ color: '#F0A500' }}>
                      {o.discountType === 'percent' ? `${o.discountValue}%` : `$${o.discountValue}`}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-600" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>{o.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stay History */}
          <div className="card p-5">
            <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-3 font-display">{t('guestDetail.stayHistory')}</h3>
            {stays?.length === 0 ? (
              <p className="text-sm text-ink-500">{t('guestDetail.noStays')}</p>
            ) : (
              <div className="space-y-2">
                {stays.map((s: { id: string; bookingRef: string; roomNumber: string; stage: string; checkIn: string; checkOut: string; source: string; totalSpentDuringStay: number; preCheckinCompleted: boolean }) => (
                  <div key={s.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <span className="text-xs text-amber-400 num font-600 w-20 shrink-0">{s.bookingRef || '—'}</span>
                    <span className="text-xs text-white font-600 w-12">#{s.roomNumber || '—'}</span>
                    <StageBadge stage={s.stage} />
                    <span className="text-xs text-ink-400 num flex-1">{formatDate(s.checkIn)} — {formatDate(s.checkOut)}</span>
                    <span className="text-xs text-ink-500 capitalize">{s.source}</span>
                    <span className="text-xs num font-600" style={{ color: Number(s.totalSpentDuringStay) > 0 ? '#10B981' : '#64748B' }}>
                      ${Number(s.totalSpentDuringStay).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="card p-5">
            <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-3 font-display">{t('guestDetail.recentOrders')}</h3>
            {orders?.length === 0 ? (
              <p className="text-sm text-ink-500">{t('guestDetail.noOrders')}</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o: { id: string; orderNumber: string; type: string; status: string; subtotal: number; currency: string; rating: number | null; createdAt: string }) => (
                  <div key={o.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <span className="text-xs num text-ink-300 font-600">#{o.orderNumber}</span>
                    <span className="text-xs text-ink-400 capitalize">{o.type.toLowerCase()}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>{o.status}</span>
                    <span className="flex-1" />
                    {o.rating && <span className="text-xs text-amber-400">{'★'.repeat(o.rating)}</span>}
                    <span className="num text-sm font-600 text-white">{Number(o.subtotal).toFixed(0)} {o.currency}</span>
                    <span className="text-xs text-ink-500 num">{formatDate(o.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Service Requests */}
          <div className="card p-5">
            <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-3 font-display">{t('guestDetail.recentRequests')}</h3>
            {serviceRequests?.length === 0 ? (
              <p className="text-sm text-ink-500">{t('guestDetail.noRequests')}</p>
            ) : (
              <div className="space-y-2">
                {serviceRequests.map((r: { id: string; category?: { name: string; icon: string }; status: string; totalAmount: number; rating: number | null; createdAt: string; comment?: string }) => (
                  <div key={r.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <span className="text-base">{r.category?.icon || '🔔'}</span>
                    <span className="text-xs text-white font-500">{r.category?.name || 'Request'}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-600" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>{r.status}</span>
                    <span className="flex-1 text-xs text-ink-500 truncate">{r.comment}</span>
                    {r.rating && <span className="text-xs text-amber-400">{'★'.repeat(r.rating)}</span>}
                    <span className="num text-xs text-ink-300">{formatDate(r.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-xs text-ink-200 font-500">{value}</span>
    </div>
  );
}
