import prisma from '../utils/prisma';
import bcrypt from 'bcryptjs';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt';

export class AuthService {
  async register(email: string, password: string, name?: string) {
    const hashed = await bcrypt.hash(password, 10);
    return prisma.user.create({ data: { email, password: hashed, name } });
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('Invalid credentials');

    const accessToken = signAccessToken({ id: user.id, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id });
    // persist refresh token
    const expiresAt = new Date(
      Date.now() +
        1000 * 60 * 60 * 24 * parseInt(process.env.JWT_REFRESH_EXPIRES_IN!)
    );
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });
    return { accessToken, refreshToken };
  }

  async refresh(token: string) {
    try {
      const payload: any = verifyRefreshToken(token);
      const stored = await prisma.refreshToken.findUnique({ where: { token } });
      if (!stored || stored.isRevoked) throw new Error('Invalid token');
      if (stored.expiresAt < new Date()) throw new Error('Expired token');

      // issue new tokens
      const accessToken = signAccessToken({
        id: payload.id,
        role: payload.role,
      });
      const refreshToken = signRefreshToken({ id: payload.id });
      const expiresAt = new Date(
        Date.now() +
          1000 * 60 * 60 * 24 * parseInt(process.env.JWT_REFRESH_EXPIRES_IN!)
      );
      // revoke old and save new
      await prisma.refreshToken.update({
        where: { token },
        data: { isRevoked: true },
      });
      await prisma.refreshToken.create({
        data: { token: refreshToken, userId: payload.id, expiresAt },
      });
      return { accessToken, refreshToken };
    } catch (err) {
      throw new Error('Could not refresh token');
    }
  }

  async revoke(token: string) {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: { isRevoked: true },
    });
  }
}
