import { useState, useEffect, useRef, useCallback } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ExchangeRateProvider } from './contexts/ExchangeRateContext';
import { ToastProvider } from './components/ToastNotification';
import { BusinessSettingsProvider } from './contexts/BusinessSettingsContext';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import SplashScreen from './components/SplashScreen';
import LandingPage from './components/LandingPage';
import { logout } from './db/auth';
import { logAuditEvent } from './utils/audit';

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [view, setView] = useState<'landing' | 'login' | 'register'>('landing');
  const [isSessionLoading, setIsSessionLoading] = useState(() => !!localStorage.getItem('auth_user'));
  const lastActivityRef = useRef<number>(Date.now());

  // Recupera la sesión activa al recargar la PWA en el navegador
  useEffect(() => {
    const cachedUser = localStorage.getItem('auth_user');
    if (cachedUser) {
      try {
        setCurrentUser(JSON.parse(cachedUser));
      } catch (err) {
        localStorage.removeItem('auth_user');
        setIsSessionLoading(false);
      }
    }
  }, []);

  // Track user activity for session timeout
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // C7: Session Timeout — 15 minutes of inactivity auto-logs out the user
  useEffect(() => {
    if (!currentUser) return;

    // Reset on mount
    lastActivityRef.current = Date.now();

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= SESSION_TIMEOUT_MS) {
        localStorage.removeItem('auth_user');
        setCurrentUser(null);
      }
    }, 30_000); // check every 30 seconds

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetActivity));
      clearInterval(intervalId);
    };
  }, [currentUser, resetActivity]);

  if (isSessionLoading) {
    return <SplashScreen onFinish={() => setIsSessionLoading(false)} />;
  }

  if (currentUser) {
    return (
      <ThemeProvider>
        <ExchangeRateProvider>
          <BusinessSettingsProvider>
            <ToastProvider>
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
                      setIsSessionLoading(true);
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

