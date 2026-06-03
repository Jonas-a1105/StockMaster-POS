import type { StockMasterDatabase } from './database';

const MIGRATION_FLAG_KEY = 'stockmaster_local_db_migrated_v2';

export async function migrateLocalStorageToRxDB(db: StockMasterDatabase) {
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') return;

  const migrations: Promise<any>[] = [];

  // 1. Migrate suppliers
  try {
    const suppliersRaw = localStorage.getItem('stockmaster_suppliers_local');
    if (suppliersRaw) {
      const suppliers = JSON.parse(suppliersRaw);
      if (Array.isArray(suppliers)) {
        for (const s of suppliers) {
          migrations.push(
            db.suppliers.upsert({
              id: s.id || crypto.randomUUID(),
              rif: s.rif || '',
              companyName: s.companyName || s.name || '',
              contactName: s.contactName || '',
              email: s.email || '',
              phone: s.phone || '',
              address: s.address || '',
              category: s.category || '',
              paymentTerms: s.paymentTerms || 'Contado',
              status: s.status || 'Activo',
              updatedAt: s.updatedAt || new Date().toISOString()
            })
          );
        }
      }
    }
  } catch { /* ignore */ }

  // 2. Migrate payroll
  try {
    const payrollRaw = localStorage.getItem('stockmaster_payroll_records');
    if (payrollRaw) {
      const payrolls = JSON.parse(payrollRaw);
      if (Array.isArray(payrolls)) {
        for (const p of payrolls) {
          migrations.push(
            db.payroll.upsert({
              id: p.id || crypto.randomUUID(),
              employeeId: p.employeeId || p.employee_id || '',
              employeeName: p.employeeName || p.employee_name || '',
              baseSalary: Number(p.baseSalary) || 0,
              hoursWorked: Number(p.hoursWorked) || 0,
              bonuses: Number(p.bonuses) || 0,
              deductions: Number(p.deductions) || 0,
              totalPaid: Number(p.totalPaid || p.total_paid) || 0,
              status: p.status || 'PENDIENTE',
              paymentDate: p.paymentDate || p.payment_date || new Date().toISOString(),
              pendingSync: true,
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || new Date().toISOString()
            })
          );
        }
      }
    }
  } catch { /* ignore */ }

  // 3. Migrate local audit logs
  try {
    const auditRaw = localStorage.getItem('stockmaster_local_audit_logs');
    if (auditRaw) {
      const logs = JSON.parse(auditRaw);
      if (Array.isArray(logs)) {
        for (const log of logs) {
          migrations.push(
            db.auditLogs.upsert({
              id: log.id || crypto.randomUUID(),
              userId: log.userId || '',
              action: log.action || '',
              details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {}),
              createdAt: log.createdAt || new Date().toISOString()
            })
          );
        }
      }
    }
  } catch { /* ignore */ }

  await Promise.allSettled(migrations);
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  console.log(`✅ Migración localStorage → RxDB completada: ${migrations.length} documentos migrados.`);
}
