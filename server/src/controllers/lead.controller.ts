import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const getLeads = async (req: Request, res: Response) => {
  const leads = await prisma.lead.findMany();
  res.json(leads);
};

export const createLead = async (req: Request, res: Response) => {
  const lead = await prisma.lead.create({ data: req.body });
  res.status(201).json(lead);
};

export const updateLead = async (req: Request, res: Response) => {
  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(lead);
};

export const deleteLead = async (req: Request, res: Response) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  res.json({ success: true });
};
