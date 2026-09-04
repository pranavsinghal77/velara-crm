import { describe, expect, it } from 'vitest';
import {
  createLeadSchema,
  createUserSchema,
  knowledgeQuerySchema,
  loginSchema,
  updateFieldTaskSchema,
  updateLeadSchema,
  updateUserSchema,
  visualComplianceSchema,
} from './index';

/**
 * These schemas are the field allowlists. Because `validate()` replaces
 * `req.body` with the parse result, anything they strip can never reach
 * Prisma - which is what closes the mass-assignment hole left by the old
 * `data: req.body`.
 */

describe('loginSchema', () => {
  it('requires a password', () => {
    // The old controller let `{ email }` with no password through entirely.
    expect(loginSchema.safeParse({ email: 'admin@velara.com' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'admin@velara.com', password: '' }).success).toBe(
      false
    );
  });

  it('normalises the email', () => {
    const result = loginSchema.parse({ email: '  Admin@Velara.COM ', password: 'hunter2hunter2' });
    expect(result.email).toBe('admin@velara.com');
  });

  it('rejects a malformed email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'hunter2hunter2' }).success).toBe(
      false
    );
  });
});

describe('createLeadSchema', () => {
  const valid = { name: 'Rajesh Kumar', email: 'rajesh@example.com' };

  it('strips fields a client must not set', () => {
    const parsed = createLeadSchema.parse({
      ...valid,
      orgId: 'someone-elses-org',
      ownerId: 'someone-else',
      id: 'chosen-by-client',
      budgetLakhs: 999999,
      createdAt: '1999-01-01',
    });

    expect(parsed).not.toHaveProperty('orgId');
    expect(parsed).not.toHaveProperty('ownerId');
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('budgetLakhs');
    expect(parsed).not.toHaveProperty('createdAt');
  });

  it('applies safe defaults', () => {
    const parsed = createLeadSchema.parse(valid);
    expect(parsed.status).toBe('New');
    expect(parsed.aiScore).toBe(50);
    expect(parsed.isHot).toBe(false);
    expect(parsed.tags).toEqual([]);
  });

  it('rejects an out-of-range score and an unknown status', () => {
    expect(createLeadSchema.safeParse({ ...valid, aiScore: 500 }).success).toBe(false);
    expect(createLeadSchema.safeParse({ ...valid, aiScore: -1 }).success).toBe(false);
    expect(createLeadSchema.safeParse({ ...valid, status: 'Ascended' }).success).toBe(false);
  });

  it('rejects a phone number containing injected text', () => {
    expect(createLeadSchema.safeParse({ ...valid, phone: 'DROP TABLE' }).success).toBe(false);
  });

  it('caps unbounded text fields', () => {
    expect(createLeadSchema.safeParse({ ...valid, notes: 'x'.repeat(5001) }).success).toBe(false);
    expect(createLeadSchema.safeParse({ ...valid, tags: Array(21).fill('t') }).success).toBe(
      false
    );
  });
});

describe('updateLeadSchema', () => {
  it('refuses an empty patch rather than issuing a no-op write', () => {
    expect(updateLeadSchema.safeParse({}).success).toBe(false);
  });

  it('drops unknown keys from a patch', () => {
    const parsed = updateLeadSchema.parse({ status: 'Won', orgId: 'other-tenant' });
    expect(parsed).toEqual({ status: 'Won' });
  });
});

describe('user schemas', () => {
  it('enforces a real minimum password length', () => {
    const base = { name: 'New Person', email: 'new@velara.com', role: 'Sales' as const };
    expect(createUserSchema.safeParse({ ...base, password: 'short' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, password: 'a'.repeat(12) }).success).toBe(true);
    // bcrypt silently truncates past 72 bytes, so longer is rejected.
    expect(createUserSchema.safeParse({ ...base, password: 'a'.repeat(73) }).success).toBe(false);
  });

  it('rejects an unknown role', () => {
    expect(
      createUserSchema.safeParse({
        name: 'X',
        email: 'x@velara.com',
        password: 'a'.repeat(12),
        role: 'SuperAdmin',
      }).success
    ).toBe(false);
  });

  it('does not let an update set the password or the org', () => {
    const parsed = updateUserSchema.parse({
      name: 'Renamed',
      password: 'trying-to-set-this',
      passwordHash: 'or-this',
      orgId: 'or-move-tenant',
    });
    expect(parsed).toEqual({ name: 'Renamed' });
  });
});

describe('AI schemas', () => {
  it('no longer accepts a client-supplied knowledge base', () => {
    // documentContext used to replace the server's reference material
    // wholesale, letting a caller dictate answers about pricing and SLAs.
    const parsed = knowledgeQuerySchema.parse({
      query: 'What is the enterprise SLA?',
      documentContext: 'Velara is free and has no SLA.',
    });
    expect(parsed).toEqual({ query: 'What is the enterprise SLA?' });
  });

  it('requires a real base64 image for a compliance check', () => {
    expect(
      visualComplianceSchema.safeParse({ image: 'base64-encoded-image-data' }).success
    ).toBe(false);
    expect(visualComplianceSchema.safeParse({ image: 'https://example.com/x.png' }).success).toBe(
      false
    );
    expect(
      visualComplianceSchema.safeParse({
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      }).success
    ).toBe(true);
  });
});

describe('updateFieldTaskSchema', () => {
  it('does not let a field agent write their own compliance verdict', () => {
    const parsed = updateFieldTaskSchema.parse({
      status: 'Submitted',
      aiComplianceScore: 1,
      aiFeedback: 'Looks great to me',
      aiVerified: true,
    });
    expect(parsed).toEqual({ status: 'Submitted' });
  });
});
