import { Client } from './client';
import { Project } from './project';

Client.hasMany(Project, { foreignKey: { name: 'clientId', allowNull: false }, as: 'projects' });
Project.belongsTo(Client, { foreignKey: { name: 'clientId', allowNull: false }, as: 'client' });

export { Client, Project };
export { PROJECT_TYPES, PROJECT_STATUSES } from './project';
export type { ProjectType, ProjectStatus } from './project';
