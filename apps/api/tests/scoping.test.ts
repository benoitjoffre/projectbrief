import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Feature, Project, ScopingItem } from '../src/models';
import { api, closeDb, resetDb, seedQuestions } from './setup';

beforeAll(seedQuestions);
beforeEach(resetDb);
afterAll(closeDb);

const createProject = async (name = 'Projet') => {
  const client = (await api().post('/api/clients').send({ name: 'Acme', company: 'Acme SA' })).body;
  return (await api().post('/api/projects').send({ clientId: client.id, name })).body;
};
const feat = (pid: string, body: object) => api().post(`/api/projects/${pid}/features`).send(body);
const item = (pid: string, body: object) => api().post(`/api/projects/${pid}/scoping-items`).send(body);

describe('fonctionnalités', () => {
  it('crée avec les valeurs par défaut et normalise les champs vides', async () => {
    const p = await createProject();
    const res = await feat(p.id, { title: '  Connexion  ', description: '' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      projectId: p.id,
      title: 'Connexion',
      description: null,
      priority: 'COULD',
      acceptanceCriteria: null,
      sortOrder: 0,
    });
  });

  it('trie par sortOrder puis createdAt', async () => {
    const p = await createProject();
    await feat(p.id, { title: 'C', sortOrder: 2 });
    await feat(p.id, { title: 'A1', sortOrder: 1 });
    await feat(p.id, { title: 'A2', sortOrder: 1 });
    const list = (await api().get(`/api/projects/${p.id}/features`)).body;
    expect(list.map((f: { title: string }) => f.title)).toEqual(['A1', 'A2', 'C']);
  });

  it('PATCH partiel : ne modifie que les champs fournis', async () => {
    const p = await createProject();
    const f = (await feat(p.id, { title: 'Export', description: 'CSV', priority: 'SHOULD', acceptanceCriteria: 'ok' })).body;
    const res = await api().patch(`/api/projects/${p.id}/features/${f.id}`).send({ priority: 'MUST' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Export', description: 'CSV', priority: 'MUST', acceptanceCriteria: 'ok' });
    const cleared = await api().patch(`/api/projects/${p.id}/features/${f.id}`).send({ acceptanceCriteria: '' });
    expect(cleared.body.acceptanceCriteria).toBeNull();
    expect(cleared.body.description).toBe('CSV');
  });

  it('PATCH du titre ne réinitialise ni priorité ni ordre', async () => {
    const p = await createProject();
    const f = (await feat(p.id, { title: 'A', priority: 'MUST', sortOrder: 5 })).body;
    const res = await api().patch(`/api/projects/${p.id}/features/${f.id}`).send({ title: 'B' });
    expect(res.body).toMatchObject({ title: 'B', priority: 'MUST', sortOrder: 5 });
  });

  it('supprime (204) puis 404', async () => {
    const p = await createProject();
    const f = (await feat(p.id, { title: 'X' })).body;
    expect((await api().delete(`/api/projects/${p.id}/features/${f.id}`)).status).toBe(204);
    expect((await api().delete(`/api/projects/${p.id}/features/${f.id}`)).status).toBe(404);
    expect((await api().get(`/api/projects/${p.id}/features`)).body).toEqual([]);
  });

  it('400 : titre manquant, priorité invalide, champ inconnu, PATCH vide, id invalide', async () => {
    const p = await createProject();
    const f = (await feat(p.id, { title: 'X' })).body;
    expect((await feat(p.id, {})).status).toBe(400);
    expect((await feat(p.id, { title: 'X', priority: 'NOPE' })).status).toBe(400);
    expect((await feat(p.id, { title: 'X', projectId: randomUUID() })).status).toBe(400);
    expect((await api().patch(`/api/projects/${p.id}/features/${f.id}`).send({})).status).toBe(400);
    expect((await api().get('/api/projects/abc/features')).status).toBe(400);
    expect((await api().patch(`/api/projects/${p.id}/features/abc`).send({ title: 'Y' })).status).toBe(400);
  });

  it('404 : projet inconnu, et fonctionnalité d’un autre projet', async () => {
    const a = await createProject('A');
    const b = await createProject('B');
    const f = (await feat(a.id, { title: 'X' })).body;
    expect((await api().get(`/api/projects/${randomUUID()}/features`)).status).toBe(404);
    expect((await feat(randomUUID(), { title: 'X' })).status).toBe(404);
    expect((await api().patch(`/api/projects/${b.id}/features/${f.id}`).send({ title: 'Y' })).status).toBe(404);
    expect((await api().delete(`/api/projects/${b.id}/features/${f.id}`)).status).toBe(404);
    expect((await api().get(`/api/projects/${a.id}/features`)).body[0].title).toBe('X');
  });
});

describe('éléments de cadrage', () => {
  it('crée avec statut OPEN par défaut et sévérité nulle', async () => {
    const p = await createProject();
    const res = await item(p.id, { type: 'RISK', title: 'Délai serré' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'RISK', status: 'OPEN', severity: null, resolution: null });
  });

  it('filtre par type et status', async () => {
    const p = await createProject();
    await item(p.id, { type: 'RISK', title: 'R1', severity: 'HIGH' });
    await item(p.id, { type: 'OPEN_QUESTION', title: 'Q1' });
    await item(p.id, { type: 'OPEN_QUESTION', title: 'Q2', status: 'RESOLVED', resolution: 'oui' });
    const get = async (qs: string) => (await api().get(`/api/projects/${p.id}/scoping-items${qs}`)).body;
    expect(await get('')).toHaveLength(3);
    expect(await get('?type=OPEN_QUESTION')).toHaveLength(2);
    expect(await get('?type=OPEN_QUESTION&status=RESOLVED')).toHaveLength(1);
    expect((await api().get(`/api/projects/${p.id}/scoping-items?type=NOPE`)).status).toBe(400);
  });

  it('PATCH partiel : résoudre une question conserve les autres champs', async () => {
    const p = await createProject();
    const q = (await item(p.id, { type: 'OPEN_QUESTION', title: 'Hébergement ?', description: 'OVH ou AWS' })).body;
    const res = await api()
      .patch(`/api/projects/${p.id}/scoping-items/${q.id}`)
      .send({ status: 'RESOLVED', resolution: 'OVH' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      type: 'OPEN_QUESTION',
      title: 'Hébergement ?',
      description: 'OVH ou AWS',
      status: 'RESOLVED',
      resolution: 'OVH',
    });
  });

  it('PATCH du titre ne réinitialise ni statut ni sévérité', async () => {
    const p = await createProject();
    const r = (await item(p.id, { type: 'RISK', title: 'R', severity: 'HIGH', status: 'IN_PROGRESS' })).body;
    const res = await api().patch(`/api/projects/${p.id}/scoping-items/${r.id}`).send({ title: 'R2' });
    expect(res.body).toMatchObject({ title: 'R2', severity: 'HIGH', status: 'IN_PROGRESS' });
  });

  it('permet d’effacer la sévérité (null) sans toucher au reste', async () => {
    const p = await createProject();
    const r = (await item(p.id, { type: 'RISK', title: 'R', severity: 'HIGH', description: 'd' })).body;
    const res = await api().patch(`/api/projects/${p.id}/scoping-items/${r.id}`).send({ severity: null });
    expect(res.body).toMatchObject({ severity: null, description: 'd', title: 'R' });
  });

  it('400 : type/sévérité/statut invalides, titre vide, PATCH vide', async () => {
    const p = await createProject();
    const r = (await item(p.id, { type: 'RISK', title: 'R' })).body;
    expect((await item(p.id, { title: 'X' })).status).toBe(400);
    expect((await item(p.id, { type: 'NOPE', title: 'X' })).status).toBe(400);
    expect((await item(p.id, { type: 'RISK', title: '  ' })).status).toBe(400);
    expect((await item(p.id, { type: 'RISK', title: 'X', severity: 'EXTREME' })).status).toBe(400);
    expect((await item(p.id, { type: 'RISK', title: 'X', status: 'DONE' })).status).toBe(400);
    expect((await api().patch(`/api/projects/${p.id}/scoping-items/${r.id}`).send({})).status).toBe(400);
  });

  it('404 : projet inconnu, élément inconnu ou d’un autre projet ; 204 à la suppression', async () => {
    const a = await createProject('A');
    const b = await createProject('B');
    const r = (await item(a.id, { type: 'DECISION', title: 'D' })).body;
    expect((await api().get(`/api/projects/${randomUUID()}/scoping-items`)).status).toBe(404);
    expect((await api().patch(`/api/projects/${b.id}/scoping-items/${r.id}`).send({ title: 'Y' })).status).toBe(404);
    expect((await api().delete(`/api/projects/${b.id}/scoping-items/${r.id}`)).status).toBe(404);
    expect((await api().delete(`/api/projects/${a.id}/scoping-items/${r.id}`)).status).toBe(204);
  });
});

describe('suppression en cascade', () => {
  it('supprimer un projet supprime ses fonctionnalités et éléments de cadrage', async () => {
    const p = await createProject();
    await feat(p.id, { title: 'F' });
    await item(p.id, { type: 'RISK', title: 'R' });
    await Project.destroy({ where: { id: p.id } });
    expect(await Feature.count()).toBe(0);
    expect(await ScopingItem.count()).toBe(0);
  });
});

describe('synthèse', () => {
  it('404 / 400', async () => {
    expect((await api().get(`/api/projects/${randomUUID()}/summary`)).status).toBe(404);
    expect((await api().get('/api/projects/abc/summary')).status).toBe(400);
  });

  it('est vide mais complète pour un projet neuf', async () => {
    const p = await createProject();
    const s = (await api().get(`/api/projects/${p.id}/summary`)).body;
    expect(s.project.id).toBe(p.id);
    expect(s.client.name).toBe('Acme');
    expect(s.discovery).toEqual({ totalQuestions: 40, reviewedQuestions: 0, percentage: 0 });
    expect(s.features).toEqual({ MUST: [], SHOULD: [], COULD: [], WONT: [] });
    expect(s.mvp).toEqual([]);
    expect(Object.keys(s.scopingItems).sort()).toEqual(
      ['ASSUMPTION', 'CONSTRAINT', 'DECISION', 'DEPENDENCY', 'OPEN_QUESTION', 'RISK'],
    );
    expect(s.openQuestions).toEqual([]);
    expect(s.unresolvedHighRisks).toEqual([]);
    expect(s.decisionsCount).toBe(0);
  });

  it('agrège fonctionnalités, MVP, questions ouvertes, risques HIGH et décisions', async () => {
    const p = await createProject();
    const other = await createProject('Autre');
    await feat(p.id, { title: 'Login', priority: 'MUST' });
    await feat(p.id, { title: 'Facturation', priority: 'MUST' });
    await feat(p.id, { title: 'Export', priority: 'SHOULD' });
    await feat(p.id, { title: 'Chat', priority: 'WONT' });
    await feat(other.id, { title: 'Ailleurs', priority: 'MUST' });

    await item(p.id, { type: 'OPEN_QUESTION', title: 'Q ouverte' });
    await item(p.id, { type: 'OPEN_QUESTION', title: 'Q en cours', status: 'IN_PROGRESS' });
    await item(p.id, { type: 'OPEN_QUESTION', title: 'Q close', status: 'RESOLVED', resolution: 'ok' });
    await item(p.id, { type: 'RISK', title: 'Risque HIGH', severity: 'HIGH' });
    await item(p.id, { type: 'RISK', title: 'Risque HIGH résolu', severity: 'HIGH', status: 'RESOLVED' });
    await item(p.id, { type: 'RISK', title: 'Risque LOW', severity: 'LOW' });
    await item(p.id, { type: 'DECISION', title: 'Stack React', status: 'RESOLVED', resolution: 'React' });
    await item(p.id, { type: 'DECISION', title: 'Hébergement' });
    await item(other.id, { type: 'DECISION', title: 'Autre projet' });

    const s = (await api().get(`/api/projects/${p.id}/summary`)).body;
    const titles = (xs: { title: string }[]) => xs.map((x) => x.title);
    expect(titles(s.features.MUST)).toEqual(['Login', 'Facturation']);
    expect(titles(s.features.SHOULD)).toEqual(['Export']);
    expect(titles(s.features.COULD)).toEqual([]);
    expect(titles(s.features.WONT)).toEqual(['Chat']);
    expect(titles(s.mvp)).toEqual(['Login', 'Facturation']);
    expect(titles(s.openQuestions)).toEqual(['Q ouverte', 'Q en cours']);
    expect(titles(s.unresolvedHighRisks)).toEqual(['Risque HIGH']);
    expect(s.decisionsCount).toBe(2);
    expect(s.scopingItems.RISK).toHaveLength(3);
  });

  it('reflète la progression de découverte', async () => {
    const p = await createProject();
    const q = (await api().get('/api/questions')).body[0].questions[0];
    await api().put(`/api/projects/${p.id}/answers/${q.id}`).send({ value: 'x', isReviewed: true });
    const s = (await api().get(`/api/projects/${p.id}/summary`)).body;
    expect(s.discovery).toMatchObject({ reviewedQuestions: 1, percentage: 3 });
  });
});
