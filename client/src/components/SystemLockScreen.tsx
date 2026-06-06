import React, { useState, useEffect } from 'react';
import { ShieldAlert, KeyRound, Award, Play, LogOut } from 'lucide-react';
import { animate } from 'animejs';
import { activateLicense, startDemo } from '../utils/license';
import { useToast } from './ToastNotification';

interface SystemLockScreenProps {
  onUnlockSuccess: () => void;
  onLogout: () => void;
  isMobile: boolean;
}

export const SystemLockScreen: React.FC<SystemLockScreenProps> = ({
  onUnlockSuccess,
  onLogout,
  isMobile,
}) => {
  const { addToast } = useToast();
  const [licenseKey, setLicenseKey] = useState('');

  useEffect(() => {
    // Animación de respiración / brillo continuo en el escudo de bloqueo
    animate('.system-lock-shield', {
      scale: [1, 1.06, 1],
      opacity: [0.9, 1, 0.9],
      duration: 2500,
      loop: true,
      easing: 'easeInOutSine'
    });

    // Entrada animada
    animate('.system-lock-stagger', {
      translateY: [30, 0],
      opacity: [0, 1],
      delay: (el: any, i: number) => i * 100,
      duration: 600,
      easing: 'outBack'
    });
  }, []);

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
        title: '¡Sistema Activado!',
        message: `Se ha desbloqueado el sistema en el Plan ${result.plan.toUpperCase()}.`
      });
      onUnlockSuccess();
    } else {
      addToast({
        type: 'error',
        title: 'Licencia Inválida',
        message: 'La llave de licencia no tiene un formato válido (BASIC-XXX, PRO-XXX, PREM-XXX).'
      });
    }
  };

  const handleStartDemo = () => {
    startDemo();
    addToast({
      type: 'success',
      title: 'Demo Activada',
      message: 'Dispone de 5 minutos de acceso sin restricciones al sistema.'
    });
    onUnlockSuccess();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(9, 9, 11, 0.95)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 5000, // Por encima de todo
      padding: '20px',
      color: '#fff'
    }}>
      
      {/* Glow de fondo animado */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        backgroundColor: 'var(--brand-primary)',
        filter: 'blur(150px)',
        opacity: 0.1,
        pointerEvents: 'none'
      }} />

      <div
        className="widget system-lock-stagger"
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'rgba(20, 20, 23, 0.7)',
          borderRadius: '24px',
          border: '1.5px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 30px 70px rgba(0, 0, 0, 0.8)',
          padding: '40px 30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          backdropFilter: 'blur(10px)'
        }}
      >
        {/* ESCUDO DE BLOQUEO */}
        <div className="system-lock-shield" style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 0 30px rgba(239, 68, 68, 0.15)'
        }}>
          <ShieldAlert size={40} />
        </div>

        {/* TÍTULO */}
        <h2 className="system-lock-stagger" style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
          Sistema POS Bloqueado
        </h2>
        <p className="system-lock-stagger" style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 28px 0' }}>
          Para acceder a las herramientas de facturación, inventario y auditoría, debe validar una licencia comercial o iniciar un período de prueba gratuito.
        </p>

        {/* ACCIONES */}
        <div className="system-lock-stagger" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', marginBottom: '24px' }}>
          
          {/* Formulario licencia */}
          <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <KeyRound size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Ingrese su llave de licencia..."
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: '12px',
                  border: '1.5px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
              />
            </div>
            <button
              type="submit"
              className="btn-yellow"
              style={{
                width: '100%', padding: '12px 0', borderRadius: 'var(--button-radius)',
                justifyContent: 'center', fontSize: '13px', fontWeight: 800, gap: '6px'
              }}
            >
              <Award size={15} />
              <span>Activar Licencia Comercial</span>
            </button>
          </form>

          {/* Divisor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <span>O TAMBIÉN</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Botón Demo */}
          <button
            onClick={handleStartDemo}
            className="btn-pill-dark"
            style={{
              width: '100%', padding: '12px 0', borderRadius: 'var(--button-radius)',
              justifyContent: 'center', fontSize: '13px', fontWeight: 800, gap: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer'
            }}
          >
            <Play size={14} style={{ color: 'var(--brand-primary)' }} />
            <span>Iniciar Período de Prueba (5 min)</span>
          </button>
        </div>



        {/* BOTÓN SALIDA / DESARROLLADOR */}
        <div className="system-lock-stagger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.35)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
          <span>Desarrollado por <strong>Jonas</strong></span>
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: 'none', color: '#ef4444',
              display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
              fontWeight: 700, fontSize: '11px'
            }}
          >
            <LogOut size={13} />
            <span>Salir</span>
          </button>
        </div>

      </div>

    </div>
  );
};
