import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const getMessages = async (req: Request, res: Response) => {
  const messages = await prisma.message.findMany();
  res.json(messages);
};

export const createMessage = async (req: Request, res: Response) => {
  const message = await prisma.message.create({ data: req.body });
  const io = req.app.get('io');
  if (io) {
    io.emit('newMessage', message);
  }
  res.status(201).json(message);
};

export const markMessageRead = async (req: Request, res: Response) => {
  const message = await prisma.message.update({
    where: { id: req.params.id },
    data: { isRead: true },
  });
  res.json(message);
};
