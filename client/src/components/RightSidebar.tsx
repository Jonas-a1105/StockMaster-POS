import { useRef, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { getDatabase } from '../db/database';
import { useTheme } from '../contexts/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

const centerTextPlugin = {
  id: 'centerText',
  beforeDraw(chart: any) {
    const { width, height, ctx } = chart;
    ctx.save();
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data[0]) return;
    const arc = meta.data[0];
    const cx = arc.x;
    const cy = arc.y;
    const total = (chart.data.datasets[0].data as number[]).reduce((a: number, b: number) => a + b, 0);
    const isEmpty = total <= 3;
    const value = isEmpty ? '$ 0' : total >= 1000 ? `$ ${(total / 1000).toFixed(1)}k` : `$ ${total.toFixed(0)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = isEmpty ? '#5e6068' : (ChartJS.defaults.color as string || '#ffffff');
    ctx.fillText(value, cx, cy - 6);
    ctx.font = '600 9px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#5e6068';
    ctx.fillText('TOTAL INGRESOS', cx, cy + 16);
    ctx.restore();
  }
};

interface RightSidebarProps {
  isDarkMode: boolean;
}

export default function RightSidebar({ isDarkMode }: RightSidebarProps) {
  const { settings } = useTheme();
  const chartRef = useRef<any>(null);

  const [paymentStats, setPaymentStats] = useState({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0
  });

  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalProducts: 0,
    lowStockCount: 0,
    localSalesCount: 0
  });

  const [syncMonitor, setSyncMonitor] = useState({
    synced: 0,
    pending: 0
  });

  useEffect(() => {
    let salesSub: any;
    let productsSub: any;

    const setupSubscriptions = async () => {
      try {
        const db = await getDatabase();

        // 1. Suscribirse a las ventas para calcular ingresos, métodos de pago y estado de sync
        salesSub = db.sales.find().$.subscribe((salesDocs) => {
          const sales = salesDocs.map(doc => doc.toJSON());

          // Agrupar totales por método de pago
          const pay = { efectivo: 0, tarjeta: 0, transferencia: 0 };
          sales.forEach(sale => {
            const method = sale.paymentMethod?.toUpperCase();
            if (method === 'EFECTIVO') pay.efectivo += sale.total;
            else if (method === 'TARJETA') pay.tarjeta += sale.total;
            else if (method === 'TRANSFERENCIA') pay.transferencia += sale.total;
            else pay.efectivo += sale.total; // Fallback
          });
          setPaymentStats(pay);

          // Contar ventas sincronizadas vs en cola offline
          const synced = sales.filter(s => !s.pendingSync).length;
          const pending = sales.filter(s => s.pendingSync).length;
          setSyncMonitor({ synced, pending });

          // Calcular total ingresos
          const totalRev = sales.reduce((acc, s) => acc + s.total, 0);
          setStats(prev => ({
            ...prev,
            totalRevenue: totalRev,
            localSalesCount: sales.length
          }));
        });

        // 2. Suscribirse a los productos para contar catálogo y alertas de bajo stock
        productsSub = db.products.find().$.subscribe((productsDocs) => {
          const products = productsDocs.map(doc => doc.toJSON());
          const lowStock = products.filter(p => p.stock <= p.minStock).length;
          setStats(prev => ({
            ...prev,
            totalProducts: products.length,
            lowStockCount: lowStock
          }));
        });
      } catch (err) {
        console.error('Error loading RightSidebar subscriptions:', err);
      }
    };

    setupSubscriptions();

    return () => {
      salesSub?.unsubscribe();
      productsSub?.unsubscribe();
    };
  }, []);

  const totalPayments = paymentStats.efectivo + paymentStats.tarjeta + paymentStats.transferencia;
  const isEmpty = totalPayments === 0;

  const data = {
    labels: ['Efectivo', 'Tarjeta', 'Transferencia'],
    datasets: [
      {
        data: isEmpty
          ? [1, 1, 1]
          : [paymentStats.efectivo, paymentStats.tarjeta, paymentStats.transferencia],
        backgroundColor: isEmpty
          ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']
          : ['#ff8fb0', '#20e3b2', '#fd3c90'],
        borderColor: isEmpty
          ? 'transparent'
          : ['#ff8fb0', '#20e3b2', '#fd3c90'],
        borderWidth: 1.5,
        borderRadius: 4,
        spacing: isEmpty ? 0 : 6,
        hoverOffset: isEmpty ? 0 : 14,
      }
    ]
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '76%',
    animation: {
      animateRotate: true,
      duration: 800,
      easing: 'easeOutQuart' as const,
    },
    plugins: {
      legend: { display: false },
      centerText: true,
      tooltip: {
        enabled: !isEmpty,
        backgroundColor: isDarkMode ? '#1a1a1e' : '#ffffff',
        titleColor: isDarkMode ? '#ffffff' : '#121214',
        bodyColor: isDarkMode ? '#ffffff' : '#121214',
        bodyFont: { family: 'Plus Jakarta Sans', weight: 'bold', size: 12 },
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 6,
        callbacks: {
          label: function (context: any) {
            const pct = totalPayments > 0 ? ((context.raw / totalPayments) * 100).toFixed(1) : 0;
            return ` ${context.label}: $${context.raw.toFixed(2)} (${pct}%)`;
          }
        }
      }
    }
  };

  const handleLegendClick = (index: number) => {
    if (isEmpty) return;
    const chart = chartRef.current;
    if (!chart) return;
    chart.toggleDataVisibility(index);
    chart.update();
  };

  // Rango de fechas dinámico (semana en curso)
  const getWeekRangeString = () => {
    const today = new Date();
    const first = today.getDate() - today.getDay() + 1; // Lunes
    const last = first + 5; // Sábado

    const firstDate = new Date(today.setDate(first));
    const lastDate = new Date(today.setDate(last));

    const optionsMonth: any = { month: 'short' };
    const startStr = firstDate.getDate();
    const endStr = lastDate.getDate();
    const monthStr = lastDate.toLocaleDateString('es-ES', optionsMonth);

    return `${startStr} - ${endStr} de ${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)}`;
  };

  return (
    <aside className="right-sidebar">
      {/* Contenedor Único Combinado del Sidebar */}
      <div className="widget petshop-card" style={{ display: 'flex', flexDirection: 'column', padding: '24px 20px' }}>
        
        {/* SECCIÓN 1: StockMaster POS y Doughnut Chart */}
        <div className="petshop-header">
          <div className="petshop-logo">
            <div className="petshop-logo-inner">
              <span className="logo-bar" style={{ backgroundColor: '#ff8fb0' }}></span>
              <span className="logo-bar" style={{ backgroundColor: '#20e3b2' }}></span>
              <span className="logo-bar" style={{ backgroundColor: '#fd3c90' }}></span>
            </div>
          </div>
          
          <div className="petshop-title">
            <span className="petshop-name">StockMaster POS</span>
            <span className="petshop-sub">(Caja Activa)</span>
          </div>
        </div>
        
        {/* Gráfico circular Doughnut interactivo de Métodos de Pago */}
        <div className="pie-chart-section">
          <div className="pie-chart-canvas-wrap">
            <Doughnut ref={chartRef} data={data} options={options} plugins={[centerTextPlugin]} />
          </div>
          
          <div className="pie-legend">
            <div className="pie-legend-item" onClick={() => handleLegendClick(0)} style={{ cursor: isEmpty ? 'default' : 'pointer' }}>
              <span className="pie-color-box" style={{ backgroundColor: isEmpty ? 'rgba(255,255,255,0.12)' : '#ff8fb0' }}></span>
              <span>Efectivo</span>
              <span className="pie-legend-pct">{isEmpty ? '' : `$${paymentStats.efectivo.toFixed(0)}`}</span>
            </div>
            <div className="pie-legend-item" onClick={() => handleLegendClick(1)} style={{ cursor: isEmpty ? 'default' : 'pointer' }}>
              <span className="pie-color-box" style={{ backgroundColor: isEmpty ? 'rgba(255,255,255,0.08)' : '#20e3b2' }}></span>
              <span>Tarjeta</span>
              <span className="pie-legend-pct">{isEmpty ? '' : `$${paymentStats.tarjeta.toFixed(0)}`}</span>
            </div>
            <div className="pie-legend-item" onClick={() => handleLegendClick(2)} style={{ cursor: isEmpty ? 'default' : 'pointer' }}>
              <span className="pie-color-box" style={{ backgroundColor: isEmpty ? 'rgba(255,255,255,0.05)' : '#fd3c90' }}></span>
              <span>Transferencia</span>
              <span className="pie-legend-pct">{isEmpty ? '' : `$${paymentStats.transferencia.toFixed(0)}`}</span>
            </div>
          </div>
        </div>
        
        <span className="distributions-text" style={{ marginBottom: '16px' }}>
          Distribución de cobros por método de pago
        </span>

        {/* DIVISOR HORIZONTAL 1 */}
        <hr style={{ border: 0, borderTop: '1.5px solid var(--border-color)', margin: '20px 0' }} />

        {/* SECCIÓN 2: KPIs del Período Real-time */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="dropdown-select" style={{ width: '100%', justifyContent: 'space-between', padding: '10px 16px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#5e6068' }}>📅</span>
              <span>Semana: {getWeekRangeString()}</span>
            </div>
            <ChevronDown size={14} />
          </div>
          
          <div className="stats-list">
            <div className="stat-row">
              <span className="stat-label">Ingresos Totales</span>
              <span className="stat-value-group">
                <span>{stats.totalRevenue >= 1000 ? `$ ${(stats.totalRevenue / 1000).toFixed(1)}k` : `$ ${stats.totalRevenue.toFixed(2)}`}</span>
              </span>
            </div>
            
            <div className="stat-row">
              <span className="stat-label">Productos Catálogo</span>
              <span className="stat-value-group">
                <span>{stats.totalProducts}</span>
              </span>
            </div>
            
            <div className="stat-row">
              <span className="stat-label">Stock Alertas</span>
              <span className="stat-value-group">
                <span className={stats.lowStockCount > 0 ? "stat-change-positive" : ""} style={{ color: stats.lowStockCount > 0 ? '#ef4444' : 'inherit', backgroundColor: stats.lowStockCount > 0 ? 'rgba(239,68,68,0.1)' : 'transparent', padding: stats.lowStockCount > 0 ? '2px 8px' : '0', borderRadius: '6px' }}>
                  {stats.lowStockCount} bajo stock
                </span>
              </span>
            </div>
            
            <div className="stat-row">
              <span className="stat-label">Ventas Locales</span>
              <span className="stat-value-group">
                <span>{stats.localSalesCount} tickets</span>
              </span>
            </div>
          </div>
        </div>

        {/* DIVISOR HORIZONTAL 2 */}
        <hr style={{ border: 0, borderTop: '1.5px solid var(--border-color)', margin: '20px 0' }} />

        {/* SECCIÓN 3: Monitoreo en Tiempo Real de Sincronización en la Nube */}
        <div className="visitors-section" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="visitor-progress-card">
            <span className="visitor-title">Ventas Sincronizadas (Nube)</span>
            <span className="visitor-value">{syncMonitor.synced}</span>
            <div className="visitor-track">
              <div 
                className="visitor-fill fill-online" 
                style={{ width: `${stats.localSalesCount > 0 ? (syncMonitor.synced / stats.localSalesCount) * 100 : 0}%`, transition: 'width 0.4s ease' }}
              ></div>
            </div>
          </div>
          
          <div className="visitor-progress-card">
            <span className="visitor-title">Ventas Offline (Cola local)</span>
            <span className="visitor-value">{syncMonitor.pending}</span>
            <div className="visitor-track">
              <div 
                className="visitor-fill fill-offline" 
                style={{ width: `${stats.localSalesCount > 0 ? (syncMonitor.pending / stats.localSalesCount) * 100 : 0}%`, transition: 'width 0.4s ease' }}
              ></div>
            </div>
          </div>
        </div>

      </div>

      {/* ⚡ Widget de Atajos de Teclado POS (Toglable desde Customizer) */}
      {settings.shortcutsWidget && (
        <div className="widget animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '14px', border: '1.5px dashed var(--brand-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px', color: 'var(--brand-primary)' }}>⚡</span>
            <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' }}>Atajos POS Rápidos</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', fontWeight: 700 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>F1 - Nueva Venta</span>
              <kbd style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '10px' }}>F1</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>F2 - Buscar Producto</span>
              <kbd style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '10px' }}>F2</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>F8 - Cobrar Ticket</span>
              <kbd style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '10px' }}>F8</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ESC - Cancelar Operación</span>
              <kbd style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '10px' }}>ESC</kbd>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
