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
  Info,
  Snowflake,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Clock
} from 'lucide-react';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { useToast } from './ToastNotification';
import { useTheme } from '../contexts/ThemeContext';
import { API_URL } from '../config';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';
import { getDatabase } from '../db/database';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
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
  totalPayroll?: number;
  totalExpenses?: number;
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

interface ColdProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  createdAt: string;
  lastSaleDate: string | null;
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
    totalPayroll: 0,
    totalExpenses: 0,
    netProfit: 0,
    transactionsCount: 0,
    inventoryCostValue: 0,
    inventoryRetailValue: 0,
    lowStockProductsCount: 0
  });

  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [starProducts, setStarProducts] = useState<StarProduct[]>([]);
  const [weeklyPerformance, setWeeklyPerformance] = useState<any[]>([]);

  // Estados para productos fríos y modal de exportación
  const [coldProducts, setColdProducts] = useState<ColdProduct[]>([]);
  const [coldDays, setColdDays] = useState<number>(30);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showPromoModal, setShowPromoModal] = useState<ColdProduct | null>(null);
  const [promoDiscount, setPromoDiscount] = useState<string>('15');

  // Carga analíticas del servidor central o local offline
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

        // Carga productos fríos
        const coldRes = await fetch(`${API_URL}/reports/cold-products?days=${coldDays}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (coldRes.ok) {
          const data = await coldRes.json();
          if (Array.isArray(data)) {
            setColdProducts(data);
          }
        }
      } else {
        // Fallback offline resiliente con RxDB local
        const db = await getDatabase();
        const sales = await db.sales.find().exec();
        const products = await db.products.find().exec();
        const payrolls = await db.payroll.find().exec();
        const expenses = await db.expenses.find().exec();

        const productCostMap = new Map(products.map(p => [p.id, p.cost]));
        const productCategoryMap = new Map(products.map(p => [p.id, p.category]));
        const productMap = new Map(products.map(p => [p.id, p]));

        // Calcular KPIs
        const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
        const transactionsCount = sales.length;

        let totalCost = 0;
        for (const s of sales) {
          for (const item of s.items) {
            const cost = productCostMap.get(item.productId) || 0;
            totalCost += item.quantity * cost;
          }
        }

        const totalPayroll = payrolls
          .filter(p => p.status === 'PAGADO')
          .reduce((sum, p) => sum + p.totalPaid, 0);

        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = totalRevenue - totalCost - totalPayroll - totalExpenses;

        const inventoryCostValue = products.reduce((sum, p) => sum + p.cost * p.stock, 0);
        const inventoryRetailValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
        const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

        setKpis({
          totalRevenue,
          totalCost,
          totalPayroll,
          totalExpenses,
          netProfit,
          transactionsCount,
          inventoryCostValue,
          inventoryRetailValue,
          lowStockProductsCount: lowStockCount
        });

        // Categorías
        const catMap = new Map<string, { quantitySold: number; totalRevenue: number }>();
        for (const s of sales) {
          for (const item of s.items) {
            const cat = productCategoryMap.get(item.productId) || 'General';
            const prev = catMap.get(cat) || { quantitySold: 0, totalRevenue: 0 };
            prev.quantitySold += item.quantity;
            prev.totalRevenue += item.price * item.quantity;
            catMap.set(cat, prev);
          }
        }
        setCategorySales(Array.from(catMap.entries()).map(([category, data]) => ({
          category,
          quantitySold: data.quantitySold,
          totalRevenue: data.totalRevenue
        })));

        // Productos estrella
        const starMap = new Map<string, any>();
        for (const s of sales) {
          for (const item of s.items) {
            const p = productMap.get(item.productId);
            if (!p) continue;
            const prev = starMap.get(p.id) || {
              id: p.id, name: p.name, sku: p.code, category: p.category,
              unitsSold: 0, retailPrice: p.price, costPrice: p.cost,
              totalRevenue: 0, netMargin: 0, roi: 0
            };
            prev.unitsSold += item.quantity;
            prev.totalRevenue += item.price * item.quantity;
            starMap.set(p.id, prev);
          }
        }
        const stars = Array.from(starMap.values()).map(p => {
          const cost = p.unitsSold * p.costPrice;
          p.netMargin = p.totalRevenue - cost;
          p.roi = cost > 0 ? Math.round((p.netMargin / cost) * 100) : 0;
          return p;
        }).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
        setStarProducts(stars);

        // Rendimiento semanal
        const nowTime = Date.now();
        const fourWeeksAgo = nowTime - 28 * 24 * 60 * 60 * 1000;
        const buckets = [];
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        for (let w = 0; w < 4; w++) {
          const wStart = fourWeeksAgo + w * msPerWeek;
          const wEnd = wStart + msPerWeek;
          let rev = 0;
          let costVal = 0;
          for (const s of sales) {
            const t = new Date(s.createdAt).getTime();
            if (t >= wStart && t < wEnd) {
              rev += s.total;
              for (const item of s.items) {
                costVal += item.quantity * (productCostMap.get(item.productId) || 0);
              }
            }
          }
          let payVal = 0;
          for (const p of payrolls) {
            const t = new Date(p.paymentDate).getTime();
            if (p.status === 'PAGADO' && t >= wStart && t < wEnd) {
              payVal += p.totalPaid;
            }
          }
          let expVal = 0;
          for (const e of expenses) {
            const t = new Date(e.date).getTime();
            if (t >= wStart && t < wEnd) {
              expVal += e.amount;
            }
          }
          buckets.push({
            label: `SEMANA ${w + 1}`,
            totalRevenue: rev,
            totalCost: costVal,
            totalPayroll: payVal,
            totalExpenses: expVal,
            netUtility: rev - costVal - payVal - expVal
          });
        }
        setWeeklyPerformance(buckets);

        // Productos fríos
        const threshold = nowTime - coldDays * 24 * 60 * 60 * 1000;
        const recentSaleProductIds = new Set<string>();
        for (const s of sales) {
          if (new Date(s.createdAt).getTime() >= threshold) {
            for (const item of s.items) {
              recentSaleProductIds.add(item.productId);
            }
          }
        }
        const coldProds = products.filter(p => {
          const createdTime = new Date(p.updatedAt).getTime();
          return createdTime <= threshold && p.stock > 0 && !recentSaleProductIds.has(p.id);
        }).map(p => {
          let lastSaleTime = 0;
          for (const s of sales) {
            if (s.items.some(item => item.productId === p.id)) {
              const t = new Date(s.createdAt).getTime();
              if (t > lastSaleTime) lastSaleTime = t;
            }
          }
          return {
            id: p.id,
            code: p.code,
            name: p.name,
            category: p.category,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            createdAt: p.updatedAt,
            lastSaleDate: lastSaleTime > 0 ? new Date(lastSaleTime).toISOString() : null
          };
        }).slice(0, 50);
        setColdProducts(coldProds);
      }
    } catch (err) {
      console.error('Error cargando analíticas:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period, coldDays]);

  // Operaciones Financieras Específicas de Reportes (COGS, ROI, Ticket Promedio)
  const totalRevenue = kpis.totalRevenue;
  const totalCost = kpis.totalCost;
  const netProfit = kpis.netProfit;
  const transactionsCount = kpis.transactionsCount || 1;

  const cogs = totalCost; // Cost of Goods Sold
  const averageTicket = totalRevenue / transactionsCount;
  const profitMarginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const roiPercentage = cogs > 0 ? (netProfit / cogs) * 100 : 0;

  // Preparar datos para react-chartjs-2 con las 4 curvas correspondientes
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

    const expensesData = weeklyPerformance && weeklyPerformance.length > 0
      ? weeklyPerformance.map(d => (d.totalPayroll || 0) + (d.totalExpenses || 0))
      : [0, 0, 0, 0];

    const netUtilityData = weeklyPerformance && weeklyPerformance.length > 0
      ? weeklyPerformance.map(d => d.netUtility !== undefined ? d.netUtility : (d.totalRevenue - d.totalCost))
      : [0, 0, 0, 0];

    return {
      labels,
      datasets: [
        {
          label: 'INGRESOS BRUTOS',
          data: revenueData,
          borderColor: '#3b82f6',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#3b82f6',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          fill: false,
        },
        {
          label: 'COSTO DE VENTAS (COGS)',
          data: costData,
          borderColor: '#f59e0b',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#f59e0b',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          fill: false,
        },
        {
          label: 'NÓMINA + GASTOS',
          data: expensesData,
          borderColor: '#ef4444',
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#ef4444',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
          fill: false,
        },
        {
          label: 'UTILIDAD NETA REAL',
          data: netUtilityData,
          borderColor: '#0ea5a4',
          borderWidth: 4,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#0ea5a4',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2.5,
          fill: true,
          backgroundColor: 'rgba(14, 165, 164, 0.12)',
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
          display: false,
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
  const handleExportExcel = () => {
    // Hoja 1: Resumen KPIs
    const kpisData: any[][] = [
      ['KPI', 'Monto (USD)', 'Equivalente (VES)'],
      ['Ingresos Brutos', kpis.totalRevenue, convertToVES(kpis.totalRevenue)],
      ['Costo de Ventas (COGS)', kpis.totalCost, convertToVES(kpis.totalCost)],
      ['Gastos de Nómina', kpis.totalPayroll || 0, convertToVES(kpis.totalPayroll || 0)],
      ['Gastos Operativos', kpis.totalExpenses || 0, convertToVES(kpis.totalExpenses || 0)],
      ['Utilidad Neta Real', kpis.netProfit, convertToVES(kpis.netProfit)],
      ['ROI (Retorno de Inversión)', `${roiPercentage.toFixed(1)}%`, ''],
      ['Total Transacciones', kpis.transactionsCount, ''],
      ['Ticket Promedio', averageTicket, convertToVES(averageTicket)],
      ['Valor Inventario (Costo)', kpis.inventoryCostValue, convertToVES(kpis.inventoryCostValue)],
      ['Valor Inventario (Venta)', kpis.inventoryRetailValue, convertToVES(kpis.inventoryRetailValue)]
    ];
    const kpisWS = XLSX.utils.aoa_to_sheet(kpisData);

    // Hoja 2: Ventas por Categoría
    const catData: any[][] = [['Categoría', 'Cantidad Vendida', 'Ingresos Totales (USD)', 'Equivalente (VES)']];
    categorySales.forEach(c => {
      catData.push([c.category, c.quantitySold, c.totalRevenue, convertToVES(c.totalRevenue)]);
    });
    const catWS = XLSX.utils.aoa_to_sheet(catData);

    // Hoja 3: Productos Estrella
    const starData: any[][] = [['SKU', 'Producto', 'Categoría', 'Unidades Vendidas', 'Precio Venta (USD)', 'Costo Unitario (USD)', 'Ingresos Totales (USD)', 'Ganancia Neta (USD)', 'ROI']];
    starProducts.forEach(p => {
      starData.push([p.sku, p.name, p.category, p.unitsSold, p.retailPrice, p.costPrice, p.totalRevenue, p.netMargin, `${p.roi}%`]);
    });
    const starWS = XLSX.utils.aoa_to_sheet(starData);

    // Hoja 4: Productos Sin Rotación (Fríos)
    const coldData: any[][] = [['SKU', 'Producto', 'Categoría', 'Stock Actual', 'Precio Venta', 'Costo Unitario', 'Valor Inventario (Venta)', 'Última Venta']];
    coldProducts.forEach(p => {
      coldData.push([
        p.code,
        p.name,
        p.category,
        p.stock,
        p.price,
        p.cost,
        p.stock * p.price,
        p.lastSaleDate ? new Date(p.lastSaleDate).toLocaleDateString('es-VE') : 'Nunca vendido'
      ]);
    });
    const coldWS = XLSX.utils.aoa_to_sheet(coldData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, kpisWS, 'Resumen KPIs');
    XLSX.utils.book_append_sheet(wb, catWS, 'Ventas por Categoría');
    XLSX.utils.book_append_sheet(wb, starWS, 'Productos Estrella');
    XLSX.utils.book_append_sheet(wb, coldWS, 'Productos Sin Rotación');

    XLSX.writeFile(wb, `informe_financiero_completo_${new Date().toISOString().split('T')[0]}.xlsx`);

    addToast({
      type: 'success',
      title: 'Excel Descargado',
      message: 'El archivo Excel multi-hoja se ha generado y descargado exitosamente.'
    });
    setShowExportModal(false);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleString('es-VE');

    // Cabecera del negocio
    doc.setFillColor(14, 165, 164); // brand-teal
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('STOCKMASTER PRO - POS', 15, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema Inteligente de Control de Inventario y Ventas', 15, 25);
    doc.text(`Generado por: ${user.name} | Fecha: ${dateStr}`, 15, 32);

    // Titulo del reporte
    doc.setTextColor(18, 18, 20);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME GENERAL FINANCIERO Y DE ROTACIÓN', 15, 52);

    // KPIs en Tabla
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('1. Resumen de Indicadores Clave (KPIs)', 15, 60);

    const kpiRows = [
      ['Ingresos Brutos', `$${kpis.totalRevenue.toFixed(2)}`, `Bs. ${convertToVES(kpis.totalRevenue).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`],
      ['Costo de Ventas (COGS)', `$${kpis.totalCost.toFixed(2)}`, `Bs. ${convertToVES(kpis.totalCost).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`],
      ['Gastos de Nómina', `$${(kpis.totalPayroll || 0).toFixed(2)}`, `Bs. ${convertToVES(kpis.totalPayroll || 0).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`],
      ['Gastos Operativos', `$${(kpis.totalExpenses || 0).toFixed(2)}`, `Bs. ${convertToVES(kpis.totalExpenses || 0).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`],
      ['Utilidad Neta Real', `$${kpis.netProfit.toFixed(2)}`, `Bs. ${convertToVES(kpis.netProfit).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`],
      ['ROI (Retorno de Inversión)', `${roiPercentage.toFixed(1)}%`, 'N/A'],
      ['Ticket Promedio', `$${averageTicket.toFixed(2)}`, `Bs. ${convertToVES(averageTicket).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`],
      ['Valor Inventario (Costo)', `$${kpis.inventoryCostValue.toFixed(2)}`, `Bs. ${convertToVES(kpis.inventoryCostValue).toLocaleString('es-VE', { maximumFractionDigits: 2 })}`]
    ];

    (doc as any).autoTable({
      startY: 64,
      head: [['Métrica Financiera', 'Monto USD', 'Equivalente VES']],
      body: kpiRows,
      theme: 'striped',
      headStyles: { fillColor: [14, 165, 164] },
      styles: { fontSize: 9 }
    });

    // Productos Estrella
    doc.setFontSize(11);
    doc.text('2. Productos Estrella (Mayor Margen de Utilidad)', 15, (doc as any).lastAutoTable.finalY + 12);

    const starRows = starProducts.slice(0, 5).map(p => [
      p.sku,
      p.name,
      p.category,
      p.unitsSold.toString(),
      `$${p.retailPrice.toFixed(2)}`,
      `$${p.totalRevenue.toFixed(2)}`,
      `$${p.netMargin.toFixed(2)}`,
      `${p.roi}%`
    ]);

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 16,
      head: [['SKU', 'Producto', 'Categoría', 'Cant.', 'Precio', 'Venta Tot.', 'Margen', 'ROI']],
      body: starRows,
      theme: 'grid',
      headStyles: { fillColor: [251, 191, 36], textColor: [18, 18, 20] }, // brand-gold
      styles: { fontSize: 8.5 }
    });

    // Productos Fríos
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('INFORME GENERAL FINANCIERO Y DE ROTACIÓN (Cont.)', 15, 20);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('3. Alerta de Productos Fríos (Sin Rotación en Inventario)', 15, 28);

    const coldRows = coldProducts.slice(0, 15).map(p => [
      p.code,
      p.name,
      p.category,
      p.stock.toString(),
      `$${p.price.toFixed(2)}`,
      `$${(p.stock * p.price).toFixed(2)}`,
      p.lastSaleDate ? new Date(p.lastSaleDate).toLocaleDateString('es-VE') : 'Nunca vendido'
    ]);

    (doc as any).autoTable({
      startY: 32,
      head: [['Código', 'Producto', 'Categoría', 'Stock', 'Precio', 'Valor Inventario', 'Última Venta']],
      body: coldRows,
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68] },
      styles: { fontSize: 8.5 }
    });

    doc.save(`informe_financiero_completo_${new Date().toISOString().split('T')[0]}.pdf`);

    addToast({
      type: 'success',
      title: 'PDF Descargado',
      message: 'El informe general en formato PDF se ha generado y descargado exitosamente.'
    });
    setShowExportModal(false);
  };

  const handleApplyPromoDiscount = async () => {
    if (!showPromoModal) return;
    const discountVal = Number(promoDiscount);
    if (isNaN(discountVal) || discountVal <= 0 || discountVal > 100) {
      addToast({
        type: 'error',
        title: 'Descuento Inválido',
        message: 'Por favor, ingrese un porcentaje de descuento válido entre 1 y 100.'
      });
      return;
    }

    try {
      const db = await getDatabase();
      const doc = await db.products.findOne({ selector: { id: showPromoModal.id } }).exec();
      if (doc) {
        const oldPrice = doc.get('price');
        const newPrice = Number((oldPrice * (1 - discountVal / 100)).toFixed(2));

        await doc.patch({
          price: newPrice,
          version: (doc.get('version') || 1) + 1,
          updatedAt: new Date().toISOString()
        });

        // Registrar evento de auditoría
        const { logAuditEvent } = await import('../utils/audit');
        await logAuditEvent(user, 'PRODUCTO_EDITAR', {
          productId: showPromoModal.id,
          code: showPromoModal.code,
          name: showPromoModal.name,
          detail: `Promoción aplicada (${discountVal}% de descuento). Precio anterior: $${oldPrice} -> Nuevo precio: $${newPrice}`
        });

        addToast({
          type: 'success',
          title: 'Promoción Aplicada',
          message: `Se aplicó un ${discountVal}% de descuento a "${showPromoModal.name}". Nuevo precio: $${newPrice}.`
        });

        // Recargar analíticas
        loadAnalytics();

        // Disparar sincronización
        const { syncWorker } = await import('../db/sync');
        syncWorker.sync();

        setShowPromoModal(null);
      }
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Error de Promoción',
        message: 'No se pudo aplicar la promoción al producto en la base de datos local.'
      });
    }
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
                onClick={() => setShowExportModal(true)}
                className="btn-yellow" 
                title="Exportar Informe"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: 'var(--button-radius)', fontSize: '11px', fontWeight: 800 }}
              >
                <Download size={13} />
                <span>Exportar</span>
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
        
        {/* Curvas SVG Financieras: Ingresos vs Costos y Gastos con Utilidad Neta Real */}
        <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Curva Financiera de Rendimiento y Utilidad Real</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '10px', fontWeight: 800 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3b82f6' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                INGRESOS BRUTOS
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand-gold)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--brand-gold)' }} />
                COSTO DE VENTAS (COGS)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                NÓMINA + GASTOS
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0ea5a4' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0ea5a4' }} />
                UTILIDAD NETA REAL
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

      {/* SECCIÓN 5: ALERTA DE PRODUCTOS FRÍOS (SIN ROTACIÓN) */}
      <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Snowflake size={16} style={{ color: '#0ea5a4' }} /> Alerta de Productos Fríos (Sin Rotación en Inventario)
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Artículos con stock disponible que no han registrado ventas en el periodo seleccionado.
            </p>
          </div>
          
          {/* Selector de días sin venta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>Umbral de Inactividad:</span>
            <CustomSelect
              value={coldDays}
              onChange={(val) => setColdDays(Number(val))}
              options={[
                { value: 30, label: 'Más de 30 días' },
                { value: 60, label: 'Más de 60 días' },
                { value: 90, label: 'Más de 90 días' }
              ]}
              icon={<Clock size={14} style={{ color: 'var(--brand-primary)' }} />}
              style={{ width: '160px' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {coldProducts.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '13px', fontWeight: 600 }}>✅ Todos los productos tienen rotación activa en el catálogo.</p>
            </div>
          ) : (
            <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 800 }}>PRODUCTO</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800 }}>CÓDIGO/SKU</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800 }}>CATEGORÍA</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>STOCK</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>COSTO UNIT.</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>PRECIO VENTA</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'right' }}>VALOR STOCK</th>
                  <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ÚLTIMA VENTA</th>
                  {user.role === 'ADMIN' && <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>ACCIONES</th>}
                </tr>
              </thead>
              <tbody>
                {coldProducts.map((p) => {
                  const totalStockValue = p.stock * p.price;
                  return (
                    <tr key={p.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s ease' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}><code>{p.code}</code></td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '50px' }}>
                          {p.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 700 }}>{p.stock} u.</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                        {formatUSD(p.cost)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatUSD(p.price)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--brand-gold)' }}>
                        {formatUSD(totalStockValue)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {p.lastSaleDate ? new Date(p.lastSaleDate).toLocaleDateString('es-VE') : 'Nunca vendido'}
                      </td>
                      {user.role === 'ADMIN' && (
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <button
                            onClick={() => {
                              setPromoDiscount('15');
                              setShowPromoModal(p);
                            }}
                            className="btn-yellow"
                            style={{ padding: '4px 10px', fontSize: '10.5px', borderRadius: '6px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Sparkles size={11} />
                            <span>Promoción</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL DE EXPORTACIÓN MULTIFORMATO */}
      {showExportModal && (
        <div className="modal-registration-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1500,
          padding: '20px'
        }} onClick={() => setShowExportModal(false)}>
          <div className="widget animate-entrance" style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                📥 Descargar Reporte de Analíticas
              </h4>
              <button onClick={() => setShowExportModal(false)} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold', lineHeight: 1 }}>×</button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Seleccione el formato en el que desea exportar el informe ejecutivo completo consolidado.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={handleExportExcel}
                  className="btn-pill-dark"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px', borderRadius: '16px', height: 'auto', justifyContent: 'center' }}
                >
                  <FileSpreadsheet size={24} style={{ color: '#22c55e' }} />
                  <span style={{ fontSize: '12px', fontWeight: 800 }}>EXCEL (XLSX)</span>
                </button>

                <button
                  onClick={handleExportPDF}
                  className="btn-pill-dark"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '20px', borderRadius: '16px', height: 'auto', justifyContent: 'center' }}
                >
                  <FileText size={24} style={{ color: '#ef4444' }} />
                  <span style={{ fontSize: '12px', fontWeight: 800 }}>PDF REPORT</span>
                </button>
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-input)' }}>
              <button onClick={() => setShowExportModal(false)} className="btn-pill-dark" style={{ padding: '8px 16px', fontSize: '11px', borderRadius: '8px' }}>
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE APLICAR PROMOCIÓN DESCUENTO */}
      {showPromoModal && (
        <div className="modal-registration-backdrop" style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1500,
          padding: '20px'
        }} onClick={() => setShowPromoModal(null)}>
          <div className="widget animate-entrance" style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                🚀 Lanzar Promoción de Producto Frío
              </h4>
              <button onClick={() => setShowPromoModal(null)} style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}>×</button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>PRODUCTO SELECCIONADO</span>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block', marginTop: '2px' }}>{showPromoModal.name}</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SKU: {showPromoModal.code} | Stock: {showPromoModal.stock} unidades</span>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Precio Actual:</span>
                  <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{formatUSD(showPromoModal.price)}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Nuevo Precio Estimado:</span>
                  <strong style={{ color: '#22c55e', fontSize: '15px' }}>
                    {formatUSD(Number((showPromoModal.price * (1 - (Number(promoDiscount) || 0) / 100)).toFixed(2)))}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>PORCENTAJE DE DESCUENTO (%)</label>
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1.2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <input
                    type="text"
                    value={promoDiscount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || (Number(val) >= 0 && Number(val) < 100)) {
                        setPromoDiscount(val);
                      }
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none'
                    }}
                    placeholder="15"
                  />
                  <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>%</span>
                </div>
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1.5px solid var(--border-color)', display: 'flex', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
              <button onClick={() => setShowPromoModal(null)} className="btn-pill-dark" style={{ flex: 1, padding: '10px 0', fontSize: '11px', justifyContent: 'center', borderRadius: '8px' }}>
                CANCELAR
              </button>
              <button onClick={handleApplyPromoDiscount} className="btn-yellow" style={{ flex: 1, padding: '10px 0', fontSize: '11px', justifyContent: 'center', borderRadius: '8px' }}>
                APLICAR DESCUENTO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
