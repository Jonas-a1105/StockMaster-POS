import { useState, useEffect } from 'react';
import { Search, Plus, Sparkles, Check, X, AlertTriangle, AlertCircle, Edit, Trash2, ShoppingBag, RefreshCw, Info, History } from 'lucide-react';
import { getDatabase, type ProductDocType } from '../db/database';
import { syncWorker } from '../db/sync';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import CustomSelect from './CustomSelect';
import { logAuditEvent } from '../utils/audit';
import CustomDatePicker from './CustomDatePicker';


interface InventarioProps {
  searchTerm?: string;
  user: {
    role: string;
    name: string;
  };
}

interface CustomProduct extends ProductDocType {
  description?: string;
  unit?: string;
  supplierName?: string;
  expiryDate?: string;
}

export default function Inventario({ searchTerm = '', user }: InventarioProps) {
  const isAdmin = user.role === 'ADMIN';
  const { convertToVES, formatVES, formatUSD } = useExchangeRate();
  const [products, setProducts] = useState<CustomProduct[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Lotes, Kardex and Bulk load states
  const [editBatches, setEditBatches] = useState<any[]>([]);
  const [showKardexModal, setShowKardexModal] = useState(false);
  const [kardexProduct, setKardexProduct] = useState<CustomProduct | null>(null);
  const [kardexMovements, setKardexMovements] = useState<any[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvStats, setCsvStats] = useState({ newProds: 0, updateProds: 0, total: 0 });

  // Mobile detection for full-height modal layout
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        
        // Calcular fecha de expiración a partir de los lotes activos
        let expiry = 'N/A';
        try {
          if (json.batches) {
            const parsed = JSON.parse(json.batches);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const dates = parsed
                .map((b: any) => b.expiryDate)
                .filter((d: any) => d && d !== 'N/A');
              if (dates.length > 0) {
                dates.sort();
                expiry = dates[0];
              }
            }
          }
        } catch (e) {
          console.error(e);
        }

        return {
          ...json,
          description: 'Sin descripción.',
          unit: 'unidades',
          supplierName: 'Proveedor General',
          expiryDate: expiry,
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
    if (!isAdmin) return;
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
      const initialBatch = {
        loteCode: 'LOTE-INICIAL',
        expiryDate: newProduct.expiryDate || 'N/A',
        stock: Number(newProduct.stock)
      };

      await db.products.insert({
        id: prodId,
        code: newProduct.code.trim(),
        name: newProduct.name.trim(),
        category: newProduct.category,
        price: Number(newProduct.priceUSD),
        cost: Number(newProduct.costUSD) || 0,
        stock: Number(newProduct.stock),
        minStock: Number(newProduct.minStock) || 5,
        batches: JSON.stringify([initialBatch]),
        version: 1,
        updatedAt: new Date().toISOString()
      });

      logAuditEvent(user, 'PRODUCTO_CREAR', {
        productId: prodId,
        name: newProduct.name.trim(),
        price: Number(newProduct.priceUSD),
        stock: Number(newProduct.stock)
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
    if (!isAdmin) return;
    setEditingProduct(prod);
    
    let parsedBatches: any[] = [];
    try {
      if (prod.batches) {
        parsedBatches = JSON.parse(prod.batches);
      }
    } catch (e) {
      console.error(e);
    }
    if (parsedBatches.length === 0) {
      parsedBatches = [
        {
          loteCode: 'LOTE-INICIAL',
          expiryDate: prod.expiryDate || 'N/A',
          stock: prod.stock
        }
      ];
    }
    setEditBatches(parsedBatches);

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
    if (!isAdmin) return;
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
          batches: JSON.stringify(editBatches),
          version: (doc.get('version') || 1) + 1,
          updatedAt: new Date().toISOString()
        });

        // Registrar en logs locales si el stock cambió
        if (stockChanged) {
          logAuditEvent(user, 'STOCK_AJUSTE_JUSTIFICADO', {
            productId: editingProduct.id,
            productName: editForm.name.trim(),
            code: editingProduct.code,
            prevStock: originalStock,
            newStock: newStockVal,
            reason: editForm.stockReason,
            justification: editForm.stockJustification.trim()
          });
        } else {
          logAuditEvent(user, 'PRODUCTO_EDITAR', {
            productId: editingProduct.id,
            code: editingProduct.code,
            name: editForm.name.trim()
          });
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

  const handleBatchChange = (index: number, field: string, value: any) => {
    const updated = [...editBatches];
    updated[index] = { ...updated[index], [field]: value };
    setEditBatches(updated);
    
    // Recalculate total stock and earliest expiration date
    const total = updated.reduce((acc, b) => acc + (Number(b.stock) || 0), 0);
    const dates = updated.map(b => b.expiryDate).filter(d => d && d !== 'N/A' && d !== '');
    const earliest = dates.length > 0 ? [...dates].sort()[0] : '';
    
    setEditForm(prev => ({ 
      ...prev, 
      stock: total.toString(),
      expiryDate: earliest
    }));
  };

  const handleAddBatch = () => {
    const newBatch = {
      loteCode: 'LOTE-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
      expiryDate: '',
      stock: 0
    };
    const updated = [...editBatches, newBatch];
    setEditBatches(updated);
    
    // Recalculate total stock and earliest expiration date
    const total = updated.reduce((acc, b) => acc + (Number(b.stock) || 0), 0);
    const dates = updated.map(b => b.expiryDate).filter(d => d && d !== 'N/A' && d !== '');
    const earliest = dates.length > 0 ? [...dates].sort()[0] : '';
    
    setEditForm(prev => ({ 
      ...prev, 
      stock: total.toString(),
      expiryDate: earliest
    }));
  };

  const handleRemoveBatch = (index: number) => {
    if (editBatches.length <= 1) {
      setAlertConfig({
        title: 'Lote Requerido',
        message: 'Un producto debe tener al menos un lote activo.',
        type: 'info'
      });
      return;
    }
    const updated = editBatches.filter((_, idx) => idx !== index);
    setEditBatches(updated);
    
    // Recalculate total stock and earliest expiration date
    const total = updated.reduce((acc, b) => acc + (Number(b.stock) || 0), 0);
    const dates = updated.map(b => b.expiryDate).filter(d => d && d !== 'N/A' && d !== '');
    const earliest = dates.length > 0 ? [...dates].sort()[0] : '';
    
    setEditForm(prev => ({ 
      ...prev, 
      stock: total.toString(),
      expiryDate: earliest
    }));
  };

  const handleKardexClick = async (prod: CustomProduct) => {
    setKardexProduct(prod);
    setShowKardexModal(true);
    setKardexMovements([]);
    
    try {
      const db = await getDatabase();
      
      const salesDocs = await db.sales.find().exec();
      const productSales = salesDocs
        .map(d => d.toJSON())
        .filter(sale => sale.items.some((item: any) => item.productId === prod.id));
        
      const purchasesDocs = await db.purchases.find().exec();
      const productPurchases = purchasesDocs
        .map(d => d.toJSON())
        .filter(purchase => purchase.items.some((item: any) => item.productId === prod.id));
        
      const auditDocs = await db.auditLogs.find().exec();
      const productAudits = auditDocs
        .map(d => d.toJSON())
        .filter(log => {
          try {
            const detailsObj = JSON.parse(log.details || '{}');
            return detailsObj.productId === prod.id;
          } catch {
            return false;
          }
        });

      const movements: any[] = [];
      
      productSales.forEach(sale => {
        const item = sale.items.find((i: any) => i.productId === prod.id);
        movements.push({
          date: sale.createdAt,
          type: 'VENTA',
          reference: sale.ticketNumber,
          qtyChange: -item.quantity,
          user: sale.cashierId || 'Cajero',
          justification: 'Venta facturada en terminal POS.'
        });
      });
      
      productPurchases.forEach(purchase => {
        const item = purchase.items.find((i: any) => i.productId === prod.id);
        movements.push({
          date: purchase.createdAt,
          type: 'COMPRA',
          reference: purchase.invoiceNumber || 'S/N',
          qtyChange: item.quantity,
          user: 'Admin',
          justification: 'Ingreso por reabastecimiento de inventario.'
        });
      });
      
      productAudits.forEach(log => {
        const details = JSON.parse(log.details || '{}');
        const qtyChange = (details.newStock !== undefined && details.prevStock !== undefined)
          ? (details.newStock - details.prevStock)
          : (details.stock || 0);
        let type = 'AJUSTE';
        if (log.action === 'STOCK_AJUSTE_JUSTIFICADO') {
          type = 'AJUSTE_MANUAL';
        } else if (log.action === 'PRODUCTO_CREAR') {
          type = 'CREACIÓN';
        }
        
        movements.push({
          date: log.createdAt,
          type: type,
          reference: 'N/A',
          qtyChange: qtyChange,
          user: log.userId || 'Sistema',
          justification: details.justification || details.reason || 'Ajuste de stock inicial/manual.'
        });
      });

      movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let balance = 0;
      const movementsWithBalance = movements.map(mov => {
        const prevBal = balance;
        balance += mov.qtyChange;
        return {
          ...mov,
          prevStock: prevBal,
          resultStock: balance
        };
      });
      
      movementsWithBalance.reverse();
      setKardexMovements(movementsWithBalance);
    } catch (err) {
      console.error('Error al cargar kárdex:', err);
    }
  };

  const handleExportCSV = () => {
    if (products.length === 0) return;
    const headers = ['code', 'name', 'category', 'price', 'cost', 'stock', 'minStock', 'expiryDate'];
    const csvRows = [headers.join(',')];
    
    products.forEach(p => {
      const row = [
        `"${p.code}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        p.price,
        p.cost,
        p.stock,
        p.minStock,
        `"${p.expiryDate || 'N/A'}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length <= 1) {
        setCsvErrors(['El archivo CSV está vacío o solo contiene cabeceras.']);
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const requiredHeaders = ['code', 'name', 'price', 'stock'];
      const missing = requiredHeaders.filter(req => !headers.includes(req));
      if (missing.length > 0) {
        setCsvErrors([`Cabeceras faltantes requeridas: ${missing.join(', ')}`]);
        return;
      }
      
      const parsedProducts: any[] = [];
      const errors: string[] = [];
      let newCount = 0;
      let updateCount = 0;
      
      try {
        const db = await getDatabase();
        const existingDocs = await db.products.find().exec();
        const existingCodes = new Set(existingDocs.map(p => p.get('code')));
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
          const values = matches.map(v => v.trim().replace(/^["']|["']$/g, ''));
          
          if (values.length < requiredHeaders.length) {
            errors.push(`Fila ${i + 1}: Datos incompletos.`);
            continue;
          }
          
          const rowData: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowData[h] = values[idx] || '';
          });
          
          const code = rowData.code?.trim();
          const name = rowData.name?.trim();
          const category = rowData.category?.trim() || 'General';
          const price = parseFloat(rowData.price);
          const cost = parseFloat(rowData.cost || '0');
          const stock = parseFloat(rowData.stock);
          const minStock = parseFloat(rowData.minStock || '5');
          const expiryDate = rowData.expiryDate?.trim() || 'N/A';
          
          if (!code) {
            errors.push(`Fila ${i + 1}: El campo 'code' es obligatorio.`);
            continue;
          }
          if (!name) {
            errors.push(`Fila ${i + 1}: El campo 'name' es obligatorio.`);
            continue;
          }
          if (isNaN(price) || price < 0) {
            errors.push(`Fila ${i + 1}: El precio '${rowData.price}' no es un número válido.`);
            continue;
          }
          if (isNaN(cost) || cost < 0) {
            errors.push(`Fila ${i + 1}: El costo '${rowData.cost}' no es un número válido.`);
            continue;
          }
          if (isNaN(stock) || stock < 0) {
            errors.push(`Fila ${i + 1}: El stock '${rowData.stock}' no es un número válido.`);
            continue;
          }
          if (isNaN(minStock) || minStock < 0) {
            errors.push(`Fila ${i + 1}: El stock mínimo '${rowData.minStock}' no es un número válido.`);
            continue;
          }
          
          if (existingCodes.has(code)) {
            updateCount++;
          } else {
            newCount++;
          }
          
          parsedProducts.push({
            code,
            name,
            category,
            price,
            cost,
            stock,
            minStock,
            expiryDate
          });
        }
        
        setCsvPreview(parsedProducts);
        setCsvErrors(errors);
        setCsvStats({ newProds: newCount, updateProds: updateCount, total: parsedProducts.length });
      } catch (err) {
        console.error(err);
        setCsvErrors(['Error procesando la validación del inventario local.']);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (csvPreview.length === 0) return;
    
    try {
      const db = await getDatabase();
      const insertPromises: Promise<any>[] = [];
      
      for (const p of csvPreview) {
        const doc = await db.products.findOne({ selector: { code: p.code } }).exec();
        
        if (doc) {
          const currentVersion = doc.get('version') || 1;
          const prevStock = doc.get('stock');
          const newStock = prevStock + p.stock;
          
          let batches: any[] = [];
          try {
            if (doc.get('batches')) {
              batches = JSON.parse(doc.get('batches'));
            }
          } catch {}
          batches.push({
            loteCode: 'LOTE-IMPORTADO-' + Date.now().toString(36),
            expiryDate: p.expiryDate || 'N/A',
            stock: p.stock
          });

          await doc.patch({
            name: p.name,
            category: p.category,
            price: p.price,
            cost: p.cost,
            stock: newStock,
            minStock: p.minStock,
            batches: JSON.stringify(batches),
            version: currentVersion + 1,
            updatedAt: new Date().toISOString()
          });
          
          insertPromises.push(
            logAuditEvent(user, 'STOCK_AJUSTE_JUSTIFICADO', {
              productId: doc.get('id'),
              productName: p.name,
              code: p.code,
              prevStock,
              newStock,
              reason: 'Carga Masiva CSV',
              justification: 'Importación y mezcla de stock vía archivo CSV'
            })
          );
        } else {
          const prodId = crypto.randomUUID();
          const initialBatch = {
            loteCode: 'LOTE-IMPORTADO',
            expiryDate: p.expiryDate || 'N/A',
            stock: p.stock
          };

          await db.products.insert({
            id: prodId,
            code: p.code,
            name: p.name,
            category: p.category,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            minStock: p.minStock,
            batches: JSON.stringify([initialBatch]),
            version: 1,
            updatedAt: new Date().toISOString()
          });
          
          insertPromises.push(
            logAuditEvent(user, 'PRODUCTO_CREAR', {
              productId: prodId,
              name: p.name,
              price: p.price,
              stock: p.stock
            })
          );
        }
      }
      
      await Promise.allSettled(insertPromises);
      setShowBulkModal(false);
      setCsvPreview([]);
      setCsvErrors([]);
      setShowSuccessToast(`Importación completa: ${csvStats.total} productos procesados con éxito.`);
      setTimeout(() => setShowSuccessToast(null), 3500);
      loadProducts();
      
      syncWorker.sync();
    } catch (err) {
      console.error('Error al importar:', err);
      setAlertConfig({
        title: 'Error de Importación',
        message: 'Ocurrió un error al guardar los productos importados en la base de datos.',
        type: 'error'
      });
    }
  };

  const handleDeleteProduct = async () => {
    if (!isAdmin) return;
    if (!showDeleteConfirm) return;

    try {
      const db = await getDatabase();
      const doc = await db.products.findOne({ selector: { id: showDeleteConfirm.id } }).exec();
      if (doc) {
        await doc.remove();

        logAuditEvent(user, 'PRODUCTO_ELIMINAR', {
          id: showDeleteConfirm.id
        });

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
    <div className="view-container-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: CONTROLES Y CABECERA */}
      <div className="widget view-header-widget" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="info-tooltip-wrapper">
              <Info size={18} className="info-tooltip-icon" style={{ color: 'var(--text-secondary)', cursor: 'help', opacity: 0.8 }} />
              <span className="tooltip-text">
                Administra precios, existencias y costos de adquisición expresados de forma dual (USD / VES BCV).
              </span>
            </div>
            <span className="view-header-pill pill-teal">
              {products.length} Productos
            </span>
            {products.filter(p => p.stock <= (p.minStock || 5)).length > 0 && (
              <span className="view-header-pill pill-red">
                {products.filter(p => p.stock <= (p.minStock || 5)).length} Bajo Stock
              </span>
            )}
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

            {isAdmin && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="btn-yellow"
                style={{ gap: '8px', padding: '10px 18px', borderRadius: 'var(--button-radius)' }}
              >
                <Plus size={16} />
                <span>Nuevo Producto</span>
              </button>
            )}

            {isAdmin && (
              <button 
                onClick={() => setShowBulkModal(true)}
                className="btn-pill-dark"
                style={{ gap: '8px', padding: '10px 18px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center' }}
              >
                <Sparkles size={14} style={{ color: 'var(--brand-primary)' }} />
                <span>Carga Masiva</span>
              </button>
            )}

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
      <div className="widget view-content-widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
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
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>MARGEN %</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>EXISTENCIA</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>EXPIRACIÓN</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ESTADO</th>
                {isAdmin && <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>}
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
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      <div className="skeleton-pulse" style={{ width: '45px', height: '14px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out', marginLeft: 'auto' }} />
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
                    {isAdmin && (
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <div className="skeleton-pulse" style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out' }} />
                          <div className="skeleton-pulse" style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', animation: 'pulse 1.5s infinite ease-in-out' }} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    No se encontraron productos en el inventario.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((prod) => {
                  const isLowStock = prod.stock <= prod.minStock;
                  const marginVal = prod.price > 0 ? ((prod.price - prod.cost) / prod.price) * 100 : 0;
                  
                  let marginStyle = { backgroundColor: 'rgba(20,184,166,0.1)', color: '#14b8a6', padding: '3px 8px', borderRadius: '12px', fontWeight: 800, fontSize: '11px' };
                  if (marginVal < 0) {
                    marginStyle = { backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '3px 8px', borderRadius: '12px', fontWeight: 800, fontSize: '11px' };
                  } else if (marginVal <= 15) {
                    marginStyle = { backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '3px 8px', borderRadius: '12px', fontWeight: 800, fontSize: '11px' };
                  }

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
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <span style={marginStyle}>
                          {marginVal.toFixed(1)}%
                        </span>
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
                      {isAdmin && (
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleKardexClick(prod)}
                              className="btn-pill-dark"
                              style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'var(--bg-input)' }}
                              title="Ver Kárdex (Historial de Movimientos)"
                            >
                              <History size={12} />
                            </button>
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
                      )}
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
            maxWidth: isMobile ? '100%' : '620px',
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
            <form onSubmit={handleAddProduct} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', flex: 1 }}>
                
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
                    <CustomSelect 
                      value={newProduct.category}
                      onChange={(val) => setNewProduct({ ...newProduct, category: val })}
                      options={[
                        { value: 'General', label: 'General' },
                        { value: 'Bebidas', label: 'Bebidas' },
                        { value: 'Alimentos', label: 'Alimentos' },
                        { value: 'Lácteos', label: 'Lácteos' }
                      ]}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Unidad de Medida
                    </label>
                    <CustomSelect 
                      value={newProduct.unit}
                      onChange={(val) => setNewProduct({ ...newProduct, unit: val })}
                      options={[
                        { value: 'unidades', label: 'Unidades (u.)' },
                        { value: 'kg', label: 'Kilogramos (kg)' },
                        { value: 'litros', label: 'Litros (L)' },
                        { value: 'cajas', label: 'Cajas' }
                      ]}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Proveedor Relacionado
                    </label>
                    <CustomSelect 
                      value={newProduct.supplierName}
                      onChange={(val) => setNewProduct({ ...newProduct, supplierName: val })}
                      options={[
                        { value: 'Proveedor General', label: 'Proveedor General' },
                        ...suppliersList.map(s => ({ value: s.companyName, label: s.companyName }))
                      ]}
                      style={{ width: '100%' }}
                    />
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
                    <CustomDatePicker 
                      value={newProduct.expiryDate || ''}
                      onChange={(val) => setNewProduct({ ...newProduct, expiryDate: val })}
                      placeholder="Sin fecha de vencimiento"
                      style={{ width: '100%' }}
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
                  Registrar Producto
                </button>
              </div>
            </form>

          </div>

        </div>
      )}

      {/* MODAL 4: EDICIÓN DE PRODUCTO CON AUDITORÍA DE STOCK */}
      {showEditModal && editingProduct && (
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
            maxWidth: isMobile ? '100%' : '620px',
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
            <form onSubmit={handleEditProduct} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', flex: 1 }}>
                
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
                    <CustomSelect 
                      value={editForm.category}
                      onChange={(val) => setEditForm({ ...editForm, category: val })}
                      options={[
                        { value: 'General', label: 'General' },
                        { value: 'Bebidas', label: 'Bebidas' },
                        { value: 'Alimentos', label: 'Alimentos' },
                        { value: 'Lácteos', label: 'Lácteos' }
                      ]}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Unidad de Medida
                    </label>
                    <CustomSelect 
                      value={editForm.unit}
                      onChange={(val) => setEditForm({ ...editForm, unit: val })}
                      options={[
                        { value: 'unidades', label: 'Unidades (u.)' },
                        { value: 'kg', label: 'Kilogramos (kg)' },
                        { value: 'litros', label: 'Litros (L)' },
                        { value: 'cajas', label: 'Cajas' }
                      ]}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Proveedor Relacionado
                    </label>
                    <CustomSelect 
                      value={editForm.supplierName}
                      onChange={(val) => setEditForm({ ...editForm, supplierName: val })}
                      options={[
                        { value: 'Proveedor General', label: 'Proveedor General' },
                        ...suppliersList.map(s => ({ value: s.companyName, label: s.companyName }))
                      ]}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Stock Total (Lotes)
                    </label>
                    <input 
                      type="number" 
                      value={editForm.stock}
                      disabled
                      placeholder="0"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', backgroundColor: 'var(--bg-primary)', cursor: 'not-allowed', color: 'var(--text-muted)', fontWeight: 'bold' }}
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
                        <CustomSelect 
                          value={editForm.stockReason}
                          onChange={(val) => setEditForm({ ...editForm, stockReason: val })}
                          options={[
                            { value: 'Conteo Físico', label: 'Ajuste por Conteo Físico' },
                            { value: 'Merma', label: 'Merma (Deterioro / Expiración)' },
                            { value: 'Robo', label: 'Robo / Pérdida no Justificada' },
                            { value: 'Devolución', label: 'Devolución de Cliente' },
                            { value: 'Entrada de Compra', label: 'Entrada de Mercancía' }
                          ]}
                          style={{ width: '100%' }}
                        />
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

                {/* CONTROL DE LOTES */}
                <div style={{
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  marginTop: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--brand-primary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={14} style={{ color: 'var(--brand-gold)' }} />
                      Control de Lotes y Expiración (FIFO)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddBatch}
                      className="btn-yellow"
                      style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px' }}
                    >
                      <Plus size={12} /> Agregar Lote
                    </button>
                  </div>
                  
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                          <th style={{ padding: '8px 12px', fontWeight: 800 }}>CÓDIGO LOTE</th>
                          <th style={{ padding: '8px 12px', fontWeight: 800 }}>EXPIRACIÓN</th>
                          <th style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'right' }}>CANTIDAD (STOCK)</th>
                          <th style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'center' }}>ELIMINAR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editBatches.map((batch, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '6px 12px' }}>
                              <input
                                type="text"
                                value={batch.loteCode}
                                onChange={(e) => handleBatchChange(index, 'loteCode', e.target.value.toUpperCase())}
                                className="search-input"
                                style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '11px', border: '1px solid var(--border-color)', width: '100%' }}
                                required
                              />
                            </td>
                            <td style={{ padding: '6px 12px' }}>
                              <CustomDatePicker
                                value={batch.expiryDate === 'N/A' ? '' : batch.expiryDate}
                                onChange={(val) => handleBatchChange(index, 'expiryDate', val || 'N/A')}
                                placeholder="Sin Exp."
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="any"
                                value={batch.stock}
                                onChange={(e) => handleBatchChange(index, 'stock', parseFloat(e.target.value) || 0)}
                                className="search-input"
                                style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '11px', border: '1px solid var(--border-color)', width: '85px', textAlign: 'right' }}
                                required
                              />
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveBatch(index)}
                                style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Fecha de Vencimiento Más Próxima
                    </label>
                    <input 
                      type="text" 
                      value={editForm.expiryDate || 'N/A'}
                      disabled
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', backgroundColor: 'var(--bg-primary)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
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

      {/* MODAL 5: KÁRDEX DE PRODUCTO */}
      {showKardexModal && kardexProduct && (
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
            maxWidth: '750px',
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
                <History size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Kárdex (Historial de Movimientos): {kardexProduct.name}
                </h4>
              </div>
              <button 
                onClick={() => { setShowKardexModal(false); setKardexProduct(null); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '12px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Código de Barras</span>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>{kardexProduct.code}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Existencia Actual</span>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--brand-primary)' }}>{kardexProduct.stock} {kardexProduct.unit}</div>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', borderBottom: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>FECHA / HORA</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>TIPO</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>REFERENCIA</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>CANT.</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>RESULTANTE</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>USUARIO</th>
                      <th style={{ padding: '10px 12px', fontWeight: 800 }}>DETALLE / MOTIVO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardexMovements.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                          No hay movimientos registrados para este producto.
                        </td>
                      </tr>
                    ) : (
                      kardexMovements.map((mov, index) => {
                        const isNegative = mov.qtyChange < 0;
                        const isCreation = mov.type === 'CREACIÓN';
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                              {new Date(mov.date).toLocaleString()}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span className={`status-badge ${isCreation ? 'delivered' : isNegative ? 'shipped' : 'pickup'}`} style={{ fontSize: '10px' }}>
                                {mov.type}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{mov.reference}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: isNegative ? '#ef4444' : '#22c55e' }}>
                              {isNegative ? '' : '+'}{mov.qtyChange}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>{mov.resultStock}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{mov.user}</td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{mov.justification}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => { setShowKardexModal(false); setKardexProduct(null); }}
                className="btn-yellow"
                style={{ padding: '8px 20px', borderRadius: 'var(--button-radius)' }}
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CARGA MASIVA DE INVENTARIO */}
      {showBulkModal && (
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
                <Sparkles size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Carga Masiva de Inventario (CSV)
                </h4>
              </div>
              <button 
                onClick={() => { setShowBulkModal(false); setCsvPreview([]); setCsvErrors([]); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                Exporte la plantilla del catálogo de productos actual o cargue un archivo CSV formateado para actualizar o añadir productos de manera masiva.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={handleExportCSV}
                  className="btn-pill-dark"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', borderRadius: '12px', border: '1.5px dashed var(--border-color)', cursor: 'pointer', backgroundColor: 'var(--bg-primary)' }}
                >
                  <ShoppingBag size={20} style={{ color: 'var(--brand-primary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Exportar Catálogo Actual</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Descarga archivo inventario.csv</span>
                </button>

                <label
                  className="btn-pill-dark"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px', borderRadius: '12px', border: '1.5px dashed var(--brand-gold)', cursor: 'pointer', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}
                >
                  <RefreshCw size={20} style={{ color: 'var(--brand-gold)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Seleccionar archivo CSV</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Carga o arrastra un .csv</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {/* Preview / Errors Section */}
              {(csvPreview.length > 0 || csvErrors.length > 0) && (
                <div style={{ border: '1.5px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <strong style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Resultados del Diagnóstico Local
                  </strong>

                  {csvErrors.length > 0 && (
                    <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 700, fontSize: '12px' }}>
                        <AlertCircle size={14} />
                        <span>Errores Encontrados en Archivo ({csvErrors.length}):</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '11.5px', color: 'var(--text-secondary)', maxHeight: '100px', overflowY: 'auto' }}>
                        {csvErrors.map((err, idx) => (
                          <li key={idx} style={{ marginBottom: '2px' }}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {csvPreview.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inserciones</span>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#22c55e' }}>+{csvStats.newProds}</div>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actualizaciones</span>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--brand-primary)' }}>{csvStats.updateProds}</div>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-input)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Filas</span>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{csvStats.total}</div>
                        </div>
                      </div>

                      {csvErrors.length === 0 && (
                        <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#22c55e', fontSize: '12px', fontWeight: 700 }}>
                          <Check size={16} />
                          <span>Archivo validado correctamente. ¡Listo para procesar importación local!</span>
                        </div>
                      )}

                      {/* Sub-tabla visual previsualización */}
                      <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '6px 8px' }}>CÓDIGO</th>
                              <th style={{ padding: '6px 8px' }}>NOMBRE</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>COSTO</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right' }}>PRECIO</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center' }}>CANT.</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center' }}>VENCE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.slice(0, 10).map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{row.code}</td>
                                <td style={{ padding: '6px 8px', fontWeight: 700 }}>{row.name}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>${row.cost}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>${row.price}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center' }}>{row.stock}</td>
                                <td style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{row.expiryDate}</td>
                              </tr>
                            ))}
                            {csvPreview.length > 10 && (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '6px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  ... y {csvPreview.length - 10} filas más.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => { setShowBulkModal(false); setCsvPreview([]); setCsvErrors([]); }}
                className="btn-pill-dark"
                style={{ padding: '8px 16px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={csvPreview.length === 0 || csvErrors.length > 0}
                className="btn-yellow"
                style={{ padding: '8px 20px', borderRadius: 'var(--button-radius)', cursor: (csvPreview.length === 0 || csvErrors.length > 0) ? 'not-allowed' : 'pointer', opacity: (csvPreview.length === 0 || csvErrors.length > 0) ? 0.45 : 1 }}
              >
                Confirmar Importación
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
