import { z } from 'zod';
import {
  FEATURE_PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  SCOPING_SEVERITIES,
  SCOPING_STATUSES,
  SCOPING_TYPES,
} from '../models';

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

export const answerParamsSchema = z.object({
  projectId: z.uuid('Identifiant de projet invalide'),
  questionId: z.uuid('Identifiant de question invalide'),
});

export const projectIdParamSchema = z.object({ projectId: z.uuid('Identifiant de projet invalide') });

// `value` n'est volontairement pas trim : on conserve la saisie telle quelle (retours à la ligne inclus).
export const upsertAnswerSchema = z
  .strictObject({
    value: z.string().max(20_000, 'Réponse trop longue').optional(),
    isReviewed: z.boolean().optional(),
  })
  .refine((v) => v.value !== undefined || v.isReviewed !== undefined, 'Aucun champ à modifier');

export type UpsertAnswerInput = z.infer<typeof upsertAnswerSchema>;

const nonEmptyPatch = (v: object) => Object.keys(v).length > 0;

export const featureParamsSchema = z.object({
  projectId: z.uuid('Identifiant de projet invalide'),
  featureId: z.uuid('Identifiant de fonctionnalité invalide'),
});

const featureShape = {
  title: requiredText(255),
  description: optionalText(10_000),
  priority: z.enum(FEATURE_PRIORITIES),
  acceptanceCriteria: optionalText(10_000),
  sortOrder: z.number().int().min(0).max(1_000_000),
};

export const createFeatureSchema = z.strictObject({
  ...featureShape,
  priority: featureShape.priority.default('COULD'),
  sortOrder: featureShape.sortOrder.default(0),
});

// Pas de .default() ici : une mise à jour partielle ne doit jamais réinitialiser un champ omis.
export const updateFeatureSchema = z
  .strictObject(featureShape)
  .partial()
  .refine(nonEmptyPatch, 'Aucun champ à modifier');

export const scopingItemParamsSchema = z.object({
  projectId: z.uuid('Identifiant de projet invalide'),
  itemId: z.uuid('Identifiant d’élément invalide'),
});

export const listScopingItemsQuerySchema = z.object({
  type: z.enum(SCOPING_TYPES).optional(),
  status: z.enum(SCOPING_STATUSES).optional(),
});

const scopingItemShape = {
  type: z.enum(SCOPING_TYPES),
  title: requiredText(255),
  description: optionalText(10_000),
  status: z.enum(SCOPING_STATUSES),
  severity: z.enum(SCOPING_SEVERITIES).nullable(),
  resolution: optionalText(10_000),
};

export const createScopingItemSchema = z.strictObject({
  ...scopingItemShape,
  status: scopingItemShape.status.default('OPEN'),
  severity: scopingItemShape.severity.nullish().transform((v) => v ?? null),
  resolution: scopingItemShape.resolution,
});

export const updateScopingItemSchema = z
  .strictObject(scopingItemShape)
  .partial()
  .refine(nonEmptyPatch, 'Aucun champ à modifier');

export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;
export type CreateScopingItemInput = z.infer<typeof createScopingItemSchema>;
export type UpdateScopingItemInput = z.infer<typeof updateScopingItemSchema>;
