import { Request, Response } from 'express';
import { AuthService } from '../services/authService';

const service = new AuthService();

export async function register(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body;
    const user = await service.register(email, password, name);
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const tokens = await service.login(email, password);
    res.json(tokens);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { token } = req.body;
    const tokens = await service.refresh(token);
    res.json(tokens);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function revokeToken(req: Request, res: Response) {
  try {
    const { token } = req.body;
    await service.revoke(token);
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}
