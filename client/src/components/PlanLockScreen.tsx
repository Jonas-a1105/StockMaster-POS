import React, { useEffect } from 'react';
import { Lock, ArrowRight, ShieldAlert } from 'lucide-react';
import { animate } from 'animejs';

interface PlanLockScreenProps {
  requiredPlan: 'basic' | 'pro' | 'premium';
  sectionName: string;
  onGoToAbout: () => void;
}

export const PlanLockScreen: React.FC<PlanLockScreenProps> = ({
  requiredPlan,
  sectionName,
  onGoToAbout,
}) => {
  useEffect(() => {
    // Animación de entrada de los elementos
    animate('.lock-screen-icon-container', {
      scale: [0.6, 1.1, 1],
      opacity: [0, 1],
      duration: 650,
      easing: 'outElastic(1, .8)'
    });

    animate('.lock-screen-stagger', {
      translateY: [20, 0],
      opacity: [0, 1],
      delay: (el: any, i: number) => 250 + i * 80,
      duration: 500,
      easing: 'outBack'
    });
  }, [sectionName]);

  const planNames = {
    basic: 'Básico ($5 USD)',
    pro: 'Medio / Pro ($12 USD)',
    premium: 'Premium / Full ($25 USD)'
  };

  const planColors = {
    basic: 'var(--brand-primary)',
    pro: 'var(--brand-gold)',
    premium: '#10b981'
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      width: '100%',
      height: '100%',
      minHeight: '450px',
      backgroundColor: 'var(--bg-card)',
      borderRadius: 'var(--card-radius)',
      border: '1.5px solid var(--border-color)',
      gap: '24px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden'
    }} className="animate-entrance">
      
      {/* GLOW DE FONDO */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        backgroundColor: planColors[requiredPlan],
        filter: 'blur(100px)',
        opacity: 0.05,
        pointerEvents: 'none'
      }} />

      {/* ICONO */}
      <div className="lock-screen-icon-container" style={{
        padding: '24px',
        borderRadius: '50%',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        color: '#ef4444',
        boxShadow: '0 8px 30px rgba(239, 68, 68, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2
      }}>
        <Lock size={44} />
      </div>

      {/* DETALLES DE RESTRICCIÓN */}
      <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '420px' }}>
        <h3 className="lock-screen-stagger" style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
          Módulo Restringido
        </h3>
        <p className="lock-screen-stagger" style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
          La sección **{sectionName}** no está habilitada en su nivel de licencia actual.
        </p>
      </div>

      {/* REQUERIMIENTOS DEL PLAN */}
      <div className="lock-screen-stagger" style={{
        padding: '12px 18px',
        borderRadius: '12px',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        fontSize: '12.5px',
        color: 'var(--text-secondary)',
        fontWeight: 600,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        Requiere plan: 
        <strong style={{ color: planColors[requiredPlan], textTransform: 'uppercase' }}>
          {planNames[requiredPlan]}
        </strong>
      </div>

      {/* ACCIÓN DE UPGRADE */}
      <button
        onClick={onGoToAbout}
        className="btn-yellow lock-screen-stagger"
        style={{
          padding: '12px 24px',
          borderRadius: 'var(--button-radius)',
          fontSize: '13px',
          fontWeight: 800,
          zIndex: 2,
          gap: '8px',
          boxShadow: '0 6px 20px rgba(var(--brand-primary-h), var(--brand-primary-s), var(--brand-primary-l), 0.15)'
        }}
      >
        <span>Ver Planes y Activar Licencia</span>
        <ArrowRight size={14} />
      </button>

    </div>
  );
};
