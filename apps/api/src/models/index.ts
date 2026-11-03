import { Answer } from './answer';
import { Client } from './client';
import { Feature } from './feature';
import { Project } from './project';
import { Question } from './question';
import { QuestionCategory } from './questionCategory';
import { ScopingItem } from './scopingItem';

Client.hasMany(Project, { foreignKey: { name: 'clientId', allowNull: false }, as: 'projects' });
Project.belongsTo(Client, { foreignKey: { name: 'clientId', allowNull: false }, as: 'client' });

QuestionCategory.hasMany(Question, { foreignKey: { name: 'categoryId', allowNull: false }, as: 'questions' });
Question.belongsTo(QuestionCategory, { foreignKey: { name: 'categoryId', allowNull: false }, as: 'category' });

Project.hasMany(Answer, { foreignKey: { name: 'projectId', allowNull: false }, as: 'answers', onDelete: 'CASCADE' });
Answer.belongsTo(Project, { foreignKey: { name: 'projectId', allowNull: false }, as: 'project' });
Question.hasMany(Answer, { foreignKey: { name: 'questionId', allowNull: false }, as: 'answers' });
Answer.belongsTo(Question, { foreignKey: { name: 'questionId', allowNull: false }, as: 'question' });

Project.hasMany(Feature, { foreignKey: { name: 'projectId', allowNull: false }, as: 'features', onDelete: 'CASCADE' });
Feature.belongsTo(Project, { foreignKey: { name: 'projectId', allowNull: false }, as: 'project' });
Project.hasMany(ScopingItem, { foreignKey: { name: 'projectId', allowNull: false }, as: 'scopingItems', onDelete: 'CASCADE' });
ScopingItem.belongsTo(Project, { foreignKey: { name: 'projectId', allowNull: false }, as: 'project' });

export { Answer, Client, Feature, Project, Question, QuestionCategory, ScopingItem };
export { FEATURE_PRIORITIES } from './feature';
export type { FeaturePriority } from './feature';
export { SCOPING_SEVERITIES, SCOPING_STATUSES, SCOPING_TYPES } from './scopingItem';
export type { ScopingSeverity, ScopingStatus, ScopingType } from './scopingItem';
export { PROJECT_TYPES, PROJECT_STATUSES } from './project';
export type { ProjectType, ProjectStatus } from './project';
