import type { WhereOptions } from 'sequelize';
import { Client, Project } from '../models';
import type { CreateProjectInput, UpdateProjectInput } from '../validation/schemas';

const withClient = [{ model: Client, as: 'client' }];

export const projectRepository = {
  findAll: (where: WhereOptions<Project> = {}) =>
    Project.findAll({ where, include: withClient, order: [['createdAt', 'DESC']] }),
  findById: (id: string) => Project.findByPk(id, { include: withClient }),
  create: (data: CreateProjectInput) => Project.create(data),
  update: (project: Project, data: UpdateProjectInput) => project.update(data),
};
