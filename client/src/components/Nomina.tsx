import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Plus, 
  AlertCircle, 
  X, 
  Edit, 
  Trash2, 
  History, 
  Users, 
  Clock, 
  Percent, 
  Smartphone, 
  Check,
  ChevronDown,
  CheckCircle
} from 'lucide-react';
import { getDatabase, type UserDocType, type PayrollDocType, type AttendanceDocType } from '../db/database';
import { syncWorker } from '../db/sync';
import { logAuditEvent } from '../utils/audit';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { useTheme } from '../contexts/ThemeContext';
import CustomSelect from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';
import * as bcrypt from 'bcryptjs';

interface NominaProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  searchTerm?: string;
}

export default function Nomina({ user, searchTerm = '' }: NominaProps) {
  const { dolarRate, convertToVES, formatVES, formatUSD } = useExchangeRate();
  const { settings } = useTheme();
  const isDarkMode = settings?.mode === 'dark';

  const [activeSubTab, setActiveSubTab] = useState<'payrolls' | 'employees' | 'attendance'>('payrolls');
  
  // Payroll list states
  const [payrolls, setPayrolls] = useState<PayrollDocType[]>([]);
  const [employees, setEmployees] = useState<UserDocType[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<PayrollDocType | null>(null);
  const [editPayrollForm, setEditPayrollForm] = useState({
    baseSalary: '',
    hoursWorked: '',
    bonuses: '',
    deductions: '',
    paymentCurrency: 'USD',
    paymentMethod: 'Transferencia',
    advancesUSD: '0',
    advancesVES: '0',
    paidInUSD: '',
    paidInVES: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<PayrollDocType | null>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Add Payroll Form states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [hoursWorked, setHoursWorked] = useState('40');
  const [bonuses, setBonuses] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Bimonetary & Advances states
  const [paymentCurrency, setPaymentCurrency] = useState<'USD' | 'VES' | 'MIXTO'>('USD');
  const [paymentMethod, setPaymentMethod] = useState<'Transferencia' | 'Efectivo' | 'Pago Móvil' | 'Mixto'>('Transferencia');
  const [advancesUSD, setAdvancesUSD] = useState('0');
  const [advancesVES, setAdvancesVES] = useState('0');
  const [paidInUSD, setPaidInUSD] = useState('');
  const [paidInVES, setPaidInVES] = useState('');

  // Cashier commission statistics
  const [salesData, setSalesData] = useState<Record<string, { totalSales: number; commission: number }>>({});
  
  // Employee config modal states
  const [editingEmployee, setEditingEmployee] = useState<UserDocType | null>(null);
  const [editBaseSalary, setEditBaseSalary] = useState('');
  const [editCommissionRate, setEditCommissionRate] = useState('');
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);

  // Attendance states
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceDocType[]>([]);
  const [pinInput, setPinInput] = useState('');

  const isAdmin = user.role === 'ADMIN';

  // Load sales commissions dynamically for current month
  const calculateSalesCommissions = async (userList: UserDocType[]) => {
    try {
      const db = await getDatabase();
      const salesDocs = await db.sales.find().exec();
      const salesList = salesDocs.map(doc => doc.toJSON());

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const stats: Record<string, { totalSales: number; commission: number }> = {};
      
      salesList.forEach(sale => {
        if (sale.createdAt) {
          const saleDate = new Date(sale.createdAt);
          if (saleDate >= startOfMonth) {
            const cashierId = sale.cashierId;
            const total = sale.total || 0;
            if (!stats[cashierId]) {
              stats[cashierId] = { totalSales: 0, commission: 0 };
            }
            stats[cashierId].totalSales += total;
          }
        }
      });

      userList.forEach(emp => {
        const cashierId = emp.id;
        const rate = emp.commissionRate || 0;
        const totalSales = stats[cashierId]?.totalSales || 0;
        const commission = totalSales * rate;
        stats[cashierId] = {
          totalSales,
          commission
        };
      });

      setSalesData(stats);
    } catch (e) {
      console.error('Error al calcular comisiones de venta:', e);
    }
  };

  const loadAttendanceLogs = async () => {
    try {
      const db = await getDatabase();
      const docs = await db.attendance.find().exec();
      const mapped = docs.map(doc => doc.toJSON());
      mapped.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setAttendanceLogs(mapped);
    } catch (e) {
      console.error('Error al cargar logs de asistencia:', e);
    }
  };

  const loadData = async () => {
    try {
      const db = await getDatabase();
      const allUsers = await db.users.find().exec();
      const userList = allUsers.map(doc => doc.toJSON());
      setEmployees(userList);
      await calculateSalesCommissions(userList);
      await loadAttendanceLogs();
      await syncWorker.sync();
    } catch (err) {
      console.error('Error cargando datos de nómina:', err);
    }
  };

  useEffect(() => {
    let subPayroll: any = null;
    let subUsers: any = null;
    let subAttendance: any = null;

    const setupSubscription = async () => {
      try {
        const db = await getDatabase();
        
        subPayroll = db.payroll.find().$.subscribe((payrollDocs) => {
          const mapped = payrollDocs.map(doc => doc.toJSON());
          mapped.sort((a, b) => b.id.localeCompare(a.id));
          setPayrolls(mapped);
        });

        subUsers = db.users.find().$.subscribe(async (userDocs) => {
          const userList = userDocs.map(doc => doc.toJSON());
          setEmployees(userList);
          await calculateSalesCommissions(userList);
        });

        subAttendance = db.attendance.find().$.subscribe((attendanceDocs) => {
          const mappedLogs = attendanceDocs.map(doc => doc.toJSON());
          mappedLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setAttendanceLogs(mappedLogs);
        });
      } catch (err) {
        console.error('Error setting up RxDB subscriptions in Nomina:', err);
      }
    };

    setupSubscription();

    return () => {
      if (subPayroll) subPayroll.unsubscribe();
      if (subUsers) subUsers.unsubscribe();
      if (subAttendance) subAttendance.unsubscribe();
    };
  }, []);

  // Autofill base salary when employee is selected in register modal
  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp) {
        setBaseSalary(emp.baseSalary ? emp.baseSalary.toString() : '');
      }
    } else {
      setBaseSalary('');
    }
  }, [selectedEmployeeId, employees]);

  // Deducciones de ley venezolana
  const SSO_RATE = 0.04;
  const LPH_RATE = 0.02;
  const FAOV_RATE = 0.01;
  const SALARY_CAP = 2000; // USD capped para SSO/LPH

  const calcSSO = () => {
    const base = Number(baseSalary) || 0;
    return Math.min(base, SALARY_CAP) * SSO_RATE;
  };
  const calcLPH = () => {
    const base = Number(baseSalary) || 0;
    return Math.min(base, SALARY_CAP) * LPH_RATE;
  };
  const calcFAOV = () => {
    const base = Number(baseSalary) || 0;
    return base * FAOV_RATE;
  };
  const calcTotalDeductions = () => {
    const manual = Number(deductions) || 0;
    return manual + calcSSO() + calcLPH() + calcFAOV();
  };

  // Compute Total Net Pay for Register Modal
  const calculatedTotalNet = () => {
    const base = Number(baseSalary) || 0;
    const bon = Number(bonuses) || 0;
    const advUSD = Number(advancesUSD) || 0;
    const advVES = Number(advancesVES) || 0;
    
    return base + bon - calcTotalDeductions() - advUSD - (advVES / dolarRate);
  };

  const handleRegisterPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedEmployeeId || !baseSalary || !hoursWorked) {
      setErrorMessage('Por favor complete todos los campos requeridos.');
      return;
    }

    const employeeObj = employees.find(emp => emp.id === selectedEmployeeId);
    const employeeName = employeeObj?.name || 'Empleado';
    const totalPaid = calculatedTotalNet();

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
        deductions: calcTotalDeductions() + Number(advancesUSD) + (Number(advancesVES) / dolarRate),
        totalPaid,
        status: 'LIQUIDADO',
        paymentDate,
        dolarRate: Number(dolarRate),
        paymentCurrency,
        paidInUSD: paymentCurrency === 'USD' ? totalPaid : paymentCurrency === 'VES' ? 0 : Number(paidInUSD || 0),
        paidInVES: paymentCurrency === 'VES' ? (totalPaid * dolarRate) : paymentCurrency === 'USD' ? 0 : Number(paidInVES || 0),
        advancesUSD: Number(advancesUSD),
        advancesVES: Number(advancesVES),
        paymentMethod,
        pendingSync: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      logAuditEvent(user, 'NOMINA_PAGO_REGISTRAR', {
        employeeName,
        totalPaid,
        paymentCurrency
      });

      setShowAddForm(false);
      setSelectedEmployeeId('');
      setBaseSalary('');
      setHoursWorked('40');
      setBonuses('0');
      setDeductions('0');
      setAdvancesUSD('0');
      setAdvancesVES('0');
      setPaidInUSD('');
      setPaidInVES('');
      setPaymentCurrency('USD');
      setPaymentMethod('Transferencia');

      setAlertConfig({
        title: 'Nómina Registrada',
        message: `Pago de nómina bimonetaria registrado con éxito para ${employeeName}.`,
        type: 'success'
      });

      syncWorker.sync();
    } catch (err: any) {
      setErrorMessage(err.message || 'Fallo al guardar nómina.');
    }
  };

  const handleEditPayroll = (pay: PayrollDocType) => {
    setEditingPayroll(pay);
    setEditPayrollForm({
      baseSalary: pay.baseSalary.toString(),
      hoursWorked: pay.hoursWorked.toString(),
      bonuses: pay.bonuses.toString(),
      deductions: (pay.deductions - (pay.advancesUSD || 0) - ((pay.advancesVES || 0) / (pay.dolarRate || dolarRate))).toFixed(2),
      paymentCurrency: pay.paymentCurrency || 'USD',
      paymentMethod: pay.paymentMethod || 'Transferencia',
      advancesUSD: (pay.advancesUSD || 0).toString(),
      advancesVES: (pay.advancesVES || 0).toString(),
      paidInUSD: (pay.paidInUSD || 0).toString(),
      paidInVES: (pay.paidInVES || 0).toString()
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
    const advUSD = Number(editPayrollForm.advancesUSD) || 0;
    const advVES = Number(editPayrollForm.advancesVES) || 0;

    const finalRate = editingPayroll.dolarRate || dolarRate;
    const totalPaid = base + bon - ded - advUSD - (advVES / finalRate);

    try {
      const db = await getDatabase();
      const doc = await db.payroll.findOne({ selector: { id: editingPayroll.id } }).exec();
      if (doc) {
        await doc.patch({
          baseSalary: base,
          hoursWorked: hours,
          bonuses: bon,
          deductions: ded + advUSD + (advVES / finalRate),
          totalPaid,
          paymentCurrency: editPayrollForm.paymentCurrency,
          paymentMethod: editPayrollForm.paymentMethod,
          paidInUSD: editPayrollForm.paymentCurrency === 'USD' ? totalPaid : editPayrollForm.paymentCurrency === 'VES' ? 0 : Number(editPayrollForm.paidInUSD || 0),
          paidInVES: editPayrollForm.paymentCurrency === 'VES' ? (totalPaid * finalRate) : editPayrollForm.paymentCurrency === 'USD' ? 0 : Number(editPayrollForm.paidInVES || 0),
          advancesUSD: advUSD,
          advancesVES: advVES,
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
        message: 'Nómina actualizada correctamente con parámetros bimonetarios.',
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

  // Employee commission settings handler
  const handleEditEmployeeClick = (emp: UserDocType) => {
    setEditingEmployee(emp);
    setEditBaseSalary(emp.baseSalary ? emp.baseSalary.toString() : '0');
    setEditCommissionRate(emp.commissionRate ? (emp.commissionRate * 100).toString() : '0');
    setShowEditEmployeeModal(true);
  };

  const handleSaveEmployeeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    try {
      const db = await getDatabase();
      const doc = await db.users.findOne({ selector: { id: editingEmployee.id } }).exec();
      if (doc) {
        await doc.patch({
          baseSalary: Number(editBaseSalary) || 0,
          commissionRate: Number(editCommissionRate) / 100 || 0,
          updatedAt: new Date().toISOString()
        });
      }

      setAlertConfig({
        title: 'Configuración Guardada',
        message: `Se actualizó el sueldo base y la comisión para ${editingEmployee.name}.`,
        type: 'success'
      });
      setShowEditEmployeeModal(false);
      setEditingEmployee(null);
      loadData();
    } catch (err) {
      console.error('Error al guardar configuración de empleado:', err);
    }
  };

  // Virtual PIN Pad input processor
  const handlePinKeyPress = (digit: string) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + digit;
      setPinInput(newPin);
      if (newPin.length === 4) {
        // Trigger PIN verification automatically when 4 digits are typed
        setTimeout(() => handlePinSubmit(newPin), 300);
      }
    }
  };

  const handlePinClear = () => {
    setPinInput('');
  };

  const handlePinBackspace = () => {
    setPinInput(pinInput.slice(0, -1));
  };

  const handlePinSubmit = async (pin: string) => {
    try {
      const db = await getDatabase();
      const allUsers = await db.users.find().exec();
      const userList = allUsers.map(doc => doc.toJSON());

      let matchingUser: any = null;
      for (const u of userList) {
        if (u.pinHash) {
          const isMatch = await bcrypt.compare(pin, u.pinHash);
          if (isMatch) {
            matchingUser = u;
            break;
          }
        }
      }

      if (!matchingUser) {
        setAlertConfig({
          title: 'PIN Incorrecto',
          message: 'El PIN ingresado no coincide con ningún empleado del sistema.',
          type: 'error'
        });
        setPinInput('');
        return;
      }

      // Check if user has an active shift
      const activeShift = await db.attendance.findOne({
        selector: {
          employeeId: matchingUser.id,
          status: 'Presente'
        }
      }).exec();

      const now = new Date().toISOString();

      if (activeShift) {
        // Clock out
        const checkInTime = new Date(activeShift.get('checkIn'));
        const checkOutTime = new Date(now);
        const diffHours = Number(((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2));

        await activeShift.patch({
          checkOut: now,
          hoursWorked: diffHours,
          status: 'Completado',
          pendingSync: true,
          updatedAt: now
        });

        logAuditEvent(user, 'ASISTENCIA_SALIDA', {
          employeeName: matchingUser.name,
          checkIn: activeShift.get('checkIn'),
          checkOut: now,
          hoursWorked: diffHours
        });

        setAlertConfig({
          title: 'Salida Registrada',
          message: `¡Hasta luego, ${matchingUser.name}! Tu salida se registró a las ${checkOutTime.toLocaleTimeString()}. Horas del turno: ${diffHours} hrs.`,
          type: 'success'
        });
      } else {
        // Clock in
        const id = 'att_' + Date.now();
        await db.attendance.insert({
          id,
          employeeId: matchingUser.id,
          employeeName: matchingUser.name,
          checkIn: now,
          status: 'Presente',
          pendingSync: true,
          createdAt: now,
          updatedAt: now
        });

        logAuditEvent(user, 'ASISTENCIA_ENTRADA', {
          employeeName: matchingUser.name,
          checkIn: now
        });

        setAlertConfig({
          title: 'Entrada Registrada',
          message: `¡Bienvenido(a), ${matchingUser.name}! Tu entrada se registró a las ${new Date(now).toLocaleTimeString()}. ¡Que tengas un excelente turno!`,
          type: 'success'
        });
      }

      setPinInput('');
    } catch (e: any) {
      console.error(e);
      setAlertConfig({
        title: 'Error de Asistencia',
        message: 'Ocurrió un error al registrar la asistencia: ' + e.message,
        type: 'error'
      });
      setPinInput('');
    }
  };

  // Filters and Pagination
  const filteredPayrolls = payrolls.filter(pay => {
    const term = searchTerm.toLowerCase();
    return (
      (pay.employeeName || '').toLowerCase().includes(term) ||
      pay.id.toLowerCase().includes(term) ||
      pay.status.toLowerCase().includes(term)
    );
  });

  const filteredEmployees = employees.filter(emp => {
    const term = searchTerm.toLowerCase();
    return (
      emp.name.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term) ||
      emp.role.toLowerCase().includes(term)
    );
  });

  const filteredAttendance = attendanceLogs.filter(log => {
    const term = searchTerm.toLowerCase();
    return (
      log.employeeName.toLowerCase().includes(term) ||
      log.status.toLowerCase().includes(term)
    );
  });

  useEffect(() => { setCurrentPage(1); }, [searchTerm, activeSubTab]);
  const totalPages = Math.ceil(
    (activeSubTab === 'payrolls' ? filteredPayrolls.length : activeSubTab === 'employees' ? filteredEmployees.length : filteredAttendance.length) / ITEMS_PER_PAGE
  );
  
  const getPaginatedList = () => {
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    if (activeSubTab === 'payrolls') return filteredPayrolls.slice(offset, offset + ITEMS_PER_PAGE);
    if (activeSubTab === 'employees') return filteredEmployees.slice(offset, offset + ITEMS_PER_PAGE);
    return filteredAttendance.slice(offset, offset + ITEMS_PER_PAGE);
  };

  return (
    <div className="view-container-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: PESTAÑAS Y CONTROL DE NÓMINA */}
      <div className="widget view-header-widget" style={{ padding: '12px 20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveSubTab('payrolls')}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--button-radius)',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: activeSubTab === 'payrolls' ? 'var(--bg-input)' : 'transparent',
                color: activeSubTab === 'payrolls' ? 'var(--brand-teal)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <DollarSign size={15} />
              Liquidaciones y Pagos
            </button>
            <button
              onClick={() => setActiveSubTab('employees')}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--button-radius)',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: activeSubTab === 'employees' ? 'var(--bg-input)' : 'transparent',
                color: activeSubTab === 'employees' ? 'var(--brand-teal)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Users size={15} />
              Personal y Comisiones
            </button>
            <button
              onClick={() => setActiveSubTab('attendance')}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--button-radius)',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: activeSubTab === 'attendance' ? 'var(--bg-input)' : 'transparent',
                color: activeSubTab === 'attendance' ? 'var(--brand-teal)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Clock size={15} />
              Control de Asistencia
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="view-header-pill pill-teal" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Tasa Oficial: <strong>Bs. {dolarRate.toFixed(2)}</strong>
            </span>
            {activeSubTab === 'payrolls' && isAdmin && (
              <button 
                onClick={() => setShowAddForm(true)}
                className="btn-yellow"
                style={{ padding: '8px 16px', borderRadius: 'var(--button-radius)' }}
              >
                <Plus size={14} />
                <span>Registrar Pago</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* SECCIÓN 2: RENDERIZADO DE SUB-MÓDULO SELECCIONADO */}
      
      {/* SUB-TAB 1: HISTORIAL DE NÓMINAS */}
      {activeSubTab === 'payrolls' && (
        <div className="widget view-content-widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
          <div className="widget-header" style={{ marginBottom: '16px' }}>
            <h3 className="widget-title">Libro de Nómina Bimonetario</h3>
          </div>

          <div className="details-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>EMPLEADO</th>
                  <th style={{ padding: '10px 8px' }}>FECHA PAGO</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>SALARIO BASE</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>HORAS</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>BONOS / COMIS.</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>DEDUCC. / ANTIC.</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>TOTAL NETO</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>MONEDA / MÉTODO</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayrolls.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      No se encontraron registros de nóminas.
                    </td>
                  </tr>
                ) : (
                  getPaginatedList().map((pay: any) => {
                    const advances = (pay.advancesUSD || 0) + ((pay.advancesVES || 0) / (pay.dolarRate || dolarRate));
                    return (
                      <tr key={pay.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>{pay.employeeName}</td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{new Date(pay.paymentDate).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>{formatUSD(pay.baseSalary)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700 }}>{pay.hoursWorked} hrs</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>+{formatUSD(pay.bonuses)}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>
                          -{formatUSD(pay.deductions)}
                          {advances > 0 && (
                            <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-muted)' }}>
                              (Antic: {formatUSD(advances)})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-teal)' }}>
                          <div>{formatUSD(pay.totalPaid)}</div>
                          {pay.paymentCurrency !== 'USD' && (
                            <span style={{ fontSize: '10.5px', color: 'var(--brand-gold)', fontFamily: 'monospace' }}>
                              Bs. {(pay.paidInVES || (pay.totalPaid * (pay.dolarRate || dolarRate))).toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <span className="status-badge delivered" style={{ fontSize: '10px' }}>
                            {pay.paymentCurrency} - {pay.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {isAdmin && (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleEditPayroll(pay)}
                                style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'var(--bg-input)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
                                title="Editar Liquidación"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(pay)}
                                style={{ padding: '4px', borderRadius: '6px', minWidth: '24px', height: '24px', backgroundColor: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                title="Eliminar Registro"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PERSONAL Y COMISIONES */}
      {activeSubTab === 'employees' && (
        <div className="widget view-content-widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column' }}>
          <div className="widget-header" style={{ marginBottom: '16px' }}>
            <h3 className="widget-title">Estructura Salarial y Comisiones por Venta</h3>
          </div>

          <div className="details-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>COLABORADOR</th>
                  <th style={{ padding: '10px 8px' }}>ROL</th>
                  <th style={{ padding: '10px 8px' }}>CORREO</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>SUELDO BASE ($)</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>TASA COMISIÓN (%)</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>VENTAS MES ACTUAL</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>COMISIÓN ACUMULADA</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp: any) => {
                  const stat = salesData[emp.id] || { totalSales: 0, commission: 0 };
                  const isSalesRole = emp.role === 'CASHIER' || emp.role === 'ADMIN';
                  return (
                    <tr key={emp.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>{emp.name}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                        <span className="status-badge" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '10px' }}>
                          {emp.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{emp.email}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700 }}>
                        {emp.baseSalary ? formatUSD(emp.baseSalary) : '$0.00'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700, color: 'var(--brand-teal)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                          <Percent size={11} />
                          <span>{((emp.commissionRate || 0) * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {isSalesRole ? formatUSD(stat.totalSales) : 'N/A'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: stat.commission > 0 ? '#10b981' : 'var(--text-muted)' }}>
                        {isSalesRole ? formatUSD(stat.commission) : 'N/A'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {isAdmin && (
                            <button
                              onClick={() => handleEditEmployeeClick(emp)}
                              className="btn-pill-dark"
                              style={{ padding: '5px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', backgroundColor: 'var(--bg-input)' }}
                              title="Configurar Parámetros"
                            >
                              <Edit size={11} />
                              <span>Configurar</span>
                            </button>
                          )}
                          {isAdmin && isSalesRole && stat.commission > 0 && (
                            <button
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setBaseSalary((emp.baseSalary || 0).toString());
                                setBonuses(stat.commission.toFixed(2));
                                setShowAddForm(true);
                              }}
                              className="btn-yellow"
                              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '8px' }}
                            >
                              Liquidar Comisión
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CONTROL DE ASISTENCIA (PIN PAD & LOGS) */}
      {activeSubTab === 'attendance' && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* PIN PAD CARD */}
          <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', border: '1.5px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <div style={{ textAlign: 'center' }}>
              <Smartphone size={28} style={{ color: 'var(--brand-teal)', marginBottom: '8px' }} />
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>Terminal de Asistencia</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>Ingrese su PIN de 4 dígitos para marcar turno</p>
            </div>

            {/* Display screen */}
            <div style={{
              width: '100%',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              border: '1.5px solid var(--border-color)',
              minHeight: '56px'
            }}>
              {[0, 1, 2, 3].map(idx => (
                <div key={idx} style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: pinInput.length > idx ? 'var(--brand-teal)' : 'var(--bg-input)',
                  border: pinInput.length > idx ? '1px solid var(--brand-teal)' : '1px solid var(--border-color)',
                  transition: 'all 0.15s ease'
                }} />
              ))}
            </div>

            {/* Keypad Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              width: '100%'
            }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinKeyPress(num)}
                  disabled={pinInput.length === 4}
                  style={{
                    height: '56px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '18px',
                    fontWeight: 800,
                    cursor: pinInput.length === 4 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.1s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="table-row-hover"
                >
                  {num}
                </button>
              ))}
              
              <button
                type="button"
                onClick={handlePinClear}
                style={{
                  height: '56px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                CLEAR
              </button>

              <button
                type="button"
                onClick={() => handlePinKeyPress('0')}
                disabled={pinInput.length === 4}
                style={{
                  height: '56px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '18px',
                  fontWeight: 800,
                  cursor: pinInput.length === 4 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                className="table-row-hover"
              >
                0
              </button>

              <button
                type="button"
                onClick={handlePinBackspace}
                style={{
                  height: '56px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                className="table-row-hover"
              >
                ⌫
              </button>
            </div>
          </div>

          {/* ATTENDANCE LOGS TABLE */}
          <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', flex: 1, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div className="widget-header" style={{ marginBottom: '16px' }}>
              <h3 className="widget-title">Historial de Asistencia y Turnos</h3>
            </div>

            <div className="details-table-wrapper" style={{ overflowX: 'auto' }}>
              <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1.5px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px 8px' }}>COLABORADOR</th>
                    <th style={{ padding: '10px 8px' }}>FECHA</th>
                    <th style={{ padding: '10px 8px' }}>ENTRADA</th>
                    <th style={{ padding: '10px 8px' }}>SALIDA</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>HORAS TURNO</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                        No hay registros de turnos de asistencia.
                      </td>
                    </tr>
                  ) : (
                    getPaginatedList().map((log: any) => {
                      const date = new Date(log.checkIn);
                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>{log.employeeName}</td>
                          <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{date.toLocaleDateString()}</td>
                          <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{date.toLocaleTimeString()}</td>
                          <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>
                            {log.checkOut ? new Date(log.checkOut).toLocaleTimeString() : '—'}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-teal)' }}>
                            {log.hoursWorked ? `${log.hoursWorked.toFixed(2)} hrs` : 'En Curso'}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <span className={`status-badge ${log.status === 'Presente' ? 'pickup' : 'delivered'}`} style={{ fontSize: '10px' }}>
                              {log.status === 'Presente' ? 'Activo (Entrada)' : 'Completado'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* C4: Pagination Controls (Shared) */}
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
            style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.45 : 1 }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* MODAL 1: REGISTRAR PAGO NÓMINA BIMONETARIO */}
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
          <div className="widget modal-registration-content" style={{
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
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} style={{ color: 'var(--brand-teal)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Registrar Pago de Nómina Bimonetario
                </h4>
              </div>
              <button 
                onClick={() => setShowAddForm(false)}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterPayroll} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', flex: 1 }}>
                {errorMessage && (
                  <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 14px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', border: '1.5px solid rgba(239, 68, 68, 0.15)' }}>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                      required
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
                      required
                      style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                    />
                  </div>
                </div>

                {/* Cashier commissions helper display */}
                {selectedEmployeeId && salesData[selectedEmployeeId] && salesData[selectedEmployeeId].commission > 0 && (
                  <div style={{
                    backgroundColor: 'rgba(32, 227, 178, 0.05)',
                    border: '1.5px solid rgba(32, 227, 178, 0.2)',
                    borderRadius: '12px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>Ventas del mes: <strong>{formatUSD(salesData[selectedEmployeeId].totalSales)}</strong></span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--brand-teal)' }}>Comisión Acumulada: {formatUSD(salesData[selectedEmployeeId].commission)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBonuses(salesData[selectedEmployeeId].commission.toFixed(2))}
                      className="btn-yellow"
                      style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '8px' }}
                    >
                      Aplicar como Bono
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Otros Bonos ($)
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

                {/* DEDUCCIONES DE LEY VENEZOLANA */}
                {Number(baseSalary) > 0 && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.04)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Deducciones de Ley (automáticas)
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '12px' }}>
                      <div style={{ color: 'var(--text-muted)' }}>SSO (4%): <strong style={{ color: 'var(--text-primary)' }}>{formatUSD(calcSSO())}</strong></div>
                      <div style={{ color: 'var(--text-muted)' }}>LPH (2%): <strong style={{ color: 'var(--text-primary)' }}>{formatUSD(calcLPH())}</strong></div>
                      <div style={{ color: 'var(--text-muted)' }}>FAOV (1%): <strong style={{ color: 'var(--text-primary)' }}>{formatUSD(calcFAOV())}</strong></div>
                    </div>
                    <div style={{
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      fontWeight: 800
                    }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Ded. Ley:</span>
                      <span style={{ color: '#ef4444' }}>{formatUSD(calcSSO() + calcLPH() + calcFAOV())}</span>
                    </div>
                  </div>
                )}

                {/* ADELANTOS / ANTICIPOS SECTION */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '14px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Registro de Adelantos / Anticipos tomados
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                        Adelantos USD (Efectivo)
                      </label>
                      <input 
                        type="number" 
                        value={advancesUSD} 
                        onChange={(e) => setAdvancesUSD(e.target.value)}
                        className="search-input"
                        style={{ padding: '8px 12px', borderRadius: '10px', width: '100%', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                        Adelantos VES (Pago Móvil/Efectivo)
                      </label>
                      <input 
                        type="number" 
                        value={advancesVES} 
                        onChange={(e) => setAdvancesVES(e.target.value)}
                        className="search-input"
                        style={{ padding: '8px 12px', borderRadius: '10px', width: '100%', fontSize: '12px' }}
                      />
                      <span style={{ fontSize: '8.5px', color: 'var(--text-muted)', float: 'right' }}>
                        equiv. {formatUSD(Number(advancesVES) / dolarRate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MONEDA DE PAGO & METODO */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Moneda de Pago *
                    </label>
                    <CustomSelect 
                      value={paymentCurrency}
                      onChange={(val: any) => setPaymentCurrency(val)}
                      options={[
                        { value: 'USD', label: 'Dólares (USD)' },
                        { value: 'VES', label: 'Bolívares (VES)' },
                        { value: 'MIXTO', label: 'Pago Mixto' }
                      ]}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Método de Pago *
                    </label>
                    <CustomSelect 
                      value={paymentMethod}
                      onChange={(val: any) => setPaymentMethod(val)}
                      options={[
                        { value: 'Transferencia', label: 'Transferencia' },
                        { value: 'Efectivo', label: 'Efectivo' },
                        { value: 'Pago Móvil', label: 'Pago Móvil' },
                        { value: 'Mixto', label: 'Mixto' }
                      ]}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* MIXED CURRENCY DETAIL INPUTS */}
                {paymentCurrency === 'MIXTO' && (
                  <div style={{ backgroundColor: 'rgba(251,191,36,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase' }}>
                      Desglose de Pago Mixto
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Desembolso USD</label>
                        <input 
                          type="number" 
                          value={paidInUSD}
                          onChange={(e) => setPaidInUSD(e.target.value)}
                          className="search-input"
                          style={{ padding: '8px 12px', borderRadius: '10px', width: '100%' }}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Desembolso VES</label>
                        <input 
                          type="number" 
                          value={paidInVES}
                          onChange={(e) => setPaidInVES(e.target.value)}
                          className="search-input"
                          style={{ padding: '8px 12px', borderRadius: '10px', width: '100%' }}
                          placeholder="Bs. 0.00"
                        />
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Equivalencia total ingresada: <strong>{formatUSD(Number(paidInUSD || 0) + (Number(paidInVES || 0) / dolarRate))}</strong> de un neto de <strong>{formatUSD(calculatedTotalNet())}</strong>
                    </span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Fecha de Liquidación
                    </label>
                    <CustomDatePicker 
                      value={paymentDate}
                      onChange={setPaymentDate}
                      placeholder="Seleccionar fecha"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Final calculated total card */}
                <div style={{ alignSelf: 'stretch', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', backgroundColor: 'var(--bg-primary)', borderRadius: '14px', border: '1.5px solid var(--border-color)', marginTop: '8px' }}>
                  <div>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', display: 'block' }}>TOTAL NETO COMPENSADO (USD)</span>
                    <strong style={{ fontSize: '17px', color: 'var(--brand-teal)' }}>{formatUSD(calculatedTotalNet())}</strong>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', display: 'block' }}>PAGO EQUIVALENTE EN BOLÍVARES</span>
                    <strong style={{ fontSize: '17px', color: 'var(--brand-gold)' }}>
                      Bs. {(calculatedTotalNet() * dolarRate).toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </strong>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-input)', ...(isMobile ? { position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 10 } : {}) }}>
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
                  Confirmar Liquidación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR PAGO NÓMINA */}
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
          <div className="widget modal-registration-content" style={{
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
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit size={18} style={{ color: 'var(--brand-teal)' }} />
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Editar Nómina — {editingPayroll.employeeName}
                </h4>
              </div>
              <button 
                onClick={() => { setShowEditModal(false); setEditingPayroll(null); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditPayroll} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
              <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', flex: 1 }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Salario Base ($) *
                    </label>
                    <input 
                      type="number" 
                      value={editPayrollForm.baseSalary}
                      onChange={(e) => setEditPayrollForm({ ...editPayrollForm, baseSalary: e.target.value })}
                      className="search-input"
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
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Otros Bonos ($)
                    </label>
                    <input 
                      type="number" 
                      value={editPayrollForm.bonuses}
                      onChange={(e) => setEditPayrollForm({ ...editPayrollForm, bonuses: e.target.value })}
                      className="search-input"
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
                    />
                  </div>
                </div>

                {/* DEDUCCIONES DE LEY (EDIT) */}
                {Number(editPayrollForm.baseSalary) > 0 && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.04)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontSize: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>SSO (4%):</span>
                      <span>{formatUSD(Math.min(Number(editPayrollForm.baseSalary), SALARY_CAP) * SSO_RATE)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>LPH (2%):</span>
                      <span>{formatUSD(Math.min(Number(editPayrollForm.baseSalary), SALARY_CAP) * LPH_RATE)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>FAOV (1%):</span>
                      <span>{formatUSD(Number(editPayrollForm.baseSalary) * FAOV_RATE)}</span>
                    </div>
                  </div>
                )}

                {/* ADELANTOS EN EDICIÓN */}
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)' }}>ADEDANTOS REGISTRADOS</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Adelantos USD</label>
                      <input 
                        type="number" 
                        value={editPayrollForm.advancesUSD} 
                        onChange={(e) => setEditPayrollForm({ ...editPayrollForm, advancesUSD: e.target.value })}
                        className="search-input"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Adelantos VES</label>
                      <input 
                        type="number" 
                        value={editPayrollForm.advancesVES} 
                        onChange={(e) => setEditPayrollForm({ ...editPayrollForm, advancesVES: e.target.value })}
                        className="search-input"
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Moneda de Pago *
                    </label>
                    <CustomSelect 
                      value={editPayrollForm.paymentCurrency}
                      onChange={(val: any) => setEditPayrollForm({ ...editPayrollForm, paymentCurrency: val })}
                      options={[
                        { value: 'USD', label: 'Dólares (USD)' },
                        { value: 'VES', label: 'Bolívares (VES)' },
                        { value: 'MIXTO', label: 'Pago Mixto' }
                      ]}
                    />
                  </div>
                  <div>
                    <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                      Método de Pago *
                    </label>
                    <CustomSelect 
                      value={editPayrollForm.paymentMethod}
                      onChange={(val: any) => setEditPayrollForm({ ...editPayrollForm, paymentMethod: val })}
                      options={[
                        { value: 'Transferencia', label: 'Transferencia' },
                        { value: 'Efectivo', label: 'Efectivo' },
                        { value: 'Pago Móvil', label: 'Pago Móvil' },
                        { value: 'Mixto', label: 'Mixto' }
                      ]}
                    />
                  </div>
                </div>

                {editPayrollForm.paymentCurrency === 'MIXTO' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Desembolso USD</label>
                      <input 
                        type="number" 
                        value={editPayrollForm.paidInUSD}
                        onChange={(e) => setEditPayrollForm({ ...editPayrollForm, paidInUSD: e.target.value })}
                        className="search-input"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Desembolso VES</label>
                      <input 
                        type="number" 
                        value={editPayrollForm.paidInVES}
                        onChange={(e) => setEditPayrollForm({ ...editPayrollForm, paidInVES: e.target.value })}
                        className="search-input"
                      />
                    </div>
                  </div>
                )}

              </div>

              <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingPayroll(null); }}
                  className="btn-pill-dark"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-yellow"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIGURAR EMPLEADO (SUELDO Y COMISION) */}
      {showEditEmployeeModal && editingEmployee && (
        <div className="modal-registration-backdrop" style={{
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
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: 'var(--brand-teal)' }} />
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Configuración: {editingEmployee.name}
                </h4>
              </div>
              <button 
                onClick={() => { setShowEditEmployeeModal(false); setEditingEmployee(null); }}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEmployeeSettings} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                  Sueldo Mensual Base ($)
                </label>
                <input 
                  type="number" 
                  value={editBaseSalary}
                  onChange={(e) => setEditBaseSalary(e.target.value)}
                  className="search-input"
                  placeholder="0.00"
                  style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>
                  Porcentaje de Comisión Ventas (%)
                </label>
                <input 
                  type="number" 
                  value={editCommissionRate}
                  onChange={(e) => setEditCommissionRate(e.target.value)}
                  className="search-input"
                  placeholder="Ej: 5"
                  style={{ padding: '10px 14px', borderRadius: '12px', border: '1.5px solid var(--border-color)', width: '100%' }}
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  El cajero acumulará este porcentaje sobre sus ventas facturadas mensualmente.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditEmployeeModal(false); setEditingEmployee(null); }}
                  className="btn-pill-dark"
                  style={{ padding: '8px 16px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-primary)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-yellow"
                  style={{ padding: '8px 20px', borderRadius: 'var(--button-radius)' }}
                >
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ALERTA Y MENSAJES */}
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
          <div className="widget" style={{
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
                backgroundColor: alertConfig.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : alertConfig.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(32, 227, 178, 0.1)', 
                padding: '14px', 
                borderRadius: '50%', 
                color: alertConfig.type === 'error' ? '#ef4444' : alertConfig.type === 'success' ? '#22c55e' : 'var(--brand-teal)' 
              }}>
                <CheckCircle size={32} />
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

      {/* MODAL 5: CONFIRMACIÓN BORRADO NÓMINA */}
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
