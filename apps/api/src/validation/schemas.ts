import { z } from 'zod';
import { PROJECT_STATUSES, PROJECT_TYPES } from '../models';

// Champ texte optionnel : trim, chaîne vide => null.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const requiredText = (max: number) => z.string().trim().min(1, 'Champ obligatoire').max(max);

const optionalEmail = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.email('Email invalide').nullable());

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ')
  .refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v), 'Date invalide');

const optionalDate = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(isoDate.nullable());

export const idParamSchema = z.object({ id: z.uuid('Identifiant invalide') });

export const createClientSchema = z.strictObject({
  name: requiredText(255),
  email: optionalEmail,
  phone: optionalText(50),
  company: optionalText(255),
});

export const updateClientSchema = createClientSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Aucun champ à modifier');

export const createProjectSchema = z.strictObject({
  clientId: z.uuid('clientId invalide'),
  name: requiredText(255),
  description: optionalText(10_000),
  objective: optionalText(10_000),
  type: z.enum(PROJECT_TYPES).default('OTHER'),
  status: z.enum(PROJECT_STATUSES).default('DRAFT'),
  deadline: optionalDate,
});

// Le client d'un projet n'est pas modifiable (clientId rejeté par strictObject).
export const updateProjectSchema = createProjectSchema
  .omit({ clientId: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Aucun champ à modifier');

export const listProjectsQuerySchema = z.object({
  clientId: z.uuid().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
