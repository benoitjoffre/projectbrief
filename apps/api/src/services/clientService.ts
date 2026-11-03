import { notFound } from '../middleware/errors';
import { clientRepository } from '../repositories/clientRepository';
import type { CreateClientInput, UpdateClientInput } from '../validation/schemas';

export const clientService = {
  list: () => clientRepository.findAll(),

  async get(id: string) {
    const client = await clientRepository.findById(id);
    if (!client) throw notFound('Client');
    return client;
  },

  create: (input: CreateClientInput) => clientRepository.create(input),

  async update(id: string, input: UpdateClientInput) {
    const client = await clientService.get(id);
    return clientRepository.update(client, input);
  },
};
