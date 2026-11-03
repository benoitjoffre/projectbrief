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
import type { Project } from './project';

export class QuestionnaireShare extends Model<
  InferAttributes<QuestionnaireShare>,
  InferCreationAttributes<QuestionnaireShare>
> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<Project['id']>;
  declare tokenHash: string;
  declare isActive: CreationOptional<boolean>;
  declare completedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare project?: NonAttribute<Project>;
}

QuestionnaireShare.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    projectId: { type: DataTypes.UUID, allowNull: false },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'questionnaire_shares', underscored: true },
);
