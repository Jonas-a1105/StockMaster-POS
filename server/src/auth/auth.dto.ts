import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email({ message: 'Formato de correo electrónico inválido.' }).max(255),
  password: z
    .string()
    .min(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
    .max(128, { message: 'La contraseña no debe exceder 128 caracteres.' })
    .regex(/[A-Z]/, { message: 'Debe contener al menos una mayúscula.' })
    .regex(/[a-z]/, { message: 'Debe contener al menos una minúscula.' })
    .regex(/[0-9]/, { message: 'Debe contener al menos un número.' }),
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres.' }).max(100),
  role: z.enum(['ADMIN', 'CASHIER', 'AUDITOR'], { message: 'Rol de usuario inválido.' }),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, { message: 'El PIN offline debe tener entre 4 y 6 dígitos numéricos.' })
    .optional(),
});

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Formato de correo electrónico inválido.' }).max(255),
  password: z.string().min(1, { message: 'La contraseña es obligatoria.' }).max(128),
});

export const OfflineLoginSchema = z.object({
  email: z.string().email({ message: 'Formato de correo electrónico inválido.' }).max(255),
  pin: z.string().regex(/^\d{4,6}$/, { message: 'El PIN debe tener entre 4 y 6 dígitos.' }),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, { message: 'Refresh token requerido.' }),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
export type LoginDto = z.infer<typeof LoginSchema>;
export type OfflineLoginDto = z.infer<typeof OfflineLoginSchema>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
