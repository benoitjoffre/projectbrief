import { describe, expect, it } from 'vitest';
import { computeWarnings } from '../src/services/document/documentWarnings';
import { baseData } from './helpers/documentFixtures';

const codes = (data = baseData()) => computeWarnings(data).map((w) => w.code);

describe('avertissements du cahier des charges', () => {
  it('signale les informations manquantes d’un projet incomplet', () => {
    expect(codes()).toEqual([
      'MUST_WITHOUT_CRITERIA',
      'DISCOVERY_INCOMPLETE',
      'OPEN_QUESTIONS',
      'HIGH_RISKS_UNRESOLVED',
    ]);
    const w = computeWarnings(baseData());
    expect(w.find((x) => x.code === 'MUST_WITHOUT_CRITERIA')!.message).toContain('Paiement');
    expect(w.find((x) => x.code === 'DISCOVERY_INCOMPLETE')!.message).toContain('2 / 40');
  });

  it('signale objectif et description manquants', () => {
    const data = baseData();
    data.project.objective = ' ';
    data.project.description = null;
    expect(codes(data)).toEqual(expect.arrayContaining(['MISSING_OBJECTIVE', 'MISSING_DESCRIPTION']));
  });

  it('distingue « aucune fonctionnalité » et « aucune MUST »', () => {
    expect(codes(baseData({ features: [] }))).toContain('NO_FEATURES');
    expect(codes(baseData({ features: [] }))).not.toContain('NO_MUST_FEATURE');
    const onlyShould = baseData({ features: [{ title: 'X', description: null, priority: 'SHOULD', acceptanceCriteria: null }] });
    expect(codes(onlyShould)).toContain('NO_MUST_FEATURE');
  });

  it('ignore les risques HIGH résolus et les questions résolues', () => {
    const data = baseData({ scopingItems: baseData().scopingItems.filter((i) => i.status === 'RESOLVED') });
    expect(codes(data)).not.toContain('OPEN_QUESTIONS');
    expect(codes(data)).not.toContain('HIGH_RISKS_UNRESOLVED');
  });

  it('ne renvoie aucun avertissement pour un projet complet', () => {
    const data = baseData({
      discovery: { ...baseData().discovery, reviewedQuestions: 40, percentage: 100 },
      features: [{ title: 'A', description: 'd', priority: 'MUST', acceptanceCriteria: 'ok' }],
      scopingItems: [],
    });
    expect(computeWarnings(data)).toEqual([]);
  });
});
