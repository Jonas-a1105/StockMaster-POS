import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService
  ) {}

  // 1. PUSH: Recibe cambios del cliente local y los escribe en PostgreSQL central
  async pushProducts(clientProducts: any[], userId: string) {
    const processedIds: string[] = [];

    // Se procesa en una transacción para asegurar consistencia atómica
    await this.prisma.$transaction(async (tx) => {
      for (const clientProd of clientProducts) {
        const serverProd = await tx.product.findUnique({
          where: { id: clientProd.id }
        });

        const clientUpdatedAt = new Date(clientProd.updatedAt);

        if (!serverProd) {
          // A. Documento nuevo: Se registra directamente en PostgreSQL
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
              '127.0.0.1',
              'RxDB Sync Client'
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
  async pullProducts(lastSyncedAtStr: string) {
    const lastSyncedAt = new Date(lastSyncedAtStr);
    
    // Obtiene únicamente los productos modificados después de la fecha de última sincronización
    const updatedProducts = await this.prisma.product.findMany({
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
      products: updatedProducts,
      serverTime: new Date().toISOString()
    };
  }

  // 3. PUSH SALES: Recibe ventas realizadas offline y las procesa en PostgreSQL central restando stock
  async pushSales(clientSales: any[], userId: string) {
    const processedIds: string[] = [];

    for (const clientSale of clientSales) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // A. Verificar si la venta ya existe para evitar duplicidades
          const existingSale = await tx.sale.findUnique({
            where: { id: clientSale.id }
          });

          if (existingSale) {
            processedIds.push(clientSale.id);
            return; // Ya procesada previamente
          }

          // B. Crear la venta principal
          await tx.sale.create({
            data: {
              id: clientSale.id,
              ticketNumber: clientSale.ticketNumber,
              cashierId: clientSale.cashierId,
              clientId: clientSale.clientId || null,
              total: clientSale.total,
              paymentMethod: clientSale.paymentMethod,
              dolarRate: clientSale.dolarRate || 40.50,
              createdAt: new Date(clientSale.createdAt),
              updatedAt: new Date(clientSale.updatedAt)
            }
          });

          // C. Crear los ítems de venta y restar el stock correspondiente de cada producto
          for (const item of clientSale.items) {
            await tx.saleItem.create({
              data: {
                saleId: clientSale.id,
                productId: item.productId,
                quantity: item.quantity,
                price: item.price
              }
            });

            // Restar stock del producto de forma transaccional y robusta
            const product = await tx.product.findUnique({
              where: { id: item.productId }
            });

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
                  '127.0.0.1',
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
            '127.0.0.1',
            'RxDB Sync Client'
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
  async pushClients(clientClients: any[], userId: string) {
    const processedIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const clientCl of clientClients) {
        const serverCl = await tx.client.findUnique({
          where: { id: clientCl.id }
        });

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
  async pushSuppliers(clientSuppliers: any[], userId: string) {
    const processedIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const s of clientSuppliers) {
        const existing = await tx.supplier.findUnique({ where: { id: s.id } });
        const clientUpdatedAt = new Date(s.updatedAt);

        if (!existing) {
          await tx.supplier.create({
            data: {
              id: s.id,
              name: s.companyName || s.name,
              contact: s.contactName || null,
              phone: s.phone || null,
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
  async pushPurchases(clientPurchases: any[], userId: string) {
    const processedIds: string[] = [];

    for (const p of clientPurchases) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const existing = await tx.purchase.findUnique({ where: { id: p.id } });
          if (existing) { processedIds.push(p.id); return; }

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
              await tx.purchaseItem.create({
                data: {
                  purchaseId: p.id,
                  productId: item.productId,
                  quantity: item.quantity,
                  cost: item.cost
                }
              });

              const product = await tx.product.findUnique({ where: { id: item.productId } });
              if (product) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: {
                    stock: product.stock + item.quantity,
                    version: product.version + 1,
                    updatedAt: new Date()
                  }
                });
              }
            }
          }

          await this.auditoria.logAction(userId, 'SYNC_COMPRA_PROCESADA', { purchaseId: p.id, total: p.total }, '127.0.0.1', 'RxDB Sync Client');
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
  async pushPayroll(clientPayroll: any[], userId: string) {
    const processedIds: string[] = [];

    for (const pr of clientPayroll) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const existing = await tx.payroll.findUnique({ where: { id: pr.id } });
          if (existing) { processedIds.push(pr.id); return; }

          await tx.payroll.create({
            data: {
              id: pr.id,
              employeeId: pr.employeeId,
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

          await this.auditoria.logAction(userId, 'SYNC_NOMINA_PROCESADA', { payrollId: pr.id, employeeId: pr.employeeId, totalPaid: pr.totalPaid }, '127.0.0.1', 'RxDB Sync Client');
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
}
