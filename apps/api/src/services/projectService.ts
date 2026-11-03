import type { ProjectStatus } from '../models';
import { notFound } from '../middleware/errors';
import { clientRepository } from '../repositories/clientRepository';
import { projectRepository } from '../repositories/projectRepository';
import type { CreateProjectInput, UpdateProjectInput } from '../validation/schemas';

export const projectService = {
  list: (filters: { clientId?: string; status?: ProjectStatus } = {}) =>
    projectRepository.findAll(filters),

  async get(id: string) {
    const project = await projectRepository.findById(id);
    if (!project) throw notFound('Projet');
    return project;
  },

  async create(input: CreateProjectInput) {
    // Refus explicite d'un clientId inexistant (404 plutôt qu'une erreur SQL de clé étrangère).
    if (!(await clientRepository.findById(input.clientId))) throw notFound('Client');
    const created = await projectRepository.create(input);
    return projectService.get(created.id);
  },

  async update(id: string, input: UpdateProjectInput) {
    const project = await projectService.get(id);
    await projectRepository.update(project, input);
    return projectService.get(id);
  },
};
