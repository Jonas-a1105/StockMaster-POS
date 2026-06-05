import { describe, it, expect } from 'vitest';
import { formatAuditDetailsHumanReadable } from '../audit';

describe('formatAuditDetailsHumanReadable', () => {
  it('devuelve mensaje para USUARIO_LOGIN_LOCAL', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'USUARIO_LOGIN_LOCAL',
      details: JSON.stringify({ email: 'test@test.com' }),
    });
    expect(result).toContain('test@test.com');
    expect(result).toContain('Inicio de sesión local exitoso');
  });

  it('devuelve mensaje para PRODUCTO_CREAR con precio y stock', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'PRODUCTO_CREAR',
      details: JSON.stringify({ name: 'Café', price: 5.5, stock: 20 }),
    });
    expect(result).toContain('Café');
    expect(result).toContain('$5.50');
    expect(result).toContain('20');
  });

  it('devuelve mensaje para VENTA_POS_COBRO con método de pago', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'VENTA_POS_COBRO',
      details: JSON.stringify({ total: 150.75, paymentMethod: 'TARJETA' }),
    });
    expect(result).toContain('$150.75');
    expect(result).toContain('TARJETA');
  });

  it('devuelve mensaje para CAJA_CIERRE con faltante', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'CAJA_CIERRE',
      details: JSON.stringify({ totalSalesUSD: 500, diffUSD: -25 }),
    });
    expect(result).toContain('faltante');
    expect(result).toContain('$25');
  });

  it('devuelve mensaje para STOCK_AJUSTE_JUSTIFICADO con valores previos/nuevos', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'STOCK_AJUSTE_JUSTIFICADO',
      details: JSON.stringify({ productName: 'Leche', prevStock: 10, newStock: 5 }),
    });
    expect(result).toContain('Leche');
    expect(result).toContain('10');
    expect(result).toContain('5');
  });

  it('devuelve fallback para acción desconocida', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'ACCION_DESCONOCIDA',
      details: '{}',
    });
    expect(result).toContain('ACCION_DESCONOCIDA');
  });

  it('maneja details inválido sin crashear', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'TEST',
      details: 'esto-no-es-json',
    });
    expect(result).toContain('TEST');
  });

  it('devuelve mensaje para USUARIO_LOGOUT', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'USUARIO_LOGOUT',
      details: '{}',
    });
    expect(result).toContain('Cierre de sesión');
  });

  it('devuelve mensaje para CLIENTE_CREAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'CLIENTE_CREAR',
      details: JSON.stringify({ name: 'Juan Pérez', phone: '04121234567' }),
    });
    expect(result).toContain('Juan Pérez');
    expect(result).toContain('04121234567');
  });

  it('devuelve mensaje para CLIENTE_EDITAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'CLIENTE_EDITAR',
      details: JSON.stringify({ name: 'Juan Pérez', id: 'cli_001' }),
    });
    expect(result).toContain('Juan Pérez');
    expect(result).toContain('cli_001');
  });

  it('devuelve mensaje para CLIENTE_ELIMINAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'CLIENTE_ELIMINAR',
      details: JSON.stringify({ id: 'cli_001' }),
    });
    expect(result).toContain('cli_001');
  });

  it('devuelve mensaje para PRODUCTO_EDITAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'PRODUCTO_EDITAR',
      details: JSON.stringify({ name: 'Arroz', code: 'SKU-001' }),
    });
    expect(result).toContain('Arroz');
    expect(result).toContain('SKU-001');
  });

  it('devuelve mensaje para PRODUCTO_ELIMINAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'PRODUCTO_ELIMINAR',
      details: JSON.stringify({ id: 'prod_001' }),
    });
    expect(result).toContain('prod_001');
  });

  it('devuelve mensaje para PROVEEDOR_CREAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'PROVEEDOR_CREAR',
      details: JSON.stringify({ companyName: 'Distribuidora ABC', rif: 'J-12345678-9' }),
    });
    expect(result).toContain('Distribuidora ABC');
    expect(result).toContain('J-12345678-9');
  });

  it('devuelve mensaje para PROVEEDOR_EDITAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'PROVEEDOR_EDITAR',
      details: JSON.stringify({ companyName: 'Distribuidora ABC' }),
    });
    expect(result).toContain('Distribuidora ABC');
  });

  it('devuelve mensaje para PROVEEDOR_ELIMINAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'PROVEEDOR_ELIMINAR',
      details: JSON.stringify({ id: 'prov_001' }),
    });
    expect(result).toContain('prov_001');
  });

  it('devuelve mensaje para NOMINA_PAGO_REGISTRAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'NOMINA_PAGO_REGISTRAR',
      details: JSON.stringify({ employeeName: 'María López', totalPaid: 1200 }),
    });
    expect(result).toContain('María López');
    expect(result).toContain('$1200.00');
  });

  it('devuelve mensaje para NOMINA_EDITAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'NOMINA_EDITAR',
      details: JSON.stringify({ employeeName: 'María López' }),
    });
    expect(result).toContain('María López');
  });

  it('devuelve mensaje para COMPRA_REGISTRAR_MANUAL', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'COMPRA_REGISTRAR_MANUAL',
      details: JSON.stringify({ invoiceNumber: 'FAC-001', total: 500.75 }),
    });
    expect(result).toContain('FAC-001');
    expect(result).toContain('$500.75');
  });

  it('devuelve mensaje para COMPRA_REGISTRAR_OCR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'COMPRA_REGISTRAR_OCR',
      details: JSON.stringify({ total: 250.00 }),
    });
    expect(result).toContain('$250.00');
    expect(result).toContain('OCR');
  });

  it('devuelve mensaje para COMPRA_EDITAR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'COMPRA_EDITAR',
      details: JSON.stringify({ id: 'comp_001' }),
    });
    expect(result).toContain('comp_001');
  });

  it('devuelve mensaje para CAJA_APERTURA', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'CAJA_APERTURA',
      details: JSON.stringify({ initialUSD: 200, initialVES: 5000 }),
    });
    expect(result).toContain('$200.00');
    expect(result).toContain('Bs. 5000.00');
  });

  it('devuelve mensaje para POS_ABONO_CREDITO_CLIENTE', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'POS_ABONO_CREDITO_CLIENTE',
      details: JSON.stringify({ amount: 100, paymentMethod: 'EFECTIVO' }),
    });
    expect(result).toContain('$100.00');
    expect(result).toContain('EFECTIVO');
  });

  it('devuelve mensaje para CXP_PAGO_PROVEEDOR', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'CXP_PAGO_PROVEEDOR',
      details: JSON.stringify({ amount: 3000, supplierName: 'Distribuidora ABC' }),
    });
    expect(result).toContain('$3000.00');
    expect(result).toContain('Distribuidora ABC');
  });

  it('devuelve mensaje para SYNC_PRODUCT_CONFLICT_LWW', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'SYNC_PRODUCT_CONFLICT_LWW',
      details: '{}',
    });
    expect(result).toContain('LWW');
  });

  it('devuelve CAJA_CIERRE cuadrado cuando diffUSD >= 0', () => {
    const result = formatAuditDetailsHumanReadable({
      action: 'CAJA_CIERRE',
      details: JSON.stringify({ totalSalesUSD: 500, diffUSD: 0 }),
    });
    expect(result).toContain('cuadrado');
  });
});
