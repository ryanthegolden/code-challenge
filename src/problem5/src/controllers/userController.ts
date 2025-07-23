import { Response } from 'express';
import { UserService } from '../services/userService';
import { AuthRequest } from '../middleware/authMiddleware';

const service = new UserService();

export async function createUser(req: AuthRequest, res: Response) {
  // only ADMIN can create
  const user = await service.create(req.body);
  res.status(201).json(user);
}

export async function listUsers(req: AuthRequest, res: Response) {
  const filter = { email: req.query.email as string | undefined };
  const users = await service.list(filter);
  res.json(users);
}

export async function getUser(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const user = await service.getById(id);
  if (!user) return res.status(404).json({ message: 'Not found' });
  res.json(user);
}

export async function updateUser(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const updated = await service.update(id, req.body);
  res.json(updated);
}

export async function deleteUser(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  await service.delete(id);
  res.status(204).send();
}
