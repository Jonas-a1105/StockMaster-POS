import { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  FileText, 
  BarChart3, 
  ShieldAlert,
  ChevronLeft, 
  Menu,
  Users,
  Truck,
  Layers,
  MoreHorizontal,
  Wifi,
  WifiOff,
  Lock,
  Settings
} from 'lucide-react';
import logoImg from '../assets/logo.png';

interface SidebarProps {
  activeTab: 'dashboard' | 'pos' | 'inventario' | 'compras' | 'nomina' | 'clientes' | 'proveedores' | 'analiticas' | 'auditoria' | 'cierre' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'pos' | 'inventario' | 'compras' | 'nomina' | 'clientes' | 'proveedores' | 'analiticas' | 'auditoria' | 'cierre' | 'settings') => void;
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  user: {
    role: string;
  };
  onlineStatus: boolean;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  sidebarExpanded, 
  setSidebarExpanded,
  user,
  onlineStatus
}: SidebarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const ALLOWED_TABS: Record<string, string[]> = {
    ADMIN: ['dashboard', 'pos', 'inventario', 'compras', 'nomina', 'clientes', 'proveedores', 'cierre', 'analiticas', 'auditoria', 'settings'],
    AUDITOR: ['dashboard', 'inventario', 'clientes', 'proveedores', 'analiticas', 'auditoria'],
    CASHIER: ['pos', 'cierre']
  };

  const roleAllowedTabs = ALLOWED_TABS[user.role] || [];
  const getDefaultTab = () => {
    if (user.role === 'CASHIER') return 'pos';
    return 'dashboard';
  };

  // Navigation tabs adapted to StockMasterPro with keyboard shortcut hints (D3)
  const shortcutMap: Record<string, string> = {
    'dashboard': 'F5',
    'pos': 'F3',
    'inventario': 'F4',
  };

  const navItems = [
    { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Resumen' },
    { id: 'pos' as const, icon: ShoppingCart, label: 'Ventas POS' },
    { id: 'inventario' as const, icon: Package, label: 'Inventario' },
    { id: 'compras' as const, icon: Layers, label: 'Compras y OCR' },
    { id: 'nomina' as const, icon: FileText, label: 'Nómina fiscal' },
    { id: 'clientes' as const, icon: Users, label: 'Clientes' },
    { id: 'proveedores' as const, icon: Truck, label: 'Proveedores' },
    { id: 'cierre' as const, icon: Lock, label: 'Arqueo de Caja' },
    { id: 'analiticas' as const, icon: BarChart3, label: 'Reportes' },
    { id: 'auditoria' as const, icon: ShieldAlert, label: 'Auditoría' },
    { id: 'settings' as const, icon: Settings, label: 'Configuración' }
  ].filter(item => roleAllowedTabs.includes(item.id));

  // Partition navigation dynamically for mobile bottom bar
  const showMoreButton = navItems.length > 5;
  const primaryIds = ['dashboard', 'pos', 'inventario', 'cierre'];
  
  const primaryItems = showMoreButton 
    ? navItems.filter(item => primaryIds.includes(item.id))
    : navItems;
    
  const drawerItems = showMoreButton 
    ? navItems.filter(item => !primaryIds.includes(item.id))
    : [];

  // Determine if active tab is in the drawer, to highlight the "Más" button
  const isMoreActive = drawerItems.some(item => item.id === activeTab);

  return (
    <>
      {/* Desktop Sidebar (Desktop Only) */}
      <aside className={`sidebar desktop-sidebar ${sidebarExpanded ? 'expanded' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-header-row">
            <div 
              className="logo-container" 
              title="StockMasterPro" 
              onClick={() => setActiveTab(getDefaultTab() as any)}
            >
              <img src={logoImg} alt="Logotipo Circular" className="logo-img" />
            </div>
            
            {/* Collapse/Expand Toggle Button */}
            <button 
              className="sidebar-toggle-btn"
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              title={sidebarExpanded ? "Colapsar menú" : "Expandir menú"}
            >
              {sidebarExpanded ? <ChevronLeft size={20} /> : <Menu size={20} />}
            </button>
          </div>
          
          <nav className="nav-links">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const shortcutKey = shortcutMap[item.id];
              
              return (
                <div 
                  key={item.id} 
                  className={`nav-item ${isActive ? 'active' : ''}`} 
                  title={shortcutKey ? `${item.label} [${shortcutKey}]` : item.label}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon size={20} />
                  <span className="nav-item-label">{item.label}</span>
                  {shortcutKey && sidebarExpanded && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '9px',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'rgba(14, 165, 164, 0.1)',
                      color: isActive ? '#fff' : 'var(--brand-primary)',
                      border: `1px solid ${isActive ? 'rgba(255,255,255,0.2)' : 'rgba(14, 165, 164, 0.15)'}`,
                      lineHeight: '1',
                      flexShrink: 0
                    }}>
                      {shortcutKey}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
        
        <div className="sidebar-bottom">
          <div 
            className="nav-item" 
            title="StockMasterPro POS" 
            style={{ opacity: 0.8, cursor: 'default' }}
          >
            <span style={{ fontSize: '16px' }}>🛡️</span>
            {sidebarExpanded && (
              <span className="nav-item-label" style={{ color: 'var(--brand-teal)', fontSize: '11px', fontWeight: 800 }}>
                SECURE SYSTEM
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (Mobile Only via CSS) */}
      <div className="mobile-bottom-nav">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                setIsDrawerOpen(false);
              }}
              title={item.label}
            >
              <Icon size={20} />
              <span className="mobile-nav-label">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
        
        {/* Toggle Button for More Menu */}
        {showMoreButton && (
          <button
            className={`mobile-nav-btn ${isMoreActive ? 'active' : ''}`}
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            title="Ver Más Opciones"
          >
            <MoreHorizontal size={20} />
            <span className="mobile-nav-label">Más</span>
          </button>
        )}
      </div>

      {/* Bottom Drawer Overlay */}
      <div 
        className={`mobile-drawer-overlay ${isDrawerOpen ? 'open' : ''}`} 
        onClick={() => setIsDrawerOpen(false)}
      />

      {/* Mobile Drawer (Bottom Sheet) */}
      <div className={`mobile-bottom-drawer ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-handle" />
        <h3 className="drawer-title">Menú de Navegación</h3>
        
        <div className="drawer-grid">
          {drawerItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div
                key={item.id}
                className={`drawer-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsDrawerOpen(false);
                }}
              >
                <div className="drawer-item-icon">
                  <Icon size={20} />
                </div>
                <span className="drawer-item-label">{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Online Status moved to this bottom sheet drawer on mobile */}
        <div className="drawer-footer">
          <div 
            className="drawer-online-badge"
            style={{
              border: `1px solid ${onlineStatus ? 'rgba(14, 165, 164, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
              backgroundColor: onlineStatus ? 'rgba(14, 165, 164, 0.05)' : 'rgba(239, 68, 68, 0.05)',
              color: onlineStatus ? 'var(--brand-primary, var(--brand-teal))' : '#ef4444',
            }}
          >
            {onlineStatus ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>SISTEMA {onlineStatus ? 'ONLINE (CENTRAL)' : 'OFFLINE (LOCAL)'}</span>
          </div>
        </div>
      </div>
    </>
  );
}
