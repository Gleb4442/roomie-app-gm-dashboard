import { Request, Response } from 'express';
import * as staffService from './staff.service';
import { autoAssignTask } from './autoAssign.service';
import { StaffRequest } from './staff.middleware';
import { TaskPriority, StaffDepartment } from '@prisma/client';

// ── Auth ──────────────────────────────────────────────────────

export async function login(req: Request, res: Response) {
  try {
    const { hotelId, email, password } = req.body;
    if (!hotelId || !email || !password) {
      res.status(400).json({ error: 'hotelId, email and password required' });
      return;
    }
    const result = await staffService.loginStaff(hotelId, email, password);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: 'Invalid email or password' });
    } else {
      res.status(500).json({ error: 'Login failed' });
    }
  }
}

export async function loginByPin(req: Request, res: Response) {
  try {
    const { hotelId, pin } = req.body;
    if (!hotelId || !pin) {
      res.status(400).json({ error: 'hotelId and pin required' });
      return;
    }
    const result = await staffService.loginStaffByPin(hotelId, pin);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: 'Invalid PIN' });
    } else {
      res.status(500).json({ error: 'Login failed' });
    }
  }
}

export async function getMe(req: StaffRequest, res: Response) {
  try {
    const staff = await staffService.getStaffById(req.staff!.staffId);
    if (!staff) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(staff);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

// ── Shifts ────────────────────────────────────────────────────

export async function startShift(req: StaffRequest, res: Response) {
  try {
    const shift = await staffService.startShift(req.staff!.staffId, req.staff!.hotelId);
    res.json(shift);
  } catch {
    res.status(500).json({ error: 'Failed to start shift' });
  }
}

export async function endShift(req: StaffRequest, res: Response) {
  try {
    await staffService.endShift(req.staff!.staffId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to end shift' });
  }
}

export async function getShiftStatus(req: StaffRequest, res: Response) {
  try {
    const shift = await staffService.getActiveShift(req.staff!.staffId);
    res.json({ shift: shift ?? null });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

export async function getTemplates(req: StaffRequest, res: Response) {
  try {
    const templates = await staffService.getTemplates(req.staff!.hotelId);
    res.json(templates);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

// ── Tasks ─────────────────────────────────────────────────────

export async function getTasks(req: StaffRequest, res: Response) {
  try {
    const { status, onlyMine, roomNumber, priority } = req.query;

    const tasks = await staffService.getUnifiedTasks(req.staff!.hotelId, {
      staffId: req.staff!.staffId,
      role: req.staff!.role,
      department: req.staff!.role as unknown as StaffDepartment,
      status: status ? (status as string).split(',') : undefined,
      onlyMine: onlyMine === 'true',
      roomNumber: roomNumber as string | undefined,
      priority: priority as TaskPriority | undefined,
    });

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

export async function updateStatus(req: StaffRequest, res: Response) {
  try {
    const { taskType, taskId } = req.params;
    const { status, holdReason } = req.body;

    if (!status) { res.status(400).json({ error: 'status required' }); return; }

    const result = await staffService.updateTaskStatus(
      taskType as 'INTERNAL' | 'ORDER' | 'SERVICE_REQUEST',
      taskId as string,
      status as string,
      req.staff!.staffId,
      holdReason as string | undefined,
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
}

export async function assignTask(req: StaffRequest, res: Response) {
  try {
    const { taskType, taskId } = req.params;
    const { assignedToId, note } = req.body;

    const result = await staffService.assignTask(
      taskType as 'INTERNAL' | 'ORDER' | 'SERVICE_REQUEST',
      taskId as string,
      (assignedToId as string) || req.staff!.staffId,
      note as string | undefined,
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to assign task' });
  }
}

export async function suggestAssignee(req: StaffRequest, res: Response) {
  try {
    const { department, roomNumber } = req.query;
    if (!department) { res.status(400).json({ error: 'department required' }); return; }

    const staffId = await autoAssignTask(
      req.staff!.hotelId,
      department as StaffDepartment,
      roomNumber as string | undefined,
    );

    if (!staffId) {
      res.json({ staffId: null, message: 'No suitable staff on shift' });
      return;
    }

    // Return the staff member details so the caller can show them
    const staff = await staffService.getStaffById(staffId);
    res.json({ staffId, staff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to suggest assignee' });
  }
}

export async function createTask(req: StaffRequest, res: Response) {
  try {
    const { autoAssign, ...body } = req.body;
    let assignedToId = body.assignedToId as string | undefined;

    // Auto-assign if requested and no explicit assignee
    if (autoAssign && !assignedToId && body.department) {
      const suggestion = await autoAssignTask(
        req.staff!.hotelId,
        body.department as StaffDepartment,
        body.roomNumber as string | undefined,
      );
      assignedToId = suggestion ?? undefined;
    }

    const task = await staffService.createInternalTask({
      ...body,
      hotelId: req.staff!.hotelId,
      createdById: req.staff!.staffId,
      assignedToId,
    });
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
}

export async function updateChecklist(req: StaffRequest, res: Response) {
  try {
    const { taskId } = req.params;
    const { itemId, checked } = req.body;
    const result = await staffService.updateChecklist(taskId as string, itemId as string, checked as boolean);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'CHECKLIST_NOT_FOUND') {
      res.status(404).json({ error: 'Checklist not found' });
    } else {
      res.status(500).json({ error: 'Failed' });
    }
  }
}

export async function addComment(req: StaffRequest, res: Response) {
  try {
    const { taskId, taskType } = req.params;
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: 'text required' }); return; }

    const comment = await staffService.addComment(
      taskId as string, taskType as string, req.staff!.staffId, text as string,
    );
    res.status(201).json(comment);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

export async function getComments(req: StaffRequest, res: Response) {
  try {
    const { taskId, taskType } = req.params;
    const comments = await staffService.getTaskComments(taskId as string, taskType as string);
    res.json(comments);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

export async function getOnlineStaff(req: StaffRequest, res: Response) {
  try {
    const staff = await staffService.getOnlineStaff(req.staff!.hotelId);
    res.json(staff);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

export async function savePushToken(req: StaffRequest, res: Response) {
  try {
    const { expoPushToken } = req.body;
    if (!expoPushToken) { res.status(400).json({ error: 'expoPushToken required' }); return; }
    await staffService.savePushToken(req.staff!.staffId, expoPushToken as string);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

export async function deleteAccount(req: StaffRequest, res: Response) {
  try {
    await staffService.deactivateStaffAccount(req.staff!.staffId);
    res.json({ deleted: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete account' });
  }
}

// ── Dashboard: Staff Stats + PIN ──────────────────────────────

export async function getStaffStats(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const stats = await staffService.getTMSStats(hotelId);
    res.json(stats);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

export async function resetPin(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const staffId = req.params.staffId as string;
    const { pin } = req.body;
    if (!pin || !/^\d{4,8}$/.test(pin)) {
      res.status(400).json({ error: 'PIN must be 4-8 digits' });
      return;
    }
    await staffService.resetStaffPin(staffId, hotelId, pin);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to reset PIN' });
  }
}

// ── Dashboard: Template Management ────────────────────────────

export async function listTemplatesDashboard(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const templates = await staffService.listTemplatesForDashboard(hotelId);
    res.json(templates);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

export async function createTemplateDashboard(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const template = await staffService.createTemplateWithItems({ ...req.body, hotelId });
    res.status(201).json(template);
  } catch {
    res.status(500).json({ error: 'Failed to create template' });
  }
}

export async function updateTemplateDashboard(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const templateId = req.params.templateId as string;
    const template = await staffService.updateTemplateWithItems(templateId, hotelId, req.body);
    res.json(template);
  } catch {
    res.status(500).json({ error: 'Failed to update template' });
  }
}

export async function deleteTemplateDashboard(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const templateId = req.params.templateId as string;
    await staffService.deactivateTemplate(templateId, hotelId);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

// ── SSE: Real-time task stream ────────────────────────────────

export function streamTasks(req: StaffRequest, res: Response) {
  const { hotelId, role, staffId } = req.staff!;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Subscribe to Redis pub/sub
  const { getRedisSubscriber } = require('../../config/redis');
  const subscriber = getRedisSubscriber();
  const channel = `staff_tasks:${hotelId}`;

  subscriber.subscribe(channel, (err: any) => {
    if (err) { res.end(); return; }
  });

  subscriber.on('message', (ch: string, message: string) => {
    if (ch !== channel) return;
    try {
      const event = JSON.parse(message);
      // LINE_STAFF sees only their tasks
      if (role === 'LINE_STAFF' && event.assignedToId && event.assignedToId !== staffId) return;
      send('task_update', event);
    } catch {}
  });

  // Heartbeat
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    subscriber.unsubscribe(channel);
    subscriber.quit();
  });
}

// ── Staff Management (Dashboard) ──────────────────────────────

export async function listStaff(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const staff = await staffService.listStaffMembers(hotelId);
    res.json(staff);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

export async function createStaff(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const member = await staffService.createStaffMember({ ...req.body, hotelId });
    res.status(201).json(member);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Email already exists for this hotel' });
    } else {
      res.status(500).json({ error: 'Failed to create staff member' });
    }
  }
}

export async function updateStaff(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const staffId = req.params.staffId as string;
    const member = await staffService.updateStaffMember(staffId, hotelId, req.body);
    res.json(member);
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}

export async function deactivateStaff(req: Request, res: Response) {
  try {
    const hotelId = req.params.hotelId as string;
    const staffId = req.params.staffId as string;
    await staffService.updateStaffMember(staffId, hotelId, { isActive: false });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed' });
  }
}
