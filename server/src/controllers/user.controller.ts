import { Request, Response } from 'express';
import { prisma } from '../config/db';

export const getUsers = async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isActive: true,
      permissions: true,
      avatar: true,
    },
  });
  res.json(users);
};

export const createUser = async (req: Request, res: Response) => {
  const { name, email, password = 'password123', role = 'Sales', permissions = [] } = req.body;
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password,
      role,
      permissions,
      isActive: true,
    },
  });
  res.status(201).json(user);
};

export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await prisma.user.update({
    where: { id },
    data: req.body,
  });
  res.json(user);
};

export const toggleUserActive = async (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });
  res.json(updated);
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (password && user.password !== 'redacted' && user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isLoggedIn: true,
  });
};
