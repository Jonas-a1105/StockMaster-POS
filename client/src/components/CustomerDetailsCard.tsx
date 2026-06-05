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

  const ITEMS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="widget" style={{ flexGrow: 1 }}>
      <div className="widget-header">
        <h3 className="widget-title">Detalles del Cliente</h3>
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
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => (
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

      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 0 4px 0',
          borderTop: '1px solid var(--border-color)',
          marginTop: '12px'
        }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn-pill-dark"
            style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
          >
            ← Anterior
          </button>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="btn-pill-dark"
            style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
