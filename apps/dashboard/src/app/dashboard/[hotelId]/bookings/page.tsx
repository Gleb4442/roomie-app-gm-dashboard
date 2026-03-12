'use client';
import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { StageBadge } from '@/components/ui/StageBadge';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

const STAGES: { value: string; key: string }[] = [
  { value: '', key: 'bookings.allStages' },
  { value: 'PRE_ARRIVAL', key: 'bookings.preArrival' },
  { value: 'IN_STAY', key: 'bookings.inStay' },
  { value: 'CHECKOUT', key: 'bookings.checkout' },
  { value: 'POST_STAY', key: 'bookings.postStay' },
];

export default function BookingsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', hotelId, stage, search, fromDate, toDate, page],
    queryFn: () => dashboardApi.getBookings(hotelId, token!, {
      stage: stage || undefined,
      search: search || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      page,
      limit: LIMIT,
    }),
    enabled: !!token,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const stats = data?.stats;

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title={t('bookings.title')}
        subtitle={t('bookings.subtitle', { n: data?.total ?? 0 })}
      />

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <StatCard label={t('bookings.preArrival')} value={stats.preArrival} color="#F59E0B" />
          <StatCard label={t('bookings.inStay')} value={stats.inStay} color="#10B981" />
          <StatCard label={t('bookings.checkout')} value={stats.checkout} color="#6366F1" />
          <StatCard label={t('bookings.postStay')} value={stats.postStay} color="#64748B" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Stage pills */}
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map(s => (
            <button
              key={s.value}
              onClick={() => { setStage(s.value); setPage(1); }}
              className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
              style={{
                background: stage === s.value ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
                color: stage === s.value ? '#F0A500' : '#64748B',
                border: `1px solid ${stage === s.value ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
              }}
            >
              {t(s.key)}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={e => { setFromDate(e.target.value); setPage(1); }}
            className="text-xs"
            style={{ padding: '6px 10px', width: '140px' }}
            placeholder={t('bookings.from')}
          />
          <span className="text-ink-500 text-xs">—</span>
          <input
            type="date"
            value={toDate}
            onChange={e => { setToDate(e.target.value); setPage(1); }}
            className="text-xs"
            style={{ padding: '6px 10px', width: '140px' }}
            placeholder={t('bookings.to')}
          />
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder={t('bookings.searchPlaceholder')}
              className="flex-1"
              style={{ padding: '8px 12px' }}
            />
            <button
              type="submit"
              className="px-4 h-9 rounded-lg text-xs font-600 font-display shrink-0 transition-colors"
              style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.2)' }}
            >
              {t('bookings.search')}
            </button>
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 shimmer rounded-lg" />
            ))}
          </div>
        ) : !data?.bookings?.length ? (
          <div className="flex items-center justify-center h-40 text-ink-500 text-sm">
            {search || stage || fromDate || toDate ? t('bookings.noBookingsMatch') : t('bookings.noBookings')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('bookings.ref')}</th>
                  <th>{t('bookings.guest')}</th>
                  <th>{t('bookings.contact')}</th>
                  <th>{t('bookings.room')}</th>
                  <th>{t('bookings.stage')}</th>
                  <th>{t('bookings.checkIn')}</th>
                  <th>{t('bookings.checkOut')}</th>
                  <th>{t('bookings.source')}</th>
                  <th>{t('bookings.spent')}</th>
                  <th>{t('bookings.preCheckin')}</th>
                </tr>
              </thead>
              <tbody>
                {data.bookings.map(booking => (
                  <tr key={booking.id}>
                    <td>
                      <span className="num font-600 text-amber-400 text-xs">{booking.bookingRef}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 shrink-0"
                          style={{ background: 'rgba(240,165,0,0.1)', color: '#F0A500', fontFamily: 'var(--font-syne)' }}>
                          {booking.guestName[0]}
                        </div>
                        <span className="font-600 text-white text-sm">{booking.guestName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="text-xs">
                        {booking.guestPhone && <div className="text-ink-200 num">{booking.guestPhone}</div>}
                        {booking.guestEmail && <div className="text-ink-400 truncate max-w-[160px]">{booking.guestEmail}</div>}
                      </div>
                    </td>
                    <td>
                      {booking.roomNumber
                        ? <span className="num font-600 text-white">#{booking.roomNumber}</span>
                        : <span className="text-ink-500">—</span>}
                    </td>
                    <td><StageBadge stage={booking.stage} /></td>
                    <td className="text-ink-300 num text-xs">{booking.checkIn ? formatDate(booking.checkIn) : '—'}</td>
                    <td className="text-ink-300 num text-xs">{booking.checkOut ? formatDate(booking.checkOut) : '—'}</td>
                    <td className="text-ink-400 text-xs capitalize">{booking.source}</td>
                    <td>
                      {booking.totalSpentDuringStay > 0
                        ? <span className="num font-600 text-teal text-xs">${booking.totalSpentDuringStay.toFixed(0)}</span>
                        : <span className="text-ink-500 text-xs">—</span>}
                    </td>
                    <td>
                      {booking.preCheckinCompleted
                        ? <span className="text-teal text-xs font-600">{t('bookings.done')}</span>
                        : <span className="text-ink-500 text-xs">{t('bookings.pending')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="px-5 pb-4">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={LIMIT}
              onPage={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-ink-400 mb-1">{label}</p>
      <p className="text-2xl font-700 font-display num" style={{ color }}>{value}</p>
    </div>
  );
}
