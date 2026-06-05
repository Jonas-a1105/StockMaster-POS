import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

/* ── Tipos ──────────────────────────────────────────── */
export type ThemeMode = 'dark' | 'light';
export type SidebarStyle = 'compact' | 'expanded' | 'mini' | 'overlay';
export type HeaderPosition = 'fixed' | 'static';
export type ContentLayout = 'full' | 'boxed';
export type SidebarBg = 'default' | 'teal' | 'dark' | 'gradient';

export type CardStyle = 'solid' | 'glassmorphism' | 'neon' | 'bordered';
export type ButtonStyle = 'classic' | 'gradient' | 'outline' | 'glowing';
export type InputStyle = 'filled' | 'glass' | 'bordered' | 'underline';
export type ListStyle = 'elevated' | 'striped' | 'minimal';
export type AccordionStyle = 'classic' | 'glowing' | 'boxed';
export type UiDensity = 'compact' | 'standard' | 'spacious';
export type AnimationStyle = 'fluid' | 'swift' | 'static';
export type PillStyle = 'flat' | 'filled' | 'bordered' | 'glow';
export type PillAnimation = 'pulse' | 'bounce' | 'none';

export interface ThemeSettings {
  mode: ThemeMode;
  primaryColor: string;
  primaryColorName: string;
  accentColor: string;
  accentColorName: string;
  sidebarStyle: SidebarStyle;
  headerPosition: HeaderPosition;
  fontFamily: string;
  contentLayout: ContentLayout;
  sidebarBg: SidebarBg;
  borderRadiusCard: number;
  borderRadiusButton: number;
  borderRadiusInput: number;
  borderRadiusNav: number;
  cardStyle: CardStyle;
  buttonStyle: ButtonStyle;
  inputStyle: InputStyle;
  listStyle: ListStyle;
  accordionStyle: AccordionStyle;
  customBgPrimary: string;
  customBgCard: string;
  glowEffects: boolean;
  uiDensity: UiDensity;
  animationStyle: AnimationStyle;
  glassBlur: number;
  glassNoise: boolean;
  shortcutsWidget: boolean;
  borderEnabled: boolean;
  borderWidth: number;
  customScrollbar: boolean;
  scrollbarSize: number;
  popupStyle: 'solid' | 'glassmorphism' | 'bordered';
  popupBlur: number;
  mobileModalStyle: 'standard' | 'panel';
  pillStyle: PillStyle;
  pillAnimation: PillAnimation;
}

interface ThemeContextValue {
  settings: ThemeSettings;
  updateTheme: (partial: Partial<ThemeSettings>) => void;
  resetTheme: () => void;
}

/* ── Paleta de colores primarios predefinidos ──────── */
export const PRIMARY_COLORS = [
  { name: 'Teal',    hex: '#0ea5a4' },
  { name: 'Blue',    hex: '#3b82f6' },
  { name: 'Purple',  hex: '#8b5cf6' },
  { name: 'Red',     hex: '#ef4444' },
  { name: 'Orange',  hex: '#f97316' },
  { name: 'Gold',    hex: '#eab308' },
  { name: 'Pink',    hex: '#ec4899' },
  { name: 'Green',   hex: '#22c55e' },
  { name: 'Indigo',  hex: '#6366f1' },
  { name: 'Cyan',    hex: '#06b6d4' },
];

/* ── Paleta de colores de acento predefinidos ─────── */
export const ACCENT_COLORS = [
  { name: 'Gold',    hex: '#fbbf24' },
  { name: 'Orange',  hex: '#f97316' },
  { name: 'Red',     hex: '#ef4444' },
  { name: 'Green',   hex: '#22c55e' },
  { name: 'Blue',    hex: '#3b82f6' },
  { name: 'Purple',  hex: '#8b5cf6' },
  { name: 'Pink',    hex: '#ec4899' },
  { name: 'Teal',    hex: '#0ea5a4' },
];

/* ── Fuentes disponibles ──────────────────────────── */
export const FONT_OPTIONS = [
  { name: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
  { name: 'Inter',             value: "'Inter', sans-serif" },
  { name: 'Poppins',           value: "'Poppins', sans-serif" },
  { name: 'Roboto',            value: "'Roboto', sans-serif" },
  { name: 'Open Sans',         value: "'Open Sans', sans-serif" },
  { name: 'Cairo',             value: "'Cairo', sans-serif" },
];

/* ── Valores por defecto ──────────────────────────── */
const DEFAULT_SETTINGS: ThemeSettings = {
  mode: 'dark',
  primaryColor: '#0ea5a4',
  primaryColorName: 'Teal',
  accentColor: '#fbbf24',
  accentColorName: 'Gold',
  sidebarStyle: 'compact',
  headerPosition: 'fixed',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  contentLayout: 'full',
  sidebarBg: 'default',
  borderRadiusCard: 24,
  borderRadiusButton: 12,
  borderRadiusInput: 12,
  borderRadiusNav: 14,
  cardStyle: 'solid',
  buttonStyle: 'classic',
  inputStyle: 'filled',
  listStyle: 'elevated',
  accordionStyle: 'glowing',
  customBgPrimary: '',
  customBgCard: '',
  glowEffects: true,
  uiDensity: 'standard',
  animationStyle: 'fluid',
  glassBlur: 16,
  glassNoise: true,
  shortcutsWidget: false,
  borderEnabled: true,
  borderWidth: 1.5,
  customScrollbar: true,
  scrollbarSize: 6,
  popupStyle: 'glassmorphism',
  popupBlur: 12,
  mobileModalStyle: 'standard',
  pillStyle: 'flat',
  pillAnimation: 'bounce',
};

const STORAGE_KEY = 'stockmaster_theme_settings';

/* ── Helpers ──────────────────────────────────────── */
function loadSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch { /* ignored */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: ThemeSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/** Convierte hex a HSL para generar variantes automáticas */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16) / 255;
    g = parseInt(hex.slice(3, 5), 16) / 255;
    b = parseInt(hex.slice(5, 7), 16) / 255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Carga dinámica de fuentes de Google */
function loadGoogleFont(fontName: string) {
  const id = `gf-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

/** Aplica todas las CSS variables al body */
function applyThemeToDOM(s: ThemeSettings) {
  const body = document.body;

  // Mode
  body.classList.toggle('dark-theme', s.mode === 'dark');
  body.classList.toggle('light-theme', s.mode === 'light');

  // Primary color as CSS vars
  const hsl = hexToHSL(s.primaryColor);
  body.style.setProperty('--brand-primary', s.primaryColor);
  body.style.setProperty('--brand-primary-h', `${hsl.h}`);
  body.style.setProperty('--brand-primary-s', `${hsl.s}%`);
  body.style.setProperty('--brand-primary-l', `${hsl.l}%`);
  body.style.setProperty('--brand-primary-hover', `hsl(${hsl.h}, ${hsl.s}%, ${Math.max(hsl.l - 8, 10)}%)`);
  body.style.setProperty('--brand-primary-light', `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.12)`);

  // Accent color as CSS vars
  const accentHsl = hexToHSL(s.accentColor);
  body.style.setProperty('--brand-gold', s.accentColor);
  body.style.setProperty('--accent-yellow', s.accentColor);
  body.style.setProperty('--accent-yellow-hover', `hsl(${accentHsl.h}, ${accentHsl.s}%, ${Math.max(accentHsl.l - 8, 10)}%)`);

  // Font
  body.style.setProperty('--font-main', s.fontFamily);
  const fontName = s.fontFamily.replace(/'/g, '').split(',')[0].trim();
  if (fontName !== 'Plus Jakarta Sans') {
    loadGoogleFont(fontName);
  }

  // Sidebar style class
  body.classList.remove('sidebar-compact', 'sidebar-expanded', 'sidebar-mini', 'sidebar-overlay');
  body.classList.add(`sidebar-${s.sidebarStyle}`);

  // Header position class
  body.classList.remove('header-fixed', 'header-static');
  body.classList.add(`header-${s.headerPosition}`);

  // Content layout class
  body.classList.remove('layout-full', 'layout-boxed');
  body.classList.add(`layout-${s.contentLayout}`);

  // Sidebar background class
  body.classList.remove('sidebar-bg-default', 'sidebar-bg-teal', 'sidebar-bg-dark', 'sidebar-bg-gradient');
  body.classList.add(`sidebar-bg-${s.sidebarBg}`);

  // Custom backgrounds
  if (s.customBgPrimary) {
    body.style.setProperty('--bg-primary', s.customBgPrimary);
    body.style.setProperty('--bg-header', `${s.customBgPrimary}d9`);
  } else {
    body.style.removeProperty('--bg-primary');
    body.style.removeProperty('--bg-header');
  }

  if (s.customBgCard) {
    body.style.setProperty('--bg-card', s.customBgCard);
    body.style.setProperty('--bg-sidebar', s.customBgCard);
    
    // Auto-generate input background slightly lighter or darker depending on the theme
    const cardHsl = hexToHSL(s.customBgCard);
    const inputL = s.mode === 'dark' ? Math.min(cardHsl.l + 4, 30) : Math.max(cardHsl.l - 8, 80);
    body.style.setProperty('--bg-input', `hsl(${cardHsl.h}, ${cardHsl.s}%, ${inputL}%)`);
  } else {
    body.style.removeProperty('--bg-card');
    body.style.removeProperty('--bg-sidebar');
    body.style.removeProperty('--bg-input');
  }

  // Card styles
  body.classList.remove('card-solid', 'card-glassmorphism', 'card-neon', 'card-bordered');
  body.classList.add(`card-${s.cardStyle}`);

  // Button styles
  body.classList.remove('btn-classic', 'btn-gradient', 'btn-outline', 'btn-glowing');
  body.classList.add(`btn-${s.buttonStyle}`);

  // Input styles
  body.classList.remove('input-filled', 'input-glass', 'input-bordered', 'input-underline');
  body.classList.add(`input-${s.inputStyle}`);

  // List styles
  body.classList.remove('list-elevated', 'list-striped', 'list-minimal');
  body.classList.add(`list-${s.listStyle}`);

  // Accordion styles
  body.classList.remove('accordion-classic', 'accordion-glowing', 'accordion-boxed');
  body.classList.add(`accordion-${s.accordionStyle}`);

  // Border radiuses mapping
  body.style.setProperty('--card-radius', `${s.borderRadiusCard}px`);
  body.style.setProperty('--button-radius', `${s.borderRadiusButton}px`);
  body.style.setProperty('--input-radius', `${s.borderRadiusInput}px`);
  body.style.setProperty('--nav-item-radius', `${s.borderRadiusNav}px`);

  // UI Density
  body.classList.remove('density-compact', 'density-standard', 'density-spacious');
  body.classList.add(`density-${s.uiDensity || 'standard'}`);

  // Animations Style
  body.classList.remove('anim-fluid', 'anim-swift', 'anim-static');
  body.classList.add(`anim-${s.animationStyle || 'fluid'}`);

  // Glass blur strength
  body.style.setProperty('--glass-blur', `${s.glassBlur ?? 16}px`);

  // Glass noise toggle
  body.classList.toggle('glass-noise-enabled', s.glassNoise ?? true);

  // Shortcuts Widget toggle
  body.classList.toggle('shortcuts-widget-enabled', s.shortcutsWidget ?? false);

  // Glow effects toggle
  body.classList.toggle('glow-effects-enabled', s.glowEffects);

  // Borders customization
  body.classList.toggle('borders-enabled', s.borderEnabled ?? true);
  body.classList.toggle('borders-disabled', !(s.borderEnabled ?? true));
  body.style.setProperty('--app-border-width', `${s.borderWidth ?? 1.5}px`);

  // Scrollbars customization
  const docEl = document.documentElement;
  docEl.classList.toggle('custom-scrollbar-enabled', s.customScrollbar ?? true);
  body.classList.toggle('custom-scrollbar-enabled', s.customScrollbar ?? true);
  docEl.style.setProperty('--app-scrollbar-size', `${s.scrollbarSize ?? 6}px`);
  body.style.setProperty('--app-scrollbar-size', `${s.scrollbarSize ?? 6}px`);

  // Popups style and blur
  docEl.classList.remove('popup-solid', 'popup-glassmorphism', 'popup-bordered');
  docEl.classList.add(`popup-${s.popupStyle || 'glassmorphism'}`);
  body.classList.remove('popup-solid', 'popup-glassmorphism', 'popup-bordered');
  body.classList.add(`popup-${s.popupStyle || 'glassmorphism'}`);
  docEl.style.setProperty('--app-popup-blur', `${s.popupBlur ?? 12}px`);
  body.style.setProperty('--app-popup-blur', `${s.popupBlur ?? 12}px`);

  // Auto-generate glass popup background depending on mode
  const bgGlass = s.mode === 'dark' ? 'rgba(20, 20, 23, 0.75)' : 'rgba(255, 255, 255, 0.75)';
  docEl.style.setProperty('--app-popup-bg-glass', bgGlass);
  body.style.setProperty('--app-popup-bg-glass', bgGlass);

  body.classList.remove('mobile-modal-standard', 'mobile-modal-panel');
  body.classList.add(`mobile-modal-${s.mobileModalStyle || 'standard'}`);

  // Pill style
  body.classList.remove('pill-style-flat', 'pill-style-filled', 'pill-style-bordered', 'pill-style-glow');
  body.classList.add(`pill-style-${s.pillStyle || 'flat'}`);

  // Pill animation
  body.classList.remove('pill-anim-pulse', 'pill-anim-bounce', 'pill-anim-none');
  body.classList.add(`pill-anim-${s.pillAnimation || 'bounce'}`);
}

/* ── Context ──────────────────────────────────────── */
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(loadSettings);

  const updateTheme = useCallback((partial: Partial<ThemeSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      applyThemeToDOM(next);
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => {
    setSettings(() => {
      saveSettings(DEFAULT_SETTINGS);
      applyThemeToDOM(DEFAULT_SETTINGS);
      return { ...DEFAULT_SETTINGS };
    });
  }, []);

  // Aplicar al montar
  useEffect(() => {
    applyThemeToDOM(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, updateTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
