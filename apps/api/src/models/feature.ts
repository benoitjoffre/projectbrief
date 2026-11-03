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

export const FEATURE_PRIORITIES = ['MUST', 'SHOULD', 'COULD', 'WONT'] as const;
export type FeaturePriority = (typeof FEATURE_PRIORITIES)[number];

export class Feature extends Model<InferAttributes<Feature>, InferCreationAttributes<Feature>> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<Project['id']>;
  declare title: string;
  declare description: string | null;
  declare priority: CreationOptional<FeaturePriority>;
  declare acceptanceCriteria: string | null;
  declare sortOrder: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Feature.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    projectId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    priority: { type: DataTypes.ENUM(...FEATURE_PRIORITIES), allowNull: false, defaultValue: 'COULD' },
    acceptanceCriteria: { type: DataTypes.TEXT, allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'features', underscored: true },
);
