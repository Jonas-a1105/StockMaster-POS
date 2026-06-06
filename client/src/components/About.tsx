import React, { useState, useEffect, useRef } from 'react';
import { Shield, Smartphone, HardDrive, Cpu, Terminal, KeyRound, Award, Ban, CheckCircle, HelpCircle, LogOut, Package, Users, ShoppingCart, Clock, CalendarClock, AlertTriangle } from 'lucide-react';
import { animate } from 'animejs';
import { getLicenseState, activateLicense, deactivateLicense, startDemo, stopDemo, getLicenseExpiryInfo, PLAN_LIMITS } from '../utils/license';
import { useToast } from './ToastNotification';
import { getDatabase } from '../db/database';

interface AboutProps {
  user: any;
  onLicenseChanged?: () => void;
}

export default function About({ user, onLicenseChanged }: AboutProps) {
  const { addToast } = useToast();
  const [licenseState, setLicenseState] = useState(getLicenseState());
  const [licenseKey, setLicenseKey] = useState('');
  const [countdown, setCountdown] = useState('');
  const timerRef = useRef<any>(null);
  const expiryTimerRef = useRef<any>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const broadcastLicenseChange = () => {
    try {
      const channel = new BroadcastChannel('stockmaster-license');
      channel.postMessage('license-changed');
      channel.close();
    } catch { /* BroadcastChannel not supported */ }
  };

  const updateState = () => {
    const state = getLicenseState();
    setLicenseState(state);
    broadcastLicenseChange();
    if (onLicenseChanged) onLicenseChanged();
  };

  const [counts, setCounts] = useState({
    products: 0,
    clients: 0,
    sales: 0
  });

  useEffect(() => {
    let active = true;
    const subs: any[] = [];

    const setup = async () => {
      try {
        const db = await getDatabase();
        
        const subProd = db.products.find().$.subscribe(docs => {
          if (active) setCounts(prev => ({ ...prev, products: docs.length }));
        });
        subs.push(subProd);

        const subCli = db.clients.find().$.subscribe(docs => {
          if (active) setCounts(prev => ({ ...prev, clients: docs.length }));
        });
        subs.push(subCli);

        const subSal = db.sales.find().$.subscribe(docs => {
          if (active) setCounts(prev => ({ ...prev, sales: docs.length }));
        });
        subs.push(subSal);
      } catch (err) {
        console.error('Error in About RxDB subs:', err);
      }
    };

    setup();

    return () => {
      active = false;
      subs.forEach(s => s?.unsubscribe());
    };
  }, []);

  useEffect(() => {
    // Animación de carga de About
    animate('.about-stagger-card', {
      translateY: [25, 0],
      opacity: [0, 1],
      delay: (el: any, i: number) => i * 100,
      duration: 600,
      easing: 'outBack'
    });

    animate('.about-stagger-pill', {
      scale: [0.8, 1],
      opacity: [0, 1],
      delay: (el: any, i: number) => 300 + i * 50,
      duration: 500,
      easing: 'outBack'
    });
  }, []);

  // Manejar el temporizador de la demo
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (licenseState.demoActive && licenseState.demoTimeLeft > 0) {
      const updateTimer = () => {
        const state = getLicenseState();
        setLicenseState(state);
        
        const mins = Math.floor(state.demoTimeLeft / 60);
        const secs = state.demoTimeLeft % 60;
        setCountdown(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);

        if (state.demoTimeLeft <= 0) {
          clearInterval(timerRef.current);
          addToast({
            type: 'warning',
            title: 'Demo Expirada',
            message: 'El tiempo de demostración ha concluido. Adquiera una licencia para continuar.'
          });
          updateState();
        }
      };

      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      setCountdown('');
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [licenseState.demoActive, licenseState.demoTimeLeft]);

  // Expiry info state with live countdown
  const [expiryInfo, setExpiryInfo] = useState(getLicenseExpiryInfo(licenseState.expiresAt));

  useEffect(() => {
    if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);

    if (licenseState.plan && licenseState.expiresAt) {
      const tick = () => {
        const info = getLicenseExpiryInfo(licenseState.expiresAt);
        setExpiryInfo(info);
        // If license just expired, update the whole state
        if (info.isExpired) {
          updateState();
        }
      };
      tick();
      // Use 1s interval for short-duration licenses, 60s for long ones
      const intervalMs = expiryInfo.totalSeconds < 3600 ? 1000 : 60000;
      expiryTimerRef.current = setInterval(tick, intervalMs);
    } else {
      setExpiryInfo(getLicenseExpiryInfo(null));
    }

    return () => {
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
    };
  }, [licenseState.plan, licenseState.expiresAt]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) {
      addToast({ type: 'warning', title: 'Llave requerida', message: 'Por favor ingrese una llave de licencia.' });
      return;
    }

    const result = await activateLicense(licenseKey);
    if (result.plan) {
      addToast({
        type: 'success',
        title: '¡Licencia Activada!',
        message: `Plan ${result.plan.toUpperCase()} activado correctamente.`
      });
      setLicenseKey('');
      updateState();

      // Animación flash de éxito
      animate('.license-status-badge', {
        scale: [1, 1.2, 1],
        backgroundColor: ['var(--bg-input)', 'rgba(34, 197, 94, 0.1)', 'var(--bg-input)'],
        duration: 800,
        easing: 'easeInOutSine'
      });
    } else {
      addToast({
        type: 'error',
        title: 'Llave Inválida',
        message: 'La llave de licencia no es válida, ha expirado, o la firma fue alterada.'
      });
    }
  };

  const handleDeactivate = () => {
    deactivateLicense();
    addToast({
      type: 'info',
      title: 'Licencia Removida',
      message: 'El sistema ha retornado al estado bloqueado.'
    });
    updateState();
  };

  const handleStartDemo = () => {
    startDemo();
    addToast({
      type: 'success',
      title: 'Demo Iniciada',
      message: 'Dispone de 5 minutos de acceso ilimitado al sistema.'
    });
    updateState();
  };

  const currentPlan = licenseState.plan;
  const limits = currentPlan ? PLAN_LIMITS[currentPlan] : null;

  // Urgency color mapping
  const urgencyColors: Record<string, { bg: string; border: string; text: string; bar: string }> = {
    ok: { bg: 'rgba(34, 197, 94, 0.06)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e', bar: 'linear-gradient(90deg, #22c55e 0%, #10b981 100%)' },
    warning: { bg: 'rgba(251, 191, 36, 0.06)', border: 'rgba(251, 191, 36, 0.2)', text: 'var(--brand-gold)', bar: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)' },
    danger: { bg: 'rgba(239, 68, 68, 0.06)', border: 'rgba(239, 68, 68, 0.2)', text: '#ef4444', bar: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)' },
    expired: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', bar: '#ef4444' },
  };

  const renderLimitBar = (label: string, current: number, limit: number, icon: React.ReactNode) => {
    const isInfinite = limit === Infinity || licenseState.demoActive;
    const displayLimit = isInfinite ? 'Ilimitado' : limit.toString();
    const pct = isInfinite ? 0 : Math.min(100, (current / limit) * 100);
    
    // Determine color based on usage percentage
    let barColor = 'var(--brand-primary)';
    if (!isInfinite) {
      if (pct >= 90) barColor = '#ef4444'; // Red
      else if (pct >= 70) barColor = 'var(--brand-gold)'; // Gold
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }} className="about-stagger-pill">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {icon}
            <span>{label}</span>
          </div>
          <span style={{ fontSize: '12.5px', fontWeight: 800, color: pct >= 90 ? '#ef4444' : 'var(--text-secondary)' }}>
            {current} / {displayLimit} {!isInfinite && `(${Math.round(pct)}%)`}
          </span>
        </div>
        
        {/* Progress Track */}
        <div style={{ 
          width: '100%', 
          height: '10px', 
          backgroundColor: 'var(--bg-primary)', 
          borderRadius: '50px', 
          overflow: 'hidden',
          border: '1.5px solid var(--border-color)',
          position: 'relative'
        }}>
          <div style={{
            height: '100%',
            backgroundColor: barColor,
            width: isInfinite ? '100%' : `${pct}%`,
            borderRadius: '50px',
            background: isInfinite ? 'linear-gradient(90deg, var(--brand-primary) 0%, var(--brand-gold) 100%)' : undefined,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>
      </div>
    );
  };

  const formatExpiryDate = (isoStr: string | null): string => {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day} de ${month} de ${year} a las ${hours}:${mins}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* SECCIÓN 1: ESTADO DE LICENCIA Y ACCESO DEMO */}
      <div className="widget about-stagger-card" style={{ padding: '24px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              backgroundColor: licenseState.isLocked ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
              color: licenseState.isLocked ? '#ef4444' : '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={28} className={licenseState.demoActive ? 'spin' : ''} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                Licencia y Estado del Sistema
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                {licenseState.isLocked 
                  ? licenseState.isExpired 
                    ? 'La licencia comercial ha expirado. Ingrese una nueva llave para reactivar el sistema.'
                    : 'El sistema está bloqueado. Inicie la demo gratuita o active su licencia comercial.'
                  : licenseState.demoActive
                    ? `Ejecutando demostración por tiempo limitado (${countdown} restante).`
                    : `Suscripción comercial activa: Plan ${licenseState.plan?.toUpperCase()} activado.`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {licenseState.isLocked && (
              <button
                onClick={handleStartDemo}
                className="btn-yellow"
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--button-radius)',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  boxShadow: '0 0 16px rgba(var(--brand-primary-h), var(--brand-primary-s), var(--brand-primary-l), 0.2)'
                }}
              >
                Iniciar Demo (5 min)
              </button>
            )}
            
            {licenseState.demoActive && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                border: '1.5px solid rgba(251, 191, 36, 0.25)',
                borderRadius: '12px',
                color: 'var(--brand-gold)',
                fontSize: '13px',
                fontWeight: 900,
                fontFamily: 'monospace'
              }}>
                ⏱️ DEMO ACTIVA: {countdown}
              </div>
            )}

            {!licenseState.isLocked && !licenseState.demoActive && (
              <button
                onClick={handleDeactivate}
                className="btn-pill-dark"
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--button-radius)',
                  fontSize: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <LogOut size={13} />
                <span>Desactivar Licencia</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de progreso de la demo */}
        {licenseState.demoActive && (
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '50px', marginTop: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{
              height: '100%',
              backgroundColor: 'var(--brand-gold)',
              borderRadius: '50px',
              width: `${(licenseState.demoTimeLeft / 300) * 100}%`,
              transition: 'width 1s linear'
            }} />
          </div>
        )}
      </div>

      {/* ═══════════ SECCIÓN DE EXPIRACIÓN DE LICENCIA ═══════════ */}
      {licenseState.plan && !licenseState.demoActive && licenseState.expiresAt && (
        <div className="widget about-stagger-card" style={{
          padding: '24px',
          borderRadius: 'var(--card-radius)',
          border: `1.5px solid ${urgencyColors[expiryInfo.urgency].border}`,
          backgroundColor: urgencyColors[expiryInfo.urgency].bg,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '14px',
                  backgroundColor: urgencyColors[expiryInfo.urgency].bg,
                  border: `1px solid ${urgencyColors[expiryInfo.urgency].border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {expiryInfo.isExpired 
                    ? <AlertTriangle size={22} style={{ color: '#ef4444' }} />
                    : <CalendarClock size={22} style={{ color: urgencyColors[expiryInfo.urgency].text }} />
                  }
                </div>
                <div>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                    {expiryInfo.isExpired ? 'Licencia Expirada' : 'Vigencia de la Licencia'}
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    {expiryInfo.isExpired
                      ? 'Su licencia ha caducado. Ingrese una nueva llave para continuar.'
                      : `Expira: ${formatExpiryDate(licenseState.expiresAt)}`
                    }
                  </p>
                </div>
              </div>

              {/* Live countdown badge */}
              <div style={{
                padding: '8px 16px',
                borderRadius: '12px',
                backgroundColor: urgencyColors[expiryInfo.urgency].bg,
                border: `1.5px solid ${urgencyColors[expiryInfo.urgency].border}`,
                color: urgencyColors[expiryInfo.urgency].text,
                fontSize: '14px',
                fontWeight: 900,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: expiryInfo.urgency === 'danger' || expiryInfo.urgency === 'expired' ? 'pulse 2s infinite' : 'none',
              }}>
                <Clock size={16} />
                <span>{expiryInfo.label}</span>
              </div>
            </div>

            {/* Detailed countdown grid */}
            {!expiryInfo.isExpired && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {[
                  { value: expiryInfo.days, label: 'Días' },
                  { value: expiryInfo.hours, label: 'Horas' },
                  { value: expiryInfo.minutes, label: 'Minutos' },
                  { value: expiryInfo.seconds, label: 'Segundos' },
                ].map((item) => (
                  <div key={item.label} style={{
                    textAlign: 'center',
                    padding: '12px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      color: urgencyColors[expiryInfo.urgency].text,
                      lineHeight: 1,
                    }}>
                      {item.value.toString().padStart(2, '0')}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginTop: '4px',
                    }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Progress bar */}
            <div style={{
              width: '100%', height: '8px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '50px', overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{
                height: '100%',
                borderRadius: '50px',
                width: `${Math.max(2, expiryInfo.percentage)}%`,
                background: urgencyColors[expiryInfo.urgency].bar,
                transition: 'width 1s linear',
              }} />
            </div>

            {/* Key info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Llave: <code style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{licenseState.key ? `${licenseState.key.slice(0, 20)}...` : '—'}</code></span>
              <span>Plan: <strong style={{ color: urgencyColors[expiryInfo.urgency].text }}>{licenseState.plan?.toUpperCase()}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN DE CAPACIDAD Y USO DEL PLAN */}
      {!licenseState.isLocked && (
        <div className="widget about-stagger-card" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'left' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
              Capacidad y Consumo del Plan ({licenseState.demoActive ? 'Demo de Prueba Activa' : `Plan ${currentPlan?.toUpperCase()}`})
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Monitoreo del uso actual de los recursos del sistema en comparación con las limitaciones de su suscripción.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px' }}>
            {renderLimitBar('Productos en Catálogo', counts.products, limits ? limits.maxProducts : Infinity, <Package size={16} style={{ color: 'var(--brand-primary)' }} />)}
            {renderLimitBar('Clientes Registrados', counts.clients, limits ? limits.maxClients : Infinity, <Users size={16} style={{ color: '#8b5cf6' }} />)}
            {renderLimitBar('Ventas Totales Realizadas', counts.sales, limits ? limits.maxSales : Infinity, <ShoppingCart size={16} style={{ color: 'var(--brand-gold)' }} />)}
          </div>
        </div>
      )}

      {/* SECCIÓN 2: FORMULARIO DE ACTIVACIÓN Y DESARROLLADOR */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: '24px' }}>
        
        {/* PANEL IZQUIERDO: DESARROLLADOR Y STACK */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Ficha del Desarrollador */}
          <div className="widget about-stagger-card" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, textAlign: 'left' }}>
              Desarrollador del Sistema
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'left' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-gold) 100%)',
                color: '#fff', fontSize: '24px', fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(14, 165, 164, 0.25)'
              }}>
                J
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Jonas
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--brand-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Lead Software Engineer & Architect
                </span>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  Apasionado por la optimización de código y el desarrollo de sistemas transaccionales híbridos, modulares y de alto rendimiento.
                </p>
              </div>
            </div>
          </div>

          {/* Stack Tecnológico */}
          <div className="widget about-stagger-card" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, textAlign: 'left' }}>
              Stack Tecnológico Premium
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              
              <div className="about-stagger-pill" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Cpu size={20} style={{ color: 'var(--brand-primary)' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>React 19</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Core framework reactivo</span>
                </div>
              </div>

              <div className="about-stagger-pill" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <HardDrive size={20} style={{ color: 'var(--brand-gold)' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>RxDB + Dexie</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BD local IndexedDB</span>
                </div>
              </div>

              <div className="about-stagger-pill" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Terminal size={20} style={{ color: '#10b981' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>Anime.js v4</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Animaciones de alto impacto</span>
                </div>
              </div>

              <div className="about-stagger-pill" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Smartphone size={20} style={{ color: '#8b5cf6' }} />
                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'block' }}>Capacitor / Tauri</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Despliegue móvil y desktop</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* PANEL DERECHO: FORMULARIO ACTIVAR LICENCIA */}
        <div className="widget about-stagger-card" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: 0, textAlign: 'left' }}>
            Activar Licencia
          </h4>
          
          <div style={{
            padding: '14px', borderRadius: '12px',
            backgroundColor: licenseState.isLocked ? 'rgba(239, 68, 68, 0.04)' : 'rgba(34, 197, 94, 0.04)',
            border: `1px dashed ${licenseState.isLocked ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)'}`,
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'left'
          }} className="license-status-badge">
            {licenseState.isLocked ? (
              <>
                <Ban size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {licenseState.isExpired ? 'Licencia expirada. Ingrese una nueva llave.' : 'Sin licencia activa en este equipo.'}
                </span>
              </>
            ) : (
              <>
                <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  Licencia activa: <strong>{licenseState.plan?.toUpperCase()}</strong>
                </span>
              </>
            )}
          </div>

          <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Llave de Licencia
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="ej: SM-PRO-V12345-20271231-XXXX"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 700,
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-yellow"
              style={{
                width: '100%', padding: '12px 0', borderRadius: 'var(--button-radius)',
                justifyContent: 'center', fontSize: '12.5px', fontWeight: 800, gap: '6px'
              }}
            >
              <Award size={15} />
              <span>Validar Licencia</span>
            </button>
          </form>


        </div>

      </div>

      {/* SECCIÓN 3: TABLA COMPARATIVA DE PLANES Y LIMITACIONES */}
      <div className="widget about-stagger-card" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ textAlign: 'left' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
            Planes de Suscripción y Limitaciones
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Compare las capacidades del sistema según su nivel de licencia actual.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
          
          {/* PLAN BÁSICO ($5) */}
          <div style={{
            padding: '20px', borderRadius: '16px',
            border: licenseState.plan === 'basic' ? '2px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
            backgroundColor: licenseState.plan === 'basic' ? 'rgba(14, 165, 164, 0.03)' : 'var(--bg-card)',
            display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left',
            boxShadow: licenseState.plan === 'basic' ? '0 10px 24px rgba(14, 165, 164, 0.15)' : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Básico</strong>
              <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '50px', backgroundColor: 'rgba(14, 165, 164, 0.1)', color: 'var(--brand-primary)' }}>$5 USD</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              <div>• Catálogo: <strong>Máx. 10 productos</strong></div>
              <div>• Clientes: <strong>Máx. 10 clientes</strong></div>
              <div>• Transacciones: <strong>Máx. 20 ventas totales</strong></div>
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }}></div>
              <div>• <strong>Secciones Habilitadas:</strong></div>
              <div style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>Resumen, Ventas POS, Inventario, Arqueo de Caja</div>
              <div style={{ color: '#ef4444', fontSize: '10.5px', marginTop: '4px' }}>• Otras secciones bloqueadas completamente</div>
            </div>
          </div>

          {/* PLAN MEDIO ($12) */}
          <div style={{
            padding: '20px', borderRadius: '16px',
            border: licenseState.plan === 'pro' ? '2px solid var(--brand-gold)' : '1.5px solid var(--border-color)',
            backgroundColor: licenseState.plan === 'pro' ? 'rgba(251, 191, 36, 0.03)' : 'var(--bg-card)',
            display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left',
            boxShadow: licenseState.plan === 'pro' ? '0 10px 24px rgba(251, 191, 36, 0.15)' : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Medio / Pro</strong>
              <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '50px', backgroundColor: 'rgba(251, 191, 36, 0.1)', color: 'var(--brand-gold)' }}>$12 USD</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              <div>• Catálogo: <strong>Máx. 100 productos</strong></div>
              <div>• Clientes: <strong>Máx. 50 clientes</strong></div>
              <div>• Transacciones: <strong>Máx. 200 ventas totales</strong></div>
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }}></div>
              <div>• <strong>Secciones Habilitadas:</strong></div>
              <div style={{ color: 'var(--brand-gold)', fontWeight: 700 }}>Básico + Compras, Clientes, Proveedores</div>
              <div style={{ color: '#ef4444', fontSize: '10.5px', marginTop: '4px' }}>• Sin Nómina, Reportes ni Auditoría</div>
            </div>
          </div>

          {/* PLAN PREMIUM ($25) */}
          <div style={{
            padding: '20px', borderRadius: '16px',
            border: licenseState.plan === 'premium' ? '2px solid #10b981' : '1.5px solid var(--border-color)',
            backgroundColor: licenseState.plan === 'premium' ? 'rgba(16, 185, 129, 0.03)' : 'var(--bg-card)',
            display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left',
            boxShadow: licenseState.plan === 'premium' ? '0 10px 24px rgba(16, 185, 129, 0.15)' : 'none'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Premium / Full</strong>
              <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '50px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>$25 USD</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              <div>• Catálogo: <strong>Ilimitado</strong></div>
              <div>• Clientes: <strong>Ilimitado</strong></div>
              <div>• Transacciones: <strong>Ilimitado</strong></div>
              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '4px 0' }}></div>
              <div>• <strong>Secciones Habilitadas:</strong></div>
              <div style={{ color: '#10b981', fontWeight: 700 }}>Todo el Sistema 100% Desbloqueado</div>
              <div style={{ color: '#22c55e', fontSize: '10.5px', marginTop: '4px' }}>• Sin restricciones de vistas ni funciones</div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
