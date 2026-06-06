import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger('ReportsService');

  constructor(private prisma: PrismaService) {}

  // 1. KPIs de negocio (agregaciones SQL, sin cargar todo a memoria)
  async getBusinessKPIs() {
    // A. Ventas totales y conteo de transacciones
    const salesStats = await this.prisma.sale.aggregate({
      _sum: { total: true },
      _count: { id: true },
    });
    const totalSales = salesStats._sum.total || 0;
    const totalTransactions = salesStats._count.id || 0;

    // B. Costo total de ventas (suma en SQL, sin cargar items a memoria)
    const costResult = await this.prisma.$queryRaw<Array<{ total: number | null }>>(Prisma.sql`
      SELECT COALESCE(SUM(si.quantity * p.cost), 0) AS total
      FROM SaleItem si
      INNER JOIN Product p ON p.id = si.productId
      WHERE p.deletedAt IS NULL
    `);
    const totalCostOfSales = costResult[0]?.total ?? 0;

    // B2. Nómina pagada y gastos operativos
    const [payrollStats, expenseStats] = await Promise.all([
      this.prisma.payroll.aggregate({
        _sum: { totalPaid: true },
        where: { status: 'PAGADO' },
      }),
      this.prisma.expense.aggregate({ _sum: { amount: true } }),
    ]);
    const totalPayroll = payrollStats._sum.totalPaid || 0;
    const totalExpenses = expenseStats._sum.amount || 0;

    const netProfit = totalSales - totalCostOfSales - totalPayroll - totalExpenses;

    // C. Valor del inventario (suma en SQL) + D. Low stock
    const [invCost, invRetail, lowStock] = await Promise.all([
      this.prisma.$queryRaw<Array<{ total: number | null }>>(Prisma.sql`
        SELECT COALESCE(SUM(cost * stock), 0) AS total
        FROM Product WHERE deletedAt IS NULL
      `),
      this.prisma.$queryRaw<Array<{ total: number | null }>>(Prisma.sql`
        SELECT COALESCE(SUM(price * stock), 0) AS total
        FROM Product WHERE deletedAt IS NULL
      `),
      this.prisma.product.count({
        where: { deletedAt: null, stock: { lte: this.prisma.product.fields.minStock } as any },
      }),
    ]);

    const activeInventoryCostValue = invCost[0]?.total ?? 0;
    const activeInventoryRetailValue = invRetail[0]?.total ?? 0;

    return {
      kpis: {
        totalRevenue: round2(totalSales),
        totalCost: round2(totalCostOfSales),
        totalPayroll: round2(totalPayroll),
        totalExpenses: round2(totalExpenses),
        netProfit: round2(netProfit),
        transactionsCount: totalTransactions,
        inventoryCostValue: round2(activeInventoryCostValue),
        inventoryRetailValue: round2(activeInventoryRetailValue),
        lowStockProductsCount: lowStock,
      },
    };
  }

  // 2. Ventas agrupadas por categoría (SQL groupBy)
  async getSalesByCategory() {
    const rows = await this.prisma.$queryRaw<Array<{ category: string; quantity: number; revenue: number }>>(Prisma.sql`
      SELECT
        COALESCE(p.category, 'General') AS category,
        SUM(si.quantity)                AS quantity,
        SUM(si.price * si.quantity)     AS revenue
      FROM SaleItem si
      INNER JOIN Product p ON p.id = si.productId
      GROUP BY p.category
      ORDER BY revenue DESC
    `);
    return rows.map((r) => ({
      category: r.category,
      quantitySold: Number(r.quantity || 0),
      totalRevenue: round2(Number(r.revenue || 0)),
    }));
  }

  // 3. Top productos más vendidos (SQL groupBy)
  async getStarProducts(limit = 10) {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string; name: string; code: string; category: string;
      price: number; cost: number;
      unitsSold: number; revenue: number;
    }>>(Prisma.sql`
      SELECT
        p.id, p.name, p.code, p.category, p.price, p.cost,
        SUM(si.quantity)            AS unitsSold,
        SUM(si.price * si.quantity) AS revenue
      FROM SaleItem si
      INNER JOIN Product p ON p.id = si.productId
      GROUP BY p.id
      ORDER BY revenue DESC
      LIMIT ${limit}
    `);

    return rows.map((r) => {
      const totalRevenue = Number(r.revenue || 0);
      const totalCost = Number(r.unitsSold || 0) * Number(r.cost || 0);
      const netMargin = totalRevenue - totalCost;
      const roi = totalCost > 0 ? Math.round((netMargin / totalCost) * 100) : 0;
      return {
        id: r.id,
        name: r.name,
        sku: r.code,
        category: r.category,
        retailPrice: Number(r.price || 0),
        costPrice: Number(r.cost || 0),
        unitsSold: Number(r.unitsSold || 0),
        totalRevenue: round2(totalRevenue),
        netMargin: round2(netMargin),
        roi,
      };
    });
  }

  // 4. Rendimiento semanal (SQL aggregations por bucket)
  async getWeeklyPerformance() {
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    // Traemos totales diarios agregados en SQL
    const [salesDaily, payrollDaily, expensesDaily, costDaily] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: string; total: number }>>(Prisma.sql`
        SELECT
          date(createdAt) AS day,
          COALESCE(SUM(total), 0) AS total
        FROM Sale
        WHERE createdAt >= ${fourWeeksAgo}
        GROUP BY date(createdAt)
      `),
      this.prisma.$queryRaw<Array<{ day: string; total: number }>>(Prisma.sql`
        SELECT
          date(paymentDate) AS day,
          COALESCE(SUM(totalPaid), 0) AS total
        FROM Payroll
        WHERE paymentDate >= ${fourWeeksAgo} AND status = 'PAGADO'
        GROUP BY date(paymentDate)
      `),
      this.prisma.$queryRaw<Array<{ day: string; total: number }>>(Prisma.sql`
        SELECT
          date(date) AS day,
          COALESCE(SUM(amount), 0) AS total
        FROM Expense
        WHERE date >= ${fourWeeksAgo}
        GROUP BY date(date)
      `),
      this.prisma.$queryRaw<Array<{ day: string; total: number }>>(Prisma.sql`
        SELECT
          date(s.createdAt) AS day,
          COALESCE(SUM(si.quantity * p.cost), 0) AS total
        FROM SaleItem si
        INNER JOIN Sale s ON s.id = si.saleId
        INNER JOIN Product p ON p.id = si.productId
        WHERE s.createdAt >= ${fourWeeksAgo}
        GROUP BY date(s.createdAt)
      `),
    ]);

    const indexByDay = <T extends { day: string; total: number }>(rows: T[]): Map<string, number> => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.day, Number(r.total || 0));
      return m;
    };

    const salesMap = indexByDay(salesDaily);
    const payrollMap = indexByDay(payrollDaily);
    const expensesMap = indexByDay(expensesDaily);
    const costMap = indexByDay(costDaily);

    const buckets = [];
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const startTime = fourWeeksAgo.getTime();

    for (let w = 0; w < 4; w++) {
      const weekStart = new Date(startTime + w * msPerWeek);
      const weekEnd = new Date(startTime + (w + 1) * msPerWeek);

      let totalRevenue = 0;
      let totalCost = 0;
      let totalPayroll = 0;
      let totalExpenses = 0;

      for (let d = new Date(weekStart); d < weekEnd; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        totalRevenue += salesMap.get(key) || 0;
        totalCost += costMap.get(key) || 0;
        totalPayroll += payrollMap.get(key) || 0;
        totalExpenses += expensesMap.get(key) || 0;
      }

      buckets.push({
        label: `Semana ${w + 1}`,
        totalRevenue: round2(totalRevenue),
        totalCost: round2(totalCost),
        totalPayroll: round2(totalPayroll),
        totalExpenses: round2(totalExpenses),
        netUtility: round2(totalRevenue - totalCost - totalPayroll - totalExpenses),
      });
    }

    return buckets;
  }

  // 5. Logs de auditoría recientes
  async getRecentAuditLogs(limit = 10) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
    });
  }

  // 6. Productos sin rotación (cold products) - SQL con subquery
  async getColdProducts(days = 30) {
    const thresholdDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // SQL único: productos con stock, sin ventas recientes, con última fecha de venta
    const rows = await this.prisma.$queryRaw<Array<{
      id: string; code: string; name: string; category: string;
      price: number; cost: number; stock: number;
      createdAt: Date; lastSaleDate: Date | null;
    }>>(Prisma.sql`
      SELECT
        p.id, p.code, p.name, p.category, p.price, p.cost, p.stock, p.createdAt,
        (SELECT MAX(s.createdAt)
         FROM SaleItem si
         INNER JOIN Sale s ON s.id = si.saleId
         WHERE si.productId = p.id) AS lastSaleDate
      FROM Product p
      WHERE p.deletedAt IS NULL
        AND p.stock > 0
        AND p.createdAt <= ${thresholdDate}
        AND NOT EXISTS (
          SELECT 1 FROM SaleItem si2
          INNER JOIN Sale s2 ON s2.id = si2.saleId
          WHERE si2.productId = p.id
            AND s2.createdAt >= ${thresholdDate}
        )
      ORDER BY p.createdAt ASC
      LIMIT 50
    `);

    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      category: r.category,
      price: Number(r.price || 0),
      cost: Number(r.cost || 0),
      stock: Number(r.stock || 0),
      createdAt: r.createdAt,
      lastSaleDate: r.lastSaleDate,
    }));
  }
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
