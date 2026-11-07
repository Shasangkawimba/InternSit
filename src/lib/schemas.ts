import { z } from 'zod';
import { APPLICATION_STATUSES, APPLICATION_TYPES, PLATFORMS } from './applications.ts';

// Shared by client forms and API routes.
// Optional text fields: '' or null clears the value (stored as NULL);
// `undefined` means "not provided" (left unchanged on update).

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const emptyToNull = (value: string) => (value === '' ? null : value);

const optionalText = (max: number) =>
  z.string().trim().max(max, `Must be at most ${max} characters`).transform(emptyToNull).nullish();

const optionalUrl = z
  .string()
  .trim()
  .max(2048, 'URL is too long')
  .refine((value) => value === '' || isHttpUrl(value), 'URL must start with http:// or https://')
  .transform(emptyToNull)
  .nullish();

const requiredText = (message: string, max: number) =>
  z.string().trim().min(1, message).max(max, `Must be at most ${max} characters`);

const fields = {
  title: requiredText('Position title is required', 200),
  company: requiredText('Company is required', 200),
  type: z.enum(APPLICATION_TYPES, { error: 'Select a type' }),
  platform: z.enum(PLATFORMS, { error: 'Select a platform' }),
  location: optionalText(200),
  url: optionalUrl,
  status: z.enum(APPLICATION_STATUSES),
  notes: optionalText(5000),
};

// strictObject rejects unknown keys (id, appliedAt, updatedAt are server-managed).
export const ApplicationSchema = z.strictObject({
  ...fields,
  status: fields.status.default('APPLIED'),
});

// Built from `fields` (not ApplicationSchema.partial()) so a PATCH that omits
// `status` does not silently reset it to the create-time default.
export const UpdateApplicationSchema = z
  .strictObject(fields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const ListApplicationsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  platform: fields.platform.optional(),
  type: fields.type.optional(),
  status: fields.status.optional(),
});

export const ApplicationIdSchema = z.uuid();

// Form values before parsing (strings straight from inputs) vs. the parsed payload.
export type ApplicationFormValues = z.input<typeof ApplicationSchema>;
export type ApplicationInput = z.infer<typeof ApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>;
export type ListApplicationsQuery = z.infer<typeof ListApplicationsQuerySchema>;
