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
        product: { select: { cost: true } }
      }
    });
    const totalCostOfSales = saleItems.reduce(
      (sum, item) => sum + item.quantity * item.product.cost,
      0
    );

    const netProfit = totalSales - totalCostOfSales;

    // C. Valor total estimado del inventario actual
    const allProducts = await this.prisma.product.findMany();
    const activeInventoryCostValue = allProducts.reduce(
      (sum, p) => sum + p.cost * p.stock,
      0
    );
    const activeInventoryRetailValue = allProducts.reduce(
      (sum, p) => sum + p.price * p.stock,
      0
    );

    // D. Cantidad de productos en estado de "Bajo Stock"
    const lowStockCount = allProducts.filter(p => p.stock <= p.minStock).length;

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
        product: { select: { category: true, price: true } }
      }
    });

    const grouped = new Map<string, { quantitySold: number; totalRevenue: number }>();
    for (const item of saleItems) {
      const cat = item.product.category || 'General';
      const prev = grouped.get(cat) || { quantitySold: 0, totalRevenue: 0 };
      prev.quantitySold += item.quantity;
      prev.totalRevenue += item.price * item.quantity;
      grouped.set(cat, prev);
    }

    return Array.from(grouped.entries()).map(([category, data]) => ({
      category,
      quantitySold: data.quantitySold,
      totalRevenue: Number(data.totalRevenue.toFixed(2))
    }));
  }

  // 3. Obtener productos estrella (top más vendidos)
  async getStarProducts(limit = 10) {
    const saleItems = await this.prisma.saleItem.findMany({
      include: {
        product: {
          select: { id: true, name: true, code: true, category: true, price: true, cost: true }
        }
      }
    });

    const grouped = new Map<string, {
      id: string; name: string; sku: string; category: string;
      unitsSold: number; retailPrice: number; costPrice: number;
      totalRevenue: number; netMargin: number; roi: number;
    }>();

    for (const item of saleItems) {
      const prod = item.product;
      const prev = grouped.get(prod.id) || {
        id: prod.id, name: prod.name, sku: prod.code, category: prod.category,
        unitsSold: 0, retailPrice: prod.price, costPrice: prod.cost,
        totalRevenue: 0, netMargin: 0, roi: 0
      };
      prev.unitsSold += item.quantity;
      prev.totalRevenue += item.price * item.quantity;
      grouped.set(prod.id, prev);
    }

    const products = Array.from(grouped.values()).map(p => {
      const totalCost = p.unitsSold * p.costPrice;
      p.netMargin = p.totalRevenue - totalCost;
      p.roi = totalCost > 0 ? Math.round((p.netMargin / totalCost) * 100) : 0;
      p.totalRevenue = Number(p.totalRevenue.toFixed(2));
      return p;
    });

    products.sort((a, b) => b.totalRevenue - a.totalRevenue);
    return products.slice(0, limit);
  }

  // 4. Obtener rendimiento semanal (Ingresos vs Costos) para gráfica financiera
  async getWeeklyPerformance() {
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: fourWeeksAgo }
      },
      include: {
        saleItems: {
          include: {
            product: { select: { cost: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group into 4 weekly buckets
    const buckets: Array<{ label: string; totalRevenue: number; totalCost: number }> = [];
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const startTime = fourWeeksAgo.getTime();

    for (let w = 0; w < 4; w++) {
      const weekStart = new Date(startTime + w * msPerWeek);
      const weekEnd = new Date(startTime + (w + 1) * msPerWeek);
      let totalRevenue = 0;
      let totalCost = 0;

      for (const sale of sales) {
        const t = sale.createdAt.getTime();
        if (t >= weekStart.getTime() && t < weekEnd.getTime()) {
          totalRevenue += sale.total;
          for (const item of sale.saleItems) {
            totalCost += item.quantity * item.product.cost;
          }
        }
      }

      buckets.push({
        label: `Semana ${w + 1}`,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
      });
    }

    return buckets;
  }

  // 5. Obtener el historial de los ultimos logs de auditoría para el panel del Auditor
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
