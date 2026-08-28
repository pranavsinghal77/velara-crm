import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const getCampaigns = async (req: Request, res: Response) => {
  const campaigns = await prisma.fieldCampaign.findMany({
    include: { tasks: true },
    orderBy: { startDate: 'desc' },
  });
  res.json(campaigns);
};

export const createCampaign = async (req: Request, res: Response) => {
  const { name, description, startDate, endDate, budget, status } = req.body;
  const campaign = await prisma.fieldCampaign.create({
    data: {
      name,
      description,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 86400000),
      budget: budget ? parseFloat(budget) : 0,
      status: status || 'Active',
    },
    include: { tasks: true },
  });
  res.status(201).json(campaign);
};

export const createTask = async (req: Request, res: Response) => {
  const { campaignId, title, location, status, assignedToId } = req.body;
  const task = await prisma.fieldTask.create({
    data: {
      campaignId,
      title,
      location,
      status: status || 'Pending',
      assignedToId,
    },
  });
  res.status(201).json(task);
};

export const updateTask = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, uploadedImageUrl, aiComplianceScore, aiFeedback } = req.body;
  const task = await prisma.fieldTask.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(uploadedImageUrl && { uploadedImageUrl }),
      ...(aiComplianceScore !== undefined && { aiComplianceScore: parseFloat(aiComplianceScore) }),
      ...(aiFeedback && { aiFeedback }),
    },
  });
  res.json(task);
};
