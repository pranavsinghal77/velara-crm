import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../config/db';
import { auth } from '../middlewares/auth';
import { validatedParams } from '../middlewares/validate';
import type { CreateUserInput, IdParam, UpdateUserInput } from '../schemas';
import { badRequest, forbidden, notFound } from '../utils/httpError';
import { hashPassword } from '../utils/password';
import { serializeUser } from '../utils/serializers';
import { revokeAllForUser } from '../utils/tokens';

/** GET /api/users - members of the caller's organisation only. */
export async function getUsers(req: Request, res: Response) {
  const { orgId } = auth(req);

  const users = await prisma.user.findMany({
    where: { orgId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  res.json({ data: users.map(serializeUser) });
}

/**
 * POST /api/users - Admin only.
 *
 * Creates the member inside the caller's org. The response goes through
 * `serializeUser`, so the password hash cannot echo back (the old endpoint
 * returned the raw record, plaintext password included).
 */
export async function createUser(req: Request, res: Response) {
  const { orgId } = auth(req);
  const input = req.body as CreateUserInput;

  const user = await prisma.user.create({
    data: {
      orgId,
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      permissions: input.permissions,
      avatar: input.avatar,
      isActive: true,
    },
  });

  res.status(201).json(serializeUser(user));
}

/** PUT /api/users/:id - Admin only. */
export async function updateUser(req: Request, res: Response) {
  const { orgId, userId: actorId } = auth(req);
  const { id } = validatedParams<IdParam>(req);
  const input = req.body as UpdateUserInput;

  const target = await prisma.user.findFirst({
    where: { id, orgId },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) throw notFound('User not found');

  // Guard against an admin locking themselves out or quietly demoting
  // themselves mid-session.
  if (target.id === actorId) {
    if (input.isActive === false) throw badRequest('You cannot deactivate your own account');
    if (input.role && input.role !== target.role) {
      throw badRequest('You cannot change your own role');
    }
  }

  if (input.role && target.role === Role.Admin && input.role !== Role.Admin) {
    await assertNotLastAdmin(orgId, target.id);
  }
  if (input.isActive === false && target.role === Role.Admin) {
    await assertNotLastAdmin(orgId, target.id);
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
      ...(input.avatar !== undefined ? { avatar: input.avatar } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  // Losing access should be immediate, not eventual.
  if (input.isActive === false || (input.role && input.role !== target.role)) {
    await revokeAllForUser(user.id);
  }

  res.json(serializeUser(user));
}

/** PUT /api/users/:id/toggle-active - Admin only. */
export async function toggleUserActive(req: Request, res: Response) {
  const { orgId, userId: actorId } = auth(req);
  const { id } = validatedParams<IdParam>(req);

  const target = await prisma.user.findFirst({
    where: { id, orgId },
    select: { id: true, isActive: true, role: true },
  });
  if (!target) throw notFound('User not found');

  if (target.id === actorId) throw badRequest('You cannot deactivate your own account');
  if (target.isActive && target.role === Role.Admin) {
    await assertNotLastAdmin(orgId, target.id);
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: !target.isActive },
  });

  if (!user.isActive) await revokeAllForUser(user.id);

  res.json(serializeUser(user));
}

/**
 * An organisation with no active admin cannot be administered again without
 * database surgery, so refuse the operation that would cause it.
 */
async function assertNotLastAdmin(orgId: string, excludingUserId: string) {
  const remaining = await prisma.user.count({
    where: { orgId, role: Role.Admin, isActive: true, id: { not: excludingUserId } },
  });
  if (remaining === 0) {
    throw forbidden('Your organisation must keep at least one active admin');
  }
}
