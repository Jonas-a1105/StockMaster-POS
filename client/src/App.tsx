import { useState, useEffect, useRef, useCallback } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ExchangeRateProvider } from './contexts/ExchangeRateContext';
import { ToastProvider, useToast } from './components/ToastNotification';
import { BusinessSettingsProvider } from './contexts/BusinessSettingsContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import SplashScreen from './components/SplashScreen';
import LandingPage from './components/LandingPage';
import { logout } from './db/auth';
import { logAuditEvent } from './utils/audit';

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_WARNING_MS = 14 * 60 * 1000; // Warning at 14 min

function SessionManager({ currentUser, setCurrentUser }: { currentUser: any; setCurrentUser: (u: any) => void }) {
  const lastActivityRef = useRef<number>(Date.now());
  const warnedRef = useRef(false);
  const { addToast } = useToast();
  const [showWarning, setShowWarning] = useState(false);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    warnedRef.current = false;
    if (showWarning) setShowWarning(false);
  }, [showWarning]);

  const extendSession = useCallback(() => {
    lastActivityRef.current = Date.now();
    warnedRef.current = false;
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    lastActivityRef.current = Date.now();
    warnedRef.current = false;

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= SESSION_TIMEOUT_MS) {
        localStorage.removeItem('auth_user');
        setCurrentUser(null);
      } else if (elapsed >= SESSION_WARNING_MS && !warnedRef.current) {
        warnedRef.current = true;
        setShowWarning(true);
        addToast({ type: 'warning', title: 'Sesión por expirar', message: 'Tu sesión expirará en 1 minuto por inactividad.' });
      }
    }, 30_000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetActivity));
      clearInterval(intervalId);
    };
  }, [currentUser, resetActivity, addToast, setCurrentUser]);

  return showWarning ? (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, padding: '20px'
    }}>
      <div className="widget" style={{
        maxWidth: '380px', padding: '28px', borderRadius: 'var(--card-radius)',
        textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px'
      }}>
        <h3 style={{ color: 'var(--brand-gold)', margin: 0, fontSize: '18px' }}>⏰ Sesión por expirar</h3>
        <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '13px' }}>
          Tu sesión expirará en menos de 1 minuto por inactividad.
        </p>
        <button onClick={extendSession} className="btn-yellow" style={{ padding: '10px 0', borderRadius: 'var(--button-radius)', fontWeight: 700 }}>
          Seguir conectado
        </button>
      </div>
    </div>
  ) : null;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<'landing' | 'login' | 'register'>('landing');
  const [isSessionLoading, setIsSessionLoading] = useState(() => !!localStorage.getItem('auth_user'));

  // Recupera la sesión activa al recargar la PWA en el navegador
  useEffect(() => {
    const cachedUser = localStorage.getItem('auth_user');
    if (cachedUser) {
      try {
        setCurrentUser(JSON.parse(cachedUser));
        setIsSessionLoading(false);
      } catch (err) {
        localStorage.removeItem('auth_user');
        setIsSessionLoading(false);
      }
    } else {
      setIsSessionLoading(false);
    }
  }, []);

  const handleStartDemo = () => {
    // 1. Activar demo en localStorage
    localStorage.setItem('demo_start_time', Date.now().toString());
    localStorage.setItem('demo_active', 'true');
    localStorage.removeItem('license_plan'); // Limpiar cualquier licencia anterior al iniciar demo
    localStorage.removeItem('license_key');
    
    // 2. Crear un usuario de demostración ficticio con rol de administrador
    const demoUser = {
      id: 'demo-user-id',
      email: 'demo@stockmaster.pro',
      name: 'Usuario Demo',
      role: 'ADMIN',
      offline: true
    };
    
    // Guardar en localStorage para persistencia de la sesión demo
    localStorage.setItem('auth_user', JSON.stringify(demoUser));
    setCurrentUser(demoUser);
  };

  // Fix M8: No splash flash on login — only on cold-start with auth_user
  if (isSessionLoading) {
    return <SplashScreen onFinish={() => setIsSessionLoading(false)} />;
  }

  if (currentUser) {
    const isDemo = currentUser.id === 'demo-user-id';
    return (
      <ThemeProvider>
        <ExchangeRateProvider>
          <BusinessSettingsProvider>
            <ToastProvider>
              {isDemo && (
                <div style={{
                  backgroundColor: 'var(--brand-gold)', color: '#000', textAlign: 'center',
                  padding: '6px 16px', fontSize: '12px', fontWeight: 800, zIndex: 9998,
                  position: 'relative'
                }}>
                  ⚠ MODO DEMO — Los datos no se conservarán. <a href="/login" style={{ color: '#000', textDecoration: 'underline' }}>Inicia sesión</a> para usar datos reales.
                </div>
              )}
              <SessionManager currentUser={currentUser} setCurrentUser={setCurrentUser} />
              <Dashboard 
                user={currentUser} 
                onLogoutSuccess={() => {
                  logAuditEvent(currentUser, 'USUARIO_LOGOUT', {});
                  logout();
                  setCurrentUser(null);
                }} 
              />
            </ToastProvider>
          </BusinessSettingsProvider>
        </ExchangeRateProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ExchangeRateProvider>
        <BusinessSettingsProvider>
          <ToastProvider>
            {view === 'landing' ? (
              <LandingPage 
                onEnterLogin={() => setView('login')} 
                onEnterRegister={() => setView('register')} 
                onStartDemo={handleStartDemo}
              />
            ) : (
              <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-primary)',
                transition: 'background-color 0.3s ease'
              }}>
                {view === 'login' ? (
                  // Muestra el Login interactivo con PIN Pad táctil y selector online/offline
                  <Login 
                    onLoginSuccess={(user) => {
                      logAuditEvent(user, 'USUARIO_LOGIN_LOCAL', { email: user.email, status: 'SUCCESS' });
                      setCurrentUser(user);
                    }} 
                    onNavigateToRegister={() => setView('register')} 
                    onBackToLanding={() => setView('landing')}
                  />
                ) : (
                  // Muestra el Portal de Registro de Empleados enlazado al servidor centralizado
                  <Register 
                    onRegisterSuccess={() => setView('login')} 
                    onNavigateToLogin={() => setView('login')} 
                    onBackToLanding={() => setView('landing')}
                  />
                )}
              </div>
            )}
          </ToastProvider>
        </BusinessSettingsProvider>
      </ExchangeRateProvider>
    </ThemeProvider>
  );
}

