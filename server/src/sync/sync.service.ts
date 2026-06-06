import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService
  ) {}

  // 1. PUSH: Recibe cambios del cliente local y los escribe en SQLite central
  async pushProducts(clientProducts: any[], userId: string, ipAddress = 'unknown', userAgent = 'RxDB Sync Client') {
    const processedIds: string[] = [];

    // Se procesa en una transacción para asegurar consistencia atómica
    await this.prisma.$transaction(async (tx) => {
      const ids = clientProducts.map(p => p.id);
      const serverProds = await tx.product.findMany({
        where: { id: { in: ids } }
      });
      const serverProdsMap = new Map(serverProds.map(p => [p.id, p]));

      for (const clientProd of clientProducts) {
        const serverProd = serverProdsMap.get(clientProd.id);
        const clientUpdatedAt = new Date(clientProd.updatedAt);

        if (!serverProd) {
          // A. Documento nuevo: Se registra directamente en SQLite
          // Verificamos si existe otro producto con el mismo código de barras para evitar conflictos de unicidad
          const existingByCode = await tx.product.findUnique({
            where: { code: clientProd.code }
          });

          if (existingByCode) {
            // Actualizar el producto existente con los datos nuevos
            await tx.product.update({
              where: { id: existingByCode.id },
              data: {
                code: clientProd.code,
                name: clientProd.name,
                category: clientProd.category || 'General',
                price: clientProd.price,
                cost: clientProd.cost || 0,
                stock: clientProd.stock,
                minStock: clientProd.minStock || 5,
                batches: clientProd.batches || null,
                version: (existingByCode.version || 1) + 1,
                updatedAt: clientUpdatedAt
              }
            });
            processedIds.push(existingByCode.id);
            continue;
          }

          await tx.product.create({
            data: {
              id: clientProd.id,
              code: clientProd.code,
              name: clientProd.name,
              category: clientProd.category || 'General',
              price: clientProd.price,
              cost: clientProd.cost || 0,
              stock: clientProd.stock,
              minStock: clientProd.minStock || 5,
              batches: clientProd.batches || null,
              version: clientProd.version || 1,
              updatedAt: clientUpdatedAt
            }
          });
          processedIds.push(clientProd.id);
        } else {
          // B. Documento existente: Aplicación de la Estrategia Last-Write-Wins (LWW)
          const serverUpdatedAt = new Date(serverProd.updatedAt);

          if (clientUpdatedAt > serverUpdatedAt) {
            // El cliente tiene cambios más recientes: Se actualiza el servidor
            await tx.product.update({
              where: { id: clientProd.id },
              data: {
                code: clientProd.code,
                name: clientProd.name,
                category: clientProd.category || 'General',
                price: clientProd.price,
                cost: clientProd.cost || 0,
                stock: clientProd.stock,
                minStock: clientProd.minStock || 5,
                batches: clientProd.batches || null,
                version: (serverProd.version || 1) + 1, // Incrementa la versión
                updatedAt: clientUpdatedAt
              }
            });
            processedIds.push(clientProd.id);

            // Registra el conflicto resuelto en la Bitácora de Auditoría
            await this.auditoria.logAction(
              userId,
              'SYNC_PRODUCT_CONFLICT_LWW',
              {
                productId: clientProd.id,
                name: clientProd.name,
                reason: 'El cliente poseía una marca de tiempo más reciente.',
                clientTime: clientProd.updatedAt,
                serverTime: serverProd.updatedAt
              },
              ipAddress,
              userAgent
            );
          } else {
            // El servidor tiene cambios más recientes: Se omite y se resolverá en el posterior PULL del cliente
            console.log(`[Sync] Conflicto LWW ignorado para producto ${clientProd.id}. El servidor es más reciente.`);
          }
        }
      }
    });

    return { processedIds };
  }

  // 2. PULL: Envía al cliente todos los cambios ocurridos desde su última sincronización
  // Incluye productos eliminados (soft-delete con deletedAt)
  async pullProducts(lastSyncedAtStr: string) {
    const lastSyncedAt = new Date(lastSyncedAtStr);
    
    // Obtiene productos modificados o eliminados después de la fecha de última sincronización
    const updatedProducts = await this.prisma.product.findMany({
      where: {
        OR: [
          { updatedAt: { gt: lastSyncedAt } },
          { deletedAt: { gt: lastSyncedAt } },
        ]
      },
      orderBy: {
        updatedAt: 'asc'
      }
    });

    return {
      products: updatedProducts,
      serverTime: new Date().toISOString()
    };
  }

  // 3. PUSH SALES: Recibe ventas realizadas offline y las procesa en SQLite central restando stock
  async pushSales(clientSales: any[], userId: string, ipAddress = 'unknown', userAgent = 'RxDB Sync Client') {
    const processedIds: string[] = [];

    // Batch query to find existing sales to avoid N+1 queries
    const saleIds = clientSales.map(s => s.id);
    const existingSales = await this.prisma.sale.findMany({
      where: { id: { in: saleIds } }
    });
    const existingSalesMap = new Map(existingSales.map(s => [s.id, s]));

    // Batch query to load all products concerned by all items in all sales to avoid N+1 inside loops
    const productIds = Array.from(new Set(clientSales.flatMap(s => s.items || []).map(i => i.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } }
    });
    const productsMap = new Map(products.map(p => [p.id, p]));

    for (const clientSale of clientSales) {
      try {
        if (existingSalesMap.has(clientSale.id)) {
          processedIds.push(clientSale.id);
          continue; // Ya procesada previamente
        }

        await this.prisma.$transaction(async (tx) => {
          // Verificar si el cliente existe, de lo contrario lo seteamos a null para evitar violaciones de FK
          let clientId = clientSale.clientId || null;
          if (clientId) {
            const clientExists = await tx.client.findUnique({ where: { id: clientId } });
            if (!clientExists) {
              clientId = null;
            }
          }

          // Verificar si el cajero existe, de lo contrario usamos el ID del usuario autenticado (userId)
          let cashierId = clientSale.cashierId;
          const cashierExists = await tx.user.findUnique({ where: { id: cashierId } });
          if (!cashierExists) {
            cashierId = userId;
          }

          // B. Crear la venta principal
          await tx.sale.create({
            data: {
              id: clientSale.id,
              ticketNumber: clientSale.ticketNumber,
              cashierId: cashierId,
              clientId: clientId,
              total: clientSale.total,
              paymentMethod: clientSale.paymentMethod,
              dolarRate: clientSale.dolarRate || 40.50,
              createdAt: new Date(clientSale.createdAt),
              updatedAt: new Date(clientSale.updatedAt)
            }
          });

          // C. Crear los ítems de venta y restar el stock correspondiente de cada producto
          for (const item of clientSale.items) {
            // Verificar si el producto existe, de lo contrario creamos un placeholder temporal
            const prodExists = await tx.product.findUnique({ where: { id: item.productId } });
            if (!prodExists) {
              await tx.product.create({
                data: {
                  id: item.productId,
                  code: 'TEMP-' + Math.floor(Math.random() * 10000000),
                  name: 'Producto Sincronizado',
                  category: 'General',
                  price: item.price,
                  cost: item.price * 0.7,
                  stock: 0,
                  updatedAt: new Date()
                }
              });
            }

            await tx.saleItem.create({
              data: {
                saleId: clientSale.id,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price
              }
            });

            // Restar stock del producto usando cache batch en productsMap
            const product = productsMap.get(item.productId);

            if (product) {
              const newStock = Math.max(0, product.stock - item.quantity);
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  stock: newStock,
                  version: product.version + 1,
                  updatedAt: new Date() // Al cambiar, se propagará en futuros pulls de otros clientes
                }
              });

              // Update our batch cache map so next sales processing this product get correct stock
              product.stock = newStock;
              product.version = product.version + 1;

              // Alerta de stock bajo si aplica
              if (newStock <= product.minStock) {
                await this.auditoria.logAction(
                  userId,
                  'INVENTARIO_STOCK_BAJO',
                  {
                    productId: product.id,
                    name: product.name,
                    stockActual: newStock,
                    minStock: product.minStock
                  },
                  ipAddress,
                  'Sync Server Stock Monitor'
                );
              }
            }
          }

          // D. Registrar el evento de venta sincronizada en la Bitácora de Auditoría
          await this.auditoria.logAction(
            userId,
            'SYNC_VENTA_PROCESADA',
            {
              saleId: clientSale.id,
              ticketNumber: clientSale.ticketNumber,
              total: clientSale.total,
              itemsCount: clientSale.items.length
            },
            ipAddress,
            userAgent
          );

          processedIds.push(clientSale.id);
        });
      } catch (err: any) {
        console.error(`[Sync] Error procesando venta offline ${clientSale.id}:`, err.message);
        // Continuamos con el resto de ventas; esta venta se reintentará en el siguiente ciclo
      }
    }

    return { processedIds };
  }

  // 4. PUSH CLIENTS: Recibe clientes modificados localmente
  async pushClients(clientClients: any[], userId: string, ipAddress = 'unknown', userAgent = 'RxDB Sync Client') {
    const processedIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const ids = clientClients.map(c => c.id);
      const serverClients = await tx.client.findMany({
        where: { id: { in: ids } }
      });
      const serverClientsMap = new Map(serverClients.map(c => [c.id, c]));

      for (const clientCl of clientClients) {
        const serverCl = serverClientsMap.get(clientCl.id);
        const clientUpdatedAt = new Date(clientCl.updatedAt);

        if (!serverCl) {
          // A. Cliente nuevo
          await tx.client.create({
            data: {
              id: clientCl.id,
              name: clientCl.name,
              email: clientCl.email || null,
              phone: clientCl.phone || null,
              createdAt: clientUpdatedAt,
              updatedAt: clientUpdatedAt
            }
          });
          processedIds.push(clientCl.id);
        } else {
          // B. Cliente existente: Last-Write-Wins
          const serverUpdatedAt = new Date(serverCl.updatedAt);

          if (clientUpdatedAt > serverUpdatedAt) {
            await tx.client.update({
              where: { id: clientCl.id },
              data: {
                name: clientCl.name,
                email: clientCl.email || null,
                phone: clientCl.phone || null,
                updatedAt: clientUpdatedAt
              }
            });
            processedIds.push(clientCl.id);
          } else {
            console.log(`[Sync] Conflicto LWW ignorado para cliente ${clientCl.id}. El servidor es más reciente.`);
          }
        }
      }
    });

    return { processedIds };
  }

  // 5. PULL CLIENTS: Envía los clientes modificados al cliente local
  async pullClients(lastSyncedAtStr: string) {
    const lastSyncedAt = new Date(lastSyncedAtStr);

    const updatedClients = await this.prisma.client.findMany({
      where: {
        updatedAt: {
          gt: lastSyncedAt
        }
      },
      orderBy: {
        updatedAt: 'asc'
      }
    });

    return {
      clients: updatedClients,
      serverTime: new Date().toISOString()
    };
  }

  // 6. PUSH SUPPLIERS: Recibe proveedores modificados localmente
  async pushSuppliers(clientSuppliers: any[], userId: string, ipAddress = 'unknown', userAgent = 'RxDB Sync Client') {
    const processedIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const ids = clientSuppliers.map(s => s.id);
      const serverSuppliers = await tx.supplier.findMany({
        where: { id: { in: ids } }
      });
      const serverSuppliersMap = new Map(serverSuppliers.map(s => [s.id, s]));

      for (const s of clientSuppliers) {
        const existing = serverSuppliersMap.get(s.id);
        const clientUpdatedAt = new Date(s.updatedAt);

        if (!existing) {
          await tx.supplier.create({
            data: {
              id: s.id,
              name: s.companyName || s.name,
              contact: s.contactName || null,
              phone: s.phone || null,
              rif: s.rif || null,
              email: s.email || null,
              address: s.address || null,
              category: s.category || 'General',
              paymentTerms: s.paymentTerms || 'Contado',
              status: s.status || 'Activo',
              updatedAt: clientUpdatedAt
            }
          });
          processedIds.push(s.id);
        } else {
          if (clientUpdatedAt > new Date(existing.updatedAt)) {
            await tx.supplier.update({
              where: { id: s.id },
              data: {
                name: s.companyName || s.name,
                contact: s.contactName || null,
                phone: s.phone || null,
                rif: s.rif || null,
                email: s.email || null,
                address: s.address || null,
                category: s.category || 'General',
                paymentTerms: s.paymentTerms || 'Contado',
                status: s.status || 'Activo',
                updatedAt: clientUpdatedAt
              }
            });
            processedIds.push(s.id);
          }
        }
      }
    });

    return { processedIds };
  }

  // 7. PULL SUPPLIERS: Envía proveedores modificados
  async pullSuppliers(lastSyncedAtStr: string) {
    const lastSyncedAt = new Date(lastSyncedAtStr);
    const updated = await this.prisma.supplier.findMany({
      where: { updatedAt: { gt: lastSyncedAt } },
      orderBy: { updatedAt: 'asc' }
    });
    return { suppliers: updated, serverTime: new Date().toISOString() };
  }

  // 8. PUSH PURCHASES: Recibe compras realizadas offline
  async pushPurchases(clientPurchases: any[], userId: string, ipAddress = 'unknown', userAgent = 'RxDB Sync Client') {
    const processedIds: string[] = [];
    const purchaseIds = clientPurchases.map(p => p.id);
    const existingPurchases = await this.prisma.purchase.findMany({
      where: { id: { in: purchaseIds } }
    });
    const existingPurchasesMap = new Map(existingPurchases.map(p => [p.id, p]));

    const productIds = Array.from(new Set(clientPurchases.flatMap(p => p.items || []).map(i => i.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } }
    });
    const productsMap = new Map(products.map(p => [p.id, p]));

    for (const p of clientPurchases) {
      try {
        if (existingPurchasesMap.has(p.id)) {
          processedIds.push(p.id);
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          // Verificar si el proveedor existe, de lo contrario creamos un placeholder temporal
          const supplierExists = await tx.supplier.findUnique({ where: { id: p.supplierId } });
          if (!supplierExists) {
            await tx.supplier.create({
              data: {
                id: p.supplierId,
                name: 'Proveedor Sincronizado',
                contact: 'N/A',
                phone: 'N/A',
                updatedAt: new Date()
              }
            });
          }

          await tx.purchase.create({
            data: {
              id: p.id,
              supplierId: p.supplierId,
              invoiceNumber: p.invoiceNumber || null,
              total: p.total,
              ocrProcessed: false,
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt)
            }
          });

          if (p.items && Array.isArray(p.items)) {
            for (const item of p.items) {
              // Verificar si el producto existe, de lo contrario creamos un placeholder temporal
              const prodExists = await tx.product.findUnique({ where: { id: item.productId } });
              if (!prodExists) {
                await tx.product.create({
                  data: {
                    id: item.productId,
                    code: 'TEMP-' + Math.floor(Math.random() * 10000000),
                    name: 'Producto Sincronizado',
                    category: 'General',
                    price: item.cost * 1.5,
                    cost: item.cost,
                    stock: 0,
                    updatedAt: new Date()
                  }
                });
              }

              await tx.purchaseItem.create({
                data: {
                  purchaseId: p.id,
                  productId: item.productId,
                  quantity: item.quantity,
                  cost: item.cost
                }
              });

              const product = productsMap.get(item.productId);
              if (product) {
                const newStock = product.stock + item.quantity;
                await tx.product.update({
                  where: { id: item.productId },
                  data: {
                    stock: newStock,
                    version: product.version + 1,
                    updatedAt: new Date()
                  }
                });
                // Update our cache
                product.stock = newStock;
                product.version = product.version + 1;
              }
            }
          }

          await this.auditoria.logAction(userId, 'SYNC_COMPRA_PROCESADA', { purchaseId: p.id, total: p.total }, ipAddress, userAgent);
          processedIds.push(p.id);
        });
      } catch (err: any) {
        console.error(`[Sync] Error procesando compra offline ${p.id}:`, err.message);
      }
    }

    return { processedIds };
  }

  // 9. PULL PURCHASES: Envía compras modificadas
  async pullPurchases(lastSyncedAtStr: string) {
    const lastSyncedAt = new Date(lastSyncedAtStr);
    const updated = await this.prisma.purchase.findMany({
      where: { updatedAt: { gt: lastSyncedAt } },
      include: { purchaseItems: true },
      orderBy: { updatedAt: 'asc' }
    });
    return { purchases: updated, serverTime: new Date().toISOString() };
  }

  // 10. PUSH PAYROLL: Recibe registros de nómina offline
  async pushPayroll(clientPayroll: any[], userId: string, ipAddress = 'unknown', userAgent = 'RxDB Sync Client') {
    const processedIds: string[] = [];
    const payrollIds = clientPayroll.map(pr => pr.id);
    const existingPayroll = await this.prisma.payroll.findMany({
      where: { id: { in: payrollIds } }
    });
    const existingPayrollMap = new Map(existingPayroll.map(pr => [pr.id, pr]));

    for (const pr of clientPayroll) {
      try {
        if (existingPayrollMap.has(pr.id)) {
          processedIds.push(pr.id);
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          // Verificar si el empleado existe, de lo contrario usamos el ID del usuario autenticado (userId)
          let employeeId = pr.employeeId;
          const employeeExists = await tx.user.findUnique({ where: { id: employeeId } });
          if (!employeeExists) {
            employeeId = userId;
          }

          await tx.payroll.create({
            data: {
              id: pr.id,
              employeeId: employeeId,
              baseSalary: pr.baseSalary,
              hoursWorked: pr.hoursWorked || 0,
              bonuses: pr.bonuses || 0,
              deductions: pr.deductions || 0,
              totalPaid: pr.totalPaid,
              status: pr.status || 'PENDIENTE',
              paymentDate: new Date(pr.paymentDate),
              createdAt: new Date(pr.createdAt),
              updatedAt: new Date(pr.updatedAt)
            }
          });

          await this.auditoria.logAction(userId, 'SYNC_NOMINA_PROCESADA', { payrollId: pr.id, employeeId: pr.employeeId, totalPaid: pr.totalPaid }, ipAddress, userAgent);
          processedIds.push(pr.id);
        });
      } catch (err: any) {
        console.error(`[Sync] Error procesando nómina offline ${pr.id}:`, err.message);
      }
    }

    return { processedIds };
  }

  // 11. PULL PAYROLL: Envía nóminas modificadas
  async pullPayroll(lastSyncedAtStr: string) {
    const lastSyncedAt = new Date(lastSyncedAtStr);
    const updated = await this.prisma.payroll.findMany({
      where: { updatedAt: { gt: lastSyncedAt } },
      orderBy: { updatedAt: 'asc' }
    });
    return { payroll: updated, serverTime: new Date().toISOString() };
  }

  // 12. PUSH EXPENSES: Recibe gastos modificados localmente
  async pushExpenses(clientExpenses: any[], userId: string, ipAddress = 'unknown', userAgent = 'RxDB Sync Client') {
    const processedIds: string[] = [];
    const expenseIds = clientExpenses.map(e => e.id);
    const serverExpenses = await this.prisma.expense.findMany({
      where: { id: { in: expenseIds } }
    });
    const serverExpensesMap = new Map(serverExpenses.map(e => [e.id, e]));

    await this.prisma.$transaction(async (tx) => {
      for (const e of clientExpenses) {
        const existing = serverExpensesMap.get(e.id);
        const clientUpdatedAt = new Date(e.updatedAt);

        if (!existing) {
          await tx.expense.create({
            data: {
              id: e.id,
              description: e.description,
              amount: e.amount,
              category: e.category || 'General',
              date: new Date(e.date),
              createdAt: new Date(e.createdAt),
              updatedAt: clientUpdatedAt
            }
          });
          processedIds.push(e.id);
        } else {
          if (clientUpdatedAt > new Date(existing.updatedAt)) {
            await tx.expense.update({
              where: { id: e.id },
              data: {
                description: e.description,
                amount: e.amount,
                category: e.category || 'General',
                date: new Date(e.date),
                updatedAt: clientUpdatedAt
              }
            });
            processedIds.push(e.id);
          }
        }
      }
    });

    return { processedIds };
  }

  // 13. PULL EXPENSES: Envía gastos modificados
  async pullExpenses(lastSyncedAtStr: string) {
    const lastSyncedAt = new Date(lastSyncedAtStr);
    const updated = await this.prisma.expense.findMany({
      where: { updatedAt: { gt: lastSyncedAt } },
      orderBy: { updatedAt: 'asc' }
    });
    return { expenses: updated, serverTime: new Date().toISOString() };
  }
}

