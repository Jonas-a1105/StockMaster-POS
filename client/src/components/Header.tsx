import { useState, useEffect, useRef } from 'react';
import { Search, Sun, Moon, RefreshCw, LogOut, Wifi, WifiOff, Menu, ArrowUpCircle, Mail, CheckCircle, DollarSign } from 'lucide-react';
import avatarImg from '../assets/avatar.png';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { getDatabase } from '../db/database';
import { API_URL } from '../config';
import { createPortal } from 'react-dom';

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
  const { dolarRate, isManual, isStale } = useExchangeRate();
  const [localInput, setLocalInput] = useState('');
  const [results, setResults] = useState<Array<{ type: string; id: string; name: string; details: string; tab: 'inventario' | 'clientes' | 'proveedores' | 'nomina' }>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close search modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileSearchOpen(false);
      }
    };
    if (isMobileSearchOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileSearchOpen]);

  const handleSendVerification = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/auth/send-verification`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setVerifyMsg(data.message || 'Enviado');
      setTimeout(() => setVerifyMsg(''), 5000);
    } catch { setVerifyMsg('Error al enviar'); setTimeout(() => setVerifyMsg(''), 3000); }
  };

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
        
        // 1. Search products
        const products = await db.products.find({
          selector: {
            name: { $regex: escapedInput, $options: 'i' }
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
            name: { $regex: escapedInput, $options: 'i' }
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
        aria-label="Abrir menú de navegación"
      >
        <Menu size={18} />
      </button>

      {/* Search container */}
      <div className="search-container desktop-search-container" style={{ position: 'relative' }}>
        <Search className="search-icon" size={16} />
        <input 
          ref={inputRef}
          type="text" 
          placeholder="Buscar producto, ticket o nómina..." 
          className="search-input" 
          value={localInput}
          onChange={(e) => {
            setLocalInput(e.target.value);
            setActiveIndex(-1);
            setShowDropdown(true);
          }}
          onFocus={() => { setShowDropdown(true); setActiveIndex(-1); }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onKeyDown={(e) => {
            if (!showDropdown || results.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
            } else if (e.key === 'Enter' && activeIndex >= 0) {
              e.preventDefault();
              handleResultClick(results[activeIndex]);
            } else if (e.key === 'Escape') {
              setShowDropdown(false);
            }
          }}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-label="Búsqueda global"
        />

        {showDropdown && (
          <div 
            ref={dropdownRef}
            className="premium-popup"
            role="listbox"
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
            {results.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Sin resultados para <strong>"{localInput}"</strong>
              </div>
            ) : (
              results.map((res, index) => (
                <div
                  key={`${res.type}-${res.id}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => handleResultClick(res)}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    padding: '10px 16px',
                    borderBottom: index === results.length - 1 ? 'none' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: index === activeIndex ? 'var(--bg-input)' : 'transparent'
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
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Script Page Title */}
      <div className="script-title animate-entrance">
        {activeTabLabel}
      </div>
      
      {/* Right controls */}
      <div className="header-right">
        
        {/* Mobile Search Icon Trigger */}
        <button 
          className="theme-toggle-btn mobile-search-trigger animate-entrance"
          onClick={() => setIsMobileSearchOpen(true)}
          title="Buscar..."
          aria-label="Abrir búsqueda global"
        >
          <Search size={16} />
        </button>

        {/* Tasa Oficial BCV */}
        <div 
          className="rate-badge animate-entrance"
          onClick={onOpenCalculator}
          style={{
            ...(isManual ? {
              borderColor: 'rgba(168, 85, 247, 0.35)',
              backgroundColor: 'rgba(168, 85, 247, 0.06)',
              color: '#a855f7'
            } : {}),
            position: 'relative'
          }}
          title={isManual ? "Tasa establecida manualmente. ¡Haz clic para abrir la calculadora/ajustar!" : "Tasa oficial BCV en tiempo real. ¡Haz clic para abrir la calculadora/ajustar!"}
          role="button"
          aria-label="Tipo de cambio"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenCalculator(); } }}
        >
          <DollarSign size={14} />
          <span><span className="hide-mobile">Tasa {isManual ? 'Manual' : 'BCV'}: </span><strong>Bs. {dolarRate.toFixed(2)}</strong></span>
          {isStale && !isManual && (
            <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
          )}
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
            aria-label={syncState.isSyncing ? 'Sincronizando...' : 'Sincronizar datos'}
          >
            <RefreshCw size={16} className={syncState.isSyncing ? 'animate-spin' : ''} />
          </button>
        )}

        {/* Sync status indicator */}
        {syncState.isSyncing && (
          <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--brand-primary)', whiteSpace: 'nowrap' }}>
            Sincronizando...
          </span>
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
            aria-label={updateStatus === 'DOWNLOADED' ? 'Actualización lista para instalar' : 'Actualización disponible'}
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
          aria-label={isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
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

          {/* Email verification button */}
          <button 
            onClick={handleSendVerification}
            className="theme-toggle-btn" 
            title="Verificar correo electrónico"
            aria-label="Verificar correo electrónico"
            style={{ marginLeft: '4px', border: 'none', backgroundColor: 'transparent', color: 'var(--brand-primary)', position: 'relative' }}
          >
            {verifyMsg ? <CheckCircle size={14} /> : <Mail size={14} />}
            {verifyMsg && <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', fontSize: '8px', whiteSpace: 'nowrap', color: 'var(--brand-gold)', fontWeight: 700 }}>{verifyMsg}</span>}
          </button>

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
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} style={{ color: '#ef4444' }} />
          </button>
        </div>

      </div>

      {isMobileSearchOpen && createPortal(
        <div 
          className="mobile-search-overlay"
          onClick={() => setIsMobileSearchOpen(false)}
        >
          <div className="mobile-search-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-search-header">
              <div className="mobile-search-input-wrapper">
                <Search className="mobile-search-icon" size={18} />
                <input
                  type="text"
                  placeholder="Buscar producto, cliente o nómina..."
                  className="mobile-search-input"
                  value={localInput}
                  onChange={(e) => setLocalInput(e.target.value)}
                  autoFocus
                />
              </div>
              <button 
                onClick={() => setIsMobileSearchOpen(false)}
                className="mobile-search-close-btn"
              >
                Cerrar
              </button>
            </div>
            
            <div className="mobile-search-results">
              {localInput.trim() === '' ? (
                <div className="mobile-search-empty-state">
                  Escribe algo para buscar en el sistema...
                </div>
              ) : results.length === 0 ? (
                <div className="mobile-search-empty-state">
                  Sin resultados para <strong>"{localInput}"</strong>
                </div>
              ) : (
                results.map((res, index) => (
                  <div
                    key={`${res.type}-${res.id}-${index}`}
                    onClick={() => {
                      handleResultClick(res);
                      setIsMobileSearchOpen(false);
                    }}
                    className="mobile-search-result-row"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                      <span className="result-name">{res.name}</span>
                      <span className="result-details">{res.details}</span>
                    </div>
                    <span className={`result-badge badge-${res.type}`}>
                      {res.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
