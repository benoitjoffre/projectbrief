import { DOCUMENT_SECTIONS, type DocumentOptions, type DocumentSection } from '../../api/types'

export const SECTION_LABELS: Record<DocumentSection, string> = {
  presentation: 'Présentation du projet',
  context: 'Contexte et besoins (réponses de découverte)',
  scope: 'Périmètre fonctionnel',
  acceptance: 'Critères d’acceptation',
  technical: 'Cadrage technique',
  risks: 'Risques',
  openQuestions: 'Questions ouvertes',
  conclusion: 'Conclusion',
}

/** Identiques aux valeurs par défaut du serveur : document client, sans les risques (données internes). */
export const DEFAULT_OPTIONS: DocumentOptions = {
  version: '0.1',
  sections: {
    presentation: true,
    context: true,
    scope: true,
    acceptance: true,
    technical: true,
    risks: false,
    openQuestions: true,
    conclusion: true,
  },
  includeNonMvpFeatures: true,
  includeUnansweredQuestions: false,
}

const VERSION_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,29}$/u

/** Même règles que le serveur (qui reste l'autorité) : évite un aller-retour inutile. */
export function validateOptions(options: DocumentOptions): string[] {
  const errors: string[] = []
  if (!VERSION_PATTERN.test(options.version.trim())) {
    errors.push('Version invalide : 30 caractères max (lettres, chiffres, espace, . _ -).')
  }
  if (!DOCUMENT_SECTIONS.some((s) => options.sections[s])) errors.push('Sélectionnez au moins une section.')
  return errors
}

/** Détient l'unique URL Blob courante et la libère dès qu'elle est remplacée ou abandonnée. */
export class BlobUrlHolder {
  private url: string | null = null

  set(blob: Blob): string {
    this.clear()
    this.url = URL.createObjectURL(blob)
    return this.url
  }

  clear() {
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
  }
}
