import path from 'node:path';
import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Block, DocumentModel, Tone } from './documentModel';

// pdfmake exporte une instance unique (CommonJS) ; ses méthodes sont sur le prototype,
// d'où le require plutôt qu'un `import * as`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require('pdfmake') as typeof import('pdfmake');

const FONT_DIR = path.join(path.dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
pdfmake.setFonts({
  Roboto: {
    normal: path.join(FONT_DIR, 'Roboto-Regular.ttf'),
    bold: path.join(FONT_DIR, 'Roboto-Medium.ttf'),
    italics: path.join(FONT_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(FONT_DIR, 'Roboto-MediumItalic.ttf'),
  },
});
// Aucune ressource locale ou distante n'est lue en dehors des polices ci-dessus.
pdfmake.setLocalAccessPolicy((file) => file.startsWith(FONT_DIR));
pdfmake.setUrlAccessPolicy(() => false);

const COLORS = {
  accent: '#6C47FF',
  heading: '#1A1A2E',
  text: '#2B2B3B',
  muted: '#6B7280',
  rule: '#E5E7EB',
};
const TONE_COLORS: Record<Tone, string> = {
  accent: COLORS.accent,
  danger: '#B91C1C',
  warning: '#B45309',
  info: '#1D4ED8',
  neutral: COLORS.muted,
  success: '#15803D',
};

const MARGIN_X = 56;
const PAGE_WIDTH = 595.28 - 2 * MARGIN_X;

/**
 * Autorise un retour à la ligne dans les très longues suites sans espace (URL, identifiants),
 * qui sinon déborderaient de la page.
 */
export function softWrap(text: string, max = 40): string {
  return text.replace(new RegExp(`\\S{${max + 1},}`, 'g'), (word) =>
    word.replace(new RegExp(`(.{${max}})`, 'g'), '$1​'),
  );
}

/** Fragment de contenu ; `heading` signale un titre à garder avec ce qui le suit. */
interface Piece {
  node: Content;
  heading?: boolean;
  /** Nombre approximatif de caractères, pour ne pas rendre insécable un bloc plus grand qu'une page. */
  size?: number;
}

const BIND_LIMIT = 700;
const plain = (node: Content): Piece => ({ node, size: textSize(node) });
function textSize(node: Content): number {
  const n = node as { text?: unknown; ul?: unknown[] };
  const t = n.text;
  if (typeof t === 'string') return t.length;
  if (Array.isArray(t)) return t.reduce((sum: number, r) => sum + (typeof r === 'string' ? r.length : String((r as { text?: string }).text ?? '').length), 0);
  return n.ul ? JSON.stringify(n.ul).length : 0;
}

/**
 * Regroupe chaque suite de titres avec le premier contenu qui la suit dans un stack insécable :
 * un titre n'est ainsi jamais seul en bas de page. Un contenu trop long n'est pas lié (il se coupe normalement).
 */
export function bindHeadings(pieces: Piece[]): Content[] {
  const out: Content[] = [];
  let i = 0;
  while (i < pieces.length) {
    if (!pieces[i].heading) {
      out.push(pieces[i].node);
      i++;
      continue;
    }
    const group: Content[] = [];
    while (i < pieces.length && pieces[i].heading) group.push(pieces[i++].node);
    if (i < pieces.length && (pieces[i].size ?? 0) <= BIND_LIMIT) group.push(pieces[i++].node);
    out.push(group.length === 1 ? group[0] : { stack: group, unbreakable: true });
  }
  return out;
}

function blockToContent(block: Block): Piece[] {
  switch (block.type) {
    case 'paragraph':
      return [plain({ text: softWrap(block.text), style: block.muted ? 'muted' : 'body', margin: [0, 0, 0, 8] })];
    case 'subheading':
      return [{ node: { text: softWrap(block.text), style: 'h2' }, heading: true }];
    case 'bullets':
      return [plain({ ul: block.items.map(softWrap), style: 'body', margin: [0, 0, 0, 8] })];
    case 'keyValues':
      return block.rows.map((row) => plain({
        text: [
          { text: `${row.label} : `, bold: true, color: COLORS.heading },
          row.value
            ? { text: softWrap(row.value) }
            : { text: 'Non renseigné', italics: true, color: COLORS.muted },
        ],
        style: 'body',
        margin: [0, 0, 0, 6],
      }));
    case 'item': {
      const title: ContentText = {
        text: [
          { text: softWrap(block.title), bold: true, color: COLORS.heading },
          ...(block.badge
            ? [{ text: `   ${block.badge.text}`, bold: true, fontSize: 8.5, color: TONE_COLORS[block.badge.tone] }]
            : []),
        ],
        style: 'body',
        margin: [0, 4, 0, 2],
      };
      const lines = block.lines.map((line, i, all): ContentText => ({
        text: [
          ...(line.label ? [{ text: `${line.label} : `, bold: true, color: COLORS.heading }] : []),
          { text: softWrap(line.text), ...(line.muted ? { italics: true, color: COLORS.muted } : {}) },
        ],
        style: 'body',
        margin: [10, 0, 0, i === all.length - 1 ? 8 : 3],
      }));
      return [{ node: title, heading: true }, ...lines.map(plain)];
    }
  }
}

export function buildDocDefinition(model: DocumentModel): TDocumentDefinitions {
  const cover: Content[] = [
    { text: 'CAHIER DES CHARGES', style: 'coverKicker', margin: [0, 150, 0, 14] },
    { text: softWrap(model.cover.projectName, 24), style: 'coverTitle' },
    { canvas: [{ type: 'rect', x: 0, y: 0, w: 70, h: 5, color: COLORS.accent }], margin: [0, 22, 0, 22] },
    ...(model.cover.clientName
      ? [{ text: [{ text: 'Client : ', color: COLORS.muted }, { text: model.cover.clientName, bold: true }], style: 'coverMeta' } as Content]
      : []),
    { text: [{ text: 'Date de génération : ', color: COLORS.muted }, { text: model.cover.generatedOn }], style: 'coverMeta' },
    { text: [{ text: 'Version du document : ', color: COLORS.muted }, { text: model.cover.version }], style: 'coverMeta' },
    { text: model.draftNotice, style: 'coverNotice', margin: [0, 36, 0, 0] },
  ];

  const toc: Content[] = [
    {
      toc: {
        title: { text: 'Sommaire', style: 'h1' },
        numberStyle: { bold: false, color: COLORS.muted },
      },
      pageBreak: 'before',
    } as Content,
    { text: '', pageBreak: 'after' },
  ];

  const body = bindHeadings(
    model.sections.flatMap((section): Piece[] => [
      {
        node: {
          text: `${section.number}. ${section.title}`,
          style: 'h1',
          tocItem: true,
        } as Content,
        heading: true,
      },
      {
        node: { canvas: [{ type: 'line', x1: 0, y1: 0, x2: PAGE_WIDTH, y2: 0, lineWidth: 0.75, lineColor: COLORS.rule }], margin: [0, 0, 0, 12] } as Content,
        heading: true,
      },
      ...section.blocks.flatMap(blockToContent),
    ]),
  );

  return {
    info: { title: model.title, author: 'ProjectBrief', subject: model.draftNotice },
    pageSize: 'A4',
    pageMargins: [MARGIN_X, 72, MARGIN_X, 64],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.3, color: COLORS.text },
    styles: {
      body: { fontSize: 10.5 },
      muted: { fontSize: 10.5, italics: true, color: COLORS.muted },
      h1: { fontSize: 18, bold: true, color: COLORS.heading, margin: [0, 18, 0, 6] },
      h2: { fontSize: 13, bold: true, color: COLORS.accent, margin: [0, 12, 0, 6] },
      coverKicker: { fontSize: 11, bold: true, color: COLORS.accent, characterSpacing: 2 },
      coverTitle: { fontSize: 32, bold: true, color: COLORS.heading, lineHeight: 1.15 },
      coverMeta: { fontSize: 12, margin: [0, 0, 0, 6] },
      coverNotice: { fontSize: 12, bold: true, color: COLORS.accent },
    },
    // La couverture (page 1) n'a ni en-tête ni pied de page.
    header: (page) =>
      page === 1
        ? null
        : {
            columns: [
              { text: softWrap(model.cover.projectName, 30), noWrap: true },
              { text: model.draftNotice, alignment: 'right', noWrap: true },
            ],
            margin: [MARGIN_X, 30, MARGIN_X, 0],
            fontSize: 8,
            color: COLORS.muted,
          },
    footer: (page, count) =>
      page === 1
        ? null
        : {
            columns: [
              { text: `Version ${model.cover.version}` },
              { text: `Page ${page} / ${count}`, alignment: 'right' },
            ],
            margin: [MARGIN_X, 24, MARGIN_X, 0],
            fontSize: 8,
            color: COLORS.muted,
          },
    content: [...cover, ...toc, ...body],
  };
}

export async function renderPdf(model: DocumentModel): Promise<Buffer> {
  return pdfmake.createPdf(buildDocDefinition(model)).getBuffer();
}
