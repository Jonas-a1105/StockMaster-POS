import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // 1. Obtener KPIs clave e indicadores de negocio
  async getBusinessKPIs() {
    // A. Ventas totales y cantidad de transacciones
    const salesStats = await this.prisma.sale.aggregate({
      _sum: {
        total: true
      },
      _count: {
        id: true
      }
    });

    const totalSales = salesStats._sum.total || 0;
    const totalTransactions = salesStats._count.id || 0;

    // B. Calcular el costo total e histórico de las ventas procesadas para calcular ganancia neta
    const saleItems = await this.prisma.saleItem.findMany({
      include: {
        product: {
          select: {
            cost: true
          }
        }
      }
    });

    const totalCostOfSales = saleItems.reduce((acc, item) => {
      const itemCost = item.product?.cost || 0;
      return acc + (itemCost * item.quantity);
    }, 0);

    const netProfit = totalSales - totalCostOfSales;

    // C. Valor total estimado del inventario actual
    const products = await this.prisma.product.findMany({
      select: {
        stock: true,
        cost: true,
        price: true
      }
    });

    const activeInventoryCostValue = products.reduce((acc, prod) => acc + (prod.cost * prod.stock), 0);
    const activeInventoryRetailValue = products.reduce((acc, prod) => acc + (prod.price * prod.stock), 0);

    // D. Cantidad de productos en estado de "Bajo Stock"
    const lowStockCount = await this.prisma.product.count({
      where: {
        stock: {
          lte: this.prisma.product.fields.minStock
        }
      }
    });

    return {
      kpis: {
        totalRevenue: Number(totalSales.toFixed(2)),
        totalCost: Number(totalCostOfSales.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        transactionsCount: totalTransactions,
        inventoryCostValue: Number(activeInventoryCostValue.toFixed(2)),
        inventoryRetailValue: Number(activeInventoryRetailValue.toFixed(2)),
        lowStockProductsCount: lowStockCount
      }
    };
  }

  // 2. Obtener desglose de ventas agrupadas por categoría de producto
  async getSalesByCategory() {
    const saleItems = await this.prisma.saleItem.findMany({
      include: {
        product: {
          select: {
            category: true,
            price: true
          }
        }
      }
    });

    const categoryMap: { [key: string]: { quantity: number; revenue: number } } = {};

    for (const item of saleItems) {
      const category = item.product?.category || 'General';
      const itemRevenue = item.price * item.quantity;

      if (!categoryMap[category]) {
        categoryMap[category] = { quantity: 0, revenue: 0 };
      }

      categoryMap[category].quantity += item.quantity;
      categoryMap[category].revenue += itemRevenue;
    }

    // Formatea los datos para gráficos
    return Object.keys(categoryMap).map(cat => ({
      category: cat,
      quantitySold: categoryMap[cat].quantity,
      totalRevenue: Number(categoryMap[cat].revenue.toFixed(2))
    }));
  }

  // 3. Obtener el historial de los ultimos logs de auditoría para el panel del Auditor
  async getRecentAuditLogs(limit = 10) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
  }
}
