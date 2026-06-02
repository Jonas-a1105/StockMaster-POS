import { useState, useEffect } from 'react';
import { Search, UserPlus, Mail, Phone, MapPin, Trash2, Edit, Check, AlertTriangle, AlertCircle, RefreshCw, X, CreditCard, DollarSign } from 'lucide-react';
import { getDatabase, type ClientDocType } from '../db/database';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';
import { useExchangeRate } from '../contexts/ExchangeRateContext';

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

export default function Clientes({ searchTerm = '' }: ClientesProps) {
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
    } else {
      const initialMap = {
        'V-19445102-3': {
          balanceUSD: 45.00,
          invoices: [
            { ticket: 'TK-884210', date: '28/05/2026', total: 45.00, paid: 0.00, pending: 45.00, status: 'Pendiente' as const }
          ],
          payments: []
        },
        'J-40812991-0': {
          balanceUSD: 120.00,
          invoices: [
            { ticket: 'TK-774021', date: '15/05/2026', total: 250.00, paid: 130.00, pending: 120.00, status: 'Pendiente' as const }
          ],
          payments: [
            { id: 'pay_01', date: '20/05/2026', amount: 130.00, method: 'TRANSFERENCIA' }
          ]
        },
        'V-12845607-9': {
          balanceUSD: 0.00,
          invoices: [
            { ticket: 'TK-662891', date: '20/05/2026', total: 80.00, paid: 80.00, pending: 0.00, status: 'Pagado' as const }
          ],
          payments: [
            { id: 'pay_02', date: '22/05/2026', amount: 80.00, method: 'EFECTIVO' }
          ]
        }
      };
      setCreditsMap(initialMap);
      localStorage.setItem('stockmaster_client_credits_local', JSON.stringify(initialMap));
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
      
      if (allClientsDocs.length === 0) {
        // Automatically seed mock Venezuelan clients if database is empty
        await seedMockClients();
        return;
      }

      // Map doc fields and parse metadata from database or fallbacks
      const mapped: CustomClient[] = allClientsDocs.map(doc => {
        const json = doc.toJSON();
        
        // Custom parsing or simulated values for extended fields
        let rif = json.id; // Using ID as RIF
        let address = 'Distrito Capital, Caracas, Venezuela';
        let clientType: 'Regular' | 'Mayorista' = 'Regular';
        let status: 'Activo' | 'Inactivo' = 'Activo';

        // Derive some values based on RIF suffix/prefix for realistic mapping
        if (json.id.startsWith('J-')) {
          clientType = 'Mayorista';
          address = 'Zona Industrial de Boleíta Norte, Caracas, Miranda';
        } else if (json.id.endsWith('9') || json.id.endsWith('4')) {
          clientType = 'Mayorista';
          address = 'Avenida Bolívar, Valencia, Edo. Carabobo';
        }

        return {
          id: json.id,
          rif,
          name: json.name,
          email: json.email || 'N/A',
          phone: json.phone || 'N/A',
          address,
          clientType,
          status,
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

  const seedMockClients = async () => {
    try {
      const db = await getDatabase();
      const seedData = [
        { id: 'J-40812991-0', name: 'Distribuidora Inversiones El Ávila C.A.', email: 'compras@elavila.com.ve', phone: '0212-5551234' },
        { id: 'V-19445102-3', name: 'María Alejandra Delgado', email: 'maria.delgado@gmail.com', phone: '0414-2283141' },
        { id: 'J-30477401-2', name: 'Corporación Comercial Oriente', email: 'administracion@ccoriente.com', phone: '0281-2864010' },
        { id: 'V-12845607-9', name: 'Carlos Eduardo Mendoza', email: 'carlos.mendoza@outlook.com', phone: '0424-9912831' }
      ];

      for (const item of seedData) {
        await db.clients.insert({
          id: item.id,
          name: item.name,
          email: item.email,
          phone: item.phone,
          updatedAt: new Date().toISOString()
        });
      }
      
      console.log('✅ Clientes semilla importados con éxito en RxDB local.');
      loadClients();
    } catch (err) {
      console.error('Error al sembrar clientes:', err);
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
      console.error(err);
      setAlertConfig({
        title: 'Error de Inserción',
        message: 'Error al agregar el cliente en la base local.',
        type: 'error'
      });
    }
  };

  const handleEditClient = (client: CustomClient) => {
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
    if (!showDeleteConfirm) return;

    try {
      const db = await getDatabase();
      const doc = await db.clients.findOne({ selector: { id: showDeleteConfirm.id } }).exec();
      if (doc) {
        await doc.remove();
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

    // Guardar en bitácora local de auditoría
    const newAuditLog = {
      id: 'local_log_' + crypto.randomUUID(),
      action: 'POS_ABONO_CREDITO_CLIENTE',
      details: JSON.stringify({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        rif: clientRIF,
        abonoAmountUSD: amountVal,
        paymentMethod: abonoForm.method,
        remainingBalanceUSD: nextClientData.balanceUSD
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

    setAbonoForm({ amount: '', method: 'EFECTIVO' });
    setShowSuccessToast(`Abono de $${amountVal.toFixed(2)} registrado exitosamente.`);
    setTimeout(() => setShowSuccessToast(null), 3500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: CABECERA Y FILTROS */}
      <div className="widget" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          
          {/* Título */}
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-main)' }}>
              👥 Directorio de Clientes y RIF Fiscal
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Base de datos integrada para la facturación fiscal de compras, ventas al mayor y control comercial.
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
      <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
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
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontWeight: 600 }}>
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
                          <button
                            onClick={() => handleEditClient(client)}
                            className="btn-pill-dark"
                            style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'var(--bg-input)' }}
                            title="Editar Datos"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(client)}
                            className="btn-pill-dark"
                            style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                            title="Eliminar Cliente"
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

      {/* MODAL MODULAR 1: NUEVO CLIENTE (GLASSMORPHISM) */}
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
            <form onSubmit={handleAddClient}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                
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
                  <select 
                    value={newClient.clientType}
                    onChange={(e) => setNewClient({ ...newClient, clientType: e.target.value as 'Regular' | 'Mayorista' })}
                    className="dropdown-select"
                    style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px' }}
                  >
                    <option value="Regular">Cliente Detal (Regular)</option>
                    <option value="Mayorista">Cliente Contribuyente (Mayorista/RIF)</option>
                  </select>
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
                  Registrar Cliente
                </button>
              </div>
            </form>

          </div>

        </div>
      )}

      {/* MODAL MODULAR 1B: EDITAR CLIENTE (GLASSMORPHISM) */}
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
            <form onSubmit={handleSaveEditClient}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                
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
                  <select 
                    value={editClientForm.clientType}
                    onChange={(e) => setEditClientForm({ ...editClientForm, clientType: e.target.value as 'Regular' | 'Mayorista' })}
                    className="dropdown-select"
                    style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed' }}
                    disabled
                  >
                    <option value="Regular">Cliente Detal (Regular)</option>
                    <option value="Mayorista">Cliente Contribuyente (Mayorista/RIF)</option>
                  </select>
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
              <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
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
                  {(creditsMap[selectedClient.rif]?.balanceUSD || 0) > 0 && (
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
                          <select
                            value={abonoForm.method}
                            onChange={(e) => setAbonoForm({ ...abonoForm, method: e.target.value })}
                            className="dropdown-select"
                            style={{ width: '100%', padding: '8px', height: '36px', borderRadius: '10px' }}
                          >
                            <option value="EFECTIVO">Efectivo USD</option>
                            <option value="PAGO_MOVIL">Pago Móvil VES</option>
                            <option value="PUNTO_DE_VENTA">Punto de Venta VES</option>
                            <option value="TRANSFERENCIA">Transferencia Bancaria</option>
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
