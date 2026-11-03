import {
  CreationOptional,
  DataTypes,
  ForeignKey,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { Project } from './project';

export const SCOPING_TYPES = [
  'CONSTRAINT',
  'RISK',
  'DEPENDENCY',
  'ASSUMPTION',
  'DECISION',
  'OPEN_QUESTION',
] as const;
export const SCOPING_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;
export const SCOPING_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type ScopingType = (typeof SCOPING_TYPES)[number];
export type ScopingStatus = (typeof SCOPING_STATUSES)[number];
export type ScopingSeverity = (typeof SCOPING_SEVERITIES)[number];

export class ScopingItem extends Model<InferAttributes<ScopingItem>, InferCreationAttributes<ScopingItem>> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<Project['id']>;
  declare type: ScopingType;
  declare title: string;
  declare description: string | null;
  declare status: CreationOptional<ScopingStatus>;
  declare severity: ScopingSeverity | null;
  declare resolution: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ScopingItem.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    projectId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM(...SCOPING_TYPES), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM(...SCOPING_STATUSES), allowNull: false, defaultValue: 'OPEN' },
    severity: { type: DataTypes.ENUM(...SCOPING_SEVERITIES), allowNull: true },
    resolution: { type: DataTypes.TEXT, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'scoping_items', underscored: true },
);
