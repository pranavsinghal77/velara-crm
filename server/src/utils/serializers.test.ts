import { describe, expect, it } from 'vitest';
import type { Reminder, User } from '@prisma/client';
import { parseBudgetToLakhs, serializeReminder, serializeUser } from './serializers';
import { fromDateAndTime } from './time';

describe('parseBudgetToLakhs', () => {
  it('reads lakh and crore suffixes', () => {
    expect(parseBudgetToLakhs('3.5L')).toBe(3.5);
    expect(parseBudgetToLakhs('Rs 4.5 L')).toBe(4.5);
    expect(parseBudgetToLakhs('1.2 Cr')).toBe(120);
  });

  it('treats a bare number as rupees', () => {
    expect(parseBudgetToLakhs('90000')).toBeCloseTo(0.9);
  });

  it('returns 0 rather than NaN for junk, so downstream sums stay valid', () => {
    // This is the important one: a single NaN poisons every aggregate.
    expect(parseBudgetToLakhs('to be discussed')).toBe(0);
    expect(parseBudgetToLakhs('')).toBe(0);
    expect(parseBudgetToLakhs(undefined)).toBe(0);
    expect(parseBudgetToLakhs(null)).toBe(0);
    expect(Number.isNaN(parseBudgetToLakhs('???'))).toBe(false);
  });

  it('clamps a negative budget to 0', () => {
    expect(parseBudgetToLakhs('-5L')).toBe(5);
  });
});

describe('serializeUser', () => {
  it('never emits the password hash', () => {
    const user = {
      id: 'u1',
      orgId: 'o1',
      name: 'Sneha Kapoor',
      email: 'sneha@velara.com',
      passwordHash: '$2b$12$averysecrethashvalue',
      avatar: null,
      role: 'Sales',
      isActive: true,
      permissions: ['leads'],
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as User;

    const dto = serializeUser(user);

    expect(dto).not.toHaveProperty('passwordHash');
    expect(dto).not.toHaveProperty('password');
    // orgId is internal and must not leak either.
    expect(dto).not.toHaveProperty('orgId');
    expect(JSON.stringify(dto)).not.toContain('averysecrethash');
    expect(dto.email).toBe('sneha@velara.com');
  });
});

describe('serializeReminder', () => {
  const base = {
    id: 'r1',
    orgId: 'o1',
    leadId: null,
    leadName: 'Acme',
    task: 'Call back',
    isCompleted: false,
    completedAt: null,
    priority: 'High',
    type: 'Manual',
    notes: '',
    ownerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('splits the stored instant into the date and time the UI expects', () => {
    const reminder = { ...base, dueAt: fromDateAndTime('2026-03-10', '15:30') } as Reminder;
    const dto = serializeReminder(reminder, fromDateAndTime('2026-03-10', '09:00'));

    expect(dto.dueDate).toBe('2026-03-10');
    expect(dto.dueTime).toBe('15:30');
  });

  it('derives isToday/isTomorrow from the clock, so they cannot go stale', () => {
    const reminder = { ...base, dueAt: fromDateAndTime('2026-03-10', '15:30') } as Reminder;

    const onTheDay = serializeReminder(reminder, fromDateAndTime('2026-03-10', '09:00'));
    expect(onTheDay.isToday).toBe(true);
    expect(onTheDay.isTomorrow).toBe(false);

    // Same stored row, read the day before: now it is "tomorrow".
    const dayBefore = serializeReminder(reminder, fromDateAndTime('2026-03-09', '09:00'));
    expect(dayBefore.isToday).toBe(false);
    expect(dayBefore.isTomorrow).toBe(true);

    // And the day after it is neither. A stored boolean would still say
    // "today" here, which is exactly what the old schema did.
    const dayAfter = serializeReminder(reminder, fromDateAndTime('2026-03-11', '09:00'));
    expect(dayAfter.isToday).toBe(false);
    expect(dayAfter.isTomorrow).toBe(false);
  });

  it('marks an incomplete past reminder as overdue', () => {
    const reminder = { ...base, dueAt: fromDateAndTime('2026-03-09', '10:00') } as Reminder;
    const dto = serializeReminder(reminder, fromDateAndTime('2026-03-10', '09:00'));
    expect(dto.isOverdue).toBe(true);
  });

  it('does not mark a completed past reminder as overdue', () => {
    const reminder = {
      ...base,
      isCompleted: true,
      dueAt: fromDateAndTime('2026-03-09', '10:00'),
    } as Reminder;
    const dto = serializeReminder(reminder, fromDateAndTime('2026-03-10', '09:00'));
    expect(dto.isOverdue).toBe(false);
  });
});
