import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDb, resetDb, seedQuestions } from './setup';
import { readPdf } from './helpers/pdfText';

beforeAll(seedQuestions);
beforeEach(resetDb);
afterAll(closeDb);

/** Parcours complet : client → projet → découverte → cadrage → synthèse → PDF. */
describe('recette fonctionnelle de bout en bout', () => {
  it('produit un cahier des charges fidèle aux données saisies', async () => {
    // 1-2. Client et projet
    const client = (await api().post('/api/clients').send({ name: 'Camille Martin', company: 'Atelier Lumière' })).body;
    const project = (
      await api().post('/api/projects').send({ clientId: client.id, name: 'Boutique en ligne', type: 'WEB_APP', objective: 'Vendre en ligne' })
    ).body;
    const pid = project.id;

    // 3-4. Réponses à plusieurs questions, validées (dont une vide, qui ne doit pas compter)
    const categories = (await api().get('/api/questions')).body;
    const [q1, q2, q3] = categories[0].questions;
    await api().put(`/api/projects/${pid}/answers/${q1.id}`).send({ value: 'Atelier de céramique à Lyon', isReviewed: true });
    await api().put(`/api/projects/${pid}/answers/${q2.id}`).send({ value: 'Fermeture de la boutique physique', isReviewed: true });
    await api().put(`/api/projects/${pid}/answers/${q3.id}`).send({ value: '', isReviewed: true });
    expect((await api().get(`/api/projects/${pid}/discovery/progress`)).body).toEqual({ totalQuestions: 40, reviewedQuestions: 2, percentage: 5 });

    // 5-6. Fonctionnalités MUST / SHOULD / WONT avec critères d'acceptation
    const must = (await api().post(`/api/projects/${pid}/features`).send({ title: 'Catalogue produits', priority: 'MUST', description: 'Parcourir les créations.' })).body;
    await api().post(`/api/projects/${pid}/features`).send({ title: 'Avis clients', priority: 'SHOULD', acceptanceCriteria: 'Un client peut noter un produit.' });
    await api().post(`/api/projects/${pid}/features`).send({ title: 'Marketplace multi-vendeurs', priority: 'WONT' });
    await api().patch(`/api/projects/${pid}/features/${must.id}`).send({ acceptanceCriteria: 'Les produits sont filtrables par catégorie.' });

    // Cadrage
    await api().post(`/api/projects/${pid}/scoping-items`).send({ type: 'RISK', title: 'Livraison fragile', severity: 'HIGH' });
    await api().post(`/api/projects/${pid}/scoping-items`).send({ type: 'OPEN_QUESTION', title: 'Quel transporteur ?' });
    await api().post(`/api/projects/${pid}/scoping-items`).send({ type: 'DECISION', title: 'Paiement', status: 'RESOLVED', resolution: 'Stripe' });

    // Synthèse cohérente
    const summary = (await api().get(`/api/projects/${pid}/summary`)).body;
    expect(summary.mvp.map((f: { title: string }) => f.title)).toEqual(['Catalogue produits']);
    expect(summary.openQuestions).toHaveLength(1);
    expect(summary.unresolvedHighRisks).toHaveLength(1);
    expect(summary.decisionsCount).toBe(1);

    // Avertissements non bloquants : projet incomplet mais exportable
    const warnings = (await api().get(`/api/projects/${pid}/document/warnings`)).body.map((w: { code: string }) => w.code);
    expect(warnings).toEqual(['MISSING_DESCRIPTION', 'DISCOVERY_INCOMPLETE', 'OPEN_QUESTIONS', 'HIGH_RISKS_UNRESOLVED']);

    // Export : options par défaut (document client) puis avec risques
    const get = async (body: object) => {
      const res = await api().post(`/api/projects/${pid}/document/download`).send(body).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      return (await readPdf(res.body as Buffer)).text;
    };
    const client_doc = await get({ version: '0.3' });
    for (const expected of [
      'Boutique en ligne',
      'Camille Martin — Atelier Lumière',
      'Version du document : 0.3',
      'Atelier de céramique à Lyon',
      'Fermeture de la boutique physique',
      'Catalogue produits',
      'Les produits sont filtrables par catégorie.',
      'Avis clients',
      'Marketplace multi-vendeurs',
      'Quel transporteur ?',
      'Stripe',
      'MVP proposé',
      'Document de travail — Périmètre proposé',
      'validé par les parties concernées',
    ]) {
      expect(client_doc, expected).toContain(expected);
    }
    expect(client_doc).not.toContain('Livraison fragile'); // risque interne : exclu par défaut
    expect(client_doc).not.toMatch(/projet validé|définitif|budget|devis :/i);

    const internal = await get({ sections: { risks: true } });
    expect(internal).toContain('Livraison fragile');
    expect(internal).toContain('Principaux risques non résolus : Livraison fragile');
  });
});
