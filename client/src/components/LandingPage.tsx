import { useEffect, useRef, useState } from 'react';
import { 
  Wifi, 
  ShieldCheck, 
  DollarSign, 
  FileText, 
  ArrowRight, 
  Sun, 
  Moon, 
  Sparkles,
  Check,
  Monitor,
  ShoppingBag,
  Users,
  Activity,
  ChevronRight
} from 'lucide-react';
import { useTheme, PRIMARY_COLORS } from '../contexts/ThemeContext';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { animate, createTimeline } from 'animejs';

interface LandingPageProps {
  onEnterLogin: () => void;
  onEnterRegister: () => void;
}

export default function LandingPage({ onEnterLogin, onEnterRegister }: LandingPageProps) {
  const { settings, updateTheme, resetTheme } = useTheme();
  const { formatUSD } = useExchangeRate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'ventas' | 'inventario' | 'seguridad'>('ventas');

  const isDarkMode = settings.mode === 'dark';

  // Permitir scroll en el body mientras se está en la Landing Page, y bloquearlo al salir
  useEffect(() => {
    const originalOverflowY = document.body.style.overflowY;
    const originalHeight = document.body.style.height;
    
    document.body.style.overflowY = 'auto';
    document.body.style.height = 'auto';
    
    return () => {
      document.body.style.overflowY = originalOverflowY;
      document.body.style.height = originalHeight;
    };
  }, []);

  // 1. Efectos de Entrada e Interactividad con Anime.js
  useEffect(() => {
    // Animación de entrada inicial (Hero)
    const tl = createTimeline();

    tl.add('.hero-badge', {
      scale: [0.6, 1],
      opacity: [0, 1],
      duration: 600,
      ease: 'outBack'
    });

    tl.add('.hero-title-main', {
      translateY: [40, 0],
      opacity: [0, 1],
      duration: 800,
      ease: 'outQuad'
    }, '-=400');

    tl.add('.hero-desc', {
      translateY: [20, 0],
      opacity: [0, 1],
      duration: 600,
      ease: 'outQuad'
    }, '-=600');

    tl.add('.hero-actions', {
      translateY: [15, 0],
      opacity: [0, 1],
      duration: 600,
      ease: 'outQuad'
    }, '-=500');

    tl.add('.hero-preview-wrapper', {
      scale: [0.95, 1],
      opacity: [0, 1],
      duration: 1000,
      ease: 'outBack'
    }, '-=400');

    // Animación de las tarjetas de características al hacer scroll o montar
    animate('.feature-card', {
      translateY: [50, 0],
      opacity: [0, 1],
      delay: (_el: any, i: number) => i * 150,
      duration: 800,
      ease: 'outBack'
    });

    // Crear partículas flotantes en el fondo para estética premium
    const particles = Array.from({ length: 15 });
    particles.forEach((_, i) => {
      const el = document.createElement('div');
      el.className = 'bg-particle';
      el.style.position = 'absolute';
      el.style.width = `${Math.random() * 10 + 4}px`;
      el.style.height = el.style.width;
      el.style.borderRadius = '50%';
      el.style.backgroundColor = settings.primaryColor;
      el.style.opacity = `${Math.random() * 0.15 + 0.05}`;
      el.style.left = `${Math.random() * 100}%`;
      el.style.top = `${Math.random() * 100}%`;
      
      const background = document.querySelector('.landing-bg-particles');
      if (background) {
        background.appendChild(el);

        animate(el, {
          translateX: () => [0, Math.random() * 80 - 40],
          translateY: () => [0, Math.random() * 80 - 40],
          opacity: [0.05, 0.2, 0.05],
          duration: () => Math.random() * 8000 + 4000,
          loop: true,
          direction: 'alternate',
          ease: 'inOutSine'
        });
      }
    });

    return () => {
      // Limpiar partículas al desmontar
      const bg = document.querySelector('.landing-bg-particles');
      if (bg) bg.innerHTML = '';
    };
  }, [settings.primaryColor]);

  // Animación del mockup de pantalla interactiva al cambiar de tab
  useEffect(() => {
    animate('.mockup-content-element', {
      scale: [0.97, 1],
      opacity: [0.5, 1],
      duration: 500,
      ease: 'outQuad'
    });
  }, [activeTab]);

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-main)',
        overflowX: 'hidden',
        position: 'relative',
        paddingBottom: '80px',
        transition: 'background-color 0.3s ease, color 0.3s ease'
      }}
    >
      {/* Fondo de Partículas Animadas */}
      <div className="landing-bg-particles" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }} />

      {/* ── BARRA DE NAVEGACIÓN (GLASSMORPHISM) ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        padding: '16px 5%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--bg-header, rgba(10, 10, 12, 0.8))',
        backdropFilter: 'blur(var(--glass-blur, 12px))',
        borderBottom: '1px solid var(--border-color)',
        transition: 'background-color 0.3s, border-color 0.3s'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--brand-primary), var(--accent-yellow, #fbbf24))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px var(--brand-primary-light)'
          }}>
            <Sparkles size={18} color="#000" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-script, "Plus Jakarta Sans")', letterSpacing: '-0.5px' }}>
            StockMasterPro
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '13px', fontWeight: 700 }}>
          <a href="#features" className="nav-link-landing" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>Características</a>
          <a href="#demo" className="nav-link-landing" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>Tour Interactivo</a>
          <a href="#pricing" className="nav-link-landing" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }}>Roles de Cuenta</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={onEnterLogin}
            className="btn-pill-dark"
            style={{ 
              padding: '8px 18px', 
              borderRadius: 'var(--button-radius)', 
              fontSize: '12px', 
              fontWeight: 800, 
              backgroundColor: 'var(--bg-input, rgba(255,255,255,0.05))',
              border: '1px solid var(--border-color)',
              cursor: 'pointer'
            }}
          >
            Acceder al POS
          </button>
          <button 
            onClick={onEnterRegister}
            className="btn-yellow"
            style={{ 
              padding: '8px 18px', 
              borderRadius: 'var(--button-radius)', 
              fontSize: '12px', 
              fontWeight: 800, 
              backgroundColor: 'var(--brand-primary)', 
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px var(--brand-primary-light)'
            }}
          >
            Registrarse
          </button>
        </div>
      </header>

      {/* ── SECCIÓN HERO (PRINCIPAL) ── */}
      <section style={{
        padding: '80px 5% 40px 5%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        zIndex: 2
      }}>
        {/* Badge superior */}
        <div 
          className="hero-badge"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--brand-primary-light)',
            color: 'var(--brand-primary)',
            padding: '6px 14px',
            borderRadius: '50px',
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            marginBottom: '20px',
            opacity: 0
          }}
        >
          <Activity size={12} />
          <span>Sincronización Offline-First Activa</span>
        </div>

        <h1 
          className="hero-title-main"
          style={{
            fontSize: 'min(52px, 9vw)',
            fontWeight: 900,
            lineHeight: 1.15,
            maxWidth: '900px',
            margin: '0 0 20px 0',
            letterSpacing: '-1.5px',
            opacity: 0
          }}
        >
          El Sistema POS Inteligente <br />
          <span style={{ 
            background: 'linear-gradient(90deg, var(--brand-primary), var(--accent-yellow, #fbbf24))', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent' 
          }}>
            Replicado en Tiempo Real
          </span>
        </h1>

        <p 
          className="hero-desc"
          style={{
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: '650px',
            margin: '0 0 35px 0',
            fontWeight: 500,
            opacity: 0
          }}
        >
          Diseñado para el comercio moderno de Venezuela. Disfrute de facturación local instantánea sin internet, conversión cambiaria VES/USD, auditoría de seguridad y digitalización OCR de facturas.
        </p>

        {/* Botones de acción */}
        <div 
          className="hero-actions"
          style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', opacity: 0, marginBottom: '60px' }}
        >
          <button 
            onClick={onEnterLogin}
            className="btn-yellow"
            style={{ 
              padding: '14px 32px', 
              borderRadius: 'var(--button-radius)', 
              fontSize: '13px', 
              fontWeight: 800, 
              backgroundColor: 'var(--brand-primary)', 
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 24px var(--brand-primary-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span>Iniciar Sesión en el POS</span>
            <ArrowRight size={16} />
          </button>
          <button 
            onClick={onEnterRegister}
            className="btn-pill-dark"
            style={{ 
              padding: '14px 32px', 
              borderRadius: 'var(--button-radius)', 
              fontSize: '13px', 
              fontWeight: 800, 
              backgroundColor: 'var(--bg-card, rgba(255,255,255,0.03))',
              border: '1.5px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-input)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
          >
            Registrar Nuevo Establecimiento
          </button>
        </div>

        {/* Mockup de Aplicación Interactivo */}
        <div 
          className="hero-preview-wrapper"
          style={{
            width: '100%',
            maxWidth: '960px',
            borderRadius: 'var(--card-radius)',
            border: '2px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.3)',
            padding: '16px',
            position: 'relative',
            opacity: 0,
            transform: 'scale(0.95)',
            transition: 'border-color 0.3s, background-color 0.3s'
          }}
        >
          {/* Cabecera del navegador */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#fbbf24' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            </div>
            <div style={{ 
              backgroundColor: 'var(--bg-input)', 
              borderRadius: '100px', 
              padding: '4px 24px', 
              fontSize: '10px', 
              fontFamily: 'monospace', 
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)'
            }}>
              https://pos.stockmaster.pro/dashboard
            </div>
            <div style={{ width: '38px' }} />
          </div>

          {/* Panel interno demo interactivo */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', minHeight: '260px', textAlign: 'left' }}>
            {/* Barra lateral */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
              <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'var(--brand-primary-light)', color: 'var(--brand-primary)', fontWeight: 800, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Monitor size={14} />
                <span>Panel POS</span>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingBag size={14} />
                <span>Inventario</span>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} />
                <span>Nómina</span>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} />
                <span>Auditoría</span>
              </div>
            </div>

            {/* Pantalla Principal del Mockup */}
            <div className="mockup-content-element" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>Panel de Ventas</h3>
                <span style={{ fontSize: '11px', color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>Tasa Cambiaria: Bs. 40.50</span>
              </div>

              {/* Grid cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div className="widget" style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-secondary)' }}>VENTAS HOY</span>
                  <span style={{ fontSize: '16px', fontWeight: 800 }}>$1,240.50</span>
                </div>
                <div className="widget" style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-secondary)' }}>TRANSACCIONES</span>
                  <span style={{ fontSize: '16px', fontWeight: 800 }}>80 Ventas</span>
                </div>
                <div className="widget" style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-secondary)' }}>ESTADO LOCAL</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Wifi size={11} /> Ready
                  </span>
                </div>
              </div>

              {/* Lista interactiva */}
              <div className="widget" style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>ÚLTIMOS EVENTOS DE AUDITORÍA</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ fontWeight: 700 }}>VENTA_CREAR: Ticket TKT-10080</span>
                  <span style={{ color: 'var(--text-muted)' }}>Hace 2 min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                  <span style={{ fontWeight: 700 }}>SYNC_COMPLETADO: Sincronización exitosa</span>
                  <span style={{ color: 'var(--text-muted)' }}>Hace 5 min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PANEL DE CONFIGURACIÓN DE DISEÑO EN VIVO (MUESTRA CONFIGURABILIDAD DE LA APLICACIÓN) ── */}
      <section style={{
        padding: '40px 5%',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 2,
        position: 'relative'
      }}>
        <div className="widget" style={{
          width: '100%',
          maxWidth: '960px',
          padding: '24px',
          borderRadius: 'var(--card-radius)',
          border: '1.5px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--card-shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--brand-primary)' }} />
              <span>Personaliza esta Landing Page en Tiempo Real</span>
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
              El POS cuenta con un motor de personalización dinámico. Modifica los controles de abajo y mira cómo cambia toda la página.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            {/* Selector de modo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>MODO DE TEMA</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => updateTheme({ mode: 'dark' })}
                  className="btn-pill-dark"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--button-radius)',
                    backgroundColor: isDarkMode ? 'var(--brand-primary)' : 'var(--bg-input)',
                    color: isDarkMode ? '#fff' : 'var(--text-primary)',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Moon size={14} />
                  <span>Modo Oscuro</span>
                </button>
                <button 
                  onClick={() => updateTheme({ mode: 'light' })}
                  className="btn-pill-dark"
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--button-radius)',
                    backgroundColor: !isDarkMode ? 'var(--brand-primary)' : 'var(--bg-input)',
                    color: !isDarkMode ? '#fff' : 'var(--text-primary)',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <Sun size={14} />
                  <span>Modo Claro</span>
                </button>
              </div>
            </div>

            {/* Selector de Color Primario */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>COLOR DE MARCA (PRIMARY)</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', height: '100%', alignItems: 'center' }}>
                {PRIMARY_COLORS.slice(0, 6).map((color) => {
                  const isActive = settings.primaryColor === color.hex;
                  return (
                    <button
                      key={color.name}
                      onClick={() => updateTheme({ primaryColor: color.hex, primaryColorName: color.name })}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: color.hex,
                        border: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
                        boxShadow: isActive ? '0 0 10px var(--brand-primary)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={color.name}
                    >
                      {isActive && <Check size={12} color="#fff" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selector de Densidad UI */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>BORDES Y REDONDEADO</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => updateTheme({ borderRadiusCard: 6, borderRadiusButton: 4, borderRadiusInput: 4 })}
                  className="btn-pill-dark"
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '4px',
                    backgroundColor: settings.borderRadiusCard === 6 ? 'var(--brand-primary)' : 'var(--bg-input)',
                    color: settings.borderRadiusCard === 6 ? '#fff' : 'var(--text-primary)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Rectos (Industrial)
                </button>
                <button
                  onClick={() => updateTheme({ borderRadiusCard: 24, borderRadiusButton: 12, borderRadiusInput: 12 })}
                  className="btn-pill-dark"
                  style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '12px',
                    backgroundColor: settings.borderRadiusCard === 24 ? 'var(--brand-primary)' : 'var(--bg-input)',
                    color: settings.borderRadiusCard === 24 ? '#fff' : 'var(--text-primary)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Curvos (Moderna)
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN CARACTERÍSTICAS / PROBLEMAS QUE RESUELVE (GRID) ── */}
      <section id="features" style={{
        padding: '60px 5%',
        position: 'relative',
        zIndex: 2
      }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 10px 0' }}>¿Qué Ofrece StockMasterPro?</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Los problemas más comunes del retail moderno, solucionados con tecnología de punta ininterrumpida.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* Card 1 */}
          <div 
            className="widget feature-card" 
            style={{ 
              padding: '24px', 
              borderRadius: 'var(--card-radius)', 
              border: '1.5px solid var(--border-color)', 
              backgroundColor: 'var(--bg-card)',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifySelf: 'flex-start', justifyContent: 'center', color: 'var(--brand-primary)' }}>
              <Wifi size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0' }}>Sincronización Offline-First</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                IndexedDB local integrado con RxDB. Facture al instante aunque se caiga el internet; el POS guardará todo localmente y sincronizará de forma automática y transparente con el servidor remoto al restablecer la conexión.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div 
            className="widget feature-card" 
            style={{ 
              padding: '24px', 
              borderRadius: 'var(--card-radius)', 
              border: '1.5px solid var(--border-color)', 
              backgroundColor: 'var(--bg-card)',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(251, 191, 36, 0.1)', display: 'flex', alignItems: 'center', justifySelf: 'flex-start', justifyContent: 'center', color: 'var(--brand-gold)' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0' }}>Multimoneda y Eje Cambiario</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Maneje transacciones duales dólares ($) y bolívares (Bs.). Multiplique, divida y dé vueltos calculando la tasa del Banco Central de forma integrada, evitando descuadres de caja y agilizando las ventas.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div 
            className="widget feature-card" 
            style={{ 
              padding: '24px', 
              borderRadius: 'var(--card-radius)', 
              border: '1.5px solid var(--border-color)', 
              backgroundColor: 'var(--bg-card)',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifySelf: 'flex-start', justifyContent: 'center', color: '#22c55e' }}>
              <FileText size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0' }}>Compras y Recepción OCR</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Suba fotos de facturas de proveedores. Nuestro algoritmo inteligente OCR extraerá y mapeará los productos, cantidades y costos, actualizando el stock y alimentando automáticamente el COGS.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div 
            className="widget feature-card" 
            style={{ 
              padding: '24px', 
              borderRadius: 'var(--card-radius)', 
              border: '1.5px solid var(--border-color)', 
              backgroundColor: 'var(--bg-card)',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(168, 85, 247, 0.1)', display: 'flex', alignItems: 'center', justifySelf: 'flex-start', justifyContent: 'center', color: '#a855f7' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0' }}>Bitácora de Auditoría Absoluta</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Control total de la seguridad. Registre cada cambio crítico de stock, eliminación de ítem, inicio de sesión o arqueo, identificando la dirección IP, el User Agent y el usuario responsable, protegiendo su negocio contra pérdidas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TOUR DE LA APLICACIÓN INTERACTIVO (DEMO EN VIVO) ── */}
      <section id="demo" style={{
        padding: '60px 5%',
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        zIndex: 2,
        position: 'relative',
        transition: 'background-color 0.3s, border-color 0.3s'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px' }}>
              RECORRIDO DEL POS
            </span>
            <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 16px 0', lineHeight: 1.25 }}>
              Una interfaz robusta, <br />
              pensada para el cajero
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px 0' }}>
              Diseñada meticulosamente para minimizar clics y optimizar los tiempos de atención en cola. Explora los diferentes módulos de la aplicación:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Tab button 1 */}
              <div 
                onClick={() => setActiveTab('ventas')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px 16px', 
                  borderRadius: '12px', 
                  backgroundColor: activeTab === 'ventas' ? 'var(--bg-primary)' : 'transparent',
                  border: `1px solid ${activeTab === 'ventas' ? 'var(--border-color)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeTab === 'ventas' ? 'var(--brand-primary)' : 'var(--text-muted)' }} />
                <div>
                  <strong style={{ fontSize: '12.5px', display: 'block', color: activeTab === 'ventas' ? 'var(--brand-primary)' : 'var(--text-primary)' }}>Facturación y Cobro POS</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Teclado táctil y buscador por código de barras.</span>
                </div>
              </div>

              {/* Tab button 2 */}
              <div 
                onClick={() => setActiveTab('inventario')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px 16px', 
                  borderRadius: '12px', 
                  backgroundColor: activeTab === 'inventario' ? 'var(--bg-primary)' : 'transparent',
                  border: `1px solid ${activeTab === 'inventario' ? 'var(--border-color)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeTab === 'inventario' ? 'var(--brand-primary)' : 'var(--text-muted)' }} />
                <div>
                  <strong style={{ fontSize: '12.5px', display: 'block', color: activeTab === 'inventario' ? 'var(--brand-primary)' : 'var(--text-primary)' }}>Catálogo e Inventario</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Alerta de bajo stock y valorizaciones en tiempo real.</span>
                </div>
              </div>

              {/* Tab button 3 */}
              <div 
                onClick={() => setActiveTab('seguridad')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px 16px', 
                  borderRadius: '12px', 
                  backgroundColor: activeTab === 'seguridad' ? 'var(--bg-primary)' : 'transparent',
                  border: `1px solid ${activeTab === 'seguridad' ? 'var(--border-color)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeTab === 'seguridad' ? 'var(--brand-primary)' : 'var(--text-muted)' }} />
                <div>
                  <strong style={{ fontSize: '12.5px', display: 'block', color: activeTab === 'seguridad' ? 'var(--brand-primary)' : 'var(--text-primary)' }}>Auditoría y Bitácora</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Rastreabilidad total de IP, fecha e histórico de cambios.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Screen Preview */}
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            padding: '24px',
            boxShadow: 'var(--card-shadow)',
            minHeight: '320px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            {activeTab === 'ventas' && (
              <div className="mockup-content-element" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)' }}>VISTA DE COBRO</span>
                <h4 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Arqueo de Caja y Cobro Ágil</h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Introduce pagos mixtos: tarjeta de crédito, transferencias bancarias y dólares en efectivo. El sistema desglosa los montos en ambas monedas y genera el arqueo automatizado cuadrando las dos divisas.
                </p>
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', gap: '10px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--bg-input)', padding: '4px 10px', borderRadius: '6px' }}>PAGO VES</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--bg-input)', padding: '4px 10px', borderRadius: '6px' }}>PAGO USD</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--bg-input)', padding: '4px 10px', borderRadius: '6px' }}>VUELTO Bs.</span>
                </div>
              </div>
            )}

            {activeTab === 'inventario' && (
              <div className="mockup-content-element" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)' }}>VISTA DE PRODUCTOS</span>
                <h4 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Gestión Inteligente del Stock</h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Controles de stock mínimo configurables. Si el sistema detecta que un producto queda por debajo de su cantidad óptima, dispara automáticamente una etiqueta visual roja de "Bajo Stock" en el panel principal.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                  <span style={{ fontSize: '11.5px', fontWeight: 700 }}>Arroz Blanco 1kg — Stock: 3 units (Min: 20)</span>
                </div>
              </div>
            )}

            {activeTab === 'seguridad' && (
              <div className="mockup-content-element" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)' }}>VISTA DE BITÁCORA</span>
                <h4 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Trazabilidad Blindada Inmutable</h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Cada evento registra la huella completa del cliente o usuario: IP del navegador, versión de la aplicación y metadatos JSON completos antes y después del cambio. Ideal para auditorías fiscales y control interno.
                </p>
                <code style={{ fontSize: '10.5px', backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', color: 'var(--brand-primary)' }}>
                  {`{ "user": "cajero@stockmaster", "action": "STOCK_UPDATE", "diff": { "before": 150, "after": 145 } }`}
                </code>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN DE PLANES Y ROLES DE CUENTA ── */}
      <section id="pricing" style={{
        padding: '60px 5%',
        zIndex: 2,
        position: 'relative'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '0 0 10px 0' }}>Perfiles y Roles de Acceso</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Niveles de seguridad adaptados al tamaño y estructura de su equipo de trabajo.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '30px',
          maxWidth: '1100px',
          margin: '0 auto'
        }}>
          {/* Plan 1 */}
          <div className="widget" style={{ padding: '30px', borderRadius: 'var(--card-radius)', border: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '3px 8px', borderRadius: '50px', letterSpacing: '0.5px' }}>ACCESO OPERATIVO</span>
              <h4 style={{ fontSize: '22px', fontWeight: 800, margin: '10px 0 4px 0' }}>Cajero (Cashier)</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Para operadores y personal de caja en el punto de venta.</p>
            </div>
            
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Facturación rápida</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Cobros multimoneda</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Arqueo y cierre de caja local</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Buscador de catálogo local</li>
            </ul>
          </div>

          {/* Plan 2 */}
          <div className="widget" style={{ padding: '30px', borderRadius: 'var(--card-radius)', border: '2px solid var(--brand-primary)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-12px', right: '20px', backgroundColor: 'var(--brand-primary)', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '4px 10px', borderRadius: '50px' }}>MÁS POPULAR</div>
            <div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--brand-gold)', backgroundColor: 'rgba(251,191,36,0.1)', padding: '3px 8px', borderRadius: '50px', letterSpacing: '0.5px' }}>AUDITORÍA INTEGRAL</span>
              <h4 style={{ fontSize: '22px', fontWeight: 800, margin: '10px 0 4px 0' }}>Auditor (Auditor)</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Para contadores, auditores externos y supervisores.</p>
            </div>
            
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Acceso a bitácora de seguridad</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Reportes financieros avanzados</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Exportación de balances a CSV/PDF</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Vista de márgenes y ROI real</li>
            </ul>
          </div>

          {/* Plan 3 */}
          <div className="widget" style={{ padding: '30px', borderRadius: 'var(--card-radius)', border: '1.5px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)', padding: '3px 8px', borderRadius: '50px', letterSpacing: '0.5px' }}>CONTROL GLOBAL</span>
              <h4 style={{ fontSize: '22px', fontWeight: 800, margin: '10px 0 4px 0' }}>Administrador (Admin)</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Para dueños de negocio y gerentes generales.</p>
            </div>
            
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Gestión completa de catálogo</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Control de nóminas y salarios</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Carga y digitalización OCR de compras</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Configuración fiscal y de negocio</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        marginTop: '60px',
        padding: '30px 5% 0 5%',
        borderTop: '1px solid var(--border-color)',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-muted)',
        zIndex: 2,
        position: 'relative'
      }}>
        <p style={{ margin: '0 0 10px 0' }}>© {new Date().getFullYear()} StockMasterPro. Todos los derechos reservados.</p>
        <p style={{ margin: 0, fontSize: '10px' }}>Cumplimiento fiscal y estándares de desarrollo POS en Venezuela.</p>
      </footer>
    </div>
  );
}
