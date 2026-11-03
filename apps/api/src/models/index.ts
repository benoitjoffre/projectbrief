import { Answer } from './answer';
import { Client } from './client';
import { Project } from './project';
import { Question } from './question';
import { QuestionCategory } from './questionCategory';

Client.hasMany(Project, { foreignKey: { name: 'clientId', allowNull: false }, as: 'projects' });
Project.belongsTo(Client, { foreignKey: { name: 'clientId', allowNull: false }, as: 'client' });

QuestionCategory.hasMany(Question, { foreignKey: { name: 'categoryId', allowNull: false }, as: 'questions' });
Question.belongsTo(QuestionCategory, { foreignKey: { name: 'categoryId', allowNull: false }, as: 'category' });

Project.hasMany(Answer, { foreignKey: { name: 'projectId', allowNull: false }, as: 'answers', onDelete: 'CASCADE' });
Answer.belongsTo(Project, { foreignKey: { name: 'projectId', allowNull: false }, as: 'project' });
Question.hasMany(Answer, { foreignKey: { name: 'questionId', allowNull: false }, as: 'answers' });
Answer.belongsTo(Question, { foreignKey: { name: 'questionId', allowNull: false }, as: 'question' });

export { Answer, Client, Project, Question, QuestionCategory };
export { PROJECT_TYPES, PROJECT_STATUSES } from './project';
export type { ProjectType, ProjectStatus } from './project';
