import { documentOptionsSchema } from '../../src/validation/schemas';
import type { DocumentData } from '../../src/services/document/documentData';

export const GENERATED_AT = new Date('2026-11-03T10:00:00Z');

export const options = (overrides: Record<string, unknown> = {}) => documentOptionsSchema.parse(overrides);

export function baseData(overrides: Partial<DocumentData> = {}): DocumentData {
  return {
    generatedAt: GENERATED_AT,
    project: {
      name: 'Plateforme de réservation',
      type: 'WEB_APP',
      description: 'Une application de réservation pour des salles de réunion.',
      objective: 'Réduire le temps de gestion des réservations.',
    },
    client: { name: 'Éloïse Dupont', company: 'Cabinet Étoile' },
    discovery: {
      totalQuestions: 40,
      reviewedQuestions: 2,
      percentage: 5,
      categories: [
        {
          title: 'Client et activité',
          entries: [
            { label: 'Quelle est votre activité et qui sont vos clients ?', answer: 'Location de salles à Besançon.', isReviewed: true },
            { label: 'Pourquoi souhaitez-vous lancer ce projet maintenant ?', answer: 'Évolution de la réglementation.', isReviewed: false },
            { label: 'Comment fonctionne votre activité aujourd’hui ?', answer: null, isReviewed: false },
          ],
        },
        {
          title: 'Utilisateurs',
          entries: [{ label: 'Qui utilisera la solution au quotidien ?', answer: 'L’équipe d’accueil.', isReviewed: true }],
        },
      ],
    },
    features: [
      { title: 'Réservation en ligne', description: 'Choisir une salle et un créneau.', priority: 'MUST', acceptanceCriteria: 'Un client peut réserver en moins de 3 clics.' },
      { title: 'Paiement', description: null, priority: 'MUST', acceptanceCriteria: null },
      { title: 'Export comptable', description: 'Export CSV mensuel.', priority: 'SHOULD', acceptanceCriteria: 'Le CSV contient toutes les réservations du mois.' },
      { title: 'Application mobile', description: 'Version native.', priority: 'WONT', acceptanceCriteria: null },
    ],
    scopingItems: [
      { type: 'CONSTRAINT', title: 'Hébergement en France', description: 'Exigence RGPD.', status: 'OPEN', severity: null, resolution: null },
      { type: 'DEPENDENCY', title: 'API de paiement', description: null, status: 'OPEN', severity: null, resolution: null },
      { type: 'ASSUMPTION', title: 'Moins de 50 utilisateurs', description: null, status: 'OPEN', severity: null, resolution: null },
      { type: 'DECISION', title: 'Stack React / Node', description: null, status: 'RESOLVED', severity: null, resolution: 'React côté web, Node côté API.' },
      { type: 'RISK', title: 'Délai de paiement', description: 'Dépend du prestataire.', status: 'OPEN', severity: 'HIGH', resolution: null },
      { type: 'RISK', title: 'Rotation de l’équipe', description: null, status: 'RESOLVED', severity: 'LOW', resolution: 'Documentation à jour.' },
      { type: 'OPEN_QUESTION', title: 'Qui valide les tarifs ?', description: 'À clarifier avec la direction.', status: 'OPEN', severity: null, resolution: null },
      { type: 'OPEN_QUESTION', title: 'Langue de l’interface ?', description: null, status: 'RESOLVED', severity: null, resolution: 'Français.' },
    ],
    ...overrides,
  };
}

const LONG = 'Lorem ipsum dolor sit amet, éléphant à l’été — consectetur adipiscing elit. '.repeat(40);

/** Jeu volumineux : 40 réponses longues, 60 fonctionnalités, mots interminables. */
export function heavyData(): DocumentData {
  const categories = Array.from({ length: 8 }, (_, c) => ({
    title: `Catégorie ${c + 1} — Éléments détaillés`,
    entries: Array.from({ length: 5 }, (_, q) => ({
      label: `Question ${c + 1}.${q + 1} : quelle est la réponse détaillée à cette question assez longue ?`,
      answer: `${LONG}\n\nSecond paragraphe de la réponse ${c + 1}.${q + 1}.`,
      isReviewed: true,
    })),
  }));
  categories[0].entries[0].answer = `https://exemple.fr/${'a'.repeat(300)}`;
  return baseData({
    discovery: { totalQuestions: 40, reviewedQuestions: 40, percentage: 100, categories },
    features: Array.from({ length: 60 }, (_, i) => ({
      title: `Fonctionnalité ${i + 1}`,
      description: LONG.slice(0, 600),
      priority: (['MUST', 'SHOULD', 'COULD', 'WONT'] as const)[i % 4],
      acceptanceCriteria: i % 2 ? LONG.slice(0, 400) : null,
    })),
  });
}
