import type { DocumentData } from './documentData';

export interface DocumentWarning {
  code:
    | 'MISSING_OBJECTIVE'
    | 'MISSING_DESCRIPTION'
    | 'NO_FEATURES'
    | 'NO_MUST_FEATURE'
    | 'MUST_WITHOUT_CRITERIA'
    | 'DISCOVERY_INCOMPLETE'
    | 'OPEN_QUESTIONS'
    | 'HIGH_RISKS_UNRESOLVED';
  message: string;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** Avertissements non bloquants calculés à partir des seules données du document. */
export function computeWarnings(data: DocumentData): DocumentWarning[] {
  const warnings: DocumentWarning[] = [];
  const add = (code: DocumentWarning['code'], message: string) => warnings.push({ code, message });

  if (!data.project.objective?.trim()) add('MISSING_OBJECTIVE', 'L’objectif du projet n’est pas renseigné.');
  if (!data.project.description?.trim()) add('MISSING_DESCRIPTION', 'La description du projet n’est pas renseignée.');

  const must = data.features.filter((f) => f.priority === 'MUST');
  if (data.features.length === 0) {
    add('NO_FEATURES', 'Aucune fonctionnalité n’est définie.');
  } else if (must.length === 0) {
    add('NO_MUST_FEATURE', 'Aucune fonctionnalité MUST : le MVP proposé est vide.');
  }
  const noCriteria = must.filter((f) => !f.acceptanceCriteria?.trim());
  if (noCriteria.length > 0) {
    add(
      'MUST_WITHOUT_CRITERIA',
      `${noCriteria.length} ${plural(noCriteria.length, 'fonctionnalité MUST sans critère', 'fonctionnalités MUST sans critères')} d’acceptation : ${noCriteria.map((f) => f.title).join(', ')}.`,
    );
  }

  const { reviewedQuestions, totalQuestions } = data.discovery;
  if (reviewedQuestions < totalQuestions) {
    add('DISCOVERY_INCOMPLETE', `Découverte incomplète : ${reviewedQuestions} / ${totalQuestions} questions validées.`);
  }

  const openQuestions = data.scopingItems.filter((i) => i.type === 'OPEN_QUESTION' && i.status !== 'RESOLVED');
  if (openQuestions.length > 0) {
    add('OPEN_QUESTIONS', `${openQuestions.length} ${plural(openQuestions.length, 'question ouverte non résolue', 'questions ouvertes non résolues')}.`);
  }
  const highRisks = data.scopingItems.filter(
    (i) => i.type === 'RISK' && i.severity === 'HIGH' && i.status !== 'RESOLVED',
  );
  if (highRisks.length > 0) {
    add('HIGH_RISKS_UNRESOLVED', `${highRisks.length} ${plural(highRisks.length, 'risque de sévérité élevée non résolu', 'risques de sévérité élevée non résolus')}.`);
  }
  return warnings;
}
