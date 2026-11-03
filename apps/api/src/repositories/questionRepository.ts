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
  findById: (id: string) => Question.findByPk(id),
  countActive: () => Question.count({ where: { isActive: true } }),
};
