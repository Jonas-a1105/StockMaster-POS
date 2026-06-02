import { useRef, useEffect, useState } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getDatabase } from '../db/database';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SalesChartCardProps {
  isDarkMode: boolean;
}

export default function SalesChartCard({ isDarkMode }: SalesChartCardProps) {
  const chartRef = useRef<any>(null);
  const [chartData, setChartData] = useState<any>({ datasets: [] });
  const [activeYear, setActiveYear] = useState(() => new Date().getFullYear().toString());
  const [isKFormat, setIsKFormat] = useState(true);
  const [yMax, setYMax] = useState(50);
  const [yStep, setYStep] = useState(10);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  // Meses del año
  const monthsLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  useEffect(() => {
    let salesSub: any;

    const setupSubscription = async () => {
      try {
        const db = await getDatabase();

        // Suscribirse a las ventas locales de RxDB en tiempo real
        salesSub = db.sales.find().$.subscribe(async (salesDocs) => {
          const sales = salesDocs.map(doc => doc.toJSON());

          // Detectar todos los años disponibles en las transacciones para el dropdown
          const yearsSet = new Set<string>();
          yearsSet.add(new Date().getFullYear().toString()); // Asegurar año actual
          sales.forEach(sale => {
            if (sale.createdAt) {
              const y = new Date(sale.createdAt).getFullYear().toString();
              yearsSet.add(y);
            }
          });
          setAvailableYears(Array.from(yearsSet).sort().reverse());

          // Cargar productos locales para mapear el ID del producto a su categoría real
          const productsDocs = await db.products.find().exec();
          const productsMap = new Map(productsDocs.map(p => [p.id, p.toJSON()]));

          // Encontrar las 2 categorías más vendidas (por volumen de ingresos)
          const categoryVolume: Record<string, number> = {};
          sales.forEach(sale => {
            sale.items.forEach(item => {
              const product = productsMap.get(item.productId);
              const category = product?.category || 'General';
              categoryVolume[category] = (categoryVolume[category] || 0) + (item.price * item.quantity);
            });
          });

          const sortedCategories = Object.entries(categoryVolume)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);

          // Fallbacks de categorías si el inventario/ventas están vacíos
          const cat1 = sortedCategories[0] || 'Ventas POS';
          const cat2 = sortedCategories[1] || 'Otros';

          // Agrupar ventas mensuales de la categoría especificada para el año activo
          const getMonthlySales = (categoryName: string) => {
            const monthlyData = new Array(12).fill(0);
            sales.forEach(sale => {
              const date = new Date(sale.createdAt);
              if (date.getFullYear().toString() === activeYear) {
                const monthIdx = date.getMonth();
                sale.items.forEach(item => {
                  const product = productsMap.get(item.productId);
                  const category = product?.category || 'General';
                  if (category === categoryName || (categoryName === 'Otros' && !sortedCategories.slice(0, 1).includes(category))) {
                    monthlyData[monthIdx] += (item.price * item.quantity);
                  } else if (categoryName === 'Ventas POS' && sortedCategories.length === 0) {
                    monthlyData[monthIdx] += (item.price * item.quantity);
                  }
                });
              }
            });
            return monthlyData;
          };

          const rawData1 = getMonthlySales(cat1);
          const rawData2 = getMonthlySales(cat2);

          // Determinar dinámicamente si los números justifican el formato de miles "k"
          const maxRawVal = Math.max(...rawData1, ...rawData2, 0);
          const needsK = maxRawVal >= 800; // Si supera $800, formatear en miles (k)
          setIsKFormat(needsK);

          // Convertir datos al formato final para graficar
          const finalData1 = rawData1.map(val => needsK ? Number((val / 1000).toFixed(2)) : Number(val.toFixed(2)));
          const finalData2 = rawData2.map(val => needsK ? Number((val / 1000).toFixed(2)) : Number(val.toFixed(2)));

          // Configurar máximos y divisiones del eje Y de forma inteligente
          const maxChartVal = Math.max(...finalData1, ...finalData2, needsK ? 10 : 100);
          const dynamicMax = Math.ceil(maxChartVal * 1.2 / 5) * 5; // Margen superior del 20%
          const dynamicStep = Math.ceil(dynamicMax / 5);

          setYMax(dynamicMax);
          setYStep(dynamicStep);

          const chart = chartRef.current;
          let fillBackground: any = 'rgba(223, 158, 255, 0.15)';
          if (chart) {
            const ctx = chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 180);
            gradient.addColorStop(0, 'rgba(223, 158, 255, 0.35)');
            gradient.addColorStop(1, 'rgba(223, 158, 255, 0.0)');
            fillBackground = gradient;
          }

          setChartData({
            labels: monthsLabels,
            datasets: [
              {
                label: cat1,
                data: finalData1,
                borderColor: '#df9eff',
                borderWidth: 3.5,
                tension: 0.45,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#df9eff',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 2,
                fill: true,
                backgroundColor: fillBackground,
              },
              {
                label: cat2,
                data: finalData2,
                borderColor: '#20e3b2',
                borderWidth: 2.5,
                borderDash: [5, 5],
                tension: 0.45,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#20e3b2',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 2,
                fill: false,
              }
            ]
          });
        });
      } catch (err) {
        console.error('Error in SalesChartCard RxDB loading:', err);
      }
    };

    setupSubscription();

    return () => {
      salesSub?.unsubscribe();
    };
  }, [isDarkMode, activeYear]);

  // Configuraciones adaptativas para ChartJS
  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Leyendas hechas a mano con interactividad avanzada
      },
      tooltip: {
        backgroundColor: isDarkMode ? '#ffffff' : '#121214',
        titleColor: isDarkMode ? '#121214' : '#ffffff',
        bodyColor: isDarkMode ? '#121214' : '#ffffff',
        bodyFont: {
          family: 'Plus Jakarta Sans',
          weight: 'bold',
          size: 11
        },
        padding: 10,
        cornerRadius: 10,
        displayColors: false,
        callbacks: {
          label: function (context: any) {
            return isKFormat ? `$ ${context.raw}k` : `$ ${context.raw.toFixed(2)}`;
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
        max: yMax,
        ticks: {
          stepSize: yStep,
          callback: function (value: any) {
            return isKFormat ? `$${value}k` : `$${value}`;
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

  const handleLegendClick = (datasetIndex: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    const isVisible = chart.isDatasetVisible(datasetIndex);
    if (isVisible) {
      chart.hide(datasetIndex);
    } else {
      chart.show(datasetIndex);
    }
  };

  return (
    <div className="widget sales-widget" style={{ minWidth: 0 }}>
      <div className="widget-header">
        <h3 className="widget-title">Ventas</h3>
        
        <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
          <div 
            className="dropdown-select" 
            onClick={() => setShowYearDropdown(!showYearDropdown)}
            style={{ cursor: 'pointer' }}
          >
            <span>{activeYear}</span>
            <ChevronDown size={14} />
          </div>

          {showYearDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              backgroundColor: 'var(--bg-widget)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '6px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: '90px',
              marginTop: '4px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(10px)'
            }}>
              {availableYears.map(year => (
                <div 
                  key={year}
                  onClick={() => {
                    setActiveYear(year);
                    setShowYearDropdown(false);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: activeYear === year ? 'bold' : 'normal',
                    backgroundColor: activeYear === year ? 'rgba(32, 227, 178, 0.15)' : 'transparent',
                    color: activeYear === year ? 'var(--brand-teal)' : 'var(--text-primary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {year}
                </div>
              ))}
            </div>
          )}
          
          <button className="btn-yellow" onClick={() => alert('¡Generando reporte en PDF de ventas anuales!')}>
            <Download size={14} />
            <span>Descargar</span>
          </button>
        </div>
      </div>
      
      <div className="sales-chart-container">
        <div className="sales-chart-canvas-wrap">
          {chartData.datasets.length > 0 && (
            <Line ref={chartRef} data={chartData} options={options} />
          )}
        </div>
      </div>
      
      <div className="chart-legend">
        {chartData.datasets.map((dataset: any, idx: number) => (
          <div key={idx} className="legend-item" onClick={() => handleLegendClick(idx)} style={{ cursor: 'pointer' }}>
            <div className={idx === 0 ? "legend-solid-bar" : "legend-dash-bar"} style={{ backgroundColor: dataset.borderColor }}></div>
            <span>{dataset.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
