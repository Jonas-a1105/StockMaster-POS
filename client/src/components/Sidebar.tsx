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
  Shield,
  Truck,
  Layers,
  MoreHorizontal,
  Wifi,
  WifiOff,
  Lock,
  Settings,
  HelpCircle,
  UserCircle2
} from 'lucide-react';
import logoImg from '../assets/logo.png';
import { PLAN_LIMITS } from '../utils/license';

interface SidebarProps {
  activeTab: 'dashboard' | 'pos' | 'inventario' | 'compras' | 'nomina' | 'clientes' | 'proveedores' | 'analiticas' | 'auditoria' | 'cierre' | 'settings' | 'users' | 'about' | 'profile';
  setActiveTab: (tab: 'dashboard' | 'pos' | 'inventario' | 'compras' | 'nomina' | 'clientes' | 'proveedores' | 'analiticas' | 'auditoria' | 'cierre' | 'settings' | 'users' | 'about' | 'profile') => void;
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  user: {
    role: string;
  };
  onlineStatus: boolean;
  licenseState?: any;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  sidebarExpanded, 
  setSidebarExpanded,
  user,
  onlineStatus,
  licenseState
}: SidebarProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isTabAllowedByPlan = (tabId: string): boolean => {
    if (tabId === 'about') return true;
    if (!licenseState) return true;
    if (licenseState.demoActive) return true;
    if (!licenseState.plan) return false;
    const limits = PLAN_LIMITS[licenseState.plan as keyof typeof PLAN_LIMITS];
    if (!limits) return false;
    return limits.allowedTabs.includes(tabId);
  };

  const renderNavIcon = (Icon: any, id: string) => {
    const isAllowed = isTabAllowedByPlan(id);
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={20} />
        {!isAllowed && (
          <div style={{
            position: 'absolute',
            bottom: '-4px',
            right: '-4px',
            backgroundColor: '#ef4444',
            borderRadius: '50%',
            width: '12px',
            height: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid var(--bg-card)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            <Lock size={7} style={{ color: '#fff' }} />
          </div>
        )}
      </div>
    );
  };
  const ALLOWED_TABS: Record<string, string[]> = {
    ADMIN: ['dashboard', 'pos', 'inventario', 'compras', 'nomina', 'clientes', 'proveedores', 'cierre', 'analiticas', 'auditoria', 'settings', 'users', 'profile'],
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
    'dashboard': 'Alt+1',
    'pos': 'Alt+2',
    'inventario': 'Alt+3',
    'compras': 'Alt+4',
    'nomina': 'Alt+5',
    'clientes': 'Alt+6',
    'proveedores': 'Alt+7',
    'cierre': 'Alt+8',
    'analiticas': 'Alt+9',
    'auditoria': 'Alt+0',
    'users': 'Alt+U',
    'settings': 'Alt+S',
    'about': 'Alt+A',
    'profile': 'Alt+P',
  };

  // Global keyboard shortcuts for navigation (Alt+1..9, etc.)
  useState(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const map: Record<string, string> = {
        '1': 'dashboard', '2': 'pos', '3': 'inventario', '4': 'compras',
        '5': 'nomina', '6': 'clientes', '7': 'proveedores', '8': 'cierre',
        '9': 'analiticas', '0': 'auditoria',
        'u': 'users', 's': 'settings', 'a': 'about', 'p': 'profile',
      };
      const tab = map[e.key.toLowerCase()];
      if (tab && roleAllowedTabs.includes(tab)) {
        e.preventDefault();
        setActiveTab(tab as any);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const navItems = [
    { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Resumen' },
    { id: 'pos' as const, icon: ShoppingCart, label: 'Ventas POS' },
    { id: 'inventario' as const, icon: Package, label: 'Inventario' },
    { id: 'compras' as const, icon: Layers, label: 'Compras' },
    { id: 'nomina' as const, icon: FileText, label: 'Nómina fiscal' },
    { id: 'clientes' as const, icon: Users, label: 'Clientes' },
    { id: 'proveedores' as const, icon: Truck, label: 'Proveedores' },
    { id: 'cierre' as const, icon: Lock, label: 'Arqueo de Caja' },
    { id: 'analiticas' as const, icon: BarChart3, label: 'Reportes' },
    { id: 'auditoria' as const, icon: ShieldAlert, label: 'Auditoría' },
    { id: 'users' as const, icon: Shield, label: 'Usuarios' },
    { id: 'settings' as const, icon: Settings, label: 'Configuración' },
    { id: 'profile' as const, icon: UserCircle2, label: 'Mi Perfil' },
    { id: 'about' as const, icon: HelpCircle, label: 'Acerca de' }
  ].filter(item => roleAllowedTabs.includes(item.id) || item.id === 'about');

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
          
          <nav className="nav-links" aria-label="Navegación principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const shortcutKey = shortcutMap[item.id];
              const isAllowed = isTabAllowedByPlan(item.id);
              
              return (
                <div 
                  key={item.id} 
                  data-tour={`sidebar-${item.id}`}
                  className={`nav-item ${isActive ? 'active' : ''}`} 
                  title={`${item.label} ${isAllowed ? '' : '(Restringido) '} [${shortcutKey}]`}
                  onClick={() => setActiveTab(item.id)}
                  role="button"
                  tabIndex={0}
                  style={{ opacity: isAllowed ? 1 : 0.45 }}
                  aria-current={isActive ? 'page' : undefined}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(item.id); } }}
                >
                  {renderNavIcon(Icon, item.id)}
                  <span className="nav-item-label">{item.label}</span>
                  {shortcutKey && (
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
                      flexShrink: 0,
                      display: sidebarExpanded ? 'inline' : 'none'
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
          const isAllowed = isTabAllowedByPlan(item.id);
          return (
            <button
              key={item.id}
              data-tour={`sidebar-${item.id}`}
              className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(item.id);
                setIsDrawerOpen(false);
              }}
              style={{ opacity: isAllowed ? 1 : 0.45 }}
              title={item.label}
            >
              {renderNavIcon(Icon, item.id)}
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
            const isAllowed = isTabAllowedByPlan(item.id);
            return (
              <div
                key={item.id}
                data-tour={`sidebar-${item.id}`}
                className={`drawer-item ${isActive ? 'active' : ''}`}
                style={{ opacity: isAllowed ? 1 : 0.45 }}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsDrawerOpen(false);
                }}
              >
                <div className="drawer-item-icon">
                  {renderNavIcon(Icon, item.id)}
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
