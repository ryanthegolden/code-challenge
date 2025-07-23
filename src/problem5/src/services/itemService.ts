import prisma from '../utils/prisma';

export class ItemService {
  async create(data: any) {
    return prisma.item.create({ data });
  }

  async list(filter: { name?: string; userId?: number }) {
    return prisma.item.findMany({ where: filter });
  }

  async getById(id: number) {
    return prisma.item.findUnique({ where: { id } });
  }

  async update(id: number, data: any) {
    return prisma.item.update({ where: { id }, data });
  }

  async delete(id: number) {
    return prisma.item.delete({ where: { id } });
  }
}
