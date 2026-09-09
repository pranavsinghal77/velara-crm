import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedParams } from '../middlewares/validate';
import type {
  CreateCampaignInput,
  CreateFieldTaskInput,
  IdParam,
  UpdateFieldTaskInput,
} from '../schemas';
import { badRequest, notFound } from '../utils/httpError';
import { serializeCampaign, serializeFieldTask } from '../utils/serializers';

/** GET /api/field-campaigns */
export async function getCampaigns(req: Request, res: Response) {
  const { orgId } = auth(req);

  const campaigns = await prisma.fieldCampaign.findMany({
    where: { orgId },
    include: { tasks: { orderBy: { createdAt: 'asc' } } },
    orderBy: { startDate: 'desc' },
    take: 100,
  });

  res.json({ data: campaigns.map(serializeCampaign) });
}

/** POST /api/field-campaigns - Manager and above. */
export async function createCampaign(req: Request, res: Response) {
  const { orgId } = auth(req);
  const input = req.body as CreateCampaignInput;

  const startDate = input.startDate ?? new Date();
  const endDate = input.endDate ?? new Date(startDate.getTime() + 30 * 86_400_000);

  const campaign = await prisma.fieldCampaign.create({
    data: {
      orgId,
      name: input.name,
      description: input.description,
      startDate,
      endDate,
      budget: input.budget,
      status: input.status,
    },
    include: { tasks: true },
  });

  res.status(201).json(serializeCampaign(campaign));
}

/** POST /api/field-campaigns/tasks - Manager and above. */
export async function createTask(req: Request, res: Response) {
  const { orgId } = auth(req);
  const input = req.body as CreateFieldTaskInput;

  const campaign = await prisma.fieldCampaign.findFirst({
    where: { id: input.campaignId, orgId },
    select: { id: true },
  });
  if (!campaign) throw badRequest('campaignId does not reference one of your campaigns');

  if (input.assignedToId) {
    const member = await prisma.user.findFirst({
      where: { id: input.assignedToId, orgId },
      select: { id: true },
    });
    if (!member) throw badRequest('assignedToId must be a member of your organisation');
  }

  const task = await prisma.fieldTask.create({
    data: {
      orgId,
      campaignId: campaign.id,
      title: input.title,
      location: input.location,
      status: input.status,
      assignedToId: input.assignedToId ?? null,
    },
  });

  res.status(201).json(serializeFieldTask(task));
}

/**
 * PUT /api/field-campaigns/tasks/:id
 *
 * Note what is *not* updatable here: `aiComplianceScore`, `aiFeedback` and
 * `aiVerified` are written only by the server after a real vision call. A
 * field agent cannot submit their own passing score.
 */
export async function updateTask(req: Request, res: Response) {
  const { orgId } = auth(req);
  const { id } = validatedParams<IdParam>(req);
  const input = req.body as UpdateFieldTaskInput;

  const existing = await prisma.fieldTask.findFirst({
    where: { id, orgId },
    select: { id: true },
  });
  if (!existing) throw notFound('Task not found');

  if (input.assignedToId) {
    const member = await prisma.user.findFirst({
      where: { id: input.assignedToId, orgId },
      select: { id: true },
    });
    if (!member) throw badRequest('assignedToId must be a member of your organisation');
  }

  const task = await prisma.fieldTask.update({
    where: { id },
    data: {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.uploadedImageUrl !== undefined
        ? {
            uploadedImageUrl: input.uploadedImageUrl,
            // A new photo invalidates any previous verdict.
            aiVerified: false,
            aiComplianceScore: null,
            aiFeedback: null,
          }
        : {}),
      ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
    },
  });

  res.json(serializeFieldTask(task));
}
