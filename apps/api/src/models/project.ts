import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { Client } from './client';

export const PROJECT_TYPES = ['WEBSITE', 'WEB_APP', 'SAAS', 'API', 'OTHER'] as const;
export const PROJECT_STATUSES = ['DRAFT', 'DISCOVERY', 'SCOPING', 'READY', 'ARCHIVED'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  declare id: CreationOptional<string>;
  declare clientId: ForeignKey<Client['id']>;
  declare name: string;
  declare description: string | null;
  declare objective: string | null;
  declare type: CreationOptional<ProjectType>;
  declare status: CreationOptional<ProjectStatus>;
  declare deadline: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare client?: NonAttribute<Client>;
}

Project.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    clientId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    objective: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.ENUM(...PROJECT_TYPES), allowNull: false, defaultValue: 'OTHER' },
    status: { type: DataTypes.ENUM(...PROJECT_STATUSES), allowNull: false, defaultValue: 'DRAFT' },
    deadline: { type: DataTypes.DATEONLY, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'projects', underscored: true },
);
