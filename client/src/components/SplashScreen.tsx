import { useEffect, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { animate, createTimeline, stagger } from 'animejs';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [statusText, setStatusText] = useState('Inicializando módulos...');
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleText = "StockMasterPro";

  useEffect(() => {
    // Cargar y aplicar configuración del tema (Modo claro/oscuro)
    try {
      const raw = localStorage.getItem('stockmaster_theme_settings');
      if (raw) {
        const s = JSON.parse(raw);
        const mode = s.mode || 'dark';
        document.body.classList.toggle('dark-theme', mode === 'dark');
        document.body.classList.toggle('light-theme', mode === 'light');
        if (s.primaryColor) {
          document.body.style.setProperty('--brand-primary', s.primaryColor);
        }
      }
    } catch (e) {
      console.error('Error loading theme settings in splash:', e);
    }

    // 1. Configuración de la línea de tiempo de entrada con Anime.js v4
    const timeline = createTimeline();

    // Entrada del logotipo: Rotación y escala elástica
    timeline.add('.splash-logo-container', {
      scale: [0, 1],
      opacity: [0, 1],
      rotate: '360deg',
      duration: 1200,
      ease: 'outElastic(1, 0.8)'
    });

    // Entrada escalonada (staggered) de las letras del título
    timeline.add('.splash-title-char', {
      translateY: [25, 0],
      opacity: [0, 1],
      scale: [0.7, 1],
      delay: stagger(50),
      duration: 800,
      ease: 'outBack'
    }, '-=600'); // Solapar el inicio con la animación del logo

    // Entrada del contenedor de la barra de progreso y estado
    timeline.add('.splash-progress-wrapper, .splash-status-text', {
      translateY: [15, 0],
      opacity: [0, 1],
      duration: 600,
      delay: stagger(100),
      ease: 'outQuad'
    }, '-=400');

    // Animación de pulso continuo sutil para el logotipo
    const logoPulse = animate('.splash-logo-container', {
      scale: [1, 1.05, 1],
      duration: 2000,
      loop: true,
      ease: 'inOutSine',
      autoplay: false
    });

    // Iniciar el pulso del logo después de la entrada
    const pulseTimer = setTimeout(() => {
      logoPulse.play();
    }, 1200);

    // Simulación de las fases de carga
    const phases = [
      { text: 'Conectando al replicador de base de datos...', time: 800, val: 25 },
      { text: 'Sincronizando registros locales (RxDB)...', time: 1800, val: 55 },
      { text: 'Verificando firmas de sesión...', time: 2800, val: 85 },
      { text: 'Listo para operar', time: 3600, val: 100 }
    ];

    const phaseTimers = phases.map((p) => 
      setTimeout(() => {
        setStatusText(p.text);
        setProgress(p.val);
      }, p.time)
    );

    // 2. Cierre y salida (Exit Transition) con desenfoque
    const exitTimer = setTimeout(() => {
      logoPulse.pause();
      
      const exitTimeline = createTimeline({
        onComplete: () => {
          onFinish();
        }
      });

      if (containerRef.current) {
        exitTimeline.add(containerRef.current, {
          opacity: [1, 0],
          scale: 1.06,
          filter: ['blur(0px)', 'blur(12px)'],
          duration: 750,
          ease: 'inExpo'
        });
      } else {
        onFinish();
      }
    }, 4200);

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(exitTimer);
      phaseTimers.forEach(clearTimeout);
      logoPulse.pause();
    };

  }, [onFinish]);

  const titleChars = titleText.split('');

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary, #050508)', // Fondo dinámico claro/oscuro
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        overflow: 'hidden',
        willChange: 'transform, opacity, filter'
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        marginBottom: '28px'
      }}>
        
        {/* Logotipo Animado */}
        <div 
          className="splash-logo-container"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, var(--brand-primary, #0ea5e9), var(--brand-primary-light, #20e3b2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(14, 165, 233, 0.25)',
            opacity: 0,
            transform: 'scale(0)'
          }}
        >
          <Package size={28} color="var(--bg-primary, #050508)" strokeWidth={2.5} />
        </div>

        {/* Título de la Aplicación */}
        <div style={{ textAlign: 'center' }}>
          <h1 
            style={{
              margin: 0,
              fontSize: '38px',
              fontWeight: 400,
              color: 'var(--text-primary, #ffffff)', // Texto dinámico claro/oscuro
              fontFamily: 'var(--font-script)', // Satisfy
              lineHeight: 1.1,
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            {titleChars.map((char, index) => (
              <span 
                key={index}
                className="splash-title-char"
                style={{
                  display: 'inline-block',
                  opacity: 0,
                  whiteSpace: char === ' ' ? 'pre' : 'normal'
                }}
              >
                {char}
              </span>
            ))}
          </h1>
        </div>
      </div>

      {/* Contenedor de la Barra de Carga */}
      <div 
        className="splash-progress-wrapper"
        style={{
          width: '180px',
          height: '3.5px',
          borderRadius: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          overflow: 'hidden',
          opacity: 0,
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.6)'
        }}
      >
        <div 
          style={{
            height: '100%',
            borderRadius: '4px',
            background: 'linear-gradient(90deg, var(--brand-primary, #0ea5e9), var(--brand-primary-light, #20e3b2))',
            boxShadow: '0 0 6px rgba(14, 165, 233, 0.5)',
            transition: 'width 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            width: `${progress}%`
          }}
        />
      </div>

      {/* Texto de Estado Dinámico */}
      <p 
        className="splash-status-text"
        style={{
          marginTop: '14px',
          fontSize: '10.5px',
          color: 'var(--text-muted, #64748b)',
          fontWeight: 700,
          letterSpacing: '0.3px',
          opacity: 0,
          height: '16px' // Evitar Layout Shift
        }}
      >
        {statusText}
      </p>
    </div>
  );
}
