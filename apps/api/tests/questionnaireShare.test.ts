import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import { publicLimiter, tokenFailureLimiter } from '../src/middleware/rateLimit';
import { Answer, Question, QuestionnaireShare } from '../src/models';
import { api, closeDb, resetDb, seedQuestions } from './setup';

beforeAll(seedQuestions);
beforeEach(async () => {
  await resetDb();
  publicLimiter.reset();
  tokenFailureLimiter.reset();
});
afterAll(async () => {
  await seedQuestions();
  await closeDb();
});

async function setup() {
  const client = (await api().post('/api/clients').send({ name: 'Camille', email: 'secret@client.test', phone: '0102030405' })).body;
  const project = (await api().post('/api/projects').send({ clientId: client.id, name: 'Boutique', description: 'NOTE INTERNE : budget serré', objective: 'Vendre' })).body;
  const share = (await api().post(`/api/projects/${project.id}/questionnaire-share`)).body;
  const categories = (await api().get('/api/questions')).body;
  return { client, project, share, token: share.token as string, questions: categories.flatMap((c: { questions: { id: string; label: string }[] }) => c.questions) };
}
const pub = (token: string) => `/api/public/questionnaires/${token}`;
const putAnswer = (token: string, qid: string, body: object) => api().put(`${pub(token)}/answers/${qid}`).send(body);

describe('administration des liens', () => {
  it('génère un lien : jeton 43 car., hash SHA-256 seul en base', async () => {
    const { project, share, token } = await setup();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(share.path).toBe(`/q/${token}`);
    expect(share).toMatchObject({ active: true, share: { isActive: true, completedAt: null } });
    const row = await QuestionnaireShare.findOne({ where: { projectId: project.id } });
    expect(row!.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(row!.toJSON())).not.toContain(token);
  });

  it('des liens successifs sont distincts et le dernier remplace l’ancien', async () => {
    const { project, token } = await setup();
    const second = (await api().post(`/api/projects/${project.id}/questionnaire-share`)).body;
    expect(second.token).not.toBe(token);
    expect((await api().get(pub(token))).status).toBe(404);
    expect((await api().get(pub(second.token))).status).toBe(200);
    expect(await QuestionnaireShare.count({ where: { projectId: project.id, isActive: true } })).toBe(1);
  });

  it('consulte le statut sans jamais renvoyer le jeton', async () => {
    const { project, token } = await setup();
    const res = await api().get(`/api/projects/${project.id}/questionnaire-share`);
    expect(res.body).toMatchObject({ active: true });
    expect(JSON.stringify(res.body)).not.toContain(token);
    const none = await setup();
    await QuestionnaireShare.destroy({ where: { projectId: none.project.id } });
    expect((await api().get(`/api/projects/${none.project.id}/questionnaire-share`)).body).toEqual({ active: false, share: null });
  });

  it('révoque le lien : accès public refusé, statut inactif', async () => {
    const { project, token } = await setup();
    expect((await api().get(pub(token))).status).toBe(200);
    const res = await api().delete(`/api/projects/${project.id}/questionnaire-share`);
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
    expect((await api().get(pub(token))).status).toBe(404);
    expect((await putAnswer(token, randomUUID(), { value: 'x' })).status).toBe(404);
    expect((await api().post(`${pub(token)}/complete`)).status).toBe(404);
  });

  it('404 projet inconnu, 400 identifiant invalide', async () => {
    expect((await api().post(`/api/projects/${randomUUID()}/questionnaire-share`)).status).toBe(404);
    expect((await api().get(`/api/projects/${randomUUID()}/questionnaire-share`)).status).toBe(404);
    expect((await api().delete(`/api/projects/${randomUUID()}/questionnaire-share`)).status).toBe(404);
    expect((await api().post('/api/projects/abc/questionnaire-share')).status).toBe(400);
  });

  it('créer un lien n’écrase aucune réponse existante', async () => {
    const { project, questions } = await setup();
    await api().put(`/api/projects/${project.id}/answers/${questions[0].id}`).send({ value: 'Déjà saisi', isReviewed: true });
    await api().post(`/api/projects/${project.id}/questionnaire-share`);
    const a = await Answer.findOne({ where: { projectId: project.id } });
    expect(a).toMatchObject({ value: 'Déjà saisi', isReviewed: true });
  });
});

describe('accès public', () => {
  it('expose le projet, les questions actives et les réponses existantes, rien d’autre', async () => {
    const { project, token, questions } = await setup();
    await api().put(`/api/projects/${project.id}/answers/${questions[0].id}`).send({ value: 'Réponse du développeur', isReviewed: true });
    const inactive = questions[1];
    await Question.update({ isActive: false }, { where: { id: inactive.id } });
    try {
      const res = await api().get(pub(token));
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.body.project).toEqual({ name: 'Boutique' });
      const exposed = res.body.categories.flatMap((c: { questions: { id: string }[] }) => c.questions);
      expect(exposed).toHaveLength(39);
      expect(exposed.map((q: { id: string }) => q.id)).not.toContain(inactive.id);
      expect(res.body.answers).toHaveLength(1);
      expect(res.body.answers[0]).toMatchObject({ questionId: questions[0].id, value: 'Réponse du développeur' });
      expect(res.body.answers[0]).not.toHaveProperty('isReviewed');
      expect(res.body.progress).toEqual({ totalQuestions: 39, answeredQuestions: 1, percentage: 3 });
      // Aucune donnée interne ni donnée client
      const raw = JSON.stringify(res.body);
      for (const secret of ['NOTE INTERNE', 'secret@client.test', '0102030405', 'Camille', project.id, project.clientId]) {
        expect(raw).not.toContain(secret);
      }
    } finally {
      await Question.update({ isActive: true }, { where: { id: inactive.id } });
    }
  });

  it('un client voit seulement son projet', async () => {
    const a = await setup();
    const b = await setup();
    await putAnswer(a.token, a.questions[0].id, { value: 'Réponse A' });
    const res = await api().get(pub(b.token));
    expect(res.body.answers).toEqual([]);
    expect(await Answer.count({ where: { projectId: b.project.id } })).toBe(0);
  });

  it('refuse jeton inconnu ou mal formé avec une 404 identique', async () => {
    const unknown = await api().get(pub('A'.repeat(43)));
    const malformed = await api().get(pub('abc'));
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
    expect(malformed.body).toEqual(unknown.body);
  });

  it('un jeton ne donne pas accès aux routes d’administration', async () => {
    const { token, project } = await setup();
    for (const path of [`/api/public/projects/${project.id}`, `/api/public/questionnaires/${token}/summary`, '/api/public/clients', `/api/public/projects/${project.id}/answers`]) {
      expect((await api().get(path)).status, path).toBe(404);
    }
    const res = await api().get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200); // sans ADMIN_API_TOKEN le dev local reste ouvert…
    env.adminToken = 'admin-secret';
    try {
      for (const path of ['/api/projects', '/api/clients', `/api/projects/${project.id}/summary`]) {
        expect((await api().get(path).set('Authorization', `Bearer ${token}`)).status, path).toBe(401);
      }
      expect((await api().get(pub(token))).status).toBe(200); // …et le public n'exige pas le jeton admin
    } finally {
      env.adminToken = null;
    }
  });
});

describe('réponses du client', () => {
  it('enregistre et met à jour une réponse, visible côté administrateur (mêmes données)', async () => {
    const { project, token, questions } = await setup();
    const q = questions[0];
    const first = await putAnswer(token, q.id, { value: 'Atelier de céramique', expectedUpdatedAt: null });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ questionId: q.id, value: 'Atelier de céramique', progress: { answeredQuestions: 1 } });
    const second = await putAnswer(token, q.id, { value: 'Atelier de céramique à Lyon', expectedUpdatedAt: first.body.updatedAt });
    expect(second.status).toBe(200);

    const admin = (await api().get(`/api/projects/${project.id}/answers`)).body;
    expect(admin).toHaveLength(1);
    expect(admin[0]).toMatchObject({ value: 'Atelier de céramique à Lyon', questionText: q.label, isReviewed: false });
    expect(await Answer.count({ where: { projectId: project.id } })).toBe(1);
  });

  it('le client ne peut ni valider (isReviewed) ni modifier d’autres champs', async () => {
    const { project, token, questions } = await setup();
    expect((await putAnswer(token, questions[0].id, { value: 'x', isReviewed: true })).status).toBe(400);
    expect((await putAnswer(token, questions[0].id, { value: 'x', projectId: randomUUID() })).status).toBe(400);
    // Une réponse déjà validée par l'administrateur le reste après modification par le client
    await api().put(`/api/projects/${project.id}/answers/${questions[1].id}`).send({ value: 'a', isReviewed: true });
    await putAnswer(token, questions[1].id, { value: 'b' });
    expect(await Answer.findOne({ where: { questionId: questions[1].id } })).toMatchObject({ value: 'b', isReviewed: true });
  });

  it('400 : valeur absente, non texte, trop longue, date invalide ; 404 : question inconnue ou inactive', async () => {
    const { token, questions } = await setup();
    const q = questions[0].id;
    for (const body of [{}, { value: 12 }, { value: 'x'.repeat(20_001) }, { value: 'x', expectedUpdatedAt: 'hier' }]) {
      expect((await putAnswer(token, q, body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await putAnswer(token, 'abc', { value: 'x' })).status).toBe(400);
    expect((await putAnswer(token, randomUUID(), { value: 'x' })).status).toBe(404);
    await Question.update({ isActive: false }, { where: { id: q } });
    try {
      expect((await putAnswer(token, q, { value: 'x' })).status).toBe(404);
    } finally {
      await Question.update({ isActive: true }, { where: { id: q } });
    }
  });

  it('reprise : le même lien restitue les réponses après rechargement', async () => {
    const { token, questions } = await setup();
    await putAnswer(token, questions[3].id, { value: 'À reprendre' });
    const again = await api().get(pub(token));
    expect(again.body.answers).toEqual([expect.objectContaining({ questionId: questions[3].id, value: 'À reprendre' })]);
  });
});

describe('écritures obsolètes', () => {
  it('le client est refusé (409) s’il écrase une réponse modifiée par l’administrateur', async () => {
    const { project, token, questions } = await setup();
    const q = questions[0];
    const seen = (await putAnswer(token, q.id, { value: 'v client', expectedUpdatedAt: null })).body;
    await api().put(`/api/projects/${project.id}/answers/${q.id}`).send({ value: 'v développeur' });
    const stale = await putAnswer(token, q.id, { value: 'v client 2', expectedUpdatedAt: seen.updatedAt });
    expect(stale.status).toBe(409);
    expect(stale.body.error).toMatchObject({ code: 'STALE_WRITE', current: { value: 'v développeur' } });
    expect((await Answer.findOne({ where: { questionId: q.id } }))!.value).toBe('v développeur');
    // Relecture de la version courante puis nouvelle écriture : acceptée
    const ok = await putAnswer(token, q.id, { value: 'v client 3', expectedUpdatedAt: stale.body.error.current.updatedAt });
    expect(ok.status).toBe(200);
  });

  it('l’administrateur est refusé (409) s’il écrase une réponse du client, et inversement pour une création concurrente', async () => {
    const { project, token, questions } = await setup();
    const q = questions[0];
    await putAnswer(token, q.id, { value: 'du client', expectedUpdatedAt: null });
    const adminStale = await api().put(`/api/projects/${project.id}/answers/${q.id}`).send({ value: 'du dev', expectedUpdatedAt: null });
    expect(adminStale.status).toBe(409);
    expect(adminStale.body.error.current.value).toBe('du client');
    expect((await Answer.findOne({ where: { questionId: q.id } }))!.value).toBe('du client');
  });

  it('sans expectedUpdatedAt, l’administration conserve la dernière écriture gagnante (compatibilité)', async () => {
    const { project, token, questions } = await setup();
    await putAnswer(token, questions[0].id, { value: 'client' });
    const res = await api().put(`/api/projects/${project.id}/answers/${questions[0].id}`).send({ value: 'dev' });
    expect(res.status).toBe(200);
  });

  it('une seule de deux écritures concurrentes avec la même version réussit', async () => {
    const { token, questions } = await setup();
    const q = questions[0];
    const seen = (await putAnswer(token, q.id, { value: 'init', expectedUpdatedAt: null })).body;
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => putAnswer(token, q.id, { value: `c${i}`, expectedUpdatedAt: seen.updatedAt })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
  });
});

describe('fin du questionnaire', () => {
  it('verrouille les réponses après « Terminer » et reste idempotent', async () => {
    const { project, token, questions } = await setup();
    await putAnswer(token, questions[0].id, { value: 'Avant' });
    const done = await api().post(`${pub(token)}/complete`);
    expect(done.status).toBe(200);
    const again = await api().post(`${pub(token)}/complete`);
    expect(again.body.completedAt).toBe(done.body.completedAt);

    const locked = await putAnswer(token, questions[0].id, { value: 'Après' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('ALREADY_COMPLETED');
    expect((await Answer.findOne({ where: { projectId: project.id } }))!.value).toBe('Avant');

    expect((await api().get(pub(token))).body.completedAt).toBe(done.body.completedAt);
    expect((await api().get(`/api/projects/${project.id}/questionnaire-share`)).body.share.completedAt).toBe(done.body.completedAt);
  });

  it('un nouveau lien rouvre le questionnaire sans perdre les réponses', async () => {
    const { project, token, questions } = await setup();
    await putAnswer(token, questions[0].id, { value: 'Conservée' });
    await api().post(`${pub(token)}/complete`);
    const fresh = (await api().post(`/api/projects/${project.id}/questionnaire-share`)).body;
    expect((await putAnswer(fresh.token, questions[1].id, { value: 'Suite' })).status).toBe(200);
    expect((await api().get(pub(fresh.token))).body.answers).toHaveLength(2);
  });
});

describe('limitation des requêtes', () => {
  afterEach(() => {
    publicLimiter.max = 1_000_000;
    tokenFailureLimiter.max = 1_000_000;
  });

  it('renvoie 429 + Retry-After au-delà de la limite générale', async () => {
    const { token } = await setup();
    publicLimiter.max = 3;
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await api().get(pub(token))).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    const blocked = await api().get(pub(token));
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('bloque les essais de jetons invalides, même ensuite avec un jeton valide', async () => {
    const { token } = await setup();
    tokenFailureLimiter.max = 3;
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await api().get(pub('B'.repeat(42) + String(i)))).status);
    expect(codes).toEqual([404, 404, 404, 429, 429]);
    expect((await api().get(pub(token))).status).toBe(429);
  });

  it('ne limite pas l’API d’administration', async () => {
    publicLimiter.max = 1;
    for (let i = 0; i < 4; i++) expect((await api().get('/api/projects')).status).toBe(200);
  });
});

describe('protection de l’administration', () => {
  afterEach(() => {
    env.adminToken = null;
  });

  it('exige le jeton Bearer quand ADMIN_API_TOKEN est défini', async () => {
    env.adminToken = 'admin-secret';
    expect((await api().get('/api/projects')).status).toBe(401);
    expect((await api().get('/api/projects').set('Authorization', 'Bearer nope')).status).toBe(401);
    expect((await api().get('/api/projects').set('Authorization', 'Basic admin-secret')).status).toBe(401);
    expect((await api().get('/api/projects').set('Authorization', 'Bearer admin-secret')).status).toBe(200);
    expect((await api().get('/api/health')).status).toBe(200);
    const res = await api().post(`/api/projects/${randomUUID()}/questionnaire-share`);
    expect(res.status).toBe(401);
  });
});
