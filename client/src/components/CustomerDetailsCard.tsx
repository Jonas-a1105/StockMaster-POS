import { useState, useEffect } from 'react';
import { SlidersHorizontal, Download } from 'lucide-react';
import { getDatabase } from '../db/database';

interface CustomerDetailsCardProps {
  searchTerm: string;
}

export default function CustomerDetailsCard({ searchTerm }: CustomerDetailsCardProps) {
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    let salesSub: any;

    const setupSubscription = async () => {
      try {
        const db = await getDatabase();
        salesSub = db.sales.find().$.subscribe((salesDocs) => {
          const sortedSales = salesDocs
            .map(doc => doc.toJSON())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSales(sortedSales);
        });
      } catch (err) {
        console.error('Error loading CustomerDetailsCard transactions:', err);
      }
    };

    setupSubscription();

    return () => {
      salesSub?.unsubscribe();
    };
  }, []);

  // Mapear transacciones reales de la base de datos a filas de la tabla
  const tableData = sales.map(sale => {
    const isPending = sale.pendingSync;
    return {
      id: sale.ticketNumber || `TX-${sale.id.slice(-6).toUpperCase()}`,
      customer: sale.clientId || 'Cliente General',
      date: new Date(sale.createdAt).toLocaleDateString('es-ES'),
      amount: `$ ${sale.total.toFixed(2)}`,
      status: isPending ? 'En Cola' : 'Sincronizado',
      statusClass: isPending ? 'shipped' : 'delivered' // orange (shipped) vs green (delivered)
    };
  });

  // Filtra las filas según la búsqueda en tiempo real
  const filteredData = tableData.filter((row) => {
    const s = searchTerm.toLowerCase();
    return (
      row.customer.toLowerCase().includes(s) ||
      row.id.toLowerCase().includes(s) ||
      row.status.toLowerCase().includes(s)
    );
  });

  return (
    <div className="widget" style={{ flexGrow: 1 }}>
      <div className="widget-header">
        <h3 className="widget-title">Detalles del Cliente</h3>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-pill-dark" onClick={() => alert('Filtros avanzados de facturas activos')}>
            <SlidersHorizontal size={14} />
            <span>Filtrar</span>
          </button>
          
          <button className="btn-yellow" onClick={() => alert('¡Descargando reporte de transacciones de clientes!')}>
            <Download size={14} />
            <span>Descargar</span>
          </button>
        </div>
      </div>
      
      <div className="details-table-wrapper">
        <table className="details-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th>Monto Facturado</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row, idx) => (
                <tr key={idx} style={{ animation: 'fadeIn 0.3s ease' }}>
                  <td className="row-id">{row.id}</td>
                  <td style={{ fontWeight: '700' }}>{row.customer}</td>
                  <td>{row.date}</td>
                  <td>{row.amount}</td>
                  <td>
                    <span className={`status-badge ${row.statusClass}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px', fontWeight: 600 }}>
                  No se encontraron transacciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
