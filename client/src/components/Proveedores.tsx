import { useState, useEffect } from 'react';
import { Search, UserPlus, Mail, Phone, MapPin, Trash2, Edit, Check, AlertTriangle, AlertCircle, X, Briefcase, RefreshCw, CreditCard, DollarSign } from 'lucide-react';
import { useExchangeRate } from '../contexts/ExchangeRateContext';

interface ProveedoresProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  searchTerm?: string;
}

export interface Supplier {
  id: string;
  rif: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  paymentTerms: 'Contado' | 'Crédito 15 Días' | 'Crédito 30 Días';
  status: 'Activo' | 'Inactivo';
}

const STORAGE_KEY = 'stockmaster_suppliers_local';

export default function Proveedores({ searchTerm = '' }: ProveedoresProps) {
  const { dolarRate } = useExchangeRate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Supplier | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // C4: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [editSupplierForm, setEditSupplierForm] = useState({
    rif: '',
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    category: 'Alimentos',
    paymentTerms: 'Contado' as 'Contado' | 'Crédito 15 Días' | 'Crédito 30 Días',
  });

  // CxP (Cuentas por Pagar) states
  const [showCxPModal, setShowCxPModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [cxpTab, setCxPTab] = useState<'cxp' | 'history'>('cxp');
  const [pagoForm, setPagoForm] = useState({ amount: '', method: 'TRANSFERENCIA' });
  const [cxpMap, setCxPMap] = useState<Record<string, {
    balanceUSD: number;
    invoices: Array<{ ticket: string; date: string; total: number; paid: number; pending: number; status: 'Pendiente' | 'Pagado'; dueDate: string }>;
    payments: Array<{ id: string; date: string; amount: number; method: string }>;
  }>>({});

  // Form state
  const [newSupplier, setNewSupplier] = useState({
    rif: 'J-',
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    category: 'Alimentos',
    paymentTerms: 'Contado' as 'Contado' | 'Crédito 15 Días' | 'Crédito 30 Días',
  });

  const loadCxPData = () => {
    const saved = localStorage.getItem('stockmaster_supplier_credits_local');
    if (saved) {
      setCxPMap(JSON.parse(saved));
    } else {
      const initialMap: typeof cxpMap = {
        'J-00032991-2': {
          balanceUSD: 340.00,
          invoices: [
            { ticket: 'FC-HNZ-0892', date: '20/05/2026', total: 580.00, paid: 240.00, pending: 340.00, status: 'Pendiente', dueDate: '04/06/2026' }
          ],
          payments: [
            { id: 'pago_s01', date: '25/05/2026', amount: 240.00, method: 'TRANSFERENCIA' }
          ]
        },
        'J-30477401-2': {
          balanceUSD: 750.00,
          invoices: [
            { ticket: 'FC-LAC-1104', date: '01/05/2026', total: 1200.00, paid: 450.00, pending: 750.00, status: 'Pendiente', dueDate: '31/05/2026' },
            { ticket: 'FC-LAC-1089', date: '18/04/2026', total: 320.00, paid: 320.00, pending: 0.00, status: 'Pagado', dueDate: '18/05/2026' }
          ],
          payments: [
            { id: 'pago_s02', date: '10/05/2026', amount: 450.00, method: 'TRANSFERENCIA' },
            { id: 'pago_s03', date: '28/04/2026', amount: 320.00, method: 'EFECTIVO' }
          ]
        },
        'J-00006572-4': {
          balanceUSD: 0.00,
          invoices: [
            { ticket: 'FC-PLR-4421', date: '28/05/2026', total: 450.00, paid: 450.00, pending: 0.00, status: 'Pagado', dueDate: 'Contado' }
          ],
          payments: [
            { id: 'pago_s04', date: '28/05/2026', amount: 450.00, method: 'EFECTIVO' }
          ]
        }
      };
      setCxPMap(initialMap);
      localStorage.setItem('stockmaster_supplier_credits_local', JSON.stringify(initialMap));
    }
  };

  const loadSuppliers = () => {
    setIsRefreshing(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSuppliers(JSON.parse(saved));
      } else {
        // Seed default high-fidelity Venezuelan suppliers
        seedMockSuppliers();
      }
    } catch (err) {
      console.error('Error loading suppliers:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const seedMockSuppliers = () => {
    const mock: Supplier[] = [
      {
        id: 'sup_01',
        rif: 'J-00006572-4',
        companyName: 'Cervecería Polar C.A.',
        contactName: 'Lorenzo Mendoza',
        email: 'ventas@polar.com',
        phone: '0212-2023333',
        address: 'Zona Industrial de Los Cortijos de Lourdes, Caracas, Miranda',
        category: 'Bebidas',
        paymentTerms: 'Contado',
        status: 'Activo'
      },
      {
        id: 'sup_02',
        rif: 'J-00032991-2',
        companyName: 'Alimentos Heinz de Venezuela C.A.',
        contactName: 'Patricia Salas',
        email: 'heinz.ventas@heinz.com.ve',
        phone: '0241-8740122',
        address: 'Zona Industrial de Valencia, Edo. Carabobo',
        category: 'Alimentos',
        paymentTerms: 'Crédito 15 Días',
        status: 'Activo'
      },
      {
        id: 'sup_03',
        rif: 'J-30477401-2',
        companyName: 'Lácteos Los Andes C.A.',
        contactName: 'Humberto Silva',
        email: 'losandes@lacteos.gob.ve',
        phone: '0251-2864010',
        address: 'Av. Las Industrias, Barquisimeto, Edo. Lara',
        category: 'Lácteos',
        paymentTerms: 'Crédito 30 Días',
        status: 'Activo'
      }
    ];

    setSuppliers(mock);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mock));
  };

  useEffect(() => {
    loadSuppliers();
    loadCxPData();
  }, []);

  const activeSearch = searchTerm || localSearchTerm;

  const filteredSuppliers = suppliers.filter(s => 
    s.companyName.toLowerCase().includes(activeSearch.toLowerCase()) ||
    s.rif.toLowerCase().includes(activeSearch.toLowerCase()) ||
    s.contactName.toLowerCase().includes(activeSearch.toLowerCase()) ||
    s.category.toLowerCase().includes(activeSearch.toLowerCase())
  );

  // C4: Pagination - reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [activeSearch]);
  const totalPages = Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE);
  const paginatedSuppliers = filteredSuppliers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleViewCxPClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setCxPTab('cxp');
    setPagoForm({ amount: '', method: 'TRANSFERENCIA' });
    setShowCxPModal(true);
  };

  const handleRegisterPago = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    const supplierRIF = selectedSupplier.rif;
    const amountVal = parseFloat(pagoForm.amount) || 0;
    if (amountVal <= 0) {
      setAlertConfig({
        title: 'Monto Inválido',
        message: 'Por favor ingrese un monto de pago mayor a cero.',
        type: 'info'
      });
      return;
    }

    const supplierData = cxpMap[supplierRIF] || { balanceUSD: 0, invoices: [], payments: [] };
    if (amountVal > supplierData.balanceUSD) {
      setAlertConfig({
        title: 'Excedente Detectado',
        message: `El pago de $${amountVal.toFixed(2)} excede el saldo adeudado total al proveedor ($${supplierData.balanceUSD.toFixed(2)}).`,
        type: 'info'
      });
      return;
    }

    // Amortizar sobre las facturas pendientes
    let remainingPago = amountVal;
    const nextInvoices = supplierData.invoices.map(inv => {
      if (inv.pending > 0 && remainingPago > 0) {
        const paymentToApply = Math.min(inv.pending, remainingPago);
        const newPaid = inv.paid + paymentToApply;
        const newPending = inv.pending - paymentToApply;
        remainingPago -= paymentToApply;
        return {
          ...inv,
          paid: Number(newPaid.toFixed(2)),
          pending: Number(newPending.toFixed(2)),
          status: newPending === 0 ? 'Pagado' as const : 'Pendiente' as const
        };
      }
      return inv;
    });

    const newPayment = {
      id: 'pago_sup_' + Date.now(),
      date: new Date().toLocaleDateString('es-VE'),
      amount: amountVal,
      method: pagoForm.method
    };

    const nextSupplierData = {
      balanceUSD: Number((supplierData.balanceUSD - amountVal).toFixed(2)),
      invoices: nextInvoices,
      payments: [newPayment, ...supplierData.payments]
    };

    const nextMap = {
      ...cxpMap,
      [supplierRIF]: nextSupplierData
    };

    setCxPMap(nextMap);
    localStorage.setItem('stockmaster_supplier_credits_local', JSON.stringify(nextMap));

    // Guardar en bitácora local de auditoría
    const newAuditLog = {
      id: 'local_log_' + crypto.randomUUID(),
      action: 'CXP_PAGO_PROVEEDOR',
      details: JSON.stringify({
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.companyName,
        rif: supplierRIF,
        pagoAmountUSD: amountVal,
        paymentMethod: pagoForm.method,
        remainingBalanceUSD: nextSupplierData.balanceUSD
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

    setPagoForm({ amount: '', method: 'TRANSFERENCIA' });
    setShowSuccessToast(`Pago de $${amountVal.toFixed(2)} a ${selectedSupplier.companyName} registrado exitosamente.`);
    setTimeout(() => setShowSuccessToast(null), 3500);
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplier.rif || !newSupplier.companyName) {
      setAlertConfig({
        title: 'Campos Obligatorios',
        message: 'Por favor complete los campos obligatorios: RIF y Razón Social.',
        type: 'info'
      });
      return;
    }

    const cleanedRif = newSupplier.rif.trim().toUpperCase();
    const existing = suppliers.find(s => s.rif === cleanedRif);
    if (existing) {
      setAlertConfig({
        title: 'Proveedor Existente',
        message: 'Este Proveedor ya se encuentra registrado con este RIF.',
        type: 'error'
      });
      return;
    }

    const supplierToAdd: Supplier = {
      id: 'sup_' + Date.now(),
      rif: cleanedRif,
      companyName: newSupplier.companyName.trim(),
      contactName: newSupplier.contactName.trim() || 'N/A',
      email: newSupplier.email.trim() || 'N/A',
      phone: newSupplier.phone.trim() || 'N/A',
      address: newSupplier.address.trim() || 'Venezuela',
      category: newSupplier.category,
      paymentTerms: newSupplier.paymentTerms,
      status: 'Activo'
    };

    const nextList = [...suppliers, supplierToAdd];
    setSuppliers(nextList);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));

    setShowAddModal(false);
    setNewSupplier({
      rif: 'J-',
      companyName: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      category: 'Alimentos',
      paymentTerms: 'Contado',
    });

    setShowSuccessToast('Proveedor registrado exitosamente en la base de datos local.');
    setTimeout(() => setShowSuccessToast(null), 3500);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setEditSupplierForm({
      rif: supplier.rif,
      companyName: supplier.companyName,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      category: supplier.category,
      paymentTerms: supplier.paymentTerms,
    });
    setShowEditModal(true);
  };

  const handleSaveEditSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplierForm.companyName) {
      setAlertConfig({
        title: 'Campos Obligatorios',
        message: 'Por favor complete el nombre de la empresa.',
        type: 'info'
      });
      return;
    }

    const updated = suppliers.map(s => {
      if (s.id === editingSupplier?.id) {
        return {
          ...s,
          companyName: editSupplierForm.companyName.trim(),
          contactName: editSupplierForm.contactName.trim(),
          email: editSupplierForm.email.trim(),
          phone: editSupplierForm.phone.trim(),
          address: editSupplierForm.address.trim(),
          category: editSupplierForm.category,
          paymentTerms: editSupplierForm.paymentTerms,
        };
      }
      return s;
    });

    setSuppliers(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setShowEditModal(false);
    setEditingSupplier(null);
    setShowSuccessToast('Proveedor actualizado exitosamente.');
    setTimeout(() => setShowSuccessToast(null), 3000);
  };

  const handleDeleteSupplier = () => {
    if (!showDeleteConfirm) return;

    const nextList = suppliers.filter(s => s.id !== showDeleteConfirm.id);
    setSuppliers(nextList);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));

    setShowDeleteConfirm(null);
    setShowSuccessToast('Proveedor eliminado correctamente.');
    setTimeout(() => setShowSuccessToast(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: CABECERA Y CONTROLES */}
      <div className="widget" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          
          {/* Título */}
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-main)' }}>
              🚚 Directorio de Proveedores Comerciales
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Catálogo de suministros mayoristas, plazos de crédito de inventarios y datos de cobros.
            </p>
          </div>

          {/* Controles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            
            {/* Buscador local */}
            {!searchTerm && (
              <div className="search-container" style={{ width: '260px', height: '40px' }}>
                <Search className="search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar por RIF, proveedor, insumo..." 
                  className="search-input" 
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                />
              </div>
            )}

            <button 
              onClick={() => setShowAddModal(true)}
              className="btn-yellow"
              style={{ gap: '8px', padding: '10px 18px', borderRadius: 'var(--button-radius)' }}
            >
              <UserPlus size={16} />
              <span>Nuevo Proveedor</span>
            </button>

            <button 
              onClick={loadSuppliers}
              disabled={isRefreshing}
              className="btn-pill-dark"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', cursor: isRefreshing ? 'not-allowed' : 'pointer' }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            </button>
          </div>

        </div>
      </div>

      {/* TOAST NOTIFICATION */}
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

      {/* SECCIÓN 2: TABLA DE PROVEEDORES */}
      <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
        <div className="details-table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>RIF FISCAL</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>RAZÓN SOCIAL (EMPRESA)</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>CONTACTO AUTORIZADO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>TELÉFONO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>CORREO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>DIRECCIÓN INDUSTRIAL</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>CRÉDITO / PAGO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>INSUMOS</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    No se encontraron proveedores registrados en el sistema.
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((sup) => {
                  return (
                    <tr key={sup.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                        {sup.rif}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {sup.companyName}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sup.contactName}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Phone size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{sup.phone}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Mail size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{sup.email}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '11.5px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sup.address}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span>{sup.address}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 800, 
                          color: sup.paymentTerms === 'Contado' ? '#22c55e' : '#a855f7', 
                          backgroundColor: sup.paymentTerms === 'Contado' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(168, 85, 247, 0.1)', 
                          padding: '2px 8px', 
                          borderRadius: '50px' 
                        }}>
                          {sup.paymentTerms}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '2px 8px', borderRadius: '6px' }}>
                          {sup.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleViewCxPClick(sup)}
                            className="btn-pill-dark"
                            style={{ 
                              padding: '4px 8px', 
                              borderRadius: '6px', 
                              height: '24px', 
                              backgroundColor: 'rgba(168, 85, 247, 0.1)', 
                              color: '#a855f7',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px',
                              fontWeight: 800
                            }}
                            title="Ver Cuentas por Pagar"
                          >
                            <CreditCard size={11} />
                            <span>CxP</span>
                          </button>
                          <button
                            onClick={() => handleEditSupplier(sup)}
                            className="btn-pill-dark"
                            style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'var(--bg-input)' }}
                            title="Editar Datos"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(sup)}
                            className="btn-pill-dark"
                            style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                            title="Eliminar Proveedor"
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

      {/* MODAL MODULAR 1: NUEVO PROVEEDOR */}
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
          
          <div className="widget" style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'entrance 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            
            {/* Cabecera */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Briefcase size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Registrar Nuevo Proveedor
                </h4>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleAddSupplier}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      RIF Fiscal *
                    </label>
                    <input 
                      type="text" 
                      value={newSupplier.rif}
                      onChange={(e) => setNewSupplier({ ...newSupplier, rif: e.target.value })}
                      placeholder="Ej: J-00006572-4"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', fontFamily: 'monospace' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Razón Social *
                    </label>
                    <input 
                      type="text" 
                      value={newSupplier.companyName}
                      onChange={(e) => setNewSupplier({ ...newSupplier, companyName: e.target.value })}
                      placeholder="Ej: Cervecería Polar C.A."
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Persona de Contacto
                    </label>
                    <input 
                      type="text" 
                      value={newSupplier.contactName}
                      onChange={(e) => setNewSupplier({ ...newSupplier, contactName: e.target.value })}
                      placeholder="Ej: Lorenzo Mendoza"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Teléfono
                    </label>
                    <input 
                      type="text" 
                      value={newSupplier.phone}
                      onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                      placeholder="Ej: 0212-2023333"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Correo Electrónico
                    </label>
                    <input 
                      type="email" 
                      value={newSupplier.email}
                      onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                      placeholder="ventas@polar.com"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Plazos de Crédito
                    </label>
                    <select 
                      value={newSupplier.paymentTerms}
                      onChange={(e) => setNewSupplier({ ...newSupplier, paymentTerms: e.target.value as any })}
                      className="dropdown-select"
                      style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                    >
                      <option value="Contado">Pago de Contado</option>
                      <option value="Crédito 15 Días">Crédito 15 Días</option>
                      <option value="Crédito 30 Días">Crédito 30 Días</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Categoría de Insumos
                  </label>
                  <select 
                    value={newSupplier.category}
                    onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })}
                    className="dropdown-select"
                    style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                  >
                    <option value="Alimentos">Alimentos y Víveres</option>
                    <option value="Bebidas">Bebidas y Licores</option>
                    <option value="Lácteos">Lácteos y Charcutería</option>
                    <option value="Confitería">Confitería y Dulces</option>
                    <option value="Limpieza">Artículos de Limpieza</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Dirección Fiscal / Distribuidora
                  </label>
                  <textarea 
                    value={newSupplier.address}
                    onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    placeholder="Ej: Zona Industrial Los Cortijos de Lourdes, Transversal 4. Caracas, Miranda."
                    className="search-input"
                    rows={2}
                    style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', height: 'auto', resize: 'none', fontSize: '12.5px' }}
                  />
                </div>

              </div>

              {/* Botones */}
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
                  Registrar Proveedor
                </button>
              </div>
            </form>

          </div>

        </div>
      )}

      {/* MODAL MODULAR 1B: EDITAR PROVEEDOR */}
      {showEditModal && (
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
          
          <div className="widget" style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'entrance 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            
            {/* Cabecera */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Editar Proveedor
                </h4>
              </div>
              <button 
                onClick={() => { setShowEditModal(false); setEditingSupplier(null); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveEditSupplier}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      RIF
                    </label>
                    <input 
                      type="text" 
                      value={editSupplierForm.rif}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', fontFamily: 'monospace', backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' }}
                      disabled
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Razón Social / Empresa *
                    </label>
                    <input 
                      type="text" 
                      value={editSupplierForm.companyName}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, companyName: e.target.value })}
                      placeholder="Ej: Distribuidora Polar C.A."
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Nombre de Contacto
                    </label>
                    <input 
                      type="text" 
                      value={editSupplierForm.contactName}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, contactName: e.target.value })}
                      placeholder="Ej: Juan Pérez"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Teléfono
                    </label>
                    <input 
                      type="text" 
                      value={editSupplierForm.phone}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, phone: e.target.value })}
                      placeholder="Ej: 0212-1234567"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Correo Electrónico
                    </label>
                    <input 
                      type="email" 
                      value={editSupplierForm.email}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, email: e.target.value })}
                      placeholder="proveedor@empresa.com"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Condiciones de Pago
                    </label>
                    <select 
                      value={editSupplierForm.paymentTerms}
                      onChange={(e) => setEditSupplierForm({ ...editSupplierForm, paymentTerms: e.target.value as any })}
                      className="dropdown-select"
                      style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' }}
                      disabled
                    >
                      <option value="Contado">Pago de Contado</option>
                      <option value="Crédito 15 Días">Crédito 15 Días</option>
                      <option value="Crédito 30 Días">Crédito 30 Días</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Categoría de Insumos
                  </label>
                  <select 
                    value={editSupplierForm.category}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, category: e.target.value })}
                    className="dropdown-select"
                    style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                  >
                    <option value="Alimentos">Alimentos y Víveres</option>
                    <option value="Bebidas">Bebidas y Licores</option>
                    <option value="Lácteos">Lácteos y Charcutería</option>
                    <option value="Confitería">Confitería y Dulces</option>
                    <option value="Limpieza">Artículos de Limpieza</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Dirección Fiscal / Distribuidora
                  </label>
                  <textarea 
                    value={editSupplierForm.address}
                    onChange={(e) => setEditSupplierForm({ ...editSupplierForm, address: e.target.value })}
                    placeholder="Ej: Zona Industrial..."
                    className="search-input"
                    rows={2}
                    style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', height: 'auto', resize: 'none', fontSize: '12.5px' }}
                  />
                </div>

              </div>

              {/* Botones */}
              <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingSupplier(null); }}
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

      {/* MODAL MODULAR 2: ELIMINAR PROVEEDOR */}
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
          
          <div className="widget" style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid rgba(239, 68, 68, 0.2)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'entrance 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '14px', borderRadius: '50%', color: '#ef4444' }}>
                <AlertTriangle size={32} />
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                  ¿Confirmar Eliminación de Proveedor?
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Estás a punto de eliminar a <strong>{showDeleteConfirm.companyName}</strong> (RIF: {showDeleteConfirm.rif}) de la base de datos local. Esta acción es irreversible.
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
                onClick={handleDeleteSupplier}
                className="btn-yellow"
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--button-radius)', backgroundColor: '#ef4444', color: '#fff', border: '1.5px solid #ef4444', justifyContent: 'center' }}
              >
                Eliminar Proveedor
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

      {/* MODAL 4: FICHA DE CUENTAS POR PAGAR (CxP) */}
      {showCxPModal && selectedSupplier && (
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
            maxWidth: '700px',
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
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '2px 8px', borderRadius: '50px', display: 'inline-block', marginBottom: '6px' }}>
                  EXPEDIENTE DE CUENTAS POR PAGAR (CXP)
                </span>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedSupplier.companyName}
                </h4>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  RIF: {selectedSupplier.rif} · Plazo: {selectedSupplier.paymentTerms} · Contacto: {selectedSupplier.contactName}
                </p>
              </div>
              <button 
                onClick={() => { setShowCxPModal(false); setSelectedSupplier(null); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de Pestañas */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => setCxPTab('cxp')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  borderBottom: cxpTab === 'cxp' ? '3px solid #a855f7' : 'none',
                  backgroundColor: 'transparent',
                  color: cxpTab === 'cxp' ? '#a855f7' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                Cuentas por Pagar
              </button>
              <button
                onClick={() => setCxPTab('history')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  borderBottom: cxpTab === 'history' ? '3px solid #a855f7' : 'none',
                  backgroundColor: 'transparent',
                  color: cxpTab === 'history' ? '#a855f7' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                Historial de Pagos Emitidos
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '12.5px' }}>
              
              {/* PESTAÑA 1: CUENTAS POR PAGAR */}
              {cxpTab === 'cxp' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Balance Widget */}
                  <div style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Deuda Pendiente Total
                      </span>
                      <strong style={{ fontSize: '24px', display: 'block', color: (cxpMap[selectedSupplier.rif]?.balanceUSD || 0) > 0 ? '#f59e0b' : '#22c55e', marginTop: '2px', fontWeight: 850 }}>
                        ${(cxpMap[selectedSupplier.rif]?.balanceUSD || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Equivalente VES BCV
                      </span>
                      <strong style={{ fontSize: '16px', display: 'block', color: 'var(--brand-gold)', marginTop: '4px', fontFamily: 'monospace' }}>
                        Bs. {((cxpMap[selectedSupplier.rif]?.balanceUSD || 0) * dolarRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  {/* Facturas de Compra Pendientes */}
                  <div>
                    <h5 style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Facturas de Compra a Crédito
                    </h5>
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1.5px solid var(--border-color)', borderRadius: '12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '10.5px', fontWeight: 800 }}>
                            <th style={{ padding: '8px 12px' }}>FACTURA</th>
                            <th style={{ padding: '8px 12px' }}>FECHA</th>
                            <th style={{ padding: '8px 12px' }}>VENCE</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>TOTAL</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>PAGADO</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>PENDIENTE</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>ESTADO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!cxpMap[selectedSupplier.rif]?.invoices || cxpMap[selectedSupplier.rif].invoices.length === 0) ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                                Sin facturas de compra registradas para este proveedor.
                              </td>
                            </tr>
                          ) : (
                            cxpMap[selectedSupplier.rif].invoices.map((inv, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '11.5px' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 800, fontFamily: 'monospace', color: '#a855f7' }}>{inv.ticket}</td>
                                <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{inv.date}</td>
                                <td style={{ padding: '8px 12px', color: inv.dueDate === 'Contado' ? '#22c55e' : 'var(--text-secondary)', fontWeight: 700, fontSize: '10.5px' }}>{inv.dueDate}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>${inv.total.toFixed(2)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>${inv.paid.toFixed(2)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#f59e0b', fontWeight: 800 }}>${inv.pending.toFixed(2)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <span style={{ 
                                    fontSize: '9px', 
                                    padding: '1px 6px', 
                                    borderRadius: '50px',
                                    fontWeight: 800,
                                    color: inv.status === 'Pagado' ? '#22c55e' : '#f59e0b',
                                    backgroundColor: inv.status === 'Pagado' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)'
                                  }}>
                                    {inv.status}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Formulario Registrar Pago */}
                  {(cxpMap[selectedSupplier.rif]?.balanceUSD || 0) > 0 && (
                    <form onSubmit={handleRegisterPago} style={{
                      backgroundColor: 'rgba(168, 85, 247, 0.04)',
                      border: '1.5px solid rgba(168, 85, 247, 0.15)',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7' }}>
                        <DollarSign size={16} />
                        <strong style={{ fontSize: '12px', fontWeight: 800 }}>REGISTRAR PAGO A PROVEEDOR</strong>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', alignItems: 'flex-end' }}>
                        <div>
                          <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '9px' }}>
                            Monto a Pagar ($ USD) *
                          </label>
                          <input 
                            type="number"
                            step="0.01"
                            value={pagoForm.amount}
                            onChange={(e) => setPagoForm({ ...pagoForm, amount: e.target.value })}
                            placeholder="0.00"
                            className="search-input"
                            style={{ padding: '8px 12px', borderRadius: '10px', border: '1.5px solid var(--border-color)', width: '100%' }}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '9px' }}>
                            Método de Pago *
                          </label>
                          <select
                            value={pagoForm.method}
                            onChange={(e) => setPagoForm({ ...pagoForm, method: e.target.value })}
                            className="dropdown-select"
                            style={{ width: '100%', padding: '8px', height: '36px', borderRadius: '10px' }}
                          >
                            <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                            <option value="EFECTIVO">Efectivo USD</option>
                            <option value="PAGO_MOVIL">Pago Móvil VES</option>
                            <option value="CHEQUE">Cheque Bancario</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="btn-yellow"
                          style={{
                            height: '36px',
                            justifyContent: 'center',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 800
                          }}
                        >
                          Aplicar Pago
                        </button>
                      </div>
                    </form>
                  )}

                </div>
              )}

              {/* PESTAÑA 2: HISTORIAL DE PAGOS EMITIDOS */}
              {cxpTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h5 style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-primary)', margin: 0 }}>
                    Bitácora de Pagos Emitidos al Proveedor
                  </h5>
                  
                  <div style={{ border: '1.5px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '10.5px', fontWeight: 800 }}>
                          <th style={{ padding: '8px 12px' }}>FECHA Y HORA</th>
                          <th style={{ padding: '8px 12px' }}>MÉTODO DE PAGO</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>MONTO PAGADO</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>IDENTIFICADOR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!cxpMap[selectedSupplier.rif]?.payments || cxpMap[selectedSupplier.rif].payments.length === 0) ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                              No se han registrado pagos para este proveedor.
                            </td>
                          </tr>
                        ) : (
                          cxpMap[selectedSupplier.rif].payments.map((pay, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '11.5px' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 700 }}>{pay.date}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ 
                                  fontSize: '10px', 
                                  fontWeight: 800, 
                                  color: pay.method === 'EFECTIVO' ? '#22c55e' : pay.method === 'TRANSFERENCIA' ? '#3b82f6' : pay.method === 'CHEQUE' ? '#f59e0b' : '#a855f7', 
                                  backgroundColor: pay.method === 'EFECTIVO' ? 'rgba(34,197,94,0.1)' : pay.method === 'TRANSFERENCIA' ? 'rgba(59,130,246,0.1)' : pay.method === 'CHEQUE' ? 'rgba(245,158,11,0.1)' : 'rgba(168,85,247,0.1)', 
                                  padding: '2px 8px', 
                                  borderRadius: '50px' 
                                }}>
                                  {pay.method.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>${pay.amount.toFixed(2)}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '10px' }}>{pay.id}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => { setShowCxPModal(false); setSelectedSupplier(null); }}
                className="btn-pill-dark"
                style={{ padding: '8px 20px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)' }}
              >
                Cerrar Expediente
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
