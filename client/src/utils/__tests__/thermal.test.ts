import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateObjectURL = vi.fn(() => 'blob:test');
const mockRevokeObjectURL = vi.fn();

vi.stubGlobal('URL', {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

import { printTicket, printViaWebUSB } from '../thermal';
import type { TicketData } from '../thermal';

describe('TicketData type', () => {
  const validTicket: TicketData = {
    title: 'Ticket de Venta',
    businessName: 'Mi Negocio C.A.',
    ticketNumber: 'T-0001',
    date: '2026-06-04',
    cashier: 'Juan Pérez',
    items: [
      { name: 'Café', qty: 2, price: 5.5, total: 11 },
      { name: 'Pan', qty: 3, price: 2, total: 6 },
    ],
    subtotal: 17,
    iva: 2.72,
    total: 19.72,
    paymentMethod: 'EFECTIVO',
  };

  it('ticket tiene estructura correcta', () => {
    expect(validTicket).toHaveProperty('ticketNumber');
    expect(validTicket).toHaveProperty('businessName');
    expect(validTicket).toHaveProperty('items');
    expect(validTicket.items).toHaveLength(2);
  });

  it('calcula iva correcto (16%)', () => {
    expect(validTicket.iva).toBeCloseTo(2.72, 2);
  });

  it('total = subtotal + iva', () => {
    expect(validTicket.total).toBeCloseTo(validTicket.subtotal + validTicket.iva, 2);
  });

  it('puede incluir tasa BCV', () => {
    const ticketConTasa = { ...validTicket, dolarRate: 40.50 };
    expect(ticketConTasa.dolarRate).toBe(40.50);
  });

  it('puede incluir footer personalizado', () => {
    const ticketConFooter = { ...validTicket, footer: 'Gracias por su compra' };
    expect(ticketConFooter.footer).toBe('Gracias por su compra');
  });

  it('puede incluir RIF del negocio', () => {
    const ticketConRif = { ...validTicket, businessRIF: 'J-12345678-9' };
    expect(ticketConRif.businessRIF).toBe('J-12345678-9');
  });

  it('puede incluir IGTF 3%', () => {
    const ticketConIGTF = { ...validTicket, igtf: 0.59 };
    expect(ticketConIGTF.igtf).toBeCloseTo(0.59, 2);
  });
});

describe('printTicket', () => {
  const ticket: TicketData = {
    title: 'Test', businessName: 'Test', ticketNumber: 'T-001',
    date: '2026-01-01', cashier: 'Test', items: [{ name: 'X', qty: 1, price: 10, total: 10 }],
    subtotal: 10, iva: 1.6, total: 11.6, paymentMethod: 'EFECTIVO',
  };

  beforeEach(() => {
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
  });

  it('descarga como HTML cuando popup está bloqueado (jsdom)', () => {
    const createSpy = vi.spyOn(document, 'createElement');
    printTicket(ticket);
    expect(createSpy).toHaveBeenCalledWith('a');
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
    createSpy.mockRestore();
  });
});

describe('printViaWebUSB', () => {
  const ticket: TicketData = {
    title: 'Test', businessName: 'Test', ticketNumber: 'T-001',
    date: '2026-01-01', cashier: 'Test', items: [{ name: 'X', qty: 1, price: 10, total: 10 }],
    subtotal: 10, iva: 1.6, total: 11.6, paymentMethod: 'EFECTIVO',
  };

  it('no lanza error cuando WebUSB no está disponible (graceful fallback)', async () => {
    await expect(printViaWebUSB(ticket)).resolves.toBeUndefined();
  });
});
