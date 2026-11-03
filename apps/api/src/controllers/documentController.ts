import type { Request, Response } from 'express';
import { documentService } from '../services/document/documentService';
import { documentOptionsSchema, projectIdParamSchema } from '../validation/schemas';

async function sendPdf(req: Request, res: Response, disposition: 'inline' | 'attachment') {
  const { projectId } = projectIdParamSchema.parse(req.params);
  // Express 5 : req.body est undefined quand aucun corps n'est envoyé.
  const options = documentOptionsSchema.parse(req.body ?? {});
  const { buffer, filename } = await documentService.generate(projectId, options);
  res
    .status(200)
    .set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(buffer.length),
      'Content-Disposition': disposition === 'inline' ? 'inline' : `attachment; filename="${filename}"`,
      // Document client : jamais mis en cache ni interprété autrement que comme un PDF.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    .end(buffer);
}

export const documentController = {
  preview: (req: Request, res: Response) => sendPdf(req, res, 'inline'),
  download: (req: Request, res: Response) => sendPdf(req, res, 'attachment'),
  async warnings(req: Request, res: Response) {
    const { projectId } = projectIdParamSchema.parse(req.params);
    res.json(await documentService.warnings(projectId));
  },
};
