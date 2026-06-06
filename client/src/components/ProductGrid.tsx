import React from 'react';
import { Search, Camera, Filter, AlertTriangle } from 'lucide-react';
import type { ProductDocType } from '../db/database';
import { useExchangeRate } from '../contexts/ExchangeRateContext';

interface ProductGridProps {
  products: ProductDocType[];
  filteredProducts: ProductDocType[];
  categories: string[];
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
  stockFilter: 'todos' | 'disponible' | 'agotado';
  setStockFilter: (filter: 'todos' | 'disponible' | 'agotado') => void;
  localSearchTerm: string;
  setLocalSearchTerm: (term: string) => void;
  searchTerm?: string;
  errorMessage: string | null;
  onAddToCart: (product: ProductDocType) => void;
  onOpenScanner: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  filteredProducts,
  categories,
  categoryFilter,
  setCategoryFilter,
  stockFilter,
  setStockFilter,
  localSearchTerm,
  setLocalSearchTerm,
  searchTerm,
  errorMessage,
  onAddToCart,
  onOpenScanner,
}) => {
  const { convertToVES, formatUSD } = useExchangeRate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
      {/* Buscador local */}
      {!searchTerm && (
        <div className="pos-search-row" style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
          <div className="search-container pos-search-container" style={{ flex: 1 }}>
            <Search className="search-icon" size={16} />
            <input
              type="text"
              data-tour="pos-search-input"
              placeholder="Buscar por nombre, código de barras o categoría..."
              className="search-input pos-search-input"
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={onOpenScanner}
            className="btn-yellow pos-camera-btn"
            title="Escáner por Cámara WebRTC"
          >
            <Camera size={18} />
          </button>
        </div>
      )}

      {/* ===== FILTROS DE PRODUCTOS ===== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Category row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, marginRight: '2px' }}>
            <Filter size={13} />
            <span>Filtros:</span>
          </div>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                border: categoryFilter === cat ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                backgroundColor: categoryFilter === cat ? 'var(--brand-primary-light)' : 'var(--bg-input)',
                color: categoryFilter === cat ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              {cat}
            </button>
          ))}
          {/* Stock status filter - inline separator */}
          <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)', margin: '0 2px', flexShrink: 0 }} />
          {([
            ['todos', 'Todos'],
            ['disponible', 'Con Stock'],
            ['agotado', 'Agotado'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStockFilter(val)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                border: stockFilter === val
                  ? `1.5px solid ${val === 'agotado' ? '#ef4444' : val === 'disponible' ? '#22c55e' : 'var(--border-color)'}`
                  : '1.5px solid var(--border-color)',
                backgroundColor: stockFilter === val
                  ? val === 'agotado' ? 'rgba(239,68,68,0.08)' : val === 'disponible' ? 'rgba(34,197,94,0.08)' : 'var(--bg-input)'
                  : 'var(--bg-input)',
                color: stockFilter === val
                  ? val === 'agotado' ? '#ef4444' : val === 'disponible' ? '#22c55e' : 'var(--text-secondary)'
                  : 'var(--text-secondary)',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Mensaje de Alerta / Error */}
      {errorMessage && (
        <div className="animate-entrance" style={{
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          color: '#ef4444',
          padding: '12px 18px',
          borderRadius: '16px',
          fontSize: '12.5px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1.5px solid rgba(239, 68, 68, 0.15)',
        }}>
          <AlertTriangle size={14} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Mosaico de Productos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: '20px',
        paddingRight: '6px',
      }} data-tour="pos-product-grid">
        {filteredProducts.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            No se encontraron productos disponibles en el inventario local.
          </div>
        ) : (
          filteredProducts.map((prod) => {
            const isLowStock = prod.stock <= prod.minStock;
            const prodPriceVES = convertToVES(prod.price);
            return (
              <div
                key={prod.id}
                onClick={() => onAddToCart(prod)}
                className="widget animate-entrance"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: 'var(--card-radius)',
                  cursor: 'pointer',
                  minHeight: '155px',
                  position: 'relative',
                  transition: 'all 0.25s ease',
                  opacity: prod.stock === 0 ? 0.6 : 1,
                }}
              >
                <div>
                  <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {prod.category}
                  </span>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 800, margin: '4px 0 2px 0', lineHeight: '1.2', color: 'var(--text-primary)' }}>
                    {prod.name}
                  </h4>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    SKU: {prod.code}
                  </span>
                </div>

                {/* Moneda dual en cada producto del catálogo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '15px', fontWeight: 850, color: 'var(--text-primary)', margin: 0 }}>
                      {formatUSD(prod.price)}
                    </span>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--brand-gold)', fontFamily: 'monospace', marginTop: '1px' }}>
                      Bs. {prodPriceVES.toLocaleString('es-VE', { maximumFractionDigits: 1 })}
                    </span>
                  </div>
                  <span className={`status-badge ${prod.stock === 0 ? 'shipped' : isLowStock ? 'shipped' : 'delivered'}`} style={{ fontSize: '10px' }}>
                    {prod.stock === 0 ? 'Agotado' : `${prod.stock} u.`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
