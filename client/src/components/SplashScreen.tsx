import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('ready'), 800);
    const t2 = setTimeout(() => onFinish(), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onFinish]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#0a0a0d',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
        transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: phase === 'ready' ? 'scale(1)' : 'scale(0.85)',
        opacity: phase === 'ready' ? 1 : 0.5,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'linear-gradient(135deg, #df9eff, #20e3b2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Package size={26} color="#0a0a0d" strokeWidth={2.5} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
            StockMaster
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 10, color: '#5e6068', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
            POS System
          </p>
        </div>
      </div>

      <div style={{
        width: 160, height: 3, borderRadius: 2,
        backgroundColor: '#1a1a1e', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'linear-gradient(90deg, #df9eff, #20e3b2)',
          transition: 'width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          width: phase === 'ready' ? '100%' : '20%',
        }} />
      </div>

      <p style={{ marginTop: 16, fontSize: 11, color: '#5e6068', fontWeight: 600 }}>
        {phase === 'loading' ? 'Inicializando...' : 'Cargando datos locales'}
      </p>
    </div>
  );
}
