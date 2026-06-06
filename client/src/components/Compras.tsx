import { useState, useEffect, useRef } from 'react';
import { 
  Search,
  Check,
  X,
  ShoppingBag,
  Truck,
  Plus,
  Calendar,
  RefreshCw,
  Edit,
  Info,
  AlertCircle,
  Sparkles,
  Scan,
  Upload,
  FileText,
  Loader
} from 'lucide-react';
import { getDatabase } from '../db/database';
import { syncWorker } from '../db/sync';
import { logAuditEvent } from '../utils/audit';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import CustomSelect from './CustomSelect';
import { createWorker } from 'tesseract.js';

interface ComprasProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  searchTerm?: string;
}

interface PurchaseItem {
  code: string;
  name: string;
  category: string;
  quantity: number;
  costUSD: number;
  loteCode?: string;
  expiryDate?: string;
  priceUSD?: number;
}

interface PurchaseOrder {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  totalUSD: number;
  status: 'Procesado' | 'Pendiente';
}



export default function Compras({ user, searchTerm = '' }: ComprasProps) {
  const { dolarRate, convertToVES, formatVES, formatUSD } = useExchangeRate();
  
  // Mobile detection for full-height modal layout
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual Register Purchase Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [supplierInput, setSupplierInput] = useState('');
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [formItems, setFormItems] = useState<PurchaseItem[]>([
    { code: '', name: '', category: 'Alimentos', quantity: 1, costUSD: 0.0 }
  ]);

  // Edit Purchase Form state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseOrder | null>(null);
  const [editSupplierInput, setEditSupplierInput] = useState('');
  const [editInvoiceNumberInput, setEditInvoiceNumberInput] = useState('');
  const [editFormItems, setEditFormItems] = useState<PurchaseItem[]>([]);

  // Toast
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // OCR scanning state
  const [showScanner, setShowScanner] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // C4: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const loadPurchases = async () => {
    setIsRefreshing(true);
    try {
      await syncWorker.sync();
    } catch (e) {
      console.error('Error durante la sincronización manual:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    let sub: any = null;

    const setupSubscription = async () => {
      try {
        const db = await getDatabase();
        const query = db.purchases.find();
        sub = query.$.subscribe(async (purchaseDocs) => {
          const supplierDocs = await db.suppliers.find().exec();
          const productDocs = await db.products.find().exec();

          const supplierMap = new Map(supplierDocs.map(d => [d.id, d.get('companyName')]));
          const productMap = new Map(productDocs.map(d => [d.id, { 
            name: d.get('name'), 
            code: d.get('code'),
            category: d.get('category') 
          }]));

          const mappedOrders: PurchaseOrder[] = purchaseDocs.map(doc => {
            const docData = doc.toJSON();
            const itemsMapped = (docData.items || []).map((item: any) => {
              const pInfo = productMap.get(item.productId) || { name: 'Producto Desconocido', code: '', category: 'General' };
              return {
                code: pInfo.code,
                name: pInfo.name,
                category: pInfo.category,
                quantity: item.quantity,
                costUSD: item.cost
              };
            });

            return {
              id: docData.id,
              invoiceNumber: docData.invoiceNumber || 'S/N',
              supplierName: supplierMap.get(docData.supplierId) || 'Proveedor Desconocido',
              date: docData.createdAt.split('T')[0],
              items: itemsMapped,
              totalUSD: docData.total,
              status: docData.pendingSync ? 'Pendiente' : 'Procesado'
            };
          });

          mappedOrders.sort((a, b) => b.id.localeCompare(a.id));
          setPurchases(mappedOrders);
        });
      } catch (err) {
        console.error('Error setting up purchases RxDB subscription:', err);
      }
    };

    setupSubscription();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  const activeSearch = searchTerm || localSearchTerm;
  
  const filteredPurchases = purchases.filter(p => 
    p.invoiceNumber.toLowerCase().includes(activeSearch.toLowerCase()) ||
    p.supplierName.toLowerCase().includes(activeSearch.toLowerCase()) ||
    p.items.some(item => item.name.toLowerCase().includes(activeSearch.toLowerCase()))
  );

  // C4: Pagination - reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [activeSearch]);
  const totalPages = Math.ceil(filteredPurchases.length / ITEMS_PER_PAGE);
  const paginatedPurchases = filteredPurchases.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleEditPurchase = (order: PurchaseOrder) => {
    setEditingPurchase(order);
    setEditSupplierInput(order.supplierName);
    setEditInvoiceNumberInput(order.invoiceNumber);
    setEditFormItems([...order.items]);
    setShowEditModal(true);
  };

  const handleSaveEditPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase || !editSupplierInput || !editInvoiceNumberInput || editFormItems.some(i => !i.code || !i.name || i.quantity <= 0)) {
      setAlertConfig({
        title: 'Campos Obligatorios',
        message: 'Por favor complete todos los campos requeridos.',
        type: 'info'
      });
      return;
    }

    try {
      const db = await getDatabase();

      // Find or create supplier
      let supplierId = '';
      const existingSupplier = await db.suppliers.findOne({
        selector: { companyName: editSupplierInput.trim() }
      }).exec();

      if (existingSupplier) {
        supplierId = existingSupplier.get('id');
      } else {
        supplierId = 'sup_' + crypto.randomUUID();
        await db.suppliers.insert({
          id: supplierId,
          rif: 'J-' + Math.floor(Math.random() * 100000000) + '-' + Math.floor(Math.random() * 10),
          companyName: editSupplierInput.trim(),
          contactName: 'N/A',
          email: 'N/A',
          phone: 'N/A',
          address: 'Venezuela',
          category: 'General',
          paymentTerms: 'Contado',
          status: 'Activo',
          updatedAt: new Date().toISOString()
        });
      }

      // Map items
      const mappedItems: any[] = [];
      for (const item of editFormItems) {
        let productId = '';
        const doc = await db.products.findOne({ selector: { code: item.code } }).exec();
        if (doc) {
          productId = doc.get('id');
          await doc.patch({ cost: item.costUSD, updatedAt: new Date().toISOString() });
        } else {
          productId = crypto.randomUUID();
          await db.products.insert({
            id: productId,
            code: item.code,
            name: item.name,
            category: item.category || 'General',
            price: Number((item.costUSD * 1.5).toFixed(2)),
            cost: item.costUSD,
            stock: 0,
            minStock: 5,
            batches: JSON.stringify([]),
            version: 1,
            updatedAt: new Date().toISOString()
          });
        }
        mappedItems.push({
          productId,
          quantity: item.quantity,
          cost: item.costUSD
        });
      }

      const totalUSD = editFormItems.reduce((sum, item) => sum + (item.costUSD * item.quantity), 0);
      
      const doc = await db.purchases.findOne({ selector: { id: editingPurchase.id } }).exec();
      if (doc) {
        await doc.patch({
          supplierId,
          invoiceNumber: editInvoiceNumberInput.trim().toUpperCase(),
          total: Number(totalUSD.toFixed(2)),
          items: mappedItems,
          pendingSync: true,
          updatedAt: new Date().toISOString()
        });
      }

      logAuditEvent(user, 'COMPRA_EDITAR', {
        id: editingPurchase.id
      });

      setShowEditModal(false);
      setEditingPurchase(null);
      setShowSuccessToast('Orden de compra editada exitosamente de forma local.');
      setTimeout(() => setShowSuccessToast(null), 3000);

      syncWorker.sync();
    } catch (err) {
      console.error('Error saving edited purchase:', err);
      setAlertConfig({
        title: 'Error de Edición',
        message: 'No se pudo guardar la orden de compra editada en la base de datos.',
        type: 'error'
      });
    }
  };

  // MANUAL REGISTRATION OF INVENTORY PURCHASES
  const handleAddManualPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierInput || !invoiceNumberInput || formItems.some(i => !i.code || !i.name || i.quantity <= 0)) {
      setAlertConfig({
        title: 'Campos Obligatorios',
        message: 'Por favor complete todos los campos requeridos y verifique que las cantidades de ítems sean mayor a 0.',
        type: 'info'
      });
      return;
    }

    try {
      const db = await getDatabase();

      // Find or create supplier
      let supplierId = '';
      const existingSupplier = await db.suppliers.findOne({
        selector: { companyName: supplierInput.trim() }
      }).exec();

      if (existingSupplier) {
        supplierId = existingSupplier.get('id');
      } else {
        supplierId = 'sup_' + crypto.randomUUID();
        await db.suppliers.insert({
          id: supplierId,
          rif: 'J-' + Math.floor(Math.random() * 100000000) + '-' + Math.floor(Math.random() * 10),
          companyName: supplierInput.trim(),
          contactName: 'N/A',
          email: 'N/A',
          phone: 'N/A',
          address: 'Venezuela',
          category: 'General',
          paymentTerms: 'Contado',
          status: 'Activo',
          updatedAt: new Date().toISOString()
        });
      }

      const mappedItems: any[] = [];

      // Adjust stock and costs for manual items
      for (const item of formItems) {
        let productId = '';
        const doc = await db.products.findOne({ selector: { code: item.code } }).exec();
        
        const targetLote = (item.loteCode || 'LOTE-COMPRA').trim().toUpperCase();
        const targetExpiry = item.expiryDate || 'N/A';

        if (doc) {
          productId = doc.get('id');
          const currentVersion = doc.get('version') || 1;
          
          let batches: any[] = [];
          try {
            if (doc.get('batches')) {
              batches = JSON.parse(doc.get('batches'));
            }
          } catch {}

          const matchIdx = batches.findIndex(b => b.loteCode === targetLote);
          if (matchIdx >= 0) {
            batches[matchIdx].stock += item.quantity;
            if (targetExpiry && targetExpiry !== 'N/A') {
              batches[matchIdx].expiryDate = targetExpiry;
            }
          } else {
            batches.push({
              loteCode: targetLote,
              expiryDate: targetExpiry,
              stock: item.quantity
            });
          }

          const newStock = batches.reduce((acc, b) => acc + (b.stock || 0), 0);

          await doc.patch({
            stock: Number(newStock.toFixed(3)),
            cost: item.costUSD,
            price: item.priceUSD && item.priceUSD > 0 ? item.priceUSD : doc.get('price'),
            batches: JSON.stringify(batches),
            version: currentVersion + 1,
            updatedAt: new Date().toISOString()
          });
        } else {
          productId = crypto.randomUUID();
          const initialBatch = {
            loteCode: targetLote,
            expiryDate: targetExpiry,
            stock: item.quantity
          };
          // Insert product if not present
          await db.products.insert({
            id: productId,
            code: item.code,
            name: item.name,
            category: item.category,
            price: item.priceUSD && item.priceUSD > 0 ? item.priceUSD : Number((item.costUSD * 1.5).toFixed(2)),
            cost: item.costUSD,
            stock: item.quantity,
            minStock: 5,
            batches: JSON.stringify([initialBatch]),
            version: 1,
            updatedAt: new Date().toISOString()
          });
        }

        mappedItems.push({
          productId,
          quantity: item.quantity,
          cost: item.costUSD,
          loteCode: targetLote,
          expiryDate: targetExpiry
        });
      }

      // Add Purchase entry to RxDB
      const totalUSD = formItems.reduce((sum, item) => sum + (item.costUSD * item.quantity), 0);
      const purchaseId = 'ord_' + Date.now();
      await db.purchases.insert({
        id: purchaseId,
        supplierId,
        invoiceNumber: invoiceNumberInput.trim().toUpperCase(),
        total: Number(totalUSD.toFixed(2)),
        items: mappedItems,
        pendingSync: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      logAuditEvent(user, 'COMPRA_REGISTRAR_MANUAL', {
        invoiceNumber: invoiceNumberInput.trim().toUpperCase(),
        total: totalUSD
      });

      setShowAddModal(false);
      setSupplierInput('');
      setInvoiceNumberInput('');
      setFormItems([{ code: '', name: '', category: 'Alimentos', quantity: 1, costUSD: 0.0 }]);

      setShowSuccessToast(`Compra ${invoiceNumberInput.trim().toUpperCase()} registrada y cargada al inventario.`);
      setTimeout(() => setShowSuccessToast(null), 3500);

      // Re-trigger sync
      syncWorker.sync();

    } catch (err) {
      console.error(err);
      setAlertConfig({
        title: 'Error al Registrar',
        message: 'Ocurrió un error al registrar la compra en el libro contable local.',
        type: 'error'
      });
    }
  };

  const handleAutoSuggestReposition = async () => {
    setIsRefreshing(true);
    try {
      const db = await getDatabase();
      const allProds = await db.products.find().exec();
      const lowStockProds = allProds
        .map(p => p.toJSON())
        .filter(p => p.stock <= (p.minStock || 5));

      if (lowStockProds.length === 0) {
        setAlertConfig({
          title: 'Inventario al Día',
          message: 'Todos los productos tienen existencias por encima de su stock mínimo de alerta. No se requiere reabastecimiento.',
          type: 'success'
        });
        return;
      }

      // Mapear productos con bajo stock a ítems de compra sugeridos
      const suggestedItems = lowStockProds.map(p => {
        const minVal = p.minStock || 5;
        const suggestedQty = Math.max(1, (minVal * 2) - p.stock);
        return {
          code: p.code,
          name: p.name,
          category: p.category || 'General',
          quantity: suggestedQty,
          costUSD: p.cost || 0.0,
          priceUSD: p.price || 0.0,
          loteCode: 'LOTE-COMPRA',
          expiryDate: ''
        };
      });

      setFormItems(suggestedItems);
      setSupplierInput('Proveedor General');
      setInvoiceNumberInput(`SUG-${Date.now().toString().slice(-4)}`);
      setShowAddModal(true);

      setShowSuccessToast(`Se precargaron sugerencias para ${suggestedItems.length} productos con stock crítico.`);
      setTimeout(() => setShowSuccessToast(null), 4000);
    } catch (e) {
      console.error(e);
      setAlertConfig({
        title: 'Error de Sugerencia',
        message: 'Ocurrió un error al analizar las existencias para reposición automática.',
        type: 'error'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddFormItem = () => {
    setFormItems([...formItems, { code: '', name: '', category: 'Alimentos', quantity: 1, costUSD: 0.0, priceUSD: 0.0, loteCode: 'LOTE-COMPRA', expiryDate: '' }]);
  };

  const handleRemoveFormItem = (idx: number) => {
    if (formItems.length > 1) {
      setFormItems(formItems.filter((_, i) => i !== idx));
    }
  };

  const handleUpdateFormItem = (idx: number, field: keyof PurchaseItem, val: any) => {
    const updated = [...formItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setFormItems(updated);
  };

  return (
    <div className="view-container-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: CABECERA Y CONTROLES */}
      <div className="widget view-header-widget" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="info-tooltip-wrapper">
              <Info size={18} className="info-tooltip-icon" style={{ color: 'var(--text-secondary)', cursor: 'help', opacity: 0.8 }} />
              <span className="tooltip-text">
                Registro de abastecimiento de stock y control de costos del catálogo.
              </span>
            </div>
            <span className="view-header-pill pill-teal">
              {purchases.length} Compras
            </span>
            <span className="view-header-pill pill-green">
              Total: ${purchases.reduce((acc, p) => acc + p.totalUSD, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            
            {!searchTerm && (
              <div className="search-container" style={{ width: '260px', height: '40px' }}>
                <Search className="search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar por factura, proveedor..." 
                  className="search-input" 
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                />
              </div>
            )}

            <button 
              onClick={handleAutoSuggestReposition}
              disabled={isRefreshing}
              className="btn-pill-dark"
              style={{ gap: '8px', padding: '10px 18px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', cursor: isRefreshing ? 'not-allowed' : 'pointer' }}
              title="Analizar stock mínimo y pre-cargar faltantes"
            >
              <Sparkles size={14} style={{ color: 'var(--brand-primary)' }} />
              <span>Sugerencias de Compra</span>
            </button>

            <button 
              onClick={() => setShowAddModal(true)}
              className="btn-yellow"
              style={{ gap: '8px', padding: '10px 18px', borderRadius: 'var(--button-radius)' }}
            >
              <Plus size={16} />
              <span>Registrar Compra</span>
            </button>

            <button 
              onClick={() => { setOcrImage(null); setOcrProgress(0); setShowScanner(true); }}
              className="btn-pill-dark"
              style={{ gap: '8px', padding: '10px 18px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              title="Escanear Factura con OCR"
            >
              <Scan size={14} style={{ color: 'var(--brand-primary)' }} />
              <span>Escanear Factura</span>
            </button>

            <button 
              onClick={loadPurchases}
              disabled={isRefreshing}
              className="btn-pill-dark"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', cursor: isRefreshing ? 'not-allowed' : 'pointer' }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            </button>
          </div>

        </div>
      </div>

      {/* TOAST SUCCESS */}
      {showSuccessToast && (
        <div className="animate-entrance" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: 'rgba(34, 197, 94, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1.5px solid rgba(255,255,255,0.15)',
          borderRadius: '16px',
          padding: '12px 20px',
          color: '#fff',
          fontWeight: 700,
          fontSize: '13px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 2000
        }}>
          <Check size={16} />
          <span>{showSuccessToast}</span>
        </div>
      )}

      {/* SECCIÓN 2: BITÁCORA HISTÓRICA DE COMPRAS */}
      <div className="widget view-content-widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
        <div className="details-table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>FECHA COMPRA</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>FACTURA PROVEEDOR</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>PROVEEDOR ORIGEN</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>ARTÍCULOS INGRESADOS</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>TOTAL USD</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>TOTAL BCV VES</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ESTADO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    No se encontraron registros de reabastecimiento en el libro.
                  </td>
                </tr>
              ) : (
                paginatedPurchases.map((purchase) => {
                  return (
                    <tr key={purchase.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{purchase.date}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                        {purchase.invoiceNumber}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Truck size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{purchase.supplierName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                        {purchase.items.map(i => `${i.quantity}x ${i.name.substring(0,14)}...`).join(', ')}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatUSD(purchase.totalUSD)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-gold)' }}>
                        {formatVES(purchase.totalUSD)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span className="status-badge delivered" style={{ fontSize: '10px' }}>
                          {purchase.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleEditPurchase(purchase)}
                          className="btn-pill-dark"
                          style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                          title="Editar Datos de la Orden"
                        >
                          <Edit size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* C4: Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 0 4px 0',
            borderTop: '1px solid var(--border-color)',
            marginTop: '12px'
          }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-pill-dark"
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-main)' }}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-pill-dark"
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* MODAL 1: REGISTRO MANUAL DE COMPRA */}
      {showAddModal && (
        <div className="modal-registration-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: isMobile ? 'flex-start' : 'center',
          alignItems: isMobile ? 'stretch' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          zIndex: 1500,
          padding: isMobile ? 0 : '20px'
        }}>
          
          <div className={`widget ${!isMobile ? 'animate-entrance' : ''} modal-registration-content`} style={{
            width: '100%',
            maxWidth: isMobile ? '100%' : '680px',
            padding: 0,
            backgroundColor: 'var(--bg-card)',
            borderRadius: isMobile ? 0 : 'var(--card-radius)',
            border: isMobile ? 'none' : '1.5px solid var(--border-color)',
            boxShadow: isMobile ? 'none' : '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: isMobile ? '100dvh' : 'auto',
            maxHeight: isMobile ? '100dvh' : '90vh'
          }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Registrar Compra Manual de Reposición
                </h4>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddManualPurchase} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', flex: 1 }}>
                
                {/* Supplier & Invoice input row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Proveedor Comercial *
                    </label>
                    <input 
                      type="text" 
                      value={supplierInput}
                      onChange={(e) => setSupplierInput(e.target.value)}
                      placeholder="Ej: Cervecería Polar C.A."
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Factura Nro. *
                    </label>
                    <input 
                      type="text" 
                      value={invoiceNumberInput}
                      onChange={(e) => setInvoiceNumberInput(e.target.value)}
                      placeholder="Ej: FAC-9842"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', fontFamily: 'monospace' }}
                      required
                    />
                  </div>
                </div>

                {/* Items Row */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>ÍTEMS DE LA COMPRA</span>
                    <button 
                      type="button" 
                      onClick={handleAddFormItem}
                      className="btn-pill-dark"
                      style={{ padding: '4px 10px', fontSize: '10.5px', borderRadius: '6px', color: 'var(--brand-primary)', borderColor: 'var(--border-color)', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                      <Plus size={11} /> Añadir Ítem
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {formItems.map((item, idx) => {
                      const costVES = convertToVES(item.costUSD);
                      return (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--bg-primary)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input 
                              type="text" 
                              placeholder="Cód: 1007"
                              value={item.code}
                              onChange={(e) => handleUpdateFormItem(idx, 'code', e.target.value)}
                              style={{ width: '80px', padding: '6px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              required
                            />
                            <input 
                              type="text" 
                              placeholder="Nombre..."
                              value={item.name}
                              onChange={(e) => handleUpdateFormItem(idx, 'name', e.target.value)}
                              style={{ flex: 1, padding: '6px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              required
                            />
                            <CustomSelect 
                              value={item.category}
                              onChange={(val) => handleUpdateFormItem(idx, 'category', val)}
                              options={[
                                { value: 'Alimentos', label: 'Alimentos' },
                                { value: 'Bebidas', label: 'Bebidas' },
                                { value: 'Lácteos', label: 'Lácteos' },
                                { value: 'General', label: 'General' }
                              ]}
                              style={{ width: '120px' }}
                            />
                            <input 
                              type="number" 
                              placeholder="Cant"
                              value={item.quantity}
                              onChange={(e) => handleUpdateFormItem(idx, 'quantity', Number(e.target.value))}
                              style={{ width: '55px', padding: '6px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', textAlign: 'center' }}
                              required
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>$</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="0.00"
                                  value={item.costUSD || ''}
                                  onChange={(e) => handleUpdateFormItem(idx, 'costUSD', Number(e.target.value))}
                                  style={{ width: '65px', padding: '6px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                                  required
                                />
                              </div>
                              <span style={{ fontSize: '8.5px', color: 'var(--brand-gold)', alignSelf: 'flex-end', fontFamily: 'monospace' }}>
                                Bs. {costVES.toFixed(1)}
                              </span>
                            </div>

                            <button 
                              type="button" 
                              onClick={() => handleRemoveFormItem(idx)}
                              disabled={formItems.length === 1}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', opacity: formItems.length === 1 ? 0.4 : 1 }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', paddingLeft: '4px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>LOTE:</span>
                              <input 
                                type="text" 
                                placeholder="Ej: LOTE-A"
                                value={item.loteCode || ''}
                                onChange={(e) => handleUpdateFormItem(idx, 'loteCode', e.target.value.toUpperCase())}
                                style={{ width: '100px', padding: '4px 8px', fontSize: '10.5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>VENCE:</span>
                              <input 
                                type="date" 
                                value={item.expiryDate || ''}
                                onChange={(e) => handleUpdateFormItem(idx, 'expiryDate', e.target.value)}
                                style={{ width: '115px', padding: '4px 8px', fontSize: '10.5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>COSTO VES:</span>
                              <input 
                                type="number" 
                                step="any"
                                placeholder="Bs. 0.00"
                                value={item.costUSD ? Number((item.costUSD * dolarRate).toFixed(2)) : ''}
                                onChange={(e) => {
                                  const valVES = parseFloat(e.target.value) || 0;
                                  const valUSD = Number((valVES / dolarRate).toFixed(4));
                                  handleUpdateFormItem(idx, 'costUSD', valUSD);
                                }}
                                style={{ width: '85px', padding: '4px 8px', fontSize: '10.5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>P. VENTA USD:</span>
                              <input 
                                type="number" 
                                step="any"
                                placeholder="$ 0.00"
                                value={item.priceUSD || ''}
                                onChange={(e) => {
                                  const valUSD = parseFloat(e.target.value) || 0;
                                  handleUpdateFormItem(idx, 'priceUSD', valUSD);
                                }}
                                style={{ width: '80px', padding: '4px 8px', fontSize: '10.5px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 'bold' }}
                                required
                              />
                              <span style={{ fontSize: '9px', color: 'var(--brand-gold)', fontFamily: 'monospace', fontWeight: 700 }}>
                                Bs. {((item.priceUSD || 0) * dolarRate).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total row */}
                <div style={{ alignSelf: 'flex-end', textAlign: 'right', padding: '12px 18px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', gap: '16px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>TOTAL COMPRA (USD)</span>
                    <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
                      {formatUSD(formItems.reduce((sum, item) => sum + (item.costUSD * item.quantity), 0))}
                    </strong>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '10px' }}>TOTAL ESTIMADO (VES BCV)</span>
                    <strong style={{ fontSize: '16px', color: 'var(--brand-gold)' }}>
                      {formatVES(formItems.reduce((sum, item) => sum + (item.costUSD * item.quantity), 0))}
                    </strong>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1.5px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                backgroundColor: 'var(--bg-input)',
                ...(isMobile ? { position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 10 } : {})
              }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-pill-dark"
                  style={{ padding: '8px 16px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-yellow"
                  style={{ padding: '8px 20px', borderRadius: 'var(--button-radius)' }}
                >
                  Registrar Compra
                </button>
              </div>
            </form>

          </div>

        </div>
      )}

      {/* MODAL 1B: EDITAR ORDEN DE COMPRA (GLASSMORPHISM) */}
      {showEditModal && editingPurchase && (
        <div className="modal-registration-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: isMobile ? 'flex-start' : 'center',
          alignItems: isMobile ? 'stretch' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          zIndex: 1500,
          padding: isMobile ? 0 : '20px'
        }}>
          
          <div className={`widget ${!isMobile ? 'animate-entrance' : ''} modal-registration-content`} style={{
            width: '100%',
            maxWidth: isMobile ? '100%' : '680px',
            padding: 0,
            backgroundColor: 'var(--bg-card)',
            borderRadius: isMobile ? 0 : 'var(--card-radius)',
            border: isMobile ? 'none' : '1.5px solid var(--border-color)',
            boxShadow: isMobile ? 'none' : '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: isMobile ? '100dvh' : 'auto',
            maxHeight: isMobile ? '100dvh' : '90vh'
          }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Editar Orden de Compra
                </h4>
              </div>
              <button onClick={() => { setShowEditModal(false); setEditingPurchase(null); }} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditPurchase} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', fontSize: '13px' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>Proveedor *</label>
                    <input 
                      type="text" 
                      value={editSupplierInput} 
                      onChange={(e) => setEditSupplierInput(e.target.value)} 
                      className="search-input" 
                      placeholder="Nombre del distribuidor" 
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>Número de Factura *</label>
                    <input 
                      type="text" 
                      value={editInvoiceNumberInput} 
                      onChange={(e) => setEditInvoiceNumberInput(e.target.value)} 
                      className="search-input" 
                      placeholder="FAC-XXXXX" 
                      required
                    />
                  </div>
                </div>

                <div style={{ borderBottom: '1.5px solid var(--border-color)', margin: '8px 0' }}></div>

                {/* Items Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                    Productos de la Compra
                  </label>

                  {editFormItems.map((item, index) => (
                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 80px 100px', gap: '8px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        value={item.code} 
                        onChange={(e) => {
                          const updated = [...editFormItems];
                          updated[index].code = e.target.value;
                          setEditFormItems(updated);
                        }}
                        className="search-input" 
                        placeholder="Código" 
                        required
                        disabled
                        style={{ fontFamily: 'monospace', backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' }}
                      />
                      <input 
                        type="text" 
                        value={item.name} 
                        onChange={(e) => {
                          const updated = [...editFormItems];
                          updated[index].name = e.target.value;
                          setEditFormItems(updated);
                        }}
                        className="search-input" 
                        placeholder="Nombre del Producto" 
                        required
                      />
                      <CustomSelect 
                        value={item.category} 
                        onChange={(val) => {
                          const updated = [...editFormItems];
                          updated[index].category = val;
                          setEditFormItems(updated);
                        }}
                        options={[
                          { value: 'Alimentos', label: 'Alimentos' },
                          { value: 'Bebidas', label: 'Bebidas' },
                          { value: 'Lácteos', label: 'Lácteos' },
                          { value: 'Confitería', label: 'Confitería' },
                          { value: 'Limpieza', label: 'Limpieza' }
                        ]}
                        style={{ width: '130px' }}
                      />
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => {
                          const updated = [...editFormItems];
                          updated[index].quantity = parseInt(e.target.value) || 0;
                          setEditFormItems(updated);
                        }}
                        className="search-input" 
                        placeholder="Cant" 
                        min="1"
                        required
                      />
                      <input 
                        type="number" 
                        step="0.01"
                        value={item.costUSD} 
                        onChange={(e) => {
                          const updated = [...editFormItems];
                          updated[index].costUSD = parseFloat(e.target.value) || 0.0;
                          setEditFormItems(updated);
                        }}
                        className="search-input" 
                        placeholder="Costo $" 
                        required
                      />
                    </div>
                  ))}
                </div>

              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1.5px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                backgroundColor: 'var(--bg-input)',
                ...(isMobile ? { position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 10 } : {})
              }}>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingPurchase(null); }}
                  className="btn-pill-dark"
                  style={{ padding: '8px 16px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-yellow"
                  style={{ padding: '8px 20px', borderRadius: 'var(--button-radius)' }}
                >
                  Guardar Cambios
                </button>
              </div>
            </form>

          </div>

        </div>
      )}

      {/* MODAL 3: ESCÁNER OCR DE FACTURA */}
      {showScanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1600, padding: '20px'
        }}>
          <div className="widget animate-entrance" style={{
            width: '100%', maxWidth: '540px',
            backgroundColor: 'var(--bg-card)', borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scan size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Escáner de Factura (OCR)
                </h4>
              </div>
              <button onClick={() => { setShowScanner(false); setOcrImage(null); }} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    setOcrImage(dataUrl);
                  };
                  reader.readAsDataURL(file);
                }}
              />

              {!ocrImage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '100%' }}>
                  <div style={{
                    width: '100%', minHeight: '200px', border: '2px dashed var(--border-color)', borderRadius: '16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
                    padding: '32px', cursor: 'pointer', backgroundColor: 'var(--bg-primary)'
                  }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={40} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px' }}>
                      Haz clic para seleccionar una imagen de factura
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                      o usa la cámara de tu dispositivo
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
                  <img src={ocrImage} alt="Factura" style={{ maxHeight: '280px', width: '100%', objectFit: 'contain', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                  
                  {isScanning ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
                      <Loader size={24} className="spin" style={{ color: 'var(--brand-primary)' }} />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Procesando OCR... {ocrProgress}%</span>
                      <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${ocrProgress}%`, height: '100%', backgroundColor: 'var(--brand-primary)', borderRadius: '3px', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => { setOcrImage(null); }}
                        className="btn-pill-dark"
                        style={{ padding: '8px 16px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)' }}
                      >
                        Cambiar Imagen
                      </button>
                      <button
                        onClick={async () => {
                          if (!ocrImage) return;
                          setIsScanning(true);
                          setOcrProgress(0);
                          try {
                            const worker: any = await createWorker('spa');
                            worker.setLogger((m: any) => {
                              if (m.status === 'recognizing text') {
                                setOcrProgress(Math.round(m.progress * 100));
                              }
                            });
                            const { data } = await worker.recognize(ocrImage);
                            await worker.terminate();
                            setOcrProgress(100);

                            // Parse OCR text into form fields
                            const text = data.text;
                            const lines = text.split('\n').filter((l: string) => l.trim());

                            // Extract supplier name (look for RIF or Razón Social)
                            let supplier = '';
                            const supplierRegex = /(?:proveedor|empresa|raz[oó]n social|comercializadora|distribuidora)\s*:?\s*(.+)/i;
                            for (const line of lines) {
                              const m = line.match(supplierRegex);
                              if (m) { supplier = m[1].trim(); break; }
                            }
                            if (!supplier) {
                              // Try to find first line with company-like name
                              for (const line of lines.slice(0, 5)) {
                                if (line.length > 5 && !line.match(/^\d/) && !line.match(/rif|factura|fecha|telf/i)) {
                                  supplier = line.trim(); break;
                                }
                              }
                            }

                            // Extract invoice number
                            let invoice = '';
                            const invoiceRegex = /(?:factura|nro|no\.|n°|comprobante|documento)\s*(?:n[°º]?|nro\.?|n\.?|de)?\s*:?\s*([\w\-\.\/]+)/i;
                            for (const line of lines) {
                              const m = line.match(invoiceRegex);
                              if (m) { invoice = m[1].trim(); break; }
                            }
                            if (!invoice) {
                              const fallbackInvoice = text.match(/(?:FAC|FC|FV|FE|NC|ND)[\-\s]*\d+/i);
                              if (fallbackInvoice) invoice = fallbackInvoice[0].trim();
                            }

                            // Extract items (lines with quantity + price patterns)
                            const parsedItems: Array<{ code: string; name: string; category: string; quantity: number; costUSD: number }> = [];
                            const itemRegex = /(\d+)\s*[xX*]\s*([\w\sáéíóúüñÁÉÍÓÚÜÑ\-\.]+?)\s*(\d+[.,]\d{2})/;
                            for (const line of lines) {
                              const m = line.match(itemRegex);
                              if (m) {
                                const qty = parseInt(m[1]);
                                const name = m[2].trim().substring(0, 40);
                                const price = parseFloat(m[3].replace(',', '.'));
                                if (qty > 0 && qty < 10000 && price > 0) {
                                  parsedItems.push({ code: '', name, category: 'General', quantity: qty, costUSD: price });
                                }
                              }
                            }

                            // Fallback: try to find lines with quantity at start and price at end
                            if (parsedItems.length === 0) {
                              const altItemRegex = /^(\d+)\s+(.+?)\s+(\d+[.,]\d{2})\s*$/;
                              for (const line of lines) {
                                const m = line.match(altItemRegex);
                                if (m) {
                                  const qty = parseInt(m[1]);
                                  const name = m[2].trim().substring(0, 40);
                                  const price = parseFloat(m[3].replace(',', '.'));
                                  if (qty > 0 && qty < 10000 && price > 0) {
                                    parsedItems.push({ code: '', name, category: 'General', quantity: qty, costUSD: price });
                                  }
                                }
                              }
                            }

                            // Populate form with scanned data
                            if (supplier) {
                              setSupplierInput(supplier);
                              setInvoiceNumberInput(invoice || `OCR-${Date.now().toString().slice(-6)}`);
                            }
                            if (parsedItems.length > 0) {
                              setFormItems(parsedItems);
                            } else {
                              // At least put first line as a single item
                              const firstLine = lines.find((l: string) => l.length > 10 && !l.match(/^[\d\s\-:.,]+$/));
                              if (firstLine) {
                                const name = firstLine.trim().substring(0, 100).replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ\-\.]/g, '');
                                setFormItems([{ code: '', name: name || 'Producto OCR', category: 'General', quantity: 1, costUSD: 0.0 }]);
                              }
                            }

                            setShowScanner(false);
                            setShowAddModal(true);
                            setShowSuccessToast('Factura escaneada con OCR. Verifica los datos antes de guardar.');
                            setTimeout(() => setShowSuccessToast(null), 4000);
                          } catch (err) {
                            console.error('OCR error:', err);
                            setAlertConfig({ title: 'Error de OCR', message: 'No se pudo procesar la imagen. Verifica que sea una factura clara.', type: 'error' });
                          } finally {
                            setIsScanning(false);
                          }
                        }}
                        className="btn-yellow"
                        style={{ padding: '8px 20px', borderRadius: 'var(--button-radius)' }}
                      >
                        <FileText size={14} /> Procesar Factura
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ALERTA / ACCION COMÚN DE MENSAJE */}
      {alertConfig && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1600,
          padding: '20px'
        }}>
          
          <div className="widget animate-entrance" style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: alertConfig.type === 'error' ? '1.5px solid rgba(239, 68, 68, 0.2)' : '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              <div style={{ 
                backgroundColor: alertConfig.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : alertConfig.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(251, 191, 36, 0.1)', 
                padding: '14px', 
                borderRadius: '50%', 
                color: alertConfig.type === 'error' ? '#ef4444' : alertConfig.type === 'success' ? '#22c55e' : 'var(--brand-primary)' 
              }}>
                <AlertCircle size={32} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                  {alertConfig.title}
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  {alertConfig.message}
                </p>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => setAlertConfig(null)}
                className="btn-yellow"
                style={{ width: '100%', padding: '10px 0', borderRadius: 'var(--button-radius)', justifyContent: 'center' }}
              >
                Entendido
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
