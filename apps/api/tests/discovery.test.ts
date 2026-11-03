import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Answer, Question, QuestionCategory } from '../src/models';
import { api, closeDb, resetDb, seedQuestions } from './setup';

interface Category {
  id: string;
  title: string;
  questions: { id: string; label: string }[];
}

beforeAll(seedQuestions);
beforeEach(resetDb);
afterAll(async () => {
  await seedQuestions(); // restaure les libellés modifiés par certains tests
  await closeDb();
});

const createProject = async () => {
  const client = (await api().post('/api/clients').send({ name: 'Acme' })).body;
  return (await api().post('/api/projects').send({ clientId: client.id, name: 'Projet' })).body;
};
const getCategories = async (): Promise<Category[]> => (await api().get('/api/questions')).body;
const firstQuestion = async () => (await getCategories())[0].questions[0];
const put = (projectId: string, questionId: string, body: object) =>
  api().put(`/api/projects/${projectId}/answers/${questionId}`).send(body);

describe('questions initiales', () => {
  it('expose 8 catégories ordonnées et 40 questions actives', async () => {
    const categories = await getCategories();
    expect(categories).toHaveLength(8);
    expect(categories.map((c) => c.title)).toEqual([
      'Client et activité',
      'Problème et objectifs',
      'Utilisateurs',
      'Fonctionnalités',
      'Existant et technique',
      'UX et design',
      'Budget et planning',
      'Livraison et maintenance',
    ]);
    expect(categories.every((c) => c.questions.length === 5)).toBe(true);
    expect(categories.flatMap((c) => c.questions)).toHaveLength(40);
    expect(categories[0].questions[0].label).toBe('Quelle est votre activité et qui sont vos clients ?');
    expect(categories[1].questions[4].label).toBe('Comment mesurerez-vous la réussite du projet ?');
  });

  it('le seeder est idempotent', async () => {
    const shape = async () =>
      (await getCategories()).map((c) => ({ id: c.id, title: c.title, questions: c.questions.map((q) => [q.id, q.label]) }));
    const before = await shape();
    await seedQuestions();
    await seedQuestions();
    expect(await QuestionCategory.count()).toBe(8);
    expect(await Question.count()).toBe(40);
    expect(await shape()).toEqual(before);
  });

  it('le re-seed conserve la désactivation d’une question', async () => {
    const q = await firstQuestion();
    await Question.update({ isActive: false }, { where: { id: q.id } });
    try {
      await seedQuestions();
      expect((await getCategories()).flatMap((c) => c.questions)).toHaveLength(39);
    } finally {
      await Question.update({ isActive: true }, { where: { id: q.id } });
    }
  });
});

describe('réponses', () => {
  it('crée une réponse avec les valeurs par défaut', async () => {
    const project = await createProject();
    const q = await firstQuestion();
    const res = await put(project.id, q.id, { value: 'Plomberie' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      projectId: project.id,
      questionId: q.id,
      questionText: q.label,
      value: 'Plomberie',
      isReviewed: false,
    });
  });

  it('accepte isReviewed seul (value reste vide)', async () => {
    const project = await createProject();
    const q = await firstQuestion();
    const res = await put(project.id, q.id, { isReviewed: true });
    expect(res.body).toMatchObject({ value: '', isReviewed: true });
  });

  it('modifie sans créer de doublon et conserve les champs omis', async () => {
    const project = await createProject();
    const q = await firstQuestion();
    await put(project.id, q.id, { value: 'v1', isReviewed: true });
    const res = await put(project.id, q.id, { value: 'v2' });
    expect(res.body).toMatchObject({ value: 'v2', isReviewed: true });

    const list = (await api().get(`/api/projects/${project.id}/answers`)).body;
    expect(list).toHaveLength(1);
    expect(list[0].value).toBe('v2');
  });

  it('ne crée aucun doublon sous écritures concurrentes', async () => {
    const project = await createProject();
    const q = await firstQuestion();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => put(project.id, q.id, { value: `v${i}` })),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await Answer.count({ where: { projectId: project.id } })).toBe(1);
  });

  it('conserve questionText quand le libellé de la question change', async () => {
    const project = await createProject();
    const q = await firstQuestion();
    await put(project.id, q.id, { value: 'a' });
    await Question.update({ label: 'Libellé modifié ?' }, { where: { id: q.id } });
    const res = await put(project.id, q.id, { value: 'b' });
    expect(res.body.questionText).toBe(q.label);
    const list = (await api().get(`/api/projects/${project.id}/answers`)).body;
    expect(list[0].questionText).toBe(q.label);
  });

  it('retrouve les réponses après rechargement (nouvelle lecture)', async () => {
    const project = await createProject();
    const [c1, c2] = await getCategories();
    await put(project.id, c1.questions[0].id, { value: 'Réponse 1', isReviewed: true });
    await put(project.id, c2.questions[2].id, { value: 'Réponse 2' });

    const reloaded = (await api().get(`/api/projects/${project.id}/answers`)).body;
    expect(reloaded).toHaveLength(2);
    const byQuestion = new Map(reloaded.map((a: { questionId: string }) => [a.questionId, a]));
    expect(byQuestion.get(c1.questions[0].id)).toMatchObject({ value: 'Réponse 1', isReviewed: true });
    expect(byQuestion.get(c2.questions[2].id)).toMatchObject({ value: 'Réponse 2', isReviewed: false });
  });

  it('isole les réponses par projet', async () => {
    const a = await createProject();
    const b = await createProject();
    const q = await firstQuestion();
    await put(a.id, q.id, { value: 'A' });
    expect((await api().get(`/api/projects/${b.id}/answers`)).body).toEqual([]);
  });
});

describe('progression', () => {
  it('ne compte que les réponses validées ET non vides sur des questions actives', async () => {
    const project = await createProject();
    const [c1] = await getCategories();
    const [q1, q2, q3, q4] = c1.questions;

    await put(project.id, q1.id, { value: 'ok', isReviewed: true }); // compte
    await put(project.id, q2.id, { value: 'non validée' }); // non validée
    await put(project.id, q3.id, { value: '   \n ', isReviewed: true }); // validée mais vide
    await put(project.id, q4.id, { value: 'ok', isReviewed: true }); // compte, puis désactivée
    let res = await api().get(`/api/projects/${project.id}/discovery/progress`);
    expect(res.body).toEqual({ totalQuestions: 40, reviewedQuestions: 2, percentage: 5 });

    await Question.update({ isActive: false }, { where: { id: q4.id } });
    try {
      res = await api().get(`/api/projects/${project.id}/discovery/progress`);
      expect(res.body).toEqual({ totalQuestions: 39, reviewedQuestions: 1, percentage: 3 });
    } finally {
      await Question.update({ isActive: true }, { where: { id: q4.id } });
    }
  });

  it('vaut 0 % sans réponse', async () => {
    const project = await createProject();
    const res = await api().get(`/api/projects/${project.id}/discovery/progress`);
    expect(res.body).toEqual({ totalQuestions: 40, reviewedQuestions: 0, percentage: 0 });
  });
});

describe('erreurs', () => {
  it('400 : identifiants invalides, corps invalide', async () => {
    const project = await createProject();
    const q = await firstQuestion();
    expect((await api().get('/api/projects/abc/answers')).status).toBe(400);
    expect((await api().get('/api/projects/abc/discovery/progress')).status).toBe(400);
    expect((await put(project.id, 'abc', { value: 'x' })).status).toBe(400);
    expect((await put(project.id, q.id, {})).status).toBe(400);
    expect((await put(project.id, q.id, { value: 12 })).status).toBe(400);
    expect((await put(project.id, q.id, { isReviewed: 'oui' })).status).toBe(400);
    expect((await put(project.id, q.id, { value: 'x', extra: 1 })).status).toBe(400);
    expect((await put(project.id, q.id, { value: 'x'.repeat(20_001) })).status).toBe(400);
    expect(await Answer.count()).toBe(0);
  });

  it('404 : projet ou question inexistant', async () => {
    const project = await createProject();
    const q = await firstQuestion();
    expect((await api().get(`/api/projects/${randomUUID()}/answers`)).status).toBe(404);
    expect((await api().get(`/api/projects/${randomUUID()}/discovery/progress`)).status).toBe(404);
    expect((await put(randomUUID(), q.id, { value: 'x' })).status).toBe(404);
    const res = await put(project.id, randomUUID(), { value: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Question introuvable');
    expect(await Answer.count()).toBe(0);
  });
});
