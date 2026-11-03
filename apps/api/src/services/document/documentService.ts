import type { DocumentOptions } from '../../validation/schemas';
import { documentDataService } from './documentData';
import { buildDocumentModel } from './documentModel';
import { renderPdf } from './pdfRenderer';
import { computeWarnings } from './documentWarnings';

/** Nom de fichier ASCII sûr : pas de séparateur de chemin, de guillemet ni de saut de ligne. */
export function safeFileSlug(value: string, fallback: string, maxLength = 60): string {
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug || fallback;
}

export const documentService = {
  /** Point d'entrée unique pour l'aperçu et le téléchargement : mêmes données, même rendu. */
  async generate(projectId: string, options: DocumentOptions, generatedAt: Date = new Date()) {
    const data = await documentDataService.collect(projectId, generatedAt);
    const model = buildDocumentModel(data, options);
    const buffer = await renderPdf(model);
    const filename = `cahier-des-charges-${safeFileSlug(data.project.name, 'projet')}-v${safeFileSlug(options.version, '0')}.pdf`;
    return { buffer, filename };
  },

  async warnings(projectId: string) {
    return computeWarnings(await documentDataService.collect(projectId));
  },
};
