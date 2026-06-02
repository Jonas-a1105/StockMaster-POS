import { useState, useEffect, useRef, useCallback } from 'react';
import { syncWorker, type SyncState } from '../db/sync';
import { getDatabase } from '../db/database';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from './ToastNotification';
import VentasPOS from './VentasPOS';
import Inventario from './Inventario';
import Nomina from './Nomina';
import Analiticas from './Analiticas';
import Auditoria from './Auditoria';
import Clientes from './Clientes';
import Proveedores from './Proveedores';
import Compras from './Compras';
import CierreCaja from './CierreCaja';
import BusinessSettings from './BusinessSettings';
import Sidebar from './Sidebar';
import Header from './Header';
import ThemeCustomizer from './ThemeCustomizer';
import RateCalculatorModal from './RateCalculatorModal';
import KeyboardShortcuts from './KeyboardShortcuts';

// New high-fidelity visual sub-components
import OverviewCards from './OverviewCards';
import SalesChartCard from './SalesChartCard';
import CalendarCard from './CalendarCard';
import WeeklySalesCard from './WeeklySalesCard';
import CustomerDetailsCard from './CustomerDetailsCard';
import RightSidebar from './RightSidebar';

interface DashboardProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    offline: boolean;
  };
  onLogoutSuccess: () => void;
}

export default function Dashboard({ user, onLogoutSuccess }: DashboardProps) {
  const { settings, updateTheme } = useTheme();
  const { addToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [onlineStatus, setOnlineStatus] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'inventario' | 'compras' | 'nomina' | 'clientes' | 'proveedores' | 'analiticas' | 'auditoria' | 'cierre' | 'settings'>('dashboard');
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const prevSyncRef = useRef<SyncState | null>(null);

  // isDarkMode derived from ThemeContext
  const isDarkMode = settings.mode === 'dark';
  const setIsDarkMode = (dark: boolean) => updateTheme({ mode: dark ? 'dark' : 'light' });

  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncedAt: '1970-01-01T00:00:00.000Z',
    error: null,
    pendingSalesCount: 0
  });



  const [totalRevenue, setTotalRevenue] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<Array<{ id: string; name: string; stock: number; minStock: number }>>([]);

  useEffect(() => {
    let salesSub: any;
    let productsSub: any;

    const setupSubscriptions = async () => {
      try {
        const db = await getDatabase();

        // Reactive subscription to sales to calculate revenue and sales count
        salesSub = db.sales.find().$.subscribe((salesDocs) => {
          const sales = salesDocs.map(doc => doc.toJSON());
          const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
          setTotalRevenue(revenue);
          setSalesCount(sales.length);
        });

        // Reactive subscription to products to calculate total catalog products and low stock alerts
        productsSub = db.products.find().$.subscribe((productsDocs) => {
          setProductsCount(productsDocs.length);
          const lowStock = productsDocs
            .map(doc => doc.toJSON())
            .filter(p => p.stock <= (p.minStock || 5))
            .map(p => ({
              id: p.id,
              name: p.name,
              stock: p.stock,
              minStock: p.minStock || 5
            }));
          setLowStockProducts(lowStock);
        });
      } catch (err) {
        console.error('Error loading reactive dashboard data:', err);
      }
    };

    setupSubscriptions();

    return () => {
      salesSub?.unsubscribe();
      productsSub?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setOnlineStatus(true);
      addToast({ type: 'success', title: 'Conexión restaurada', message: 'Sincronizando datos con el servidor central...' });
      syncWorker.sync();
    };
    const handleOffline = () => {
      setOnlineStatus(false);
      addToast({ type: 'warning', title: 'Modo Offline', message: 'Los datos se guardarán localmente y se sincronizarán al reconectar.' });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to reactive RxDB Sync Worker
    const unsubscribe = syncWorker.subscribe((state) => {
      // Toast on sync completion or error
      const prev = prevSyncRef.current;
      if (prev?.isSyncing && !state.isSyncing) {
        if (state.error) {
          addToast({ type: 'error', title: 'Error de sincronización', message: state.error });
        } else {
          addToast({ type: 'success', title: 'Sincronización completada', message: 'Base de datos actualizada correctamente.' });
        }
      }
      prevSyncRef.current = state;
      setSyncState(state);
    });

    // Initial sync
    if (navigator.onLine) {
      syncWorker.sync();
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [addToast]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const headerLabels = {
    dashboard: 'Tablero',
    pos: 'Caja Registradora',
    inventario: 'Catalogo de Inventario',
    compras: 'Compras y Reposición OCR',
    nomina: 'Nómina fiscal',
    clientes: 'Gestión de Clientes',
    proveedores: 'Directorio de Proveedores',
    analiticas: 'Reportes y Analíticas',
    auditoria: 'Auditoría y Bitácora',
    cierre: 'Arqueo de Caja',
    settings: 'Configuración Fiscal'
  };

  return (
    <div className="app-container animate-entrance">
      {/* Left Collapsible Navigation Sidebar (Dashboard Clone Style) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
        user={user}
        onlineStatus={onlineStatus}
      />
      
      {/* Scrollable Dashboard Body (Dashboard Clone Style) */}
      <main className="main-content" style={{ overflowY: 'auto' }}>
        
        {/* top Header (Dashboard Clone Style) */}
        <Header 
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm} 
          isDarkMode={isDarkMode} 
          setIsDarkMode={setIsDarkMode} 
          user={user}
          onlineStatus={onlineStatus}
          syncState={syncState}
          onSync={() => syncWorker.sync()}
          onLogout={handleLogout}
          activeTabLabel={headerLabels[activeTab]}
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
          onOpenCalculator={() => setIsCalculatorOpen(true)}
          onSelectResult={(tab, id, name) => {
            setActiveTab(tab);
            setSearchTerm(name);
          }}
        />

        {/* Sync Failure Warning Alert */}
        {syncState.error && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            padding: '12px 20px',
            borderRadius: '16px',
            fontSize: '13px',
            marginTop: '20px',
            fontWeight: 600,
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>⚠️ Error de Sincronización: {syncState.error}</span>
            <button 
              onClick={() => syncWorker.sync()} 
              className="btn-pill-dark" 
              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '8px', border: '1px solid #ef4444' }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* D1: Breadcrumbs / Current Section Indicator */}
        {activeTab !== 'dashboard' && (
          <div className="animate-entrance" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            marginTop: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-main)'
          }}>
            <span 
              style={{ cursor: 'pointer', color: 'var(--brand-primary)', fontWeight: 700 }}
              onClick={() => setActiveTab('dashboard')}
            >
              🏠 Inicio
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>›</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
              {headerLabels[activeTab]}
            </span>
          </div>
        )}

        {/* Render modular panels inside the Dashboard grid */}
        <div style={{ padding: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {activeTab === 'pos' ? (
            <VentasPOS user={user} searchTerm={searchTerm} />
          ) : activeTab === 'inventario' ? (
            <Inventario searchTerm={searchTerm} />
          ) : activeTab === 'compras' ? (
            <Compras user={user} searchTerm={searchTerm} />
          ) : activeTab === 'nomina' ? (
            <Nomina user={user} searchTerm={searchTerm} />
          ) : activeTab === 'clientes' ? (
            <Clientes user={user} searchTerm={searchTerm} />
          ) : activeTab === 'proveedores' ? (
            <Proveedores user={user} searchTerm={searchTerm} />
          ) : activeTab === 'analiticas' ? (
            <Analiticas user={user} />
          ) : activeTab === 'auditoria' ? (
            <Auditoria user={user} />
          ) : activeTab === 'cierre' ? (
            <CierreCaja user={user} />
          ) : activeTab === 'settings' ? (
            <BusinessSettings user={user} />
          ) : (
            /* VISTA PRINCIPAL: RESUMEN DEL DASHBOARD (Dashboard Clone Style - 100% Identical to image) */
            <div className="dashboard-grid animate-entrance">
              
              {/* Main Left Widgets Section */}
              <div className="left-panel">
                
                {/* Spanish Page Title aligned with dashboard-clone */}
                <h1 className="welcome-section">
                  Hola, {user.name.split(' ')[0]}
                </h1>

                {/* B2: Alertas de Inventario Bajo */}
                <div className="widget" style={{
                  padding: '20px',
                  borderRadius: 'var(--card-radius)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1.5px solid var(--border-color)',
                  boxShadow: 'var(--widget-shadow)',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <AlertTriangle size={18} style={{ color: '#f59e0b' }} />
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      ⚠️ Alertas de Inventario Bajo
                    </h3>
                  </div>

                  {lowStockProducts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                      {lowStockProducts.map(p => (
                        <div key={p.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.15)'
                        }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stock Mín: {p.minStock}</span>
                            <span style={{
                              fontWeight: 800,
                              fontSize: '12px',
                              backgroundColor: p.stock === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: p.stock === 0 ? '#ef4444' : '#f59e0b',
                              padding: '2px 8px',
                              borderRadius: '50px'
                            }}>
                              {p.stock} unidades
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontSize: '12.5px',
                      fontWeight: 600
                    }}>
                      <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                      <span>Todos los productos con stock suficiente</span>
                    </div>
                  )}
                </div>

                {/* Notched connected overview widgets */}
                <OverviewCards totalRevenue={totalRevenue} salesCount={salesCount} productsCount={productsCount} />
                
                {/* Sales Line Graph and Calendar row */}
                <div className="middle-row">
                  <SalesChartCard isDarkMode={isDarkMode} />
                  <CalendarCard />
                </div>
                
                {/* Cylindrical capsules and Customer Invoices table row */}
                <div className="bottom-row">
                  <WeeklySalesCard />
                  <CustomerDetailsCard searchTerm={searchTerm} />
                </div>
                
              </div>

              {/* Narrow Right Statistics Column */}
              <RightSidebar isDarkMode={isDarkMode} />

            </div>
          )}
        </div>

      </main>

      {/* Theme Customizer Panel */}
      <ThemeCustomizer />

      {/* Tasa exchange rate calculator modal */}
      <RateCalculatorModal 
        isOpen={isCalculatorOpen} 
        onClose={() => setIsCalculatorOpen(false)} 
      />

      {/* Keyboard Shortcuts Handler */}
      <KeyboardShortcuts
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCalculator={() => setIsCalculatorOpen(true)}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onFocusSearch={() => {
          const searchInput = document.querySelector('.search-input') as HTMLInputElement;
          if (searchInput) searchInput.focus();
        }}
      />
      {/* MODAL: CONFIRMACIÓN DE LOGOUT (GLASSMORPHISM) */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          
          <div className="widget" style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid rgba(239, 68, 68, 0.2)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '14px', borderRadius: '50%', color: '#ef4444' }}>
                <AlertTriangle size={32} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                  ¿Cerrar sesión?
                </h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  ¿Está seguro de que desea salir del sistema POS StockMasterPro? Cualquier transacción activa no guardada podría perderse.
                </p>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px', backgroundColor: 'var(--bg-input)' }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="btn-pill-dark"
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--button-radius)', justifyContent: 'center', cursor: 'pointer', border: 'none' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => onLogoutSuccess()}
                className="btn-yellow"
                style={{ flex: 1, padding: '10px 0', borderRadius: 'var(--button-radius)', backgroundColor: '#ef4444', color: '#fff', justifyContent: 'center', cursor: 'pointer', border: 'none' }}
              >
                Confirmar Salida
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
