import { useState, useEffect } from 'react';
import { 
  Search, 
  FileText, 
  Check, 
  ArrowRight, 
  X, 
  ShoppingBag, 
  Truck, 
  Plus, 
  Calendar,
  AlertCircle,
  RefreshCw,
  Edit
} from 'lucide-react';
import { getDatabase } from '../db/database';
import { syncWorker } from '../db/sync';
import { useExchangeRate } from '../contexts/ExchangeRateContext';

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

const PURCHASES_STORAGE_KEY = 'stockmaster_purchases_local';

const MOCK_INVOICES = [
  {
    id: 'inv_01',
    supplierName: 'Cervecería Polar C.A.',
    invoiceNumber: 'FAC-99128',
    date: '2026-06-01',
    items: [
      { code: '1001', name: 'Café Espresso Premium 1kg', category: 'Bebidas', quantity: 20, costUSD: 8.0 },
      { code: '1002', name: 'Té Matcha Japonés 100g', category: 'Bebidas', quantity: 15, costUSD: 5.5 }
    ]
  },
  {
    id: 'inv_02',
    supplierName: 'Alimentos Heinz de Venezuela C.A.',
    invoiceNumber: 'FAC-22831',
    date: '2026-06-02',
    items: [
      { code: '1003', name: 'Croissant de Mantequilla', category: 'Alimentos', quantity: 50, costUSD: 0.8 },
      { code: '1004', name: 'Tarta de Chocolate Gourmet', category: 'Alimentos', quantity: 10, costUSD: 12.0 }
    ]
  },
  {
    id: 'inv_03',
    supplierName: 'Lácteos Los Andes C.A.',
    invoiceNumber: 'FAC-77401',
    date: '2026-06-02',
    items: [
      { code: '1005', name: 'Leche Entera Premium 1L', category: 'Lácteos', quantity: 60, costUSD: 0.7 },
      { code: '1006', name: 'Queso Gouda Artesanal 500g', category: 'Lácteos', quantity: 25, costUSD: 4.0 }
    ]
  }
];

export default function Compras({ searchTerm = '' }: ComprasProps) {
  const { convertToVES, formatVES, formatUSD } = useExchangeRate();
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // OCR state
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<typeof MOCK_INVOICES[0] | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<typeof MOCK_INVOICES[0] | null>(null);

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

  // C4: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const loadPurchases = () => {
    setIsRefreshing(true);
    try {
      const saved = localStorage.getItem(PURCHASES_STORAGE_KEY);
      if (saved) {
        setPurchases(JSON.parse(saved));
      } else {
        // Seed default purchase logs
        const initial: PurchaseOrder[] = [
          {
            id: 'ord_01',
            invoiceNumber: 'FAC-98441',
            supplierName: 'Cervecería Polar C.A.',
            date: '2026-05-28',
            items: [
              { code: '1001', name: 'Café Espresso Premium 1kg', category: 'Bebidas', quantity: 10, costUSD: 8.0 }
            ],
            totalUSD: 80.0,
            status: 'Procesado'
          }
        ];
        setPurchases(initial);
        localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(initial));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    loadPurchases();
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

  // OCR SCAN TRIGGER
  const handleStartOCR = (invoice: typeof MOCK_INVOICES[0]) => {
    setIsScanning(true);
    setOcrResult(null);

    setTimeout(() => {
      setIsScanning(false);
      setOcrResult(invoice);
    }, 1500);
  };

  // MAPPING & INGESTING OCR INVOICE ITEMS INTO LOCAL PRODUCT INDEXEDDB
  const handleImportOCR = async () => {
    if (!ocrResult) return;

    try {
      const db = await getDatabase();

      // Write items into local RxDB products cache
      for (const item of ocrResult.items) {
        const doc = await db.products.findOne({ selector: { code: item.code } }).exec();
        if (doc) {
          // If product exists, increase stock and update to latest purchasing cost
          const currentStock = doc.get('stock');
          const currentVersion = doc.get('version') || 1;
          await doc.patch({
            stock: currentStock + item.quantity,
            cost: item.costUSD, 
            version: currentVersion + 1,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Create product if missing
          await db.products.insert({
            id: crypto.randomUUID(),
            code: item.code,
            name: item.name,
            category: item.category,
            price: Number((item.costUSD * 1.5).toFixed(2)), // 50% margin markup
            cost: item.costUSD,
            stock: item.quantity,
            minStock: 5,
            version: 1,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Record Purchase Ledger entry
      const totalUSD = ocrResult.items.reduce((sum, item) => sum + (item.costUSD * item.quantity), 0);
      const newPurchase: PurchaseOrder = {
        id: 'ord_' + Date.now(),
        invoiceNumber: ocrResult.invoiceNumber,
        supplierName: ocrResult.supplierName,
        date: ocrResult.date,
        items: ocrResult.items,
        totalUSD: Number(totalUSD.toFixed(2)),
        status: 'Procesado'
      };

      const updatedLedger = [newPurchase, ...purchases];
      setPurchases(updatedLedger);
      localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(updatedLedger));

      setShowOCRModal(false);
      setSelectedInvoice(null);
      setOcrResult(null);

      // Trigger success Toast
      setShowSuccessToast(`Factura ${newPurchase.invoiceNumber} aprobada y abastecida en inventario local.`);
      setTimeout(() => setShowSuccessToast(null), 3500);

      // Re-trigger background sync
      syncWorker.sync();

    } catch (err) {
      console.error('Error importing OCR invoice items:', err);
      setAlertConfig({
        title: 'Error de Ingesta OCR',
        message: 'Ocurrió un problema de base de datos durante la ingesta de productos de la factura.',
        type: 'error'
      });
    }
  };

  const handleEditPurchase = (order: PurchaseOrder) => {
    setEditingPurchase(order);
    setEditSupplierInput(order.supplierName);
    setEditInvoiceNumberInput(order.invoiceNumber);
    setEditFormItems([...order.items]);
    setShowEditModal(true);
  };

  const handleSaveEditPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase || !editSupplierInput || !editInvoiceNumberInput || editFormItems.some(i => !i.code || !i.name || i.quantity <= 0)) {
      setAlertConfig({
        title: 'Campos Obligatorios',
        message: 'Por favor complete todos los campos requeridos.',
        type: 'info'
      });
      return;
    }

    const totalUSD = editFormItems.reduce((sum, item) => sum + (item.costUSD * item.quantity), 0);
    const updated = purchases.map(p => {
      if (p.id === editingPurchase.id) {
        return {
          ...p,
          supplierName: editSupplierInput.trim(),
          invoiceNumber: editInvoiceNumberInput.trim().toUpperCase(),
          items: editFormItems,
          totalUSD: Number(totalUSD.toFixed(2))
        };
      }
      return p;
    });

    setPurchases(updated);
    localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(updated));
    setShowEditModal(false);
    setEditingPurchase(null);
    setShowSuccessToast('Orden de compra editada exitosamente de forma local.');
    setTimeout(() => setShowSuccessToast(null), 3000);
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

      // Adjust stock and costs for manual items
      for (const item of formItems) {
        const doc = await db.products.findOne({ selector: { code: item.code } }).exec();
        if (doc) {
          const currentStock = doc.get('stock');
          const currentVersion = doc.get('version') || 1;
          await doc.patch({
            stock: currentStock + item.quantity,
            cost: item.costUSD,
            version: currentVersion + 1,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Insert product if not present
          await db.products.insert({
            id: crypto.randomUUID(),
            code: item.code,
            name: item.name,
            category: item.category,
            price: Number((item.costUSD * 1.5).toFixed(2)),
            cost: item.costUSD,
            stock: item.quantity,
            minStock: 5,
            version: 1,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Add Purchase entry to ledger
      const totalUSD = formItems.reduce((sum, item) => sum + (item.costUSD * item.quantity), 0);
      const newPurchase: PurchaseOrder = {
        id: 'ord_' + Date.now(),
        invoiceNumber: invoiceNumberInput.trim().toUpperCase(),
        supplierName: supplierInput.trim(),
        date: new Date().toISOString().split('T')[0],
        items: formItems,
        totalUSD: Number(totalUSD.toFixed(2)),
        status: 'Procesado'
      };

      const updatedLedger = [newPurchase, ...purchases];
      setPurchases(updatedLedger);
      localStorage.setItem(PURCHASES_STORAGE_KEY, JSON.stringify(updatedLedger));

      setShowAddModal(false);
      setSupplierInput('');
      setInvoiceNumberInput('');
      setFormItems([{ code: '', name: '', category: 'Alimentos', quantity: 1, costUSD: 0.0 }]);

      setShowSuccessToast(`Compra ${newPurchase.invoiceNumber} registrada y cargada al inventario.`);
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

  const handleAddFormItem = () => {
    setFormItems([...formItems, { code: '', name: '', category: 'Alimentos', quantity: 1, costUSD: 0.0 }]);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: CABECERA Y CONTROLES */}
      <div className="widget" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-main)' }}>
              🧾 Libro de Compras y Abastecimiento OCR
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Registro de abastecimiento de stock, control de costos del catálogo e importación neuronal de facturas.
            </p>
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
              onClick={() => setShowOCRModal(true)}
              className="btn-pill-dark"
              style={{ color: 'var(--brand-teal)', borderColor: 'rgba(14, 165, 164, 0.25)', gap: '6px', height: '40px' }}
            >
              <FileText size={15} />
              <span>Escanear Factura OCR</span>
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
      <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1500,
          padding: '20px'
        }}>
          
          <div className="widget animate-entrance" style={{
            width: '100%',
            maxWidth: '680px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '85vh'
          }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Registrar Compra Manual de Reposición
                </h4>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddManualPurchase} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
                
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
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
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
                            placeholder="Muffins..."
                            value={item.name}
                            onChange={(e) => handleUpdateFormItem(idx, 'name', e.target.value)}
                            style={{ flex: 1, padding: '6px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                            required
                          />
                          <select 
                            value={item.category}
                            onChange={(e) => handleUpdateFormItem(idx, 'category', e.target.value)}
                            style={{ width: '90px', padding: '5px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                          >
                            <option value="Alimentos">Alimentos</option>
                            <option value="Bebidas">Bebidas</option>
                            <option value="Lácteos">Lácteos</option>
                            <option value="General">General</option>
                          </select>
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
              <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
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

      {/* MODAL 2: ESCÁNER INTELIGENTE OCR DE FACTURAS (MIGRADO DE INVENTARIO) */}
      {showOCRModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(6, 6, 8, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1500,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '20px'
        }}>
          <div className="widget animate-entrance" style={{
            width: '100%',
            maxWidth: '580px',
            padding: '28px',
            borderRadius: '28px',
            boxShadow: 'var(--card-shadow)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)'
          }}>
            <div className="widget-header" style={{ marginBottom: '22px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 className="widget-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText style={{ color: 'var(--brand-teal)' }} />
                <span>Reconocimiento Neuronal OCR de Facturas de Compra</span>
              </h3>
              <button 
                onClick={() => { setShowOCRModal(false); setSelectedInvoice(null); setOcrResult(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {ocrResult ? (
              /* Lectura Exitosa */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ backgroundColor: 'rgba(14, 165, 164, 0.05)', padding: '16px', borderRadius: '16px', border: '1.5px solid rgba(14, 165, 164, 0.15)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-teal)', textTransform: 'uppercase' }}>PROVEEDOR RECONOCIDO CON ÉXITO:</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, marginTop: '2px', color: 'var(--text-primary)' }}>{ocrResult.supplierName}</div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>Factura: <strong>{ocrResult.invoiceNumber}</strong></span>
                    <span>Fecha: <strong>{ocrResult.date}</strong></span>
                  </div>
                </div>

                <div style={{ border: '1.5px solid var(--border-color)', borderRadius: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                    PRODUCTOS MAPEADOS AL CATÁLOGO (MONEDA DUAL):
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                    {ocrResult.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', borderBottom: i < ocrResult.items.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: i < ocrResult.items.length - 1 ? '8px' : '0' }}>
                        <div>
                          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{item.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cód: {item.code} | {item.category}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="status-badge delivered" style={{ fontSize: '10.5px', fontWeight: 800 }}>+{item.quantity} u.</span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                            {formatUSD(item.costUSD)} / Bs. {convertToVES(item.costUSD).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button 
                    onClick={() => { setOcrResult(null); setSelectedInvoice(null); }}
                    className="btn-pill-dark"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Escanear Otra
                  </button>

                  <button 
                    onClick={handleImportOCR}
                    className="btn-yellow"
                    style={{ flex: 1, justifyContent: 'center', gap: '6px' }}
                  >
                    <Check size={16} />
                    <span>Aprobar e Incrementar Stock</span>
                  </button>
                </div>
              </div>
            ) : isScanning ? (
              /* Loader */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '20px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '3px solid rgba(14, 165, 164, 0.1)',
                  borderTopColor: 'var(--brand-teal)',
                  animation: 'spin 1s linear infinite'
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14.5px', fontWeight: 800 }}>Procesando Factura con Red Neuronal OCR...</span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Mapeando códigos de barras y calculando stocks en bolívares</span>
                </div>
              </div>
            ) : (
              /* Selector de Factura */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Seleccione una de las facturas de proveedores escaneadas digitalmente para simular el procesamiento y mapeo inteligente de ítems de compra:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {MOCK_INVOICES.map((inv) => (
                    <div 
                      key={inv.id}
                      onClick={() => setSelectedInvoice(inv)}
                      style={{
                        padding: '14px',
                        borderRadius: '16px',
                        border: selectedInvoice?.id === inv.id ? '2px solid var(--brand-teal)' : '1.5px solid var(--border-color)',
                        backgroundColor: selectedInvoice?.id === inv.id ? 'rgba(14, 165, 164, 0.05)' : 'var(--bg-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13.5px', display: 'block', color: 'var(--text-primary)' }}>{inv.supplierName}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Factura: {inv.invoiceNumber} | Fecha: {inv.date}</span>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '12px' }}>
                        <span className="status-badge paid" style={{ fontSize: '10.5px' }}>{inv.items.length} ítems</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button 
                    onClick={() => { setShowOCRModal(false); setSelectedInvoice(null); }}
                    className="btn-pill-dark"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Cancelar
                  </button>

                  <button 
                    onClick={() => selectedInvoice && handleStartOCR(selectedInvoice)}
                    disabled={!selectedInvoice}
                    className="btn-yellow"
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: selectedInvoice ? 1 : 0.5,
                      cursor: selectedInvoice ? 'pointer' : 'not-allowed'
                    }}
                  >
                    <span>Procesar Factura OCR</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1B: EDITAR ORDEN DE COMPRA (GLASSMORPHISM) */}
      {showEditModal && editingPurchase && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1500,
          padding: '20px'
        }}>
          
          <div className="widget animate-entrance" style={{
            width: '100%',
            maxWidth: '680px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '85vh'
          }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Editar Orden de Compra
                </h4>
              </div>
              <button onClick={() => { setShowEditModal(false); setEditingPurchase(null); }} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEditPurchase} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', fontSize: '13px' }}>
                
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
                      <select 
                        value={item.category} 
                        onChange={(e) => {
                          const updated = [...editFormItems];
                          updated[index].category = e.target.value;
                          setEditFormItems(updated);
                        }}
                        className="dropdown-select"
                      >
                        <option value="Alimentos">Alimentos</option>
                        <option value="Bebidas">Bebidas</option>
                        <option value="Lácteos">Lácteos</option>
                        <option value="Confitería">Confitería</option>
                        <option value="Limpieza">Limpieza</option>
                      </select>
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
              <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
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

      {/* MODAL 3: ALERTA / ACCION COMÚN DE MENSAJE */}
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
