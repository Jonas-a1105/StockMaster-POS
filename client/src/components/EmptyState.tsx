import { Package, Inbox, Users, Receipt, BarChart3, Search } from 'lucide-react';

interface EmptyStateProps {
  type: 'products' | 'sales' | 'clients' | 'suppliers' | 'payroll' | 'search';
  actionLabel?: string;
  onAction?: () => void;
}

const config = {
  products: { icon: Package, title: 'Sin productos', desc: 'Agrega tu primer producto al inventario para comenzar a vender.' },
  sales: { icon: Receipt, title: 'Sin ventas', desc: 'Las ventas realizadas aparecerán aquí. Usa el módulo POS para registrar.' },
  clients: { icon: Users, title: 'Sin clientes', desc: 'Registra clientes para llevar cuentas por cobrar y control de crédito.' },
  suppliers: { icon: Inbox, title: 'Sin proveedores', desc: 'Agrega proveedores para gestionar órdenes de compra y abastecimiento.' },
  payroll: { icon: BarChart3, title: 'Sin registros de nómina', desc: 'Administra los pagos y recibos de sueldo de tus empleados.' },
  search: { icon: Search, title: 'Sin resultados', desc: 'No encontramos coincidencias con tu búsqueda. Intenta con otro término.' },
};

export default function EmptyState({ type, actionLabel, onAction }: EmptyStateProps) {
  const { icon: Icon, title, desc } = config[type] || config.search;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 20px', textAlign: 'center', gap: 12,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1.5px dashed var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)',
      }}>
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 300, lineHeight: 1.5 }}>{desc}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-yellow" style={{ marginTop: 8, padding: '10px 24px' }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
