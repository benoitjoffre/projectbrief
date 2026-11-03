import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDb, resetDb } from './setup';

beforeEach(resetDb);
afterAll(closeDb);

const createClient = async (body: object = { name: 'Acme', email: 'contact@acme.test' }) =>
  (await api().post('/api/clients').send(body)).body;

describe('validation', () => {
  it('refuse un client sans nom', async () => {
    const res = await api().post('/api/clients').send({ email: 'a@b.co' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('name');
  });

  it('refuse un email invalide et les champs inconnus', async () => {
    expect((await api().post('/api/clients').send({ name: 'X', email: 'nope' })).status).toBe(400);
    expect((await api().post('/api/clients').send({ name: 'X', admin: true })).status).toBe(400);
  });

  it('refuse un projet avec type, statut ou date invalides', async () => {
    const client = await createClient();
    const base = { clientId: client.id, name: 'P' };
    expect((await api().post('/api/projects').send({ ...base, type: 'NOPE' })).status).toBe(400);
    expect((await api().post('/api/projects').send({ ...base, status: 'NOPE' })).status).toBe(400);
    expect((await api().post('/api/projects').send({ ...base, deadline: '2026-02-30' })).status).toBe(400);
  });

  it('refuse un id non UUID (400) et un PATCH vide', async () => {
    expect((await api().get('/api/clients/abc')).status).toBe(400);
    const client = await createClient();
    expect((await api().patch(`/api/clients/${client.id}`).send({})).status).toBe(400);
  });

  it('ne divulgue pas de détail SQL sur une route inconnue', async () => {
    const res = await api().get('/api/unknown');
    expect(res.status).toBe(404);
  });
});

describe('clients', () => {
  it('crée un client, normalise les champs vides et le retrouve', async () => {
    const res = await api().post('/api/clients').send({ name: '  Acme  ', email: '', phone: '' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Acme', email: null, phone: null, company: null });
    expect(res.body.id).toBeTruthy();

    const got = await api().get(`/api/clients/${res.body.id}`);
    expect(got.status).toBe(200);
    expect((await api().get('/api/clients')).body).toHaveLength(1);
  });

  it('modifie un client (PATCH) et renvoie 404 si inconnu', async () => {
    const client = await createClient();
    const res = await api().patch(`/api/clients/${client.id}`).send({ company: 'Acme SA' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Acme', company: 'Acme SA' });
    expect((await api().get(`/api/clients/${randomUUID()}`)).status).toBe(404);
  });
});

describe('projets', () => {
  it('crée un projet avec valeurs par défaut', async () => {
    const client = await createClient();
    const res = await api().post('/api/projects').send({ clientId: client.id, name: 'Site vitrine' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Site vitrine', type: 'OTHER', status: 'DRAFT', deadline: null });
  });

  it('refuse un clientId inexistant', async () => {
    const res = await api().post('/api/projects').send({ clientId: randomUUID(), name: 'Orphelin' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Client introuvable');
    expect((await api().get('/api/projects')).body).toHaveLength(0);
  });

  it('récupère les projets avec leur client associé', async () => {
    const client = await createClient();
    await api().post('/api/projects').send({ clientId: client.id, name: 'P1', type: 'SAAS', deadline: '2026-12-31' });

    const list = await api().get('/api/projects');
    expect(list.status).toBe(200);
    expect(list.body[0].client).toMatchObject({ id: client.id, name: 'Acme' });
    expect(list.body[0].deadline).toBe('2026-12-31');

    const detail = await api().get(`/api/projects/${list.body[0].id}`);
    expect(detail.body.client.name).toBe('Acme');
  });

  it('modifie un projet mais pas son client', async () => {
    const client = await createClient();
    const project = (await api().post('/api/projects').send({ clientId: client.id, name: 'P1' })).body;

    const res = await api().patch(`/api/projects/${project.id}`).send({ status: 'DISCOVERY', deadline: null });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DISCOVERY');
    expect(res.body.client.id).toBe(client.id);

    expect((await api().patch(`/api/projects/${project.id}`).send({ clientId: randomUUID() })).status).toBe(400);
    expect((await api().patch(`/api/projects/${randomUUID()}`).send({ name: 'x' })).status).toBe(404);
  });

  it('filtre par statut', async () => {
    const client = await createClient();
    await api().post('/api/projects').send({ clientId: client.id, name: 'A' });
    await api().post('/api/projects').send({ clientId: client.id, name: 'B', status: 'READY' });
    const res = await api().get('/api/projects?status=READY');
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(['B']);
  });
});
