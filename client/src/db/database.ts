import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

// Habilita el plugin de construcción de consultas reactivas en RxDB
addRxPlugin(RxDBQueryBuilderPlugin);
// Habilita el plugin de migración de esquemas en RxDB
addRxPlugin(RxDBMigrationSchemaPlugin);

let devModePromise: Promise<void> | null = null;
if (import.meta.env.DEV) {
  devModePromise = import('rxdb/plugins/dev-mode').then(({ RxDBDevModePlugin }) => {
    addRxPlugin(RxDBDevModePlugin);
  });
}

// 1. Esquema JSON de Usuarios (Caché local seguro para login offline)
const userSchema = {
  title: 'user schema',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string' },
    passwordHash: { type: 'string' }, // Hash encriptado de la contraseña
    pinHash: { type: 'string' },      // Hash encriptado del PIN rápido
    baseSalary: { type: 'number' },   // Salario base por defecto ($)
    commissionRate: { type: 'number' }, // Tasa de comisión sobre ventas (ej: 0.05 para 5%)
    warehouseName: { type: 'string' },  // Nombre de la bodega/sucursal del usuario
    warehouseConfig: { type: 'string' }, // JSON serializado con configuración del catálogo de bodega
    updatedAt: { type: 'string' }
  },
  required: ['id', 'email', 'name', 'role', 'passwordHash', 'updatedAt']
};

// 2. Esquema JSON de Productos (Coincide con el modelo relacional del servidor)
const productSchema = {
  title: 'product schema',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    code: { type: 'string', maxLength: 50 },
    name: { type: 'string' },
    category: { type: 'string' },
    price: { type: 'number' },
    wholesalePrice: { type: 'number' },
    cost: { type: 'number' },
    stock: { type: 'number' },
    minStock: { type: 'number' },
    batches: { type: 'string' },
    version: { type: 'integer' },
    deletedAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'code', 'name', 'price', 'stock', 'updatedAt']
};

// 3. Esquema JSON de Ventas (Carrito y ticket offline)
const saleSchema = {
  title: 'sale schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    ticketNumber: { type: 'string', maxLength: 50 },
    cashierId: { type: 'string' },
    clientId: { type: 'string' },
    total: { type: 'number' },
    paymentMethod: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'number' },
          price: { type: 'number' }
        },
        required: ['productId', 'quantity', 'price']
      }
    },
    pendingSync: { type: 'boolean' }, // Control para replicación diferida
    dolarRate: { type: 'number' },
    usdReceived: { type: 'number' },
    vesReceived: { type: 'number' },
    eurReceived: { type: 'number' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'ticketNumber', 'cashierId', 'total', 'paymentMethod', 'items', 'pendingSync', 'dolarRate', 'createdAt', 'updatedAt']
};

// 4. Esquema JSON de Clientes
const clientSchema = {
  title: 'client schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    address: { type: 'string' },
    clientType: { type: 'string' }, // 'Detal' | 'Mayorista'
    creditLimit: { type: 'number' },
    creditBalance: { type: 'number' },
    creditPayments: { type: 'string' }, // Historial de abonos (JSON string)
    updatedAt: { type: 'string' }
  },
  required: ['id', 'name', 'updatedAt']
};

// 5. Esquema JSON de Proveedores
const supplierSchema = {
  title: 'supplier schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    rif: { type: 'string' },
    companyName: { type: 'string' },
    contactName: { type: 'string' },
    email: { type: 'string' },
    phone: { type: 'string' },
    address: { type: 'string' },
    category: { type: 'string' },
    paymentTerms: { type: 'string' },
    status: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'companyName', 'updatedAt']
};

// 6. Esquema JSON de Compras
const purchaseSchema = {
  title: 'purchase schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    supplierId: { type: 'string' },
    invoiceNumber: { type: 'string' },
    total: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'number' },
          cost: { type: 'number' }
        },
        required: ['productId', 'quantity', 'cost']
      }
    },
    pendingSync: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'supplierId', 'total', 'items', 'pendingSync', 'createdAt', 'updatedAt']
};

// 7. Esquema JSON de Nómina (Esquema Bimonetario)
const payrollSchema = {
  title: 'payroll schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    employeeId: { type: 'string' },
    employeeName: { type: 'string' },
    baseSalary: { type: 'number' },
    hoursWorked: { type: 'integer' },
    bonuses: { type: 'number' },
    deductions: { type: 'number' },
    totalPaid: { type: 'number' },
    status: { type: 'string' },
    paymentDate: { type: 'string' },
    dolarRate: { type: 'number' },           // Tasa bimonetaria
    paymentCurrency: { type: 'string' },     // Moneda del pago (USD / VES / MIXTO)
    paidInUSD: { type: 'number' },           // Total pagado en USD
    paidInVES: { type: 'number' },           // Total pagado en VES
    advancesUSD: { type: 'number' },         // Adelantos tomados en USD
    advancesVES: { type: 'number' },         // Adelantos tomados en VES
    paymentMethod: { type: 'string' },       // Transferencia / Efectivo / Pago Móvil / Mixto
    pendingSync: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'employeeId', 'baseSalary', 'totalPaid', 'status', 'paymentDate', 'pendingSync', 'createdAt', 'updatedAt']
};

// 8. Esquema JSON de Asistencia / Turnos
const attendanceSchema = {
  title: 'attendance schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    employeeId: { type: 'string' },
    employeeName: { type: 'string' },
    checkIn: { type: 'string' },
    checkOut: { type: 'string' },
    hoursWorked: { type: 'number' },
    status: { type: 'string' },
    pendingSync: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'employeeId', 'employeeName', 'checkIn', 'pendingSync', 'createdAt', 'updatedAt']
};

// 9. Esquema JSON de Auditoría local
const auditLogSchema = {
  title: 'audit log schema',
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    userId: { type: 'string' },
    action: { type: 'string' },
    details: { type: 'string' },
    severity: { type: 'string' },
    createdAt: { type: 'string' }
  },
  required: ['id', 'action', 'createdAt']
};

// 10. Esquema JSON de Gastos Operativos Generales
const expenseSchema = {
  title: 'expense schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    description: { type: 'string' },
    amount: { type: 'number' },
    category: { type: 'string' },
    date: { type: 'string' },
    pendingSync: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'description', 'amount', 'date', 'pendingSync', 'createdAt', 'updatedAt']
};

// Definición de tipos para las colecciones RxDB
export type UserDocType = {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  pinHash?: string;
  baseSalary?: number;
  commissionRate?: number;
  warehouseName?: string;
  warehouseConfig?: string;
  updatedAt: string;
};

export type ProductDocType = {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  wholesalePrice?: number;
  cost: number;
  stock: number;
  minStock: number;
  batches?: string;
  version: number;
  deletedAt?: string;
  updatedAt: string;
};

export type SaleDocType = {
  id: string;
  ticketNumber: string;
  cashierId: string;
  clientId?: string;
  total: number;
  paymentMethod: string;
  items: Array<{ productId: string; quantity: number; price: number }>;
  pendingSync: boolean;
  dolarRate: number;
  usdReceived?: number;
  vesReceived?: number;
  eurReceived?: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientDocType = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  clientType?: 'Detal' | 'Mayorista';
  creditLimit?: number;
  creditBalance?: number;
  creditPayments?: string; // JSON de pagos
  updatedAt: string;
};

export type SupplierDocType = {
  id: string;
  rif: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  paymentTerms: string;
  status: string;
  updatedAt: string;
};

export type PurchaseDocType = {
  id: string;
  supplierId: string;
  invoiceNumber?: string;
  total: number;
  items: Array<{ productId: string; quantity: number; cost: number }>;
  pendingSync: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PayrollDocType = {
  id: string;
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  hoursWorked: number;
  bonuses: number;
  deductions: number;
  totalPaid: number;
  status: string;
  paymentDate: string;
  dolarRate?: number;
  paymentCurrency?: string;
  paidInUSD?: number;
  paidInVES?: number;
  advancesUSD?: number;
  advancesVES?: number;
  paymentMethod?: string;
  pendingSync: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceDocType = {
  id: string;
  employeeId: string;
  employeeName: string;
  checkIn: string;
  checkOut?: string;
  hoursWorked?: number;
  status: string;
  pendingSync: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogDocType = {
  id: string;
  userId?: string;
  action: string;
  details?: string;
  severity?: string;
  createdAt: string;
};

export type ExpenseDocType = {
  id: string;
  description: string;
  amount: number;
  category?: string;
  date: string;
  pendingSync: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StockMasterCollections = {
  users: RxCollection<UserDocType>;
  products: RxCollection<ProductDocType>;
  sales: RxCollection<SaleDocType>;
  clients: RxCollection<ClientDocType>;
  suppliers: RxCollection<SupplierDocType>;
  purchases: RxCollection<PurchaseDocType>;
  payroll: RxCollection<PayrollDocType>;
  attendance: RxCollection<AttendanceDocType>;
  auditLogs: RxCollection<AuditLogDocType>;
  expenses: RxCollection<ExpenseDocType>;
};

export type StockMasterDatabase = RxDatabase<StockMasterCollections>;

let dbPromise: Promise<StockMasterDatabase> | null = null;

// Inicializador único de la base de datos IndexedDB local
export async function getDatabase(): Promise<StockMasterDatabase> {
  if (devModePromise) {
    await devModePromise;
  }
  if (!dbPromise) {
    const currentDbName = 'stockmaster_local_db_v7';
    const savedDbName = localStorage.getItem('active_rxdb_name');
    if (savedDbName !== currentDbName) {
      localStorage.removeItem('last_synced_at');
      localStorage.setItem('active_rxdb_name', currentDbName);
    }

    const dexieStorage = getRxStorageDexie();
    const storage = import.meta.env.DEV
      ? wrappedValidateAjvStorage({ storage: dexieStorage })
      : dexieStorage;

    dbPromise = createRxDatabase<StockMasterCollections>({
      name: currentDbName,
      storage,
      multiInstance: true,
      eventReduce: true,
      ...(import.meta.env.DEV && { ignoreDuplicate: true })
    }).then(async (db) => {
      console.log('✅ Base de datos RxDB local (IndexedDB) inicializada con éxito.');
      
      // Agrega las colecciones del sistema POS offline
      await db.addCollections({
        users: { 
          schema: userSchema,
          migrationStrategies: {
            // Migración desde versión 0 a versión 1: Añadir propiedades de bodega del usuario
            1: (oldDoc: any) => {
              oldDoc.warehouseName = oldDoc.warehouseName ?? '';
              oldDoc.warehouseConfig = oldDoc.warehouseConfig ?? '';
              return oldDoc;
            }
          }
        },
        products: { 
          schema: productSchema,
          migrationStrategies: {
            1: (oldDoc: any) => {
              oldDoc.deletedAt = null;
              return oldDoc;
            }
          }
        },
        sales: { schema: saleSchema },
        clients: { schema: clientSchema },
        suppliers: { schema: supplierSchema },
        purchases: { schema: purchaseSchema },
        payroll: { schema: payrollSchema },
        attendance: { schema: attendanceSchema },
        auditLogs: { 
          schema: auditLogSchema,
          migrationStrategies: {
            // Migración desde versión 0 a versión 1: Añadir propiedad severity por defecto
            1: (oldDoc: any) => {
              oldDoc.severity = 'info';
              return oldDoc;
            }
          }
        },
        expenses: { schema: expenseSchema }
      });

      const { migrateLocalStorageToRxDB } = await import('./migration');
      await migrateLocalStorageToRxDB(db);
      
      return db;
    });
  }
  return dbPromise;
}

export async function purgeDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    dbPromise = null;
    try {
      await db.remove();
      console.log('🗑️ Base de datos RxDB local eliminada con éxito.');
    } catch (e) {
      console.error('Error al remover la base de datos RxDB:', e);
    }
  } else {
    const currentDbName = 'stockmaster_local_db_v7';
    const { removeRxDatabase } = await import('rxdb');
    try {
      await removeRxDatabase(currentDbName, getRxStorageDexie());
      console.log('🗑️ Base de datos RxDB local eliminada por nombre con éxito.');
    } catch (e) {
      console.error('Error al remover la base de datos por nombre:', e);
    }
  }
  localStorage.removeItem('last_synced_at');
}
