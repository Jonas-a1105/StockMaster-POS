import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { for (const k in mockStorage) delete mockStorage[k]; }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((_i: number) => ''),
};
vi.stubGlobal('localStorage', localStorageMock);

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => `mock-uuid-${++uuidCounter}`),
});

const mockUpsert = vi.fn();
const mockFindOneExec = vi.fn();

const mockDb = {
  suppliers: { upsert: mockUpsert, findOne: vi.fn(() => ({ exec: mockFindOneExec })) },
  products: { upsert: mockUpsert, findOne: vi.fn(() => ({ exec: mockFindOneExec })) },
  payroll: { upsert: mockUpsert },
  auditLogs: { upsert: mockUpsert },
  purchases: { upsert: mockUpsert },
};

import { migrateLocalStorageToRxDB } from '../migration';

describe('migrateLocalStorageToRxDB', () => {
  beforeEach(() => {
    for (const k in mockStorage) delete mockStorage[k];
    mockUpsert.mockReset();
    mockFindOneExec.mockReset();
    uuidCounter = 0;
  });

  it('retorna temprano si ya ambas migraciones están completadas', async () => {
    mockStorage['stockmaster_local_db_migrated_v2'] = 'true';
    mockStorage['stockmaster_compras_migrated_v1'] = 'true';

    await migrateLocalStorageToRxDB(mockDb as any);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('migra proveedores desde localStorage', async () => {
    mockStorage['stockmaster_suppliers_local'] = JSON.stringify([
      { id: 'sup1', rif: 'J-1', companyName: 'Proveedor A', contactName: 'Contacto', email: 'a@a.com', phone: '0412', address: 'Addr', category: 'General', paymentTerms: 'Contado', status: 'Activo' }
    ]);

    await migrateLocalStorageToRxDB(mockDb as any);

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sup1',
      companyName: 'Proveedor A',
      rif: 'J-1',
    }));
  });

  it('migra nóminas desde localStorage', async () => {
    mockStorage['stockmaster_payroll_records'] = JSON.stringify([
      { id: 'pay1', employeeId: 'emp1', employeeName: 'Juan', baseSalary: 500, hoursWorked: 40, bonuses: 50, deductions: 20, totalPaid: 530, status: 'PAGADO', paymentDate: '2026-01-01' }
    ]);

    await migrateLocalStorageToRxDB(mockDb as any);

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'pay1',
      employeeName: 'Juan',
      totalPaid: 530,
    }));
  });

  it('migra auditoría desde localStorage', async () => {
    mockStorage['stockmaster_local_audit_logs'] = JSON.stringify([
      { id: 'aud1', userId: 'user1', action: 'LOGIN', details: '{}', createdAt: '2026-01-01' }
    ]);

    await migrateLocalStorageToRxDB(mockDb as any);

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'aud1',
      action: 'LOGIN',
    }));
  });

  it('no migra main if already done, pero migra purchases si falta', async () => {
    mockStorage['stockmaster_local_db_migrated_v2'] = 'true';
    mockStorage['stockmaster_purchases_local'] = JSON.stringify([
      { supplierName: 'Proveedor X', invoiceNumber: 'FAC-001', totalUSD: 1000, items: [{ code: 'P001', name: 'Producto X', costUSD: 10, quantity: 5 }] }
    ]);
    mockFindOneExec.mockResolvedValue(null);

    await migrateLocalStorageToRxDB(mockDb as any);

    expect(mockUpsert).toHaveBeenCalled();
    expect(mockStorage['stockmaster_compras_migrated_v1']).toBe('true');
  });

  it('omite datos corruptos sin crashear', async () => {
    mockStorage['stockmaster_suppliers_local'] = 'not-json';

    await expect(migrateLocalStorageToRxDB(mockDb as any)).resolves.not.toThrow();
  });

  it('asetta flag de migración al completar', async () => {
    await migrateLocalStorageToRxDB(mockDb as any);

    expect(mockStorage['stockmaster_local_db_migrated_v2']).toBe('true');
    expect(mockStorage['stockmaster_compras_migrated_v1']).toBe('true');
  });
});
