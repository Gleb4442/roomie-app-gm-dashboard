import cron from 'node-cron';
import { prisma } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../shared/utils/logger';
import { getSupervisorsOnShift, getStaffPushToken } from '../modules/staff/staff.service';

// SLA thresholds (percentage of slaMinutes elapsed)
const THRESHOLDS = [
  { pct: 75,  label: 'warning',  emoji: '⚠️' },
  { pct: 100, label: 'overdue',  emoji: '🔴' },
  { pct: 150, label: 'critical', emoji: '🚨' },
];

// Send push notification via Expo Push API
async function sendExpoPush(tokens: string[], title: string, body: string) {
  const messages = tokens
    .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
    .map(to => ({ to, title, body, sound: 'default', priority: 'high' }));

  if (messages.length === 0) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    logger.warn(err, '[SLA] Push notification failed');
  }
}

// Redis key for tracking sent notifications
function notifiedKey(taskId: string, threshold: string) {
  return `sla:notified:${taskId}:${threshold}`;
}

async function checkSLAViolations() {
  // Find all active tasks with SLA set (not yet completed)
  const tasks = await prisma.internalTask.findMany({
    where: {
      dueAt: { not: null },
      status: { notIn: ['COMPLETED', 'INSPECTED', 'CLOSED', 'CANCELLED'] },
    },
    select: {
      id: true,
      hotelId: true,
      title: true,
      roomNumber: true,
      dueAt: true,
      createdAt: true,
      slaMinutes: true,
      assignedToId: true,
      status: true,
    },
  });

  if (tasks.length === 0) return;

  const now = Date.now();

  for (const task of tasks) {
    if (!task.dueAt || !task.slaMinutes) continue;

    const createdMs = task.createdAt.getTime();
    const dueMs = task.dueAt.getTime();
    const slaMs = task.slaMinutes * 60 * 1000;
    const elapsedMs = now - createdMs;
    const elapsedPct = (elapsedMs / slaMs) * 100;

    for (const threshold of THRESHOLDS) {
      if (elapsedPct < threshold.pct) continue;

      const key = notifiedKey(task.id, threshold.label);
      const alreadySent = await redis.get(key);
      if (alreadySent) continue;

      // Mark as notified (TTL 36h to avoid re-sends after day rollover)
      await redis.set(key, '1', 'EX', 36 * 3600);

      // Build notification
      const location = task.roomNumber ? `Room ${task.roomNumber}` : 'Internal';
      const timeLeft = task.dueAt.getTime() > now
        ? `${Math.round((task.dueAt.getTime() - now) / 60000)}m left`
        : `${Math.round((now - task.dueAt.getTime()) / 60000)}m overdue`;

      const title = `${threshold.emoji} SLA ${threshold.label.toUpperCase()}: ${task.title}`;
      const body = `${location} · ${timeLeft}`;

      // Collect push tokens
      const tokens: string[] = [];

      // Assigned staff
      if (task.assignedToId) {
        const token = await getStaffPushToken(task.assignedToId);
        if (token) tokens.push(token);
      }

      // Supervisors on shift for this hotel
      const supervisorTokens = await getSupervisorsOnShift(task.hotelId);
      tokens.push(...supervisorTokens);

      const uniqueTokens = [...new Set(tokens)];
      if (uniqueTokens.length > 0) {
        await sendExpoPush(uniqueTokens, title, body);
        logger.info(`[SLA] Sent ${threshold.label} alert for task ${task.id} to ${uniqueTokens.length} device(s)`);
      }

      // Publish to SSE channel so connected supervisors see it in real-time
      const { getRedisPublisher } = require('../config/redis');
      const pub = getRedisPublisher();
      pub.publish(`staff_tasks:${task.hotelId}`, JSON.stringify({
        type: 'SLA_ALERT',
        taskId: task.id,
        title: task.title,
        threshold: threshold.label,
        thresholdPct: threshold.pct,
        elapsedPct: Math.round(elapsedPct),
      }));
    }
  }
}

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await checkSLAViolations();
  } catch (err) {
    logger.error(err, '[SLA Monitor] Error');
  }
});

logger.info('[SLA Monitor] Cron job registered (every 5 min)');
