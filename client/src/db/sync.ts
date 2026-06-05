import { getDatabase } from './database';
import { API_URL } from '../config';
import { getValidToken } from './auth';

export interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: string;
  error: string | null;
  pendingSalesCount: number;
}

type SyncStateListener = (state: SyncState) => void;

class SyncWorker {
  private state: SyncState = {
    isSyncing: false,
    lastSyncedAt: localStorage.getItem('last_synced_at') || '1970-01-01T00:00:00.000Z',
    error: null,
    pendingSalesCount: 0
  };

  private listeners: Set<SyncStateListener> = new Set();
  private syncInterval: any = null;
  private boundGoOnline: (() => void) | null = null;
  private boundGoOffline: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.boundGoOnline = () => {
        console.log('🌐 Conexión de red recuperada. Iniciando sincronización automática...');
        this.startInterval();
        this.sync();
      };
      this.boundGoOffline = () => {
        console.log('🔌 Dispositivo sin conexión. Deteniendo sincronización periódica.');
        this.stopInterval();
      };

      window.addEventListener('online', this.boundGoOnline);
      window.addEventListener('offline', this.boundGoOffline);

      if (navigator.onLine) {
        this.startInterval();
      }
    }

    this.updatePendingSalesCount();
  }

  private startInterval() {
    this.stopInterval();
    this.syncInterval = setInterval(() => {
      this.sync();
    }, 120000);
  }

  private stopInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Registra un listener para actualizaciones reactivas del estado
  subscribe(listener: SyncStateListener) {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  private setState(newState: Partial<SyncState>) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  // Calcula cuántas ventas locales tienen la bandera 'pendingSync: true'
  async updatePendingSalesCount() {
    try {
      const db = await getDatabase();
      const pendingSales = await db.sales.find({
        selector: { pendingSync: true }
      }).exec();
      this.setState({ pendingSalesCount: pendingSales.length });
    } catch (err) {
      console.error('Error calculando ventas pendientes:', err);
    }
  }

  // Método principal de Sincronización en Tiempo Real
  async sync() {
    if (this.state.isSyncing) return;
    if (!navigator.onLine) {
      console.log('🔌 Sincronización cancelada: El dispositivo está sin conexión.');
      await this.updatePendingSalesCount();
      return;
    }

    const token = await getValidToken();
    if (!token) {
      console.log('🔑 Sincronización pospuesta: No hay sesión online activa (falta JWT token).');
      await this.updatePendingSalesCount();
      return;
    }

    console.log('🔄 Iniciando ciclo de sincronización bidireccional...');
    this.setState({ isSyncing: true, error: null });

    try {
      const db = await getDatabase();

      // ----------------------------------------------------
      // A. PUSH: Sincronizar Ventas Offline Realizadas
      // ----------------------------------------------------
      const pendingSales = await db.sales.find({
        selector: { pendingSync: true }
      }).exec();

      if (pendingSales.length > 0) {
        console.log(`[Sync] PUSH: Enviando ${pendingSales.length} ventas offline al servidor central...`);
        
        // Serializa las ventas para la petición
        const salesData = pendingSales.map(doc => doc.toJSON());

        const response = await fetch(`${API_URL}/sync/sales/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ sales: salesData })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const processedIds: string[] = data.processedIds || [];
          // Marca las ventas procesadas con éxito como 'pendingSync: false'
          for (const saleId of processedIds) {
            const doc = await db.sales.findOne({ selector: { id: saleId } }).exec();
            if (doc) {
              await doc.patch({ pendingSync: false });
            }
          }
          console.log(`[Sync] PUSH: ${processedIds.length} ventas sincronizadas exitosamente.`);
        } else {
          console.error('[Sync] PUSH Ventas falló:', data.message);
        }
      }

      // ----------------------------------------------------
      // B. PUSH: Sincronizar Productos Modificados Localmente
      // ----------------------------------------------------
      // Identifica productos modificados localmente comparando updatedAt con la última fecha de sincronización
      const lastSynced = this.state.lastSyncedAt;
      const localModifiedProducts = await db.products.find({
        selector: {
          updatedAt: { $gt: lastSynced }
        }
      }).exec();

      if (localModifiedProducts.length > 0) {
        console.log(`[Sync] PUSH: Enviando ${localModifiedProducts.length} productos modificados al servidor...`);
        const productsData = localModifiedProducts.map(doc => doc.toJSON());

        const response = await fetch(`${API_URL}/sync/products/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ products: productsData })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          console.log(`[Sync] PUSH: Productos modificados sincronizados exitosamente.`);
        } else {
          console.error('[Sync] PUSH Productos falló:', data.message);
        }
      }

      // ----------------------------------------------------
      // C. PULL: Descargar Cambios e Incrementales del Servidor
      // ----------------------------------------------------
      console.log(`[Sync] PULL: Descargando cambios de productos desde ${lastSynced}...`);
      const pullResponse = await fetch(`${API_URL}/sync/products/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ lastSyncedAt: lastSynced })
      });

      if (!pullResponse.ok) {
        console.warn(`[Sync] PULL Productos: ${pullResponse.status} - ${pullResponse.statusText}. Saltando pull de productos.`);
        this.setState({ lastSyncedAt: lastSynced, isSyncing: false, error: null });
        return;
      }

      const pullData = await pullResponse.json();

      if (pullData.success) {
        const { products, serverTime } = pullData;
        
        if (products && products.length > 0) {
          console.log(`[Sync] PULL: Recibidos ${products.length} productos modificados. Upserting...`);
          
          for (const prod of products) {
            // Upsert en IndexedDB local
            await db.products.upsert({
              id: prod.id,
              code: prod.code,
              name: prod.name,
              category: prod.category,
              price: Number(prod.price),
              cost: Number(prod.cost),
              stock: Number(prod.stock),
              minStock: Number(prod.minStock),
              version: Number(prod.version),
              updatedAt: new Date(prod.updatedAt).toISOString()
            });
          }
        }

        // ----------------------------------------------------
        // D. PUSH: Sincronizar Clientes Creados/Modificados Localmente
        // ----------------------------------------------------
        const localModifiedClients = await db.clients.find({
          selector: {
            updatedAt: { $gt: lastSynced }
          }
        }).exec();

        if (localModifiedClients.length > 0) {
          console.log(`[Sync] PUSH: Enviando ${localModifiedClients.length} clientes modificados al servidor...`);
          const clientsData = localModifiedClients.map(doc => doc.toJSON());

          const clientPushResponse = await fetch(`${API_URL}/sync/clients/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ clients: clientsData })
          });

          const clientPushData = await clientPushResponse.json();
          if (clientPushResponse.ok && clientPushData.success) {
            console.log(`[Sync] PUSH: Clientes sincronizados exitosamente.`);
          } else {
            console.error('[Sync] PUSH Clientes falló:', clientPushData.message);
          }
        }

        // ----------------------------------------------------
        // E. PULL: Descargar Cambios e Incrementales de Clientes
        // ----------------------------------------------------
        console.log(`[Sync] PULL: Descargando cambios de clientes desde ${lastSynced}...`);
        const pullClientsResponse = await fetch(`${API_URL}/sync/clients/pull`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ lastSyncedAt: lastSynced })
        });

        const pullClientsData = await pullClientsResponse.json();

        if (pullClientsResponse.ok && pullClientsData.success) {
          const { clients } = pullClientsData;
          
          if (clients && clients.length > 0) {
            console.log(`[Sync] PULL: Recibidos ${clients.length} clientes modificados. Upserting...`);
            
            for (const cl of clients) {
              await db.clients.upsert({
                id: cl.id,
                name: cl.name,
                email: cl.email || '',
                phone: cl.phone || '',
                updatedAt: new Date(cl.updatedAt).toISOString()
              });
            }
          }
        } else {
          console.error('[Sync] PULL Clientes falló:', pullClientsData.message);
        }

        // ----------------------------------------------------
        // F. PUSH: Sincronizar Proveedores Modificados Localmente
        // ----------------------------------------------------
        const localModifiedSuppliers = await db.suppliers.find({
          selector: { updatedAt: { $gt: lastSynced } }
        }).exec();

        if (localModifiedSuppliers.length > 0) {
          console.log(`[Sync] PUSH: Enviando ${localModifiedSuppliers.length} proveedores al servidor...`);
          const suppliersData = localModifiedSuppliers.map(doc => doc.toJSON());
          const response = await fetch(`${API_URL}/sync/suppliers/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ suppliers: suppliersData })
          });
          const data = await response.json();
          if (response.ok && data.success) console.log(`[Sync] PUSH: Proveedores sincronizados.`);
          else console.error('[Sync] PUSH Proveedores falló:', data.message);
        }

        // ----------------------------------------------------
        // G. PULL: Descargar Proveedores del Servidor
        // ----------------------------------------------------
        const pullSuppliersResponse = await fetch(`${API_URL}/sync/suppliers/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ lastSyncedAt: lastSynced })
        });
        const pullSuppliersData = await pullSuppliersResponse.json();
        if (pullSuppliersResponse.ok && pullSuppliersData.success) {
          const { suppliers } = pullSuppliersData;
          if (suppliers && suppliers.length > 0) {
            for (const s of suppliers) {
              await db.suppliers.upsert({
                id: s.id,
                companyName: s.name,
                contactName: s.contact || '',
                email: s.email || '',
                phone: s.phone || '',
                address: s.address || '',
                category: s.category || 'General',
                paymentTerms: s.paymentTerms || 'Contado',
                status: s.status || 'Activo',
                rif: s.rif || '',
                updatedAt: new Date(s.updatedAt).toISOString()
              });
            }
          }
        }

        // ----------------------------------------------------
        // H. PUSH: Sincronizar Compras Offline
        // ----------------------------------------------------
        const pendingPurchases = await db.purchases.find({
          selector: { pendingSync: true }
        }).exec();

        if (pendingPurchases.length > 0) {
          console.log(`[Sync] PUSH: Enviando ${pendingPurchases.length} compras offline al servidor...`);
          const purchasesData = pendingPurchases.map(doc => doc.toJSON());
          const response = await fetch(`${API_URL}/sync/purchases/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ purchases: purchasesData })
          });
          const data = await response.json();
          if (response.ok && data.success) {
            const processedIds: string[] = data.processedIds || [];
            for (const id of processedIds) {
              const doc = await db.purchases.findOne({ selector: { id } }).exec();
              if (doc) await doc.patch({ pendingSync: false });
            }
          } else {
            console.error('[Sync] PUSH Compras falló:', data.message);
          }
        }

        // ----------------------------------------------------
        // I. PUSH: Sincronizar Nóminas Offline
        // ----------------------------------------------------
        const pendingPayroll = await db.payroll.find({
          selector: { pendingSync: true }
        }).exec();

        if (pendingPayroll.length > 0) {
          console.log(`[Sync] PUSH: Enviando ${pendingPayroll.length} nóminas offline al servidor...`);
          const payrollData = pendingPayroll.map(doc => doc.toJSON());
          const response = await fetch(`${API_URL}/sync/payroll/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ payroll: payrollData })
          });
          const data = await response.json();
          if (response.ok && data.success) {
            const processedIds: string[] = data.processedIds || [];
            for (const id of processedIds) {
              const doc = await db.payroll.findOne({ selector: { id } }).exec();
              if (doc) await doc.patch({ pendingSync: false });
            }
          } else {
            console.error('[Sync] PUSH Nóminas falló:', data.message);
          }
        }

        // Guarda la nueva fecha de sincronización
        localStorage.setItem('last_synced_at', serverTime);
        this.setState({
          lastSyncedAt: serverTime,
          isSyncing: false,
          error: null
        });
        console.log('✅ Ciclo de sincronización completado y al día.');
      } else {
        throw new Error(pullData.message || 'Error en pull incremental.');
      }

    } catch (err: any) {
      console.error('❌ Error general durante la sincronización:', err.message);
      this.setState({
        isSyncing: false,
        error: err.message || 'Error de conexión'
      });
    } finally {
      await this.updatePendingSalesCount();
    }
  }

  destroy() {
    this.stopInterval();
    if (typeof window !== 'undefined') {
      if (this.boundGoOnline) window.removeEventListener('online', this.boundGoOnline);
      if (this.boundGoOffline) window.removeEventListener('offline', this.boundGoOffline);
    }
    this.listeners.clear();
  }
}

export const syncWorker = new SyncWorker();
