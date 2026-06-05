import { useState, useEffect } from 'react';
import { getDatabase } from '../db/database';
import CustomSelect from './CustomSelect';

interface CalendarCardProps {
  setActiveTab: (tab: 'dashboard' | 'pos' | 'inventario' | 'compras' | 'nomina' | 'clientes' | 'proveedores' | 'analiticas' | 'auditoria' | 'cierre' | 'settings') => void;
}

export default function CalendarCard({ setActiveTab }: CalendarCardProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [sales, setSales] = useState<any[]>([]);
  const [selectedCell, setSelectedCell] = useState<any | null>(null);

  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const years = [2023, 2024, 2025, 2026];

  // Subscribe to local RxDB sales to highlight sales days reactively
  useEffect(() => {
    let salesSub: any;
    const setupSubscription = async () => {
      try {
        const db = await getDatabase();
        salesSub = db.sales.find().$.subscribe((salesDocs) => {
          setSales(salesDocs.map(doc => doc.toJSON()));
        });
      } catch (err) {
        console.error('Error in CalendarCard sales subscription:', err);
      }
    };
    setupSubscription();
    return () => {
      salesSub?.unsubscribe();
    };
  }, []);

  // Calculate days for the calendar grid
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // Sunday is 0
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const cells: Array<{
    id: string;
    value: number;
    month: number;
    year: number;
    muted: boolean;
    highlighted: boolean;
    salesTotal: number;
    salesCount: number;
  }> = [];

  // Muted days from previous month
  const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayVal = totalDaysInPrevMonth - i;
    cells.push({
      id: `prev-${dayVal}`,
      value: dayVal,
      month: prevMonthIndex,
      year: prevYear,
      muted: true,
      highlighted: false,
      salesTotal: 0,
      salesCount: 0
    });
  }

  // Active days of current month
  for (let i = 1; i <= totalDaysInMonth; i++) {
    const daySales = sales.filter(sale => {
      const saleDate = new Date(sale.createdAt);
      return (
        saleDate.getFullYear() === currentYear &&
        saleDate.getMonth() === currentMonth &&
        saleDate.getDate() === i
      );
    });
    const salesTotal = daySales.reduce((sum, s) => sum + s.total, 0);

    cells.push({
      id: `curr-${i}`,
      value: i,
      month: currentMonth,
      year: currentYear,
      muted: false,
      highlighted: daySales.length > 0,
      salesTotal,
      salesCount: daySales.length
    });
  }

  // Muted days from next month to fill grid to 42 cells (6 rows)
  const remaining = 42 - cells.length;
  const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  for (let i = 1; i <= remaining; i++) {
    cells.push({
      id: `next-${i}`,
      value: i,
      month: nextMonthIndex,
      year: nextYear,
      muted: true,
      highlighted: false,
      salesTotal: 0,
      salesCount: 0
    });
  }

  const dayHeaders = ["D", "L", "M", "M", "J", "V", "S"];

  return (
    <div className="widget calendar-widget" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '300px' }}>
      <div className="widget-header" style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <CustomSelect 
            value={currentMonth} 
            onChange={(val) => {
              setCurrentMonth(Number(val));
              setSelectedCell(null);
            }}
            options={months.map((m, idx) => ({ value: idx, label: m }))}
            style={{ minWidth: '85px' }}
          />
          <CustomSelect 
            value={currentYear} 
            onChange={(val) => {
              setCurrentYear(Number(val));
              setSelectedCell(null);
            }}
            options={years.map(y => ({ value: y, label: String(y) }))}
            style={{ minWidth: '85px' }}
          />
        </div>
        
        <span className="calendar-link-view" onClick={() => setActiveTab('analiticas')}>Ver</span>
      </div>
      
      <div className="calendar-days-header">
        {dayHeaders.map((dh, i) => (
          <div key={i}>{dh}</div>
        ))}
      </div>
      
      <div className="calendar-grid" style={{ flexGrow: 1 }}>
        {cells.map((day) => {
          const isClicked = selectedCell && selectedCell.id === day.id;
          
          let cellClass = "calendar-cell";
          if (day.muted) cellClass += " muted";
          if (day.highlighted) cellClass += " highlighted";
          if (isClicked) cellClass += " selected-active";
          
          return (
            <div 
              key={day.id} 
              className={cellClass}
              onClick={() => {
                if (day.muted) return;
                setSelectedCell(isClicked ? null : day);
              }}
              title={day.muted ? "" : `Ventas: ${day.salesCount} tickets, Total: $${day.salesTotal.toFixed(2)}`}
            >
              {day.value}
            </div>
          );
        })}
      </div>

      {selectedCell && (
        <div style={{
          marginTop: '12px',
          padding: '10px 12px',
          backgroundColor: 'var(--bg-input)',
          borderRadius: '10px',
          fontSize: '11px',
          border: '1.5px solid var(--border-color)',
          animation: 'fadeIn 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{selectedCell.value} de {months[selectedCell.month]}, {selectedCell.year}</span>
            {selectedCell.salesCount > 0 && (
              <span style={{ color: 'var(--brand-teal)', fontWeight: '800' }}>Con Ventas</span>
            )}
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {selectedCell.salesCount > 0 ? (
              <span>Ventas: <strong>{selectedCell.salesCount} tickets</strong> | Total: <strong>${selectedCell.salesTotal.toFixed(2)}</strong></span>
            ) : (
              <span>Sin transacciones registradas.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
