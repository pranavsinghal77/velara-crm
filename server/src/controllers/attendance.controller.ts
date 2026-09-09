import { AttendanceMode, Role, type AttendanceRecord } from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedQuery } from '../middlewares/validate';
import { badRequest, forbidden } from '../utils/httpError';
import { fromDateAndTime, startOfToday, toDateString, toTimeString } from '../utils/time';
import type { AttendanceListQuery, ClockInInput } from '../schemas';

/**
 * Field-force attendance.
 *
 * Clock state used to live in component state: `clockedIn` defaulted to true,
 * the "Since 09:58 AM" label was a string literal, and the week grid was seven
 * hardcoded "8h 30m" cells. A refresh reset all of it and nothing was ever
 * recorded.
 *
 * The day is stored as midnight in the organisation's timezone, so "today" is
 * the same day for everyone in the business regardless of where the server
 * runs, and a day can be looked up by equality rather than a range scan.
 */

function serialize(record: AttendanceRecord & { user?: { name: string } | null }) {
  return {
    id: record.id,
    userId: record.userId,
    userName: record.user?.name,
    day: toDateString(record.day),
    mode: record.mode,
    clockInAt: record.clockInAt?.toISOString() ?? null,
    clockOutAt: record.clockOutAt?.toISOString() ?? null,
    /** `HH:mm` in the org timezone, which is what the UI displays. */
    clockInTime: record.clockInAt ? toTimeString(record.clockInAt) : null,
    clockOutTime: record.clockOutAt ? toTimeString(record.clockOutAt) : null,
    workedMinutes: record.workedMinutes,
    isOpen: Boolean(record.clockInAt && !record.clockOutAt),
    location:
      record.clockInLat !== null && record.clockInLng !== null
        ? { lat: record.clockInLat, lng: record.clockInLng }
        : null,
    note: record.note,
  };
}

/** Minutes between clock-in and clock-out, floored and never negative. */
function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}

/** GET /api/attendance/today — the caller's own state, for the clock widget. */
export async function getToday(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const day = startOfToday();

  // Scoped by orgId as well as the unique key, so a token minted before the
  // user moved workspace cannot surface a record from the previous one.
  const record = await prisma.attendanceRecord.findFirst({
    where: { orgId, userId, day },
  });

  res.json({
    day: toDateString(day),
    record: record ? serialize(record) : null,
    modes: Object.values(AttendanceMode),
  });
}

/**
 * POST /api/attendance/clock-in
 *
 * Idempotent for the day: clocking in twice returns the existing open session
 * rather than losing the original start time.
 */
export async function clockIn(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const input = req.body as ClockInInput;
  const day = startOfToday();
  const now = new Date();

  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_day: { userId, day } },
  });

  if (existing?.clockInAt && !existing.clockOutAt) {
    // Already on the clock; report the open session instead of restarting it.
    return res.json(serialize(existing));
  }

  const record = await prisma.attendanceRecord.upsert({
    where: { userId_day: { userId, day } },
    create: {
      orgId,
      userId,
      day,
      mode: input.mode,
      clockInAt: now,
      clockInLat: input.lat ?? null,
      clockInLng: input.lng ?? null,
      note: input.note,
    },
    update: {
      // Re-opening after a clock-out keeps the minutes already accrued.
      clockInAt: now,
      clockOutAt: null,
      mode: input.mode,
      ...(input.lat !== undefined ? { clockInLat: input.lat } : {}),
      ...(input.lng !== undefined ? { clockInLng: input.lng } : {}),
      ...(input.note ? { note: input.note } : {}),
    },
  });

  res.status(201).json(serialize(record));
}

/**
 * POST /api/attendance/clock-out
 *
 * Accumulates rather than overwrites, so several sessions in one day add up.
 */
export async function clockOut(req: Request, res: Response) {
  const { userId } = auth(req);
  const day = startOfToday();
  const now = new Date();

  const existing = await prisma.attendanceRecord.findUnique({
    where: { userId_day: { userId, day } },
  });

  if (!existing?.clockInAt) throw badRequest('You are not clocked in today.');
  if (existing.clockOutAt) throw badRequest('You have already clocked out today.');

  const record = await prisma.attendanceRecord.update({
    where: { id: existing.id },
    data: {
      clockOutAt: now,
      workedMinutes: existing.workedMinutes + minutesBetween(existing.clockInAt, now),
    },
  });

  res.json(serialize(record));
}

/** PUT /api/attendance/mode — switch working mode without breaking the session. */
export async function setMode(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const { mode, note } = req.body as { mode: AttendanceMode; note?: string };
  const day = startOfToday();

  const record = await prisma.attendanceRecord.upsert({
    where: { userId_day: { userId, day } },
    create: { orgId, userId, day, mode, note: note ?? '' },
    update: { mode, ...(note !== undefined ? { note } : {}) },
  });

  res.json(serialize(record));
}

/**
 * GET /api/attendance — a range of records.
 *
 * A member sees only their own; managers and admins can read the team, which
 * is what the attendance log needs. Defaults to the current month.
 */
export async function listAttendance(req: Request, res: Response) {
  const { orgId, userId, role } = auth(req);
  const { from, to, userId: requestedUserId } = validatedQuery<AttendanceListQuery>(req);

  const canSeeOthers = role === Role.Manager || role === Role.Admin;

  if (requestedUserId && requestedUserId !== userId && !canSeeOthers) {
    throw forbidden('You can only view your own attendance.');
  }

  const today = startOfToday();
  const monthStart = fromDateAndTime(`${toDateString(today).slice(0, 7)}-01`, '00:00');

  const start = from ? fromDateAndTime(from, '00:00') : monthStart;
  const end = to
    ? fromDateAndTime(to, '00:00')
    : new Date(today.getTime() + 86_400_000);

  if (end.getTime() < start.getTime()) throw badRequest('`to` must be on or after `from`.');

  const records = await prisma.attendanceRecord.findMany({
    where: {
      orgId,
      day: { gte: start, lt: end },
      // Without the privilege, the scope is silently narrowed to self rather
      // than erroring: the log is still useful, just personal.
      ...(canSeeOthers
        ? requestedUserId
          ? { userId: requestedUserId }
          : {}
        : { userId }),
    },
    include: { user: { select: { name: true } } },
    orderBy: [{ day: 'desc' }, { userId: 'asc' }],
    take: 500,
  });

  const present = records.filter((r) => r.mode !== AttendanceMode.Leave && r.clockInAt);

  res.json({
    from: toDateString(start),
    to: toDateString(new Date(end.getTime() - 86_400_000)),
    scope: canSeeOthers && !requestedUserId ? 'team' : 'self',
    data: records.map(serialize),
    summary: {
      daysRecorded: records.length,
      daysPresent: present.length,
      totalMinutes: records.reduce((sum, r) => sum + r.workedMinutes, 0),
      byMode: Object.values(AttendanceMode).reduce<Record<string, number>>((acc, mode) => {
        acc[mode] = records.filter((r) => r.mode === mode).length;
        return acc;
      }, {}),
    },
  });
}

/**
 * GET /api/attendance/team-today — who is on the clock right now.
 * Manager and above; the field-ops overview needs it.
 */
export async function teamToday(req: Request, res: Response) {
  const { orgId } = auth(req);
  const day = startOfToday();

  const [members, records] = await Promise.all([
    prisma.user.findMany({
      where: { orgId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.attendanceRecord.findMany({ where: { orgId, day } }),
  ]);

  const byUser = new Map(records.map((r) => [r.userId, r]));

  res.json({
    day: toDateString(day),
    data: members.map((m) => {
      const record = byUser.get(m.id);
      return {
        userId: m.id,
        name: m.name,
        role: m.role,
        // Absent means no record at all, which is different from clocked out.
        status: !record
          ? 'NotRecorded'
          : record.mode === AttendanceMode.Leave
            ? 'Leave'
            : record.clockInAt && !record.clockOutAt
              ? 'OnClock'
              : record.clockOutAt
                ? 'ClockedOut'
                : 'NotRecorded',
        mode: record?.mode ?? null,
        clockInTime: record?.clockInAt ? toTimeString(record.clockInAt) : null,
        workedMinutes: record?.workedMinutes ?? 0,
      };
    }),
  });
}
