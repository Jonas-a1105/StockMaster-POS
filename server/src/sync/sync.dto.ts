import { z } from 'zod';

export const SyncProductSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1),
  category: z.string().optional().default('General'),
  price: z.number().positive(),
  cost: z.number().min(0).optional().default(0),
  stock: z.number().int().min(0),
  minStock: z.number().int().min(0).optional().default(5),
  version: z.number().int().optional().default(1),
  updatedAt: z.string().datetime(),
});

export const SyncSaleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(),
});

export const SyncSaleSchema = z.object({
  id: z.string().uuid(),
  ticketNumber: z.string().min(1),
  cashierId: z.string().uuid(),
  clientId: z.string().optional().nullable(),
  total: z.number().positive(),
  paymentMethod: z.string().min(1),
  items: z.array(SyncSaleItemSchema).min(1),
  pendingSync: z.boolean(),
  dolarRate: z.number().positive().optional().default(40.50),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SyncClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  updatedAt: z.string().datetime(),
});

export const SyncSupplierSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string().min(1),
  contactName: z.string().optional().default(''),
  phone: z.string().optional().default(''),
  updatedAt: z.string().datetime(),
});

export const SyncPurchaseItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  cost: z.number().positive(),
});

export const SyncPurchaseSchema = z.object({
  id: z.string().uuid(),
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().optional(),
  total: z.number().positive(),
  items: z.array(SyncPurchaseItemSchema).min(1),
  pendingSync: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SyncPayrollSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  baseSalary: z.number().positive(),
  hoursWorked: z.number().int().min(0).optional().default(0),
  bonuses: z.number().min(0).optional().default(0),
  deductions: z.number().min(0).optional().default(0),
  totalPaid: z.number().positive(),
  status: z.enum(['PENDIENTE', 'PAGADO', 'RECHAZADO']).optional().default('PENDIENTE'),
  paymentDate: z.string().datetime(),
  pendingSync: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SyncPullSchema = z.object({
  lastSyncedAt: z.string().datetime({ message: 'Se requiere una fecha ISO válida (lastSyncedAt).' }),
});
