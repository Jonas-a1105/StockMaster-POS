export interface AuditLogEntry {
  id: string;
  action: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  user: {
    name: string;
    email: string;
    role: string;
  };
}

/**
 * Registra un evento de auditoría en la bitácora local (RxDB)
 */
import { getDatabase } from '../db/database';

export async function logAuditEvent(
  user: { name: string; email?: string; role: string } | null,
  action: string,
  details: any,
  severity?: 'INFO' | 'WARNING' | 'CRITICAL'
) {
  try {
    const activeUser = user || { name: 'Sistema', email: 'sistema@stockmaster.pro', role: 'SYSTEM' };
    const id = 'log_local_' + Math.random().toString(36).substring(2, 11);
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
    const createdAt = new Date().toISOString();
    const db = await getDatabase();

    const deducedSeverity = severity || (
      action.endsWith('_ELIMINAR') || action.includes('ELIMINAR') || action.includes('BORRAR') || action.includes('SOBREESCRITURA')
        ? 'CRITICAL'
        : (action.includes('_EDITAR') || action.includes('EDITAR') || action.includes('MODIFICAR') || action.includes('CONFLICT') || action.includes('CIERRE') || action.includes('AJUSTE'))
          ? 'WARNING'
          : 'INFO'
    );

    await db.auditLogs.insert({
      id,
      userId: activeUser.email || 'sistema@stockmaster.pro',
      action,
      details: detailsStr,
      severity: deducedSeverity,
      createdAt
    });
    console.log(`[Audit RxDB] Event logged: ${action} (${deducedSeverity})`);
  } catch (error) {
    console.error('Failed to save local audit log to RxDB:', error);
  }
}

/**
 * Traduce una acción técnica y detalles JSON a una explicación simple en español.
 */
export function formatAuditDetailsHumanReadable(log: { action: string; details: string }): string {
  try {
    const data = JSON.parse(log.details);
    switch (log.action) {
      case 'USUARIO_LOGIN_LOCAL':
        return `Inicio de sesión local exitoso para el usuario "${data.email || ''}".`;
      case 'USUARIO_LOGOUT':
        return `Cierre de sesión del usuario de forma segura.`;
      case 'CLIENTE_CREAR':
        return `Se registró un nuevo cliente: "${data.name || ''}" (${data.phone || 'sin teléfono'}).`;
      case 'CLIENTE_EDITAR':
        return `Se modificaron los datos del cliente "${data.name || ''}" (ID: ${data.id || ''}).`;
      case 'CLIENTE_ELIMINAR':
        return `Se eliminó al cliente con ID: ${data.id || ''}.`;
      case 'PRODUCTO_CREAR':
        return `Se agregó el producto "${data.name || ''}" al catálogo con precio de $${Number(data.price || 0).toFixed(2)} (Stock inicial: ${data.stock || 0}).`;
      case 'PRODUCTO_EDITAR':
        return `Se editó el producto "${data.name || ''}" (SKU: ${data.code || ''}).`;
      case 'PRODUCTO_ELIMINAR':
        return `Se eliminó el producto con ID: ${data.id || ''}.`;
      case 'PROVEEDOR_CREAR':
        return `Se registró un nuevo proveedor: "${data.companyName || ''}" (RIF: ${data.rif || 'N/A'}).`;
      case 'PROVEEDOR_EDITAR':
        return `Se actualizaron los datos del proveedor "${data.companyName || ''}".`;
      case 'PROVEEDOR_ELIMINAR':
        return `Se eliminó al proveedor con ID: ${data.id || ''}.`;
      case 'NOMINA_PAGO_REGISTRAR':
        return `Se registró el pago de nómina para el empleado "${data.employeeName || ''}" por un total de $${Number(data.totalPaid || 0).toFixed(2)}.`;
      case 'NOMINA_EDITAR':
        return `Se editó el registro de nómina del empleado "${data.employeeName || ''}".`;
      case 'COMPRA_REGISTRAR_MANUAL':
        return `Se registró manualmente una orden de compra (Factura: ${data.invoiceNumber || 'N/A'}) por un total de $${Number(data.total || 0).toFixed(2)}.`;
      case 'COMPRA_REGISTRAR_OCR':
        return `Se registró una compra mediante escaneo OCR de factura por un total de $${Number(data.total || 0).toFixed(2)}.`;
      case 'COMPRA_EDITAR':
        return `Se editó la orden de compra con ID: ${data.id || ''}.`;
      case 'VENTA_POS_COBRO':
        return `Venta realizada exitosamente. Monto cobrado: $${Number(data.total || 0).toFixed(2)} mediante ${data.paymentMethod || 'método no especificado'}.`;
      case 'CAJA_APERTURA':
        return `Apertura de caja (Turno) iniciada con saldo inicial de $${Number(data.initialUSD || 0).toFixed(2)} y Bs. ${Number(data.initialVES || 0).toFixed(2)}.`;
      case 'CAJA_CIERRE':
        return `Cierre de caja (Arqueo Z) procesado. Total de ventas en turno: $${Number(data.totalSalesUSD || 0).toFixed(2)}. Estado: ${data.diffUSD < 0 ? 'Con faltante de $' + Math.abs(data.diffUSD).toFixed(2) : 'Arqueo cuadrado sin faltantes'}.`;
      case 'POS_ABONO_CREDITO_CLIENTE':
        return `Abono a crédito de cliente registrado: $${Number(data.amount || 0).toFixed(2)} mediante ${data.paymentMethod || ''}.`;
      case 'STOCK_AJUSTE_JUSTIFICADO':
        return `Ajuste manual de inventario para el producto "${data.productName || ''}". Cambio de stock: ${data.prevStock || 0} -> ${data.newStock || 0} (Motivo: ${data.reason || 'No especificado'}).`;
      case 'CXP_PAGO_PROVEEDOR':
        return `Pago registrado a proveedor: $${Number(data.amount || 0).toFixed(2)} en la cuenta de "${data.supplierName || ''}".`;
      case 'SYNC_PRODUCT_CONFLICT_LWW':
        return `Resolución de conflicto de producto local frente a cambios en servidor central centralizada con LWW (Last-Write-Wins).`;
      default:
        return `Acción técnica: ${log.action}.`;
    }
  } catch (e) {
    return `Acción: ${log.action}. Detalle técnico: ${log.details}`;
  }
}
