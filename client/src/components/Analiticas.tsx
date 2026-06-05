import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Percent, 
  ShoppingBag, 
  Calendar, 
  Download, 
  Printer, 
  RefreshCw, 
  Layers, 
  Award,
  Info
} from 'lucide-react';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { useToast } from './ToastNotification';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import CustomDatePicker from './CustomDatePicker';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface AnaliticasProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface KPIs {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  transactionsCount: number;
  inventoryCostValue: number;
  inventoryRetailValue: number;
  lowStockProductsCount: number;
}

interface CategorySales {
  category: string;
  quantitySold: number;
  totalRevenue: number;
}

interface StarProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitsSold: number;
  retailPrice: number;
  costPrice: number;
  totalRevenue: number;
  netMargin: number;
  roi: number;
}

export default function Analiticas({ user }: AnaliticasProps) {
  const { convertToVES, formatVES, formatUSD } = useExchangeRate();
  const { addToast } = useToast();
  const { settings } = useTheme();
  const isDarkMode = settings.mode === 'dark';
  
  const [period, setPeriod] = useState<'hoy' | '7dias' | '30dias' | 'año'>('30dias');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [kpis, setKpis] = useState<KPIs>({
    totalRevenue: 0,
    totalCost: 0,
    netProfit: 0,
    transactionsCount: 0,
    inventoryCostValue: 0,
    inventoryRetailValue: 0,
    lowStockProductsCount: 0
  });

  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);

  const [starProducts, setStarProducts] = useState<StarProduct[]>([]);

  const [weeklyPerformance, setWeeklyPerformance] = useState<Array<{label: string; totalRevenue: number; totalCost: number}>>([]);

  // Carga analíticas del servidor central
  const loadAnalytics = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (token && navigator.onLine) {
        // Carga KPIs
        const kpiRes = await fetch(`${API_URL}/reports/kpis`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (kpiRes.ok) {
          const data = await kpiRes.json();
          if (data.kpis) {
            // Adapta al estado
            setKpis(data.kpis);
          }
        }

        // Carga categorías
        const catRes = await fetch(`${API_URL}/reports/categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (catRes.ok) {
          const data = await catRes.json();
          if (Array.isArray(data) && data.length > 0) {
            setCategorySales(data);
          }
        }

        // Carga productos estrella
        const starRes = await fetch(`${API_URL}/reports/star-products`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (starRes.ok) {
          const data = await starRes.json();
          if (Array.isArray(data) && data.length > 0) {
            setStarProducts(data);
          }
        }

        // Carga rendimiento semanal
        const weeklyRes = await fetch(`${API_URL}/reports/weekly-performance`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (weeklyRes.ok) {
          const data = await weeklyRes.json();
          if (Array.isArray(data)) {
            setWeeklyPerformance(data);
          }
        }
      }
    } catch (err) {
      console.error('Error cargando analíticas de servidor:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  // Operaciones Financieras Específicas de Reportes (COGS, ROI, Ticket Promedio)
  const totalRevenue = kpis.totalRevenue;
  const totalCost = kpis.totalCost;
  const netProfit = kpis.netProfit;
  const transactionsCount = kpis.transactionsCount || 1;

  const cogs = totalCost; // Cost of Goods Sold
  const averageTicket = totalRevenue / transactionsCount;
  const profitMarginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const roiPercentage = cogs > 0 ? (netProfit / cogs) * 100 : 0;

  // Preparar datos para react-chartjs-2
  const performanceChartData = useMemo(() => {
    const labels = weeklyPerformance && weeklyPerformance.length > 0
      ? weeklyPerformance.map(d => d.label.toUpperCase())
      : ['SEMANA 1', 'SEMANA 2', 'SEMANA 3', 'SEMANA 4'];

    const revenueData = weeklyPerformance && weeklyPerformance.length > 0
      ? weeklyPerformance.map(d => d.totalRevenue)
      : [0, 0, 0, 0];

    const costData = weeklyPerformance && weeklyPerformance.length > 0
      ? weeklyPerformance.map(d => d.totalCost)
      : [0, 0, 0, 0];

    return {
      labels,
      datasets: [
        {
          label: 'INGRESOS BRUTOS',
          data: revenueData,
          borderColor: '#3b82f6', // var(--brand-primary) equivalent blue
          borderWidth: 3.5,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#3b82f6',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          fill: true,
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
        },
        {
          label: 'COSTO DE VENTAS (COGS)',
          data: costData,
          borderColor: '#f59e0b', // var(--brand-gold) equivalent gold
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#f59e0b',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          fill: true,
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
        }
      ]
    };
  }, [weeklyPerformance]);

  const performanceChartOptions: any = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // Leyendas hechas a mano arriba del gráfico
        },
        tooltip: {
          backgroundColor: isDarkMode ? '#ffffff' : '#121214',
          titleColor: isDarkMode ? '#121214' : '#ffffff',
          bodyColor: isDarkMode ? '#121214' : '#ffffff',
          titleFont: {
            family: 'Plus Jakarta Sans',
            weight: 'bold',
            size: 10
          },
          bodyFont: {
            family: 'Plus Jakarta Sans',
            weight: 'bold',
            size: 12
          },
          padding: 10,
          cornerRadius: 10,
          displayColors: true,
          callbacks: {
            label: function (context: any) {
              const label = context.dataset.label || '';
              const val = context.raw || 0;
              return ` ${label}: $${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: isDarkMode ? '#90929c' : '#4a4c54',
            font: {
              family: 'Plus Jakarta Sans',
              weight: '800',
              size: 9
            }
          }
        },
        y: {
          min: 0,
          ticks: {
            callback: function (value: any) {
              return `$${value}`;
            },
            color: isDarkMode ? '#90929c' : '#4a4c54',
            font: {
              family: 'Plus Jakarta Sans',
              weight: '700',
              size: 9
            }
          },
          grid: {
            color: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          }
        }
      }
    };
  }, [isDarkMode]);

  // Acciones de Exportación Reales
  const handleExportCSV = () => {
    // Generate CSV data for financial metrics, categories, and products
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'REPORTE FINANCIERO Y DE VENTAS - STOCKMASTER PRO\n';
    csv += `Periodo: ${period.toUpperCase()}\n`;
    csv += `Fecha de Generacion: ${new Date().toLocaleString('es-VE')}\n\n`;
    
    csv += 'BALANCES FINANCIEROS (USD)\n';
    csv += `Ingresos Totales,${totalRevenue.toFixed(2)}\n`;
    csv += `Costo de Ventas (COGS),${totalCost.toFixed(2)}\n`;
    csv += `Utilidad Neta,${netProfit.toFixed(2)}\n`;
    csv += `Margen de Utilidad,${profitMarginPercentage.toFixed(1)}%\n`;
    csv += `ROI (Retorno de Inversion),${roiPercentage.toFixed(1)}%\n`;
    csv += `Transacciones totales,${transactionsCount}\n`;
    csv += `Ticket Promedio,${averageTicket.toFixed(2)}\n\n`;

    csv += 'VENTAS POR CATEGORÍA\n';
    csv += 'Categoria,Cantidad Vendida,Ingresos Totales (USD)\n';
    categorySales.forEach(c => {
      csv += `"${c.category}",${c.quantitySold},${c.totalRevenue.toFixed(2)}\n`;
    });
    csv += '\n';

    csv += 'PRODUCTOS ESTRELLA (TOP MÁS VENDIDOS)\n';
    csv += 'SKU,Nombre,Categoria,Unidades Vendidas,Precio Venta (USD),Costo Unitario (USD),Ingresos Totales (USD),Margen Neto (USD),ROI (%)\n';
    starProducts.forEach(p => {
      csv += `${p.sku},"${p.name}","${p.category}",${p.unitsSold},${p.retailPrice.toFixed(2)},${p.costPrice.toFixed(2)},${p.totalRevenue.toFixed(2)},${p.netMargin.toFixed(2)},${p.roi}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_financiero_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'success',
      title: 'Reporte Exportado',
      message: `El archivo CSV para el periodo "${period}" se descargó exitosamente.`
    });
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="view-container-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: CABECERA Y FILTROS CORPORATIVOS */}
      <div className="widget view-header-widget has-grid-content" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="info-tooltip-wrapper">
              <Info size={18} className="info-tooltip-icon" style={{ color: 'var(--text-secondary)', cursor: 'help', opacity: 0.8 }} />
              <span className="tooltip-text">
                Margen de utilidad neto, costo de ventas (COGS), desglose por categorías y retorno de inversión. Generado por: {user.name} ({user.role === 'ADMIN' ? 'Administrador' : 'Auditor'}).
              </span>
            </div>
            <span className="view-header-pill pill-teal">
              {kpis.transactionsCount} Ventas
            </span>
            <span className="view-header-pill pill-green">
              {(kpis.totalRevenue > 0 ? (kpis.netProfit / kpis.totalRevenue) * 100 : 0).toFixed(1)}% Margen
            </span>
          </div>

          {/* Selector de periodo rápido */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <div className="btn-pill-group" style={{ display: 'flex', backgroundColor: 'var(--bg-primary)', padding: '4px', borderRadius: 'var(--button-radius)', border: '1px solid var(--border-color)' }}>
              {(['hoy', '7dias', '30dias', 'año'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPeriod(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'calc(var(--button-radius) - 4px)',
                    border: 'none',
                    backgroundColor: period === t ? 'var(--brand-primary)' : 'transparent',
                    color: period === t ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'capitalize'
                  }}
                >
                  {t === 'hoy' ? 'Hoy' : t === '7dias' ? '7 Días' : t === '30dias' ? '30 Días' : 'Año'}
                </button>
              ))}
            </div>

            {/* Selector de Rango de Fechas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <CustomDatePicker 
                value={startDate} 
                onChange={setStartDate} 
                style={{ width: '160px' }} 
              />
              <span>a</span>
              <CustomDatePicker 
                value={endDate} 
                onChange={setEndDate} 
                style={{ width: '160px' }} 
              />
            </div>

            {/* Acciones de exportación */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                onClick={handleExportCSV}
                className="btn-pill-dark" 
                title="Exportar CSV"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: 'var(--button-radius)', fontSize: '11px', fontWeight: 800, backgroundColor: 'var(--bg-input)' }}
              >
                <Download size={13} />
                <span>CSV</span>
              </button>
              <button 
                onClick={handlePrintReport}
                className="btn-pill-dark" 
                title="Imprimir Informe Financiero"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: 'var(--button-radius)', fontSize: '11px', fontWeight: 800, backgroundColor: 'var(--bg-input)' }}
              >
                <Printer size={13} />
                <span>Imprimir</span>
              </button>
              <button 
                onClick={loadAnalytics}
                className="btn-pill-dark" 
                disabled={isRefreshing}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', cursor: isRefreshing ? 'not-allowed' : 'pointer' }}
              >
                <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* SECCIÓN 2: METRICAS ANALITICAS CORPORATIVAS (KPIs EXCLUSIVOS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        {/* KPI 1: COGS - Costo de Venta */}
        <div className="widget" style={{ padding: '20px', borderLeft: '4.5px solid var(--brand-gold)', display: 'flex', flexDirection: 'column', gap: '10px', borderRadius: 'var(--card-radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              COSTO DE VENTA (COGS)
            </span>
            <span style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', padding: '4px', borderRadius: '50%' }}>
              <Layers size={13} style={{ color: 'var(--brand-gold)' }} />
            </span>
          </div>
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {formatUSD(cogs)}
            </h3>
            <span style={{ fontSize: '10.5px', color: 'var(--brand-gold)', display: 'block', marginTop: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
              {formatVES(cogs)}
            </span>
          </div>
        </div>

        {/* KPI 2: Ticket Promedio */}
        <div className="widget" style={{ padding: '20px', borderLeft: '4.5px solid var(--brand-primary)', display: 'flex', flexDirection: 'column', gap: '10px', borderRadius: 'var(--card-radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              TICKET PROMEDIO
            </span>
            <span style={{ backgroundColor: 'var(--brand-primary-light)', padding: '4px', borderRadius: '50%' }}>
              <ShoppingBag size={13} style={{ color: 'var(--brand-primary)' }} />
            </span>
          </div>
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {formatUSD(averageTicket)}
            </h3>
            <span style={{ fontSize: '10.5px', color: 'var(--brand-primary)', display: 'block', marginTop: '4px', fontWeight: 700, fontFamily: 'monospace' }}>
              {formatVES(averageTicket)}
            </span>
          </div>
        </div>

        {/* KPI 3: Margen de Utilidad Neto */}
        <div className="widget" style={{ padding: '20px', borderLeft: '4.5px solid #22c55e', display: 'flex', flexDirection: 'column', gap: '10px', borderRadius: 'var(--card-radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              MARGEN DE UTILIDAD NETO
            </span>
            <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '4px', borderRadius: '50%' }}>
              <Percent size={13} style={{ color: '#22c55e' }} />
            </span>
          </div>
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#22c55e', margin: 0 }}>
              {profitMarginPercentage.toFixed(1)}%
            </h3>
            
            {/* Visual health bar */}
            <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--track-bg)', borderRadius: '10px', overflow: 'hidden', marginTop: '8px' }}>
              <div style={{ width: `${Math.min(100, profitMarginPercentage * 1.5)}%`, height: '100%', backgroundColor: '#22c55e', borderRadius: '10px' }} />
            </div>
          </div>
        </div>

        {/* KPI 4: Retorno de Inversión (ROI) */}
        <div className="widget" style={{ padding: '20px', borderLeft: '4.5px solid #a855f7', display: 'flex', flexDirection: 'column', gap: '10px', borderRadius: 'var(--card-radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
              RETORNO DE INVERSIÓN (ROI)
            </span>
            <span style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '4px', borderRadius: '50%' }}>
              <Award size={13} style={{ color: '#a855f7' }} />
            </span>
          </div>
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              {roiPercentage.toFixed(1)}%
            </h3>
            <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
              Rendimiento sobre capital invertido
            </span>
          </div>
        </div>

      </div>

      {/* SECCIÓN 3: RENDIMIENTO EN TIEMPO REAL (CHARTS & CATEGORIES) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px' }}>
        
        {/* Curvas SVG Financieras: Ingresos vs Costo de Ventas */}
        <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Rendimiento Financiero: Ingresos vs. Costos</span>
            <div style={{ display: 'flex', gap: '12px', fontSize: '10px', fontWeight: 800 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand-primary)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)' }} />
                INGRESOS BRUTOS
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand-gold)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--brand-gold)' }} />
                COSTO DE VENTAS (COGS)
              </span>
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
            <Line data={performanceChartData} options={performanceChartOptions} />
          </div>
        </div>

        {/* Desglose por Categorías de Venta y Margen */}
        <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <span style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Márgenes por Categoría</span>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, justifyContent: 'center' }}>
            {categorySales.map((cat, i) => {
              const colors = ['var(--brand-primary)', 'var(--brand-gold)', '#20e3b2', '#fd3c90'];
              const catTotalSales = categorySales.reduce((acc, c) => acc + c.totalRevenue, 0);
              const percentage = catTotalSales > 0 ? (cat.totalRevenue / catTotalSales) * 100 : 0;
              
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colors[i % colors.length] }} />
                      {cat.category}
                    </span>
                    <span style={{ fontWeight: 800 }}>
                      {formatUSD(cat.totalRevenue)} / <span style={{ color: 'var(--brand-gold)', fontFamily: 'monospace' }}>Bs. {convertToVES(cat.totalRevenue).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '5px', borderRadius: '50px', backgroundColor: 'var(--track-bg)', overflow: 'hidden' }}>
                    <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: colors[i % colors.length], borderRadius: '50px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* SECCIÓN 4: REPORTE DE PRODUCTOS ESTRELLA (TOP RENTABILIDAD) */}
      <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              🏆 Reporte de Productos Estrella (Mayor Margen de Utilidad)
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Productos del catálogo ordenados por mayor rendimiento neto sobre costos de adquisición.
            </p>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px' }}>
            ACTIVO
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>PRODUCTO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>SKU</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>CATEGORÍA</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>VENDIDOS</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>VALOR COMPRA</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>VALOR VENTA</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>GANANCIA NETO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ROI %</th>
              </tr>
            </thead>
            <tbody>
              {starProducts.map((p) => {
                const totalCostAcquisition = p.unitsSold * p.costPrice;
                return (
                  <tr key={p.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s ease' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</td>
                    <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}><code>{p.sku}</code></td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '2px 8px', borderRadius: '50px' }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700 }}>{p.unitsSold} u.</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      <span style={{ display: 'block' }}>{formatUSD(totalCostAcquisition)}</span>
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Bs. {convertToVES(totalCostAcquisition).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <span style={{ display: 'block' }}>{formatUSD(p.totalRevenue)}</span>
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Bs. {convertToVES(p.totalRevenue).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: '#22c55e' }}>
                      <span style={{ display: 'block', color: '#22c55e' }}>+{formatUSD(p.netMargin)}</span>
                      <span style={{ display: 'block', fontSize: '10px', color: 'rgba(34,197,94,0.8)', fontFamily: 'monospace' }}>+Bs. {convertToVES(p.netMargin).toLocaleString('es-VE', { maximumFractionDigits: 0 })}</span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '11px', color: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                        {p.roi}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
