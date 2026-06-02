import { useState } from 'react';
import { 
  Settings, X, RotateCcw, Monitor, Sun, Moon, Type, Layout, 
  PanelLeft, Palette, PaintBucket, Sliders, Check,
  FolderOpen, Layers, ToggleLeft
} from 'lucide-react';
import {
  useTheme,
  PRIMARY_COLORS,
  ACCENT_COLORS,
  FONT_OPTIONS,
  type SidebarStyle,
  type HeaderPosition,
  type ContentLayout,
  type CardStyle,
  type ButtonStyle,
  type InputStyle,
  type ListStyle,
  type AccordionStyle,
  type UiDensity,
  type AnimationStyle,
} from '../contexts/ThemeContext';

/* ── Mini preview SVGs para estilos de sidebar ─── */
const SidebarPreview = ({ style, active }: { style: SidebarStyle; active: boolean }) => {
  const widths: Record<SidebarStyle, number> = { mini: 6, compact: 10, expanded: 18, overlay: 10 };
  const w = widths[style];
  return (
    <div className={`customizer-sidebar-preview ${active ? 'active' : ''}`}>
      <svg viewBox="0 0 44 32" width="44" height="32">
        <rect x="0" y="0" width="44" height="32" rx="3" fill="var(--bg-input)" />
        <rect x="0" y="0" width={w} height="32" rx="2" fill={active ? 'var(--brand-primary, #0ea5a4)' : 'var(--text-muted)'} opacity={active ? 1 : 0.4} />
        {style === 'overlay' && <rect x="0" y="0" width={w} height="32" rx="2" fill={active ? 'var(--brand-primary, #0ea5a4)' : 'var(--text-muted)'} opacity={0.25} />}
        <rect x={w + 2} y="2" width={42 - w - 2} height="4" rx="1" fill="var(--text-muted)" opacity="0.3" />
        <rect x={w + 2} y="9" width={42 - w - 8} height="3" rx="1" fill="var(--text-muted)" opacity="0.15" />
        <rect x={w + 2} y="15" width={42 - w - 4} height="3" rx="1" fill="var(--text-muted)" opacity="0.15" />
      </svg>
      <span className="customizer-preview-label">{style.charAt(0).toUpperCase() + style.slice(1)}</span>
    </div>
  );
};

/* ── Header Position Preview ─── */
const HeaderPreview = ({ position, active }: { position: HeaderPosition; active: boolean }) => (
  <div className={`customizer-sidebar-preview ${active ? 'active' : ''}`}>
    <svg viewBox="0 0 44 32" width="44" height="32">
      <rect x="0" y="0" width="44" height="32" rx="3" fill="var(--bg-input)" />
      <rect x="0" y="0" width="8" height="32" rx="2" fill="var(--text-muted)" opacity="0.25" />
      <rect x="9" y="1" width="34" height="5" rx="1.5" fill={active ? 'var(--brand-primary, #0ea5a4)' : 'var(--text-muted)'} opacity={active ? 0.9 : 0.35} />
      {position === 'fixed' && <line x1="9" y1="7" x2="43" y2="7" stroke={active ? 'var(--brand-primary, #0ea5a4)' : 'var(--text-muted)'} strokeWidth="0.5" opacity="0.6" />}
      <rect x="10" y="9" width="18" height="3" rx="1" fill="var(--text-muted)" opacity="0.15" />
      <rect x="10" y="14" width="14" height="3" rx="1" fill="var(--text-muted)" opacity="0.15" />
    </svg>
    <span className="customizer-preview-label">{position === 'fixed' ? 'Fijo' : 'Estático'}</span>
  </div>
);

/* ── Layout Preview ─── */
const LayoutPreview = ({ layout, active }: { layout: ContentLayout; active: boolean }) => (
  <div className={`customizer-sidebar-preview ${active ? 'active' : ''}`}>
    <svg viewBox="0 0 44 32" width="44" height="32">
      <rect x="0" y="0" width="44" height="32" rx="3" fill="var(--bg-input)" />
      {layout === 'boxed' ? (
        <>
          <rect x="6" y="2" width="32" height="28" rx="2" fill={active ? 'var(--brand-primary, #0ea5a4)' : 'var(--text-muted)'} opacity={active ? 0.15 : 0.1} stroke={active ? 'var(--brand-primary, #0ea5a4)' : 'var(--text-muted)'} strokeWidth="0.5" />
          <rect x="8" y="4" width="28" height="3" rx="1" fill="var(--text-muted)" opacity="0.25" />
          <rect x="8" y="9" width="20" height="2" rx="1" fill="var(--text-muted)" opacity="0.15" />
        </>
      ) : (
        <>
          <rect x="1" y="2" width="42" height="4" rx="1" fill={active ? 'var(--brand-primary, #0ea5a4)' : 'var(--text-muted)'} opacity={active ? 0.3 : 0.15} />
          <rect x="1" y="8" width="30" height="2" rx="1" fill="var(--text-muted)" opacity="0.15" />
          <rect x="1" y="12" width="42" height="2" rx="1" fill="var(--text-muted)" opacity="0.1" />
        </>
      )}
    </svg>
    <span className="customizer-preview-label">{layout === 'full' ? 'Completo' : 'Encajado'}</span>
  </div>
);

export default function ThemeCustomizer() {
  const { settings, updateTheme, resetTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'colores' | 'estructuras' | 'detalles'>('colores');

  // Ajustes predefinidos para fondos OLED/Oscuro/Medio
  const handleBgPreset = (preset: 'default' | 'oled' | 'midnight' | 'slate') => {
    if (preset === 'default') {
      updateTheme({ customBgPrimary: '', customBgCard: '' });
    } else if (preset === 'oled') {
      updateTheme({ 
        customBgPrimary: '#000000', 
        customBgCard: '#09090b',
        mode: 'dark'
      });
    } else if (preset === 'midnight') {
      updateTheme({ 
        customBgPrimary: '#0b0f19', 
        customBgCard: '#111827',
        mode: 'dark'
      });
    } else if (preset === 'slate') {
      updateTheme({ 
        customBgPrimary: '#f1f5f9', 
        customBgCard: '#ffffff',
        mode: 'light'
      });
    }
  };

  return (
    <>
      {/* ⚙️ Floating Gear Button */}
      <button
        className="customizer-trigger animate-entrance"
        onClick={() => setIsOpen(true)}
        title="Personalizar apariencia estilo Dompet"
        style={{
          boxShadow: '0 0 16px var(--brand-primary)',
          transition: 'all 0.2s ease'
        }}
      >
        <Settings size={22} className="customizer-spin-icon" />
      </button>

      {/* Overlay */}
      {isOpen && <div className="customizer-overlay" onClick={() => setIsOpen(false)} />}

      {/* Drawer Panel */}
      <aside className={`customizer-panel ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="customizer-header">
          <div>
            <h3 className="customizer-title" style={{ fontFamily: 'var(--font-main)', fontWeight: 800 }}>Customizer Studio</h3>
            <p className="customizer-subtitle">Personalización estructural estilo Dompet</p>
          </div>
          <button className="customizer-close" onClick={() => setIsOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* 📑 Tab Navigation */}
        <nav className="customizer-tabs">
          <button 
            className={`customizer-tab-btn ${activeTab === 'colores' ? 'active' : ''}`}
            onClick={() => setActiveTab('colores')}
          >
            <Palette size={15} />
            <span>Colores</span>
          </button>
          <button 
            className={`customizer-tab-btn ${activeTab === 'estructuras' ? 'active' : ''}`}
            onClick={() => setActiveTab('estructuras')}
          >
            <Layers size={15} />
            <span>Estructura</span>
          </button>
          <button 
            className={`customizer-tab-btn ${activeTab === 'detalles' ? 'active' : ''}`}
            onClick={() => setActiveTab('detalles')}
          >
            <Sliders size={15} />
            <span>Detalles</span>
          </button>
        </nav>

        {/* Scrollable Content */}
        <div className="customizer-body">

          {/* ─────────────────────────────────────────────────────────── */}
          {/* TAB 1: COLORES & FONDOS                                      */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeTab === 'colores' && (
            <div className="customizer-tab-content animate-entrance">
              
              {/* MODO DE TEMA */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Monitor size={15} />
                  <span>Modo del Sistema</span>
                </div>
                <div className="customizer-row-toggle">
                  <button
                    className={`customizer-mode-btn ${settings.mode === 'light' ? 'active' : ''}`}
                    onClick={() => updateTheme({ mode: 'light' })}
                  >
                    <Sun size={15} />
                    <span>Claro</span>
                  </button>
                  <button
                    className={`customizer-mode-btn ${settings.mode === 'dark' ? 'active' : ''}`}
                    onClick={() => updateTheme({ mode: 'dark' })}
                  >
                    <Moon size={15} />
                    <span>Oscuro</span>
                  </button>
                </div>
              </div>

              {/* COLOR PRIMARIO */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Palette size={15} />
                  <span>Color Primario de Marca</span>
                </div>
                <div className="customizer-color-grid">
                  {PRIMARY_COLORS.map(c => (
                    <button
                      key={c.name}
                      className={`customizer-color-swatch ${settings.primaryColor === c.hex ? 'active' : ''}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                      onClick={() => updateTheme({ primaryColor: c.hex, primaryColorName: c.name })}
                    >
                      {settings.primaryColor === c.hex && <Check size={12} stroke="#fff" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
                {/* Dynamic Hex Color Picker */}
                <div className="customizer-picker-card">
                  <div className="customizer-picker-label">Color Hex Libre:</div>
                  <div className="customizer-picker-input-group">
                    <input 
                      type="color" 
                      value={settings.primaryColor}
                      onChange={(e) => updateTheme({ primaryColor: e.target.value, primaryColorName: 'Hex Libre' })}
                      className="customizer-native-color-picker"
                    />
                    <input 
                      type="text"
                      value={settings.primaryColor.toUpperCase()}
                      onChange={(e) => {
                        if (e.target.value.match(/^#[0-9A-F]{6}$/i)) {
                          updateTheme({ primaryColor: e.target.value, primaryColorName: 'Hex Libre' });
                        }
                      }}
                      className="customizer-text-hex-input"
                    />
                  </div>
                </div>
              </div>

              {/* COLOR DE ACENTO */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Palette size={15} />
                  <span>Color de Acento (KPI / Badges)</span>
                </div>
                <div className="customizer-color-grid">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.name}
                      className={`customizer-color-swatch ${settings.accentColor === c.hex ? 'active' : ''}`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                      onClick={() => updateTheme({ accentColor: c.hex, accentColorName: c.name })}
                    >
                      {settings.accentColor === c.hex && <Check size={12} stroke="#fff" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
                {/* Dynamic Accent Color Picker */}
                <div className="customizer-picker-card">
                  <div className="customizer-picker-label">Acento Hex Libre:</div>
                  <div className="customizer-picker-input-group">
                    <input 
                      type="color" 
                      value={settings.accentColor || '#fbbf24'}
                      onChange={(e) => updateTheme({ accentColor: e.target.value, accentColorName: 'Acento Libre' })}
                      className="customizer-native-color-picker"
                    />
                    <input 
                      type="text"
                      value={(settings.accentColor || '#fbbf24').toUpperCase()}
                      onChange={(e) => {
                        if (e.target.value.match(/^#[0-9A-F]{6}$/i)) {
                          updateTheme({ accentColor: e.target.value, accentColorName: 'Acento Libre' });
                        }
                      }}
                      className="customizer-text-hex-input"
                    />
                  </div>
                </div>
              </div>

              {/* FONDOS AVANZADOS */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <PaintBucket size={15} />
                  <span>Fondos Avanzados de App</span>
                </div>
                
                {/* Presets Rápidos */}
                <div className="customizer-bg-presets">
                  <button className="customizer-bg-preset-btn default" onClick={() => handleBgPreset('default')}>Predeterminado</button>
                  <button className="customizer-bg-preset-btn oled" onClick={() => handleBgPreset('oled')}>OLED Negro</button>
                  <button className="customizer-bg-preset-btn midnight" onClick={() => handleBgPreset('midnight')}>Midnight Blue</button>
                  <button className="customizer-bg-preset-btn slate" onClick={() => handleBgPreset('slate')}>Slate Light</button>
                </div>

                {/* Custom Pickers for Backgrounds */}
                <div className="customizer-bg-custom-selectors">
                  <div className="customizer-bg-row-picker">
                    <span>Fondo Principal:</span>
                    <input 
                      type="color" 
                      value={settings.customBgPrimary || (settings.mode === 'dark' ? '#0e0e10' : '#f0f2f5')}
                      onChange={(e) => updateTheme({ customBgPrimary: e.target.value })}
                      className="customizer-native-color-picker small"
                    />
                  </div>
                  <div className="customizer-bg-row-picker">
                    <span>Fondo Tarjetas/Sidebar:</span>
                    <input 
                      type="color" 
                      value={settings.customBgCard || (settings.mode === 'dark' ? '#141417' : '#ffffff')}
                      onChange={(e) => updateTheme({ customBgCard: e.target.value })}
                      className="customizer-native-color-picker small"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* TAB 2: ESTRUCTURAS & LAYOUT                                  */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeTab === 'estructuras' && (
            <div className="customizer-tab-content animate-entrance">

              {/* MODELO ESTRUCTURAL DE TARJETA */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Layers size={15} />
                  <span>Diseño y Modelo de Tarjetas</span>
                </div>
                <div className="customizer-select-list">
                  {([
                    { id: 'solid', title: 'Sólido Premium', desc: 'Fondo opaco elegante y sombras sutiles' },
                    { id: 'glassmorphism', title: 'Glássmorfismo Cristal', desc: 'Desenfoque de fondo translúcido y bordes de cristal' },
                    { id: 'neon', title: 'Aura Neón / Glow', desc: 'Bordes iluminados en color primario dinámico' },
                    { id: 'bordered', title: 'Bordeado Mínimo', desc: 'Fondos planos sin sombras, contornos finos' }
                  ] as { id: CardStyle; title: string; desc: string }[]).map(card => (
                    <button
                      key={card.id}
                      className={`customizer-select-item-btn ${settings.cardStyle === card.id ? 'active' : ''}`}
                      onClick={() => updateTheme({ cardStyle: card.id })}
                    >
                      <div className="customizer-select-item-radio">
                        {settings.cardStyle === card.id && <div className="customizer-radio-checked" />}
                      </div>
                      <div className="customizer-select-item-text">
                        <div className="title">{card.title}</div>
                        <div className="desc">{card.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* MODELO ESTRUCTURAL DE INPUTS Y SELECTORES */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Sliders size={15} />
                  <span>Selectores, Inputs y Cajas de Texto</span>
                </div>
                <div className="customizer-select-list">
                  {([
                    { id: 'filled', title: 'Lleno Mate (Standard)', desc: 'Cajas rellenas en gris de contraste oscuro' },
                    { id: 'glass', title: 'Cristal Translúcido', desc: 'Inputs semi-transparentes de fondo difuso' },
                    { id: 'bordered', title: 'Borde Completo Resaltado', desc: 'Contornos sólidos que cambian al enfocar' },
                    { id: 'underline', title: 'Línea Inferior Elegante', desc: 'Sin bordes laterales ni superiores, estilo premium' }
                  ] as { id: InputStyle; title: string; desc: string }[]).map(input => (
                    <button
                      key={input.id}
                      className={`customizer-select-item-btn ${settings.inputStyle === input.id ? 'active' : ''}`}
                      onClick={() => updateTheme({ inputStyle: input.id })}
                    >
                      <div className="customizer-select-item-radio">
                        {settings.inputStyle === input.id && <div className="customizer-radio-checked" />}
                      </div>
                      <div className="customizer-select-item-text">
                        <div className="title">{input.title}</div>
                        <div className="desc">{input.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* MODELO DE BOTONES */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Monitor size={15} />
                  <span>Diseño y Efecto de Botones</span>
                </div>
                <div className="customizer-select-list">
                  {([
                    { id: 'classic', title: 'Clásico Sólido', desc: 'Botón con color de marca y tipografía pesada' },
                    { id: 'gradient', title: 'Degradado Fluido (Dompet)', desc: 'Gradiente dinámico entre color primario y acento' },
                    { id: 'outline', title: 'Contorno Contratado', desc: 'Transparente con bordes y hover de color de marca' },
                    { id: 'glowing', title: 'Brillo Pulsante Activo', desc: 'Emisión de brillo posterior en color de marca' }
                  ] as { id: ButtonStyle; title: string; desc: string }[]).map(btn => (
                    <button
                      key={btn.id}
                      className={`customizer-select-item-btn ${settings.buttonStyle === btn.id ? 'active' : ''}`}
                      onClick={() => updateTheme({ buttonStyle: btn.id })}
                    >
                      <div className="customizer-select-item-radio">
                        {settings.buttonStyle === btn.id && <div className="customizer-radio-checked" />}
                      </div>
                      <div className="customizer-select-item-text">
                        <div className="title">{btn.title}</div>
                        <div className="desc">{btn.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* DENSIDAD DE LA INTERFAZ */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Sliders size={15} />
                  <span>Densidad y Espaciado POS</span>
                </div>
                <div className="customizer-select-list">
                  {([
                    { id: 'compact', title: 'Vista Compacta', desc: 'Maximiza el catálogo en pantalla (ideal para cajeros ocupados)' },
                    { id: 'standard', title: 'Vista Estándar', desc: 'Balance entre espaciado elegante y lectura' },
                    { id: 'spacious', title: 'Vista Espaciosa', desc: 'Mayor aire visual y botones amplios (perfecto para pantallas táctiles)' }
                  ] as { id: UiDensity; title: string; desc: string }[]).map(density => (
                    <button
                      key={density.id}
                      className={`customizer-select-item-btn ${settings.uiDensity === density.id ? 'active' : ''}`}
                      onClick={() => updateTheme({ uiDensity: density.id })}
                    >
                      <div className="customizer-select-item-radio">
                        {settings.uiDensity === density.id && <div className="customizer-radio-checked" />}
                      </div>
                      <div className="customizer-select-item-text">
                        <div className="title">{density.title}</div>
                        <div className="desc">{density.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* MODO DE TRANSICIÓN Y ANIMACIONES */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <RotateCcw size={15} />
                  <span>Estilo de Animaciones y Transiciones</span>
                </div>
                <div className="customizer-select-list">
                  {([
                    { id: 'fluid', title: 'Inercias Orgánicas (Fluido)', desc: 'Movimientos suaves con rebote elástico premium' },
                    { id: 'swift', title: 'Transiciones Instantáneas (Swift)', desc: 'Cambios directos y rápidos (150ms) enfocados a velocidad' },
                    { id: 'static', title: 'Estático (Sin Efectos)', desc: 'Desactiva animaciones para ahorrar batería y rendimiento' }
                  ] as { id: AnimationStyle; title: string; desc: string }[]).map(anim => (
                    <button
                      key={anim.id}
                      className={`customizer-select-item-btn ${settings.animationStyle === anim.id ? 'active' : ''}`}
                      onClick={() => updateTheme({ animationStyle: anim.id })}
                    >
                      <div className="customizer-select-item-radio">
                        {settings.animationStyle === anim.id && <div className="customizer-radio-checked" />}
                      </div>
                      <div className="customizer-select-item-text">
                        <div className="title">{anim.title}</div>
                        <div className="desc">{anim.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* TAB 3: DETALLES & REDONDEO                                   */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeTab === 'detalles' && (
            <div className="customizer-tab-content animate-entrance">

              {/* RANGE SLIDERS PARA REDONDEADO DINÁMICO DE COMPONENTES INDEPENDIENTES */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Sliders size={15} />
                  <span>Redondeado Independiente de Componentes</span>
                </div>
                
                {/* 1. Redondeado de Tarjetas */}
                <div className="customizer-slider-group" style={{ marginBottom: '12px' }}>
                  <div className="customizer-slider-header">
                    <span className="label">Esquinas de Tarjetas e Islas</span>
                    <span className="value">{settings.borderRadiusCard}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={settings.borderRadiusCard}
                    onChange={(e) => updateTheme({ borderRadiusCard: parseInt(e.target.value, 10) })}
                    className="customizer-slider"
                  />
                  <div className="customizer-slider-labels">
                    <span>Recto (0px)</span>
                    <span>Estándar (24px)</span>
                    <span>Burbuja (40px)</span>
                  </div>
                </div>

                {/* 2. Redondeado de Botones */}
                <div className="customizer-slider-group" style={{ marginBottom: '12px' }}>
                  <div className="customizer-slider-header">
                    <span className="label">Esquinas de Botones</span>
                    <span className="value">{settings.borderRadiusButton}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={settings.borderRadiusButton}
                    onChange={(e) => updateTheme({ borderRadiusButton: parseInt(e.target.value, 10) })}
                    className="customizer-slider"
                  />
                  <div className="customizer-slider-labels">
                    <span>Recto (0px)</span>
                    <span>Estándar (12px)</span>
                    <span>Redondo (30px)</span>
                  </div>
                </div>

                {/* 3. Redondeado de Cajas de Texto / Selectores */}
                <div className="customizer-slider-group" style={{ marginBottom: '12px' }}>
                  <div className="customizer-slider-header">
                    <span className="label">Esquinas de Cajas de Texto e Inputs</span>
                    <span className="value">{settings.borderRadiusInput}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={settings.borderRadiusInput}
                    onChange={(e) => updateTheme({ borderRadiusInput: parseInt(e.target.value, 10) })}
                    className="customizer-slider"
                  />
                  <div className="customizer-slider-labels">
                    <span>Recto (0px)</span>
                    <span>Estándar (12px)</span>
                    <span>Redondo (30px)</span>
                  </div>
                </div>

                {/* 4. Redondeado de Items de Navegación Sidebar */}
                <div className="customizer-slider-group">
                  <div className="customizer-slider-header">
                    <span className="label">Esquinas del Menú Sidebar</span>
                    <span className="value">{settings.borderRadiusNav}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={settings.borderRadiusNav}
                    onChange={(e) => updateTheme({ borderRadiusNav: parseInt(e.target.value, 10) })}
                    className="customizer-slider"
                  />
                  <div className="customizer-slider-labels">
                    <span>Recto (0px)</span>
                    <span>Estándar (14px)</span>
                    <span>Redondo (24px)</span>
                  </div>
                </div>

                <p className="customizer-section-hint" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px' }}>
                  Nota: Cada elemento tiene su propio controlador dinámico. Esto te permite crear combinaciones únicas (por ejemplo, tarjetas completamente cuadradas con botones circulares).
                </p>
              </div>

              {/* CONTROLES AVANZADOS DE CRISTAL (SI ESTÁ ACTIVO EL GLASSMORPHISM) */}
              {settings.cardStyle === 'glassmorphism' && (
                <div className="customizer-section">
                  <div className="customizer-section-header">
                    <Sliders size={15} />
                    <span>Configuración de Cristal (Glassmorphism)</span>
                  </div>
                  
                  {/* Deslizador de Desenfoque */}
                  <div className="customizer-slider-group" style={{ marginBottom: '12px' }}>
                    <div className="customizer-slider-header">
                      <span className="label">Fuerza del Desenfoque (Glass Blur)</span>
                      <span className="value">{settings.glassBlur}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={settings.glassBlur}
                      onChange={(e) => updateTheme({ glassBlur: parseInt(e.target.value, 10) })}
                      className="customizer-slider"
                    />
                    <div className="customizer-slider-labels">
                      <span>Lúcido (0px)</span>
                      <span>Estándar (16px)</span>
                      <span>Esmerilado (30px)</span>
                    </div>
                  </div>

                  {/* Interruptor de Textura de Ruido */}
                  <button
                    className={`customizer-select-item-btn ${settings.glassNoise ? 'active' : ''}`}
                    onClick={() => updateTheme({ glassNoise: !settings.glassNoise })}
                  >
                    <div className="customizer-select-item-radio">
                      {settings.glassNoise && <div className="customizer-radio-checked" />}
                    </div>
                    <div className="customizer-select-item-text">
                      <div className="title">Textura Física de Vidrio</div>
                      <div className="desc">Añade un grano micro-texturizado tridimensional sobre el cristal</div>
                    </div>
                  </button>
                </div>
              )}

              {/* DISEÑO DE LISTAS Y TABLAS */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Layout size={15} />
                  <span>Estructuras de Listas y Tablas</span>
                </div>
                <div className="customizer-select-list">
                  {([
                    { id: 'elevated', title: 'Elevado Activo en Hover', desc: 'Las filas se elevan y desplazan con sombras 3D' },
                    { id: 'striped', title: 'Zebra Contraste', desc: 'Filas impares translúcidas de fondo automático' },
                    { id: 'minimal', title: 'Separadores Planos', desc: 'Separación sutil con líneas, sin fondo interactivo' }
                  ] as { id: ListStyle; title: string; desc: string }[]).map(list => (
                    <button
                      key={list.id}
                      className={`customizer-select-item-btn ${settings.listStyle === list.id ? 'active' : ''}`}
                      onClick={() => updateTheme({ listStyle: list.id })}
                    >
                      <div className="customizer-select-item-radio">
                        {settings.listStyle === list.id && <div className="customizer-radio-checked" />}
                      </div>
                      <div className="customizer-select-item-text">
                        <div className="title">{list.title}</div>
                        <div className="desc">{list.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ACORDEONES */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <FolderOpen size={15} />
                  <span>Estructura de Acordeones / Menús</span>
                </div>
                <div className="customizer-select-list">
                  {([
                    { id: 'classic', title: 'Clásico Integrado', desc: 'Menús lisos integrados con el panel' },
                    { id: 'glowing', title: 'Foco Neón Izquierdo', desc: 'Línea de color de marca brillante en el borde activo' },
                    { id: 'boxed', title: 'Flotantes Flotados (Boxed)', desc: 'Secciones separadas en islas con bordes definidos' }
                  ] as { id: AccordionStyle; title: string; desc: string }[]).map(acc => (
                    <button
                      key={acc.id}
                      className={`customizer-select-item-btn ${settings.accordionStyle === acc.id ? 'active' : ''}`}
                      onClick={() => updateTheme({ accordionStyle: acc.id })}
                    >
                      <div className="customizer-select-item-radio">
                        {settings.accordionStyle === acc.id && <div className="customizer-radio-checked" />}
                      </div>
                      <div className="customizer-select-item-text">
                        <div className="title">{acc.title}</div>
                        <div className="desc">{acc.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* BRILLO AMBIENTAL GLOBAL (GLOW) */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <ToggleLeft size={15} />
                  <span>Brillo y Sombras Ambientales</span>
                </div>
                <button
                  className={`customizer-select-item-btn ${settings.glowEffects ? 'active' : ''}`}
                  onClick={() => updateTheme({ glowEffects: !settings.glowEffects })}
                >
                  <div className="customizer-select-item-radio">
                    {settings.glowEffects && <div className="customizer-radio-checked" />}
                  </div>
                  <div className="customizer-select-item-text">
                    <div className="title">Activar Aura Neón Global</div>
                    <div className="desc">Proyecta sombras difusas del color primario en botones activos y KPIs clave</div>
                  </div>
                </button>
              </div>

              {/* WIDGETS Y ATAJOS POS */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <ToggleLeft size={15} />
                  <span>Widgets Complementarios</span>
                </div>
                <button
                  className={`customizer-select-item-btn ${settings.shortcutsWidget ? 'active' : ''}`}
                  onClick={() => updateTheme({ shortcutsWidget: !settings.shortcutsWidget })}
                >
                  <div className="customizer-select-item-radio">
                    {settings.shortcutsWidget && <div className="customizer-radio-checked" />}
                  </div>
                  <div className="customizer-select-item-text">
                    <div className="title">Atajos de Teclado POS</div>
                    <div className="desc">Muestra un panel rápido en el sidebar derecho con combinaciones de teclas frecuentes</div>
                  </div>
                </button>
              </div>

              {/* TIPOGRAFÍA */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Type size={15} />
                  <span>Tipografía del Sistema</span>
                </div>
                <div className="customizer-font-list">
                  {FONT_OPTIONS.map(f => (
                    <button
                      key={f.name}
                      className={`customizer-font-btn ${settings.fontFamily === f.value ? 'active' : ''}`}
                      onClick={() => updateTheme({ fontFamily: f.value })}
                      style={{ fontFamily: f.value }}
                    >
                      {f.name}
                      {settings.fontFamily === f.value && (
                        <span className="customizer-font-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* ESTILO DE SIDEBAR LAYOUT */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <PanelLeft size={15} />
                  <span>Estilo del Sidebar</span>
                </div>
                <div className="customizer-preview-grid">
                  {(['compact', 'expanded', 'mini', 'overlay'] as SidebarStyle[]).map(s => (
                    <div key={s} onClick={() => updateTheme({ sidebarStyle: s })}>
                      <SidebarPreview style={s} active={settings.sidebarStyle === s} />
                    </div>
                  ))}
                </div>
              </div>

              {/* POSICIÓN HEADER */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Layout size={15} />
                  <span>Posición del Header</span>
                </div>
                <div className="customizer-preview-grid two-cols">
                  {(['fixed', 'static'] as HeaderPosition[]).map(p => (
                    <div key={p} onClick={() => updateTheme({ headerPosition: p })}>
                      <HeaderPreview position={p} active={settings.headerPosition === p} />
                    </div>
                  ))}
                </div>
              </div>

              {/* LAYOUT CONTENIDO */}
              <div className="customizer-section">
                <div className="customizer-section-header">
                  <Layout size={15} />
                  <span>Layout del Contenido</span>
                </div>
                <div className="customizer-preview-grid two-cols">
                  {(['full', 'boxed'] as ContentLayout[]).map(l => (
                    <div key={l} onClick={() => updateTheme({ contentLayout: l })}>
                      <LayoutPreview layout={l} active={settings.contentLayout === l} />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer - Reset */}
        <div className="customizer-footer">
          <button className="customizer-reset-btn" onClick={resetTheme} style={{ fontFamily: 'var(--font-main)', fontWeight: 700 }}>
            <RotateCcw size={14} />
            <span>Restablecer por defecto</span>
          </button>
        </div>
      </aside>
    </>
  );
}
