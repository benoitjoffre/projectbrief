import { Client } from '../models';
import type { CreateClientInput, UpdateClientInput } from '../validation/schemas';

export const clientRepository = {
  findAll: () => Client.findAll({ order: [['name', 'ASC']] }),
  findById: (id: string) => Client.findByPk(id),
  create: (data: CreateClientInput) => Client.create(data),
  update: async (client: Client, data: UpdateClientInput) => client.update(data),
};
