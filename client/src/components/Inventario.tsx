import { useState, useEffect } from 'react';
import { Search, Plus, Sparkles, Check, X, AlertTriangle, AlertCircle, Edit, Trash2, ShoppingBag, RefreshCw } from 'lucide-react';
import { getDatabase, type ProductDocType } from '../db/database';
import { syncWorker } from '../db/sync';
import { useExchangeRate } from '../contexts/ExchangeRateContext';

interface InventarioProps {
  searchTerm?: string;
}

interface CustomProduct extends ProductDocType {
  description?: string;
  unit?: string;
  supplierName?: string;
  expiryDate?: string;
}

export default function Inventario({ searchTerm = '' }: InventarioProps) {
  const { convertToVES, formatVES, formatUSD } = useExchangeRate();
  const [products, setProducts] = useState<CustomProduct[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CustomProduct | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'General',
    priceUSD: '',
    costUSD: '',
    stock: '',
    minStock: '5',
    description: '',
    unit: 'unidades',
    supplierName: 'Proveedor General',
    expiryDate: '',
    stockReason: 'Conteo Físico',
    stockJustification: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<CustomProduct | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // C4: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Suppliers state for dropdown select
  const [suppliersList, setSuppliersList] = useState<Array<{ rif: string; companyName: string }>>([]);

  // Product Form state
  const [newProduct, setNewProduct] = useState({
    code: '',
    name: '',
    category: 'General',
    priceUSD: '',
    costUSD: '',
    stock: '',
    minStock: '5',
    description: '',
    unit: 'unidades',
    supplierName: 'Proveedor General',
    expiryDate: ''
  });

  const loadProducts = async () => {
    setIsRefreshing(true);
    try {
      const db = await getDatabase();
      const allProds = await db.products.find().exec();
      
      const mapped = allProds.map(doc => {
        const json = doc.toJSON();
        
        // Custom parsing or simulated values for extended fields
        let description = 'Sin descripción.';
        let unit = 'unidades';
        let supplierName = 'Proveedor General';
        let expiryDate = 'N/A';

        // Add some realistic simulated fields for default products
        if (json.code === '1001') {
          description = 'Café en grano tostado oscuro de exportación.';
          unit = 'kg';
          supplierName = 'Cervecería Polar C.A.';
        } else if (json.code === '1002') {
          description = 'Té matcha orgánico pulverizado de Japón.';
          unit = 'unidades';
          supplierName = 'Alimentos Heinz de Venezuela C.A.';
          expiryDate = '2027-12-31';
        } else if (json.code === '1005') {
          description = 'Leche entera pasteurizada enriquecida con calcio.';
          unit = 'litros';
          supplierName = 'Lácteos Los Andes C.A.';
          expiryDate = '2026-08-15';
        }

        return {
          ...json,
          description,
          unit,
          supplierName,
          expiryDate
        };
      });

      setProducts(mapped);
    } catch (err) {
      console.error('Error al cargar productos:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  const loadSuppliersData = () => {
    try {
      const saved = localStorage.getItem('stockmaster_suppliers_local');
      if (saved) {
        setSuppliersList(JSON.parse(saved));
      } else {
        setSuppliersList([
          { rif: 'J-00006572-4', companyName: 'Cervecería Polar C.A.' },
          { rif: 'J-00032991-2', companyName: 'Alimentos Heinz de Venezuela C.A.' },
          { rif: 'J-30477401-2', companyName: 'Lácteos Los Andes C.A.' }
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadProducts();
    loadSuppliersData();

    // Subscribe to reactively update inventory items
    let sub: any;
    getDatabase().then(db => {
      sub = db.products.find().$.subscribe(() => {
        loadProducts();
      });
    });

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.code || !newProduct.name || !newProduct.priceUSD || !newProduct.stock) {
      setAlertConfig({
        title: 'Campos Obligatorios',
        message: 'Por favor complete todos los campos requeridos marcados con asterisco (*).',
        type: 'info'
      });
      return;
    }

    try {
      const db = await getDatabase();
      const existing = await db.products.findOne({ selector: { code: newProduct.code } }).exec();
      if (existing) {
        setAlertConfig({
          title: 'Código Existente',
          message: 'Este Código de Barras ya se encuentra registrado para otro producto en el catálogo.',
          type: 'error'
        });
        return;
      }

      const prodId = crypto.randomUUID();

      await db.products.insert({
        id: prodId,
        code: newProduct.code.trim(),
        name: newProduct.name.trim(),
        category: newProduct.category,
        price: Number(newProduct.priceUSD),
        cost: Number(newProduct.costUSD) || 0,
        stock: Number(newProduct.stock),
        minStock: Number(newProduct.minStock) || 5,
        version: 1,
        updatedAt: new Date().toISOString()
      });

      setShowAddModal(false);
      setNewProduct({
        code: '',
        name: '',
        category: 'General',
        priceUSD: '',
        costUSD: '',
        stock: '',
        minStock: '5',
        description: '',
        unit: 'unidades',
        supplierName: 'Proveedor General',
        expiryDate: ''
      });

      setShowSuccessToast('Producto registrado exitosamente en el inventario local.');
      setTimeout(() => setShowSuccessToast(null), 3500);

      loadProducts();
      
      // Sync in background
      syncWorker.sync();
    } catch (err: any) {
      console.error(err);
      setAlertConfig({
        title: 'Error de Inserción',
        message: 'Ocurrió un error al registrar el producto en la base de datos local.',
        type: 'error'
      });
    }
  };

  const handleEditClick = (prod: CustomProduct) => {
    setEditingProduct(prod);
    setEditForm({
      name: prod.name,
      category: prod.category,
      priceUSD: prod.price.toString(),
      costUSD: prod.cost.toString(),
      stock: prod.stock.toString(),
      minStock: prod.minStock.toString(),
      description: prod.description || '',
      unit: prod.unit || 'unidades',
      supplierName: prod.supplierName || 'Proveedor General',
      expiryDate: prod.expiryDate || '',
      stockReason: 'Conteo Físico',
      stockJustification: ''
    });
    setShowEditModal(true);
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const db = await getDatabase();
      const doc = await db.products.findOne({ selector: { id: editingProduct.id } }).exec();
      
      if (doc) {
        const originalStock = editingProduct.stock;
        const newStockVal = Number(editForm.stock);
        const stockChanged = originalStock !== newStockVal;

        if (stockChanged && !editForm.stockJustification.trim()) {
          setAlertConfig({
            title: 'Justificación Requerida',
            message: 'Al cambiar el stock de existencias manualmente, debe ingresar una breve justificación en la sección de auditoría.',
            type: 'info'
          });
          return;
        }

        // Patchear el documento
        await doc.patch({
          name: editForm.name.trim(),
          category: editForm.category,
          price: Number(editForm.priceUSD),
          cost: Number(editForm.costUSD) || 0,
          stock: newStockVal,
          minStock: Number(editForm.minStock) || 5,
          version: (doc.get('version') || 1) + 1,
          updatedAt: new Date().toISOString()
        });

        // Registrar en logs locales si el stock cambió
        if (stockChanged) {
          const newAuditLog = {
            id: 'local_log_' + crypto.randomUUID(),
            action: 'STOCK_AJUSTE_JUSTIFICADO',
            details: JSON.stringify({
              productId: editingProduct.id,
              productName: editForm.name.trim(),
              code: editingProduct.code,
              previousStock: originalStock,
              newStock: newStockVal,
              reason: editForm.stockReason,
              justification: editForm.stockJustification.trim()
            }, null, 2),
            ipAddress: '127.0.0.1 (Local)',
            userAgent: navigator.userAgent + ' (PWA Local)',
            createdAt: new Date().toISOString(),
            user: {
              name: 'Administrador Local',
              email: 'admin@stockmaster.pro',
              role: 'ADMIN'
            }
          };

          const savedLocal = localStorage.getItem('stockmaster_local_audit_logs');
          const localLogs = savedLocal ? JSON.parse(savedLocal) : [];
          localLogs.unshift(newAuditLog);
          localStorage.setItem('stockmaster_local_audit_logs', JSON.stringify(localLogs));
        }

        setShowEditModal(false);
        setEditingProduct(null);
        setShowSuccessToast('Producto actualizado exitosamente en el catálogo local.');
        setTimeout(() => setShowSuccessToast(null), 3500);
        
        loadProducts();
        syncWorker.sync();
      }
    } catch (err: any) {
      console.error(err);
      setAlertConfig({
        title: 'Error de Edición',
        message: 'No se pudo guardar la información modificada en la base de datos local.',
        type: 'error'
      });
    }
  };

  const handleDeleteProduct = async () => {
    if (!showDeleteConfirm) return;

    try {
      const db = await getDatabase();
      const doc = await db.products.findOne({ selector: { id: showDeleteConfirm.id } }).exec();
      if (doc) {
        await doc.remove();
        setShowDeleteConfirm(null);

        setShowSuccessToast('Producto removido correctamente del catálogo.');
        setTimeout(() => setShowSuccessToast(null), 3000);

        loadProducts();
        
        // Sync in background
        syncWorker.sync();
      }
    } catch (err) {
      console.error(err);
      setAlertConfig({
        title: 'Error al Eliminar',
        message: 'No se pudo eliminar el producto del catálogo.',
        type: 'error'
      });
    }
  };

  // Seed default products
  const handleSeedProducts = async () => {
    try {
      const db = await getDatabase();
      const seedData = [
        { id: 'p1', code: '1001', name: 'Café Espresso Premium 1kg', category: 'Bebidas', price: 15.0, cost: 8.0, stock: 12, minStock: 5 },
        { id: 'p2', code: '1002', name: 'Té Matcha Japonés 100g', category: 'Bebidas', price: 11.0, cost: 5.5, stock: 4, minStock: 5 },
        { id: 'p3', code: '1003', name: 'Croissant de Mantequilla', category: 'Alimentos', price: 2.0, cost: 0.8, stock: 25, minStock: 10 },
        { id: 'p4', code: '1004', name: 'Tarta de Chocolate Gourmet', category: 'Alimentos', price: 24.0, cost: 12.0, stock: 8, minStock: 3 },
        { id: 'p5', code: '1005', name: 'Leche Entera Premium 1L', category: 'Lácteos', price: 1.5, cost: 0.7, stock: 40, minStock: 10 }
      ];

      for (const item of seedData) {
        await db.products.upsert({
          ...item,
          version: 1,
          updatedAt: new Date().toISOString()
        });
      }

      loadProducts();
      syncWorker.sync();
    } catch (err) {
      console.error(err);
    }
  };

  const activeSearch = searchTerm || localSearchTerm;
  
  const filteredProducts = products.filter(prod => 
    prod.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
    prod.code.includes(activeSearch) ||
    prod.category.toLowerCase().includes(activeSearch.toLowerCase())
  );

  // C4: Pagination - reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [activeSearch]);
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: CONTROLES Y CABECERA */}
      <div className="widget" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-main)' }}>
              📦 Catálogo de Productos e Inventarios
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Administra precios, existencias y costos de adquisición expresados de forma dual (USD / VES BCV).
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            
            {/* Buscador local */}
            {!searchTerm && (
              <div className="search-container" style={{ width: '250px', height: '40px' }}>
                <Search className="search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o código..." 
                  className="search-input" 
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                />
              </div>
            )}

            {products.length === 0 && (
              <button 
                onClick={handleSeedProducts}
                className="btn-pill-dark"
                style={{ color: 'var(--brand-gold)', borderColor: 'rgba(251, 191, 36, 0.25)', gap: '6px', height: '40px' }}
              >
                <Sparkles size={14} />
                <span>Sembrar Muestra</span>
              </button>
            )}

            <button 
              onClick={() => setShowAddModal(true)}
              className="btn-yellow"
              style={{ gap: '8px', padding: '10px 18px', borderRadius: 'var(--button-radius)' }}
            >
              <Plus size={16} />
              <span>Nuevo Producto</span>
            </button>

            <button 
              onClick={loadProducts}
              disabled={isRefreshing}
              className="btn-pill-dark"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', cursor: isRefreshing ? 'not-allowed' : 'pointer' }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            </button>
          </div>

        </div>
      </div>

      {/* TOAST SUCCESS NOTIFICATION */}
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

      {/* SECCIÓN 2: TABLA DE CATÁLOGO */}
      <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
        <div className="details-table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>CÓDIGO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>NOMBRE DEL PRODUCTO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>CATEGORÍA</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>COSTO COMPRA ($)</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>PRECIO VENTA (USD)</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>PRECIO BCV (VES)</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>EXISTENCIA</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>EXPIRACIÓN</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ESTADO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {isRefreshing ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <tr key={`sk-${idx}`} style={{ borderBottom: '1px solid var(--border-color)', opacity: 0.65 }}>
                    <td style={{ padding: '12px 8px' }}>
                      <div className="skeleton-pulse" style={{ width: '80px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out' }} />
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="skeleton-pulse" style={{ width: '180px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out' }} />
                        <div className="skeleton-pulse" style={{ width: '120px', height: '10px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out' }} />
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div className="skeleton-pulse" style={{ width: '60px', height: '18px', borderRadius: '50px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out' }} />
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <div className="skeleton-pulse" style={{ width: '50px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <div className="skeleton-pulse" style={{ width: '65px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <div className="skeleton-pulse" style={{ width: '65px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div className="skeleton-pulse" style={{ width: '40px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out', margin: '0 auto' }} />
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div className="skeleton-pulse" style={{ width: '60px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out', margin: '0 auto' }} />
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div className="skeleton-pulse" style={{ width: '60px', height: '18px', borderRadius: '50px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out', margin: '0 auto' }} />
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <div className="skeleton-pulse" style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out' }} />
                        <div className="skeleton-pulse" style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out' }} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    No se encontraron productos en el inventario.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((prod) => {
                  const isLowStock = prod.stock <= prod.minStock;
                  return (
                    <tr key={prod.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                        {prod.code}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{prod.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{prod.description}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '2px 8px', borderRadius: '50px' }}>
                          {prod.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {formatUSD(prod.cost)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {formatUSD(prod.price)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-gold)' }}>
                        {formatVES(prod.price)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 800 }}>
                        {prod.stock} <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>{prod.unit}</span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {prod.expiryDate}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span className={`status-badge ${prod.stock === 0 ? 'shipped' : isLowStock ? 'shipped' : 'delivered'}`} style={{ fontSize: '10px' }}>
                          {prod.stock === 0 ? 'Agotado' : isLowStock ? 'Bajo Stock' : 'Al día'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEditClick(prod)}
                            className="btn-pill-dark"
                            style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'var(--bg-input)' }}
                            title="Editar Datos"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(prod)}
                            className="btn-pill-dark"
                            style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                            title="Eliminar del Catálogo"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
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
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.4 : 1
              }}
            >
              ← Anterior
            </button>
            <span style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-main)'
            }}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-pill-dark"
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.4 : 1
              }}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* MODAL 1: REGISTRO DE PRODUCTO A PANTALLA COMPLETA FLOTANTE (REEMPLAZA PANEL LATERAL) */}
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
            maxWidth: '620px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingBag size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Registrar Producto en Inventario
                </h4>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Cód de Barras *
                    </label>
                    <input 
                      type="text" 
                      value={newProduct.code}
                      onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })}
                      placeholder="Ej: 1007"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Nombre del Producto *
                    </label>
                    <input 
                      type="text" 
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      placeholder="Ej: Croissant de Avellana Gourmet"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Categoría
                    </label>
                    <select 
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="dropdown-select"
                      style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                    >
                      <option value="General">General</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Alimentos">Alimentos</option>
                      <option value="Lácteos">Lácteos</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Unidad de Medida
                    </label>
                    <select 
                      value={newProduct.unit}
                      onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                      className="dropdown-select"
                      style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                    >
                      <option value="unidades">Unidades (u.)</option>
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="litros">Litros (L)</option>
                      <option value="cajas">Cajas</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Proveedor Relacionado
                    </label>
                    <select 
                      value={newProduct.supplierName}
                      onChange={(e) => setNewProduct({ ...newProduct, supplierName: e.target.value })}
                      className="dropdown-select"
                      style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                    >
                      <option value="Proveedor General">Proveedor General</option>
                      {suppliersList.map(s => (
                        <option key={s.rif} value={s.companyName}>{s.companyName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Stock Inicial *
                    </label>
                    <input 
                      type="number" 
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                      placeholder="0"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Mínimo Alerta
                    </label>
                    <input 
                      type="number" 
                      value={newProduct.minStock}
                      onChange={(e) => setNewProduct({ ...newProduct, minStock: e.target.value })}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                  
                  {/* Prices double reference display in form */}
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontSize: '10px' }}>
                        Costo Compra ($)
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={newProduct.costUSD}
                        onChange={(e) => setNewProduct({ ...newProduct, costUSD: e.target.value })}
                        placeholder="0.00"
                        className="search-input"
                        style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      />
                      <span style={{ fontSize: '8.5px', color: 'var(--brand-gold)', fontWeight: 700, alignSelf: 'flex-end', fontFamily: 'monospace' }}>
                        Bs. {convertToVES(Number(newProduct.costUSD) || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontSize: '10px' }}>
                        P. Venta ($) *
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={newProduct.priceUSD}
                        onChange={(e) => setNewProduct({ ...newProduct, priceUSD: e.target.value })}
                        placeholder="0.00"
                        className="search-input"
                        style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                        required
                      />
                      <span style={{ fontSize: '8.5px', color: 'var(--brand-gold)', fontWeight: 700, alignSelf: 'flex-end', fontFamily: 'monospace' }}>
                        Bs. {convertToVES(Number(newProduct.priceUSD) || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Fecha de Vencimiento (Exp.)
                    </label>
                    <input 
                      type="date" 
                      value={newProduct.expiryDate}
                      onChange={(e) => setNewProduct({ ...newProduct, expiryDate: e.target.value })}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', height: '40px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Descripción del Producto
                    </label>
                    <input 
                      type="text" 
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      placeholder="Ej: Caja de galletas surtidas orgánicas"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
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
                  Registrar Producto
                </button>
              </div>
            </form>

          </div>

        </div>
      )}

      {/* MODAL 4: EDICIÓN DE PRODUCTO CON AUDITORÍA DE STOCK */}
      {showEditModal && editingProduct && (
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
            maxWidth: '620px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Editar Producto: {editingProduct.name}
                </h4>
              </div>
              <button 
                onClick={() => { setShowEditModal(false); setEditingProduct(null); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditProduct} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Cód de Barras
                    </label>
                    <input 
                      type="text" 
                      value={editingProduct.code}
                      disabled
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', backgroundColor: 'var(--bg-primary)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Nombre del Producto *
                    </label>
                    <input 
                      type="text" 
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="Ej: Croissant"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Categoría
                    </label>
                    <select 
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="dropdown-select"
                      style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                    >
                      <option value="General">General</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Alimentos">Alimentos</option>
                      <option value="Lácteos">Lácteos</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Unidad de Medida
                    </label>
                    <select 
                      value={editForm.unit}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                      className="dropdown-select"
                      style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                    >
                      <option value="unidades">Unidades (u.)</option>
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="litros">Litros (L)</option>
                      <option value="cajas">Cajas</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Proveedor Relacionado
                    </label>
                    <select 
                      value={editForm.supplierName}
                      onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                      className="dropdown-select"
                      style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                    >
                      <option value="Proveedor General">Proveedor General</option>
                      {suppliersList.map(s => (
                        <option key={s.rif} value={s.companyName}>{s.companyName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Stock *
                    </label>
                    <input 
                      type="number" 
                      value={editForm.stock}
                      onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                      placeholder="0"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Mínimo Alerta
                    </label>
                    <input 
                      type="number" 
                      value={editForm.minStock}
                      onChange={(e) => setEditForm({ ...editForm, minStock: e.target.value })}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                  
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontSize: '10px' }}>
                        Costo Compra ($)
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editForm.costUSD}
                        onChange={(e) => setEditForm({ ...editForm, costUSD: e.target.value })}
                        placeholder="0.00"
                        className="search-input"
                        style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontSize: '10px' }}>
                        P. Venta ($) *
                      </label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editForm.priceUSD}
                        onChange={(e) => setEditForm({ ...editForm, priceUSD: e.target.value })}
                        placeholder="0.00"
                        className="search-input"
                        style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* SECCIÓN CONDICIONAL DE AUDITORÍA DE AJUSTE DE STOCK */}
                {Number(editForm.stock) !== editingProduct.stock && (
                  <div style={{
                    backgroundColor: 'rgba(251, 191, 36, 0.06)',
                    border: '1.5px solid rgba(251, 191, 36, 0.25)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginTop: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-gold)' }}>
                      <AlertTriangle size={16} />
                      <strong style={{ fontSize: '12px', fontWeight: 800 }}>JUSTIFICACIÓN REQUERIDA (AUDITORÍA FISCAL)</strong>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                      Ha modificado las existencias físicas de <strong>{editingProduct.stock}</strong> a <strong>{editForm.stock}</strong>. Indique el motivo del ajuste para el libro de inventarios.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '10px', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '9px' }}>
                          Motivo del Ajuste *
                        </label>
                        <select 
                          value={editForm.stockReason}
                          onChange={(e) => setEditForm({ ...editForm, stockReason: e.target.value })}
                          className="dropdown-select"
                          style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                        >
                          <option value="Conteo Físico">Ajuste por Conteo Físico</option>
                          <option value="Merma">Merma (Deterioro / Expiración)</option>
                          <option value="Robo">Robo / Pérdida no Justificada</option>
                          <option value="Devolución">Devolución de Cliente</option>
                          <option value="Entrada de Compra">Entrada de Mercancía</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '9px' }}>
                          Explicación / Justificación *
                        </label>
                        <input 
                          type="text"
                          value={editForm.stockJustification}
                          onChange={(e) => setEditForm({ ...editForm, stockJustification: e.target.value })}
                          placeholder="Ej: Ajuste por auditoría semanal de almacén"
                          className="search-input"
                          style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Fecha de Vencimiento (Exp.)
                    </label>
                    <input 
                      type="date" 
                      value={editForm.expiryDate}
                      onChange={(e) => setEditForm({ ...editForm, expiryDate: e.target.value })}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', height: '40px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Descripción del Producto
                    </label>
                    <input 
                      type="text" 
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Ej: Galletas dulces gourmet"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingProduct(null); }}
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

      {/* MODAL 2: ELIMINACIÓN CONFIRMACIÓN DEDICADO PREMIUM */}
      {showDeleteConfirm && (
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
            maxWidth: '420px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid rgba(239, 68, 68, 0.2)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '14px', borderRadius: '50%', color: '#ef4444' }}>
                <AlertTriangle size={32} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                  ¿Confirmar Eliminación de Catálogo?
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Estás a punto de eliminar a <strong>{showDeleteConfirm.name}</strong> (SKU: {showDeleteConfirm.code}) del catálogo comercial. Los datos del producto se removerán de la base local.
                </p>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', justifyContent: 'center', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-pill-dark"
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)', justifyContent: 'center' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProduct}
                className="btn-yellow"
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--button-radius)', backgroundColor: '#ef4444', color: '#fff', border: '1.5px solid #ef4444', justifyContent: 'center' }}
              >
                Remover Producto
              </button>
            </div>

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
