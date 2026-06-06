import { z } from 'zod';

export const ValidateLicenseSchema = z.object({
  key: z.string().min(1, { message: 'La llave de licencia es requerida.' }).max(1000),
});

export const SignLicenseSchema = z.object({
  plan: z.enum(['basic', 'pro', 'premium'], { message: 'Plan inválido.' }),
  rif: z.string().min(1, { message: 'RIF requerido.' }).max(20),
  expiry: z.string().regex(/^(\d{8}|\d{14})$/, { message: 'Expiry debe ser YYYYMMDD o YYYYMMDDHHmmss.' }),
});

export type ValidateLicenseDto = z.infer<typeof ValidateLicenseSchema>;
export type SignLicenseDto = z.infer<typeof SignLicenseSchema>;
