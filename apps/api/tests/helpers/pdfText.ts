// pdfjs-dist est une dépendance de test uniquement : elle sert à relire le PDF produit
// (structure + texte) sans comparaison binaire.
export async function readPdf(buffer: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  // Normalise les espaces et retire les césures invisibles ajoutées pour les mots très longs.
  const clean = (t: string) => t.replace(/​/g, '').replace(/\s+/g, ' ');
  return { numPages: doc.numPages as number, pages: pages.map(clean), text: clean(pages.join(' ')) };
}
