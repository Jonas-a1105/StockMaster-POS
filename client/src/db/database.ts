import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';

// Habilita el plugin de construcción de consultas reactivas en RxDB
addRxPlugin(RxDBQueryBuilderPlugin);

// Habilita dev-mode en desarrollo si es necesario (Vite-native environment check)
// if (import.meta.env.DEV) {
//   import('rxdb/plugins/dev-mode').then(({ RxDBDevModePlugin }) => {
//     addRxPlugin(RxDBDevModePlugin);
//   });
// }

// 1. Esquema JSON de Usuarios (Caché local seguro para login offline)
const userSchema = {
  title: 'user schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string' },
    passwordHash: { type: 'string' }, // Hash encriptado de la contraseña
    pinHash: { type: 'string' },      // Hash encriptado del PIN rápido
    updatedAt: { type: 'string' }
  },
  required: ['id', 'email', 'name', 'role', 'passwordHash', 'updatedAt']
};

// 2. Esquema JSON de Productos (Coincide con el modelo relacional del servidor)
const productSchema = {
  title: 'product schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    code: { type: 'string', maxLength: 50 },
    name: { type: 'string' },
    category: { type: 'string' },
    price: { type: 'number' },
    cost: { type: 'number' },
    stock: { type: 'integer' },
    minStock: { type: 'integer' },
    version: { type: 'integer' },
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
          quantity: { type: 'integer' },
          price: { type: 'number' }
        },
        required: ['productId', 'quantity', 'price']
      }
    },
    pendingSync: { type: 'boolean' }, // Control para replicación diferida
    dolarRate: { type: 'number' },
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
          quantity: { type: 'integer' },
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

// 7. Esquema JSON de Nómina
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
    pendingSync: { type: 'boolean' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'employeeId', 'baseSalary', 'totalPaid', 'status', 'paymentDate', 'pendingSync', 'createdAt', 'updatedAt']
};

// 8. Esquema JSON de Auditoría local
const auditLogSchema = {
  title: 'audit log schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    userId: { type: 'string' },
    action: { type: 'string' },
    details: { type: 'string' },
    createdAt: { type: 'string' }
  },
  required: ['id', 'action', 'createdAt']
};

// Definición de tipos para las colecciones RxDB
export type UserDocType = {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  pinHash?: string;
  updatedAt: string;
};

export type ProductDocType = {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  version: number;
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
  createdAt: string;
  updatedAt: string;
};

export type ClientDocType = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
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
  pendingSync: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogDocType = {
  id: string;
  userId?: string;
  action: string;
  details?: string;
  createdAt: string;
};

export type StockMasterCollections = {
  users: RxCollection<UserDocType>;
  products: RxCollection<ProductDocType>;
  sales: RxCollection<SaleDocType>;
  clients: RxCollection<ClientDocType>;
  suppliers: RxCollection<SupplierDocType>;
  purchases: RxCollection<PurchaseDocType>;
  payroll: RxCollection<PayrollDocType>;
  auditLogs: RxCollection<AuditLogDocType>;
};

export type StockMasterDatabase = RxDatabase<StockMasterCollections>;

let dbPromise: Promise<StockMasterDatabase> | null = null;

// Inicializador único de la base de datos IndexedDB local
export function getDatabase(): Promise<StockMasterDatabase> {
  if (!dbPromise) {
    dbPromise = createRxDatabase<StockMasterCollections>({
      name: 'stockmaster_local_db_v2',
      storage: getRxStorageDexie(),
      multiInstance: true,
      eventReduce: true
    }).then(async (db) => {
      console.log('✅ Base de datos RxDB local (IndexedDB) inicializada con éxito.');
      
      // Agrega las colecciones del sistema POS offline
      await db.addCollections({
        users: { schema: userSchema },
        products: { schema: productSchema },
        sales: { schema: saleSchema },
        clients: { schema: clientSchema },
        suppliers: { schema: supplierSchema },
        purchases: { schema: purchaseSchema },
        payroll: { schema: payrollSchema },
        auditLogs: { schema: auditLogSchema }
      });

      const { migrateLocalStorageToRxDB } = await import('./migration');
      await migrateLocalStorageToRxDB(db);
      
      return db;
    });
  }
  return dbPromise;
}
