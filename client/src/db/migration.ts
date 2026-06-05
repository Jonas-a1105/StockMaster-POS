import type { StockMasterDatabase } from './database';

const MIGRATION_FLAG_KEY = 'stockmaster_local_db_migrated_v4';

export async function migrateLocalStorageToRxDB(db: StockMasterDatabase) {
  // Esperar a que RxDB esté completamente inicializado
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    if (db && db.suppliers && db.products) break;
    await new Promise(r => setTimeout(r, 200));
  }

  const mainMigrated = localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
  const purchasesMigrated = localStorage.getItem('stockmaster_compras_migrated_v4') === 'true';

  if (mainMigrated && purchasesMigrated) return;

  const migrations: Promise<any>[] = [];

  // 1. Migrate suppliers, payroll, and audit logs if main migration is not done
  if (!mainMigrated) {
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
  }

  // 2. Migrate local purchases if not done yet
  if (!purchasesMigrated) {
    try {
      const purchasesRaw = localStorage.getItem('stockmaster_purchases_local');
      if (purchasesRaw) {
        const purchases = JSON.parse(purchasesRaw);
        if (Array.isArray(purchases)) {
          for (const p of purchases) {
            // Find or create supplier
            let supplierId = '';
            const existingSupplier = await db.suppliers.findOne({
              selector: { companyName: p.supplierName }
            }).exec();

            if (existingSupplier) {
              supplierId = existingSupplier.get('id');
            } else {
              supplierId = 'sup_' + crypto.randomUUID();
              await db.suppliers.upsert({
                id: supplierId,
                rif: 'J-' + Math.floor(Math.random() * 100000000) + '-' + Math.floor(Math.random() * 10),
                companyName: p.supplierName,
                contactName: 'N/A',
                email: 'N/A',
                phone: 'N/A',
                address: 'Venezuela',
                category: 'General',
                paymentTerms: 'Contado',
                status: 'Activo',
                updatedAt: new Date().toISOString()
              });
            }

            // Map items to product IDs in db.products (auto-creating products if missing)
            const mappedItems: any[] = [];
            for (const item of p.items) {
              let productId = '';
              const existingProduct = await db.products.findOne({
                selector: { code: item.code }
              }).exec();

              if (existingProduct) {
                productId = existingProduct.get('id');
              } else {
                productId = crypto.randomUUID();
                await db.products.upsert({
                  id: productId,
                  code: item.code,
                  name: item.name,
                  category: item.category || 'General',
                  price: Number((item.costUSD * 1.5).toFixed(2)),
                  cost: item.costUSD,
                  stock: 0,
                  minStock: 5,
                  version: 1,
                  updatedAt: new Date().toISOString()
                });
              }

              mappedItems.push({
                productId,
                quantity: item.quantity,
                cost: item.costUSD
              });
            }

            // Queue the purchase upsert
            migrations.push(
              db.purchases.upsert({
                id: p.id || 'ord_' + crypto.randomUUID(),
                supplierId,
                invoiceNumber: p.invoiceNumber || 'S/N',
                total: Number(p.totalUSD) || 0,
                items: mappedItems,
                pendingSync: true,
                createdAt: p.date ? new Date(p.date).toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString()
              })
            );
          }
        }
      }
    } catch (err) {
      console.error('Error migrando compras locales:', err);
    }
  }

  await Promise.allSettled(migrations);

  if (!mainMigrated) {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  }
  if (!purchasesMigrated) {
    localStorage.setItem('stockmaster_compras_migrated_v4', 'true');
  }
  console.log(`✅ Migración localStorage → RxDB completada: ${migrations.length} documentos procesados.`);
}
