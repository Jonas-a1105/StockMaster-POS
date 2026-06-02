import { useState, useEffect } from 'react';
import { 
  Lock, Unlock, DollarSign, RefreshCw, FileText, Printer, ShieldAlert, Award, Calendar, Clock, AlertTriangle, ArrowRight, PlayCircle, Download
} from 'lucide-react';
import { getDatabase, type SaleDocType } from '../db/database';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';
import { useToast } from './ToastNotification';

interface CierreCajaProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface ActiveShift {
  openTime: string; // ISO string
  openUSD: number;
  openVES: number;
  cashierName: string;
}

interface ArqueoReport {
  id: string;
  openTime: string;
  closeTime: string;
  cashierName: string;
  openUSD: number;
  openVES: number;
  expectedUSD: number;
  expectedVES: number;
  expectedCardVES: number;
  declaredUSD: number;
  declaredVES: number;
  declaredCardVES: number;
  diffUSD: number;
  diffVES: number;
  diffCardVES: number;
  totalSalesUSD: number;
}

export default function CierreCaja({ user }: CierreCajaProps) {
  const { convertToVES, formatVES, formatUSD, dolarRate } = useExchangeRate();
  const { settings, updateSettings } = useBusinessSettings();
  const { addToast } = useToast();

  const [activeShift, setActiveShift] = useState<ActiveShift | null>(null);
  const [openingUSD, setOpeningUSD] = useState('50');
  const [openingVES, setOpeningVES] = useState('0');
  
  // Declaration Form Inputs
  const [declaredUSD, setDeclaredUSD] = useState('');
  const [declaredVES, setDeclaredVES] = useState('');
  const [declaredCardVES, setDeclaredCardVES] = useState('');

  // Expected totals computed from DB
  const [salesList, setSalesList] = useState<SaleDocType[]>([]);
  const [expectedSalesUSD, setExpectedSalesUSD] = useState(0);
  const [expectedSalesVES, setExpectedSalesVES] = useState(0);
  const [expectedCardVES, setExpectedCardVES] = useState(0);

  // Past closures history
  const [arqueoHistory, setArqueoHistory] = useState<ArqueoReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ArqueoReport | null>(null);

  const isAdmin = user.role === 'ADMIN';

  // Load shift, sales and history
  useEffect(() => {
    // 1. Shift details
    const savedShift = localStorage.getItem('stockmaster_active_shift');
    if (savedShift) {
      setActiveShift(JSON.parse(savedShift));
    }

    // 2. Closed shifts history
    const savedHistory = localStorage.getItem('stockmaster_arqueo_history');
    if (savedHistory) {
      setArqueoHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Compute expected sales from DB whenever activeShift or database changes
  useEffect(() => {
    if (!activeShift) {
      setSalesList([]);
      setExpectedSalesUSD(0);
      setExpectedSalesVES(0);
      setExpectedCardVES(0);
      return;
    }

    const fetchShiftSales = async () => {
      try {
        const db = await getDatabase();
        const salesDocs = await db.sales.find({
          selector: {
            createdAt: { $gte: activeShift.openTime }
          }
        }).exec();

        const sales = salesDocs.map(doc => doc.toJSON() as SaleDocType);
        setSalesList(sales);

        let cashUSD = 0;
        let cashVES = 0;
        let cardVES = 0;

        sales.forEach(sale => {
          // Approximate currency allocation based on paymentMethod
          if (sale.paymentMethod === 'EFECTIVO' || sale.paymentMethod === 'EFECTIVO USD') {
            cashUSD += sale.total; // in USD
          } else if (sale.paymentMethod === 'TARJETA') {
            cardVES += sale.total * sale.dolarRate; // converted to VES
          } else if (sale.paymentMethod === 'MIXTO') {
            // Mixed: let's assume half was cash USD, half card VES
            cashUSD += sale.total * 0.5;
            cardVES += (sale.total * 0.5) * sale.dolarRate;
          } else {
            // Transferencia or others
            cardVES += sale.total * sale.dolarRate;
          }
        });

        setExpectedSalesUSD(cashUSD);
        setExpectedSalesVES(cashVES);
        setExpectedCardVES(cardVES);

      } catch (err) {
        console.error('Error fetching shift sales:', err);
      }
    };

    fetchShiftSales();

    // Setup DB change subscription
    let sub: any;
    getDatabase().then(db => {
      sub = db.sales.find({
        selector: {
          createdAt: { $gte: activeShift.openTime }
        }
      }).$.subscribe(() => {
        fetchShiftSales();
      });
    });

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [activeShift]);

  // Open Shift Handler
  const handleOpenShift = () => {
    const oUSD = parseFloat(openingUSD) || 0;
    const oVES = parseFloat(openingVES) || 0;

    const newShift: ActiveShift = {
      openTime: new Date().toISOString(),
      openUSD: oUSD,
      openVES: oVES,
      cashierName: user.name
    };

    localStorage.setItem('stockmaster_active_shift', JSON.stringify(newShift));
    setActiveShift(newShift);
    updateSettings({ isPOSLocked: false }); // Unlock POS for selling
    
    // Clear inputs
    setDeclaredUSD('');
    setDeclaredVES('');
    setDeclaredCardVES('');

    addToast({ 
      type: 'success', 
      title: 'Turno de Caja Abierto', 
      message: `Caja abierta con base de cambio de ${formatUSD(oUSD)} / Bs. ${oVES.toLocaleString('es-VE')}`
    });
  };

  // Close Shift & Arqueo Handler
  const handleCloseShift = () => {
    if (!activeShift) return;

    const decUSD = parseFloat(declaredUSD) || 0;
    const decVES = parseFloat(declaredVES) || 0;
    const decCardVES = parseFloat(declaredCardVES) || 0;

    // Expected USD includes starting float + sales USD
    const totalExpectedUSD = activeShift.openUSD + expectedSalesUSD;
    const totalExpectedVES = activeShift.openVES + expectedSalesVES;

    const diffUSD = decUSD - totalExpectedUSD;
    const diffVES = decVES - totalExpectedVES;
    const diffCardVES = decCardVES - expectedCardVES;

    const totalSalesUSD = salesList.reduce((sum, s) => sum + s.total, 0);

    const report: ArqueoReport = {
      id: `ARQ-${Date.now().toString().slice(-6)}`,
      openTime: activeShift.openTime,
      closeTime: new Date().toISOString(),
      cashierName: activeShift.cashierName,
      openUSD: activeShift.openUSD,
      openVES: activeShift.openVES,
      expectedUSD: totalExpectedUSD,
      expectedVES: totalExpectedVES,
      expectedCardVES: expectedCardVES,
      declaredUSD: decUSD,
      declaredVES: decVES,
      declaredCardVES: decCardVES,
      diffUSD: diffUSD,
      diffVES: diffVES,
      diffCardVES: diffCardVES,
      totalSalesUSD
    };

    // Save in history
    const updatedHistory = [report, ...arqueoHistory];
    localStorage.setItem('stockmaster_arqueo_history', JSON.stringify(updatedHistory));
    setArqueoHistory(updatedHistory);

    // Save report time in settings
    updateSettings({ 
      isPOSLocked: true, // Lock the POS!
      lastClosingTime: report.closeTime
    });

    // Clear active shift from local storage
    localStorage.removeItem('stockmaster_active_shift');
    setActiveShift(null);
    setSelectedReport(report); // Display printable report modal

    addToast({
      type: 'warning',
      title: 'Arqueo de Turno Ejecutado',
      message: 'Caja cerrada y POS bloqueado. Se requiere aprobación del administrador para iniciar un nuevo turno.'
    });
  };

  // Admin Unlock POS directly
  const handleAdminUnlock = () => {
    if (!isAdmin) {
      addToast({ 
        type: 'error', 
        title: 'Acceso Denegado', 
        message: 'Solo el administrador puede desbloquear la caja registradora.' 
      });
      return;
    }
    updateSettings({ isPOSLocked: false });
    addToast({ 
      type: 'success', 
      title: 'POS Desbloqueado', 
      message: 'Se ha liberado la caja. Inicie un nuevo turno.' 
    });
  };
  const handleExportCSV = (report: ArqueoReport) => {
    const csvContent = [
      ["Reporte de Cierre de Caja Z", report.id],
      ["Empresa", settings.businessName],
      ["RIF", settings.businessRIF],
      ["Direccion", settings.businessAddress],
      [],
      ["Campo", "Valor"],
      ["Cajero", report.cashierName],
      ["Hora de Apertura", new Date(report.openTime).toLocaleString('es-VE')],
      ["Hora de Cierre", new Date(report.closeTime).toLocaleString('es-VE')],
      ["Fondo Inicial USD ($)", report.openUSD.toFixed(2)],
      ["Fondo Inicial VES (Bs.)", report.openVES.toFixed(2)],
      ["Declarado USD ($)", report.declaredUSD.toFixed(2)],
      ["Declarado VES (Bs.)", report.declaredVES.toFixed(2)],
      ["Declarado Puntos VES (Bs.)", report.declaredCardVES.toFixed(2)],
      ["Esperado USD ($)", report.expectedUSD.toFixed(2)],
      ["Esperado VES (Bs.)", report.expectedVES.toFixed(2)],
      ["Esperado Puntos VES (Bs.)", report.expectedCardVES.toFixed(2)],
      ["Diferencia USD ($)", report.diffUSD.toFixed(2)],
      ["Diferencia VES (Bs.)", report.diffVES.toFixed(2)],
      ["Diferencia Puntos VES (Bs.)", report.diffCardVES.toFixed(2)],
      ["Total Ventas USD ($)", report.totalSalesUSD.toFixed(2)]
    ]
    .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
    .join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `cierre_caja_${report.id}_${new Date(report.closeTime).toISOString().split('T')[0]}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({
      type: 'success',
      title: 'Reporte CSV Exportado',
      message: `El archivo ${filename} se ha descargado correctamente.`
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }} className="animate-entrance">
      
      {/* HEADER WIDGET */}
      <div className="widget" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-main)' }}>
              🔒 Cierre de Caja / Arqueo de Turno
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Realiza la declaración física del cajero, evalúa diferencias de efectivo y genera reportes X/Z.
            </p>
          </div>
          {settings.isPOSLocked && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#ef4444',
              fontSize: '11.5px',
              fontWeight: 800,
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              <Lock size={14} />
              <span>CAJA REGISTRADORA BLOQUEADA</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* LEFT COLUMN: ACTIVE CONTROL SHIFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* APERTURA DE CAJA (IF NO ACTIVE SHIFT) */}
          {!activeShift && !settings.isPOSLocked && (
            <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <PlayCircle size={22} style={{ color: 'var(--brand-teal)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Apertura de Turno y Fondo de Caja
                </h3>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Declara el fondo inicial en divisas y bolívares disponible en la gaveta de caja para dar vuelto a los clientes.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Fondo Inicial USD ($)
                  </label>
                  <input 
                    type="number" 
                    value={openingUSD} 
                    onChange={(e) => setOpeningUSD(e.target.value)} 
                    className="search-input" 
                    placeholder="50.00"
                    style={{ height: '42px', padding: '0 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Fondo Inicial VES (Bs.)
                  </label>
                  <input 
                    type="number" 
                    value={openingVES} 
                    onChange={(e) => setOpeningVES(e.target.value)} 
                    className="search-input" 
                    placeholder="0.00"
                    style={{ height: '42px', padding: '0 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 700 }}
                  />
                </div>
              </div>

              <button
                onClick={handleOpenShift}
                className="btn-yellow"
                style={{ padding: '12px', borderRadius: '12px', justifyContent: 'center', fontWeight: 800, fontSize: '13px', marginTop: '10px' }}
              >
                ABRIR TURNO Y HABILITAR CAJA
              </button>
            </div>
          )}

          {/* POS BLOQUEADO / ESPERANDO APROBACIÓN ADMIN */}
          {settings.isPOSLocked && (
            <div className="widget" style={{ 
              padding: '30px', 
              borderRadius: 'var(--card-radius)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '16px',
              textAlign: 'center',
              border: '2px dashed rgba(239, 68, 68, 0.3)',
              backgroundColor: 'rgba(239, 68, 68, 0.02)'
            }}>
              <div style={{ padding: '16px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                <Lock size={32} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Caja Registradora Cerrada
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.5, margin: 0 }}>
                Se completó el arqueo de caja físico. La caja registradora se encuentra inhabilitada para nuevas transacciones hasta que el Administrador valide los balances e inicie un nuevo turno de ventas.
              </p>
              
              {isAdmin ? (
                <button
                  onClick={handleAdminUnlock}
                  className="btn-yellow"
                  style={{ padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, marginTop: '10px' }}
                >
                  <Unlock size={16} />
                  <span>APROBAR CIERRE Y LIBERAR POS</span>
                </button>
              ) : (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1.5px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <ShieldAlert size={14} style={{ color: 'var(--brand-gold)' }} />
                  <span>Comuníquese con un Administrador para abrir el próximo turno fiscal.</span>
                </div>
              )}
            </div>
          )}

          {/* TURNO ACTIVO - ARQUEO DECLARATIVO */}
          {activeShift && (
            <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} style={{ color: 'var(--brand-gold)' }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Turno en Ejecución
                  </h3>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Apertura: {new Date(activeShift.openTime).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Stats Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', backgroundColor: 'var(--bg-primary)', padding: '14px', borderRadius: '16px', border: '1.5px solid var(--border-color)' }}>
                <div>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fondo Inicial (USD)</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>{formatUSD(activeShift.openUSD)}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ventas del Turno</span>
                  <strong style={{ fontSize: '14px', color: 'var(--brand-teal)', display: 'block', marginTop: '2px' }}>{salesList.length} facturas</strong>
                </div>
                <div>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Vendido USD</span>
                  <strong style={{ fontSize: '14px', color: 'var(--brand-gold)', display: 'block', marginTop: '2px' }}>{formatUSD(salesList.reduce((s, x) => s + x.total, 0))}</strong>
                </div>
              </div>

              {/* Arqueo Declarativo Inputs */}
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Declaración de Caja Física (Efectivo & Comprobantes)
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Divisas físicas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>Efectivo USD Físico ($)</label>
                      <input 
                        type="number" 
                        value={declaredUSD} 
                        onChange={(e) => setDeclaredUSD(e.target.value)} 
                        className="search-input" 
                        placeholder="0.00"
                        style={{ height: '40px', padding: '0 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>Efectivo VES Físico (Bs.)</label>
                      <input 
                        type="number" 
                        value={declaredVES} 
                        onChange={(e) => setDeclaredVES(e.target.value)} 
                        className="search-input" 
                        placeholder="0.00"
                        style={{ height: '40px', padding: '0 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}
                      />
                    </div>
                  </div>

                  {/* Tarjetas / Puntos de Venta (Bs.) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>Lote del Punto de Venta / Tarjetas (Bs. VES)</label>
                    <input 
                      type="number" 
                      value={declaredCardVES} 
                      onChange={(e) => setDeclaredCardVES(e.target.value)} 
                      className="search-input" 
                      placeholder="0.00"
                      style={{ height: '40px', padding: '0 12px', borderRadius: '12px', border: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700 }}
                    />
                  </div>
                </div>
              </div>

              {/* Reactive Comparatives Table */}
              <div style={{ marginTop: '10px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Auditoría en Tiempo Real de Diferencias
                </h4>
                <div style={{
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  fontSize: '12px'
                }}>
                  {/* Table Head */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '10px 14px', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    <span>Moneda</span>
                    <span>Esperado</span>
                    <span>Declarado</span>
                    <span>Diferencia</span>
                  </div>

                  {/* USD Cash Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '12px 14px', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                    <strong>USD Cash</strong>
                    <span>{formatUSD(activeShift.openUSD + expectedSalesUSD)}</span>
                    <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{formatUSD(parseFloat(declaredUSD) || 0)}</span>
                    <strong style={{
                      color: (parseFloat(declaredUSD) || 0) - (activeShift.openUSD + expectedSalesUSD) >= 0 ? '#22c55e' : '#ef4444'
                    }}>
                      {formatUSD((parseFloat(declaredUSD) || 0) - (activeShift.openUSD + expectedSalesUSD))}
                    </strong>
                  </div>

                  {/* VES Cash Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '12px 14px', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
                    <strong>VES Cash</strong>
                    <span>Bs. {(activeShift.openVES + expectedSalesVES).toFixed(2)}</span>
                    <span style={{ color: 'var(--brand-gold)', fontWeight: 700 }}>Bs. {(parseFloat(declaredVES) || 0).toFixed(2)}</span>
                    <strong style={{
                      color: (parseFloat(declaredVES) || 0) - (activeShift.openVES + expectedSalesVES) >= 0 ? '#22c55e' : '#ef4444'
                    }}>
                      Bs. {((parseFloat(declaredVES) || 0) - (activeShift.openVES + expectedSalesVES)).toFixed(2)}
                    </strong>
                  </div>

                  {/* VES Cards Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '12px 14px', alignItems: 'center' }}>
                    <strong>Punto Bs.</strong>
                    <span>Bs. {expectedCardVES.toFixed(2)}</span>
                    <span style={{ color: 'var(--brand-gold)', fontWeight: 700 }}>Bs. {(parseFloat(declaredCardVES) || 0).toFixed(2)}</span>
                    <strong style={{
                      color: (parseFloat(declaredCardVES) || 0) - expectedCardVES >= 0 ? '#22c55e' : '#ef4444'
                    }}>
                      Bs. {((parseFloat(declaredCardVES) || 0) - expectedCardVES).toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCloseShift}
                disabled={declaredUSD === '' || declaredVES === '' || declaredCardVES === ''}
                className="btn-yellow"
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                  marginTop: '10px',
                  opacity: (declaredUSD === '' || declaredVES === '' || declaredCardVES === '') ? 0.5 : 1,
                  cursor: (declaredUSD === '' || declaredVES === '' || declaredCardVES === '') ? 'not-allowed' : 'pointer'
                }}
              >
                PROCESAR CIERRE DE CAJA (ARQUEO Z)
              </button>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: PAST HISTORICAL ARQUEOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="widget" style={{ padding: '20px', borderRadius: 'var(--card-radius)', maxHeight: '600px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              📜 Historial de Arqueos
            </h3>
            
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              {arqueoHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  No se registran cierres de caja previos.
                </div>
              ) : (
                arqueoHistory.map((report) => (
                  <div 
                    key={report.id} 
                    onClick={() => setSelectedReport(report)}
                    className="suspended-sale-card"
                    style={{
                      cursor: 'pointer',
                      border: '1.5px solid var(--border-color)',
                      transition: 'all 0.2s ease',
                      backgroundColor: 'var(--bg-input)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text-primary)' }}>{report.id}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {new Date(report.closeTime).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>Cajero: <strong>{report.cashierName}</strong></span>
                      <span>Total Ventas: <strong style={{ color: 'var(--brand-teal)' }}>{formatUSD(report.totalSalesUSD)}</strong></span>
                      <span style={{
                        color: (report.diffUSD < 0 || report.diffVES < 0 || report.diffCardVES < 0) ? '#ef4444' : '#22c55e',
                        fontWeight: 700,
                        fontSize: '9.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '4px'
                      }}>
                        <ShieldAlert size={11} />
                        {(report.diffUSD < 0 || report.diffVES < 0 || report.diffCardVES < 0) ? 'Con Faltante' : 'Arqueo Cuadrado'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* PRINT THERMAL MODAL PREVIEW FOR SELECTED CIERRE Z */}
      {selectedReport && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1600,
          padding: '20px'
        }} onClick={() => setSelectedReport(null)}>
          <div 
            className="widget animate-entrance" 
            style={{
              width: '100%',
              maxWidth: '430px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--brand-gold)', backgroundColor: 'var(--bg-input)' }}>
              <FileText size={20} />
              <strong style={{ fontSize: '14.5px' }}>Comprobante Fiscal - Reporte Z</strong>
            </div>

            {/* Receipt Content */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              
              <div style={{
                backgroundColor: 'white',
                color: '#1a1a1a',
                fontFamily: 'Courier New, Courier, monospace',
                padding: '20px 16px',
                borderRadius: '12px',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
                fontSize: '11.5px',
                lineHeight: '1.4'
              }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>{settings.businessName.toUpperCase()}</div>
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#555' }}>RIF: {settings.businessRIF}</div>
                <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '10px' }}>{settings.businessAddress.toUpperCase()}</div>
                <div style={{ textAlign: 'center', marginBottom: '12px', fontWeight: 'bold' }}>=== ARCHIVO CIERRE FISCAL Z ===</div>
                
                <div>Arqueo ID: {selectedReport.id}</div>
                <div>Cajero: {selectedReport.cashierName}</div>
                <div>Apertura: {new Date(selectedReport.openTime).toLocaleString('es-VE')}</div>
                <div>Cierre: {new Date(selectedReport.closeTime).toLocaleString('es-VE')}</div>
                <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>

                {/* Balances */}
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>FONDO DE APERTURA:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                  <span>Efectivo USD:</span>
                  <span>{formatUSD(selectedReport.openUSD)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px', marginBottom: '8px' }}>
                  <span>Efectivo VES:</span>
                  <span>Bs. {selectedReport.openVES.toFixed(2)}</span>
                </div>

                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>VENTAS DECLARADAS:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                  <span>Físico USD en Caja:</span>
                  <span>{formatUSD(selectedReport.declaredUSD)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                  <span>Físico VES en Caja:</span>
                  <span>Bs. {selectedReport.declaredVES.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px', marginBottom: '8px' }}>
                  <span>Lote de Puntos Tarjeta:</span>
                  <span>Bs. {selectedReport.declaredCardVES.toFixed(2)}</span>
                </div>

                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>BALANCES ESPERADOS:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                  <span>Esperado USD:</span>
                  <span>{formatUSD(selectedReport.expectedUSD)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                  <span>Esperado VES:</span>
                  <span>Bs. {selectedReport.expectedVES.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px', marginBottom: '8px' }}>
                  <span>Esperado Punto:</span>
                  <span>Bs. {selectedReport.expectedCardVES.toFixed(2)}</span>
                </div>

                <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>
                
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>DIFERENCIAS REGISTRADAS:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px', color: selectedReport.diffUSD >= 0 ? '#000' : '#d97706' }}>
                  <span>Diferencia USD:</span>
                  <span>{selectedReport.diffUSD >= 0 ? '+' : ''}{formatUSD(selectedReport.diffUSD)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px', color: selectedReport.diffVES >= 0 ? '#000' : '#d97706' }}>
                  <span>Diferencia VES:</span>
                  <span>{selectedReport.diffVES >= 0 ? '+' : ''}Bs. {selectedReport.diffVES.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px', color: selectedReport.diffCardVES >= 0 ? '#000' : '#d97706' }}>
                  <span>Diferencia Puntos:</span>
                  <span>{selectedReport.diffCardVES >= 0 ? '+' : ''}Bs. {selectedReport.diffCardVES.toFixed(2)}</span>
                </div>

                <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px' }}>
                  <span>TOTAL TURNO USD:</span>
                  <span>{formatUSD(selectedReport.totalSalesUSD)}</span>
                </div>

                <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>
                <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '8px', fontWeight: 'bold' }}>AUDITORÍA DE CAJA - STOCKMASTER PRO</div>
              </div>

            </div>

            {/* Actions */}
            <div style={{ padding: '16px 20px', borderTop: '1.5px solid var(--border-color)', display: 'flex', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => window.print()}
                className="btn-pill-dark"
                style={{ flex: 1, gap: '6px', justifyContent: 'center', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)' }}
              >
                <Printer size={15} />
                <span>Imprimir Ticket</span>
              </button>
              <button
                onClick={() => handleExportCSV(selectedReport)}
                className="btn-pill-dark"
                style={{ flex: 1, gap: '6px', justifyContent: 'center', borderRadius: 'var(--button-radius)', backgroundColor: 'rgba(14,165,164,0.1)', color: 'var(--brand-teal)' }}
              >
                <Download size={15} />
                <span>Exportar CSV</span>
              </button>
              <button
                onClick={() => setSelectedReport(null)}
                className="btn-yellow"
                style={{ flex: 1, justifyContent: 'center', borderRadius: 'var(--button-radius)' }}
              >
                <span>Cerrar Vista</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
