import { describe, expect, it } from 'vitest';
import { buildDocumentModel, DRAFT_NOTICE } from '../src/services/document/documentModel';
import { baseData, options } from './helpers/documentFixtures';
import type { Block } from '../src/services/document/documentModel';

const allText = (blocks: Block[]) => JSON.stringify(blocks);
const sectionIds = (opts: Record<string, unknown> = {}, data = baseData()) =>
  buildDocumentModel(data, options(opts)).sections.map((s) => s.id);

describe('options par défaut (document client)', () => {
  it('excluent les risques, incluent le reste', () => {
    expect(sectionIds()).toEqual([
      'presentation', 'context', 'scope', 'acceptance', 'technical', 'openQuestions', 'conclusion',
    ]);
  });

  it('numérotent consécutivement les sections incluses', () => {
    const m = buildDocumentModel(baseData(), options({ sections: { context: false, technical: false } }));
    expect(m.sections.map((s) => [s.number, s.id])).toEqual([
      [1, 'presentation'], [2, 'scope'], [3, 'acceptance'], [4, 'openQuestions'], [5, 'conclusion'],
    ]);
  });

  it('respectent les sections demandées, y compris les risques', () => {
    expect(sectionIds({ sections: { risks: true } })).toContain('risks');
    expect(sectionIds({ sections: { scope: false, acceptance: false } })).not.toContain('scope');
  });
});

describe('couverture et mentions', () => {
  it('porte la mention « Document de travail » et jamais « validé » / « définitif »', () => {
    const m = buildDocumentModel(baseData(), options({ version: '1.2', sections: { risks: true } }));
    expect(m.draftNotice).toBe(DRAFT_NOTICE);
    expect(m.cover).toEqual({
      projectName: 'Plateforme de réservation',
      clientName: 'Éloïse Dupont — Cabinet Étoile',
      generatedOn: '3 novembre 2026',
      version: '1.2',
    });
    const json = JSON.stringify(m);
    expect(json).not.toMatch(/projet validé|définitif|MVP validé/i);
    expect(json).toContain('MVP proposé');
  });
});

describe('contexte et besoins', () => {
  it('exclut les questions sans réponse par défaut et garde le libellé historique', () => {
    const data = baseData();
    data.discovery.categories[0].entries[0].label = 'Ancien libellé ?';
    const ctx = buildDocumentModel(data, options()).sections.find((s) => s.id === 'context')!;
    const text = allText(ctx.blocks);
    expect(text).toContain('Ancien libellé ?');
    expect(text).not.toContain('Comment fonctionne votre activité aujourd’hui');
  });

  it('inclut les questions sans réponse sur demande', () => {
    const ctx = buildDocumentModel(baseData(), options({ includeUnansweredQuestions: true })).sections.find((s) => s.id === 'context')!;
    expect(allText(ctx.blocks)).toContain('Non renseignée');
  });

  it('signale les réponses non validées', () => {
    const ctx = buildDocumentModel(baseData(), options()).sections.find((s) => s.id === 'context')!;
    expect(allText(ctx.blocks)).toContain('À confirmer');
  });

  it('gère l’absence totale de réponses', () => {
    const data = baseData({ discovery: { totalQuestions: 40, reviewedQuestions: 0, percentage: 0, categories: [] } });
    const ctx = buildDocumentModel(data, options()).sections.find((s) => s.id === 'context')!;
    expect(allText(ctx.blocks)).toContain('Aucune réponse de découverte');
  });
});

describe('périmètre et critères', () => {
  it('exclut les fonctionnalités hors MVP sur demande (périmètre, critères, conclusion)', () => {
    const m = buildDocumentModel(baseData(), options({ includeNonMvpFeatures: false }));
    const text = JSON.stringify(m.sections);
    expect(text).toContain('Réservation en ligne');
    expect(text).not.toContain('Export comptable');
    expect(text).not.toContain('Application mobile');
    expect(text).not.toContain('Hors MVP');
  });

  it('liste les critères avec la fonctionnalité correspondante', () => {
    const acc = buildDocumentModel(baseData(), options()).sections.find((s) => s.id === 'acceptance')!;
    expect(acc.blocks).toContainEqual(
      expect.objectContaining({ type: 'item', title: 'Réservation en ligne', lines: [{ text: 'Un client peut réserver en moins de 3 clics.' }] }),
    );
    expect(allText(acc.blocks)).not.toContain('Paiement'); // pas de critères renseignés
  });

  it('fonctionne sans aucune fonctionnalité', () => {
    const m = buildDocumentModel(baseData({ features: [] }), options());
    const scope = m.sections.find((s) => s.id === 'scope')!;
    expect(allText(scope.blocks)).toContain('Aucune fonctionnalité n’a encore été définie');
    expect(allText(m.sections.find((s) => s.id === 'acceptance')!.blocks)).toContain('Aucun critère');
    expect(allText(m.sections.find((s) => s.id === 'conclusion')!.blocks)).toContain('0 fonctionnalité Must');
  });
});

describe('présentation : champs vides', () => {
  it('représente les champs absents par null (rendu « Non renseigné »)', () => {
    const data = baseData();
    data.project.description = '   ';
    data.project.objective = null;
    data.client.company = null;
    const block = buildDocumentModel(data, options()).sections[0].blocks[0];
    const rows = (block as Extract<Block, { type: 'keyValues' }>).rows;
    expect(rows.find((r) => r.label === 'Description')!.value).toBeNull();
    expect(rows.find((r) => r.label === 'Objectif')!.value).toBeNull();
    expect(rows.find((r) => r.label === 'Client')!.value).toBe('Éloïse Dupont');
  });
});

describe('risques, questions ouvertes, conclusion', () => {
  it('ne liste que les questions ouvertes non résolues', () => {
    const q = buildDocumentModel(baseData(), options()).sections.find((s) => s.id === 'openQuestions')!;
    expect(allText(q.blocks)).toContain('Qui valide les tarifs ?');
    expect(allText(q.blocks)).not.toContain('Langue de l’interface');
  });

  it('affiche sévérité, statut et résolution des risques', () => {
    const r = buildDocumentModel(baseData(), options({ sections: { risks: true } })).sections.find((s) => s.id === 'risks')!;
    const text = allText(r.blocks);
    expect(text).toContain('Sévérité Élevée · Ouvert');
    expect(text).toContain('Sévérité Faible · Résolu');
    expect(text).toContain('Documentation à jour.');
  });

  it('n’expose pas les risques dans la conclusion quand la section est exclue', () => {
    const concl = buildDocumentModel(baseData(), options()).sections.at(-1)!;
    expect(allText(concl.blocks)).not.toContain('Délai de paiement');
    expect(allText(concl.blocks)).toContain('Questions ouvertes à traiter : 1');
    const withRisks = buildDocumentModel(baseData(), options({ sections: { risks: true } })).sections.at(-1)!;
    expect(allText(withRisks.blocks)).toContain('Délai de paiement');
    expect(allText(withRisks.blocks)).toContain('validé par les parties concernées');
  });
});
