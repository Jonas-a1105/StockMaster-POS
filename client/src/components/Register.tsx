import { useState } from 'react';
import { User, Mail, Lock, Shield, KeyRound, AlertTriangle, CheckCircle } from 'lucide-react';
import { registerOnline } from '../db/auth';
import logoImg from '../assets/logo.png';
import CustomSelect from './CustomSelect';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
  onBackToLanding?: () => void;
}

export default function Register({ onRegisterSuccess, onNavigateToLogin, onBackToLanding }: RegisterProps) {
  // Estados del Formulario
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'CASHIER' | 'AUDITOR'>('CASHIER');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Manejo del Submit del Registro
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    // Validaciones Básicas de Cliente
    if (!name || !email || !password) {
      setErrorMsg('Todos los campos obligatorios deben ser completados.');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      setIsLoading(false);
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setErrorMsg('La contraseña debe contener al menos una mayúscula.');
      setIsLoading(false);
      return;
    }
    if (!/[a-z]/.test(password)) {
      setErrorMsg('La contraseña debe contener al menos una minúscula.');
      setIsLoading(false);
      return;
    }
    if (!/[0-9]/.test(password)) {
      setErrorMsg('La contraseña debe contener al menos un número.');
      setIsLoading(false);
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(password)) {
      setErrorMsg('La contraseña debe contener al menos un carácter especial (ej. !, @, #, $, etc.).');
      setIsLoading(false);
      return;
    }

    if (pin && !/^\d{4,6}$/.test(pin)) {
      setErrorMsg('El PIN offline debe ser únicamente numérico de 4 a 6 dígitos.');
      setIsLoading(false);
      return;
    }

    try {
      // Envía los datos al backend centralizado (NestJS)
      await registerOnline({
        email,
        password: password, // Se envía texto plano para hash seguro con bcrypt en backend
        name,
        role,
        pin: pin || undefined
      });

      setSuccessMsg('¡Usuario registrado con éxito! Redireccionando...');
      setTimeout(() => {
        onRegisterSuccess();
      }, 1500);
    } catch (error: any) {
      setErrorMsg(error.message || 'Error al conectar con el servidor.');
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
      transition: 'background-color 0.5s ease',
      fontFamily: 'var(--font-main)'
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
          border-color: var(--brand-primary) !important;
          box-shadow: 0 0 14px var(--brand-primary-light) !important;
        }
        .login-btn-gradient {
          background: var(--brand-primary) !important;
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
          background: var(--brand-primary-hover) !important;
          transform: translateY(-2.5px) !important;
          box-shadow: 0 8px 25px var(--brand-primary-light) !important;
        }
        .login-btn-gradient:active {
          transform: translateY(0.5px) !important;
        }
        .glass-auth-card {
          background: rgba(20, 20, 23, 0.65) !important;
          backdrop-filter: blur(var(--glass-blur, 25px)) !important;
          -webkit-backdrop-filter: blur(var(--glass-blur, 25px)) !important;
          border: 1.5px solid var(--border-color) !important;
          box-shadow: var(--card-shadow) !important;
          border-radius: var(--card-radius, 24px) !important;
          padding: 40px !important;
          width: 100%;
          max-width: 450px;
          position: relative;
          z-index: 10;
          transition: all 0.3s ease;
        }
        .light-theme .glass-auth-card {
          background: rgba(255, 255, 255, 0.65) !important;
          border: 1.5px solid var(--border-color) !important;
          box-shadow: var(--card-shadow) !important;
        }
        .glass-select {
          width: 100%;
          padding: 11px 14px 11px 42px;
          background-color: var(--bg-input);
          border: 1.5px solid var(--border-color);
          border-radius: var(--input-radius, 12px);
          color: var(--text-primary);
          font-family: var(--font-main);
          font-size: 13.5px;
          outline: none;
          cursor: pointer;
          transition: all 0.25s ease;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
        }
        .glass-select:focus {
          border-color: var(--brand-primary) !important;
          box-shadow: 0 0 14px var(--brand-primary-light) !important;
        }
      `}</style>

      {/* Floating Blurred Orbs in the Background */}
      <div style={{
        position: 'absolute',
        top: '-150px',
        left: '-150px',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--brand-primary-light) 0%, transparent 70%)',
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
        background: 'radial-gradient(circle, hsla(var(--brand-primary-h), var(--brand-primary-s), var(--brand-primary-l), 0.1) 0%, transparent 70%)',
        filter: 'blur(60px)',
        zIndex: 1,
        animation: 'float-slow-2 15s infinite alternate ease-in-out'
      }}></div>

      {/* Frosted Glassmorphism Register Container */}
      <div className="glass-auth-card animate-entrance">
        
        {/* Cabecera superior (Logo y Nombre en Una Sola Línea) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', width: '100%', marginBottom: '28px' }}>
          <img 
            src={logoImg} 
            alt="Logo" 
            style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '50%', 
              border: '2px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)' 
            }} 
          />
          <span style={{
            fontFamily: 'var(--font-script)',
            fontSize: '34px',
            color: 'var(--brand-primary)',
            letterSpacing: '0.5px'
          }}>StockMasterPro</span>
        </div>

        {/* Título */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-main)', fontWeight: 800, fontSize: '28px', color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Registro de Cajero
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Cree una nueva cuenta de empleado en el sistema
          </p>
        </div>

        {/* Alertas */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '12px 16px',
            borderRadius: 'var(--button-radius, 12px)',
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

        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(32, 227, 178, 0.08)',
            border: '1px solid rgba(32, 227, 178, 0.2)',
            padding: '12px 16px',
            borderRadius: 'var(--button-radius, 12px)',
            color: '#20e3b2',
            fontSize: '12.5px',
            fontWeight: 800,
            marginBottom: '16px'
          }}>
            <CheckCircle size={14} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
          
          {/* Nombre Completo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Nombre de Empleado *
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <User size={16} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                placeholder="Juan Pérez"
                value={name}
                onChange={(e) => { setName(e.target.value); setErrorMsg(''); }}
                className="glass-input"
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 42px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 'var(--input-radius, 12px)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-main)',
                  fontSize: '13.5px',
                  outline: 'none',
                  transition: 'all 0.25s ease'
                }}
              />
            </div>
          </div>

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Correo Corporativo *
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
                placeholder="juan.perez@empresa.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                className="glass-input"
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 42px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 'var(--input-radius, 12px)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-main)',
                  fontSize: '13.5px',
                  outline: 'none',
                  transition: 'all 0.25s ease'
                }}
              />
            </div>
          </div>

          {/* Contraseña */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Contraseña de Acceso *
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
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                className="glass-input"
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 42px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 'var(--input-radius, 12px)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-main)',
                  fontSize: '13.5px',
                  outline: 'none',
                  transition: 'all 0.25s ease'
                }}
              />
            </div>
          </div>

          {/* Rol de Usuario */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Rol Asignado *
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <CustomSelect
                value={role}
                onChange={(val) => setRole(val as any)}
                options={[
                  { value: 'CASHIER', label: 'Cajero (Operación POS)' },
                  { value: 'ADMIN', label: 'Administrador (Control Total)' },
                  { value: 'AUDITOR', label: 'Auditor (Bitácoras y Reportes)' }
                ]}
                icon={<Shield size={16} style={{ color: 'var(--text-muted)' }} />}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* PIN de Acceso Offline Rápido */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                PIN Offline Rápido
              </label>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 800 }}>(OPCIONAL)</span>
            </div>
            <div style={{ position: 'relative', width: '100%' }}>
              <KeyRound size={16} style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                pattern="\d*"
                maxLength={6}
                placeholder="4 a 6 dígitos numéricos"
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setErrorMsg(''); }}
                className="glass-input"
                style={{
                  width: '100%',
                  padding: '11px 14px 11px 42px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 'var(--input-radius, 12px)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-main)',
                  fontSize: '13.5px',
                  outline: 'none',
                  transition: 'all 0.25s ease'
                }}
              />
            </div>
          </div>

          {/* Botón de Envío con Gradiente */}
          <button
            type="submit"
            className="login-btn-gradient"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 'var(--button-radius, 12px)',
              justifyContent: 'center',
              marginTop: '12px',
              opacity: isLoading ? 0.65 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isLoading ? 'Registrando empleado...' : 'COMPLETAR REGISTRO'}
          </button>
        </form>

        {/* Volver al Login */}
        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}>
          ¿Ya tienes cuenta corporativa?{' '}
          <span 
            onClick={onNavigateToLogin}
            style={{
              color: 'var(--brand-primary)',
              fontWeight: 800,
              cursor: 'pointer',
              textDecoration: 'none',
              marginLeft: '4px',
              transition: 'all 0.2s',
              fontFamily: 'var(--font-main)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--brand-primary)'}
          >
            Iniciar Sesión
          </span>
        </div>
        
        {onBackToLanding && (
          <div style={{
            textAlign: 'center',
            marginTop: '16px',
            fontSize: '12.5px'
          }}>
            <span 
              onClick={onBackToLanding}
              style={{
                color: 'var(--text-muted)',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                textDecoration: 'underline'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              ← Volver al inicio
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
