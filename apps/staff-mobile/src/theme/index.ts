export const colors = {
  primary: '#1152D4',
  primaryLight: 'rgba(17,82,212,0.1)',
  background: '#F5F6FA',
  white: '#FFFFFF',
  text: '#0D1117',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  success: '#16A34A',
  successLight: 'rgba(22,163,74,0.1)',
  warning: '#D97706',
  warningLight: 'rgba(217,119,6,0.1)',
  error: '#DC2626',
  errorLight: 'rgba(220,38,38,0.1)',
  urgent: '#DC2626',
  high: '#D97706',
  normal: '#1152D4',
  low: '#64748B',
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, full: 999,
};

export function priorityColor(priority: string) {
  switch (priority) {
    case 'URGENT': return colors.urgent;
    case 'HIGH': return colors.high;
    case 'NORMAL': return colors.normal;
    case 'LOW': return colors.low;
    default: return colors.normal;
  }
}

export function statusColor(status: string) {
  switch (status) {
    case 'NEW': return colors.textSecondary;
    case 'ASSIGNED': return colors.primary;
    case 'IN_PROGRESS': return colors.warning;
    case 'ON_HOLD': return colors.textTertiary;
    case 'COMPLETED': return colors.success;
    case 'INSPECTED': return colors.success;
    case 'CLOSED': return colors.textTertiary;
    case 'CANCELLED': return colors.error;
    default: return colors.textSecondary;
  }
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    NEW: 'New',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In Progress',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Done',
    INSPECTED: 'Inspected',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
  };
  return map[status] || status;
}
