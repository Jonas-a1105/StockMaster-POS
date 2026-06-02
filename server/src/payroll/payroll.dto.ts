import { z } from 'zod';

export const CreatePayrollSchema = z.object({
  employeeId: z.string().uuid({ message: 'ID de empleado inválido.' }),
  baseSalary: z.number().positive({ message: 'Salario base debe ser positivo.' }),
  hoursWorked: z.number().int().min(0).optional().default(0),
  bonuses: z.number().min(0).optional().default(0),
  deductions: z.number().min(0).optional().default(0),
  paymentDate: z.string().datetime({ message: 'Fecha de pago inválida.' }),
});

export type CreatePayrollDto = z.infer<typeof CreatePayrollSchema>;
