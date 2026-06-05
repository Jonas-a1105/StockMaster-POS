import { useState, useEffect } from 'react';
import { Search, Sun, Moon, RefreshCw, LogOut, Wifi, WifiOff, Menu, ArrowUpCircle } from 'lucide-react';
import avatarImg from '../assets/avatar.png';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { getDatabase } from '../db/database';

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean) => void;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    offline: boolean;
  };
  onlineStatus: boolean;
  syncState: {
    isSyncing: boolean;
    lastSyncedAt: string;
    pendingSalesCount: number;
  };
  onSync: () => void;
  onLogout: () => void;
  activeTabLabel: string;
  sidebarExpanded?: boolean;
  setSidebarExpanded?: (expanded: boolean) => void;
  onOpenCalculator: () => void;
  onSelectResult?: (tab: 'inventario' | 'clientes' | 'proveedores' | 'nomina', id: string, name: string) => void;
  updateStatus: 'IDLE' | 'CHECKING' | 'UPDATE_AVAILABLE' | 'DOWNLOADING' | 'DOWNLOADED';
  onOpenUpdater: () => void;
}

const escapeRegex = (string: string) => {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
};

export default function Header({
  searchTerm,
  setSearchTerm,
  isDarkMode,
  setIsDarkMode,
  user,
  onlineStatus,
  syncState,
  onSync,
  onLogout,
  activeTabLabel,
  sidebarExpanded,
  setSidebarExpanded,
  onOpenCalculator,
  onSelectResult,
  updateStatus,
  onOpenUpdater
}: HeaderProps) {
  const { dolarRate, isManual } = useExchangeRate();
  const [localInput, setLocalInput] = useState('');
  const [results, setResults] = useState<Array<{ type: string; id: string; name: string; details: string; tab: 'inventario' | 'clientes' | 'proveedores' | 'nomina' }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Sync local input with global search term if global is cleared or changes
  useEffect(() => {
    setLocalInput(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    if (!localInput.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const performSearch = async () => {
      try {
        const db = await getDatabase();
        const escapedInput = escapeRegex(localInput);
        const searchRegex = new RegExp(escapedInput, 'i');
        
        // 1. Search products
        const products = await db.products.find({
          selector: {
            name: { $regex: searchRegex as any }
          }
        }).exec();
        const productResults = products.slice(0, 3).map(p => ({
          type: 'producto',
          id: p.id,
          name: p.name,
          details: `Precio: $${p.price} | Stock: ${p.stock}`,
          tab: 'inventario' as const
        }));

        // 2. Search clients
        const clients = await db.clients.find({
          selector: {
            name: { $regex: searchRegex as any }
          }
        }).exec();
        const clientResults = clients.slice(0, 3).map(c => ({
          type: 'cliente',
          id: c.id,
          name: c.name,
          details: `RIF/Cédula: ${c.id}`,
          tab: 'clientes' as const
        }));

        // 3. Search suppliers
        const suppliersSaved = localStorage.getItem('stockmaster_suppliers_local');
        const suppliersList = suppliersSaved ? JSON.parse(suppliersSaved) : [];
        const supplierResults = suppliersList
          .filter((s: any) => s.companyName.toLowerCase().includes(localInput.toLowerCase()) || s.rif.toLowerCase().includes(localInput.toLowerCase()))
          .slice(0, 3)
          .map((s: any) => ({
            type: 'proveedor',
            id: s.id,
            name: s.companyName,
            details: `RIF: ${s.rif} | Rubro: ${s.category}`,
            tab: 'proveedores' as const
          }));

        // 4. Search payroll (nomina)
        const payrollSaved = localStorage.getItem('stockmaster_payroll_records');
        const payrollList = payrollSaved ? JSON.parse(payrollSaved) : [];
        const payrollResults = payrollList
          .filter((p: any) => (p.employeeName || '').toLowerCase().includes(localInput.toLowerCase()))
          .slice(0, 3)
          .map((p: any) => ({
            type: 'nomina',
            id: p.id,
            name: `Nómina - ${p.employeeName}`,
            details: `Fecha: ${new Date(p.paymentDate).toLocaleDateString('es-ES')} | Total: $${p.totalPaid}`,
            tab: 'nomina' as const
          }));

        setResults([...productResults, ...clientResults, ...supplierResults, ...payrollResults]);
        setShowDropdown(true);
      } catch (err) {
        console.error('Error querying search autocomplete:', err);
      }
    };

    const timer = setTimeout(performSearch, 150);
    return () => clearTimeout(timer);
  }, [localInput]);

  const handleResultClick = (res: { type: string; id: string; name: string; tab: 'inventario' | 'clientes' | 'proveedores' | 'nomina' }) => {
    if (onSelectResult) {
      onSelectResult(res.tab, res.id, res.name);
    } else {
      setSearchTerm(res.name);
    }
    setShowDropdown(false);
  };

  return (
    <header className="dashboard-header">
      {/* Overlay sidebar hamburger trigger (only visible in overlay mode via CSS) */}
      <button
        className="sidebar-overlay-trigger"
        onClick={() => setSidebarExpanded?.(!sidebarExpanded)}
        title="Abrir menú"
      >
        <Menu size={18} />
      </button>

      {/* Search container */}
      <div className="search-container" style={{ position: 'relative' }}>
        <Search className="search-icon" size={16} />
        <input 
          type="text" 
          placeholder="Buscar producto, ticket o nómina..." 
          className="search-input" 
          value={localInput}
          onChange={(e) => {
            setLocalInput(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        />

        {showDropdown && results.length > 0 && (
          <div 
            className="premium-popup"
            style={{
              position: 'absolute',
              top: '48px',
              left: 0,
              right: 0,
              maxHeight: '300px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              animation: 'entrance 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {results.map((res, index) => (
              <div
                key={`${res.type}-${res.id}-${index}`}
                onClick={() => handleResultClick(res)}
                style={{
                  padding: '10px 16px',
                  borderBottom: index === results.length - 1 ? 'none' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                className="autocomplete-item-row"
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>{res.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{res.details}</span>
                </div>
                <span style={{
                  fontSize: '9px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '50px',
                  backgroundColor: res.type === 'producto' ? 'rgba(14,165,164,0.1)' : res.type === 'cliente' ? 'rgba(59,130,246,0.1)' : res.type === 'proveedor' ? 'rgba(168,85,247,0.1)' : 'rgba(245,158,11,0.1)',
                  color: res.type === 'producto' ? 'var(--brand-teal)' : res.type === 'cliente' ? '#3b82f6' : res.type === 'proveedor' ? '#a855f7' : '#f59e0b'
                }}>
                  {res.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Script Page Title */}
      <div className="script-title animate-entrance">
        {activeTabLabel}
      </div>
      
      {/* Right controls */}
      <div className="header-right">
        
        {/* Tasa Oficial BCV */}
        <div 
          className="rate-badge animate-entrance"
          onClick={onOpenCalculator}
          style={isManual ? {
            borderColor: 'rgba(168, 85, 247, 0.35)',
            backgroundColor: 'rgba(168, 85, 247, 0.06)',
            color: '#a855f7'
          } : undefined}
          title={isManual ? "Tasa establecida manualmente. ¡Haz clic para abrir la calculadora/ajustar!" : "Tasa oficial BCV en tiempo real. ¡Haz clic para abrir la calculadora/ajustar!"}
        >
          <span style={{ fontSize: '12px' }}>🪙</span>
          <span><span className="hide-mobile">Tasa {isManual ? 'Manual' : 'BCV'}: </span><strong>Bs. {dolarRate.toFixed(2)}</strong></span>
        </div>

        {/* Network & Offline Status Indicator */}
        <div 
          className="theme-toggle-btn network-status-badge-header"
          style={{
            width: 'auto',
            padding: '0 10px',
            fontSize: '11px',
            fontWeight: 800,
            borderRadius: '12px',
            border: `1px solid ${onlineStatus ? 'rgba(14, 165, 164, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            backgroundColor: onlineStatus ? 'rgba(14, 165, 164, 0.05)' : 'rgba(239, 68, 68, 0.05)',
            color: onlineStatus ? 'var(--brand-primary, var(--brand-teal))' : '#ef4444',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: '40px'
          }}
          title={onlineStatus ? 'Conectado al Servidor Central' : 'Modo Offline Autónomo'}
        >
          {onlineStatus ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span className="hide-mobile" style={{ display: 'inline' }}>{onlineStatus ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        {/* Sync Manual Button */}
        {onlineStatus && (
          <button 
            className="theme-toggle-btn"
            onClick={onSync}
            disabled={syncState.isSyncing}
            title={syncState.isSyncing ? 'Sincronizando base de datos...' : 'Sincronizar base de datos'}
          >
            <RefreshCw size={16} className={syncState.isSyncing ? 'animate-spin' : ''} />
          </button>
        )}

        {/* Software Update Notification Indicator */}
        {(updateStatus === 'UPDATE_AVAILABLE' || updateStatus === 'DOWNLOADED') && (
          <button 
            className="theme-toggle-btn header-update-pulse-btn"
            onClick={onOpenUpdater}
            style={{
              position: 'relative',
              backgroundColor: updateStatus === 'DOWNLOADED' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(251, 191, 36, 0.1)',
              borderColor: updateStatus === 'DOWNLOADED' ? '#22c55e' : 'var(--brand-gold)',
              color: updateStatus === 'DOWNLOADED' ? '#22c55e' : 'var(--brand-gold)',
            }}
            title={updateStatus === 'DOWNLOADED' ? "¡Descarga de actualización completa! Haz clic para reiniciar y aplicar." : "¡Nueva actualización del sistema disponible! Haz clic para ver detalles."}
          >
            <ArrowUpCircle size={18} />
            {/* Pulsing Dot */}
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: updateStatus === 'DOWNLOADED' ? '#22c55e' : '#ef4444',
              boxShadow: updateStatus === 'DOWNLOADED' ? '0 0 8px #22c55e' : '0 0 8px #ef4444'
            }} />
          </button>
        )}

        {/* Theme Switcher Sun/Moon */}
        <button 
          className="theme-toggle-btn" 
          onClick={() => setIsDarkMode(!isDarkMode)}
          title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        
        {/* User profile dropdown box */}
        <div className="user-profile" style={{ position: 'relative' }}>
          <div className="user-meta" style={{ marginRight: '8px' }}>
            <span className="user-name">{user.name}</span>
            <span className="user-email" style={{ color: 'var(--brand-primary, var(--brand-teal))', fontWeight: 800, fontSize: '10px' }}>
              {user.role} {user.offline ? '(LOCAL)' : '(CENTRAL)'}
            </span>
          </div>
          <div className="avatar-container" title={`${user.name} - ${user.role}`}>
            <img src={avatarImg} alt={user.name} className="avatar-img" />
          </div>

          {/* Quick Logout Button */}
          <button 
            onClick={onLogout} 
            className="theme-toggle-btn" 
            style={{ 
              marginLeft: '8px', 
              border: 'none', 
              backgroundColor: 'transparent',
              color: 'var(--text-muted)'
            }}
            title="Cerrar Sesión"
          >
            <LogOut size={16} style={{ color: '#ef4444' }} />
          </button>
        </div>

      </div>
    </header>
  );
}
