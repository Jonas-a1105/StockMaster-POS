import React, { useState, useEffect, useMemo } from 'react';
import { 
  Store, 
  Briefcase, 
  MapPin, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  X, 
  ShoppingBag, 
  Smartphone,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';
import CustomSelect from './CustomSelect';

interface OnboardingTutorialProps {
  activeTab: 'dashboard' | 'pos' | 'inventario' | 'compras' | 'nomina' | 'clientes' | 'proveedores' | 'analiticas' | 'auditoria' | 'cierre' | 'settings' | 'users' | 'about' | 'profile';
  setActiveTab: (tab: any) => void;
  productsCount: number;
  salesCount: number;
  user: {
    id: string;
    name: string;
    role: string;
  };
}

interface TourStep {
  title: string;
  description: string;
  selector: string;
  tab: string;
  actionRequired?: string;
  position: 'right' | 'left' | 'bottom' | 'top' | 'center';
}

export default function OnboardingTutorial({
  activeTab,
  setActiveTab,
  productsCount,
  salesCount,
  user
}: OnboardingTutorialProps) {
  const { updateSettings, validateRIF, formatRIF } = useBusinessSettings();

  // Onboarding Wizard States
  const [showWizard, setShowWizard] = useState(() => {
    return localStorage.getItem('stockmaster_onboarding_completed') !== 'true';
  });
  const [wizardStep, setWizardStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [sector, setSector] = useState('Víveres / Supermercado');
  const [purpose, setPurpose] = useState('Control de Inventario');
  const [rif, setRif] = useState('');
  const [address, setAddress] = useState('');
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [rifError, setRifError] = useState('');

  // Tour States
  const [tourActive, setTourActive] = useState(() => {
    return localStorage.getItem('stockmaster_tutorial_active') === 'true';
  });
  const [tourStepIndex, setTourStepIndex] = useState(() => {
    const saved = localStorage.getItem('stockmaster_tutorial_step');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [initialProductsCount, setInitialProductsCount] = useState(() => {
    const saved = localStorage.getItem('stockmaster_tour_init_products');
    return saved ? parseInt(saved, 10) : productsCount;
  });

  const [initialSalesCount, setInitialSalesCount] = useState(() => {
    const saved = localStorage.getItem('stockmaster_tour_init_sales');
    return saved ? parseInt(saved, 10) : salesCount;
  });

  // Track coordinates of active target element
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Setup tour step definitions
  const tourSteps: TourStep[] = useMemo(() => [
    {
      title: '👋 ¡Te damos la bienvenida al Tablero!',
      description: 'Aquí verás el resumen general de tu negocio en tiempo real: ingresos totales, cantidad de ventas, catálogo y alertas de bajo stock.',
      selector: '.welcome-section',
      tab: 'dashboard',
      position: 'bottom',
    },
    {
      title: '📦 Paso 1: Ir al Catálogo de Inventario',
      description: 'Haz clic en "Inventario" en el menú lateral para registrar tu primer producto en la base de datos.',
      selector: '[data-tour="sidebar-inventario"]',
      tab: 'dashboard',
      actionRequired: 'tab-change-inventario',
      position: 'right',
    },
    {
      title: '➕ Paso 2: Crear un Nuevo Producto',
      description: 'Haz clic en el botón "Nuevo Producto" para abrir la ventana de registro de artículos.',
      selector: '[data-tour="nuevo-producto-btn"]',
      tab: 'inventario',
      actionRequired: 'modal-open-product',
      position: 'bottom',
    },
    {
      title: '📝 Paso 3: Completar Ficha de Producto',
      description: 'Ingresa los datos esenciales como Nombre, Código de barra y Precio. El sistema calculará automáticamente el margen de ganancia y el precio en Bolívares (VES). Al finalizar, haz clic en "Registrar Producto".',
      selector: '[data-tour="nuevo-producto-modal"]',
      tab: 'inventario',
      actionRequired: 'product-created',
      position: 'center',
    },
    {
      title: '🛒 Paso 4: Ir a la Caja Registradora (POS)',
      description: '¡Producto registrado! Ahora, haz clic en "Ventas POS" en el menú lateral para abrir la caja registradora y realizar tu primera venta.',
      selector: '[data-tour="sidebar-pos"]',
      tab: 'inventario',
      actionRequired: 'tab-change-pos',
      position: 'right',
    },
    {
      title: '🔍 Paso 5: Agregar Producto al Carrito',
      description: 'Escribe el nombre de tu producto en el buscador o selecciónalo directamente de la lista para agregarlo al carrito de compras.',
      selector: '[data-tour="pos-product-grid"]',
      tab: 'pos',
      actionRequired: 'cart-added',
      position: 'left',
    },
    {
      title: '💰 Paso 6: Proceder al Cobro',
      description: '¡Excelente! Ahora que tienes el artículo en el carrito, haz clic en "Proceder al Cobro" para abrir la pantalla de pagos.',
      selector: '[data-tour="pos-checkout-btn"]',
      tab: 'pos',
      actionRequired: 'checkout-modal-open',
      position: 'left',
    },
    {
      title: '💳 Paso 7: Confirmar Pago y Facturar',
      description: 'Selecciona el método de pago (por ejemplo, Efectivo USD), ingresa el monto recibido y haz clic en "PROCESAR FACTURA" para imprimir el ticket y registrar los ingresos.',
      selector: '[data-tour="confirm-payment-btn"]',
      tab: 'pos',
      actionRequired: 'sale-completed',
      position: 'center',
    },
    {
      title: '🎉 ¡Felicitaciones, has terminado!',
      description: 'Completaste tu primera configuración, diste de alta tu producto y realizaste tu primera venta con conversión de moneda en vivo. ¡Ya estás listo para dominar tu negocio con StockMasterPro!',
      selector: '.welcome-section',
      tab: 'dashboard',
      position: 'center',
    }
  ], []);

  const activeStep = tourSteps[tourStepIndex];

  // Save counts when tour starts or step updates
  useEffect(() => {
    if (tourActive) {
      localStorage.setItem('stockmaster_tutorial_active', 'true');
      localStorage.setItem('stockmaster_tutorial_step', String(tourStepIndex));
    } else {
      localStorage.removeItem('stockmaster_tutorial_active');
      localStorage.removeItem('stockmaster_tutorial_step');
      localStorage.removeItem('stockmaster_tour_init_products');
      localStorage.removeItem('stockmaster_tour_init_sales');
    }
  }, [tourActive, tourStepIndex]);

  // Reactive step transitions
  useEffect(() => {
    if (!tourActive || !activeStep) return;

    // Auto-advance if they manually switch to the correct tab for the next step
    if (activeStep.actionRequired === 'tab-change-inventario' && activeTab === 'inventario') {
      goToNextStep();
    }
    if (activeStep.actionRequired === 'tab-change-pos' && activeTab === 'pos') {
      goToNextStep();
    }

    // Auto-advance when product registration modal opens
    if (activeStep.actionRequired === 'modal-open-product') {
      const modalExists = document.querySelector('[data-tour="nuevo-producto-modal"]');
      if (modalExists) {
        goToNextStep();
      }
    }

    // Auto-advance when product is created (productsCount increases)
    if (activeStep.actionRequired === 'product-created') {
      if (productsCount > initialProductsCount) {
        setInitialProductsCount(productsCount);
        localStorage.setItem('stockmaster_tour_init_products', String(productsCount));
        goToNextStep();
      }
    }

    // Auto-advance when item added to cart (checkout button becomes active/visible/not disabled)
    if (activeStep.actionRequired === 'cart-added') {
      const checkoutBtn = document.querySelector('[data-tour="pos-checkout-btn"]') as HTMLButtonElement;
      if (checkoutBtn && !checkoutBtn.disabled) {
        goToNextStep();
      }
    }

    // Auto-advance when payment modal is open
    if (activeStep.actionRequired === 'checkout-modal-open') {
      const confirmBtn = document.querySelector('[data-tour="confirm-payment-btn"]');
      if (confirmBtn) {
        goToNextStep();
      }
    }

    // Auto-advance when sale is completed (salesCount increases)
    if (activeStep.actionRequired === 'sale-completed') {
      if (salesCount > initialSalesCount) {
        setInitialSalesCount(salesCount);
        localStorage.setItem('stockmaster_tour_init_sales', String(salesCount));
        goToNextStep();
      }
    }
  }, [tourActive, activeStep, activeTab, productsCount, salesCount, initialProductsCount, initialSalesCount]);

  // Check DOM periodically to auto-advance modal states or track cart
  useEffect(() => {
    if (!tourActive || !activeStep) return;

    const interval = setInterval(() => {
      // Check for product modal
      if (activeStep.actionRequired === 'modal-open-product') {
        if (document.querySelector('[data-tour="nuevo-producto-modal"]')) {
          goToNextStep();
        }
      }
      // Check if item added to cart
      if (activeStep.actionRequired === 'cart-added') {
        const checkoutBtn = document.querySelector('[data-tour="pos-checkout-btn"]') as HTMLButtonElement;
        if (checkoutBtn && !checkoutBtn.disabled) {
          goToNextStep();
        }
      }
      // Check if checkout modal is open
      if (activeStep.actionRequired === 'checkout-modal-open') {
        if (document.querySelector('[data-tour="confirm-payment-btn"]')) {
          goToNextStep();
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [tourActive, activeStep]);

  // Spotlight element coordinate tracking
  useEffect(() => {
    if (!tourActive || !activeStep || activeStep.position === 'center') {
      setTargetRect(null);
      return;
    }

    let active = true;
    const updatePosition = () => {
      if (!active) return;
      const el = document.querySelector(activeStep.selector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
      requestAnimationFrame(updatePosition);
    };

    updatePosition();
    return () => {
      active = false;
    };
  }, [tourActive, tourStepIndex, activeStep]);

  // Handle RIF formatting and validation on keypress
  const handleRifChange = (val: string) => {
    const formatted = formatRIF(val);
    setRif(formatted);
    if (formatted.length >= 9) {
      if (validateRIF(formatted)) {
        setRifError('');
      } else {
        setRifError('RIF venezolano inválido. Ej: J-40812991-0');
      }
    } else {
      setRifError('');
    }
  };

  // Onboarding Wizard Submission
  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (rif && !validateRIF(rif)) {
      setRifError('Debe ingresar un RIF venezolano válido antes de continuar.');
      return;
    }

    // Update global context settings
    updateSettings({
      businessName: businessName || 'Mi Negocio StockMaster',
      businessRIF: rif || 'J-00000000-0',
      businessAddress: address || 'Sin dirección fiscal registrada',
      paperWidth: paperWidth
    });

    localStorage.setItem('stockmaster_onboarding_completed', 'true');
    setShowWizard(false);
    
    // Switch state and trigger tour
    setTourActive(true);
    setTourStepIndex(0);
    setInitialProductsCount(productsCount);
    setInitialSalesCount(salesCount);
    localStorage.setItem('stockmaster_tour_init_products', String(productsCount));
    localStorage.setItem('stockmaster_tour_init_sales', String(salesCount));
    localStorage.setItem('stockmaster_tutorial_active', 'true');
    localStorage.setItem('stockmaster_tutorial_step', '0');
    setActiveTab('dashboard');
  };

  const skipTour = () => {
    setTourActive(false);
    localStorage.removeItem('stockmaster_tutorial_active');
    localStorage.removeItem('stockmaster_tutorial_step');
    localStorage.removeItem('stockmaster_tour_init_products');
    localStorage.removeItem('stockmaster_tour_init_sales');
  };

  const goToNextStep = () => {
    if (tourStepIndex < tourSteps.length - 1) {
      const nextIndex = tourStepIndex + 1;
      setTourStepIndex(nextIndex);
      
      // Auto-navigate user to the correct tab if they click next
      const nextStep = tourSteps[nextIndex];
      if (nextStep && nextStep.tab && activeTab !== nextStep.tab) {
        setActiveTab(nextStep.tab);
      }
    } else {
      skipTour();
    }
  };

  const goToPrevStep = () => {
    if (tourStepIndex > 0) {
      const prevIndex = tourStepIndex - 1;
      setTourStepIndex(prevIndex);
      
      const prevStep = tourSteps[prevIndex];
      if (prevStep && prevStep.tab && activeTab !== prevStep.tab) {
        setActiveTab(prevStep.tab);
      }
    }
  };

  // Determine floating dialog positioning based on step details
  const getDialogStyle = (): React.CSSProperties => {
    if (!targetRect || activeStep.position === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9999,
        width: '90%',
        maxWidth: '420px',
      };
    }

    const padding = 15;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    switch (activeStep.position) {
      case 'right':
        return {
          position: 'absolute',
          top: `${targetRect.top + scrollY}px`,
          left: `${targetRect.right + scrollX + padding}px`,
          zIndex: 9999,
          width: '320px',
        };
      case 'left':
        return {
          position: 'absolute',
          top: `${targetRect.top + scrollY}px`,
          left: `${targetRect.left + scrollX - 320 - padding}px`,
          zIndex: 9999,
          width: '320px',
        };
      case 'bottom':
        return {
          position: 'absolute',
          top: `${targetRect.bottom + scrollY + padding}px`,
          left: `${targetRect.left + scrollX}px`,
          zIndex: 9999,
          width: '340px',
        };
      case 'top':
        return {
          position: 'absolute',
          top: `${targetRect.top + scrollY - 200 - padding}px`,
          left: `${targetRect.left + scrollX}px`,
          zIndex: 9999,
          width: '340px',
        };
      default:
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: '90%',
          maxWidth: '420px',
        };
    }
  };

  // Onboarding Wizard render
  if (showWizard) {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(5, 5, 8, 0.75)',
        backdropFilter: 'blur(16px)',
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        fontFamily: 'var(--font-main)'
      }}>
        {/* Style tags for wizard custom animations */}
        <style>{`
          .sector-card {
            border: 1.5px solid var(--border-color);
            background-color: var(--bg-input);
            border-radius: 12px;
            padding: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .sector-card:hover {
            border-color: var(--brand-primary);
            transform: translateY(-2px);
          }
          .sector-card.selected {
            border-color: var(--brand-primary);
            background-color: var(--brand-primary-light);
          }
          .sector-card-title {
            font-size: 13px;
            fontWeight: 800;
            color: var(--text-primary);
          }
          .sector-card-desc {
            font-size: 10.5px;
            color: var(--text-secondary);
          }
          .confetti {
            position: absolute;
            width: 8px;
            height: 8px;
            background-color: var(--brand-primary);
            border-radius: 50%;
            animation: fall 3s infinite linear;
          }
          @keyframes fall {
            0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
          }
        `}</style>

        <div className="widget animate-entrance" style={{
          width: '100%',
          maxWidth: '520px',
          padding: '36px',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          borderRadius: 'var(--card-radius)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              padding: '12px',
              borderRadius: '16px'
            }}>
              <Store size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 850, color: 'var(--text-primary)', margin: 0 }}>
                Configuración Inicial de Negocio
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Paso {wizardStep} de 4 · Configura tu experiencia StockMasterPro
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px' }}>
            <div style={{ 
              width: `${(wizardStep / 4) * 100}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-gold) 100%)',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <form onSubmit={handleOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Step 1: Business Name */}
            {wizardStep === 1 && (
              <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                  ¡Hola, <strong>{user.name}</strong>! Bienvenido a StockMasterPro. Para comenzar, ¿cuál es el nombre de tu empresa, comercio o emprendimiento?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Inversiones El Diamante C.A."
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="search-input"
                    style={{ padding: '12px 14px', borderRadius: '12px', width: '100%' }}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Commercial Sector & Purpose */}
            {wizardStep === 2 && (
              <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Selecciona la actividad comercial de tu establecimiento para adaptar los parámetros del sistema:
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {(['Víveres / Supermercado', 'Ropa / Tienda', 'Tecnología / Repuestos', 'Farmacia / Salud', 'Otro'] as const).map((sec) => (
                    <div 
                      key={sec} 
                      onClick={() => setSector(sec)}
                      className={`sector-card ${sector === sec ? 'selected' : ''}`}
                    >
                      <span className="sector-card-title">{sec}</span>
                      <span className="sector-card-desc">Fijar impuestos específicos</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    ¿Cuál es tu principal objetivo al usar el sistema?
                  </label>
                  <CustomSelect 
                    value={purpose}
                    onChange={(val) => setPurpose(val)}
                    options={[
                      { value: 'Control de Inventario', label: 'Control de stock e Inventarios en tiempo real' },
                      { value: 'Ventas y Facturación', label: 'Vender rápido con POS integrado' },
                      { value: 'Reportes y Auditoría', label: 'Reportes fiscales y auditoría de cajeros' },
                      { value: 'Todo en uno', label: 'Administración completa del negocio' }
                    ]}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Tax Details & Preferences */}
            {wizardStep === 3 && (
              <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0 }}>
                  Completa los datos de facturación venezolanos (estos se imprimirán en tus tickets de compra):
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)' }}>RIF DEL NEGOCIO *</label>
                    <input
                      type="text"
                      required
                      placeholder="J-40812991-0"
                      value={rif}
                      onChange={(e) => handleRifChange(e.target.value)}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', width: '100%', borderColor: rifError ? '#ef4444' : 'var(--border-color)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)' }}>DIRECCIÓN FÍSICA *</label>
                    <input
                      type="text"
                      required
                      placeholder="Av. Bolívar, Local 12..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="search-input"
                      style={{ padding: '10px 12px', borderRadius: '12px', width: '100%' }}
                    />
                  </div>
                </div>

                {rifError && (
                  <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>⚠️ {rifError}</span>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Ancho de Impresora Térmica
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setPaperWidth('80mm')}
                      className={`btn-pill-dark ${paperWidth === '80mm' ? 'active' : ''}`}
                      style={{ flex: 1, padding: '12px 0', borderRadius: '12px', justifyContent: 'center', border: paperWidth === '80mm' ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-color)' }}
                    >
                      Estándar (80mm)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaperWidth('58mm')}
                      className={`btn-pill-dark ${paperWidth === '58mm' ? 'active' : ''}`}
                      style={{ flex: 1, padding: '12px 0', borderRadius: '12px', justifyContent: 'center', border: paperWidth === '58mm' ? '1.5px solid var(--brand-primary)' : '1px solid var(--border-color)' }}
                    >
                      Compacto (58mm)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Summary & Confirm */}
            {wizardStep === 4 && (
              <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  ¡Excelente! Tu configuración básica está lista. Revisa los datos antes de guardar:
                </p>

                <div style={{
                  padding: '16px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1.5px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '12.5px'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Negocio: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{businessName}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Sector: </span>
                    <strong style={{ color: 'var(--brand-primary)' }}>{sector}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>RIF Fiscal: </span>
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{rif}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Dirección: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{address}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Impresora: </span>
                    <strong style={{ color: 'var(--brand-gold)' }}>Ticket {paperWidth}</strong>
                  </div>
                </div>

                <div style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--brand-primary-light)',
                  border: '1px solid rgba(14, 165, 164, 0.2)',
                  fontSize: '11px',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Sparkles size={14} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                  <span>Te guiaremos en un tutorial animado paso a paso para que registres tu primer producto y realices tu primera venta POS.</span>
                </div>
              </div>
            )}

            {/* Bottom Actions Row */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              {wizardStep > 1 && (
                <button
                  type="button"
                  onClick={() => setWizardStep(prev => prev - 1)}
                  className="btn-pill-dark"
                  style={{ padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <ArrowLeft size={16} />
                  <span>Atrás</span>
                </button>
              )}
              
              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (wizardStep === 1 && !businessName) return;
                    if (wizardStep === 3 && (!rif || rifError)) return;
                    setWizardStep(prev => prev + 1);
                  }}
                  disabled={(wizardStep === 1 && !businessName) || (wizardStep === 3 && (!rif || !!rifError))}
                  className="btn-yellow"
                  style={{
                    marginLeft: 'auto',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: ((wizardStep === 1 && !businessName) || (wizardStep === 3 && (!rif || !!rifError))) ? 0.5 : 1,
                    cursor: ((wizardStep === 1 && !businessName) || (wizardStep === 3 && (!rif || !!rifError))) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <span>Siguiente</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn-yellow"
                  style={{
                    marginLeft: 'auto',
                    padding: '12px 28px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>GUARDAR Y EMPEZAR</span>
                  <CheckCircle size={16} />
                </button>
              )}
            </div>

          </form>

        </div>
      </div>
    );
  }

  // Tour Overlay Render
  if (tourActive && activeStep) {
    const isFirstStep = tourStepIndex === 0;
    const isLastStep = tourStepIndex === tourSteps.length - 1;

    return (
      <>
        {/* Style tags for Tour spotlight pulse */}
        <style>{`
          .tour-spotlight-pulse {
            box-shadow: 0 0 0 9999px rgba(5, 5, 8, 0.72) !important;
            animation: pulse-ring 2.5s infinite ease-in-out;
            transition: all 0.3s ease;
          }
          @keyframes pulse-ring {
            0% { outline: 2px solid var(--brand-primary); outline-offset: 0px; }
            50% { outline: 4px solid var(--brand-gold); outline-offset: 4px; }
            100% { outline: 2px solid var(--brand-primary); outline-offset: 0px; }
          }
          .animate-pulse-slow {
            animation: pulse 2s infinite ease-in-out;
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          .celebration-confetti {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none;
            z-index: 99999;
            overflow: hidden;
          }
        `}</style>

        {/* Confetti celebration for last step */}
        {isLastStep && (
          <div className="celebration-confetti">
            {Array.from({ length: 50 }).map((_, idx) => (
              <div 
                key={idx} 
                className="confetti"
                style={{
                  left: `${Math.random() * 100}vw`,
                  animationDelay: `${Math.random() * 4}s`,
                  backgroundColor: idx % 3 === 0 ? 'var(--brand-primary)' : idx % 3 === 1 ? 'var(--brand-gold)' : '#20e3b2',
                  transform: `scale(${0.4 + Math.random() * 0.8})`
                }}
              />
            ))}
          </div>
        )}

        {/* Spotlight overlay container */}
        {targetRect && (
          <div 
            className="tour-spotlight-pulse"
            style={{
              position: 'absolute',
              top: `${targetRect.top + window.scrollY}px`,
              left: `${targetRect.left + window.scrollX}px`,
              width: `${targetRect.width}px`,
              height: `${targetRect.height}px`,
              zIndex: 9998,
              borderRadius: '10px',
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Full-screen dark overlay when dialog is in the center */}
        {(!targetRect || activeStep.position === 'center') && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(5, 5, 8, 0.72)',
            zIndex: 9997,
            pointerEvents: 'auto'
          }} />
        )}

        {/* Tour Popup Dialog */}
        <div 
          className="widget animate-entrance"
          style={{
            ...getDialogStyle(),
            padding: '24px',
            border: '2px solid var(--brand-primary)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            backdropFilter: 'blur(20px)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              TUTORIAL GUIADO · {tourStepIndex + 1} de {tourSteps.length}
            </span>
            <button 
              onClick={skipTour}
              style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              title="Omitir tutorial"
            >
              <X size={15} />
            </button>
          </div>

          {/* Title & Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '14.5px', fontWeight: 850, color: 'var(--text-primary)', margin: 0 }}>
              {activeStep.title}
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
              {activeStep.description}
            </p>
          </div>

          {/* Auto-advance notification banner */}
          {activeStep.actionRequired && (
            <div style={{
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(14, 165, 164, 0.08)',
              border: '1px solid rgba(14, 165, 164, 0.15)',
              fontSize: '10.5px',
              color: 'var(--brand-primary)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Sparkles size={11} className="animate-pulse-slow" />
              <span>
                {activeStep.actionRequired === 'tab-change-inventario' && 'Haz clic en "Inventario" para continuar.'}
                {activeStep.actionRequired === 'modal-open-product' && 'Abre el formulario "Nuevo Producto" para avanzar.'}
                {activeStep.actionRequired === 'product-created' && 'Ingresa los datos y crea el producto.'}
                {activeStep.actionRequired === 'tab-change-pos' && 'Haz clic en "Ventas POS" para abrir la caja.'}
                {activeStep.actionRequired === 'cart-added' && 'Agrega el producto para llenar el carrito.'}
                {activeStep.actionRequired === 'checkout-modal-open' && 'Haz clic en "Proceder al Cobro" para pagar.'}
                {activeStep.actionRequired === 'sale-completed' && 'Completa el cobro para avanzar.'}
              </span>
            </div>
          )}

          {/* Progress indicators dots */}
          <div style={{ display: 'flex', gap: '4px', alignSelf: 'center' }}>
            {tourSteps.map((_, idx) => (
              <div 
                key={idx} 
                style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  backgroundColor: idx === tourStepIndex ? 'var(--brand-primary)' : 'var(--border-color)',
                  transition: 'background-color 0.2s'
                }} 
              />
            ))}
          </div>

          {/* Footer Navigation Buttons */}
          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
            {!isFirstStep && (
              <button 
                onClick={goToPrevStep}
                className="btn-pill-dark"
                style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={13} />
                <span>Atrás</span>
              </button>
            )}
            
            <button 
              onClick={skipTour}
              className="btn-pill-dark"
              style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '8px', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', marginLeft: isFirstStep ? 0 : 'auto' }}
            >
              Omitir
            </button>

            <button 
              onClick={goToNextStep}
              className="btn-yellow"
              style={{ padding: '6px 16px', fontSize: '11px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: isFirstStep ? 'auto' : 0 }}
            >
              <span>{isLastStep ? 'Finalizar' : 'Siguiente'}</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </>
    );
  }

  // Render nothing if neither wizard nor tutorial is active
  return null;
}
