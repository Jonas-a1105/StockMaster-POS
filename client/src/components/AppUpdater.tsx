import { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  Download, 
  Search, 
  CheckCircle2, 
  X, 
  Clock, 
  Activity, 
  Sparkles,
  ArrowUpCircle,
  AlertCircle
} from 'lucide-react';
import { animate } from 'animejs';
import { useTheme } from '../contexts/ThemeContext';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateState = 'IDLE' | 'CHECKING' | 'UPDATE_AVAILABLE' | 'DOWNLOADING' | 'DOWNLOADED';

interface AppUpdaterProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion?: string;
  onUpdateDownloaded?: () => void;
  onCheckStatus?: (status: UpdateState) => void;
}

// Detect if we are running inside the Tauri environment
const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

export default function AppUpdater({ 
  isOpen, 
  onClose, 
  currentVersion = 'v2.1.0', 
  onUpdateDownloaded,
  onCheckStatus 
}: AppUpdaterProps) {
  const { settings } = useTheme();
  const [state, setState] = useState<UpdateState>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Real or simulated update metadata
  const [tauriUpdate, setTauriUpdate] = useState<any>(null);
  
  // Real-time download variables
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0); // in MB/s
  const [downloadedBytes, setDownloadedBytes] = useState(0); // in MB
  const [totalSize, setTotalSize] = useState(34.8); // Default simulated size in MB
  const [etaSeconds, setEtaSeconds] = useState(0);

  const searchPulseRef = useRef<any>(null);
  const downloadBounceRef = useRef<any>(null);
  const progressAnimationRef = useRef<any>(null);

  // Trigger callbacks when state changes
  useEffect(() => {
    if (onCheckStatus) {
      onCheckStatus(state);
    }
  }, [state, onCheckStatus]);

  // Clean up animations when component unmounts or state changes
  const stopAnimations = () => {
    if (searchPulseRef.current) {
      searchPulseRef.current.pause();
      searchPulseRef.current = null;
    }
    if (downloadBounceRef.current) {
      downloadBounceRef.current.pause();
      downloadBounceRef.current = null;
    }
    if (progressAnimationRef.current) {
      progressAnimationRef.current.pause();
      progressAnimationRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopAnimations();
  }, []);

  // Animaciones específicas según el estado
  useEffect(() => {
    if (!isOpen) return;
    
    stopAnimations();

    if (state === 'CHECKING') {
      // 1. Animación de pulso/onda de radar
      searchPulseRef.current = animate('.search-radar-ring', {
        scale: [1, 2.4],
        opacity: [0.8, 0],
        duration: 1200,
        loop: true,
        easing: 'easeOutQuad'
      });

      // Animación de rotación del icono de búsqueda
      animate('.search-radar-icon', {
        rotate: '360deg',
        duration: 1500,
        loop: true,
        easing: 'linear'
      });
    }

    if (state === 'UPDATE_AVAILABLE') {
      // 2. Animación de entrada de la tarjeta de actualización y rebote de advertencia
      animate('.update-info-card', {
        scale: [0.9, 1],
        opacity: [0, 1],
        duration: 600,
        easing: 'outBack'
      });

      animate('.update-alert-badge', {
        translateY: [0, -6, 0],
        duration: 1000,
        loop: true,
        easing: 'easeInOutSine'
      });
    }

    if (state === 'DOWNLOADING') {
      // 3. Animación de rebote infinito de la flecha de descarga
      downloadBounceRef.current = animate('.download-bounce-arrow', {
        translateY: [-6, 6],
        duration: 800,
        loop: true,
        direction: 'alternate',
        easing: 'easeInOutSine'
      });
    }

    if (state === 'DOWNLOADED') {
      // 4. Animación de escala de éxito y explosión de estrellitas
      animate('.success-check-badge', {
        scale: [0.3, 1.2, 1],
        duration: 800,
        easing: 'outBack'
      });

      animate('.success-sparkle', {
        scale: [0.5, 1.2],
        opacity: [0, 1, 0],
        delay: (el: any, i: number) => i * 100,
        duration: 1200,
        loop: true,
        easing: 'easeOutQuad'
      });
    }
  }, [state, isOpen]);

  // Manejo del progreso de la descarga en tiempo real
  useEffect(() => {
    if (state !== 'DOWNLOADING') return;

    if (!isTauri) {
      // ── MODO SIMULADO (Navegador) ──
      setProgress(0);
      setDownloadedBytes(0);
      setDownloadSpeed(2.4);
      setTotalSize(34.8);

      let progressVal = 0;
      const intervalTime = 800;
      
      const interval = setInterval(() => {
        const currentSpeed = parseFloat((Math.random() * (3.2 - 1.8) + 1.8).toFixed(1));
        setDownloadSpeed(currentSpeed);

        const increment = ((currentSpeed * (intervalTime / 1000)) / 34.8) * 100;
        progressVal = Math.min(100, progressVal + increment);
        
        setProgress(progressVal);
        const downloaded = parseFloat(((progressVal / 100) * 34.8).toFixed(1));
        setDownloadedBytes(downloaded);

        const remainingBytes = 34.8 - downloaded;
        const eta = Math.ceil(remainingBytes / currentSpeed);
        setEtaSeconds(progressVal >= 100 ? 0 : eta);

        if (progressAnimationRef.current) progressAnimationRef.current.pause();
        progressAnimationRef.current = animate('.download-progress-bar-fill', {
          width: `${progressVal}%`,
          duration: 400,
          easing: 'easeOutQuad'
        });

        if (progressVal >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setState('DOWNLOADED');
            if (onUpdateDownloaded) {
              onUpdateDownloaded();
            }
          }, 600);
        }
      }, intervalTime);

      return () => clearInterval(interval);
    } else {
      // ── MODO REAL (Tauri Updater) ──
      if (!tauriUpdate) return;
      
      setProgress(0);
      setDownloadedBytes(0);
      setDownloadSpeed(0);
      
      let downloaded = 0;
      let totalLength = 0;
      const startTime = Date.now();
      
      tauriUpdate.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            totalLength = event.data.contentLength || 0;
            setTotalSize(parseFloat((totalLength / (1024 * 1024)).toFixed(1)));
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            const currentProgress = totalLength ? (downloaded / totalLength) * 100 : 0;
            setProgress(currentProgress);
            
            // Calcular velocidad promedio y tamaño en MB
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const speed = elapsedSeconds ? (downloaded / (1024 * 1024)) / elapsedSeconds : 0;
            setDownloadSpeed(parseFloat(speed.toFixed(1)));
            setDownloadedBytes(parseFloat((downloaded / (1024 * 1024)).toFixed(1)));
            
            if (totalLength) {
              const remainingBytes = totalLength - downloaded;
              const eta = speed ? (remainingBytes / (1024 * 1024)) / speed : 0;
              setEtaSeconds(Math.ceil(eta));
            }
            
            if (progressAnimationRef.current) progressAnimationRef.current.pause();
            progressAnimationRef.current = animate('.download-progress-bar-fill', {
              width: `${currentProgress}%`,
              duration: 400,
              easing: 'easeOutQuad'
            });
            break;
          case 'Finished':
            setProgress(100);
            setState('DOWNLOADED');
            if (onUpdateDownloaded) {
              onUpdateDownloaded();
            }
            break;
        }
      }).catch((err: any) => {
        console.error('Error downloading Tauri update:', err);
        setErrorMessage(err.message || 'Error al descargar la actualización.');
        setState('IDLE');
      });
    }
  }, [state, tauriUpdate]);

  const handleStartCheck = async () => {
    setState('CHECKING');
    setErrorMessage(null);

    if (!isTauri) {
      // Simular búsqueda y encontrar actualización
      setTimeout(() => {
        setState('UPDATE_AVAILABLE');
      }, 2200);
      return;
    }

    try {
      const update = await check();
      if (update) {
        setTauriUpdate(update);
        setState('UPDATE_AVAILABLE');
      } else {
        setState('IDLE');
        alert('El sistema está actualizado a la última versión.');
      }
    } catch (err: any) {
      console.error('Error checking for updates:', err);
      setErrorMessage(err.message || 'Error al conectar con el servidor de actualizaciones.');
      setState('IDLE');
    }
  };

  const handleInstallNow = async () => {
    if (!isTauri) {
      // Simulación de reinicio
      if (state === 'DOWNLOADED') {
        animate('.modal-updater-panel', {
          scale: [1, 0.8],
          opacity: [1, 0],
          duration: 400,
          easing: 'inQuad',
          complete: () => {
            window.location.reload();
          }
        });
      }
    } else {
      // Relaunch real de la aplicación Tauri
      try {
        await relaunch();
      } catch (err: any) {
        console.error('Error relaunching Tauri application:', err);
        // Fallback a recarga
        window.location.reload();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(var(--glass-blur, 16px))',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 3000,
      padding: '20px'
    }}>
      <div 
        className="widget modal-updater-panel animate-entrance"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '28px',
          borderRadius: 'var(--card-radius)',
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid var(--border-color)',
          boxShadow: 'var(--card-shadow)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          transition: 'all 0.3s'
        }}
      >
        {/* Botón de cierre en la parte superior derecha — siempre visible */}
        {true && (
          <button 
            onClick={onClose}
            className="theme-toggle-btn"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '32px',
              height: '32px',
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              cursor: 'pointer'
            }}
            title="Cerrar modal"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        )}

        {/* Mensaje de error si ocurre algún fallo */}
        {errorMessage && (
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '12.5px',
            marginBottom: '4px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── ESTADO 1: INICIAL (IDLE / BUSCAR) ── */}
        {state === 'IDLE' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '10px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--brand-primary-light)',
              color: 'var(--brand-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px var(--brand-primary-light)'
            }}>
              <ArrowUpCircle size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>Actualización del Sistema</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Mantén StockMasterPro actualizado con las últimas mejoras fiscales y de rendimiento. Versión instalada: <strong>{currentVersion}</strong>.
              </p>
            </div>
            <button
              onClick={handleStartCheck}
              className="btn-yellow"
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: 'var(--button-radius)',
                justifyContent: 'center',
                fontSize: '13px',
                marginTop: '10px',
                gap: '8px'
              }}
            >
              <Search size={16} />
              <span>Buscar Actualización</span>
            </button>
          </div>
        )}

        {/* ── ESTADO 2: BUSCANDO (CHECKING) ── */}
        {state === 'CHECKING' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px 0' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' } as any}>
              {/* Círculo animado del radar */}
              <div className="search-radar-ring" style={{
                position: 'absolute',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '2px solid var(--brand-primary)',
                backgroundColor: 'var(--brand-primary-light)',
                top: '20px', left: '20px'
              }} />
              <div style={{
                position: 'relative',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-primary)',
                border: '1.5px solid var(--border-color)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                top: '16px', left: '16px'
              }}>
                <RefreshCw className="search-radar-icon" size={22} />
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 6px 0' }}>Buscando Nueva Versión...</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Conectando con el servidor central de distribución de StockMasterPro.
              </p>
            </div>
          </div>
        )}

        {/* ── ESTADO 3: ACTUALIZACIÓN ENCONTRADA (UPDATE_AVAILABLE) ── */}
        {state === 'UPDATE_AVAILABLE' && (
          <div className="update-info-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div className="update-alert-badge" style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                color: 'var(--brand-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '17px', fontWeight: 900 }}>Nueva versión disponible</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '50px', backgroundColor: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>
                    {tauriUpdate ? `v${tauriUpdate.version}` : 'v2.2.0 (Estable)'}
                  </span>
                </div>
                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block', marginTop: '3px' }}>
                  Tamaño de descarga: <strong>{totalSize} MB</strong>
                </span>
              </div>
            </div>

            {/* Listado de novedades */}
            <div style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              padding: '14px',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              lineHeight: 1.4
            }}>
              <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Novedades de esta versión:
              </span>
              
              {tauriUpdate?.body ? (
                <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }}>
                  {tauriUpdate.body}
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><strong>Landing Page interactiva</strong>: Portal promocional animado con anime.js y visualizador de temas HSL en vivo.</li>
                  <li><strong>Estadísticas Avanzadas</strong>: Gráfico de rendimiento semanal dinámico utilizando react-chartjs-2 con tooltips interactivos.</li>
                  <li><strong>Visualizaciones animadas</strong>: Efectos de flujo de datos IndexedDB a NestJS en la bitácora de auditorías.</li>
                  <li><strong>Corrección de TS Build</strong>: Ajustes de tipado estricto y soporte de exclusión para suites de tests en tsconfig.</li>
                </ul>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={onClose}
                className="btn-pill-dark"
                style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--button-radius)', justifyContent: 'center', cursor: 'pointer', border: '1.5px solid var(--border-color)' }}
              >
                Actualizar más tarde
              </button>
              <button
                onClick={() => setState('DOWNLOADING')}
                className="btn-yellow"
                style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--button-radius)', justifyContent: 'center', cursor: 'pointer', display: 'flex', gap: '6px' }}
              >
                <Download size={14} />
                <span>Actualizar Ahora</span>
              </button>
            </div>
          </div>
        )}

        {/* ── ESTADO 4: DESCARGANDO (DOWNLOADING) ── */}
        {state === 'DOWNLOADING' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--brand-primary-light)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Download className="download-bounce-arrow" size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>Descargando Actualización...</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' } as any}>
                  <span>{downloadedBytes} MB descargados de {totalSize} MB</span>
                  <span style={{ fontWeight: 800, color: 'var(--brand-primary)' }}>{Math.round(progress)}%</span>
                </div>
              </div>
            </div>

            {/* Barra de progreso */}
            <div style={{
              width: '100%',
              height: '8px',
              borderRadius: '50px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <div 
                className="download-progress-bar-fill" 
                style={{
                  height: '100%',
                  width: '0%',
                  backgroundColor: 'var(--brand-primary)',
                  borderRadius: '50px'
                }} 
              />
            </div>

            {/* Físicas de Descarga en tiempo real */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              backgroundColor: 'var(--bg-primary)',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              fontSize: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={14} style={{ color: 'var(--brand-primary)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Velocidad: <strong>{downloadSpeed} MB/s</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
                <Clock size={14} style={{ color: 'var(--brand-gold)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>ETA: <strong>{etaSeconds} segundos</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* ── ESTADO 5: DESCARGADO (DOWNLOADED) ── */}
        {state === 'DOWNLOADED' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '10px 0' }}>
            <div style={{ position: 'relative' }}>
              {/* Estrellitas o brillos flotando */}
              <div className="success-sparkle" style={{ position: 'absolute', top: '-10px', left: '-10px', fontSize: '14px' }}>✨</div>
              <div className="success-sparkle" style={{ position: 'absolute', bottom: '-8px', right: '-8px', fontSize: '14px' }}>✨</div>
              
              <div className="success-check-badge" style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(34, 197, 94, 0.2)'
              }}>
                <CheckCircle2 size={36} />
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>Descarga Completada</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                La versión <strong>{tauriUpdate ? `v${tauriUpdate.version}` : 'v2.2.0'}</strong> se ha descargado y está lista para instalar. Reinicia la aplicación para aplicar los cambios de forma instantánea.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '10px' }}>
              <button
                onClick={onClose}
                className="btn-pill-dark"
                style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--button-radius)', justifyContent: 'center', cursor: 'pointer', border: '1.5px solid var(--border-color)' }}
              >
                Actualizar más tarde
              </button>
              <button
                onClick={handleInstallNow}
                className="btn-yellow"
                style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--button-radius)', justifyContent: 'center', cursor: 'pointer', display: 'flex', gap: '6px', backgroundColor: '#22c55e', color: '#fff' }}
              >
                <ArrowUpCircle size={14} />
                <span>Reiniciar Ahora</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
