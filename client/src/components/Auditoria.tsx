import { useState, useEffect, useMemo } from 'react';
import { animate } from 'animejs';
import { 
  ShieldAlert, 
  Search, 
  Database, 
  Terminal, 
  RefreshCw, 
  Eye, 
  Download, 
  CheckCircle,
  Copy,
  X,
  Server,
  Wifi,
  ArrowRight,
  Info,
  User
} from 'lucide-react';
import { API_URL } from '../config';
import { getDatabase } from '../db/database';
import { formatAuditDetailsHumanReadable } from '../utils/audit';
import CustomSelect from './CustomSelect';

interface AuditoriaProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  severity?: string;
  user?: {
    name: string;
    email: string;
    role: string;
  };
}

export default function Auditoria({ user }: AuditoriaProps) {
  // Mobile detection for full-height modal layout
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'TODOS' | 'SYNC' | 'AUTH' | 'POS' | 'STOCK'>('TODOS');
  const [severityFilter, setSeverityFilter] = useState<'TODOS' | 'INFO' | 'WARNING' | 'CRITICAL'>('TODOS');
  const [userFilter, setUserFilter] = useState<string>('');

  const uniqueUsers = useMemo(() => {
    const emails = new Set<string>();
    auditLogs.forEach(log => {
      if (log.user?.email) emails.add(log.user.email);
    });
    return Array.from(emails);
  }, [auditLogs]);

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, severityFilter, userFilter]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const [localDbInfo, setLocalDbInfo] = useState({
    status: 'Conectando...',
    collectionsCount: 8,
    writeLatency: 'Calculando...',
    totalRecords: 0
  });

  const [remoteServerInfo, setRemoteServerInfo] = useState({
    status: 'Verificando...',
    ping: 'Calculando...',
    isOnline: false
  });

  const fetchRealDatabaseMetrics = async () => {
    try {
      const db = await getDatabase();
      
      // Medir latencia de lectura de IndexedDB
      const testStart = performance.now();
      await db.products.find().exec();
      const readLatency = (performance.now() - testStart).toFixed(1) + ' ms';

      // Contar registros locales reales en IndexedDB de RxDB
      const collections = [
        db.users,
        db.products,
        db.sales,
        db.clients,
        db.suppliers,
        db.purchases,
        db.payroll,
        db.auditLogs
      ];
      
      let sum = 0;
      for (const col of collections) {
        if (col) {
          const docs = await col.find().exec();
          sum += docs.length;
        }
      }

      setLocalDbInfo({
        status: 'Online/Ready',
        collectionsCount: Object.keys(db.collections).length || 8,
        writeLatency: readLatency,
        totalRecords: sum
      });

    } catch (error) {
      console.error('Error fetching RxDB metrics:', error);
      setLocalDbInfo(prev => ({
        ...prev,
        status: 'Error en Caché',
        writeLatency: 'Error'
      }));
    }

    // Ping remoto real al backend de NestJS
    try {
      const pingStart = performance.now();
      const token = localStorage.getItem('auth_token');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos de timeout
      
      const pingRes = await fetch(`${API_URL}/reports/kpis`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const pingEnd = performance.now();
      const duration = Math.round(pingEnd - pingStart);

      if (pingRes.ok || pingRes.status === 401 || pingRes.status === 403) {
        setRemoteServerInfo({
          status: 'Activo',
          ping: `${duration} ms`,
          isOnline: true
        });
      } else {
        setRemoteServerInfo({
          status: 'Error Respuesta',
          ping: 'N/A',
          isOnline: false
        });
      }
    } catch (error) {
      console.error('Error pinging server:', error);
      setRemoteServerInfo({
        status: 'Desconectado',
        ping: 'Desconectado',
        isOnline: false
      });
    }
  };

  const loadAuditLogs = async () => {
    setIsRefreshing(true);
    fetchRealDatabaseMetrics();
    try {
      let serverLogs: AuditLog[] = [];
      const token = localStorage.getItem('auth_token');
      if (token && navigator.onLine) {
        const logsRes = await fetch(`${API_URL}/reports/audit-logs?limit=40`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (logsRes.ok) {
          serverLogs = await logsRes.json();
        }
      }

      // Read local logs from RxDB
      let localUser = { name: 'Usuario Local', email: 'local@stockmaster.pro', role: 'CASHIER' };
      try {
        const userStr = localStorage.getItem('auth_user');
        if (userStr) {
          const u = JSON.parse(userStr);
          localUser = { name: u.name || 'Usuario Local', email: u.email || 'local@stockmaster.pro', role: u.role || 'CASHIER' };
        }
      } catch {}

      const db = await getDatabase();
      const localLogsDocs = await db.auditLogs.find().exec();
      const localLogs: AuditLog[] = localLogsDocs.map(doc => {
        const data = doc.toJSON();
        return {
          id: data.id,
          action: data.action,
          details: data.details || '{}',
          ipAddress: '127.0.0.1 (Local)',
          userAgent: 'RxDB Client (Local)',
          createdAt: data.createdAt,
          severity: data.severity,
          user: localUser
        };
      });

      const combined = [...localLogs, ...serverLogs].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAuditLogs(combined);
    } catch (err) {
      console.error('Error al conectar con la bitácora de auditoría. Mostrando solo logs locales:', err);
      let localLogs: AuditLog[] = [];
      try {
        let localUser = { name: 'Usuario Local', email: 'local@stockmaster.pro', role: 'CASHIER' };
        const userStr = localStorage.getItem('auth_user');
        if (userStr) {
          const u = JSON.parse(userStr);
          localUser = { name: u.name || 'Usuario Local', email: u.email || 'local@stockmaster.pro', role: u.role || 'CASHIER' };
        }
        const db = await getDatabase();
        const localLogsDocs = await db.auditLogs.find().exec();
        localLogs = localLogsDocs.map(doc => {
          const data = doc.toJSON();
          return {
            id: data.id,
            action: data.action,
            details: data.details || '{}',
            ipAddress: '127.0.0.1 (Local)',
            userAgent: 'RxDB Client (Local)',
            createdAt: data.createdAt,
            severity: data.severity,
            user: localUser
          };
        });
      } catch (dbErr) {
        console.error('Error reading local audit logs from RxDB:', dbErr);
      }
      setAuditLogs(localLogs);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  // Animación del replicador con Anime.js
  useEffect(() => {
    const arrowAnim = animate('.sync-flow-arrow', {
      left: ['-14px', '134px'], // fluye a través del contenedor de 134px
      opacity: [0, 1, 1, 0],
      duration: 2000,
      loop: true,
      ease: 'linear'
    });

    const wifiAnim = animate('.sync-flow-wifi', {
      scale: [1, 1.2, 1],
      opacity: [0.6, 1, 0.6],
      duration: 1500,
      loop: true,
      ease: 'inOutSine'
    });

    return () => {
      arrowAnim.pause();
      wifiAnim.pause();
    };
  }, []);

  // Reactive audit filter
  useEffect(() => {
    let result = [...auditLogs];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        (log.user?.name && log.user.name.toLowerCase().includes(q)) ||
        (log.user?.email && log.user.email.toLowerCase().includes(q)) ||
        log.ipAddress.includes(q)
      );
    }

    if (categoryFilter !== 'TODOS') {
      result = result.filter(log => {
        if (categoryFilter === 'SYNC') return log.action.startsWith('SYNC');
        if (categoryFilter === 'AUTH') return log.action.includes('LOGIN') || log.action.includes('SESION');
        if (categoryFilter === 'POS') return log.action.startsWith('PAGO') || log.action.startsWith('VENTA');
        if (categoryFilter === 'STOCK') return log.action.startsWith('STOCK') || log.action.startsWith('INVENTARIO');
        return true;
      });
    }

    if (severityFilter !== 'TODOS') {
      result = result.filter(log => {
        const logSeverity = log.severity || (
          log.action.includes('ELIMINAR') || log.action.includes('BORRAR') || log.action.includes('SOBREESCRITURA')
            ? 'CRITICAL'
            : (log.action.includes('EDITAR') || log.action.includes('MODIFICAR') || log.action.includes('CONFLICT') || log.action.includes('CIERRE') || log.action.includes('AJUSTE'))
              ? 'WARNING'
              : 'INFO'
        );
        return logSeverity === severityFilter;
      });
    }

    if (userFilter) {
      result = result.filter(log => log.user?.email === userFilter);
    }

    setFilteredLogs(result);
  }, [searchTerm, categoryFilter, severityFilter, userFilter, auditLogs]);

  const handleCopyJson = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "bitacora_auditoria_stockmaster.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="view-container-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
        {/* SECCIÓN 1: PANEL DE ARQUITECTURA DE CONEXIÓN Y BASE DE DATOS */}
      <div className="view-header-widget has-grid-content" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div className="info-tooltip-wrapper">
            <Info size={18} className="info-tooltip-icon" style={{ color: 'var(--text-secondary)', cursor: 'help', opacity: 0.8 }} />
            <span className="tooltip-text">
              Monitoreo en tiempo real de la replicación de datos, terminal de comandos y registro detallado de eventos de seguridad.
            </span>
          </div>
          <span className="view-header-pill pill-teal">
            {auditLogs.length} Eventos
          </span>
          <span className="view-header-pill" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1.5px solid rgba(34, 197, 94, 0.25)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800 }}>
            🛡️ BITÁCORA INMUTABLE (TRIGGERS DB ACTIVOS)
          </span>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-main)', marginLeft: '4px' }}>
            💻 Arquitectura de Datos y Centro de Replicación
          </h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          
          {/* Nodo Local RxDB */}
          <div style={{ 
            flex: 1, 
            minWidth: '220px', 
            backgroundColor: 'var(--bg-card)', 
            border: '1.5px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '16px',
            position: 'relative',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>BASE DE DATOS LOCAL</span>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 8px #22c55e', display: 'inline-block' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Database size={24} style={{ color: 'var(--brand-primary)' }} />
              <div>
                <strong style={{ fontSize: '14px', display: 'block', color: 'var(--text-primary)' }}>RxDB (IndexedDB Cache)</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{localDbInfo.collectionsCount} colecciones. Estado: {localDbInfo.status}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
              <span>Latencia Lectura: <strong>{localDbInfo.writeLatency}</strong></span>
              <span>Registros locales: <strong>{localDbInfo.totalRecords}</strong></span>
            </div>
          </div>

          {/* Enlace de Replicación */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand-primary)', fontWeight: 800, fontSize: '10.5px' }}>
              <Wifi size={14} className="sync-flow-wifi" style={{ transformOrigin: 'center' }} />
              <span>Replicador REST API</span>
            </div>
            
            {/* Contenedor de la línea con flujo animado de anime.js */}
            <div 
              className="sync-flow-line-container"
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                position: 'relative', 
                width: '134px', // 60px + 14px + 60px
                height: '14px',
                overflow: 'hidden'
              }}
            >
              {/* Línea horizontal de fondo */}
              <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', backgroundColor: 'var(--border-color)' }} />
              
              {/* Flecha que viaja con anime.js */}
              <div 
                className="sync-flow-arrow"
                style={{ 
                  position: 'absolute', 
                  left: '-14px',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0
                }}
              >
                <ArrowRight size={14} style={{ color: 'var(--brand-primary)' }} />
              </div>
            </div>
            
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700 }}>Conexión HTTPS Activa</span>
          </div>

          {/* Nodo Remoto NestJS / Postgres */}
          <div style={{ 
            flex: 1, 
            minWidth: '220px', 
            backgroundColor: 'var(--bg-card)', 
            border: '1.5px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>SERVIDOR CENTRAL DE DATOS</span>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: remoteServerInfo.isOnline ? '#22c55e' : '#ef4444', 
                boxShadow: remoteServerInfo.isOnline ? '0 0 8px #22c55e' : '0 0 8px #ef4444', 
                display: 'inline-block' 
              }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Server size={24} style={{ color: 'var(--brand-gold)' }} />
              <div>
                <strong style={{ fontSize: '14px', display: 'block', color: 'var(--text-primary)' }}>NestJS + PostgreSQL</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{API_URL.replace(/https?:\/\//, '')}. {remoteServerInfo.status}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
              <span>Ping Remoto: <strong>{remoteServerInfo.ping}</strong></span>
              <span>Conexión: <strong>{remoteServerInfo.isOnline ? 'Online' : 'Offline'}</strong></span>
            </div>
          </div>

        </div>
      </div>

      {/* SECCIÓN 2: ESTADÍSTICAS DE SEGURIDAD */}
      {auditLogs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          width: '100%'
        }}>
          {(() => {
            const isFailed = (l: AuditLog) => l.action.includes('FALLIDO') || l.action.includes('BLOQUEADO');
            const isLogin = (l: AuditLog) => l.action.includes('USUARIO_LOGIN');
            const totalFailed = auditLogs.filter(l => isLogin(l) && isFailed(l)).length;
            const last24h = auditLogs.filter(l => isLogin(l) && isFailed(l) && Date.now() - new Date(l.createdAt).getTime() < 24 * 60 * 60 * 1000).length;
            const totalLogins = auditLogs.filter(l => isLogin(l)).length;
            const successRate = totalLogins > 0 ? Math.round((totalLogins - totalFailed) / totalLogins * 100) : 100;
            return (
              <>
                <div style={{ backgroundColor: totalFailed > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)', border: `1.5px solid ${totalFailed > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`, borderRadius: '14px', padding: '14px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Intentos Fallidos</span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: totalFailed > 0 ? '#ef4444' : '#22c55e', marginTop: '4px' }}>{totalFailed}</div>
                </div>
                <div style={{ backgroundColor: last24h > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34,197,94,0.08)', border: `1.5px solid ${last24h > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`, borderRadius: '14px', padding: '14px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fallos (24h)</span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: last24h > 0 ? '#ef4444' : '#22c55e', marginTop: '4px' }}>{last24h}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1.5px solid rgba(59,130,246,0.2)', borderRadius: '14px', padding: '14px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tasa de Éxito</span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: successRate >= 90 ? '#22c55e' : successRate >= 70 ? '#eab308' : '#ef4444', marginTop: '4px' }}>{successRate}%</div>
                </div>
                <div style={{ backgroundColor: 'rgba(139,92,246,0.08)', border: '1.5px solid rgba(139,92,246,0.2)', borderRadius: '14px', padding: '14px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Intentos</span>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>{totalLogins}</div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* SECCIÓN 3: BUSCADOR Y CHIPS DE FILTRADO TÉCNICO */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          
          {/* Controles de Búsqueda */}
          <div className="search-container" style={{ flex: 1, height: '40px' }}>
            <Search className="search-icon" size={16} />
            <input 
              type="text" 
              placeholder="Filtrar por acción técnica, IP, correo de usuario, detalles..." 
              className="search-input" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Chips de filtro */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', marginRight: '6px' }}>
              DOMINIO:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', backgroundColor: 'var(--bg-primary)', padding: '3px', borderRadius: 'var(--button-radius)', border: '1px solid var(--border-color)' }}>
              {([
                { id: 'TODOS', label: 'Todos' },
                { id: 'SYNC', label: 'RxDB Sync' },
                { id: 'AUTH', label: 'Seguridad' },
                { id: 'POS', label: 'POS' },
                { id: 'STOCK', label: 'Stock' }
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCategoryFilter(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'calc(var(--button-radius) - 4px)',
                    border: 'none',
                    backgroundColor: categoryFilter === tab.id ? 'var(--brand-primary)' : 'transparent',
                    color: categoryFilter === tab.id ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '10.5px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleDownloadLogs}
              className="btn-pill-dark"
              title="Descargar Bitácora JSON"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: 'var(--button-radius)', fontSize: '11px', fontWeight: 800, backgroundColor: 'var(--bg-input)' }}
            >
              <Download size={13} />
              <span>JSON</span>
            </button>

            <button
              onClick={loadAuditLogs}
              disabled={isRefreshing}
              className="btn-pill-dark"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-input)', cursor: isRefreshing ? 'not-allowed' : 'pointer' }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            </button>
          </div>

        </div>

        {/* FILTROS ADICIONALES DE GRAVEDAD Y USUARIO */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '12px 18px', borderRadius: '16px', border: '1.5px solid var(--border-color)' }}>
          {/* Filtro de Gravedad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Gravedad:
            </span>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-primary)', padding: '3px', borderRadius: 'var(--button-radius)', border: '1px solid var(--border-color)' }}>
              {([
                { id: 'TODOS', label: 'Todos' },
                { id: 'INFO', label: 'Baja (Info)' },
                { id: 'WARNING', label: 'Media (Aviso)' },
                { id: 'CRITICAL', label: 'Alta (Crítico)' }
              ] as const).map(g => (
                <button
                  key={g.id}
                  onClick={() => setSeverityFilter(g.id)}
                  type="button"
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'calc(var(--button-radius) - 4px)',
                    border: 'none',
                    backgroundColor: severityFilter === g.id 
                      ? (g.id === 'CRITICAL' ? '#ef4444' : g.id === 'WARNING' ? 'var(--brand-gold, #fbbf24)' : 'var(--brand-primary)')
                      : 'transparent',
                    color: severityFilter === g.id ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro de Usuario */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Filtrar por Usuario:
            </span>
            <CustomSelect
              value={userFilter}
              onChange={(val) => setUserFilter(val)}
              options={[
                { value: '', label: 'Todos los usuarios' },
                ...uniqueUsers.map(email => ({ value: email, label: email }))
              ]}
              icon={<User size={14} style={{ color: 'var(--brand-primary)' }} />}
              style={{ width: '220px' }}
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: TABLA DE EVENTOS DE AUDITORÍA */}
      <div className="widget view-content-widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--brand-gold)' }} />
            <span>Bitácora Histórica de Eventos y Auditoría de Seguridad</span>
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>
            Visualizando {filteredLogs.length} de {auditLogs.length} logs
          </span>
        </div>

        <div className="details-table-wrapper" style={{ overflowX: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          <table className="details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>TIMESTAMP</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>EVENTO TÉCNICO</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>RESPONSABLE</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>IP ORIGEN</th>
                <th style={{ padding: '10px 8px', fontWeight: 800 }}>DEVICE USER AGENT</th>
                <th style={{ padding: '10px 8px', fontWeight: 800, textAlign: 'center' }}>METADATOS</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    No se encontraron registros de auditoría técnicos que coincidan.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const logSeverity = log.severity || (
                    log.action.includes('ELIMINAR') || log.action.includes('BORRAR') || log.action.includes('SOBREESCRITURA')
                      ? 'CRITICAL'
                      : (log.action.includes('EDITAR') || log.action.includes('MODIFICAR') || log.action.includes('CONFLICT') || log.action.includes('CIERRE') || log.action.includes('AJUSTE'))
                        ? 'WARNING'
                        : 'INFO'
                  );

                  let badgeBg = 'rgba(14, 165, 164, 0.1)';
                  let badgeColor = 'var(--brand-teal, #0ea5a4)';
                  let severityLabel = 'ℹ️ BAJA';
                  
                  if (logSeverity === 'CRITICAL') {
                    badgeBg = 'rgba(239, 68, 68, 0.1)';
                    badgeColor = '#ef4444';
                    severityLabel = '🚨 CRÍTICA';
                  } else if (logSeverity === 'WARNING') {
                    badgeBg = 'rgba(251, 191, 36, 0.1)';
                    badgeColor = 'var(--brand-gold, #fbbf24)';
                    severityLabel = '⚠️ MEDIA';
                  }

                  return (
                    <tr key={log.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString('es-ES', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: 800, 
                              color: badgeColor, 
                              backgroundColor: badgeBg, 
                              padding: '3px 8px', 
                              borderRadius: '50px',
                              display: 'inline-block',
                              letterSpacing: '0.3px',
                              width: 'fit-content'
                            }}>
                              {log.action}
                            </span>
                            <span style={{ 
                              fontSize: '8.5px', 
                              fontWeight: 900, 
                              color: badgeColor, 
                              backgroundColor: badgeBg, 
                              padding: '2px 6px', 
                              borderRadius: '4px',
                              letterSpacing: '0.5px'
                            }}>
                              {severityLabel}
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {formatAuditDetailsHumanReadable(log)}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                            {log.user?.name || 'Sistema (Sync)'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {log.user?.email || 'automata@stockmaster'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {log.ipAddress}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '11.5px' }} title={log.userAgent}>
                        {log.userAgent.length > 28 ? log.userAgent.substring(0, 28) + '...' : log.userAgent}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="btn-pill-dark"
                          style={{
                            padding: '4px 10px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-input)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700
                          }}
                        >
                          <Eye size={12} />
                          <span>Inspeccionar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 0 4px 0',
            borderTop: '1px solid var(--border-color)',
            marginTop: '12px'
          }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-pill-dark"
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}
            >
              ← Anterior
            </button>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-main)' }}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-pill-dark"
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 700, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}
            >
              Siguiente →
            </button>
          </div>
        )}

      </div>

      {/* DETALLES DIALOG: INSPECTOR DE METADATOS JSON */}
      {selectedLog && (
        <div className="modal-registration-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: isMobile ? 'flex-start' : 'center',
          alignItems: isMobile ? 'stretch' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          zIndex: 1500,
          padding: isMobile ? 0 : '20px'
        }} onClick={() => setSelectedLog(null)}>
          
          <div className={`widget ${!isMobile ? 'animate-entrance' : ''} modal-registration-content`} style={{
            width: '100%',
            maxWidth: isMobile ? '100%' : '640px',
            padding: 0,
            backgroundColor: 'var(--bg-card)',
            borderRadius: isMobile ? 0 : 'var(--card-radius)',
            border: isMobile ? 'none' : '1.5px solid var(--border-color)',
            boxShadow: isMobile ? 'none' : '0 20px 50px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: isMobile ? '100dvh' : 'auto',
            maxHeight: isMobile ? '100dvh' : '90vh'
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ 
              padding: '20px 24px', 
              borderBottom: '1.5px solid var(--border-color)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-gold)', backgroundColor: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: '50px', display: 'inline-block', marginBottom: '6px' }}>
                  INSPECTOR DE METADATOS TÉCNICOS
                </span>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {selectedLog.action}
                </h4>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              
              {/* Información General del Log */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px', backgroundColor: 'var(--bg-input)', padding: '14px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 800, display: 'block' }}>Usuario Ejecutor:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{selectedLog.user?.name || 'Sistema (Sync)'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 800, display: 'block' }}>Correo / Rol:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{selectedLog.user?.email || 'N/A'} ({selectedLog.user?.role || 'N/A'})</span>
                </div>
                <div style={{ marginTop: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 800, display: 'block' }}>Dirección IP:</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{selectedLog.ipAddress}</span>
                </div>
                <div style={{ marginTop: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 800, display: 'block' }}>Timestamp Completo:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedLog.createdAt).toLocaleString('es-ES')}</span>
                </div>
              </div>

              {/* Resumen de Actividad en Español */}
              <div style={{ 
                backgroundColor: 'rgba(14, 165, 164, 0.08)', 
                border: '1.5px solid var(--brand-primary)', 
                borderRadius: '16px', 
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{ 
                  backgroundColor: 'var(--brand-primary)', 
                  color: '#fff', 
                  borderRadius: '50%', 
                  width: '28px', 
                  height: '28px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  i
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-primary)', display: 'block', marginBottom: '2px', letterSpacing: '0.5px' }}>
                    RESUMEN DE ACTIVIDAD (LECTURA HUMANA)
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, lineHeight: '1.4' }}>
                    {formatAuditDetailsHumanReadable(selectedLog)}
                  </p>
                </div>
              </div>

              {/* Inspector JSON Preformatted block */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                    METADATOS DE TRANSACCIÓN (JSON)
                  </span>
                  <button
                    onClick={() => handleCopyJson(selectedLog.details)}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: isCopied ? '#22c55e' : 'var(--brand-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700
                    }}
                  >
                    {isCopied ? <CheckCircle size={12} /> : <Copy size={12} />}
                    <span>{isCopied ? '¡Copiado!' : 'Copiar JSON'}</span>
                  </button>
                </div>

                <pre style={{
                  margin: 0,
                  padding: '16px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '16px',
                  border: '1.5px solid var(--border-color)',
                  color: 'var(--brand-primary)',
                  fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                  fontSize: '11.5px',
                  lineHeight: '1.5',
                  overflowX: 'auto',
                  maxHeight: '260px'
                }}>
                  {selectedLog.details}
                </pre>
              </div>

              {/* User Agent */}
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  CABECERA AGENTE DE CLIENTE (USER AGENT)
                </span>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', backgroundColor: 'var(--bg-input)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', wordBreak: 'break-all' }}>
                  {selectedLog.userAgent}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ 
              padding: '16px 24px', 
              borderTop: '1.5px solid var(--border-color)', 
              display: 'flex', 
              justifyContent: 'flex-end',
              backgroundColor: 'var(--bg-input)',
              ...(isMobile ? { position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 10 } : {})
            }}>
              <button
                onClick={() => setSelectedLog(null)}
                className="btn-pill-dark"
                style={{
                  padding: '8px 20px',
                  borderRadius: 'var(--button-radius)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1.5px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontWeight: 800
                }}
              >
                Cerrar Inspector
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
