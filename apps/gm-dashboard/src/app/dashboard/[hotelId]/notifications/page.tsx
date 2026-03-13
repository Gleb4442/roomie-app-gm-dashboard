'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardAuth } from '@/contexts/DashboardAuthContext';
import { dashboardApi } from '@/lib/api/dashboard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

const STAGE_OPTIONS = [
  { value: '', label: 'All Guests' },
  { value: 'PRE_ARRIVAL', label: 'Pre-Arrival' },
  { value: 'CHECKED_IN', label: 'Checked In' },
  { value: 'IN_STAY', label: 'In Stay' },
  { value: 'CHECKOUT', label: 'Checkout' },
  { value: 'POST_STAY', label: 'Post-Stay' },
  { value: 'BETWEEN_STAYS', label: 'Between Stays' },
];

type TargetType = 'individual' | 'all' | 'stage';

export default function NotificationsPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = use(params);
  const { token } = useDashboardAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [guestId, setGuestId] = useState('');
  const [targetStage, setTargetStage] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const LIMIT = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['notification-history', hotelId, page],
    queryFn: () => dashboardApi.getNotificationHistory(hotelId, token!, { page, limit: LIMIT }),
    enabled: !!token,
  });

  const sendMut = useMutation({
    mutationFn: () => {
      if (targetType === 'individual') {
        return dashboardApi.sendNotification(hotelId, token!, { title, body, guestId });
      }
      return dashboardApi.broadcastNotification(hotelId, token!, {
        title,
        body,
        targetStage: targetType === 'stage' ? targetStage : undefined,
      });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['notification-history', hotelId] });
      setTitle('');
      setBody('');
      setGuestId('');
      setTargetStage('');
      setShowCompose(false);
      setSuccessMsg(t('notifications.sentTo', { n: result?.sentCount ?? 0 }));
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  const TARGET_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    individual: { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6', label: t('notifications.individual') },
    stage: { bg: 'rgba(99,102,241,0.1)', color: '#818CF8', label: t('notifications.byStage') },
    all: { bg: 'rgba(16,185,129,0.1)', color: '#10B981', label: t('notifications.allGuests') },
  };

  return (
    <div className="p-6 max-w-[1200px] animate-fade-in">
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle', { n: data?.total ?? 0 })}
        actions={
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="px-4 py-2 rounded-xl text-xs font-700 font-display transition-all"
            style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.2)' }}
          >
            + {t('notifications.compose')}
          </button>
        }
      />

      {/* Success toast */}
      {successMsg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-600 animate-fade-in" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.15)' }}>
          {successMsg}
        </div>
      )}

      {/* Compose panel */}
      {showCompose && (
        <div className="card p-5 mb-6 animate-fade-in">
          <h3 className="text-sm font-700 text-white font-display mb-4">{t('notifications.compose')}</h3>

          <div className="space-y-4">
            {/* Target type selector */}
            <div>
              <label className="text-xs text-ink-400 mb-2 block">{t('notifications.target')}</label>
              <div className="flex gap-2">
                {(['all', 'stage', 'individual'] as TargetType[]).map(tt => (
                  <button
                    key={tt}
                    onClick={() => setTargetType(tt)}
                    className="px-3 py-1.5 rounded-lg text-xs font-600 transition-all"
                    style={{
                      background: targetType === tt ? 'rgba(240,165,0,0.12)' : 'rgba(255,255,255,0.04)',
                      color: targetType === tt ? '#F0A500' : '#64748B',
                      border: `1px solid ${targetType === tt ? 'rgba(240,165,0,0.2)' : 'transparent'}`,
                    }}
                  >
                    {tt === 'all' && t('notifications.allGuests')}
                    {tt === 'stage' && t('notifications.byStage')}
                    {tt === 'individual' && t('notifications.individual')}
                  </button>
                ))}
              </div>
            </div>

            {/* Stage selector */}
            {targetType === 'stage' && (
              <div>
                <label className="text-xs text-ink-400 mb-1 block">{t('notifications.stage')}</label>
                <select
                  value={targetStage}
                  onChange={e => setTargetStage(e.target.value)}
                  className="w-full max-w-xs"
                  style={{ padding: '8px 12px' }}
                >
                  {STAGE_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Guest ID input */}
            {targetType === 'individual' && (
              <div>
                <label className="text-xs text-ink-400 mb-1 block">{t('notifications.guestId')}</label>
                <input
                  value={guestId}
                  onChange={e => setGuestId(e.target.value)}
                  placeholder={t('notifications.guestIdPlaceholder')}
                  className="w-full max-w-md"
                  style={{ padding: '8px 12px' }}
                />
              </div>
            )}

            {/* Title */}
            <div>
              <label className="text-xs text-ink-400 mb-1 block">{t('notifications.titleLabel')}</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t('notifications.titlePlaceholder')}
                className="w-full"
                style={{ padding: '8px 12px' }}
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-xs text-ink-400 mb-1 block">{t('notifications.bodyLabel')}</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={t('notifications.bodyPlaceholder')}
                rows={3}
                className="w-full"
                style={{ padding: '8px 12px' }}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => sendMut.mutate()}
                disabled={sendMut.isPending || !title.trim() || !body.trim() || (targetType === 'individual' && !guestId.trim())}
                className="px-5 py-2 rounded-xl text-xs font-700 font-display transition-all disabled:opacity-40"
                style={{ background: 'rgba(240,165,0,0.12)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.2)' }}
              >
                {sendMut.isPending ? t('notifications.sending') : t('notifications.send')}
              </button>
              <button
                onClick={() => setShowCompose(false)}
                className="px-4 py-2 text-xs text-ink-400 hover:text-white transition-colors"
              >
                {t('notifications.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <h3 className="text-xs text-ink-400 uppercase tracking-wider font-display">{t('notifications.history')}</h3>

        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 shimmer rounded-xl" />)
        ) : !data?.logs?.length ? (
          <div className="card flex items-center justify-center h-32 text-ink-500 text-sm">
            {t('notifications.noHistory')}
          </div>
        ) : (
          data.logs.map((log: {
            id: string;
            title: string;
            body: string;
            targetType: string;
            targetStage?: string;
            guestName?: string;
            sentCount: number;
            createdAt: string;
          }) => {
            const tc = TARGET_COLORS[log.targetType] || TARGET_COLORS.all;
            return (
              <div key={log.id} className="card p-4">
                <div className="flex items-start gap-3">
                  {/* Bell icon */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(240,165,0,0.08)' }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#F0A500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-600 text-white">{log.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-600" style={{ background: tc.bg, color: tc.color }}>
                        {log.targetType === 'stage' ? log.targetStage?.replace('_', ' ') : tc.label}
                      </span>
                    </div>
                    <p className="text-xs text-ink-400 truncate">{log.body}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-ink-500">
                      {log.guestName && <span>👤 {log.guestName}</span>}
                      <span className="num">{t('notifications.sentTo', { n: log.sentCount })}</span>
                      <span className="num">{formatDate(log.createdAt)}</span>
                    </div>
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
    </div>
  );
}
