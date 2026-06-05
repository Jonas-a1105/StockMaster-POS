import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { getDatabase, type ProductDocType, type SaleDocType } from '../db/database';
import { type RxDocument } from 'rxdb';

interface TopProduct {
  id: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

export default function TopProductsCard() {
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let salesSub: { unsubscribe: () => void } | undefined;
    let productsSub: { unsubscribe: () => void } | undefined;
    let productsList: ProductDocType[] = [];
    let salesList: SaleDocType[] = [];

    const calculateTopProducts = () => {
      const productMap = new Map<string, ProductDocType>(productsList.map(p => [p.id, p]));
      const statsMap: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {};

      salesList.forEach((sale) => {
        if (!sale.items) return;
        sale.items.forEach((item) => {
          const prod = productMap.get(item.productId);
          const name = prod?.name || `Producto #${item.productId.slice(-4)}`;
          const category = prod?.category || 'General';
          
          if (!statsMap[item.productId]) {
            statsMap[item.productId] = {
              name,
              category,
              quantity: 0,
              revenue: 0
            };
          }
          statsMap[item.productId].quantity += item.quantity || 0;
          statsMap[item.productId].revenue += (item.quantity || 0) * (item.price || 0);
        });
      });

      const sorted = Object.entries(statsMap)
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3);

      setTopProducts(sorted);
      setLoading(false);
    };

    const setupSubscriptions = async () => {
      try {
        const db = await getDatabase();
        
        productsSub = db.products.find().$.subscribe((prods: RxDocument<ProductDocType>[]) => {
          productsList = prods.map(p => p.toJSON());
          calculateTopProducts();
        });

        salesSub = db.sales.find().$.subscribe((salesDocs: RxDocument<SaleDocType>[]) => {
          salesList = salesDocs.map(s => s.toJSON());
          calculateTopProducts();
        });
      } catch (err) {
        console.error('Error loading top products statistics:', err);
        setLoading(false);
      }
    };

    setupSubscriptions();

    return () => {
      salesSub?.unsubscribe();
      productsSub?.unsubscribe();
    };
  }, []);

  return (
    <div className="widget" style={{ flexGrow: 1 }}>
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Trophy size={18} style={{ color: 'var(--accent-yellow)' }} />
          <h3 className="widget-title">Top 3 Productos Más Vendidos</h3>
        </div>
      </div>
      
      <div className="details-table-wrapper">
        <table className="details-table">
          <thead>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>Puesto</th>
              <th>Producto</th>
              <th>Categoría</th>
              <th style={{ textAlign: 'right' }}>Unidades</th>
              <th style={{ textAlign: 'right' }}>Total Facturado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px', fontWeight: 650 }}>
                  Cargando estadísticas...
                </td>
              </tr>
            ) : topProducts.length > 0 ? (
              topProducts.map((row, idx) => {
                const rank = idx + 1;
                const badgeColor = rank === 1 ? 'rgba(255, 215, 0, 0.15)' : rank === 2 ? 'rgba(192, 192, 192, 0.15)' : 'rgba(205, 127, 50, 0.15)';
                const badgeTextColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : '#cd7f32';
                
                return (
                  <tr key={row.id} style={{ animation: 'fadeIn 0.3s ease' }}>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: badgeColor,
                        color: badgeTextColor,
                        fontWeight: '800',
                        fontSize: '12px'
                      }}>
                        {rank}
                      </span>
                    </td>
                    <td style={{ fontWeight: '700' }}>{row.name}</td>
                    <td>
                      <span className="status-badge paid" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                        {row.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700' }}>{row.quantity} u</td>
                    <td style={{ textAlign: 'right', color: 'var(--brand-teal, #20e3b2)', fontWeight: '700' }}>
                      $ {row.revenue.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px', fontWeight: 600 }}>
                  No se encontraron ventas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
