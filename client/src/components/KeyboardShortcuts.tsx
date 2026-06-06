import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onOpenCalculator: () => void;
  onToggleTheme: () => void;
  onFocusSearch: () => void;
  role: string;
  isOpen?: boolean;
  onClose?: () => void;
}

interface Shortcut {
  key: string;
  label: string;
  description: string;
  action: () => void;
  scope?: 'global' | 'pos';
}

export default function KeyboardShortcuts({
  activeTab,
  setActiveTab,
  onOpenCalculator,
  onToggleTheme,
  onFocusSearch,
  role,
  isOpen,
  onClose,
}: KeyboardShortcutsProps) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isOpen !== undefined) {
      setShowHelp(isOpen);
    }
  }, [isOpen]);

  const handleClose = () => {
    setShowHelp(false);
    if (onClose) onClose();
  };


  const ALLOWED_TABS: Record<string, string[]> = {
    ADMIN: ['dashboard', 'pos', 'inventario', 'compras', 'nomina', 'clientes', 'proveedores', 'cierre', 'analiticas', 'auditoria', 'settings', 'users'],
    AUDITOR: ['dashboard', 'inventario', 'clientes', 'proveedores', 'analiticas', 'auditoria'],
    CASHIER: ['pos', 'cierre']
  };

  const allowed = ALLOWED_TABS[role] || [];

  // Define shortcuts
  const shortcuts: Shortcut[] = [
    { key: 'F1', label: 'F1', description: 'Buscar producto (foco en barra de búsqueda)', action: onFocusSearch, scope: 'global' },
    { key: 'F2', label: 'F2', description: 'Abrir Calculadora de Tasa / Multidivisa', action: onOpenCalculator, scope: 'global' },
    ...(allowed.includes('pos') ? [{ key: 'F3', label: 'F3', description: 'Cambiar a Ventas POS', action: () => setActiveTab('pos'), scope: 'global' as const }] : []),
    ...(allowed.includes('inventario') ? [{ key: 'F4', label: 'F4', description: 'Cambiar a Inventario', action: () => setActiveTab('inventario'), scope: 'global' as const }] : []),
    ...(allowed.includes('dashboard') ? [{ key: 'F5', label: 'F5', description: 'Cambiar a Resumen / Dashboard', action: () => setActiveTab('dashboard'), scope: 'global' as const }] : []),
    { key: 'F8', label: 'F8', description: 'Alternar tema claro / oscuro', action: onToggleTheme, scope: 'global' },
    { key: '?', label: 'Shift + ?', description: 'Mostrar / ocultar este panel de ayuda', action: () => setShowHelp(prev => !prev), scope: 'global' },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts when user is typing in inputs
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Always allow F-keys even when typing
      if (e.key.startsWith('F') && !e.ctrlKey && !e.altKey) {
        const fKey = e.key;
        const shortcut = shortcuts.find(s => s.key === fKey);
        if (shortcut) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }

      // Only process non-F-key shortcuts when not typing
      if (isInputFocused) return;

      // Escape closes help
      if (e.key === 'Escape' && showHelp) {
        handleClose();
        return;
      }

      // ? key for help
      if (e.key === '?' && e.shiftKey) {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, showHelp, shortcuts]);

  if (!showHelp) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(6px)',
          zIndex: 1799,
        }}
        onClick={handleClose}
      />

      {/* Shortcuts Panel */}
      <div className="shortcuts-panel">
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Keyboard size={18} style={{ color: 'var(--brand-primary)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Atajos de Teclado
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="theme-toggle-btn"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          {/* Global Shortcuts */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Navegación Global
            </span>
          </div>
          <div className="shortcuts-grid" style={{ marginBottom: '20px' }}>
            {shortcuts.filter(s => s.scope === 'global').map((s) => (
              <div key={s.key} style={{ display: 'contents' }}>
                <span className="shortcut-key">{s.label}</span>
                <span className="shortcut-desc">{s.description}</span>
              </div>
            ))}
          </div>

          {/* POS Shortcuts */}
          <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Atajos de Caja (POS)
            </span>
          </div>
          <div className="shortcuts-grid">
            <span className="shortcut-key">Enter</span>
            <span className="shortcut-desc">Agregar producto seleccionado al carrito</span>
            <span className="shortcut-key">Esc</span>
            <span className="shortcut-desc">Cerrar modal activo o cancelar acción</span>
            <span className="shortcut-key">+  /  −</span>
            <span className="shortcut-desc">Aumentar / disminuir cantidad en carrito</span>
          </div>

          {/* Footer hint */}
          <div style={{
            marginTop: '20px',
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: 'rgba(14, 165, 164, 0.05)',
            border: '1px solid rgba(14, 165, 164, 0.15)',
            fontSize: '10.5px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            💡 Presiona <span className="shortcut-key" style={{ margin: '0 4px', padding: '2px 6px', fontSize: '10px' }}>Shift + ?</span> en cualquier momento para ver este panel
          </div>
        </div>
      </div>
    </>
  );
}
