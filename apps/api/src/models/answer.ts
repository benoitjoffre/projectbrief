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
import type { Question } from './question';

export class Answer extends Model<InferAttributes<Answer>, InferCreationAttributes<Answer>> {
  declare id: CreationOptional<string>;
  declare projectId: ForeignKey<Project['id']>;
  declare questionId: ForeignKey<Question['id']>;
  declare questionText: string;
  declare value: CreationOptional<string>;
  declare isReviewed: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Answer.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    projectId: { type: DataTypes.UUID, allowNull: false },
    questionId: { type: DataTypes.UUID, allowNull: false },
    questionText: { type: DataTypes.TEXT, allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    isReviewed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'answers',
    underscored: true,
    indexes: [{ name: 'answers_project_question_uq', unique: true, fields: ['project_id', 'question_id'] }],
  },
);
