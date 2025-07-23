import prisma from '../utils/prisma';

export class UserService {
  async create(data: any) {
    return prisma.user.create({ data });
  }

  async list(filter: { email?: string }) {
    return prisma.user.findMany({ where: filter });
  }

  async getById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  }

  async update(id: number, data: any) {
    return prisma.user.update({ where: { id }, data });
  }

  async delete(id: number) {
    return prisma.user.delete({ where: { id } });
  }
}
