import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const cashierPassword = await bcrypt.hash('cajero123', 10);
  const adminPin = await bcrypt.hash('1234', 10);
  const cashierPin = await bcrypt.hash('5678', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@stockmaster.com' },
    update: {},
    create: {
      email: 'admin@stockmaster.com',
      password: adminPassword,
      name: 'Admin Principal',
      role: 'ADMIN',
      pin: adminPin,
    },
  });
  console.log(`  ✅ Admin creado: ${admin.email}`);

  const cashier = await prisma.user.upsert({
    where: { email: 'cajero@stockmaster.com' },
    update: {},
    create: {
      email: 'cajero@stockmaster.com',
      password: cashierPassword,
      name: 'Cajero Demo',
      role: 'CASHIER',
      pin: cashierPin,
    },
  });
  console.log(`  ✅ Cajero creado: ${cashier.email}`);

  const products = [
    { code: '75010001', name: 'Arroz Blanq 1kg', category: 'Alimentos', price: 1.20, cost: 0.85, stock: 150, minStock: 20 },
    { code: '75010002', name: 'Aceite Maíz 1L', category: 'Alimentos', price: 2.50, cost: 1.80, stock: 80, minStock: 15 },
    { code: '75010003', name: 'Azúcar 1kg', category: 'Alimentos', price: 0.90, cost: 0.60, stock: 200, minStock: 30 },
    { code: '75010004', name: 'Leche Completa 1L', category: 'Lácteos', price: 1.80, cost: 1.20, stock: 60, minStock: 10 },
    { code: '75010005', name: 'Pan Molde 500g', category: 'Panadería', price: 1.50, cost: 0.95, stock: 40, minStock: 8 },
    { code: '75010006', name: 'Queso Amarillo 500g', category: 'Lácteos', price: 3.20, cost: 2.40, stock: 25, minStock: 5 },
    { code: '75010007', name: 'Jabón Baño 125g', category: 'Limpieza', price: 0.75, cost: 0.45, stock: 100, minStock: 20 },
    { code: '75010008', name: 'Detergente 500g', category: 'Limpieza', price: 2.00, cost: 1.40, stock: 45, minStock: 10 },
    { code: '75010009', name: 'Refresco Cola 2L', category: 'Bebidas', price: 1.60, cost: 1.00, stock: 90, minStock: 15 },
    { code: '75010010', name: 'Agua Mineral 1.5L', category: 'Bebidas', price: 0.80, cost: 0.50, stock: 120, minStock: 25 },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }
  console.log(`  ✅ ${products.length} productos creados`);

  const client = await prisma.client.upsert({
    where: { id: 'cliente-demo-001' },
    update: {},
    create: {
      id: 'cliente-demo-001',
      name: 'Cliente Frecuente',
      email: 'cliente@email.com',
      phone: '+584121234567',
    },
  });
  console.log(`  ✅ Cliente demo: ${client.name}`);

  const supplier = await prisma.supplier.upsert({
    where: { id: 'proveedor-demo-001' },
    update: {},
    create: {
      id: 'proveedor-demo-001',
      name: 'Distribuidora Mayorista C.A.',
      contact: 'Juan Pérez',
      phone: '+584140000001',
    },
  });
  console.log(`  ✅ Proveedor demo: ${supplier.name}`);

  console.log('🌱 Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
