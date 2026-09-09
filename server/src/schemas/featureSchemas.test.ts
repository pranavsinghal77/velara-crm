import { describe, expect, it } from 'vitest';
import {
  attendanceListQuery,
  clockInSchema,
  createDocumentSchema,
  createWorkflowSchema,
  setAttendanceModeSchema,
  updateWorkflowSchema,
} from './index';

/**
 * These schemas are the validation boundary for the three feature backends.
 * Because `validate()` replaces the request body with the parse result, what
 * they strip can never reach Prisma.
 */

describe('attendance schemas', () => {
  it('defaults the mode to Office', () => {
    expect(clockInSchema.parse({}).mode).toBe('Office');
  });

  it('accepts a geotag and rejects impossible coordinates', () => {
    expect(clockInSchema.safeParse({ lat: 19.076, lng: 72.8777 }).success).toBe(true);
    expect(clockInSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
    expect(clockInSchema.safeParse({ lat: 0, lng: 181 }).success).toBe(false);
  });

  it('rejects an unknown working mode', () => {
    expect(clockInSchema.safeParse({ mode: 'Holiday' }).success).toBe(false);
    expect(setAttendanceModeSchema.safeParse({ mode: 'Leave' }).success).toBe(true);
  });

  it('strips fields a client must not set', () => {
    const parsed = clockInSchema.parse({
      mode: 'Remote',
      userId: 'someone-else',
      workedMinutes: 999,
      clockOutAt: '2026-01-01T00:00:00Z',
    });
    // Backdating your own hours is not a client-side decision.
    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('workedMinutes');
    expect(parsed).not.toHaveProperty('clockOutAt');
  });

  it('requires YYYY-MM-DD for a range', () => {
    expect(attendanceListQuery.safeParse({ from: '2026-09-01' }).success).toBe(true);
    expect(attendanceListQuery.safeParse({ from: '01/09/2026' }).success).toBe(false);
  });
});

describe('document schema', () => {
  const valid = {
    name: 'Contract.pdf',
    mimeType: 'application/pdf',
    data: 'data:application/pdf;base64,JVBERi0xLjQ=',
  };

  it('defaults the category', () => {
    expect(createDocumentSchema.parse(valid).category).toBe('Contracts');
  });

  it('rejects a URL in place of file bytes', () => {
    // Accepting a URL would make the server fetch it, which is an SSRF vector.
    expect(
      createDocumentSchema.safeParse({ ...valid, data: 'https://example.com/x.pdf' }).success
    ).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(createDocumentSchema.safeParse({ ...valid, category: 'Secrets' }).success).toBe(false);
  });

  it('strips server-owned fields', () => {
    const parsed = createDocumentSchema.parse({
      ...valid,
      sizeBytes: 1,
      uploadedById: 'someone-else',
      extractedText: 'injected',
      orgId: 'other-tenant',
    });
    expect(parsed).not.toHaveProperty('sizeBytes');
    expect(parsed).not.toHaveProperty('uploadedById');
    expect(parsed).not.toHaveProperty('extractedText');
    expect(parsed).not.toHaveProperty('orgId');
  });
});

describe('workflow schema', () => {
  const base = {
    name: 'IndiaMART follow-up',
    trigger: 'lead_created' as const,
    actions: [{ type: 'mark_hot' as const }],
  };

  it('accepts every action type the executor implements', () => {
    const result = createWorkflowSchema.safeParse({
      ...base,
      actions: [
        { type: 'create_reminder', task: 'Call back', offsetDays: 1 },
        { type: 'set_status', status: 'Contacted' },
        { type: 'tag_lead', tag: 'inbound' },
        { type: 'notify', title: 'Heads up', message: 'A lead arrived' },
        { type: 'mark_hot' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an action the executor cannot run', () => {
    // The executor throws on an unknown type; catching it here means a broken
    // workflow can never be saved in the first place.
    const result = createWorkflowSchema.safeParse({
      ...base,
      actions: [{ type: 'delete_everything' }],
    });
    expect(result.success).toBe(false);
  });

  it('validates the payload of each action, not just its type', () => {
    expect(
      createWorkflowSchema.safeParse({
        ...base,
        actions: [{ type: 'set_status', status: 'Ascended' }],
      }).success
    ).toBe(false);

    expect(
      createWorkflowSchema.safeParse({
        ...base,
        actions: [{ type: 'create_reminder', offsetDays: 400 }],
      }).success
    ).toBe(false);

    expect(
      createWorkflowSchema.safeParse({ ...base, actions: [{ type: 'tag_lead', tag: '' }] }).success
    ).toBe(false);
  });

  it('applies action defaults so the executor never sees a gap', () => {
    const parsed = createWorkflowSchema.parse({
      ...base,
      actions: [{ type: 'create_reminder' }],
    });
    const action = parsed.actions[0] as { offsetDays: number; dueTime: string; priority: string };
    expect(action.offsetDays).toBe(1);
    expect(action.dueTime).toBe('10:00');
    expect(action.priority).toBe('Medium');
  });

  it('requires at least one action and caps the chain', () => {
    expect(createWorkflowSchema.safeParse({ ...base, actions: [] }).success).toBe(false);
    expect(
      createWorkflowSchema.safeParse({
        ...base,
        actions: Array(11).fill({ type: 'mark_hot' }),
      }).success
    ).toBe(false);
  });

  it('rejects an unknown trigger', () => {
    expect(createWorkflowSchema.safeParse({ ...base, trigger: 'full_moon' }).success).toBe(false);
  });

  it('refuses an empty update rather than issuing a no-op write', () => {
    expect(updateWorkflowSchema.safeParse({}).success).toBe(false);
  });
});
