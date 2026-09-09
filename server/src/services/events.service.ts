import crypto from 'crypto';
import { RunStatus, UsageKind, WorkflowTrigger } from '@prisma/client';
import { prisma } from '../config/db';
import { record } from '../billing/usage.service';
import { decrypt } from '../utils/encryption';
import { logger } from '../utils/logger';
import { fromDateAndTime, toDateString } from '../utils/time';

/**
 * Domain event fan-out.
 *
 * One place where "something happened in the CRM" turns into the two things a
 * customer can hang off it: workflow runs and outbound webhooks. Callers use
 * `void dispatchEvent(...)` — a failing automation must never fail the user
 * action that triggered it.
 */

export type EventType =
  | 'lead.created'
  | 'lead.status_changed'
  | 'message.received'
  | 'reminder.overdue';

const TRIGGER_FOR: Record<EventType, WorkflowTrigger> = {
  'lead.created': WorkflowTrigger.lead_created,
  'lead.status_changed': WorkflowTrigger.lead_status_changed,
  'message.received': WorkflowTrigger.message_received,
  'reminder.overdue': WorkflowTrigger.reminder_overdue,
};

export interface DomainEvent {
  orgId: string;
  type: EventType;
  payload: Record<string, unknown>;
}

export async function dispatchEvent(event: DomainEvent): Promise<void> {
  await Promise.allSettled([runWorkflows(event), deliverWebhooks(event)]);
}

// --- Workflows ---------------------------------------------------------------

/**
 * Executes every enabled workflow whose trigger and conditions match.
 * Each run is recorded with a per-action log so the UI can show what happened
 * rather than just "ran".
 */
async function runWorkflows(event: DomainEvent): Promise<void> {
  const workflows = await prisma.workflow.findMany({
    where: { orgId: event.orgId, enabled: true, trigger: TRIGGER_FOR[event.type] },
  });

  for (const workflow of workflows) {
    if (!conditionsMatch(workflow.conditions, event.payload)) continue;

    const run = await prisma.workflowRun.create({
      data: {
        orgId: event.orgId,
        workflowId: workflow.id,
        status: RunStatus.Running,
        triggerData: event.payload as never,
      },
    });

    const log: { action: string; status: string; detail?: string }[] = [];
    let failed: string | null = null;

    try {
      const actions = Array.isArray(workflow.actions) ? workflow.actions : [];

      for (const raw of actions) {
        const action = raw as { type?: string; [k: string]: unknown };
        try {
          const detail = await runAction(event, action);
          log.push({ action: String(action.type), status: 'ok', detail });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log.push({ action: String(action.type), status: 'failed', detail: message });
          failed = message;
          break; // stop the chain; later actions usually depend on earlier ones
        }
      }
    } catch (err) {
      failed = err instanceof Error ? err.message : String(err);
    }

    await prisma.$transaction([
      prisma.workflowRun.update({
        where: { id: run.id },
        data: {
          status: failed ? RunStatus.Failed : RunStatus.Succeeded,
          log: log as never,
          error: failed,
          finishedAt: new Date(),
        },
      }),
      prisma.workflow.update({
        where: { id: workflow.id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      }),
    ]);

    await record({ orgId: event.orgId }, UsageKind.workflow_run, {
      metadata: { workflow: workflow.name, outcome: failed ? 'failed' : 'succeeded' },
    });
  }
}

/** Shallow equality against the trigger payload, plus a nested `lead.` prefix. */
function conditionsMatch(conditions: unknown, payload: Record<string, unknown>): boolean {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return true;

  const lead = (payload.lead ?? {}) as Record<string, unknown>;

  return Object.entries(conditions as Record<string, unknown>).every(([key, expected]) => {
    const actual = key.startsWith('lead.') ? lead[key.slice(5)] : (payload[key] ?? lead[key]);
    if (Array.isArray(expected)) return expected.includes(actual as never);
    return actual === expected;
  });
}

async function runAction(
  event: DomainEvent,
  action: { type?: string; [k: string]: unknown }
): Promise<string> {
  const lead = (event.payload.lead ?? {}) as { id?: string; name?: string };

  switch (action.type) {
    case 'create_reminder': {
      const offsetDays = Number(action.offsetDays ?? 1);
      const due = new Date(Date.now() + offsetDays * 86_400_000);

      const reminder = await prisma.reminder.create({
        data: {
          orgId: event.orgId,
          leadId: lead.id ?? null,
          leadName: lead.name ?? '',
          task: String(action.task ?? `Follow up with ${lead.name ?? 'lead'}`),
          dueAt: fromDateAndTime(toDateString(due), String(action.dueTime ?? '10:00')),
          priority: (['High', 'Medium', 'Low'] as const).includes(action.priority as never)
            ? (action.priority as 'High' | 'Medium' | 'Low')
            : 'Medium',
          type: 'AI-Generated',
        },
      });
      return `reminder ${reminder.id}`;
    }

    case 'set_status': {
      if (!lead.id) throw new Error('set_status needs a lead in the trigger payload');
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: String(action.status ?? 'Contacted') as never },
      });
      return `status -> ${action.status}`;
    }

    case 'tag_lead': {
      if (!lead.id) throw new Error('tag_lead needs a lead in the trigger payload');
      const tag = String(action.tag ?? '').trim();
      if (!tag) throw new Error('tag_lead needs a tag');
      const current = await prisma.lead.findUniqueOrThrow({
        where: { id: lead.id },
        select: { tags: true },
      });
      if (!current.tags.includes(tag)) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { tags: { set: [...current.tags, tag] } },
        });
      }
      return `tagged "${tag}"`;
    }

    case 'notify': {
      await prisma.notification.create({
        data: {
          orgId: event.orgId,
          title: String(action.title ?? 'Workflow'),
          message: String(action.message ?? `Triggered by ${event.type}`),
          type: 'system',
        },
      });
      return 'notification created';
    }

    case 'mark_hot': {
      if (!lead.id) throw new Error('mark_hot needs a lead in the trigger payload');
      await prisma.lead.update({ where: { id: lead.id }, data: { isHot: true } });
      return 'marked hot';
    }

    default:
      throw new Error(`Unknown action type: ${String(action.type)}`);
  }
}

// --- Outbound webhooks -------------------------------------------------------

/**
 * Delivers the event to each subscribed endpoint with an HMAC signature, so
 * the receiver can verify it came from us. Repeated failures disable the
 * endpoint rather than retrying forever.
 */
async function deliverWebhooks(event: DomainEvent): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { orgId: event.orgId, enabled: true, events: { has: event.type } },
  });

  for (const endpoint of endpoints) {
    const body = JSON.stringify({
      type: event.type,
      orgId: event.orgId,
      occurredAt: new Date().toISOString(),
      data: event.payload,
    });

    let secret: string;
    try {
      secret = decrypt(endpoint.secretEnc);
    } catch {
      logger.error('Webhook secret could not be decrypted; skipping', { endpointId: endpoint.id });
      continue;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Velara-Event': event.type,
          'X-Velara-Signature': `t=${timestamp},v1=${signature}`,
        },
        body,
        signal: controller.signal,
      });

      const failure = res.status >= 400;
      await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          lastAttemptAt: new Date(),
          lastStatus: res.status,
          failureCount: failure ? { increment: 1 } : 0,
          // Ten consecutive failures is a dead endpoint, not a blip.
          ...(failure && endpoint.failureCount + 1 >= 10 ? { enabled: false } : {}),
        },
      });
    } catch {
      await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
          lastAttemptAt: new Date(),
          lastStatus: 0,
          failureCount: { increment: 1 },
          ...(endpoint.failureCount + 1 >= 10 ? { enabled: false } : {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
