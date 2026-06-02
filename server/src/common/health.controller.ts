import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger('HealthController');
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().rss,
    };
  }

  @Get('seed')
  async seed() {
    try {
      // Lista de todas las tablas a verificar
      const tables = ['User', 'Product', 'Supplier', 'Client', 'Sale', 'SaleItem', 'Purchase', 'PurchaseItem', 'Payroll', 'RefreshToken', 'AuditLog'];
      for (const t of tables) {
        try {
          await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "${t}"`);
        } catch {
          this.logger.log(`Creando tabla ${t}...`);
          if (t === 'User') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "password" TEXT NOT NULL, "name" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'CASHIER', "pin" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id"))`);
            await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`);
          } else if (t === 'Product') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Product" ("id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "category" TEXT NOT NULL, "price" DOUBLE PRECISION NOT NULL, "cost" DOUBLE PRECISION NOT NULL, "stock" INTEGER NOT NULL DEFAULT 0, "minStock" INTEGER NOT NULL DEFAULT 5, "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Product_pkey" PRIMARY KEY ("id"))`);
            await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Product_code_key" ON "Product"("code")`);
          } else if (t === 'Supplier') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Supplier" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "contact" TEXT, "phone" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id"))`);
          } else if (t === 'Client') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Client" ("id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT, "phone" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Client_pkey" PRIMARY KEY ("id"))`);
          } else if (t === 'Sale') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Sale" ("id" TEXT NOT NULL, "ticketNumber" TEXT NOT NULL, "cashierId" TEXT NOT NULL, "clientId" TEXT, "total" DOUBLE PRECISION NOT NULL, "paymentMethod" TEXT NOT NULL, "dolarRate" DOUBLE PRECISION NOT NULL DEFAULT 40.50, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Sale_pkey" PRIMARY KEY ("id"))`);
            await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Sale_ticketNumber_key" ON "Sale"("ticketNumber")`);
          } else if (t === 'SaleItem') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SaleItem" ("id" TEXT NOT NULL, "saleId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "price" DOUBLE PRECISION NOT NULL, CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id"))`);
          } else if (t === 'Purchase') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Purchase" ("id" TEXT NOT NULL, "invoiceNumber" TEXT, "supplierId" TEXT NOT NULL, "total" DOUBLE PRECISION NOT NULL, "ocrProcessed" BOOLEAN NOT NULL DEFAULT false, "ocrRawData" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id"))`);
          } else if (t === 'PurchaseItem') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PurchaseItem" ("id" TEXT NOT NULL, "purchaseId" TEXT NOT NULL, "productId" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "cost" DOUBLE PRECISION NOT NULL, CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id"))`);
          } else if (t === 'Payroll') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Payroll" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "baseSalary" DOUBLE PRECISION NOT NULL, "hoursWorked" INTEGER NOT NULL DEFAULT 0, "bonuses" DOUBLE PRECISION NOT NULL DEFAULT 0, "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalPaid" DOUBLE PRECISION NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDIENTE', "paymentDate" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id"))`);
          } else if (t === 'RefreshToken') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RefreshToken" ("id" TEXT NOT NULL, "token" TEXT NOT NULL, "userId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id"))`);
            await this.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token")`);
            await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId")`);
          } else if (t === 'AuditLog') {
            await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AuditLog" ("id" TEXT NOT NULL, "userId" TEXT, "action" TEXT NOT NULL, "details" TEXT NOT NULL, "ipAddress" TEXT NOT NULL, "userAgent" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"))`);
          }
        }
      }

      // Crear foreign keys
      const fks = [
        'ALTER TABLE "Sale" ADD CONSTRAINT IF NOT EXISTS "fk_sale_cashier" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
        'ALTER TABLE "Sale" ADD CONSTRAINT IF NOT EXISTS "fk_sale_client" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        'ALTER TABLE "SaleItem" ADD CONSTRAINT IF NOT EXISTS "fk_saleitem_sale" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE',
        'ALTER TABLE "SaleItem" ADD CONSTRAINT IF NOT EXISTS "fk_saleitem_product" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
        'ALTER TABLE "Purchase" ADD CONSTRAINT IF NOT EXISTS "fk_purchase_supplier" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
        'ALTER TABLE "PurchaseItem" ADD CONSTRAINT IF NOT EXISTS "fk_purchaseitem_purchase" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE',
        'ALTER TABLE "PurchaseItem" ADD CONSTRAINT IF NOT EXISTS "fk_purchaseitem_product" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
        'ALTER TABLE "Payroll" ADD CONSTRAINT IF NOT EXISTS "fk_payroll_employee" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
        'ALTER TABLE "RefreshToken" ADD CONSTRAINT IF NOT EXISTS "fk_refreshtoken_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE',
        'ALTER TABLE "AuditLog" ADD CONSTRAINT IF NOT EXISTS "fk_auditlog_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE',
      ];
      for (const fk of fks) {
        try { await this.prisma.$executeRawUnsafe(fk); } catch {}
      }

      // Seed data
      const adminPassword = await bcrypt.hash('admin123', 10);
      const cashierPassword = await bcrypt.hash('cajero123', 10);
      const adminPin = await bcrypt.hash('1234', 10);
      const cashierPin = await bcrypt.hash('5678', 10);

      const admin = await this.prisma.user.upsert({
        where: { email: 'admin@stockmaster.com' },
        update: {},
        create: { email: 'admin@stockmaster.com', password: adminPassword, name: 'Admin Principal', role: 'ADMIN', pin: adminPin },
      });
      const cashier = await this.prisma.user.upsert({
        where: { email: 'cajero@stockmaster.com' },
        update: {},
        create: { email: 'cajero@stockmaster.com', password: cashierPassword, name: 'Cajero Demo', role: 'CASHIER', pin: cashierPin },
      });

      const products = [
        { code: 'PROD001', name: 'Arroz 1kg', category: 'Alimentos', price: 1.50, cost: 1.00, stock: 100, minStock: 10 },
        { code: 'PROD002', name: 'Frijoles 500g', category: 'Alimentos', price: 1.20, cost: 0.80, stock: 80, minStock: 10 },
        { code: 'PROD003', name: 'Aceite 1L', category: 'Alimentos', price: 3.00, cost: 2.20, stock: 50, minStock: 5 },
        { code: 'PROD004', name: 'Azúcar 1kg', category: 'Alimentos', price: 1.80, cost: 1.30, stock: 60, minStock: 10 },
        { code: 'PROD005', name: 'Leche 1L', category: 'Lácteos', price: 2.20, cost: 1.60, stock: 40, minStock: 8 },
        { code: 'PROD006', name: 'Pan Molde', category: 'Panadería', price: 2.50, cost: 1.80, stock: 30, minStock: 5 },
        { code: 'PROD007', name: 'Huevos x12', category: 'Alimentos', price: 2.00, cost: 1.40, stock: 70, minStock: 15 },
        { code: 'PROD008', name: 'Agua 1.5L', category: 'Bebidas', price: 0.80, cost: 0.40, stock: 120, minStock: 20 },
        { code: 'PROD009', name: 'Jabón de Baño', category: 'Limpieza', price: 1.50, cost: 1.00, stock: 45, minStock: 8 },
        { code: 'PROD010', name: 'Detergente 500g', category: 'Limpieza', price: 3.50, cost: 2.50, stock: 35, minStock: 5 },
      ];
      for (const p of products) {
        await this.prisma.product.upsert({ where: { code: p.code }, update: {}, create: p });
      }

      await this.prisma.supplier.create({ data: { name: 'Distribuidora Mayorista', contact: 'Juan Pérez', phone: '+505 8888-0000' } }).catch(() => {});
      await this.prisma.client.create({ data: { name: 'Cliente General', email: 'cliente@example.com', phone: '+505 7777-0000' } }).catch(() => {});

      return { seeded: true, users: [admin.email, cashier.email], products: products.length };
    } catch (e) {
      this.logger.error('Seed error', e);
      return { error: e.message };
    }
  }
}
