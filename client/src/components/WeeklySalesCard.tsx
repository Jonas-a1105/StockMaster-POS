import { useState, useEffect } from 'react';
import { getDatabase } from '../db/database';

export default function WeeklySalesCard() {
  const [activeDay, setActiveDay] = useState('');
  const [barsData, setBarsData] = useState<any[]>([]);

  useEffect(() => {
    let salesSub: any;

    const setupSubscription = async () => {
      try {
        const db = await getDatabase();
        salesSub = db.sales.find().$.subscribe((salesDocs) => {
          const sales = salesDocs.map(doc => doc.toJSON());
          
          // Mapeo de días de la semana localizados
          const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
          
          // Generar los últimos 6 días naturales
          const today = new Date();
          const rawDays = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            rawDays.push(d);
          }

          // Colores de los cilindros alineados con el dashboard clone
          const fillClasses = [
            'fill-orange',
            'fill-pink',
            'fill-orange',
            'fill-green',
            'fill-orange',
            'fill-silver'
          ];

          // Agrupar ventas reales por día
          const computedBars = rawDays.map((date, idx) => {
            const dayName = daysOfWeek[date.getDay()];
            const dateStr = date.toDateString();
            
            const dailyTotal = sales
              .filter(sale => new Date(sale.createdAt).toDateString() === dateStr)
              .reduce((sum, sale) => sum + sale.total, 0);

            return {
              day: dayName,
              total: dailyTotal,
              fillClass: fillClasses[idx % fillClasses.length]
            };
          });

          // Obtener el valor máximo diario para escalar proporcionalmente
          const maxTotal = Math.max(...computedBars.map(b => b.total), 1); // Evitar división por cero
          
          const finalizedBars = computedBars.map(bar => {
            // Altura proporcional: mínimo 12% para estética si hay alguna venta, o 0% si es 0
            const pct = bar.total > 0 ? Math.max(12, (bar.total / maxTotal) * 85) : 0;
            
            // Formatear valor (ej. $12.5k o $250)
            const valueStr = bar.total >= 1000 
              ? `$ ${(bar.total / 1000).toFixed(1)}k` 
              : `$ ${bar.total.toFixed(0)}`;

            return {
              day: bar.day,
              fillClass: bar.fillClass,
              height: `${pct}%`,
              value: valueStr,
              rawTotal: bar.total
            };
          });

          setBarsData(finalizedBars);
          
          // Establecer el día activo al día actual o al último día de la lista
          const todayDayName = daysOfWeek[today.getDay()];
          if (finalizedBars.some(b => b.day === todayDayName)) {
            setActiveDay(todayDayName);
          } else if (finalizedBars.length > 0) {
            setActiveDay(finalizedBars[finalizedBars.length - 1].day);
          }
        });
      } catch (err) {
        console.error('Error in WeeklySalesCard:', err);
      }
    };

    setupSubscription();

    return () => {
      salesSub?.unsubscribe();
    };
  }, []);

  return (
    <div className="widget" style={{ padding: '24px 20px', flexGrow: 1 }}>
      <h3 className="widget-title" style={{ marginBottom: '10px' }}>Ventas Semanales</h3>
      
      <div className="weekly-sales-chart">
        {barsData.map((bar, idx) => {
          const isActive = activeDay === bar.day;
          return (
            <div 
              key={idx} 
              className="bar-column" 
              onClick={() => setActiveDay(bar.day)}
              style={{ cursor: 'pointer' }}
              title={`Haga clic para ver ventas del ${bar.day}`}
            >
              <div className="bar-cylinder-track">
                <div 
                  className={`bar-cylinder-fill ${bar.fillClass}`} 
                  style={{ height: bar.height, transition: 'height 0.4s ease' }}
                >
                  {/* Tooltip con rebote animado que se mueve al hacer clic */}
                  {isActive && (
                    <div className="bar-tooltip-wrapper" style={{ animation: 'bounceIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                      <div className="bar-tooltip">{bar.value}</div>
                    </div>
                  )}
                </div>
              </div>
              <span className="bar-label" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isActive ? '800' : '700' }}>
                {bar.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
