import { Question, QuestionCategory } from '../models';

export const questionRepository = {
  findCategoriesWithActiveQuestions: () =>
    QuestionCategory.findAll({
      include: [{ model: Question, as: 'questions', where: { isActive: true }, required: false }],
      order: [
        ['sortOrder', 'ASC'],
        ['title', 'ASC'],
        [{ model: Question, as: 'questions' }, 'sortOrder', 'ASC'],
        [{ model: Question, as: 'questions' }, 'label', 'ASC'],
      ],
    }),
  /** Toutes les questions (actives ou non) avec leur catégorie : sert à retrouver les réponses historiques. */
  findAllWithCategory: () =>
    Question.findAll({ include: [{ model: QuestionCategory, as: 'category', required: true }] }),
  findById: (id: string) => Question.findByPk(id),
  countActive: () => Question.count({ where: { isActive: true } }),
};
