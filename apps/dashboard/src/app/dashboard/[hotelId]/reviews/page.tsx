'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

const RATING_FILTERS = [
  { value: 0, key: 'reviews.all' },
  { value: 5, label: '★★★★★' },
  { value: 4, label: '★★★★' },
  { value: 3, label: '★★★' },
  { value: 2, label: '★★' },
  { value: 1, label: '★' },
];

export default function ReviewsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [page, setPage] = useState(1);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', hotelId, rating, page],
    queryFn: () => dashboardApi.getReviews(hotelId, token!, { rating: rating || undefined, page, limit: LIMIT }),
    enabled: !!token,
  });

  const replyMut = useMutation({
    mutationFn: ({ reviewId, reply }: { reviewId: string; reply: string }) =>
      dashboardApi.replyReview(hotelId, reviewId, reply, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', hotelId] });
      setReplyingId(null);
      setReplyText('');
    },
  });

  const stats = data?.stats;
  const distribution = stats?.distribution as Record<string, number> | undefined;

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title={t('reviews.title')}
        subtitle={t('reviews.subtitle', { n: stats?.totalReviews ?? 0, avg: stats?.avgRating ?? '—' })}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Avg Rating card */}
        <div className="card p-5 col-span-1 flex flex-col items-center justify-center">
          <span className="text-3xl font-700 num" style={{ color: '#F0A500' }}>{stats?.avgRating ?? '—'}</span>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(s => (
              <span key={s} className="text-sm" style={{ color: s <= Math.round(stats?.avgRating ?? 0) ? '#F0A500' : '#334155' }}>★</span>
            ))}
          </div>
          <span className="text-xs text-ink-500 mt-1">{stats?.totalReviews ?? 0} reviews</span>
        </div>

        {/* Distribution */}
        <div className="card p-5 col-span-3">
          <h3 className="text-xs text-ink-400 uppercase tracking-wider mb-3 font-display">{t('reviews.distribution')}</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(r => {
              const count = distribution?.[r] ?? 0;
              const total = stats?.totalReviews || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={r} className="flex items-center gap-3">
                  <span className="text-xs text-ink-300 w-14 text-right num">{r} star{r > 1 ? 's' : ''}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: r >= 4 ? '#10B981' : r === 3 ? '#F0A500' : '#EF4444' }} />
                  </div>
                  <span className="text-xs text-ink-500 w-10 num">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Rating filter pills */}
      <div className="flex gap-1.5 mb-5">
        {RATING_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { setRating(f.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg text-xs font-600 font-display transition-all"
            style={{
              background: rating === f.value ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
              color: rating === f.value ? '#F0A500' : '#64748B',
              border: `1px solid ${rating === f.value ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
            }}
          >
            {f.label || t(f.key!)}
          </button>
        ))}
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 shimmer rounded-xl" />)
        ) : !data?.reviews?.length ? (
          <div className="card flex items-center justify-center h-40 text-ink-500 text-sm">
            {t('reviews.noReviews')}
          </div>
        ) : (
          data.reviews.map((r: {
            id: string;
            guestName: string;
            guestEmail?: string;
            rating: number;
            comment?: string;
            categories?: Record<string, number>;
            isPublic: boolean;
            managerReply?: string;
            repliedAt?: string;
            createdAt: string;
          }) => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-700 shrink-0"
                  style={{ background: 'rgba(240,165,0,0.1)', color: '#F0A500', fontFamily: 'var(--font-syne)' }}>
                  {r.guestName[0]}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-600 text-white">{r.guestName}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <span key={s} className="text-xs" style={{ color: s <= r.rating ? '#F0A500' : '#334155' }}>★</span>
                      ))}
                    </div>
                    {!r.isPublic && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: '#818CF8' }}>Private</span>
                    )}
                    <span className="text-xs text-ink-500 num ml-auto">{formatDate(r.createdAt)}</span>
                  </div>

                  {/* Comment */}
                  {r.comment && <p className="text-sm text-ink-300 mb-2">{r.comment}</p>}

                  {/* Category ratings */}
                  {r.categories && Object.keys(r.categories).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {Object.entries(r.categories).map(([cat, val]) => (
                        <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                          {cat}: {String(val)}/5
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Manager reply */}
                  {r.managerReply && (
                    <div className="mt-2 p-3 rounded-lg" style={{ background: 'rgba(16,185,129,0.06)', borderLeft: '2px solid rgba(16,185,129,0.3)' }}>
                      <span className="text-[10px] text-teal font-600 uppercase tracking-wider">{t('reviews.replied')}</span>
                      <p className="text-sm text-ink-300 mt-1">{r.managerReply}</p>
                      {r.repliedAt && <span className="text-[10px] text-ink-500 num">{formatDate(r.repliedAt)}</span>}
                    </div>
                  )}

                  {/* Reply form */}
                  {!r.managerReply && replyingId !== r.id && (
                    <button
                      onClick={() => { setReplyingId(r.id); setReplyText(''); }}
                      className="text-xs font-600 mt-2 transition-colors"
                      style={{ color: '#F0A500' }}
                    >
                      {t('reviews.reply')}
                    </button>
                  )}

                  {replyingId === r.id && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder={t('reviews.replyPlaceholder')}
                        className="flex-1 text-xs"
                        style={{ padding: '6px 10px' }}
                        onKeyDown={e => {
                          if (e.key === 'Escape') setReplyingId(null);
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => { if (replyText.trim()) replyMut.mutate({ reviewId: r.id, reply: replyText.trim() }); }}
                        disabled={replyMut.isPending || !replyText.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-600 transition-all disabled:opacity-40"
                        style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500' }}
                      >
                        {t('reviews.send')}
                      </button>
                      <button
                        onClick={() => setReplyingId(null)}
                        className="px-2 py-1.5 text-xs text-ink-500 hover:text-ink-300 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
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
    </div>
  );
}
