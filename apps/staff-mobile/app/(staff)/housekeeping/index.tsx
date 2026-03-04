import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyRooms, updateRoomStatus } from '../../../src/api/staffApi';
import { useAuthStore } from '../../../src/stores/authStore';
import { colors, spacing, radius } from '../../../src/theme';

type HKStatus = 'DIRTY' | 'CLEANING' | 'CLEANED' | 'INSPECTED' | 'READY' | 'OUT_OF_ORDER' | 'DO_NOT_DISTURB';

const STATUS_CFG: Record<HKStatus, { label: string; color: string; bg: string }> = {
  DIRTY:          { label: 'Dirty',     color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  CLEANING:       { label: 'Cleaning',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  CLEANED:        { label: 'Cleaned',   color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  INSPECTED:      { label: 'Inspected', color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  READY:          { label: 'Ready',     color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  OUT_OF_ORDER:   { label: 'OOO',       color: '#6B7280', bg: 'rgba(107,114,128,0.12)' },
  DO_NOT_DISTURB: { label: 'DND',       color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
};

const SUPERVISOR_ACTIONS: Record<string, { next: HKStatus; label: string }> = {
  DIRTY:    { next: 'CLEANING',  label: 'Start Cleaning' },
  CLEANING: { next: 'CLEANED',   label: 'Mark Cleaned' },
  CLEANED:  { next: 'INSPECTED', label: 'Inspect' },
  INSPECTED:{ next: 'READY',     label: 'Mark Ready' },
};

export default function HousekeepingScreen() {
  const insets = useSafeAreaInsets();
  const { staff } = useAuthStore();
  const queryClient = useQueryClient();
  const [floorFilter, setFloorFilter] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<HKStatus | null>(null);

  const isSupervisor = ['SUPERVISOR', 'HEAD_OF_DEPT', 'GENERAL_MANAGER'].includes(staff?.role ?? '');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-rooms'],
    queryFn: async () => { const { data } = await getMyRooms(); return data.rooms as any[]; },
    refetchInterval: 30000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ roomId, status }: { roomId: string; status: HKStatus }) =>
      updateRoomStatus(roomId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-rooms'] }),
  });

  const rooms: any[] = data ?? [];

  // Floors for filter
  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  const filtered = rooms.filter(r =>
    (floorFilter === null || r.floor === floorFilter) &&
    (statusFilter === null || r.housekeepingStatus === statusFilter),
  );

  const renderRoom = ({ item: room }: { item: any }) => {
    const cfg = STATUS_CFG[room.housekeepingStatus as HKStatus] ?? STATUS_CFG.DIRTY;
    const action = isSupervisor ? SUPERVISOR_ACTIONS[room.housekeepingStatus] : null;

    return (
      <View style={[styles.roomCard, { backgroundColor: cfg.bg }]}>
        <View style={styles.roomHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.roomNumber}>{room.roomNumber}</Text>
            <Text style={styles.roomFloor}>F{room.floor}</Text>
            {room.isRush && (
              <View style={styles.rushBadge}><Text style={styles.rushText}>RUSH</Text></View>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}22` }]}>
            <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {room.assignedCleaner && (
          <Text style={styles.cleanerName}>
            👤 {room.assignedCleaner.firstName} {room.assignedCleaner.lastName ?? ''}
          </Text>
        )}

        {action && (
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: `${cfg.color}50` }]}
            onPress={() => statusMutation.mutate({ roomId: room.id, status: action.next })}
            disabled={statusMutation.isPending}
          >
            <Text style={[styles.actionBtnText, { color: STATUS_CFG[action.next].color }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Housekeeping</Text>
        {isLoading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <FlatList
          horizontal
          data={[null, ...floors]}
          keyExtractor={f => String(f)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              onPress={() => setFloorFilter(f)}
              style={[styles.filterChip, floorFilter === f && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, floorFilter === f && styles.filterChipTextActive]}>
                {f === null ? 'All' : `F${f}`}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Status filter */}
      <View style={styles.filters}>
        <FlatList
          horizontal
          data={[null, ...Object.keys(STATUS_CFG)] as (HKStatus | null)[]}
          keyExtractor={s => String(s)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.xl }}
          renderItem={({ item: s }) => {
            const cfg = s ? STATUS_CFG[s] : null;
            return (
              <TouchableOpacity
                onPress={() => setStatusFilter(s)}
                style={[styles.filterChip, statusFilter === s && { backgroundColor: cfg?.bg ?? 'rgba(240,165,0,0.12)', borderColor: cfg?.color ?? colors.primary }]}
              >
                <Text style={[styles.filterChipText, statusFilter === s && { color: cfg?.color ?? colors.primary }]}>
                  {s === null ? 'All Status' : STATUS_CFG[s].label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Room list */}
      <FlatList
        data={filtered}
        keyExtractor={r => r.id}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 80 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={renderRoom}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No rooms found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  filters: { paddingVertical: spacing.sm },
  filterChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterChipActive: { backgroundColor: 'rgba(240,165,0,0.12)', borderColor: colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: colors.primary },

  roomCard: {
    borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  roomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  roomNumber: { fontSize: 17, fontWeight: '800', color: colors.text },
  roomFloor: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  rushBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#EF4444' },
  rushText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  cleanerName: { fontSize: 12, color: colors.textSecondary, marginBottom: 8 },
  actionBtn: {
    marginTop: 8, paddingVertical: 10, borderRadius: radius.lg,
    borderWidth: 1.5, alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: colors.textSecondary },
});
