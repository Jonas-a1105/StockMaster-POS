import { useState, useEffect } from 'react';
import { Mail, Lock, Wifi, WifiOff, Sun, Moon, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { loginOnline, loginOffline, isOnline } from '../db/auth';
import { API_URL } from '../config';
import logoImg from '../assets/logo.png';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  onNavigateToRegister: () => void;
}

export default function Login({ onLoginSuccess, onNavigateToRegister }: LoginProps) {
  // Estados Interactivos
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loginMethod, setLoginMethod] = useState<'password' | 'pin'>('password');
  const [isDark, setIsDark] = useState(true);
  const [onlineStatus, setOnlineStatus] = useState(isOnline());
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Escucha cambios de conectividad en tiempo real
  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sincroniza clases del tema en el body para modo oscuro/claro
  useEffect(() => {
    const body = document.body;
    if (isDark) {
      body.classList.add('dark-theme');
      body.classList.remove('light-theme');
    } else {
      body.classList.add('light-theme');
      body.classList.remove('dark-theme');
    }
  }, [isDark]);

  // Manejador del Teclado Numérico Tactil (PIN Pad)
  const handleNumpadPress = (num: string) => {
    setErrorMsg('');
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleNumpadClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const handleNumpadBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  // Envío del Formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email) {
      setErrorMsg('Debe ingresar su correo electrónico.');
      return;
    }

    setIsLoading(true);

    try {
      if (loginMethod === 'password') {
        if (!password) {
          setErrorMsg('Debe ingresar su contraseña.');
          setIsLoading(false);
          return;
        }

        if (onlineStatus) {
          // A. Intenta Login Online Centralizado
          try {
            const res = await loginOnline(email, password);
            setSuccessMsg('¡Conexión Online Establecida! Sesión autorizada.');
            setTimeout(() => onLoginSuccess(res.user), 1000);
          } catch (onlineErr: any) {
            console.warn('Fallo de login online, intentando offline local...', onlineErr);
            // Si el error es de conexión de red o un error del servidor (no credenciales incorrectas)
            const isNetworkOrServerError = 
              !navigator.onLine ||
              onlineErr.message === 'Failed to fetch' || 
              onlineErr.message?.includes('NetworkError') || 
              onlineErr.message?.includes('network') ||
              onlineErr.message?.includes('connect') ||
              onlineErr.message?.includes('fetch') ||
              onlineErr.message?.includes('server') ||
              onlineErr.message?.includes('Internal Server Error') ||
              onlineErr.message?.includes('500') ||
              onlineErr.message?.includes('502') ||
              onlineErr.message?.includes('503') ||
              onlineErr.message?.includes('504');

            if (isNetworkOrServerError) {
              try {
                const res = await loginOffline(email, password, false);
                setSuccessMsg('🔌 Servidor central inaccesible. Iniciando sesión local protegida.');
                setTimeout(() => onLoginSuccess(res.user), 1500);
              } catch (offlineErr: any) {
                throw new Error(offlineErr.message || 'Error en las credenciales proporcionadas localmente.');
              }
            } else {
              throw onlineErr; // Credenciales inválidas u otro error de autenticación explícito
            }
          }
        } else {
          // B. Fallback a Validación Local en IndexedDB
          const res = await loginOffline(email, password, false);
          setSuccessMsg('🔌 Sin Conexión. Iniciando sesión local protegida.');
          setTimeout(() => onLoginSuccess(res.user), 1000);
        }
      } else {
        // Validación por PIN rápido de cajero (Siempre local/offline de primer nivel)
        if (pin.length < 4) {
          setErrorMsg('El PIN debe tener al menos 4 dígitos.');
          setIsLoading(false);
          return;
        }

        if (onlineStatus) {
          // Verifica el PIN en el servidor o local si falla
          try {
            const response = await fetch(`${API_URL}/auth/login-offline`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, pin })
            });
            const data = await response.json();
            if (response.ok) {
              localStorage.setItem('auth_token', data.accessToken);
              localStorage.setItem('auth_user', JSON.stringify({ ...data.user, offline: false }));
              setSuccessMsg('¡PIN verificado online con éxito!');
              setTimeout(() => onLoginSuccess(data.user), 1000);
              return;
            } else if (response.status === 400 || response.status === 401) {
              throw new Error(data.message || 'PIN o usuario incorrecto.');
            }
          } catch (err: any) {
            console.warn('Fallo de PIN online, intentando offline local...', err);
            if (err.message === 'PIN o usuario incorrecto.') {
              throw err;
            }
          }
        }
        
        // Validación offline local en RxDB
        const res = await loginOffline(email, pin, true);
        setSuccessMsg('🔌 Sesión Offline autorizada mediante PIN local.');
        setTimeout(() => onLoginSuccess(res.user), 1000);
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error en las credenciales proporcionadas.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      minHeight: '100vh',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-primary)',
      transition: 'background-color 0.5s ease'
    }}>
      {/* Inyecta estilos CSS específicos para hover, keyframes de orbes de fondo y glows */}
      <style>{`
        @keyframes float-slow-1 {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, -60px) scale(1.15); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes float-slow-2 {
          0% { transform: translate(0, 0) scale(1.1); }
          50% { transform: translate(-60px, 40px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1.1); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.2; }
          50% { transform: scale(1.05); opacity: 0.45; }
          100% { transform: scale(0.95); opacity: 0.2; }
        }
        .glass-input:focus {
          border-color: var(--brand-teal) !important;
          box-shadow: 0 0 14px rgba(14, 165, 164, 0.25) !important;
        }
        .numpad-btn {
          background-color: var(--bg-input) !important;
          border: 1.5px solid var(--border-color) !important;
          color: var(--text-primary) !important;
          font-family: var(--font-main) !important;
          font-size: 18px !important;
          font-weight: 800 !important;
          cursor: pointer !important;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .numpad-btn:hover {
          background-color: var(--border-active) !important;
          border-color: var(--text-muted) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .numpad-btn:active {
          transform: translateY(1px);
        }
        .login-btn-gradient {
          background: var(--grad-teal) !important;
          border: none !important;
          color: #060608 !important;
          font-family: var(--font-main) !important;
          font-weight: 800 !important;
          font-size: 13px !important;
          letter-spacing: 0.5px !important;
          cursor: pointer !important;
          transition: all 0.25s ease !important;
        }
        .login-btn-gradient:hover {
          filter: brightness(1.15) !important;
          transform: translateY(-2.5px) !important;
          box-shadow: 0 8px 25px rgba(16, 227, 178, 0.35) !important;
        }
        .login-btn-gradient:active {
          transform: translateY(0.5px) !important;
        }
        .glass-auth-card {
          background: rgba(20, 20, 23, 0.65) !important;
          backdrop-filter: blur(25px) !important;
          -webkit-backdrop-filter: blur(25px) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4) !important;
          border-radius: 36px !important;
          padding: 40px !important;
          width: 100%;
          max-width: 450px;
          position: relative;
          z-index: 10;
          transition: all 0.3s ease;
        }
        .light-theme .glass-auth-card {
          background: rgba(255, 255, 255, 0.65) !important;
          border: 1px solid rgba(0, 0, 0, 0.05) !important;
          box-shadow: 0 20px 50px rgba(160, 163, 189, 0.15) !important;
        }
      `}</style>

      {/* Floating Blurred Orbs in the Background (Teal and Purple/Pink) */}
      <div style={{
        position: 'absolute',
        top: '-150px',
        left: '-150px',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14,165,164,0.18) 0%, rgba(14,165,164,0) 70%)',
        filter: 'blur(60px)',
        zIndex: 1,
        animation: 'float-slow-1 12s infinite alternate ease-in-out'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-150px',
        right: '-150px',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(223,158,255,0.15) 0%, rgba(223,158,255,0) 70%)',
        filter: 'blur(60px)',
        zIndex: 1,
        animation: 'float-slow-2 15s infinite alternate ease-in-out'
      }}></div>

      {/* Frosted Glassmorphism Login Container */}
      <div className="glass-auth-card animate-entrance">
        
        {/* Cabecera del Formulario con Logo y Controles */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🛡️</span>
            <span style={{
              fontFamily: 'Outfit',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--brand-teal)',
              letterSpacing: '-0.3px'
            }}>StockMasterPro</span>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Indicador de Conexión Redondeado */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '50px',
                backgroundColor: onlineStatus ? 'rgba(32, 227, 178, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: onlineStatus ? '#20e3b2' : '#ef4444',
                fontSize: '10.5px',
                fontWeight: 800,
                border: `1px solid ${onlineStatus ? 'rgba(32, 227, 178, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
              }}
              title={onlineStatus ? "Conexión a internet activa (Sincronización en vivo)" : "Modo desconectado activo (Funcionando localmente)"}
            >
              {onlineStatus ? <Wifi size={11} /> : <WifiOff size={11} />}
              <span>{onlineStatus ? 'ONLINE' : 'OFFLINE'}</span>
            </div>

            {/* Selector de Tema */}
            <button 
              onClick={() => setIsDark(!isDark)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                width: '32px',
                height: '32px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              title={isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        {/* Presentación del Logotipo Corporativo con Anillo de Pulsación */}
        <div className="logo-glow-wrapper" style={{ position: 'relative', margin: '0 auto 16px auto', width: '76px', height: '76px' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: '50%',
            background: 'var(--brand-teal)',
            animation: 'pulse-ring 3s infinite',
            zIndex: 0
          }}></div>
          <img 
            src={logoImg} 
            alt="Logotipo StockMaster" 
            style={{ 
              width: '76px', 
              height: '76px', 
              position: 'relative', 
              zIndex: 1, 
              borderRadius: '50%', 
              border: '2px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
            }} 
          />
        </div>

        {/* Título de la Sección */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Acceso Autorizado
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Punto de Venta e Inventario Offline-First
          </p>
        </div>

        {/* Alerta de Error */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '12px 16px',
            borderRadius: '14px',
            color: '#ef4444',
            fontSize: '12.5px',
            fontWeight: 700,
            marginBottom: '16px',
            animation: 'shake 0.4s ease'
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Alerta de Éxito */}
        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(32, 227, 178, 0.08)',
            border: '1px solid rgba(32, 227, 178, 0.2)',
            padding: '12px 16px',
            borderRadius: '14px',
            color: '#20e3b2',
            fontSize: '12.5px',
            fontWeight: 800,
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '15px' }}>⚡</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Selector de Pestañas de Autenticación */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-input)',
          borderRadius: '16px',
          padding: '4px',
          width: '100%',
          marginBottom: '20px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => { setLoginMethod('password'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '11.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              backgroundColor: loginMethod === 'password' ? 'var(--bg-card)' : 'transparent',
              color: loginMethod === 'password' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: loginMethod === 'password' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            Contraseña
          </button>
          <button
            onClick={() => { setLoginMethod('pin'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '11.5px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              backgroundColor: loginMethod === 'pin' ? 'var(--bg-card)' : 'transparent',
              color: loginMethod === 'pin' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: loginMethod === 'pin' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            PIN Cajero
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          
          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Correo de Empleado
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Mail size={16} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="email"
                placeholder="cajero@empresa.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                className="glass-input"
                style={{
                  width: '100%',
                  padding: '13px 14px 13px 42px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '14px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Outfit',
                  fontSize: '13.5px',
                  outline: 'none',
                  transition: 'all 0.25s ease'
                }}
              />
            </div>
          </div>

          {/* Método 1: Contraseña estándar */}
          {loginMethod === 'password' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Contraseña
              </label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Lock size={16} style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="******"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                  className="glass-input"
                  style={{
                    width: '100%',
                    padding: '13px 42px 13px 42px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: '14px',
                    color: 'var(--text-primary)',
                    fontFamily: 'Outfit',
                    fontSize: '13.5px',
                    outline: 'none',
                    transition: 'all 0.25s ease'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Método 2: PIN de Acceso Rápido con Numpad Táctil */}
          {loginMethod === 'pin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>
                  Código PIN
                </label>
                
                {/* Visualización de la máscara de PIN */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '10px',
                  margin: '8px 0'
                }}>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div 
                      key={idx}
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: pin.length > idx ? '#20e3b2' : 'var(--bg-input)',
                        border: `1.5px solid ${pin.length > idx ? '#20e3b2' : 'var(--border-color)'}`,
                        boxShadow: pin.length > idx ? '0 0 10px rgba(32, 227, 178, 0.4)' : 'none',
                        transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Teclado Numérico POS Frosted */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                maxWidth: '250px',
                width: '100%'
              }}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumpadPress(num)}
                    className="numpad-btn"
                    style={{
                      height: '46px',
                      borderRadius: '14px',
                    }}
                  >
                    {num}
                  </button>
                ))}
                
                <button
                  type="button"
                  onClick={handleNumpadClear}
                  className="numpad-btn"
                  style={{
                    height: '46px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(239, 68, 68, 0.08) !important',
                    borderColor: 'rgba(239, 68, 68, 0.15) !important',
                    color: '#ef4444 !important',
                    fontSize: '10.5px !important',
                    letterSpacing: '0.3px'
                  }}
                >
                  BORRAR
                </button>
                
                <button
                  type="button"
                  onClick={() => handleNumpadPress('0')}
                  className="numpad-btn"
                  style={{
                    height: '46px',
                    borderRadius: '14px',
                  }}
                >
                  0
                </button>
                
                <button
                  type="button"
                  onClick={handleNumpadBackspace}
                  className="numpad-btn"
                  style={{
                    height: '46px',
                    borderRadius: '14px',
                    fontSize: '16px !important'
                  }}
                >
                  ⌫
                </button>
              </div>
            </div>
          )}

          {/* Botón de Enviar con Gradiente */}
          <button
            type="submit"
            className="login-btn-gradient"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: '14px',
              justifyContent: 'center',
              marginTop: '12px',
              opacity: isLoading ? 0.65 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isLoading ? 'Verificando cajero...' : onlineStatus ? 'INICIAR SESIÓN ONLINE' : 'INICIAR SESIÓN LOCAL'}
          </button>
        </form>

        {/* Enlace para ir al Registro (Solo en modo online) */}
        {onlineStatus && (
          <div style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '13px',
            color: 'var(--text-secondary)'
          }}>
            ¿No tienes cuenta de empleado?{' '}
            <span 
              onClick={onNavigateToRegister}
              style={{
                color: 'var(--brand-teal)',
                fontWeight: 800,
                cursor: 'pointer',
                textDecoration: 'none',
                marginLeft: '4px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#20e3b2'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--brand-teal)'}
            >
              Registrarse
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
