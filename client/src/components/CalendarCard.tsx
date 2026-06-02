import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CalendarCard() {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);

  // Días desvanecidos de Enero
  const janDays = [
    { value: 27, muted: true, highlighted: false },
    { value: 28, muted: true, highlighted: false },
    { value: 29, muted: true, highlighted: false },
    { value: 30, muted: true, highlighted: false },
    { value: 31, muted: true, highlighted: false }
  ];
  
  // Días de Febrero
  const febDays = Array.from({ length: 28 }, (_, i) => {
    const dayVal = i + 1;
    const isDefaultHighlighted = dayVal >= 3 && dayVal <= 7;
    return {
      id: `feb-${dayVal}`,
      value: dayVal,
      muted: false,
      highlighted: isDefaultHighlighted
    };
  });
  
  // Días desvanecidos de Marzo
  const marDays = [
    { value: 29, muted: true, highlighted: false },
    { value: 30, muted: true, highlighted: false }
  ];
  
  const allDays = [
    ...janDays.map((d, i) => ({ ...d, id: `jan-${i}` })),
    ...febDays,
    ...marDays.map((d, i) => ({ ...d, id: `mar-${i}` }))
  ];

  // Abreviaciones de días en Español (D, L, M, M, J, V, S)
  const dayHeaders = ["D", "L", "M", "M", "J", "V", "S"];

  const handleCellClick = (cellId: string, isMuted: boolean) => {
    if (isMuted) return;
    setSelectedCell(cellId === selectedCell ? null : cellId);
  };
  
  return (
    <div className="widget calendar-widget">
      <div className="widget-header" style={{ marginBottom: '14px' }}>
        <div className="dropdown-select" style={{ padding: '6px 12px' }}>
          <span>Feb 2023</span>
          <ChevronDown size={14} />
        </div>
        
        <span className="calendar-link-view" onClick={() => alert('¡Abriendo vista completa del calendario!')}>Ver</span>
      </div>
      
      <div className="calendar-days-header">
        {dayHeaders.map((dh, i) => (
          <div key={i}>{dh}</div>
        ))}
      </div>
      
      <div className="calendar-grid">
        {/* Barra amarilla horizontal para los días del 3 al 7 */}
        <div className="calendar-highlight-bar"></div>
        
        {allDays.map((day) => {
          const isClicked = selectedCell === day.id;
          
          let cellClass = "calendar-cell";
          if (day.muted) cellClass += " muted";
          if (day.highlighted) cellClass += " highlighted";
          if (isClicked) cellClass += " selected-active";
          
          return (
            <div 
              key={day.id} 
              className={cellClass}
              onClick={() => handleCellClick(day.id, day.muted || false)}
              title={day.muted ? "" : `Haga clic para seleccionar el ${day.value} de Febrero`}
            >
              {day.value}
            </div>
          );
        })}
      </div>
    </div>
  );
}
