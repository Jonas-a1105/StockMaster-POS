import { useState, useEffect } from 'react';
import { Search, UserPlus, Mail, Phone, MapPin, Trash2, Edit, Check, AlertTriangle, AlertCircle, RefreshCw, X, CreditCard, DollarSign, Info } from 'lucide-react';
import { getDatabase, type ClientDocType } from '../db/database';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';
import CustomSelect from './CustomSelect';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { logAuditEvent } from '../utils/audit';

interface ClientesProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  searchTerm?: string;
}

// Extends RxDB doc type with local UI properties
interface CustomClient extends ClientDocType {
  rif: string; // Stored as RIF or ID
  address: string;
  clientType: 'Regular' | 'Mayorista';
  status: 'Activo' | 'Inactivo';
}

export default function Clientes({ searchTerm = '', user }: ClientesProps) {
  const isAdmin = user.role === 'ADMIN';
  const { validateRIF, formatRIF } = useBusinessSettings();
  const { dolarRate } = useExchangeRate();
  const [clients, setClients] = useState<CustomClient[]>([]);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<CustomClient | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<CustomClient | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

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

  const [editClientForm, setEditClientForm] = useState({
    rif: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    clientType: 'Regular' as 'Regular' | 'Mayorista',
  });

  // Credit & Accounts Receivable (CxC) states
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<CustomClient | null>(null);
  const [creditTab, setCreditTab] = useState<'history' | 'cxc'>('cxc');
  const [abonoForm, setAbonoForm] = useState({ amount: '', method: 'EFECTIVO' });
  const [creditsMap, setCreditsMap] = useState<Record<string, {
    balanceUSD: number;
    invoices: Array<{ ticket: string; date: string; total: number; paid: number; pending: number; status: 'Pendiente' | 'Pagado' }>;
    payments: Array<{ id: string; date: string; amount: number; method: string }>;
  }>>({});

  const loadCreditsData = () => {
    const saved = localStorage.getItem('stockmaster_client_credits_local');
    if (saved) {
      setCreditsMap(JSON.parse(saved));
    }
  };

  // Form state
  const [newClient, setNewClient] = useState({
    rif: 'V-',
    name: '',
    email: '',
    phone: '',
    address: '',
    clientType: 'Regular' as 'Regular' | 'Mayorista',
  });

  const loadClients = async () => {
    setIsRefreshing(true);
    try {
      const db = await getDatabase();
      const allClientsDocs = await db.clients.find().exec();
      
      const mapped: CustomClient[] = allClientsDocs.map(doc => {
        const json = doc.toJSON();
        return {
          id: json.id,
          rif: json.id,
          name: json.name,
          email: json.email || 'N/A',
          phone: json.phone || 'N/A',
          address: 'Venezuela',
          clientType: 'Regular',
          status: 'Activo',
          updatedAt: json.updatedAt
        };
      });

      setClients(mapped);
    } catch (err) {
      console.error('Error al cargar clientes de base local:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  useEffect(() => {
    loadClients();
    loadCreditsData();

    let sub: any;
    getDatabase().then(db => {
      sub = db.clients.find().$.subscribe(() => {
        loadClients();
      });
    });

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  const activeSearch = searchTerm || localSearchTerm;
  
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(activeSearch.toLowerCase()) ||
    c.rif.toLowerCase().includes(activeSearch.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(activeSearch.toLowerCase()) ||
    (c.phone || '').includes(activeSearch)
  );

  // C4: Pagination - reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [activeSearch]);
  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = filteredClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newClient.rif || !newClient.name) {
      setAlertConfig({
        title: 'Campos Obligatorios',
        message: 'Por favor complete los campos obligatorios: RIF/Cédula y Razón Social.',
        type: 'info'
      });
      return;
    }

    if (!validateRIF(newClient.rif)) {
      setAlertConfig({
        title: 'RIF / Cédula Inválida',
        message: 'Por favor ingrese un RIF de Venezuela estructurado correctamente (ej. J-40812991-0 o V-12345678-9).',
        type: 'error'
      });
      return;
    }

    try {
      const db = await getDatabase();
      const existing = await db.clients.findOne({ selector: { id: newClient.rif } }).exec();
      if (existing) {
        setAlertConfig({
          title: 'Cliente Existente',
          message: 'Este Cliente ya se encuentra registrado con este RIF/Cédula.',
          type: 'error'
        });
        return;
      }

      await db.clients.insert({
        id: newClient.rif.trim().toUpperCase(),
        name: newClient.name.trim(),
        email: newClient.email.trim() || undefined,
        phone: newClient.phone.trim() || undefined,
        updatedAt: new Date().toISOString()
      });

      logAuditEvent(user, 'CLIENTE_CREAR', {
        name: newClient.name.trim(),
        phone: newClient.phone.trim() || undefined
      });

      setShowAddModal(false);
      setNewClient({
        rif: 'V-',
        name: '',
        email: '',
        phone: '',
        address: '',
        clientType: 'Regular',
      });

      // Show Premium Toast
      setShowSuccessToast('Cliente registrado exitosamente en la base de datos local.');
      setTimeout(() => setShowSuccessToast(null), 3500);

      loadClients();
    } catch (err) {
      console.error('Error adding client:', err);
      setAlertConfig({
        title: 'Error de Servidor',
        message: 'Ocurrió un error al registrar el cliente en la base local.',
        type: 'error'
      });
    }
  };

  const handleEditClient = (client: CustomClient) => {
    if (!isAdmin) return;
    setEditingClient(client);
    setEditClientForm({
      rif: client.rif,
      name: client.name,
      email: (client.email && client.email !== 'N/A') ? client.email : '',
      phone: (client.phone && client.phone !== 'N/A') ? client.phone : '',
      address: client.address === 'Distrito Capital, Caracas, Venezuela' ? '' : client.address,
      clientType: client.clientType,
    });
    setShowEditModal(true);
  };

  const handleSaveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!editClientForm.name) {
      setAlertConfig({
        title: 'Campos Obligatorios',
        message: 'Por favor complete el nombre.',
        type: 'info'
      });
      return;
    }

    try {
      const db = await getDatabase();
      const doc = await db.clients.findOne({ selector: { id: editingClient?.id } }).exec();
      if (doc) {
        await doc.update({
          $set: {
            name: editClientForm.name.trim(),
            email: editClientForm.email.trim() || undefined,
            phone: editClientForm.phone.trim() || undefined,
            updatedAt: new Date().toISOString()
          }
        });
        
        logAuditEvent(user, 'CLIENTE_EDITAR', {
          id: editingClient?.id,
          name: editClientForm.name.trim()
        });

        setShowEditModal(false);
        setEditingClient(null);
        setShowSuccessToast('Cliente actualizado correctamente.');
        setTimeout(() => setShowSuccessToast(null), 3000);
        loadClients();
      }
    } catch (err) {
      console.error('Error updating client:', err);
      setAlertConfig({
        title: 'Error de Actualización',
        message: 'No se pudo actualizar el cliente.',
        type: 'error'
      });
    }
  };

  const handleDeleteClient = async () => {
    if (!isAdmin) return;
    if (!showDeleteConfirm) return;

    try {
      const db = await getDatabase();
      const doc = await db.clients.findOne({ selector: { id: showDeleteConfirm.id } }).exec();
      if (doc) {
        await doc.remove();

        logAuditEvent(user, 'CLIENTE_ELIMINAR', {
          id: showDeleteConfirm.id
        });

        setShowDeleteConfirm(null);
        
        setShowSuccessToast('Cliente eliminado correctamente de la base de datos.');
        setTimeout(() => setShowSuccessToast(null), 3000);
        
        loadClients();
      }
    } catch (err) {
      console.error('Error deleting client:', err);
      setAlertConfig({
        title: 'Error de Eliminación',
        message: 'No se pudo eliminar el cliente seleccionado.',
        type: 'error'
      });
    }
  };

  const handleViewCreditClick = (client: CustomClient) => {
    setSelectedClient(client);
    setCreditTab('cxc');
    setAbonoForm({ amount: '', method: 'EFECTIVO' });
    setShowCreditModal(true);
  };

  const handleRegisterAbono = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!selectedClient) return;

    const clientRIF = selectedClient.rif;
    const amountVal = parseFloat(abonoForm.amount) || 0;
    if (amountVal <= 0) {
      setAlertConfig({
        title: 'Monto Inválido',
        message: 'Por favor ingrese un monto de abono mayor a cero.',
        type: 'info'
      });
      return;
    }

    const clientData = creditsMap[clientRIF] || { balanceUSD: 0, invoices: [], payments: [] };
    if (amountVal > clientData.balanceUSD) {
      setAlertConfig({
        title: 'Excedente Detectado',
        message: `El abono de $${amountVal.toFixed(2)} excede el saldo deudor total del cliente ($${clientData.balanceUSD.toFixed(2)}).`,
        type: 'info'
      });
      return;
    }

    // Amortizar sobre las facturas pendientes
    let remainingAbono = amountVal;
    const nextInvoices = clientData.invoices.map(inv => {
      if (inv.pending > 0 && remainingAbono > 0) {
        const paymentToApply = Math.min(inv.pending, remainingAbono);
        const newPaid = inv.paid + paymentToApply;
        const newPending = inv.pending - paymentToApply;
        remainingAbono -= paymentToApply;
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
      id: 'pay_' + Date.now(),
      date: new Date().toLocaleDateString('es-VE'),
      amount: amountVal,
      method: abonoForm.method
    };

    const nextClientData = {
      balanceUSD: Number((clientData.balanceUSD - amountVal).toFixed(2)),
      invoices: nextInvoices,
      payments: [newPayment, ...clientData.payments]
    };

    const nextMap = {
      ...creditsMap,
      [clientRIF]: nextClientData
    };

    setCreditsMap(nextMap);
    localStorage.setItem('stockmaster_client_credits_local', JSON.stringify(nextMap));

    logAuditEvent(user, 'POS_ABONO_CREDITO_CLIENTE', {
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      amount: amountVal,
      paymentMethod: abonoForm.method
    });

    setAbonoForm({ amount: '', method: 'EFECTIVO' });
    setShowSuccessToast(`Abono de $${amountVal.toFixed(2)} registrado exitosamente.`);
    setTimeout(() => setShowSuccessToast(null), 3500);
  };

  return (
    <div className="view-container-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: CABECERA Y FILTROS */}
      <div className="widget view-header-widget" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="info-tooltip-wrapper">
              <Info size={18} className="info-tooltip-icon" style={{ color: 'var(--text-secondary)', cursor: 'help', opacity: 0.8 }} />
              <span className="tooltip-text">
                Base de datos integrada para la facturación fiscal de compras, ventas al mayor y control comercial.
              </span>
            </div>
            <span className="view-header-pill pill-teal">
              {clients.length} Clientes
            </span>
            {Object.values(creditsMap).filter(c => c.balanceUSD > 0).length > 0 && (
              <span className="view-header-pill pill-yellow">
                {Object.values(creditsMap).filter(c => c.balanceUSD > 0).length} Con Deuda
              </span>
            )}
          </div>

          {/* Controles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            
            {/* Buscador local */}
            {!searchTerm && (
              <div className="search-container" style={{ width: '260px', height: '40px' }}>
                <Search className="search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar RIF, Cédula o nombre..." 
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
              <span>Nuevo Cliente</span>
            </button>

            <button 
              onClick={loadClients}
              disabled={isRefreshing}
              className="btn-pill-dark"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', cursor: isRefreshing ? 'not-allowed' : 'pointer' }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            </button>
          </div>

        </div>
      </div>

      {/* SUCCESS TOAST NOTIFICATION */}
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

      {/* SECCIÓN 2: LISTADO DE CLIENTES EN TABLA PREMIUM */}
      <div className="widget view-content-widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
        <div className="details-table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>CÉDULA / RIF</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>RAZÓN SOCIAL / NOMBRE</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>TELÉFONO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>CORREO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>DIRECCIÓN FISCAL</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>CATEGORÍA</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ESTADO</th>
                {(isAdmin || user.role === 'AUDITOR') && <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>}
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={(isAdmin || user.role === 'AUDITOR') ? 8 : 7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    No se encontraron clientes registrados en la base local.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  return (
                    <tr key={client.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                        {client.rif}
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {client.name}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Phone size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{client.phone}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                          <Mail size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{client.email}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '11.5px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={client.address}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span>{client.address}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 800, 
                          color: client.clientType === 'Mayorista' ? '#a855f7' : 'var(--brand-primary)', 
                          backgroundColor: client.clientType === 'Mayorista' ? 'rgba(168, 85, 247, 0.1)' : 'var(--brand-primary-light)', 
                          padding: '2px 8px', 
                          borderRadius: '50px' 
                        }}>
                          {client.clientType}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span className={`status-badge ${client.status === 'Activo' ? 'delivered' : 'shipped'}`} style={{ fontSize: '10px' }}>
                          {client.status}
                        </span>
                      </td>
                      {(isAdmin || user.role === 'AUDITOR') && (
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleViewCreditClick(client)}
                              className="btn-pill-dark"
                              style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'rgba(14,165,164,0.1)', color: 'var(--brand-teal)' }}
                              title="Ver Historial / Cuentas por Cobrar"
                            >
                              <CreditCard size={12} />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleEditClient(client)}
                                className="btn-pill-dark"
                                style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'var(--bg-input)' }}
                                title="Editar Datos"
                              >
                                <Edit size={12} />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => setShowDeleteConfirm(client)}
                                className="btn-pill-dark"
                                style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                                title="Eliminar Cliente"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
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

      {/* MODAL MODULAR 1: NUEVO CLIENTE (GLASSMORPHISM) */}
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
            maxWidth: isMobile ? '100%' : '520px',
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
            
            {/* Cabecera */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Registrar Nuevo Cliente
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
            <form onSubmit={handleAddClient} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', flex: 1 }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Cédula / RIF *
                    </label>
                    <input 
                      type="text" 
                      value={newClient.rif}
                      onChange={(e) => setNewClient({ ...newClient, rif: formatRIF(e.target.value) })}
                      placeholder="Ej: J-40812991-0"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: `1.5px solid ${newClient.rif ? (validateRIF(newClient.rif) ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.4)') : 'var(--border-color)'}`, width: '100%', fontFamily: 'monospace' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Nombre o Razón Social *
                    </label>
                    <input 
                      type="text" 
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                      placeholder="Ej: Inversiones El Ávila C.A."
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
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
                      value={newClient.email}
                      onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                      placeholder="ventas@empresa.com"
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
                      value={newClient.phone}
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                      placeholder="Ej: 0414-1234567"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Categoría de Facturación
                  </label>
                  <CustomSelect 
                    value={newClient.clientType}
                    onChange={(val) => setNewClient({ ...newClient, clientType: val as 'Regular' | 'Mayorista' })}
                    options={[
                      { value: 'Regular', label: 'Cliente Detal (Regular)' },
                      { value: 'Mayorista', label: 'Cliente Contribuyente (Mayorista/RIF)' }
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Dirección Fiscal
                  </label>
                  <textarea 
                    value={newClient.address}
                    onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                    placeholder="Ej: Av. Francisco de Miranda, Edificio Avila, Piso 3, Oficina 34. Caracas, Miranda."
                    className="search-input"
                    rows={2}
                    style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', height: 'auto', resize: 'none', fontSize: '12.5px' }}
                  />
                </div>

              </div>

              {/* Botones de acción */}
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
                  Registrar Cliente
                </button>
              </div>
            </form>

          </div>

        </div>
      )}

      {/* MODAL MODULAR 1B: EDITAR CLIENTE (GLASSMORPHISM) */}
      {showEditModal && (
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
            maxWidth: isMobile ? '100%' : '520px',
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
            
            {/* Cabecera */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={18} style={{ color: 'var(--brand-primary)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Editar Cliente
                </h4>
              </div>
              <button 
                onClick={() => { setShowEditModal(false); setEditingClient(null); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveEditClient} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', flex: 1 }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Cédula / RIF
                    </label>
                    <input 
                      type="text" 
                      value={editClientForm.rif}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', fontFamily: 'monospace', backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' }}
                      disabled
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Nombre o Razón Social *
                    </label>
                    <input 
                      type="text" 
                      value={editClientForm.name}
                      onChange={(e) => setEditClientForm({ ...editClientForm, name: e.target.value })}
                      placeholder="Ej: Inversiones El Ávila C.A."
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
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
                      value={editClientForm.email}
                      onChange={(e) => setEditClientForm({ ...editClientForm, email: e.target.value })}
                      placeholder="ventas@empresa.com"
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
                      value={editClientForm.phone}
                      onChange={(e) => setEditClientForm({ ...editClientForm, phone: e.target.value })}
                      placeholder="Ej: 0414-1234567"
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Categoría de Facturación
                  </label>
                  <CustomSelect 
                    value={editClientForm.clientType}
                    onChange={(val) => setEditClientForm({ ...editClientForm, clientType: val as 'Regular' | 'Mayorista' })}
                    options={[
                      { value: 'Regular', label: 'Cliente Detal (Regular)' },
                      { value: 'Mayorista', label: 'Cliente Contribuyente (Mayorista/RIF)' }
                    ]}
                    style={{ width: '100%' }}
                    disabled={true}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Dirección Fiscal
                  </label>
                  <textarea 
                    value={editClientForm.address}
                    onChange={(e) => setEditClientForm({ ...editClientForm, address: e.target.value })}
                    placeholder="Ej: Av. Francisco de Miranda..."
                    className="search-input"
                    rows={2}
                    style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%', height: 'auto', resize: 'none', fontSize: '12.5px' }}
                  />
                </div>

              </div>

              {/* Botones de acción */}
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
                  onClick={() => { setShowEditModal(false); setEditingClient(null); }}
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

      {/* MODAL MODULAR 2: ELIMINAR CLIENTE (GLASSMORPHISM) */}
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
                  ¿Confirmar Eliminación de Cliente?
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Estás a punto de eliminar a <strong>{showDeleteConfirm.name}</strong> (RIF: {showDeleteConfirm.rif}) de la base de datos local. Esta acción es irreversible.
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
                onClick={handleDeleteClient}
                className="btn-yellow"
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--button-radius)', backgroundColor: '#ef4444', color: '#fff', border: '1.5px solid #ef4444', justifyContent: 'center' }}
              >
                Eliminar Cliente
              </button>
            </div>

          </div>

        </div>
      )}

      {/* MODAL 4: FICHA DE CRÉDITO Y CUENTAS POR COBRAR */}
      {showCreditModal && selectedClient && (
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
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-teal)', backgroundColor: 'rgba(14,165,164,0.1)', padding: '2px 8px', borderRadius: '50px', display: 'inline-block', marginBottom: '6px' }}>
                  EXPEDIENTE DE CRÉDITO Y SALDOS (CXC)
                </span>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedClient.name} (RIF: {selectedClient.rif})
                </h4>
              </div>
              <button 
                onClick={() => { setShowCreditModal(false); setSelectedClient(null); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Selector de Pestañas */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => setCreditTab('cxc')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  borderBottom: creditTab === 'cxc' ? '3px solid var(--brand-teal)' : 'none',
                  backgroundColor: 'transparent',
                  color: creditTab === 'cxc' ? 'var(--brand-teal)' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                Cuentas por Cobrar
              </button>
              <button
                onClick={() => setCreditTab('history')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  borderBottom: creditTab === 'history' ? '3px solid var(--brand-teal)' : 'none',
                  backgroundColor: 'transparent',
                  color: creditTab === 'history' ? 'var(--brand-teal)' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer'
                }}
              >
                Historial de Abonos / Compras
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '12.5px' }}>
              
              {/* PESTAÑA 1: CUENTAS POR COBRAR */}
              {creditTab === 'cxc' && (
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
                        Saldo Pendiente Total
                      </span>
                      <strong style={{ fontSize: '24px', display: 'block', color: (creditsMap[selectedClient.rif]?.balanceUSD || 0) > 0 ? '#ef4444' : '#22c55e', marginTop: '2px', fontWeight: 850 }}>
                        ${(creditsMap[selectedClient.rif]?.balanceUSD || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Equivalente VES BCV
                      </span>
                      <strong style={{ fontSize: '16px', display: 'block', color: 'var(--brand-gold)', marginTop: '4px', fontFamily: 'monospace' }}>
                        Bs. {((creditsMap[selectedClient.rif]?.balanceUSD || 0) * dolarRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>

                  {/* Facturas a Crédito */}
                  <div>
                    <h5 style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Facturas Pendientes de Cobro
                    </h5>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1.5px solid var(--border-color)', borderRadius: '12px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '10.5px', fontWeight: 800 }}>
                            <th style={{ padding: '8px 12px' }}>FACTURA</th>
                            <th style={{ padding: '8px 12px' }}>FECHA</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>TOTAL</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>ABONADO</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>PENDIENTE</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>ESTADO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!creditsMap[selectedClient.rif]?.invoices || creditsMap[selectedClient.rif].invoices.length === 0) ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                                Sin facturas registradas.
                              </td>
                            </tr>
                          ) : (
                            creditsMap[selectedClient.rif].invoices.map((inv, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '11.5px' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 800, fontFamily: 'monospace', color: 'var(--brand-primary)' }}>{inv.ticket}</td>
                                <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{inv.date}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>${inv.total.toFixed(2)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>${inv.paid.toFixed(2)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 800 }}>${inv.pending.toFixed(2)}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  <span className={`status-badge ${inv.status === 'Pagado' ? 'delivered' : 'shipped'}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
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

                  {/* Formulario Registrar Abono */}
                  {isAdmin && (creditsMap[selectedClient.rif]?.balanceUSD || 0) > 0 && (
                    <form onSubmit={handleRegisterAbono} style={{
                      backgroundColor: 'rgba(14,165,164,0.04)',
                      border: '1.5px solid rgba(14,165,164,0.15)',
                      borderRadius: '16px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-teal)' }}>
                        <DollarSign size={16} />
                        <strong style={{ fontSize: '12px', fontWeight: 800 }}>REGISTRAR ABONO / COBRO COMERCIAL</strong>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', alignItems: 'flex-end' }}>
                        <div>
                          <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '9px' }}>
                            Monto a Cobrar ($ USD) *
                          </label>
                          <input 
                            type="number"
                            step="0.01"
                            value={abonoForm.amount}
                            onChange={(e) => setAbonoForm({ ...abonoForm, amount: e.target.value })}
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
                          <CustomSelect
                            value={abonoForm.method}
                            onChange={(val) => setAbonoForm({ ...abonoForm, method: val })}
                            options={[
                              { value: 'EFECTIVO', label: 'Efectivo USD' },
                              { value: 'PAGO_MOVIL', label: 'Pago Móvil VES' },
                              { value: 'PUNTO_DE_VENTA', label: 'Punto de Venta VES' },
                              { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' }
                            ]}
                            style={{ width: '100%' }}
                          />
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

              {/* PESTAÑA 2: HISTORIAL DE ABONOS */}
              {creditTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h5 style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-primary)', margin: 0 }}>
                    Bitácora de Pagos y Operaciones de Cuenta
                  </h5>
                  
                  <div style={{ border: '1.5px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '10.5px', fontWeight: 800 }}>
                          <th style={{ padding: '8px 12px' }}>FECHA Y HORA</th>
                          <th style={{ padding: '8px 12px' }}>TIPO DE PAGO</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>MONTO RECIBIDO</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>IDENTIFICADOR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!creditsMap[selectedClient.rif]?.payments || creditsMap[selectedClient.rif].payments.length === 0) ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                              Sin abonos registrados en el historial de cuenta local.
                            </td>
                          </tr>
                        ) : (
                          creditsMap[selectedClient.rif].payments.map((pay, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '11.5px' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{pay.date}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                                <span style={{ fontSize: '9.5px', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '2px 8px', borderRadius: '50px' }}>
                                  {pay.method}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 800 }}>+${pay.amount.toFixed(2)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{pay.id}</td>
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
                onClick={() => { setShowCreditModal(false); setSelectedClient(null); }}
                className="btn-pill-dark"
                style={{ padding: '8px 20px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)' }}
              >
                Cerrar Expediente
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
