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
  X,
  Monitor,
  ShoppingBag,
  Users,
  Activity,
  ChevronRight,
  Menu,
  Star,
  ChevronDown,
  HelpCircle,
  TrendingUp,
  Clock,
  Percent,
  Layers,
  BarChart3,
  CreditCard,
  BookOpen,
  Lock,
  Play,
  Sliders,
  Database,
  Smartphone,
  Mail,
  MessageSquare,
  Settings,
  WifiOff,
  QrCode,
  Camera,
  Store,
  Truck,
  Briefcase,
  Calculator,
  Command,
  Download,
  Printer,
  Share2,
  MessageCircle,
  LayoutDashboard,
  ShoppingCart,
  Package,
  ShieldAlert,
  Search
} from 'lucide-react';
import { useTheme, PRIMARY_COLORS } from '../contexts/ThemeContext';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { animate, createTimeline } from 'animejs';
import RateCalculatorModal from './RateCalculatorModal';
import KeyboardShortcuts from './KeyboardShortcuts';
import AppUpdater from './AppUpdater';

interface LandingPageProps {
  onEnterLogin: () => void;
  onEnterRegister: () => void;
  onStartDemo: () => void;
}

export default function LandingPage({ onEnterLogin, onEnterRegister, onStartDemo }: LandingPageProps) {
  const { settings, updateTheme, resetTheme } = useTheme();
  const { formatUSD, dolarRate } = useExchangeRate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'ventas' | 'inventario' | 'seguridad'>('ventas');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'venta' | 'cierre' | 'analisis'>('venta');

  // Estados del Configurador a la Medida
  const [configBranches, setConfigBranches] = useState(1);
  const [configRegisters, setConfigRegisters] = useState(1);

  // Estados para Rubros Comerciales
  const [activeRubro, setActiveRubro] = useState<'bodegon' | 'panaderia' | 'supermercado'>('bodegon');

  // Estados para el Centro de Simulación Interactiva (Playground)
  const [activePlaygroundTab, setActivePlaygroundTab] = useState<'offline' | 'printer' | 'scanner'>('offline');
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCart, setOfflineCart] = useState<Array<{ name: string; price: number; qty: number }>>([]);
  const [offlineSyncQueue, setOfflineSyncQueue] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [printerPayment, setPrinterPayment] = useState<'mixto' | 'zelle'>('mixto');
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<Array<{ name: string; barcode: string; price: number; stock: number }>>([
    { name: 'Refresco Chinotto 2L', barcode: '759100100234', price: 2.5, stock: 12 },
    { name: 'Queso Amarillo 1kg', barcode: '759231409811', price: 6.8, stock: 8 }
  ]);

  // Estados para los Modales Interactivos de la Landing Page
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isUpdaterOpen, setIsUpdaterOpen] = useState(false);

  // Estados del Formulario de Contacto
  const [contactName, setContactName] = useState('');
  const [contactCity, setContactCity] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactChannel, setContactChannel] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [formSubmitted, setFormSubmitted] = useState(false);

  // Refs para animación de odómetros de métricas globales sin re-renderizado
  const metricTransRef = useRef<HTMLSpanElement>(null);
  const metricHoursRef = useRef<HTMLSpanElement>(null);
  const metricPrecisionRef = useRef<HTMLSpanElement>(null);
  const metricSupportRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
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
    // Si el usuario prefiere movimiento reducido, saltar animaciones — M2
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

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

    // Animación de las tarjetas de características con IntersectionObserver — M4
    const featureCards = document.querySelectorAll('.feature-card');
    const featureObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target, { translateY: [50, 0], opacity: [0, 1], duration: 800, ease: 'outBack' });
          featureObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    featureCards.forEach(card => featureObserver.observe(card));

    // Animación de las tarjetas de precios con IntersectionObserver
    const pricingCards = document.querySelectorAll('.pricing-card');
    const pricingObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target, { translateY: [40, 0], opacity: [0, 1], duration: 700, ease: 'outBack' });
          pricingObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    pricingCards.forEach(card => pricingObserver.observe(card));

    // Animación de las tarjetas de estadísticas con IntersectionObserver
    const statCards = document.querySelectorAll('.stat-card');
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target, { translateY: [30, 0], opacity: [0, 1], duration: 600, ease: 'outQuad' });
          statObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    statCards.forEach(card => statObserver.observe(card));

    // Animación de las tarjetas de testimonios con IntersectionObserver
    const testimonialCards = document.querySelectorAll('.testimonial-card');
    const testimonialObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target, { scale: [0.95, 1], opacity: [0, 1], duration: 700, ease: 'outBack' });
          testimonialObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    testimonialCards.forEach(card => testimonialObserver.observe(card));

    // Animación del banner de CTA final con IntersectionObserver
    const ctaBanners = document.querySelectorAll('.cta-banner');
    const ctaObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target, { scale: [0.98, 1], opacity: [0, 1], duration: 800, ease: 'outQuad' });
          ctaObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    ctaBanners.forEach(banner => ctaObserver.observe(banner));

    // Animación de las tarjetas de módulos especializados
    const moduleCards = document.querySelectorAll('.module-card');
    const moduleObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
          animate(entry.target, { translateY: [40, 0], opacity: [0, 1], duration: 700, delay: idx * 100, ease: 'outBack' });
          moduleObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    moduleCards.forEach(card => moduleObserver.observe(card));

    // Animación de la sección showcase (galería paso a paso)
    const showcaseSections = document.querySelectorAll('.showcase-section');
    const showcaseObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target, { translateY: [30, 0], opacity: [0, 1], duration: 800, ease: 'outQuad' });
          showcaseObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    showcaseSections.forEach(el => showcaseObserver.observe(el));

    // Animación de la sección de gráficos de analíticas
    const chartSections = document.querySelectorAll('.chart-section');
    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target, { scale: [0.96, 1], opacity: [0, 1], duration: 900, ease: 'outBack' });
          chartObserver.unobserve(entry.target);
          // Animar las barras del gráfico individualmente
          const bars = entry.target.querySelectorAll('.chart-bar');
          bars.forEach((bar, i) => {
            animate(bar, {
              scaleY: [0, 1],
              opacity: [0.3, 1],
              duration: 600,
              delay: i * 80,
              ease: 'outBack'
            });
          });
        }
      });
    }, { threshold: 0.15 });
    chartSections.forEach(el => chartObserver.observe(el));

    // Animación de contadores de métricas de impacto global
    const metricsSections = document.querySelectorAll('.impact-metrics-section');
    const metricsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          metricsObserver.unobserve(entry.target);
          
          // Counter 1: Transacciones (0 to 4.5M)
          const transObj = { val: 0 };
          animate(transObj, {
            val: 4.5,
            duration: 2200,
            ease: 'outExpo',
            update: () => {
              if (metricTransRef.current) {
                metricTransRef.current.textContent = `+${transObj.val.toFixed(1)}M`;
              }
            }
          });

          // Counter 2: Horas (0 to 12000)
          const hoursObj = { val: 0 };
          animate(hoursObj, {
            val: 12000,
            duration: 2200,
            ease: 'outExpo',
            update: () => {
              if (metricHoursRef.current) {
                metricHoursRef.current.textContent = `+${Math.round(hoursObj.val).toLocaleString('es-VE')}h`;
              }
            }
          });

          // Counter 3: Precisión (9000 to 9998)
          const precisionObj = { val: 90.00 };
          animate(precisionObj, {
            val: 99.98,
            duration: 2200,
            ease: 'outExpo',
            update: () => {
              if (metricPrecisionRef.current) {
                metricPrecisionRef.current.textContent = `${precisionObj.val.toFixed(2)}%`;
              }
            }
          });

          // Counter 4: Soporte (60 to 5)
          const supportObj = { val: 60 };
          animate(supportObj, {
            val: 5,
            duration: 1800,
            ease: 'outExpo',
            update: () => {
              if (metricSupportRef.current) {
                metricSupportRef.current.textContent = `<${Math.round(supportObj.val)} min`;
              }
            }
          });
        }
      });
    }, { threshold: 0.15 });
    metricsSections.forEach(el => metricsObserver.observe(el));

    // Animación de tarjetas de configurador, contacto y nuevas secciones
    const customFadeInElements = document.querySelectorAll('.configurator-card, .dev-contact-card, .rubro-section, .playground-section');
    const customFadeObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animate(entry.target, { translateY: [40, 0], opacity: [0, 1], duration: 750, ease: 'outBack' });
          customFadeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    customFadeInElements.forEach(el => customFadeObserver.observe(el));

    // Crear partículas flotantes en el fondo para estética premium (solo si no hay preferencia de movimiento reducido)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
    }

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

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactPhone || !contactMsg) {
      alert('Por favor, rellene los campos requeridos (Nombre de Comercio, Teléfono y Mensaje).');
      return;
    }
    const baseText = `Hola, me interesa StockMasterPro para mi comercio *${contactName}* en *${contactCity || 'Venezuela'}*.\n\n*Mensaje:* ${contactMsg}\n\n*Contacto:* ${contactPhone}`;
    const encodedText = encodeURIComponent(baseText);
    
    if (contactChannel === 'whatsapp') {
      window.open(`https://wa.me/584269400924?text=${encodedText}`, '_blank');
    } else {
      try {
        navigator.clipboard.writeText(baseText);
      } catch (err) {
        console.error('Error al copiar al portapapeles:', err);
      }
      window.open('https://t.me/+584269400924', '_blank');
    }
    setFormSubmitted(true);
    setTimeout(() => {
      setContactName('');
      setContactCity('');
      setContactPhone('');
      setContactMsg('');
      setFormSubmitted(false);
    }, 4000);
  };

  // Lógica del Simulador Interactivo (Offline, Impresora y Escáner)
  const handleAddToOfflineCart = (product: { name: string; price: number }) => {
    setOfflineCart(prev => {
      const existing = prev.find(item => item.name === product.name);
      if (existing) {
        return prev.map(item => item.name === product.name ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const handleRegisterOfflineSale = () => {
    if (offlineCart.length === 0) return;
    if (!isOnline) {
      setOfflineSyncQueue(prev => prev + 1);
      alert('Venta encolada localmente. Guardado de forma encriptada en la base de datos local (Modo Offline).');
    } else {
      alert('Venta procesada con éxito y subida a la nube al instante.');
    }
    setOfflineCart([]);
  };

  const handleSyncOfflineSales = () => {
    if (offlineSyncQueue === 0 || !isOnline) return;
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setOfflineSyncQueue(0);
      alert('¡Sincronización Exitosa! Todas las ventas locales se subieron a la nube y el stock central se actualizó.');
    }, 1800);
  };

  const handleSimulatePrint = () => {
    setIsPrinting(true);
    setPrintSuccess(false);
    setTimeout(() => {
      setIsPrinting(false);
      setPrintSuccess(true);
    }, 1500);
  };

  const handleSimulateScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      const mockProducts = [
        { name: 'Café Fama de América 250g', barcode: '759100110099', price: 1.8, stock: 15 },
        { name: 'Harina PAN Mezcla Maíz 1kg', barcode: '759100110023', price: 1.3, stock: 32 },
        { name: 'Leche Completa Campestre 1L', barcode: '759100110100', price: 2.1, stock: 9 },
        { name: 'Salsa de Tomate Pampero 397g', barcode: '759100110185', price: 1.5, stock: 14 }
      ];
      const randomProd = mockProducts[Math.floor(Math.random() * mockProducts.length)];
      setScannedItems(prev => {
        const existing = prev.find(item => item.barcode === randomProd.barcode);
        if (existing) {
          return prev.map(item => item.barcode === randomProd.barcode ? { ...item, stock: item.stock + 1 } : item);
        }
        return [randomProd, ...prev];
      });
    }, 1500);
  };

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-main)',
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
        padding: isMobile ? '12px 16px' : '16px 5%',
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

        {!isMobile ? (
          <>
            <nav style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '13px', fontWeight: 700 }} aria-label="Navegación de página de inicio">
              <a href="#features" className="nav-link-landing" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onClick={(e) => { e.preventDefault(); document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' }); }}>Características</a>
              <a href="#demo" className="nav-link-landing" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onClick={(e) => { e.preventDefault(); document.querySelector('#demo')?.scrollIntoView({ behavior: 'smooth' }); }}>Tour Interactivo</a>
              <a href="#pricing" className="nav-link-landing" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onClick={(e) => { e.preventDefault(); document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>Roles de Cuenta</a>
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
          </>
        ) : (
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input, rgba(255,255,255,0.05))'
            }}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        )}

        {isMobile && mobileMenuOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-header, rgba(10, 10, 12, 0.95))',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border-color)',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            zIndex: 99,
            boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
          }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', fontWeight: 700 }}>
              <a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' }); }}>Características</a>
              <a href="#demo" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); document.querySelector('#demo')?.scrollIntoView({ behavior: 'smooth' }); }}>Tour Interactivo</a>
              <a href="#pricing" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>Roles de Cuenta</a>
            </nav>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <button 
                onClick={() => { setMobileMenuOpen(false); onEnterLogin(); }}
                className="btn-pill-dark"
                style={{ 
                  width: '100%',
                  padding: '12px', 
                  borderRadius: 'var(--button-radius)', 
                  fontSize: '13px', 
                  fontWeight: 800, 
                  backgroundColor: 'var(--bg-input, rgba(255,255,255,0.05))',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Acceder al POS
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); onEnterRegister(); }}
                className="btn-yellow"
                style={{ 
                  width: '100%',
                  padding: '12px', 
                  borderRadius: 'var(--button-radius)', 
                  fontSize: '13px', 
                  fontWeight: 800, 
                  backgroundColor: 'var(--brand-primary)', 
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px var(--brand-primary-light)',
                  textAlign: 'center'
                }}
              >
                Registrarse
              </button>
            </div>
          </div>
        )}
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
          <span>Facturación Activa con o sin Internet</span>
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
          Diseñado para el comercio moderno de Venezuela. Facture al instante aunque no tenga internet, maneje ventas en dólares y bolívares con tasa oficial integrada, controle la seguridad de su caja y registre compras con una foto.
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
            boxShadow: 'none',
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
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '180px 1fr', gap: '16px', minHeight: '300px', textAlign: 'left' }}>
            {/* Barra lateral */}
            <div style={{ 
              display: 'flex', 
              flexDirection: isMobile ? 'row' : 'column', 
              gap: '6px', 
              borderRight: isMobile ? 'none' : '1px solid var(--border-color)', 
              borderBottom: isMobile ? '1px solid var(--border-color)' : 'none',
              paddingRight: isMobile ? '0' : '12px', 
              paddingBottom: isMobile ? '12px' : '0',
              overflowX: isMobile ? 'auto' : 'visible',
              whiteSpace: 'nowrap',
              width: '100%',
              fontSize: '11.5px'
            }}>
              {/* Logo en barra lateral (mockup style matching actual sidebar header) */}
              {!isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px 12px 8px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 900 }}>S</div>
                  <span style={{ fontWeight: 800, fontSize: '12.5px', color: 'var(--text-primary)', letterSpacing: '0.3px' }}>StockMaster</span>
                </div>
              )}
              
              {[
                { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard },
                { id: 'pos', label: 'Ventas POS', icon: ShoppingCart },
                { id: 'inventario', label: 'Inventario', icon: Package },
                { id: 'compras', label: 'Compras', icon: Layers },
                { id: 'cierre', label: 'Arqueo de Caja', icon: Lock },
                { id: 'analiticas', label: 'Reportes', icon: BarChart3 },
                { id: 'settings', label: 'Configuración', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = item.id === 'dashboard'; // Resumen is active in mockup
                return (
                  <div 
                    key={item.id}
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      backgroundColor: isActive ? 'var(--brand-primary-light)' : 'transparent', 
                      color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)', 
                      fontWeight: isActive ? 800 : 600, 
                      fontSize: '11.5px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      flexShrink: 0,
                      cursor: 'default'
                    }}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Pantalla Principal del Mockup */}
            <div className="mockup-content-element" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Header de la App (mockup style matching actual Header.tsx) */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid var(--border-color)', 
                paddingBottom: '10px',
                marginBottom: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Resumen</span>
                </div>
                
                {/* Search & Actions block */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Search Mockup (clean input) */}
                  {!isMobile && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search size={11} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
                      <input 
                        type="text" 
                        readOnly 
                        placeholder="Buscar..." 
                        style={{ 
                          padding: '4px 8px 4px 24px', 
                          fontSize: '10px', 
                          borderRadius: '6px', 
                          border: '1px solid var(--border-color)', 
                          backgroundColor: 'var(--bg-input)', 
                          width: '120px',
                          color: 'var(--text-muted)',
                          outline: 'none'
                        }} 
                      />
                    </div>
                  )}
                  {/* Tasa cambiaria pill */}
                  <span style={{ 
                    fontSize: '10.5px', 
                    color: 'var(--brand-gold, #d97706)', 
                    backgroundColor: 'rgba(217,119,6,0.08)', 
                    border: '1px solid rgba(217,119,6,0.2)',
                    padding: '2px 8px', 
                    borderRadius: '50px', 
                    fontWeight: 700 
                  }}>
                    Bs. {dolarRate.toFixed(2)}
                  </span>
                  {/* Wifi Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#22c55e', fontWeight: 700 }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                    <span>ONLINE</span>
                  </div>
                  {/* User Profile Circle */}
                  <div style={{ 
                    width: '22px', 
                    height: '22px', 
                    borderRadius: '50%', 
                    backgroundColor: 'var(--brand-primary-light)', 
                    color: 'var(--brand-primary)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 800
                  }}>
                    A
                  </div>
                </div>
              </div>

              {/* Welcome Section */}
              <div style={{ margin: '2px 0 6px 0' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Hola, Admin</h2>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Este es el estado de su comercio para el día de hoy.</span>
              </div>

              {/* Fila de Tarjetas Overview (OverviewCards Mockup matching notches) */}
              <div className="overview-row" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                {/* Card 1: Balance de Caja */}
                <div className="overview-card-wrapper">
                  <div className="overview-card card-bg-teal has-right-notch" style={{ height: '85px', padding: '12px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div className="card-title" style={{ fontSize: '10.5px', color: '#121214', margin: 0, fontWeight: 800 }}>Balance de Caja</div>
                    <div className="card-value" style={{ fontSize: '20px', color: '#121214', fontWeight: 900, margin: 0 }}>$1,240.50</div>
                    <div className="card-link" style={{ fontSize: '9px', color: '#121214', opacity: 0.8, fontWeight: 700 }}>Total ingresos reales</div>
                  </div>
                </div>
                
                {/* Connector 1 */}
                <div className="card-connector-gap" style={{ width: '14px' }}>
                  <div className="card-connector-bridge" style={{ backgroundColor: 'var(--border-active, var(--brand-primary))' }}></div>
                </div>
                
                {/* Card 2: Transacciones */}
                <div className="overview-card-wrapper">
                  <div className="overview-card card-bg-orange has-left-notch has-right-notch" style={{ height: '85px', padding: '12px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div className="card-title" style={{ fontSize: '10.5px', color: '#121214', margin: 0, fontWeight: 800 }}>Transacciones POS</div>
                    <div className="card-value" style={{ fontSize: '20px', color: '#121214', fontWeight: 900, margin: 0 }}>80</div>
                    <div className="card-link" style={{ fontSize: '9px', color: '#121214', opacity: 0.8, fontWeight: 700 }}>Ver historial de caja</div>
                  </div>
                </div>
                
                {/* Connector 2 */}
                <div className="card-connector-gap" style={{ width: '14px' }}>
                  <div className="card-connector-bridge" style={{ backgroundColor: 'var(--border-active, var(--brand-primary))' }}></div>
                </div>
                
                {/* Card 3: Catálogo */}
                <div className="overview-card-wrapper">
                  <div className="overview-card card-bg-purple has-left-notch" style={{ height: '85px', padding: '12px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div className="card-title" style={{ fontSize: '10.5px', color: '#121214', margin: 0, fontWeight: 800 }}>Catálogo Productos</div>
                    <div className="card-value" style={{ fontSize: '20px', color: '#121214', fontWeight: 900, margin: 0 }}>350</div>
                    <div className="card-link" style={{ fontSize: '9px', color: '#121214', opacity: 0.8, fontWeight: 700 }}>Ver catálogo completo</div>
                  </div>
                </div>
              </div>

              {/* Bitácora de Auditoría (mockup style matching actual Auditoria.tsx) */}
              <div className="widget" style={{ padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert size={12} style={{ color: 'var(--brand-primary)' }} />
                  Últimos Eventos de Auditoría (Sistema Seguro)
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)' }} />
                      <strong>Venta Registrada</strong>: Ticket #TK-9801 por $15.50 (VES Mixto)
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Hace 1 min</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--brand-gold, #fbbf24)' }} />
                      <strong>Ajuste de Stock</strong>: "Refresco Chinotto" (+10 unidades escaneadas)
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Hace 3 min</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                      <strong>Sincronización Cloud</strong>: 3 transacciones locales encoladas subidas
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '9.5px' }}>Hace 5 min</span>
                  </div>
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
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0' }}>Ventas sin Internet</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Siga vendiendo y cobrando incluso si se cae la conexión. Sus datos se guardan de forma segura en el equipo local y se sincronizan solos con la nube en cuanto regresa el internet, sin interrumpir su trabajo.
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
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0' }}>Multimoneda Inteligente</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Cobre en dólares o bolívares de forma sencilla. El sistema calcula automáticamente la tasa oficial del día, realiza conversiones al instante y le indica el vuelto exacto, evitando errores de caja.
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
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0' }}>Registro de Compras con Foto</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Suba una foto o archivo de la factura de su proveedor. El sistema leerá automáticamente los productos, cantidades y precios para actualizar su inventario y costos, ahorrándole horas de transcripción manual.
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
              <h4 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px 0' }}>Seguridad y Control de Caja</h4>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Mantenga su negocio protegido de pérdidas y descuidos. El sistema registra cada acción clave de su personal (ventas, arqueos de caja y anulaciones) con fecha, hora y usuario responsable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN DE CASOS DE USO POR RUBRO ── */}
      <section className="rubro-section" style={{
        padding: '80px 5% 40px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '1200px',
        margin: '0 auto',
        opacity: 0
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Adaptabilidad Comercial
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 10px 0' }}>El POS Diseñado para su Rubro</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            StockMasterPro se amolda a las exigencias operativas y financieras de su tipo de negocio.
          </p>
        </div>

        {/* Tabs de Rubros */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '35px',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'bodegon', label: 'El Bodegón', icon: Store },
            { id: 'panaderia', label: 'La Panadería', icon: ShoppingBag },
            { id: 'supermercado', label: 'El Supermercado', icon: Users }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeRubro === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveRubro(tab.id as any);
                  animate('.rubro-content-card', { opacity: [0.4, 1], scale: [0.98, 1], duration: 400, ease: 'outQuad' });
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '30px',
                  border: isActive ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                  backgroundColor: isActive ? 'var(--brand-primary-light)' : 'var(--bg-card)',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Contenido Dinámico de Rubros */}
        <div className="rubro-content-card" style={{
          borderRadius: 'var(--card-radius)',
          border: '1.5px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--card-shadow)',
          padding: '30px 24px',
          display: 'grid',
          gridTemplateColumns: windowWidth < 768 ? '1fr' : '1fr 1fr',
          gap: '30px',
          alignItems: 'center'
        }}>
          {/* Columna Izquierda: Información */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase' }}>
              {activeRubro === 'bodegon' ? 'Venta mixta e importaciones' : activeRubro === 'panaderia' ? 'Producción y turnos' : 'Ventas en red y escala'}
            </span>
            <h3 style={{ fontSize: '22px', fontWeight: 900, margin: 0 }}>
              {activeRubro === 'bodegon' && 'Control Total de Divisas y Licores'}
              {activeRubro === 'panaderia' && 'Gestión de Materia Prima y Caja'}
              {activeRubro === 'supermercado' && 'Facturación en Red de Alto Volumen'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {activeRubro === 'bodegon' && 'Diseñado para los bodegones venezolanos. Gestione precios en dólares, registre el cobro mixto (Zelle, Pago Móvil, Efectivo) calculando vueltos exactos en bolívares. Monitoree las marcas de licor más valiosas y reciba alertas antes de que se agoten.'}
              {activeRubro === 'panaderia' && 'Optimizado para panaderías y reposterías. Lleve la cuenta de insumos (sacos de harina, azúcar), controle las mermas de productos horneados y gestione arqueos por turnos de cajeros de manera exacta.'}
              {activeRubro === 'supermercado' && 'Preparado para el flujo masivo. Sincronice inventarios entre múltiples cajas registradoras operando en red. Permite el cobro de cientos de artículos al día por cajero con lector de código de barras a máxima velocidad.'}
            </p>

            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeRubro === 'bodegon' && (
                <>
                  <li><strong>Cobro Multidivisa:</strong> Entrada directa de Zelle e IGTF 3% automatizada.</li>
                  <li><strong>Alertas de Licores:</strong> Notificación inmediata de licores caros con bajo stock.</li>
                  <li><strong>Precios Anclados:</strong> Ajuste de precios masivos en Bs según tasa BCV en 1 clic.</li>
                </>
              )}
              {activeRubro === 'panaderia' && (
                <>
                  <li><strong>Control de Materia Prima:</strong> Descuento automático de sacos e insumos.</li>
                  <li><strong>Arqueos por Turnos:</strong> Cierre de caja por cajero (mañana/tarde/noche) sin descuadres.</li>
                  <li><strong>Ventas Rápidas:</strong> Atajos en teclado para panes de alta rotación (canilla, salado).</li>
                </>
              )}
              {activeRubro === 'supermercado' && (
                <>
                  <li><strong>Red Sincronizada:</strong> Múltiples cajas conectadas a la base de datos central.</li>
                  <li><strong>Lector Láser Optimizado:</strong> Cobro en menos de 2 segundos por cliente.</li>
                  <li><strong>Auditoría de Cajeros:</strong> Registro de anulaciones y retiros parciales de efectivo.</li>
                </>
              )}
            </ul>
          </div>

          {/* Columna Derecha: Dashboard Simulado */}
          <div style={{
            backgroundColor: 'var(--bg-input)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '20px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                {activeRubro === 'bodegon' && 'Resumen Bodegón'}
                {activeRubro === 'panaderia' && 'Control Panadería'}
                {activeRubro === 'supermercado' && 'Panel Cajas en Red'}
              </span>
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--brand-primary-light)', color: 'var(--brand-primary)', fontWeight: 800 }}>En Vivo</span>
            </div>

            {activeRubro === 'bodegon' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Caja Dólares</span>
                    <strong style={{ display: 'block', fontSize: '15px', color: 'var(--brand-primary)' }}>$1,240.00</strong>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Caja Bolívares</span>
                    <strong style={{ display: 'block', fontSize: '15px', color: 'var(--text-primary)' }}>Bs 45,210</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)' }}>Licores Críticos (Bajo Stock)</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                    <span>Ron Santa Teresa 1796</span>
                    <strong style={{ color: '#ef4444' }}>2 und (Min: 5)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span>Whisky Old Parr 12 años</span>
                    <strong style={{ color: '#ef4444' }}>3 und (Min: 6)</strong>
                  </div>
                </div>
              </div>
            )}

            {activeRubro === 'panaderia' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Consumo de Materia Prima</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                        <span>Harina de Trigo Industrial</span>
                        <strong>18 / 25 Sacos</strong>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '72%', backgroundColor: 'var(--brand-primary)' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                        <span>Azúcar Refinada</span>
                        <strong>4 / 10 Sacos</strong>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '40%', backgroundColor: 'var(--brand-gold)' }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '6px 0' }}>
                  <span>Cajero Turno Tarde:</span>
                  <strong>Caja Cerrada y Cuadrada</strong>
                </div>
              </div>
            )}

            {activeRubro === 'supermercado' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-primary)' }}>Terminales Conectadas</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px' }}>Caja Principal #1 (Norelys)</span>
                    <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 800 }}>Activa • $420.50</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px' }}>Caja Pasillo #2 (Carlos)</span>
                    <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 800 }}>Activa • $280.10</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '11px' }}>Caja Rápida #3 (María)</span>
                    <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 800 }}>Activa • $510.40</span>
                  </div>
                </div>
              </div>
            )}
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
                  <strong style={{ fontSize: '12.5px', display: 'block', color: activeTab === 'seguridad' ? 'var(--brand-primary)' : 'var(--text-primary)' }}>Seguridad y Control</strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Historial detallado de todas las actividades y cambios de stock.</span>
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
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                  <span style={{ fontSize: '11.5px', fontWeight: 700 }}>Arroz Blanco 1kg — Stock: 3 units (Min: 20)</span>
                </div>
              </div>
            )}

            {activeTab === 'seguridad' && (
              <div className="mockup-content-element" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)' }}>VISTA DE SEGURIDAD</span>
                <h4 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Historial de Actividades Claro</h4>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Supervise cada detalle operativo de su establecimiento. El sistema registra qué usuario realizó cada cambio de inventario o arqueo, el valor anterior y el nuevo valor, ayudándole a prevenir pérdidas y mantener cuentas claras.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-input)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>Usuario:</span>
                    <span>cajero@stockmaster</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>Acción:</span>
                    <span>Actualización de Inventario</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, color: 'var(--brand-primary)' }}>Detalle:</span>
                    <span>Arroz Blanco (Cambió de 150 a 145 unidades)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SECCIÓN DE MÉTRICAS DE IMPACTO (STATS) ── */}
      <section style={{
        padding: '60px 5% 40px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Rendimiento Comprobado
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 10px 0' }}>El POS que Impulsa su Crecimiento</h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: windowWidth < 768 ? '1fr' : 'repeat(3, 1fr)',
          gap: '24px'
        }}>
          {/* Stat 1 */}
          <div className="widget stat-card" style={{
            padding: '30px 24px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            opacity: 0,
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
              <TrendingUp size={24} />
            </div>
            <span style={{
              fontSize: '40px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, var(--brand-primary), var(--accent-yellow, #fbbf24))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              99.9%
            </span>
            <strong style={{ fontSize: '15px', fontWeight: 800 }}>Disponibilidad Total</strong>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Su negocio sigue facturando y cobrando de forma local incluso si se interrumpe el servicio de internet.
            </p>
          </div>

          {/* Stat 2 */}
          <div className="widget stat-card" style={{
            padding: '30px 24px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            opacity: 0,
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(251, 191, 36, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-gold)' }}>
              <Clock size={24} />
            </div>
            <span style={{
              fontSize: '40px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, var(--brand-gold), #f59e0b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              &lt; 3s
            </span>
            <strong style={{ fontSize: '15px', fontWeight: 800 }}>Cobro Ultra Rápido</strong>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Procese compras y genere tickets en segundos con teclado táctil optimizado, eliminando colas en horas pico.
            </p>
          </div>

          {/* Stat 3 */}
          <div className="widget stat-card" style={{
            padding: '30px 24px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            opacity: 0,
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <Percent size={24} />
            </div>
            <span style={{
              fontSize: '40px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              0%
            </span>
            <strong style={{ fontSize: '15px', fontWeight: 800 }}>Diferencias de Caja</strong>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Conversión automática a tasa oficial para pagos mixtos en divisas y bolívares con arqueo exacto.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN DE TESTIMONIOS ── */}
      <section style={{
        padding: '40px 5% 60px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Opiniones Reales
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 16px 0' }}>Comercios que Confían en Nosotros</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Vea cómo dueños de negocios locales en toda Venezuela han simplificado sus operaciones diarias.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: windowWidth < 768 ? '1fr' : 'repeat(3, 1fr)',
          gap: '24px'
        }}>
          {/* Testimonio 1 */}
          <div className="widget testimonial-card" style={{
            padding: '28px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            justifyContent: 'space-between',
            opacity: 0,
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ display: 'flex', gap: '4px', color: 'var(--brand-gold)' }}>
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
              "El principal problema en nuestra panadería era que cuando se iba la luz o el internet de Cantv, no podíamos cobrar y los clientes se iban. Con StockMasterPro seguimos facturando en bolívares y dólares sin internet, y cuando vuelve la señal todo se sincroniza solo."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--brand-primary-light)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '14px'
              }}>
                A
              </div>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '13px', display: 'block' }}>Alejandro G.</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dueño de Panificadora El Sol, Valencia</span>
              </div>
            </div>
          </div>

          {/* Testimonio 2 */}
          <div className="widget testimonial-card" style={{
            padding: '28px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            justifyContent: 'space-between',
            opacity: 0,
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ display: 'flex', gap: '4px', color: 'var(--brand-gold)' }}>
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
              "La función de tomarle foto a las facturas de los proveedores y que cargue los costos e inventario sola nos ha ahorrado el 90% del trabajo de oficina. Además, el control de arqueo dual en bolívares y dólares evita cualquier descuadre de caja al final del día."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                color: 'var(--brand-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '14px'
              }}>
                M
              </div>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '13px', display: 'block' }}>María C.</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Gerente de FarmaExpress, Caracas</span>
              </div>
            </div>
          </div>

          {/* Testimonio 3 */}
          <div className="widget testimonial-card" style={{
            padding: '28px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            justifyContent: 'space-between',
            opacity: 0,
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ display: 'flex', gap: '4px', color: 'var(--brand-gold)' }}>
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
              "Me encanta poder personalizar los colores y redondeado del POS para que combine con la estética de mi tienda de ropa. Es sumamente veloz y el historial de seguridad nos deja ver cada cambio de stock o arqueo realizado por los empleados con total transparencia."
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '14px'
              }}>
                R
              </div>
              <div style={{ textAlign: 'left' }}>
                <strong style={{ fontSize: '13px', display: 'block' }}>Ricardo M.</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dueño de Modas Trend, Maracaibo</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── REJILLA DE MÓDULOS ESPECIALIZADOS ── */}
      <section style={{
        padding: '60px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Módulos del Sistema
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 10px 0' }}>Todo lo que Necesita, en un Solo Lugar</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Desde el control de personal hasta la auditoría de cada movimiento. Módulos profesionales diseñados para el comercio venezolano.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: windowWidth < 600 ? '1fr' : windowWidth < 900 ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '20px'
        }}>
          {/* Módulo 1: Nómina y Comisiones */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--brand-primary-light), rgba(14,165,164,0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
              <Users size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Nómina y Comisiones</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Controle los horarios y ventas individuales de cada cajero. Liquide comisiones e incentivos de forma automática basándose en metas alcanzadas.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Turnos</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Metas</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Liquidación</span>
            </div>
          </div>

          {/* Módulo 2: Crédito y Cuentas por Cobrar */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = 'var(--brand-gold)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,191,36,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-gold)' }}>
              <CreditCard size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Crédito y Cuentas por Cobrar</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Registre clientes con saldos pendientes. Gestione abonos parciales en bolívares o dólares y consulte el historial completo de cobros al instante.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Saldos</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Abonos</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Historial</span>
            </div>
          </div>

          {/* Módulo 3: Caja y Cierres Blindados */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#22c55e';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
              <Layers size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Caja y Cierres Blindados</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Soporte para Pago Móvil, Zelle, transferencias y efectivo. Arqueos automáticos por turno que cuadran en ambas divisas sin margen de error.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Pago Móvil</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Zelle</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Arqueo</span>
            </div>
          </div>

          {/* Módulo 4: Auditoría de Acciones */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#a855f7';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(168,85,247,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
              <Lock size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Auditoría de Acciones</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Historial detallado de todas las operaciones del negocio. Sepa quién hizo cada cambio de stock, venta anulada o arqueo de caja, con fecha y hora exacta.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Registro</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Trazabilidad</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Seguridad</span>
            </div>
          </div>

          {/* Módulo 5: Compras y Reposición de Inventario */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#f97316';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(249,115,22,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316' }}>
              <ShoppingBag size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Compras y Reposición</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Registre órdenes de compra manualmente o escanee facturas con OCR inteligente. Controle costos, lotes y fechas de vencimiento automáticamente.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>OCR</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Lotes</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Costos</span>
            </div>
          </div>

          {/* Módulo 6: Proveedores y Cuentas por Pagar */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#06b6d4';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(6,182,212,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4' }}>
              <Truck size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Proveedores y CxP</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Directorio completo de proveedores con RIF, crédito y plazos de pago. Gestione cuentas por pagar, abonos parciales e historial de pagos por proveedor.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>RIF</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Crédito</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>CxP</span>
            </div>
          </div>

          {/* Módulo 7: Analíticas Avanzadas */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#ec4899';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(236,72,153,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
              <BarChart3 size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Analíticas Avanzadas</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Dashboards inteligentes con gráficos de ventas, márgenes de ganancia, productos top, horarios pico y comparativas de rendimiento por períodos.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>KPIs</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Gráficos</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Rentabilidad</span>
            </div>
          </div>

          {/* Módulo 8: Personalización del Tema */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#8b5cf6';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
              <Settings size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Personalización Visual</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Cambie colores, modo oscuro/claro, tipografías y bordes del sistema. Adapte la interfaz a la identidad de su marca comercial.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Temas</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Colores</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Marca</span>
            </div>
          </div>

          {/* Módulo 9: Calculadora de Tasa Cambiaria */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'pointer'
            }}
            onClick={() => setIsCalculatorOpen(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <Calculator size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Calculadora Cambiaria</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Herramienta flotante para convertir montos Bs ↔ USD al instante usando la tasa BCV oficial o personalizada. Ideal para cotizar rápido a clientes.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>BCV</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Bs ↔ $</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Flotante</span>
            </div>
          </div>

          {/* Módulo 10: Atajos de Teclado para Cajeros */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'pointer'
            }}
            onClick={() => setIsShortcutsOpen(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#f59e0b';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <Command size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Atajos de Teclado</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Teclas de acceso rápido (F1 buscar, F2 cobrar, F3 imprimir) para que el cajero facture en segundos sin tocar el mouse.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>F1–F12</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Velocidad</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Sin Mouse</span>
            </div>
          </div>

          {/* Módulo 11: Actualizador Automático */}
          <div
            className="widget module-card"
            style={{
              padding: '28px 22px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              opacity: 0,
              transition: 'transform 0.3s, border-color 0.3s, box-shadow 0.3s',
              cursor: 'pointer'
            }}
            onClick={() => setIsUpdaterOpen(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#0ea5e9';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(14,165,233,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0ea5e9' }}>
              <Download size={22} />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 8px 0' }}>Actualizador Inteligente</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Descarga e instala nuevas versiones del POS de forma segura sin borrar datos locales. Actualizaciones silenciosas que no interrumpen la operación.
              </p>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>OTA</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Sin Pérdida</span>
              <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Silencioso</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── VITRINA INTERACTIVA PASO A PASO ── */}
      <section className="showcase-section" style={{
        padding: '60px 5%',
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        zIndex: 2,
        position: 'relative',
        opacity: 0,
        transition: 'background-color 0.3s, border-color 0.3s'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Flujo de Trabajo Diario
            </span>
            <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 10px 0' }}>Así Funciona su Día a Día con el POS</h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              Tres pasos simples para llevar el control completo de su negocio, desde la primera venta del día hasta el cierre de caja.
            </p>
          </div>

          {/* Tabs de navegación */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: isMobile ? '8px' : '16px',
            marginBottom: '40px',
            flexWrap: 'wrap'
          }}>
            {[
              { key: 'venta' as const, label: 'Registro Rápido', icon: <Play size={14} />, step: '01' },
              { key: 'cierre' as const, label: 'Cierre de Turno', icon: <Layers size={14} />, step: '02' },
              { key: 'analisis' as const, label: 'Análisis y Reportes', icon: <BarChart3 size={14} />, step: '03' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveShowcaseTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: isMobile ? '10px 16px' : '12px 24px',
                  borderRadius: 'var(--button-radius)',
                  border: activeShowcaseTab === tab.key ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                  backgroundColor: activeShowcaseTab === tab.key ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                  color: activeShowcaseTab === tab.key ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  fontFamily: 'inherit',
                  transition: 'all 0.25s ease',
                  flex: isMobile ? '1 1 auto' : 'none',
                  justifyContent: 'center'
                }}
              >
                <span style={{
                  fontSize: '9px',
                  fontWeight: 900,
                  backgroundColor: activeShowcaseTab === tab.key ? 'var(--brand-primary)' : 'var(--bg-input)',
                  color: activeShowcaseTab === tab.key ? '#fff' : 'var(--text-muted)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.5px'
                }}>
                  {tab.step}
                </span>
                {tab.icon}
                {!isMobile && <span>{tab.label}</span>}
              </button>
            ))}
          </div>

          {/* Panel de contenido dinámico */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '32px',
            alignItems: 'center'
          }}>
            {/* Panel de texto descriptivo */}
            <div key={activeShowcaseTab} style={{ animation: 'fadeInUp 0.4s ease forwards' }}>
              {activeShowcaseTab === 'venta' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--brand-primary), var(--accent-yellow, #fbbf24))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Play size={16} color="#fff" />
                    </div>
                    <h3 style={{ fontSize: '22px', fontWeight: 900, margin: 0 }}>Registro Rápido de Venta</h3>
                  </div>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                    Busque el producto por nombre o código de barras, seleccione la cantidad e ingrese el pago. El POS calcula el vuelto exacto en ambas monedas al instante.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {['Buscar producto por nombre o escáner', 'Seleccionar método de pago (mixto o individual)', 'Emitir ticket o recibo digital en segundos'].map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: 'var(--brand-primary-light)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '10px', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeShowcaseTab === 'cierre' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #22c55e, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Layers size={16} color="#fff" />
                    </div>
                    <h3 style={{ fontSize: '22px', fontWeight: 900, margin: 0 }}>Cierre de Turno Blindado</h3>
                  </div>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                    Al finalizar el turno, el sistema genera un reporte automático de cuadratura que compara las ventas registradas contra el efectivo y los pagos electrónicos recibidos.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {['Conteo de efectivo en bolívares y dólares por separado', 'Verificación automática vs ventas del turno', 'Reporte de cierre firmado con nombre del cajero'].map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: 'rgba(34,197,94,0.12)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '10px', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeShowcaseTab === 'analisis' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #a855f7, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BarChart3 size={16} color="#fff" />
                    </div>
                    <h3 style={{ fontSize: '22px', fontWeight: 900, margin: 0 }}>Análisis y Reportes</h3>
                  </div>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>
                    Visualice el rendimiento de su negocio con gráficos claros. Exporte sus datos a Excel o PDF para llevar un control financiero profesional.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {['Gráficos de ventas diarias, semanales y mensuales', 'Ranking de productos más vendidos y rentables', 'Exportación a Excel y PDF con un solo clic'].map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '10px', flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Panel de simulación visual */}
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--card-shadow)',
              minHeight: '280px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '16px'
            }}>
              {activeShowcaseTab === 'venta' && (
                <div key="venta-sim" style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeInUp 0.4s ease forwards' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)' }}>TICKET DE VENTA</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>TKT-20451</span>
                  </div>
                  <div style={{ borderBottom: '1px dashed var(--border-color)', paddingBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[{ name: 'Harina PAN 1kg', qty: 3, price: '$1.80' }, { name: 'Aceite Mazeite 1L', qty: 1, price: '$3.50' }, { name: 'Azúcar Montalbán', qty: 2, price: '$1.25' }].map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                        <span>{item.name} <span style={{ color: 'var(--text-muted)' }}>x{item.qty}</span></span>
                        <span style={{ fontWeight: 800 }}>{item.price}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 900 }}>
                    <span>TOTAL</span>
                    <span style={{ color: 'var(--brand-primary)' }}>$11.30</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', backgroundColor: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>Pago: $15.00 USD</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>Vuelto: $3.70</span>
                  </div>
                </div>
              )}

              {activeShowcaseTab === 'cierre' && (
                <div key="cierre-sim" style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeInUp 0.4s ease forwards' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#22c55e' }}>REPORTE DE CIERRE</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>Turno: Mañana</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Ventas Totales', value: '$824.50', color: 'var(--brand-primary)' },
                      { label: 'Efectivo USD', value: '$512.00', color: 'var(--text-primary)' },
                      { label: 'Pago Móvil Bs', value: 'Bs. 12,656.25', color: 'var(--text-primary)' },
                      { label: 'Zelle / Transferencia', value: '$312.50', color: 'var(--text-primary)' }
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, paddingBottom: '8px', borderBottom: i < 3 ? '1px solid var(--border-color)' : 'none' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                        <span style={{ color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <Check size={16} color="#22c55e" strokeWidth={3} />
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#22c55e' }}>Caja Cuadrada — Diferencia: $0.00</span>
                  </div>
                </div>
              )}

              {activeShowcaseTab === 'analisis' && (
                <div key="analisis-sim" style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeInUp 0.4s ease forwards' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#a855f7' }}>RESUMEN SEMANAL</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>Jun 1–7, 2026</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {[
                      { label: 'Ventas Totales', value: '$4,820', icon: <TrendingUp size={14} />, color: 'var(--brand-primary)' },
                      { label: 'Margen Promedio', value: '24%', icon: <Percent size={14} />, color: '#22c55e' },
                      { label: 'Producto Estrella', value: 'Harina PAN', icon: <Star size={14} />, color: 'var(--brand-gold)' },
                      { label: 'Transacciones', value: '387', icon: <Activity size={14} />, color: '#a855f7' }
                    ].map((stat, i) => (
                      <div key={i} style={{ padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: stat.color }}>
                          {stat.icon}
                          <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{stat.label}</span>
                        </div>
                        <span style={{ fontSize: '16px', fontWeight: 900 }}>{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SIMULADOR DE ANALÍTICAS EN CSS (DASHBOARD CHART) ── */}
      <section className="chart-section" style={{
        padding: '60px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '1000px',
        margin: '0 auto',
        opacity: 0
      }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Panel de Analíticas
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 10px 0' }}>Visualice el Pulso de su Negocio</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Gráficos claros y estadísticas clave para tomar decisiones informadas y maximizar su rentabilidad.
          </p>
        </div>

        <div style={{
          borderRadius: 'var(--card-radius)',
          border: '1.5px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--card-shadow)',
          overflow: 'hidden',
          transition: 'border-color 0.3s'
        }}>
          {/* Header del dashboard */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BarChart3 size={18} style={{ color: 'var(--brand-primary)' }} />
              <span style={{ fontSize: '14px', fontWeight: 800 }}>Ventas de la Semana</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Esta Semana</span>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Mes</span>
            </div>
          </div>

          {/* Gráfico de barras CSS */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-around',
              height: isMobile ? '160px' : '200px',
              gap: isMobile ? '8px' : '16px',
              padding: '0 8px'
            }}>
              {[
                { day: 'Lun', height: '65%', value: '$620' },
                { day: 'Mar', height: '80%', value: '$780' },
                { day: 'Mié', height: '55%', value: '$520' },
                { day: 'Jue', height: '90%', value: '$880' },
                { day: 'Vie', height: '100%', value: '$1,040' },
                { day: 'Sáb', height: '75%', value: '$720' },
                { day: 'Dom', height: '35%', value: '$260' }
              ].map((bar, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-primary)' }}>{bar.value}</span>
                  <div
                    className="chart-bar"
                    style={{
                      width: '100%',
                      maxWidth: '52px',
                      height: bar.height,
                      borderRadius: '8px 8px 4px 4px',
                      background: i === 4
                        ? 'linear-gradient(180deg, var(--brand-primary), var(--accent-yellow, #fbbf24))'
                        : 'linear-gradient(180deg, var(--brand-primary), rgba(14,165,164,0.4))',
                      opacity: i === 4 ? 1 : 0.7,
                      transition: 'opacity 0.3s',
                      transformOrigin: 'bottom',
                      position: 'relative',
                      boxShadow: i === 4 ? '0 4px 16px var(--brand-primary-light)' : 'none'
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>{bar.day}</span>
                </div>
              ))}
            </div>

            {/* Stats panel debajo del gráfico */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: windowWidth < 600 ? '1fr' : 'repeat(3, 1fr)',
              gap: '16px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '20px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Margen de Ganancia Prom.</span>
                <span style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #22c55e, #10b981)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>24%</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Producto Estrella</span>
                <span style={{
                  fontSize: '18px',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, var(--brand-gold), #f59e0b)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>Harina PAN</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Semanal</span>
                <span style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, var(--brand-primary), var(--accent-yellow, #fbbf24))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>$4,820</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CENTRO DE SIMULACIÓN INTERACTIVA (PLAYGROUND) ── */}
      <section className="playground-section" style={{
        padding: '80px 5% 40px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '1200px',
        margin: '0 auto',
        opacity: 0
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Zona de Pruebas
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 10px 0' }}>Centro de Simulación Interactiva</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Pruebe el comportamiento del sistema ante caídas de internet, emisión de tickets y escaneo de inventario.
          </p>
        </div>

        {/* Tabs del Playground */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '35px',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'offline', label: 'Modo Offline (Apagón)', icon: WifiOff },
            { id: 'printer', label: 'Impresora Térmica', icon: QrCode },
            { id: 'scanner', label: 'Escáner Láser', icon: Camera }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activePlaygroundTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActivePlaygroundTab(tab.id as any);
                  animate('.playground-content-card', { opacity: [0.4, 1], scale: [0.98, 1], duration: 450, ease: 'outQuad' });
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '30px',
                  border: isActive ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                  backgroundColor: isActive ? 'var(--brand-primary-light)' : 'var(--bg-card)',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tarjeta Contenedora Principal */}
        <div className="playground-content-card" style={{
          borderRadius: 'var(--card-radius)',
          border: '1.5px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--card-shadow)',
          padding: '30px 24px',
          minHeight: '400px',
          display: 'grid',
          gridTemplateColumns: windowWidth < 768 ? '1fr' : '1.1fr 0.9fr',
          gap: '35px',
          transition: 'all 0.3s'
        }}>
          
          {/* VISTA A: SIMULADOR OFFLINE */}
          {activePlaygroundTab === 'offline' && (
            <>
              {/* Columna Izquierda: Panel de Venta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Terminal de Venta POS</h3>
                  <button
                    onClick={() => setIsOnline(!isOnline)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: 'none',
                      backgroundColor: isOnline ? '#22c55e' : '#ef4444',
                      color: 'white',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'white', display: 'inline-block', animation: 'statusPulse 1.5s infinite' }} />
                    {isOnline ? 'Internet: EN LÍNEA' : 'Internet: OFFLINE'}
                  </button>
                </div>

                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  {isOnline 
                    ? '🟢 El POS está enlazado a la nube. Cada transacción se registrará y sincronizará de forma instantánea.' 
                    : '🔴 Simulación de corte de luz o caída de internet en el local. El sistema seguirá facturando en local.'
                  }
                </p>

                {/* Grid de Productos */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Productos Rápidos</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {[
                      { name: 'Harina PAN 1kg', price: 1.3 },
                      { name: 'Malta Polar 355ml', price: 0.8 },
                      { name: 'Queso Blanco 1kg', price: 3.5 }
                    ].map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleAddToOfflineCart(p)}
                        style={{
                          padding: '12px 8px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'border-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                      >
                        <strong style={{ display: 'block', marginBottom: '4px' }}>{p.name}</strong>
                        <span style={{ color: 'var(--brand-primary)', fontSize: '10.5px' }}>${p.price.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Carrito */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Carrito de Compra</span>
                  {offlineCart.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Carrito vacío. Seleccione productos arriba.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {offlineCart.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span>{item.qty}x {item.name}</span>
                            <strong>${(item.price * item.qty).toFixed(2)}</strong>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '8px', fontSize: '13px', fontWeight: 800 }}>
                        <span>Total Venta:</span>
                        <span style={{ color: 'var(--brand-primary)' }}>
                          ${offlineCart.reduce((acc, curr) => acc + curr.price * curr.qty, 0).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                        <button
                          onClick={() => setOfflineCart([])}
                          style={{ flex: 0.4, padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Vaciar
                        </button>
                        <button
                          onClick={handleRegisterOfflineSale}
                          style={{ flex: 0.6, padding: '8px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--brand-primary)', color: 'white', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Registrar Venta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Servidor Cloud Sync */}
              <div style={{ 
                backgroundColor: 'var(--bg-input)', 
                padding: '24px', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '20px'
              }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 900, margin: '0 0 12px 0' }}>Estado del Servidor en la Nube</h4>
                  
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>Sincronización Cloud:</span>
                      <strong style={{ color: isOnline ? '#22c55e' : '#ef4444' }}>
                        {isOnline ? 'CONECTADO' : 'DESCONECTADO'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>Ventas en Cola Local:</span>
                      <strong style={{ color: offlineSyncQueue > 0 ? 'var(--brand-gold)' : 'var(--text-primary)' }}>
                        {offlineSyncQueue} {offlineSyncQueue === 1 ? 'venta' : 'ventas'}
                      </strong>
                    </div>
                    {offlineSyncQueue > 0 && (
                      <div className="offline-alert-pulse" style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '4px', backgroundColor: 'rgba(217, 119, 6, 0.1)', color: 'var(--brand-gold)', fontWeight: 800, textAlign: 'center' }}>
                        ⚠️ Datos guardados localmente. Esperando internet.
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Al reconectar el interruptor a "EN LÍNEA" y contar con conexión, podrá pulsar el botón inferior para subir las ventas acumuladas de inmediato al servidor en la nube sin duplicar stock ni perder datos.
                  </p>
                </div>

                <button
                  disabled={offlineSyncQueue === 0 || !isOnline || isSyncing}
                  onClick={handleSyncOfflineSales}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: (offlineSyncQueue > 0 && isOnline) ? 'var(--brand-primary)' : 'var(--border-color)',
                    color: (offlineSyncQueue > 0 && isOnline) ? 'white' : 'var(--text-muted)',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: (offlineSyncQueue > 0 && isOnline) ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  {isSyncing ? 'Subiendo datos...' : `Sincronizar Ventas Locales (${offlineSyncQueue})`}
                </button>
              </div>
            </>
          )}

          {/* VISTA B: IMPRESORA TÉRMICA */}
          {activePlaygroundTab === 'printer' && (
            <>
              {/* Columna Izquierda: Configuración de Impresión */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', justifyContent: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '10px' }}>Simulador de Facturación Física</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Configure un método de pago mixto típico de los comercios en Venezuela y emita un ticket de venta real.
                  </p>
                </div>

                {/* Métodos de Pago */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Método de Pago Simulador</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => { setPrinterPayment('mixto'); setPrintSuccess(false); }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: printerPayment === 'mixto' ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                        backgroundColor: printerPayment === 'mixto' ? 'var(--brand-primary-light)' : 'transparent',
                        color: printerPayment === 'mixto' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Pago Móvil + USD ($)
                    </button>
                    <button
                      onClick={() => { setPrinterPayment('zelle'); setPrintSuccess(false); }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: printerPayment === 'zelle' ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                        backgroundColor: printerPayment === 'zelle' ? 'var(--brand-primary-light)' : 'transparent',
                        color: printerPayment === 'zelle' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Zelle Completo ($)
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleSimulatePrint}
                  disabled={isPrinting}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--brand-primary)',
                    color: 'white',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
                >
                  {isPrinting ? 'Imprimiendo Factura...' : 'Emitir Ticket de Venta'}
                </button>
              </div>

              {/* Columna Derecha: Impresora CSS y Ticket */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'flex-start',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: 'rgba(0,0,0,0.1)',
                padding: '24px 12px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                minHeight: '350px'
              }}>
                {/* Ranura de la Impresora */}
                <div style={{
                  width: '90%',
                  height: '24px',
                  backgroundColor: '#374151',
                  border: '3px solid #1f2937',
                  borderRadius: '4px',
                  position: 'relative',
                  zIndex: 2,
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: '#111827',
                    position: 'absolute',
                    top: '8px'
                  }} />
                </div>

                {/* Ticket de Papel Termosensible */}
                {(isPrinting || printSuccess) && (
                  <div className="receipt-paper" style={{
                    width: '85%',
                    marginTop: '-10px',
                    transformOrigin: 'top center',
                    animation: 'fadeInUp 0.6s ease forwards',
                    zIndex: 1
                  }}>
                    <div style={{ textAlign: 'center', borderBottom: '1px dashed #9ca3af', paddingBottom: '8px', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '12px', display: 'block', textTransform: 'uppercase' }}>STOCKMASTERPRO POS</strong>
                      <span style={{ fontSize: '9px', color: '#4b5563' }}>Rif: J-12345678-9</span>
                      <span style={{ fontSize: '9px', display: 'block', color: '#4b5563' }}>Caracas, Venezuela</span>
                    </div>

                    <div style={{ fontSize: '10px', borderBottom: '1px dashed #9ca3af', paddingBottom: '8px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span>Fecha: 05/06/2026 14:55</span>
                      <span>Factura Nro: 0002931</span>
                      <span>Cliente: Genérico</span>
                    </div>

                    {/* Items */}
                    <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px dashed #9ca3af', paddingBottom: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>2x Harina PAN 1kg</span>
                        <span>$2.60</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>1x Café Fama 250g</span>
                        <span>$1.80</span>
                      </div>
                      {printerPayment === 'mixto' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>1x Malta Polar 355ml</span>
                          <span>$0.80</span>
                        </div>
                      )}
                    </div>

                    {/* Totales */}
                    <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '3px', borderBottom: '1px dashed #9ca3af', paddingBottom: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>SUBTOTAL:</span>
                        <span>{printerPayment === 'mixto' ? '$5.20' : '$4.40'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>IGTF (3%):</span>
                        <span>{printerPayment === 'mixto' ? '$0.16' : '$0.13'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>TOTAL USD ($):</span>
                        <span>{printerPayment === 'mixto' ? '$5.36' : '$4.53'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151', fontSize: '9px', fontStyle: 'italic' }}>
                        <span>Tasa BCV del Día:</span>
                        <span>Bs 45.00 / USD</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', borderTop: '1px solid #111827', paddingTop: '4px' }}>
                        <span>TOTAL BS (Bs):</span>
                        <span>{printerPayment === 'mixto' ? 'Bs 241.20' : 'Bs 203.85'}</span>
                      </div>
                    </div>

                    {/* Desglose de Pago */}
                    <div style={{ fontSize: '9px', color: '#4b5563', borderBottom: '1px dashed #9ca3af', paddingBottom: '6px', marginBottom: '8px' }}>
                      <strong style={{ display: 'block', fontSize: '9.5px', color: '#111827', marginBottom: '3px' }}>FORMA DE PAGO:</strong>
                      {printerPayment === 'mixto' ? (
                        <>
                          <div>Pago Móvil: Bs 151.20 ($3.36)</div>
                          <div>Efectivo USD: $2.00</div>
                        </>
                      ) : (
                        <div>Zelle: $4.53</div>
                      )}
                    </div>

                    {/* QR Code */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <QrCode size={40} style={{ color: '#111827' }} />
                      <span style={{ fontSize: '8px', color: '#4b5563' }}>Consulte su factura digital</span>
                      <strong style={{ fontSize: '9px', textTransform: 'uppercase', marginTop: '4px', display: 'block' }}>*** GRACIAS POR SU COMPRA ***</strong>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* VISTA C: ESCÁNER LÁSER */}
          {activePlaygroundTab === 'scanner' && (
            <>
              {/* Columna Izquierda: Cámara Simulada */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '10px' }}>Lector Láser de Inventario</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Simule el escaneo de un producto mediante un sensor de código de barras para abastecer stock rápidamente.
                  </p>
                </div>

                {/* Cámara Viewport */}
                <div style={{
                  position: 'relative',
                  height: '180px',
                  backgroundColor: '#000',
                  borderRadius: '10px',
                  border: '3px solid #374151',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
                }}>
                  {/* Láser barrido */}
                  {isScanning && <div className="laser-line" />}

                  {/* Icono de Cámara / Código de barra */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', zIndex: 1, color: isScanning ? 'var(--brand-primary)' : 'var(--text-muted)', transition: 'color 0.3s' }}>
                    <Camera size={40} style={{ animation: isScanning ? 'pulse 1s infinite' : 'none' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>
                      {isScanning ? 'ESCANEANDO...' : 'SISTEMA LISTO'}
                    </span>
                  </div>

                  {/* Líneas de esquina */}
                  <div style={{ position: 'absolute', top: '15px', left: '15px', width: '15px', height: '15px', borderTop: '3px solid #9ca3af', borderLeft: '3px solid #9ca3af' }} />
                  <div style={{ position: 'absolute', top: '15px', right: '15px', width: '15px', height: '15px', borderTop: '3px solid #9ca3af', borderRight: '3px solid #9ca3af' }} />
                  <div style={{ position: 'absolute', bottom: '15px', left: '15px', width: '15px', height: '15px', borderBottom: '3px solid #9ca3af', borderLeft: '3px solid #9ca3af' }} />
                  <div style={{ position: 'absolute', bottom: '15px', right: '15px', width: '15px', height: '15px', borderBottom: '3px solid #9ca3af', borderRight: '3px solid #9ca3af' }} />
                </div>

                <button
                  onClick={handleSimulateScan}
                  disabled={isScanning}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--brand-primary)',
                    color: 'white',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
                >
                  {isScanning ? 'Procesando Código...' : 'Escanear Código de Barras'}
                </button>
              </div>

              {/* Columna Derecha: Ticker de Inventario */}
              <div style={{ 
                backgroundColor: 'var(--bg-input)', 
                padding: '24px', 
                borderRadius: '12px', 
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inventario Registrado Recientemente</span>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}>
                  {scannedItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        animation: idx === 0 ? 'fadeInUp 0.4s ease forwards' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>{item.name}</strong>
                        <span style={{ fontSize: '10px', color: 'var(--brand-primary)', fontWeight: 800 }}>${item.price.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                        <span>Cód: {item.barcode}</span>
                        <span>Stock: <strong style={{ color: 'var(--text-primary)' }}>{item.stock} und</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </section>

      {/* ── SECCIÓN DE MÉTRICAS DE IMPACTO GLOBAL ANIMADAS ── */}
      <section className="impact-metrics-section" style={{
        padding: '80px 5% 40px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Escala y Confianza
          </span>
          <h2 style={{ fontSize: '30px', fontWeight: 900, margin: '12px 0 10px 0' }}>Rendimiento Comprobado en Tiendas</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Respaldamos a comercios y bodegones con infraestructura robusta para facturar sin interrupciones.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: windowWidth < 600 ? '1fr' : windowWidth < 900 ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: '24px'
        }}>
          {/* Métrica 1: Transacciones */}
          <div className="widget" style={{
            padding: '30px 24px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
              <Database size={24} />
            </div>
            <span ref={metricTransRef} style={{
              fontSize: '36px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, var(--brand-primary), var(--accent-yellow, #fbbf24))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              +0.0M
            </span>
            <strong style={{ fontSize: '15px', fontWeight: 800 }}>Transacciones</strong>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Ventas y facturas procesadas de forma segura por el sistema.
            </p>
          </div>

          {/* Métrica 2: Horas Ahorradas */}
          <div className="widget" style={{
            padding: '30px 24px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(251, 191, 36, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-gold)' }}>
              <Clock size={24} />
            </div>
            <span ref={metricHoursRef} style={{
              fontSize: '36px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, var(--brand-gold), #f59e0b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              +0h
            </span>
            <strong style={{ fontSize: '15px', fontWeight: 800 }}>Horas Ahorradas</strong>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Tiempo ganado por dueños en cierres de caja automatizados.
            </p>
          </div>

          {/* Métrica 3: Precisión de Caja */}
          <div className="widget" style={{
            padding: '30px 24px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
              <ShieldCheck size={24} />
            </div>
            <span ref={metricPrecisionRef} style={{
              fontSize: '36px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #22c55e, #10b981)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              90.00%
            </span>
            <strong style={{ fontSize: '15px', fontWeight: 800 }}>Precisión de Caja</strong>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Margen de error cercano a cero, evitando fugas de efectivo.
            </p>
          </div>

          {/* Métrica 4: Tiempo de Respuesta */}
          <div className="widget" style={{
            padding: '30px 24px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            transition: 'transform 0.3s, border-color 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = 'var(--brand-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--brand-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
              <Settings size={24} />
            </div>
            <span ref={metricSupportRef} style={{
              fontSize: '36px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, var(--brand-primary), #3b82f6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              &lt;60 min
            </span>
            <strong style={{ fontSize: '15px', fontWeight: 800 }}>Respuesta de Soporte</strong>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Contacto prioritario e inmediato ante fallas operativas.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN DE PLANES Y PRECIOS ── */}
      <section id="pricing" style={{
        padding: '80px 5%',
        zIndex: 2,
        position: 'relative'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Precios y Licencias
          </span>
          <h2 style={{ fontSize: '30px', fontWeight: 900, margin: '12px 0 10px 0' }}>Planes y Limitaciones del Sistema</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            Consiga el nivel de acceso adecuado para su comercio. Puede probar la aplicación con acceso total e ilimitado de inmediato.
          </p>
        </div>

        {/* Configurador de Plan a la Medida */}
        <div className="widget configurator-card" style={{
          opacity: 0,
          padding: '35px 30px',
          borderRadius: 'var(--card-radius)',
          border: '1.5px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--card-shadow)',
          maxWidth: '1100px',
          margin: '0 auto 50px auto',
          display: 'grid',
          gridTemplateColumns: windowWidth < 768 ? '1fr' : '1.2fr 0.8fr',
          gap: '35px',
          transition: 'border-color 0.3s'
        }}>
          {/* Columna Izquierda: Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sliders size={20} style={{ color: 'var(--brand-primary)' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0 }}>Configure su Plan por Sucursales</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Deslice los controles para estimar la tarifa de su negocio. La escala se ajusta automáticamente a sus necesidades de expansión en Venezuela.
            </p>

            {/* Slider 1: Sucursales */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 800 }}>Número de Sucursales:</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '2px 8px', borderRadius: '6px' }}>
                  {configBranches} {configBranches === 1 ? 'Sucursal' : 'Sucursales'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={configBranches}
                onChange={(e) => setConfigBranches(parseInt(e.target.value))}
                className="custom-range-slider"
              />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Desde 1 comercio local hasta redes de 10 sucursales enlazadas.</span>
            </div>

            {/* Slider 2: Cajas por Sucursal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 800 }}>Cajas Registradoras por Sucursal:</span>
                <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '2px 8px', borderRadius: '6px' }}>
                  {configRegisters} {configRegisters === 1 ? 'Caja' : 'Cajas'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={configRegisters}
                onChange={(e) => setConfigRegisters(parseInt(e.target.value))}
                className="custom-range-slider"
              />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Número de puntos de venta operando simultáneamente en cada local.</span>
            </div>
          </div>

          {/* Columna Derecha: Resumen de Costo y Sugerencias */}
          <div style={{ 
            backgroundColor: 'var(--bg-input)', 
            padding: '24px', 
            borderRadius: '12px', 
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '20px'
          }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tarifa Mensual Estimada
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0' }}>
                <span style={{
                  fontSize: '38px',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, var(--brand-primary), #3b82f6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  ${12 + (configBranches - 1) * 8 + (configBranches * configRegisters - 1) * 4}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>/ mes</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>Plan recomendado:</span>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 800, 
                  color: 'white', 
                  backgroundColor: (configBranches > 2 || (configBranches * configRegisters) > 3) ? 'var(--brand-primary)' : 'var(--brand-gold, #d97706)',
                  padding: '2px 8px', 
                  borderRadius: '4px' 
                }}>
                  {(configBranches > 2 || (configBranches * configRegisters) > 3) ? 'Plan Premium' : 'Plan Medio'}
                </span>
              </div>

              {/* Sugerencias de Hardware */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <strong style={{ fontSize: '12px', display: 'block', marginBottom: '10px', color: 'var(--text-primary)' }}>Equipamiento Sugerido:</strong>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>{configBranches}x {configBranches === 1 ? 'Impresora de tickets térmica' : 'Impresoras térmicas de tickets'} (USB/Red)</li>
                  <li>{configBranches * configRegisters}x {configBranches * configRegisters === 1 ? 'Lector de barra' : 'Lectores de barra'} (Láser/Inalámbricos)</li>
                  <li>{configBranches}x {configBranches === 1 ? 'Cajón monedero' : 'Cajones monederos'} estándar</li>
                  {configBranches > 1 && <li style={{ color: 'var(--brand-primary)', fontWeight: 800 }}>Sincronización en la nube activada</li>}
                </ul>
              </div>
            </div>

            <button 
              onClick={onStartDemo}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'var(--brand-primary)',
                color: 'white',
                border: 'none',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary-hover, #0ca09f)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--brand-primary)'}
            >
              Iniciar Prueba Gratis <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '30px',
          maxWidth: '1100px',
          margin: '0 auto 40px auto'
        }}>
          {/* Plan Básico ($5) */}
          <div className="widget pricing-card" style={{ 
            padding: '35px 24px', 
            borderRadius: 'var(--card-radius)', 
            border: '1.5px solid var(--border-color)', 
            backgroundColor: 'var(--bg-card)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px',
            transition: 'all 0.3s ease',
            opacity: 0
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
            <div>
              <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--brand-primary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Acceso Inicial</span>
              <h4 style={{ fontSize: '24px', fontWeight: 900, margin: '8px 0 4px 0', color: 'var(--text-primary)' }}>Básico</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>Ideal para pequeños quioscos o emprendimientos.</p>
              <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)' }}>
                $5 <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>/ mes</span>
              </div>
            </div>
            
            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }} />
            
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'left' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Catálogo: <strong>Máx. 10 productos</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Clientes: <strong>Máx. 10 clientes</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Ventas: <strong>Máx. 20 transacciones</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Módulos: Resumen, POS, Inventario</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5, textDecoration: 'line-through' }}><X size={14} color="#ef4444" strokeWidth={3} /> Compras, Clientes, Proveedores</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5, textDecoration: 'line-through' }}><X size={14} color="#ef4444" strokeWidth={3} /> Reportes, Auditoría y Configuración</li>
            </ul>
          </div>

          {/* Plan Medio ($12) */}
          <div className="widget pricing-card" style={{ 
            padding: '35px 24px', 
            borderRadius: 'var(--card-radius)', 
            border: '2px solid var(--brand-primary)', 
            backgroundColor: 'var(--bg-card)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px', 
            position: 'relative',
            transition: 'all 0.3s ease',
            boxShadow: '0 10px 30px rgba(var(--brand-primary-h), var(--brand-primary-s), var(--brand-primary-l), 0.08)',
            opacity: 0
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.boxShadow = '0 15px 35px rgba(var(--brand-primary-h), var(--brand-primary-s), var(--brand-primary-l), 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(var(--brand-primary-h), var(--brand-primary-s), var(--brand-primary-l), 0.08)';
            }}
          >
            <div style={{ position: 'absolute', top: '-12px', right: '20px', backgroundColor: 'var(--brand-primary)', color: '#fff', fontSize: '9px', fontWeight: 900, padding: '4px 10px', borderRadius: '50px', letterSpacing: '0.5px' }}>RECOMENDADO</div>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--brand-gold)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Crecimiento</span>
              <h4 style={{ fontSize: '24px', fontWeight: 900, margin: '8px 0 4px 0', color: 'var(--text-primary)' }}>Medio / Pro</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>Perfecto para bodegas y tiendas en crecimiento.</p>
              <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)' }}>
                $12 <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>/ mes</span>
              </div>
            </div>
            
            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }} />
            
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'left' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Catálogo: <strong>Máx. 100 productos</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Clientes: <strong>Máx. 50 clientes</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Ventas: <strong>Máx. 200 transacciones</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Módulos: Básico + Compras y Carga por Foto</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Directorios: Clientes y Proveedores</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5, textDecoration: 'line-through' }}><X size={14} color="#ef4444" strokeWidth={3} /> Nómina, Auditoría y Configuración</li>
            </ul>
          </div>

          {/* Plan Premium ($25) */}
          <div className="widget pricing-card" style={{ 
            padding: '35px 24px', 
            borderRadius: 'var(--card-radius)', 
            border: '1.5px solid var(--border-color)', 
            backgroundColor: 'var(--bg-card)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px',
            transition: 'all 0.3s ease',
            opacity: 0
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-6px)';
              e.currentTarget.style.borderColor = '#10b981';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#10b981', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Corporativo</span>
              <h4 style={{ fontSize: '24px', fontWeight: 900, margin: '8px 0 4px 0', color: 'var(--text-primary)' }}>Premium / Full</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>Control absoluto e ilimitado para su negocio.</p>
              <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)' }}>
                $25 <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>/ mes</span>
              </div>
            </div>
            
            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }} />
            
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'left' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Catálogo: <strong>Ilimitado</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Clientes: <strong>Ilimitado</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Ventas: <strong>Ilimitado</strong></li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Todas las Vistas y Módulos Activos</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Nómina y Auditoría de Seguridad</li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={14} color="#22c55e" strokeWidth={3} /> Configuración Fiscal e Importación desde Excel</li>
            </ul>
          </div>
        </div>

        {/* Bloque Callout Demo */}
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '24px',
          borderRadius: '16px',
          backgroundColor: 'rgba(251, 191, 36, 0.04)',
          border: '1.5px dashed rgba(251, 191, 36, 0.3)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          transition: 'all 0.3s'
        }}>
          <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            ¿Desea probar el sistema de inmediato?
          </h4>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, maxWidth: '600px', lineHeight: '1.5' }}>
            Inicie un recorrido de demostración de 5 minutos. Tendrá acceso completo a todas las secciones e interfaces para explorar la potencia y agilidad del POS.
          </p>
          <button
            onClick={onStartDemo}
            className="btn-yellow"
            style={{
              padding: '12px 28px',
              borderRadius: 'var(--button-radius)',
              fontSize: '13px',
              fontWeight: 800,
              boxShadow: '0 4px 16px rgba(var(--brand-primary-h), var(--brand-primary-s), var(--brand-primary-l), 0.2)'
            }}
          >
            Iniciar Demo de Prueba (5 min)
          </button>
        </div>
      </section>

      {/* ── SECCIÓN DE PREGUNTAS FRECUENTES (FAQs) ── */}
      <section style={{
        padding: '60px 5% 40px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '45px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Preguntas Frecuentes
          </span>
          <h2 style={{ fontSize: '28px', fontWeight: 900, margin: '12px 0 10px 0' }}>Resolvemos sus Dudas</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            Todo lo que necesita saber sobre el funcionamiento del sistema POS.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            {
              q: "¿Cómo se actualiza la tasa cambiaria del BCV?",
              a: "El sistema se conecta de forma automática y diaria al servidor centralizado para obtener la tasa oficial del Banco Central de Venezuela. En caso de que no tenga conexión a internet, puede ingresar o ajustar la tasa cambiaria manualmente desde el panel de configuración de forma instantánea."
            },
            {
              q: "¿Necesito comprar impresoras especiales para emitir los tickets de venta?",
              a: "No. StockMasterPro es compatible con cualquier impresora térmica estándar de 58mm o 80mm conectada por USB, Bluetooth o red local. También puede configurarlo para generar recibos digitales en formato PDF para enviar por WhatsApp o correo."
            },
            {
              q: "¿Puedo importar mi lista de productos existente desde un archivo de Excel?",
              a: "Sí. El sistema cuenta con un importador de archivos Excel y de texto muy intuitivo. Podrá cargar todo su catálogo de productos con nombres, códigos de barra, precios y existencias en cuestión de segundos, sin necesidad de transcribirlos uno a uno."
            },
            {
              q: "¿Qué pasa si se corta la electricidad o la conexión a internet en medio de un cobro?",
              a: "No perderá ningún dato. El sistema funciona con una base de datos local que se ejecuta en su navegador. La venta se guardará localmente y se podrá registrar. En cuanto regrese la electricidad o el internet, el sistema subirá automáticamente los datos pendientes a la nube."
            }
          ].map((item, index) => {
            const isOpen = activeFaq === index;
            return (
              <div 
                key={index}
                className="widget"
                style={{
                  borderRadius: 'var(--card-radius)',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <button
                  onClick={() => setActiveFaq(isOpen ? null : index)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <HelpCircle size={18} style={{ color: isOpen ? 'var(--brand-primary)' : 'var(--text-secondary)', transition: 'color 0.2s' }} />
                    <span style={{ fontSize: '14.5px', fontWeight: 800, transition: 'color 0.2s', color: isOpen ? 'var(--brand-primary)' : 'var(--text-primary)' }}>
                      {item.q}
                    </span>
                  </div>
                  <ChevronDown 
                    size={18} 
                    style={{ 
                      color: 'var(--text-secondary)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease'
                    }} 
                  />
                </button>
                <div style={{
                  maxHeight: isOpen ? '300px' : '0',
                  opacity: isOpen ? 1 : 0,
                  transition: 'max-height 0.35s ease, opacity 0.3s ease',
                  overflow: 'hidden'
                }}>
                  <p style={{
                    padding: '0 24px 20px 54px',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                    margin: 0
                  }}>
                    {item.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── SECCIÓN DE CONTACTO CON EL DEV ── */}
      <section className="dev-contact-section" style={{
        padding: '80px 5% 40px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', backgroundColor: 'var(--brand-primary-light)', padding: '4px 10px', borderRadius: '50px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Desarrollo y Personalización
          </span>
          <h2 style={{ fontSize: '30px', fontWeight: 900, margin: '12px 0 10px 0' }}>Consultoría y Soporte Directo</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
            ¿Necesita un módulo específico, integrar balanzas o sincronizar múltiples sucursales? Hablemos directamente.
          </p>
        </div>

        <div className="dev-contact-card" style={{
          opacity: 0,
          display: 'grid',
          gridTemplateColumns: windowWidth < 768 ? '1fr' : '1.1fr 0.9fr',
          gap: '35px',
          maxWidth: '1100px',
          margin: '0 auto'
        }}>
          {/* Columna Izquierda: Formulario */}
          <div className="widget" style={{
            padding: '35px 30px',
            borderRadius: 'var(--card-radius)',
            border: '1.5px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            boxShadow: 'var(--card-shadow)',
            transition: 'border-color 0.3s'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} style={{ color: 'var(--brand-primary)' }} />
              Enviar Consulta al Dev
            </h3>

            <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: windowWidth < 600 ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Nombre del Comercio *</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ej. Bodegón La Cumbre"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Ciudad / Estado</label>
                  <input
                    type="text"
                    value={contactCity}
                    onChange={(e) => setContactCity(e.target.value)}
                    placeholder="Ej. Caracas, Miranda"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Número de Contacto *</label>
                <input
                  type="text"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Ej. 0412-1234567"
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>¿Qué personalización o duda tienes? *</label>
                <textarea
                  required
                  rows={4}
                  value={contactMsg}
                  onChange={(e) => setContactMsg(e.target.value)}
                  placeholder="Ej. Necesitamos integrar una balanza de peso y sincronizar el inventario entre 3 locales."
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Canal de Contacto */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Plataforma de Redirección:</span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setContactChannel('whatsapp')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: contactChannel === 'whatsapp' ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                      backgroundColor: contactChannel === 'whatsapp' ? 'var(--brand-primary-light)' : 'transparent',
                      color: contactChannel === 'whatsapp' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      fontWeight: 800,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactChannel('telegram')}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: contactChannel === 'telegram' ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                      backgroundColor: contactChannel === 'telegram' ? 'var(--brand-primary-light)' : 'transparent',
                      color: contactChannel === 'telegram' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                      fontWeight: 800,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                  >
                    Telegram
                  </button>
                </div>
              </div>

              {/* Botón de Enviar */}
              <button
                type="submit"
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: contactChannel === 'whatsapp' ? '#22c55e' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '6px',
                  transition: 'background-color 0.2s'
                }}
              >
                {contactChannel === 'whatsapp' ? 'Enviar por WhatsApp' : 'Enviar por Telegram'}
                <ArrowRight size={14} />
              </button>

              {formSubmitted && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid #22c55e',
                  color: '#22c55e',
                  fontSize: '12px',
                  fontWeight: 700,
                  textAlign: 'center',
                  marginTop: '8px'
                }}>
                  {contactChannel === 'telegram' 
                    ? '¡Mensaje copiado al portapapeles! Redirigiendo a Telegram...' 
                    : '¡Redirigiendo a WhatsApp...!'
                  }
                </div>
              )}
            </form>
          </div>

          {/* Columna Derecha: Estado de Sistemas y Dev Bio */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="widget" style={{
              padding: '30px 24px',
              borderRadius: 'var(--card-radius)',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              boxShadow: 'var(--card-shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              transition: 'border-color 0.3s'
            }}>
              <h4 style={{ fontSize: '15px', fontWeight: 900, margin: 0, color: 'var(--brand-primary)' }}>Soporte Directo y Migración VIP</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Ofrecemos asistencia directa para la puesta en marcha de su comercio. Realizamos la importación sin costo de su base de datos o inventario actual en formato Excel.
              </p>

              {/* Caja de Estado del Sistema */}
              <div style={{
                backgroundColor: 'var(--bg-input)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="status-pulse-dot" />
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>Servicios del POS en Línea</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Servidor Sincronización:</span>
                    <strong style={{ color: '#22c55e' }}>Operativo (42ms)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Actualización Tasa BCV:</span>
                    <strong style={{ color: '#22c55e' }}>Al día</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <span>Actualizaciones Automáticas:</span>
                    <strong style={{ color: 'var(--brand-primary)' }}>Activas</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Enlaces directos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a
                href="https://wa.me/584269400924"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  transition: 'border-color 0.2s, transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <MessageSquare size={16} style={{ color: '#22c55e' }} />
                  <span>WhatsApp Técnico (+58 426-9400924)</span>
                </div>
                <ChevronRight size={14} />
              </a>

              <a
                href="https://t.me/+584269400924"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  transition: 'border-color 0.2s, transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={16} style={{ color: '#3b82f6' }} />
                  <span>Telegram Directo (+58 426-9400924)</span>
                </div>
                <ChevronRight size={14} />
              </a>

              <a
                href="mailto:jonas.dev.ve@gmail.com"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 800,
                  textDecoration: 'none',
                  transition: 'border-color 0.2s, transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-primary)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={16} style={{ color: 'var(--brand-primary)' }} />
                  <span>Correo Soporte (soporte@stockmasterpro.com)</span>
                </div>
                <ChevronRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── BANNER CTA FINAL ── */}
      <section className="cta-banner" style={{
        padding: '40px 5% 20px 5%',
        position: 'relative',
        zIndex: 2,
        maxWidth: '1000px',
        margin: '0 auto',
        opacity: 0,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 164, 0.1) 0%, rgba(251, 191, 36, 0.05) 100%)',
          borderRadius: 'var(--card-radius)',
          border: '1.5px solid var(--border-color)',
          padding: isMobile ? '40px 24px' : '60px 40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          boxShadow: 'var(--card-shadow)',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 900, margin: 0, lineHeight: 1.25 }}>
            Lleve su Negocio al Siguiente Nivel Hoy Mismo
          </h2>
          <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', maxWidth: '600px', margin: 0, lineHeight: 1.6 }}>
            Registre su establecimiento en menos de un minuto y comience a facturar sin interrupciones. Disfrute de control completo con la demo gratuita ilimitada de 5 minutos.
          </p>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            <button
              onClick={onEnterRegister}
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
                boxShadow: '0 4px 16px var(--brand-primary-light)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Registrar Establecimiento Gratis
            </button>
            <button
              onClick={onStartDemo}
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
              Probar Demo Ahora (5 min)
            </button>
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

      {/* ── MODALES INTERACTIVOS DEL SISTEMA ── */}
      <RateCalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />

      <KeyboardShortcuts
        activeTab="pos"
        setActiveTab={() => {}}
        onOpenCalculator={() => {
          setIsShortcutsOpen(false);
          setIsCalculatorOpen(true);
        }}
        onToggleTheme={() => {}}
        onFocusSearch={() => {
          alert('Simulación: Foco en barra de búsqueda de productos POS.');
        }}
        role="ADMIN"
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <AppUpdater
        isOpen={isUpdaterOpen}
        onClose={() => setIsUpdaterOpen(false)}
        currentVersion="v2.1.0"
      />
    </div>
  );
}
