interface OverviewCardsProps {
  totalRevenue: number;
  salesCount: number;
  productsCount: number;
}

export default function OverviewCards({ totalRevenue, salesCount, productsCount }: OverviewCardsProps) {
  // Format revenue beautifully
  const formattedRevenue = totalRevenue >= 1000 
    ? `$ ${(totalRevenue / 1000).toFixed(1)}k` 
    : `$ ${totalRevenue.toFixed(2)}`;

  return (
    <div className="overview-row">
      {/* Tarjeta 1: Balance Semanal (Real dynamic revenue) */}
      <div className="overview-card-wrapper">
        <div className="overview-card card-bg-teal has-right-notch">
          <div className="card-title">Balance de Caja</div>
          <div className="card-value" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {formattedRevenue}
          </div>
          <div className="card-link" onClick={() => alert('¡Visualizando balance total de transacciones locales!')}>
            Total ingresos reales
          </div>
        </div>
      </div>
      
      {/* Puente Conector 1 */}
      <div className="card-connector-gap">
        <div className="card-connector-bridge"></div>
      </div>
      
      {/* Tarjeta 2: Pedidos en Línea (Real dynamic transaction count) */}
      <div className="overview-card-wrapper">
        <div className="overview-card card-bg-orange has-left-notch has-right-notch">
          <div className="card-title">Transacciones POS</div>
          <div className="card-value">{salesCount}</div>
          <div className="card-link" onClick={() => alert('¡Visualizando listado completo de facturas!')}>
            Ver historial de caja
          </div>
        </div>
      </div>
      
      {/* Puente Conector 2 */}
      <div className="card-connector-gap">
        <div className="card-connector-bridge"></div>
      </div>
      
      {/* Tarjeta 3: Clientes Nuevos (Real dynamic products count) */}
      <div className="overview-card-wrapper">
        <div className="overview-card card-bg-purple has-left-notch">
          <div className="card-title">Catálogo Productos</div>
          <div className="card-value">{productsCount}</div>
          <div className="card-link" onClick={() => alert('¡Abriendo el panel de inventario y OCR!')}>
            Ver catálogo completo
          </div>
        </div>
      </div>
    </div>
  );
}
