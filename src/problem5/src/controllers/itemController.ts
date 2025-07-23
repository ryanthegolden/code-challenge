import { Response } from 'express';
import { ItemService } from '../services/itemService';
import { AuthRequest } from '../middleware/authMiddleware';

const service = new ItemService();

export async function createItem(req: AuthRequest, res: Response) {
  const item = await service.create(req.body);
  res.status(201).json(item);
}

export async function listItems(req: AuthRequest, res: Response) {
  const filter = {
    name: req.query.name as string | undefined,
    userId: req.query.userId ? Number(req.query.userId) : undefined,
  };
  const items = await service.list(filter);
  res.json(items);
}

export async function getItem(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const item = await service.getById(id);
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json(item);
}

export async function updateItem(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const updated = await service.update(id, req.body);
  res.json(updated);
}

export async function deleteItem(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  await service.delete(id);
  res.status(204).send();
}
