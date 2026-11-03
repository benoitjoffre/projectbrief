import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { documentService, safeFileSlug } from '../src/services/document/documentService';
import { api, closeDb, resetDb, seedQuestions } from './setup';
import { readPdf } from './helpers/pdfText';

beforeAll(seedQuestions);
beforeEach(resetDb);
afterAll(closeDb);

const binary = (res: import('superagent').Response) => res.body as Buffer;
const pdfRequest = (path: string, body?: object) =>
  api()
    .post(path)
    .send(body)
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
const preview = (id: string, body?: object) => pdfRequest(`/api/projects/${id}/document/preview`, body);
const download = (id: string, body?: object) => pdfRequest(`/api/projects/${id}/document/download`, body);

async function createProject(name = 'Réservation été', extra: object = {}) {
  const client = (await api().post('/api/clients').send({ name: 'Éloïse Dupont', company: 'Cabinet Étoile' })).body;
  return (await api().post('/api/projects').send({ clientId: client.id, name, description: 'Description du projet', objective: 'Objectif du projet', ...extra })).body;
}

describe('POST document/preview et download', () => {
  it('404 pour un projet inexistant, 400 pour un identifiant invalide', async () => {
    expect((await download(randomUUID())).status).toBe(404);
    expect((await preview(randomUUID())).status).toBe(404);
    expect((await download('abc')).status).toBe(400);
  });

  it('400 pour des options invalides', async () => {
    const p = await createProject();
    for (const body of [
      { version: '' },
      { version: '../../etc/passwd' },
      { version: 'x'.repeat(31) },
      { version: 12 },
      { sections: { unknown: true } },
      { sections: { presentation: 'oui' } },
      { sections: Object.fromEntries(['presentation', 'context', 'scope', 'acceptance', 'technical', 'risks', 'openQuestions', 'conclusion'].map((s) => [s, false])) },
      { includeNonMvpFeatures: 'non' },
      { extra: 1 },
    ]) {
      const res = await download(p.id, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.headers['content-type']).toMatch(/json/);
    }
  });

  it('accepte une requête sans corps (options par défaut)', async () => {
    const p = await createProject();
    expect((await download(p.id)).status).toBe(200);
  });

  it('renvoie un PDF valide avec les bons en-têtes', async () => {
    const p = await createProject();
    const res = await download(p.id);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('attachment; filename="cahier-des-charges-reservation-ete-v0-1.pdf"');
    expect(res.headers['cache-control']).toBe('no-store');
    const buf = binary(res);
    expect(Number(res.headers['content-length'])).toBe(buf.length);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.subarray(-10).toString()).toContain('%%EOF');
    const pdf = await readPdf(buf);
    expect(pdf.numPages).toBeGreaterThanOrEqual(4);
  });

  it('l’aperçu est inline', async () => {
    const p = await createProject();
    const res = await preview(p.id);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe('inline');
  });

  it('aperçu et téléchargement ont le même contenu', async () => {
    const p = await createProject();
    const body = { version: '2.0', sections: { risks: true } };
    const [a, b] = [await readPdf(binary(await preview(p.id, body))), await readPdf(binary(await download(p.id, body)))];
    expect(a.numPages).toBe(b.numPages);
    expect(a.text).toBe(b.text);
  });

  it('nettoie le nom de fichier (injection de chemin / en-têtes)', async () => {
    const p = await createProject('../../etc/passwd"; rm -rf / éè');
    const res = await download(p.id, { version: 'v 1.0' });
    const disposition = res.headers['content-disposition'];
    expect(disposition).toMatch(/^attachment; filename="[a-z0-9.-]+\.pdf"$/);
    expect(disposition).not.toMatch(/[\\/]|\.\./);
  });
});

describe('contenu du PDF', () => {
  it('contient les sections sélectionnées et exclut les autres', async () => {
    const p = await createProject();
    await api().post(`/api/projects/${p.id}/features`).send({ title: 'Réservation', priority: 'MUST', acceptanceCriteria: 'Critère détaillé' });
    await api().post(`/api/projects/${p.id}/scoping-items`).send({ type: 'RISK', title: 'Risque secret', severity: 'HIGH' });

    const dflt = (await readPdf(binary(await download(p.id)))).text;
    expect(dflt).toContain('Sommaire');
    expect(dflt).toContain('1. Présentation du projet');
    expect(dflt).toContain('Périmètre fonctionnel');
    expect(dflt).toContain('Conclusion');
    expect(dflt).toContain('Document de travail — Périmètre proposé');
    expect(dflt).not.toContain('Risque secret'); // risques exclus par défaut
    expect(dflt).not.toMatch(/projet validé|définitif/i);

    const withRisks = (await readPdf(binary(await download(p.id, { sections: { risks: true } })))).text;
    expect(withRisks).toContain('Risque secret');

    const minimal = (
      await readPdf(binary(await download(p.id, { sections: { context: false, scope: false, acceptance: false, technical: false, openQuestions: false, conclusion: false } })))
    ).text;
    expect(minimal).toContain('1. Présentation du projet');
    expect(minimal).not.toContain('Périmètre fonctionnel');
    expect(minimal).not.toContain('Conclusion');
  });

  it('préserve les accents et caractères typographiques français', async () => {
    const p = await createProject('Café « Œuvre » — L’été', { description: 'À l’écoute des élèves : naïveté, œuvre, çà et là.' });
    const text = (await readPdf(binary(await download(p.id)))).text;
    for (const s of ['Café « Œuvre » — L’été', 'À l’écoute des élèves : naïveté, œuvre, çà et là.', 'Éloïse Dupont — Cabinet Étoile', 'Critères d’acceptation']) {
      expect(text).toContain(s);
    }
  });

  it('gère un projet totalement vide (champs vides, aucune fonctionnalité)', async () => {
    const client = (await api().post('/api/clients').send({ name: 'Solo' })).body;
    const p = (await api().post('/api/projects').send({ clientId: client.id, name: 'Vide' })).body;
    const res = await download(p.id, { sections: { risks: true } });
    expect(res.status).toBe(200);
    const text = (await readPdf(binary(res))).text;
    expect(text).toContain('Non renseigné');
    expect(text).toContain('Aucune fonctionnalité n’a encore été définie');
    expect(text).toContain('Aucun risque identifié');
    expect(text).toContain('Aucune réponse de découverte');
  });

  it('reprend les réponses de découverte avec le libellé historique', async () => {
    const p = await createProject();
    const [c1] = (await api().get('/api/questions')).body;
    const q = c1.questions[0];
    await api().put(`/api/projects/${p.id}/answers/${q.id}`).send({ value: 'Réponse métier', isReviewed: true });
    const { Question } = await import('../src/models');
    await Question.update({ label: 'Libellé modifié ?' }, { where: { id: q.id } });
    try {
      const text = (await readPdf(binary(await download(p.id)))).text;
      expect(text).toContain(q.label);
      expect(text).toContain('Réponse métier');
      expect(text).not.toContain('Libellé modifié ?');
      expect(text).not.toContain(c1.questions[1].label); // sans réponse : exclue par défaut
      const all = (await readPdf(binary(await download(p.id, { includeUnansweredQuestions: true })))).text;
      expect(all).toContain(c1.questions[1].label);
    } finally {
      await seedQuestions();
    }
  });

  it('gère des données volumineuses (40 réponses longues, 60 fonctionnalités) sur plusieurs pages', async () => {
    const p = await createProject();
    const categories = (await api().get('/api/questions')).body;
    const long = 'Réponse détaillée avec éléphants, équipes et échéances. '.repeat(60);
    for (const c of categories) {
      for (const q of c.questions) {
        await api().put(`/api/projects/${p.id}/answers/${q.id}`).send({ value: `${long}\n\nFin ${q.id.slice(0, 4)}`, isReviewed: true });
      }
    }
    for (let i = 0; i < 60; i++) {
      await api().post(`/api/projects/${p.id}/features`).send({ title: `Fonctionnalité numéro ${i + 1}`, description: long.slice(0, 500), priority: (['MUST', 'SHOULD', 'COULD', 'WONT'] as const)[i % 4], acceptanceCriteria: long.slice(0, 300) });
    }
    await api().post(`/api/projects/${p.id}/scoping-items`).send({ type: 'DECISION', title: 'Mot interminable', description: 'x'.repeat(500) });

    const res = await download(p.id);
    expect(res.status).toBe(200);
    const pdf = await readPdf(binary(res));
    expect(pdf.numPages).toBeGreaterThan(15);
    expect(pdf.text).toContain('Fonctionnalité numéro 60');
    expect(pdf.text.replace(/\s/g, '')).toContain('x'.repeat(500)); // mot long : renvoyé à la ligne, jamais tronqué
    expect(pdf.text).toMatch(new RegExp(`Page ${pdf.numPages} / ${pdf.numPages}`));
    expect(pdf.text).toContain('Conclusion');
  }, 60_000);
});

describe('GET document/warnings', () => {
  it('404 / 400', async () => {
    expect((await api().get(`/api/projects/${randomUUID()}/document/warnings`)).status).toBe(404);
    expect((await api().get('/api/projects/abc/document/warnings')).status).toBe(400);
  });

  it('liste les avertissements d’un projet incomplet puis les retire', async () => {
    const client = (await api().post('/api/clients').send({ name: 'C' })).body;
    const p = (await api().post('/api/projects').send({ clientId: client.id, name: 'P' })).body;
    const codes = async () => (await api().get(`/api/projects/${p.id}/document/warnings`)).body.map((w: { code: string }) => w.code);
    expect(await codes()).toEqual(expect.arrayContaining(['MISSING_OBJECTIVE', 'NO_FEATURES', 'DISCOVERY_INCOMPLETE']));

    await api().patch(`/api/projects/${p.id}`).send({ objective: 'Un objectif', description: 'Une description' });
    await api().post(`/api/projects/${p.id}/features`).send({ title: 'F', priority: 'MUST' });
    await api().post(`/api/projects/${p.id}/scoping-items`).send({ type: 'RISK', title: 'R', severity: 'HIGH' });
    const after = await codes();
    expect(after).not.toContain('MISSING_OBJECTIVE');
    expect(after).not.toContain('NO_FEATURES');
    expect(after).toEqual(expect.arrayContaining(['MUST_WITHOUT_CRITERIA', 'HIGH_RISKS_UNRESOLVED']));
  });
});

describe('services', () => {
  it('safeFileSlug', () => {
    expect(safeFileSlug('Café Été', 'x')).toBe('cafe-ete');
    expect(safeFileSlug('../../a b', 'x')).toBe('a-b');
    expect(safeFileSlug('///', 'x')).toBe('x');
    expect(safeFileSlug('a'.repeat(200), 'x').length).toBeLessThanOrEqual(60);
  });

  it('generate est utilisable sans Express', async () => {
    const p = await createProject();
    const { documentOptionsSchema } = await import('../src/validation/schemas');
    const { buffer, filename } = await documentService.generate(p.id, documentOptionsSchema.parse({}), new Date('2026-01-15T12:00:00Z'));
    expect(filename).toBe('cahier-des-charges-reservation-ete-v0-1.pdf');
    expect((await readPdf(buffer)).text).toContain('15 janvier 2026');
  });
});
