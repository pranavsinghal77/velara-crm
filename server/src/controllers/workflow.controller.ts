import {
  LeadStatus,
  Prisma,
  RunStatus,
  WorkflowTrigger,
  type Workflow,
  type WorkflowRun,
} from '@prisma/client';
import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedParams } from '../middlewares/validate';
import { badRequest, notFound } from '../utils/httpError';
import { dispatchEvent, type EventType } from '../services/events.service';
import type { CreateWorkflowInput, IdParam, UpdateWorkflowInput } from '../schemas';

/**
 * Workflow automation.
 *
 * The Workflows page previously reported "New automated workflow created and
 * started successfully" for a row it added to local state. Nothing ran, and a
 * refresh lost it.
 *
 * The executor already exists in services/events.service.ts, wired to real
 * domain events (a lead being created dispatches `lead.created`, which runs
 * every matching workflow and records a run with a per-action log). This is
 * the CRUD and observability layer over it.
 */

function serialize(workflow: Workflow & { runs?: WorkflowRun[]; _count?: { runs: number } }) {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    trigger: workflow.trigger,
    conditions: workflow.conditions,
    actions: workflow.actions,
    enabled: workflow.enabled,
    lastRunAt: workflow.lastRunAt?.toISOString() ?? null,
    runCount: workflow.runCount,
    createdAt: workflow.createdAt.toISOString(),
    recentRuns: (workflow.runs ?? []).map(serializeRun),
  };
}

function serializeRun(run: WorkflowRun) {
  return {
    id: run.id,
    status: run.status,
    triggerData: run.triggerData,
    log: run.log,
    error: run.error,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs: run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
  };
}

/** GET /api/workflows */
export async function listWorkflows(req: Request, res: Response) {
  const { orgId } = auth(req);

  const workflows = await prisma.workflow.findMany({
    where: { orgId },
    include: { runs: { orderBy: { startedAt: 'desc' }, take: 5 } },
    orderBy: [{ enabled: 'desc' }, { createdAt: 'desc' }],
  });

  // Run health over the last week, so the page can show whether automation is
  // actually working rather than just how many rules exist.
  const since = new Date(Date.now() - 7 * 86_400_000);
  const runStats = await prisma.workflowRun.groupBy({
    by: ['status'],
    where: { orgId, startedAt: { gte: since } },
    _count: { _all: true },
  });

  res.json({
    data: workflows.map(serialize),
    triggers: Object.values(WorkflowTrigger),
    stats: {
      total: workflows.length,
      enabled: workflows.filter((w) => w.enabled).length,
      runsLast7Days: runStats.reduce((sum, r) => sum + r._count._all, 0),
      byStatus: Object.fromEntries(runStats.map((r) => [r.status, r._count._all])),
    },
  });
}

/** GET /api/workflows/:id */
export async function getWorkflow(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const workflow = await prisma.workflow.findFirst({
    where: { id, orgId },
    include: { runs: { orderBy: { startedAt: 'desc' }, take: 50 } },
  });
  if (!workflow) throw notFound('Workflow not found');

  res.json(serialize(workflow));
}

/** POST /api/workflows */
export async function createWorkflow(req: Request, res: Response) {
  const { orgId, userId } = auth(req);
  const input = req.body as CreateWorkflowInput;

  const workflow = await prisma.workflow.create({
    data: {
      orgId,
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      conditions: (input.conditions ?? undefined) as Prisma.InputJsonValue | undefined,
      actions: input.actions as unknown as Prisma.InputJsonValue,
      enabled: input.enabled,
      createdById: userId,
    },
  });

  res.status(201).json(serialize(workflow));
}

/** PUT /api/workflows/:id */
export async function updateWorkflow(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);
  const input = req.body as UpdateWorkflowInput;

  const existing = await prisma.workflow.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!existing) throw notFound('Workflow not found');

  const workflow = await prisma.workflow.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
      ...(input.conditions !== undefined
        ? { conditions: (input.conditions ?? undefined) as Prisma.InputJsonValue | undefined }
        : {}),
      ...(input.actions !== undefined
        ? { actions: input.actions as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    },
  });

  res.json(serialize(workflow));
}

/** PUT /api/workflows/:id/toggle */
export async function toggleWorkflow(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const existing = await prisma.workflow.findFirst({
    where: { id, orgId },
    select: { id: true, enabled: true },
  });
  if (!existing) throw notFound('Workflow not found');

  const workflow = await prisma.workflow.update({
    where: { id },
    data: { enabled: !existing.enabled },
  });

  res.json(serialize(workflow));
}

/** DELETE /api/workflows/:id */
export async function deleteWorkflow(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const { count } = await prisma.workflow.deleteMany({ where: { id, orgId } });
  if (count === 0) throw notFound('Workflow not found');

  res.status(204).end();
}

const TRIGGER_EVENT: Record<WorkflowTrigger, EventType | null> = {
  [WorkflowTrigger.lead_created]: 'lead.created',
  [WorkflowTrigger.lead_status_changed]: 'lead.status_changed',
  [WorkflowTrigger.message_received]: 'message.received',
  [WorkflowTrigger.reminder_overdue]: 'reminder.overdue',
  // A scheduled workflow has no inbound event to simulate.
  [WorkflowTrigger.schedule]: null,
};

/**
 * POST /api/workflows/:id/test
 *
 * Fires the workflow's trigger against a real lead so an author can see the
 * actions take effect — and see them in the run log — before enabling it.
 *
 * This performs the actions for real. Simulating them would prove nothing
 * about whether they work, and the run record makes exactly what happened
 * auditable afterwards.
 */
export async function testWorkflow(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);
  const { leadId } = req.body as { leadId?: string };

  const workflow = await prisma.workflow.findFirst({ where: { id, orgId } });
  if (!workflow) throw notFound('Workflow not found');

  const eventType = TRIGGER_EVENT[workflow.trigger];
  if (!eventType) {
    throw badRequest(
      'Scheduled workflows have no trigger event to simulate. Run it from the scheduler instead.'
    );
  }

  // Prefer a named lead; otherwise pick an open one so the actions have a real
  // record to act on.
  const lead = leadId
    ? await prisma.lead.findFirst({ where: { id: leadId, orgId } })
    : await prisma.lead.findFirst({
        where: { orgId, status: { notIn: [LeadStatus.Won, LeadStatus.Lost] } },
        orderBy: { createdAt: 'desc' },
      });

  if (!lead) {
    throw badRequest(
      'This workflow acts on a lead, and there is no lead to test against. Create one first.'
    );
  }

  const before = workflow.runCount;

  await dispatchEvent({
    orgId,
    type: eventType,
    payload: { leadId: lead.id, lead, test: true },
  });

  const after = await prisma.workflow.findUniqueOrThrow({
    where: { id },
    include: { runs: { orderBy: { startedAt: 'desc' }, take: 1 } },
  });

  const ran = after.runCount > before;
  const run = after.runs[0];

  res.json({
    ran,
    // Not running is a legitimate outcome: the conditions did not match.
    reason: ran
      ? undefined
      : 'The workflow did not run: its conditions did not match this lead.',
    testedAgainst: { leadId: lead.id, leadName: lead.name, status: lead.status },
    run: run && ran ? serializeRun(run) : null,
    workflow: serialize(after),
  });
}

/** GET /api/workflows/:id/runs */
export async function listRuns(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const workflow = await prisma.workflow.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!workflow) throw notFound('Workflow not found');

  const runs = await prisma.workflowRun.findMany({
    where: { workflowId: id, orgId },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });

  res.json({
    data: runs.map(serializeRun),
    summary: {
      total: runs.length,
      succeeded: runs.filter((r) => r.status === RunStatus.Succeeded).length,
      failed: runs.filter((r) => r.status === RunStatus.Failed).length,
    },
  });
}
