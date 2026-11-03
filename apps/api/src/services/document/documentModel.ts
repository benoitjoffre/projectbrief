import type { DocumentOptions, DocumentSection } from '../../validation/schemas';
import type { DocumentData, FeatureData, ScopingItemData } from './documentData';

/** Modèle de document neutre : aucune dépendance à Sequelize ni au moteur PDF. */
export type Block =
  | { type: 'paragraph'; text: string; muted?: boolean }
  | { type: 'subheading'; text: string }
  | { type: 'keyValues'; rows: Array<{ label: string; value: string | null }> }
  | { type: 'item'; title: string; badge?: { text: string; tone: Tone }; lines: ItemLine[] }
  | { type: 'bullets'; items: string[] };

export type Tone = 'accent' | 'danger' | 'warning' | 'info' | 'neutral' | 'success';
export interface ItemLine {
  label?: string;
  text: string;
  muted?: boolean;
}

export interface ModelSection {
  id: DocumentSection;
  /** Numéro consécutif parmi les sections incluses. */
  number: number;
  title: string;
  blocks: Block[];
}

export interface DocumentModel {
  title: string;
  draftNotice: string;
  cover: { projectName: string; clientName: string; generatedOn: string; version: string };
  sections: ModelSection[];
}

export const DRAFT_NOTICE = 'Document de travail — Périmètre proposé';

const TYPE_LABELS: Record<string, string> = {
  WEBSITE: 'Site web',
  WEB_APP: 'Application web',
  SAAS: 'SaaS',
  API: 'API',
  OTHER: 'Autre',
};
const STATUS_LABELS = { OPEN: 'Ouvert', IN_PROGRESS: 'En cours', RESOLVED: 'Résolu' } as const;
const SEVERITY_LABELS = { LOW: 'Faible', MEDIUM: 'Moyenne', HIGH: 'Élevée' } as const;
const SEVERITY_TONES = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' } as const;
const PRIORITY_LABELS = { MUST: 'Must', SHOULD: 'Should', COULD: 'Could', WONT: 'Won’t' } as const;
const PRIORITY_TONES = { MUST: 'accent', SHOULD: 'warning', COULD: 'info', WONT: 'neutral' } as const;
const PRIORITY_GROUPS = [
  { priority: 'MUST', title: 'Fonctionnalités Must — MVP proposé' },
  { priority: 'SHOULD', title: 'Fonctionnalités Should — importantes' },
  { priority: 'COULD', title: 'Fonctionnalités Could — souhaitables' },
  { priority: 'WONT', title: 'Fonctionnalités Won’t — hors périmètre de cette version' },
] as const;

const blank = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

export function formatFrenchDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(date);
}

type Builder = (data: DocumentData, options: DocumentOptions) => { title: string; blocks: Block[] };

const featureItem = (f: FeatureData, withCriteria = false): Block => ({
  type: 'item',
  title: f.title,
  badge: { text: PRIORITY_LABELS[f.priority], tone: PRIORITY_TONES[f.priority] },
  lines: withCriteria
    ? [{ text: f.acceptanceCriteria!.trim() }]
    : [blank(f.description) ? { text: f.description!.trim() } : { text: 'Pas de description.', muted: true }],
});

const scopingItem = (i: ScopingItemData, opts: { showStatus?: boolean; resolutionLabel?: string } = {}): Block => {
  const lines: ItemLine[] = [];
  if (blank(i.description)) lines.push({ text: i.description!.trim() });
  if (blank(i.resolution)) lines.push({ label: opts.resolutionLabel ?? 'Résolution', text: i.resolution!.trim() });
  if (lines.length === 0) lines.push({ text: 'Pas de précision.', muted: true });
  const parts: string[] = [];
  if (i.type === 'RISK' && i.severity) parts.push(`Sévérité ${SEVERITY_LABELS[i.severity]}`);
  if (opts.showStatus) parts.push(STATUS_LABELS[i.status]);
  return {
    type: 'item',
    title: i.title,
    badge: parts.length
      ? { text: parts.join(' · '), tone: i.type === 'RISK' && i.severity ? SEVERITY_TONES[i.severity] : 'neutral' }
      : undefined,
    lines,
  };
};

const BUILDERS: Record<DocumentSection, Builder> = {
  presentation: (data) => {
    const client = [data.client.name, data.client.company].filter(Boolean).join(' — ');
    // L'activité est la réponse à la toute première question de la découverte (« Quelle est votre activité… »).
    const activity = data.discovery.categories[0]?.entries[0];
    return {
      title: 'Présentation du projet',
      blocks: [
        {
          type: 'keyValues',
          rows: [
            { label: 'Client', value: blank(client) },
            { label: 'Activité', value: activity?.answer ?? null },
            { label: 'Projet', value: data.project.name },
            { label: 'Type de projet', value: TYPE_LABELS[data.project.type] ?? data.project.type },
            { label: 'Description', value: blank(data.project.description) },
            { label: 'Objectif', value: blank(data.project.objective) },
          ],
        },
      ],
    };
  },

  context: (data, options) => {
    const blocks: Block[] = [];
    for (const category of data.discovery.categories) {
      const entries = category.entries.filter((e) => e.answer !== null || options.includeUnansweredQuestions);
      if (entries.length === 0) continue;
      blocks.push({ type: 'subheading', text: category.title });
      for (const e of entries) {
        blocks.push({
          type: 'item',
          title: e.label,
          badge: e.answer !== null && !e.isReviewed ? { text: 'À confirmer', tone: 'warning' } : undefined,
          lines: [e.answer !== null ? { text: e.answer } : { text: 'Non renseignée.', muted: true }],
        });
      }
    }
    if (blocks.length === 0) {
      blocks.push({ type: 'paragraph', muted: true, text: 'Aucune réponse de découverte enregistrée à ce jour.' });
    }
    return { title: 'Contexte et besoins', blocks };
  },

  scope: (data, options) => {
    const blocks: Block[] = [];
    const groups = PRIORITY_GROUPS.filter((g) => options.includeNonMvpFeatures || g.priority === 'MUST');
    if (data.features.length === 0) {
      blocks.push({ type: 'paragraph', muted: true, text: 'Aucune fonctionnalité n’a encore été définie.' });
    } else {
      for (const g of groups) {
        const features = data.features.filter((f) => f.priority === g.priority);
        blocks.push({ type: 'subheading', text: `${g.title} (${features.length})` });
        if (features.length === 0) blocks.push({ type: 'paragraph', muted: true, text: 'Aucune fonctionnalité.' });
        for (const f of features) blocks.push(featureItem(f));
      }
    }
    return { title: 'Périmètre fonctionnel', blocks };
  },

  acceptance: (data, options) => {
    const features = data.features.filter(
      (f) => (options.includeNonMvpFeatures || f.priority === 'MUST') && blank(f.acceptanceCriteria),
    );
    return {
      title: 'Critères d’acceptation',
      blocks: features.length
        ? features.map((f) => featureItem(f, true))
        : [{ type: 'paragraph', muted: true, text: 'Aucun critère d’acceptation n’a encore été renseigné.' }],
    };
  },

  technical: (data) => {
    const blocks: Block[] = [];
    const groups = [
      { type: 'CONSTRAINT', title: 'Contraintes', showStatus: false },
      { type: 'DEPENDENCY', title: 'Dépendances', showStatus: false },
      { type: 'ASSUMPTION', title: 'Hypothèses', showStatus: false },
      { type: 'DECISION', title: 'Décisions', showStatus: false },
    ] as const;
    for (const g of groups) {
      const items = data.scopingItems.filter((i) => i.type === g.type);
      blocks.push({ type: 'subheading', text: g.title });
      if (items.length === 0) blocks.push({ type: 'paragraph', muted: true, text: 'Aucun élément.' });
      for (const i of items) {
        blocks.push(scopingItem(i, { resolutionLabel: g.type === 'DECISION' ? 'Décision' : 'Précision' }));
      }
    }
    return { title: 'Cadrage technique', blocks };
  },

  risks: (data) => {
    const items = data.scopingItems.filter((i) => i.type === 'RISK');
    return {
      title: 'Risques',
      blocks: items.length
        ? items.map((i) => scopingItem(i, { showStatus: true, resolutionLabel: 'Résolution' }))
        : [{ type: 'paragraph', muted: true, text: 'Aucun risque identifié à ce jour.' }],
    };
  },

  openQuestions: (data) => {
    const items = data.scopingItems.filter((i) => i.type === 'OPEN_QUESTION' && i.status !== 'RESOLVED');
    return {
      title: 'Questions ouvertes',
      blocks: items.length
        ? items.map((i) => scopingItem(i, { showStatus: true }))
        : [{ type: 'paragraph', muted: true, text: 'Aucune question ouverte non résolue.' }],
    };
  },

  conclusion: (data, options) => {
    const count = (p: string) => data.features.filter((f) => f.priority === p).length;
    const must = count('MUST');
    const blocks: Block[] = [
      {
        type: 'paragraph',
        text: `Périmètre proposé : ${must} ${must > 1 ? 'fonctionnalités' : 'fonctionnalité'} Must constituant le MVP proposé.`,
      },
    ];
    if (options.includeNonMvpFeatures) {
      blocks.push({
        type: 'paragraph',
        text: `Hors MVP : ${count('SHOULD')} Should, ${count('COULD')} Could, ${count('WONT')} Won’t.`,
      });
    }
    const bullets: string[] = [];
    if (options.sections.openQuestions) {
      const n = data.scopingItems.filter((i) => i.type === 'OPEN_QUESTION' && i.status !== 'RESOLVED').length;
      bullets.push(`Questions ouvertes à traiter : ${n}`);
    }
    if (options.sections.risks) {
      const high = data.scopingItems.filter(
        (i) => i.type === 'RISK' && i.severity === 'HIGH' && i.status !== 'RESOLVED',
      );
      bullets.push(
        high.length
          ? `Principaux risques non résolus : ${high.map((r) => r.title).join(' ; ')}`
          : 'Aucun risque de sévérité élevée non résolu',
      );
    }
    if (bullets.length) blocks.push({ type: 'bullets', items: bullets });
    blocks.push({
      type: 'paragraph',
      text: 'Ce document est un document de travail. Il doit être relu, complété et validé par les parties concernées avant toute décision. Il ne constitue ni un engagement contractuel, ni un devis.',
    });
    return { title: 'Conclusion', blocks };
  },
};

const ORDER: readonly DocumentSection[] = [
  'presentation',
  'context',
  'scope',
  'acceptance',
  'technical',
  'risks',
  'openQuestions',
  'conclusion',
];

/** Sélectionne les sections demandées et construit le modèle, sans rien savoir du rendu. */
export function buildDocumentModel(data: DocumentData, options: DocumentOptions): DocumentModel {
  const sections = ORDER.filter((id) => options.sections[id]).map((id, index): ModelSection => {
    const { title, blocks } = BUILDERS[id](data, options);
    return { id, number: index + 1, title, blocks };
  });
  return {
    title: `Cahier des charges — ${data.project.name}`,
    draftNotice: DRAFT_NOTICE,
    cover: {
      projectName: data.project.name,
      clientName: [data.client.name, data.client.company].filter(Boolean).join(' — '),
      generatedOn: formatFrenchDate(data.generatedAt),
      version: options.version,
    },
    sections,
  };
}
