import { useState, useEffect } from 'react';
import { DollarSign, Plus, AlertCircle, X, Edit, Trash2 } from 'lucide-react';
import { getDatabase, type UserDocType } from '../db/database';
import { syncWorker } from '../db/sync';
import { API_URL } from '../config';
import { logAuditEvent } from '../utils/audit';
import CustomSelect from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';


interface NominaProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  searchTerm?: string;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  baseSalary: number;
  hoursWorked: number;
  bonuses: number;
  deductions: number;
  totalPaid: number;
  status: string;
  paymentDate: string;
}

export default function Nomina({ user, searchTerm = '' }: NominaProps) {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<UserDocType[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [editPayrollForm, setEditPayrollForm] = useState({
    baseSalary: '',
    hoursWorked: '',
    bonuses: '',
    deductions: '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<PayrollRecord | null>(null);

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

  // Formulario de Nómina
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [bonuses, setBonuses] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  const isAdmin = user.role === 'ADMIN';

  // Carga nóminas desde IndexedDB local y en el backend si está online
  const loadData = async () => {
    try {
      const db = await getDatabase();
      const allUsers = await db.users.find().exec();
      setEmployees(allUsers.map(doc => doc.toJSON()));
      
      await syncWorker.sync();
    } catch (err) {
      console.error('Error cargando nóminas:', err);
    }
  };

  useEffect(() => {
    let sub: any = null;

    const setupSubscription = async () => {
      try {
        const db = await getDatabase();
        
        // Fetch employees list
        const allUsers = await db.users.find().exec();
        setEmployees(allUsers.map(doc => doc.toJSON()));

        const query = db.payroll.find();
        sub = query.$.subscribe((payrollDocs) => {
          const mapped = payrollDocs.map(doc => {
            const docData = doc.toJSON();
            return {
              id: docData.id,
              employeeId: docData.employeeId,
              employeeName: docData.employeeName || 'Empleado',
              baseSalary: docData.baseSalary,
              hoursWorked: docData.hoursWorked,
              bonuses: docData.bonuses,
              deductions: docData.deductions,
              totalPaid: docData.totalPaid,
              status: docData.status,
              paymentDate: docData.paymentDate
            };
          });
          
          mapped.sort((a, b) => b.id.localeCompare(a.id));
          setPayrolls(mapped);
        });
      } catch (err) {
        console.error('Error setting up payroll RxDB subscription:', err);
      }
    };

    setupSubscription();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  const handleRegisterPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedEmployeeId || !baseSalary || !hoursWorked) {
      setErrorMessage('Por favor complete todos los campos requeridos.');
      return;
    }

    const employeeObj = employees.find(emp => emp.id === selectedEmployeeId);
    const employeeName = employeeObj?.name || 'Empleado';
    const totalPaid = Number(baseSalary) + Number(bonuses) - Number(deductions);

    try {
      const db = await getDatabase();
      const id = 'pay_' + Date.now();

      await db.payroll.insert({
        id,
        employeeId: selectedEmployeeId,
        employeeName,
        baseSalary: Number(baseSalary),
        hoursWorked: Number(hoursWorked),
        bonuses: Number(bonuses),
        deductions: Number(deductions),
        totalPaid,
        status: 'PENDIENTE',
        paymentDate,
        pendingSync: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      logAuditEvent(user, 'NOMINA_PAGO_REGISTRAR', {
        employeeName,
        totalPaid
      });

      setShowAddForm(false);
      setSelectedEmployeeId('');
      setBaseSalary('');
      setHoursWorked('');
      setBonuses('0');
      setDeductions('0');

      setAlertConfig({
        title: 'Nómina Registrada',
        message: 'Pago de nómina registrado con éxito en el libro local.',
        type: 'success'
      });

      syncWorker.sync();
    } catch (err: any) {
      setErrorMessage(err.message || 'Fallo al guardar nómina.');
    }
  };

  const handleEditPayroll = (pay: PayrollRecord) => {
    setEditingPayroll(pay);
    setEditPayrollForm({
      baseSalary: pay.baseSalary.toString(),
      hoursWorked: pay.hoursWorked.toString(),
      bonuses: pay.bonuses.toString(),
      deductions: pay.deductions.toString(),
    });
    setShowEditModal(true);
  };

  const handleSaveEditPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayroll) return;

    const base = Number(editPayrollForm.baseSalary) || 0;
    const hours = Number(editPayrollForm.hoursWorked) || 0;
    const bon = Number(editPayrollForm.bonuses) || 0;
    const ded = Number(editPayrollForm.deductions) || 0;

    try {
      const db = await getDatabase();
      const doc = await db.payroll.findOne({ selector: { id: editingPayroll.id } }).exec();
      if (doc) {
        await doc.patch({
          baseSalary: base,
          hoursWorked: hours,
          bonuses: bon,
          deductions: ded,
          totalPaid: base + bon - ded,
          pendingSync: true,
          updatedAt: new Date().toISOString()
        });
      }

      logAuditEvent(user, 'NOMINA_EDITAR', {
        employeeName: editingPayroll.employeeName
      });

      setShowEditModal(false);
      setEditingPayroll(null);
      setAlertConfig({
        title: 'Nómina Actualizada',
        message: 'Nómina actualizada correctamente de forma local.',
        type: 'success'
      });

      syncWorker.sync();
    } catch (err) {
      console.error('Error saving edited payroll:', err);
    }
  };

  const handleDeletePayroll = async () => {
    if (!showDeleteConfirm) return;

    try {
      const db = await getDatabase();
      const doc = await db.payroll.findOne({ selector: { id: showDeleteConfirm.id } }).exec();
      if (doc) {
        await doc.remove();
      }

      setShowDeleteConfirm(null);
      setAlertConfig({
        title: 'Nómina Eliminada',
        message: 'El registro de nómina ha sido removido.',
        type: 'success'
      });
    } catch (err) {
      console.error('Error deleting payroll:', err);
    }
  };

  // Filtrar las nóminas según el buscador
  const filteredPayrolls = payrolls.filter(pay => {
    const term = searchTerm.toLowerCase();
    return (
      (pay.employeeName || '').toLowerCase().includes(term) ||
      pay.id.toLowerCase().includes(term) ||
      pay.status.toLowerCase().includes(term)
    );
  });

  // C4: Pagination - reset page when search changes
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  const totalPages = Math.ceil(filteredPayrolls.length / ITEMS_PER_PAGE);
  const paginatedPayrolls = filteredPayrolls.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="view-container-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* Panel de Listado de Nóminas */}
      <div className="widget view-content-widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
        
        {/* Encabezado */}
        <div className="widget-header" style={{ marginBottom: '22px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 className="widget-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={20} style={{ color: 'var(--brand-teal)' }} />
            <span>Historial de Nómina Fiscal</span>
          </h3>

          {isAdmin && (
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn-yellow"
            >
              <Plus size={14} />
              <span>Registrar Pago</span>
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="details-table-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
          <table className="details-table">
            <thead>
              <tr>
                <th>EMPLEADO</th>
                <th>FECHA</th>
                <th style={{ textAlign: 'right' }}>BASE</th>
                <th style={{ textAlign: 'right' }}>HORAS</th>
                <th style={{ textAlign: 'right' }}>BONOS</th>
                <th style={{ textAlign: 'right' }}>DEDUCCIONES</th>
                <th style={{ textAlign: 'right' }}>TOTAL NETO</th>
                <th>ESTADO</th>
                {isAdmin && <th style={{ textAlign: 'center' }}>ACCIONES</th>}
              </tr>
            </thead>
            <tbody>
              {filteredPayrolls.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    No se registran pagos de nómina vinculados a este usuario.
                  </td>
                </tr>
              ) : (
                paginatedPayrolls.map(pay => (
                  <tr key={pay.id} style={{ animation: 'fadeIn 0.3s ease' }}>
                    <td style={{ fontWeight: '700' }}>
                      {pay.employeeName || 'Cajero General'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {new Date(pay.paymentDate).toLocaleDateString('es-ES')}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      ${pay.baseSalary.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700' }}>
                      {pay.hoursWorked} hrs
                    </td>
                    <td style={{ textAlign: 'right', color: '#10b981', fontWeight: '700' }}>
                      +${pay.bonuses.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: '700' }}>
                      -${pay.deductions.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '850', color: 'var(--brand-teal)' }}>
                      ${pay.totalPaid.toFixed(2)}
                    </td>
                    <td>
                      <span className="status-badge delivered">
                        {pay.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleEditPayroll(pay)}
                            style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                            title="Editar Datos"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(pay)}
                            style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            title="Eliminar Nómina"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
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

      {/* MODAL: REGISTRAR PAGO (GLASSMORPHISM) */}
      {showAddForm && isAdmin && (
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
            maxWidth: isMobile ? '100%' : '480px',
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
                <Plus size={18} style={{ color: 'var(--brand-teal)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Registrar Pago de Nómina
                </h4>
              </div>
              <button 
                onClick={() => setShowAddForm(false)}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleRegisterPayroll} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', flex: 1 }}>
                {errorMessage && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    color: '#ef4444',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: '1.5px solid rgba(239, 68, 68, 0.15)'
                  }}>
                    <AlertCircle size={14} />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Seleccionar Empleado *
                  </label>
                  <CustomSelect 
                    value={selectedEmployeeId}
                    onChange={(val) => setSelectedEmployeeId(val)}
                    options={[
                      { value: '', label: 'Seleccione...' },
                      ...employees.map(emp => ({ value: emp.id, label: `${emp.name} (${emp.role})` }))
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Salario Base ($) *
                  </label>
                  <input 
                    type="number" 
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="search-input"
                    placeholder="0.00"
                    style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Horas Trabajadas *
                  </label>
                  <input 
                    type="number" 
                    value={hoursWorked}
                    onChange={(e) => setHoursWorked(e.target.value)}
                    className="search-input"
                    placeholder="40"
                    style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Bonos ($)
                    </label>
                    <input 
                      type="number" 
                      value={bonuses}
                      onChange={(e) => setBonuses(e.target.value)}
                      className="search-input"
                      style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Deducciones ($)
                    </label>
                    <input 
                      type="number" 
                      value={deductions}
                      onChange={(e) => setDeductions(e.target.value)}
                      className="search-input"
                      style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                    Fecha de Pago
                  </label>
                  <CustomDatePicker 
                    value={paymentDate}
                    onChange={setPaymentDate}
                    placeholder="Seleccionar fecha de pago"
                    style={{ width: '100%' }}
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
                  onClick={() => setShowAddForm(false)}
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
                  Registrar Liquidación
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

      {/* MODAL: EDITAR NÓMINA (GLASSMORPHISM) */}
      {showEditModal && editingPayroll && (
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
            maxWidth: isMobile ? '100%' : '480px',
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
                <Edit size={18} style={{ color: 'var(--brand-teal)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Editar Nómina — {editingPayroll.employeeName || 'Empleado'}
                </h4>
              </div>
              <button 
                onClick={() => { setShowEditModal(false); setEditingPayroll(null); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveEditPayroll} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Salario Base ($) *
                    </label>
                    <input 
                      type="number" 
                      value={editPayrollForm.baseSalary}
                      onChange={(e) => setEditPayrollForm({ ...editPayrollForm, baseSalary: e.target.value })}
                      className="search-input"
                      placeholder="0.00"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Horas Trabajadas *
                    </label>
                    <input 
                      type="number" 
                      value={editPayrollForm.hoursWorked}
                      onChange={(e) => setEditPayrollForm({ ...editPayrollForm, hoursWorked: e.target.value })}
                      className="search-input"
                      placeholder="40"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Bonos ($)
                    </label>
                    <input 
                      type="number" 
                      value={editPayrollForm.bonuses}
                      onChange={(e) => setEditPayrollForm({ ...editPayrollForm, bonuses: e.target.value })}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Deducciones ($)
                    </label>
                    <input 
                      type="number" 
                      value={editPayrollForm.deductions}
                      onChange={(e) => setEditPayrollForm({ ...editPayrollForm, deductions: e.target.value })}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
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
                  onClick={() => { setShowEditModal(false); setEditingPayroll(null); }}
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

      {/* MODAL: ELIMINAR NÓMINA (CONFIRMACIÓN) */}
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
            maxWidth: '400px',
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
                <Trash2 size={32} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                  ¿Eliminar registro de nómina?
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  Esta acción eliminará de forma permanente el registro de nómina de <strong>{showDeleteConfirm.employeeName}</strong>. Esta acción no se puede deshacer de forma local.
                </p>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-pill-dark"
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--button-radius)', justifyContent: 'center' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePayroll}
                className="btn-yellow"
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--button-radius)', backgroundColor: '#ef4444', color: '#fff', justifyContent: 'center' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
