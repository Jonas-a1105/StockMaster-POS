import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User, Mail, Lock, KeyRound, Shield, ShieldCheck, AlertCircle, Save, CheckCircle,
  Eye, EyeOff, Building2, MapPin, Phone, Power, DollarSign,
  Search, Package, ToggleLeft, ToggleRight, FileDown, Filter, Info,
  Warehouse, Tag, AlertTriangle, Hash
} from 'lucide-react';
import { getDatabase, type ProductDocType } from '../db/database';
import { useToast } from './ToastNotification';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { API_URL } from '../config';
import * as bcrypt from 'bcryptjs';

interface UserProfileProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    offline: boolean;
  };
}

type ProfileTab = 'account' | 'warehouse' | 'catalog';

// ── Warehouse config shape stored as JSON string ──
interface WarehouseConfig {
  activeProductIds: string[];
  customPrices: Record<string, number>;
  customMinStocks: Record<string, number>;
  status: 'OPEN' | 'CLOSED' | 'MAINTENANCE';
  address: string;
  phone: string;
  rif: string;
  defaultCurrency: string;
}

const DEFAULT_WAREHOUSE_CONFIG: WarehouseConfig = {
  activeProductIds: [],
  customPrices: {},
  customMinStocks: {},
  status: 'OPEN',
  address: '',
  phone: '',
  rif: '',
  defaultCurrency: 'USD'
};

// ── Password strength meter ──
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 2) return { score, label: 'Débil', color: '#ef4444' };
  if (score <= 4) return { score, label: 'Aceptable', color: '#f59e0b' };
  return { score, label: 'Fuerte', color: '#22c55e' };
}

export default function UserProfile({ user }: UserProfileProps) {
  const { addToast } = useToast();
  const { formatUSD, convertToVES } = useExchangeRate();
  const [activeTab, setActiveTab] = useState<ProfileTab>('account');

  // ════════════════════════════════════════════════════
  // TAB 1: Account state
  // ════════════════════════════════════════════════════
  const [profileName, setProfileName] = useState(user.name);
  const [profileEmail, setProfileEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');

  // ════════════════════════════════════════════════════
  // TAB 2: Warehouse state
  // ════════════════════════════════════════════════════
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseConfig, setWarehouseConfig] = useState<WarehouseConfig>(DEFAULT_WAREHOUSE_CONFIG);
  const [isSavingWarehouse, setIsSavingWarehouse] = useState(false);

  // ════════════════════════════════════════════════════
  // TAB 3: Catalog state
  // ════════════════════════════════════════════════════
  const [allProducts, setAllProducts] = useState<ProductDocType[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isSavingCatalog, setIsSavingCatalog] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // ── Load user data from RxDB ──
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const db = await getDatabase();
        const userDoc = await db.users.findOne({ selector: { id: user.id } }).exec();
        if (userDoc) {
          const data = userDoc.toJSON();
          setProfileName(data.name || user.name);
          setProfileEmail(data.email || user.email);
          // Load warehouse fields
          setWarehouseName((data as any).warehouseName || '');
          try {
            const config = JSON.parse((data as any).warehouseConfig || '{}');
            setWarehouseConfig({ ...DEFAULT_WAREHOUSE_CONFIG, ...config });
          } catch {
            setWarehouseConfig(DEFAULT_WAREHOUSE_CONFIG);
          }
        }
      } catch (err) {
        console.error('Error loading user profile data:', err);
      }
    };
    loadUserData();
  }, [user.id, user.name, user.email]);

  // ── Load all products for catalog tab ──
  useEffect(() => {
    let sub: any;
    const loadProducts = async () => {
      try {
        const db = await getDatabase();
        sub = db.products.find().$.subscribe((docs) => {
          setAllProducts(docs.map(d => d.toJSON()));
        });
      } catch (err) {
        console.error('Error loading products for catalog:', err);
      }
    };
    loadProducts();
    return () => sub?.unsubscribe();
  }, []);

  // ── Derived: user initials for avatar ──
  const initials = useMemo(() => {
    const parts = user.name.split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : user.name.substring(0, 2).toUpperCase();
  }, [user.name]);

  // ── Derived: password strength ──
  const pwStrength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  // ── Derived: filtered products for catalog ──
  const filteredCatalogProducts = useMemo(() => {
    let list = allProducts.filter(p => !p.deletedAt);
    // Search filter
    if (catalogSearch.trim()) {
      const term = catalogSearch.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.code.toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term)
      );
    }
    // Active/Inactive filter
    if (catalogFilter === 'active') {
      list = list.filter(p => warehouseConfig.activeProductIds.includes(p.id));
    } else if (catalogFilter === 'inactive') {
      list = list.filter(p => !warehouseConfig.activeProductIds.includes(p.id));
    }
    return list;
  }, [allProducts, catalogSearch, catalogFilter, warehouseConfig.activeProductIds]);

  const activeCount = useMemo(() => {
    return allProducts.filter(p => !p.deletedAt && warehouseConfig.activeProductIds.includes(p.id)).length;
  }, [allProducts, warehouseConfig.activeProductIds]);

  const totalCount = useMemo(() => allProducts.filter(p => !p.deletedAt).length, [allProducts]);

  // ════════════════════════════════════════════════════
  // HANDLERS
  // ════════════════════════════════════════════════════

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      addToast({ type: 'warning', title: 'Nombre requerido', message: 'El nombre de usuario no puede estar vacío.' });
      return;
    }
    setIsSavingAccount(true);
    try {
      const db = await getDatabase();
      const userDoc = await db.users.findOne({ selector: { id: user.id } }).exec();
      if (userDoc) {
        await userDoc.patch({
          name: profileName.trim(),
          email: profileEmail.trim(),
          updatedAt: new Date().toISOString()
        });
      }
      // Update localStorage session
      const cached = localStorage.getItem('auth_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.name = profileName.trim();
        parsed.email = profileEmail.trim();
        localStorage.setItem('auth_user', JSON.stringify(parsed));
      }
      setTimeout(() => {
        setIsSavingAccount(false);
        addToast({ type: 'success', title: 'Perfil actualizado', message: 'Los datos de tu perfil han sido guardados correctamente.' });
      }, 600);
    } catch (err) {
      setIsSavingAccount(false);
      addToast({ type: 'error', title: 'Error', message: 'No se pudieron guardar los datos del perfil.' });
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast({ type: 'warning', title: 'Campos incompletos', message: 'Completa todos los campos de contraseña.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ type: 'error', title: 'Error', message: 'La nueva contraseña y su confirmación no coinciden.' });
      return;
    }
    if (newPassword.length < 8) {
      addToast({ type: 'error', title: 'Contraseña débil', message: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    setIsSavingPassword(true);
    try {
      const db = await getDatabase();
      const userDoc = await db.users.findOne({ selector: { id: user.id } }).exec();
      if (!userDoc) throw new Error('Usuario no encontrado');
      const data = userDoc.toJSON();
      const isMatch = await bcrypt.compare(currentPassword, data.passwordHash);
      if (!isMatch) {
        addToast({ type: 'error', title: 'Contraseña incorrecta', message: 'La contraseña actual ingresada es incorrecta.' });
        setIsSavingPassword(false);
        return;
      }
      const newHash = await bcrypt.hash(newPassword, 10);
      await userDoc.patch({ passwordHash: newHash, updatedAt: new Date().toISOString() });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsSavingPassword(false);
        addToast({ type: 'success', title: 'Contraseña cambiada', message: 'Tu contraseña ha sido actualizada exitosamente.' });
      }, 600);
    } catch (err) {
      setIsSavingPassword(false);
      addToast({ type: 'error', title: 'Error', message: 'No se pudo actualizar la contraseña.' });
    }
  };

  const handleChangePin = async () => {
    if (!newPin || !confirmPin) {
      addToast({ type: 'warning', title: 'Campos incompletos', message: 'Completa ambos campos de PIN.' });
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      addToast({ type: 'error', title: 'PIN inválido', message: 'El PIN debe ser numérico de 4 a 6 dígitos.' });
      return;
    }
    if (newPin !== confirmPin) {
      addToast({ type: 'error', title: 'Error', message: 'Los PINs ingresados no coinciden.' });
      return;
    }
    setIsSavingPin(true);
    try {
      const db = await getDatabase();
      const userDoc = await db.users.findOne({ selector: { id: user.id } }).exec();
      if (!userDoc) throw new Error('Usuario no encontrado');
      const pinHash = await bcrypt.hash(newPin, 10);
      await userDoc.patch({ pinHash, updatedAt: new Date().toISOString() });
      setNewPin('');
      setConfirmPin('');
      setTimeout(() => {
        setIsSavingPin(false);
        addToast({ type: 'success', title: 'PIN actualizado', message: 'Tu código PIN offline ha sido cambiado exitosamente.' });
      }, 600);
    } catch (err) {
      setIsSavingPin(false);
      addToast({ type: 'error', title: 'Error', message: 'No se pudo actualizar el PIN.' });
    }
  };

  const handleSendVerification = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/auth/send-verification`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setVerifyMsg(data.message || 'Enviado');
      addToast({ type: 'success', title: 'Correo enviado', message: data.message || 'Revisa tu bandeja de entrada.' });
      setTimeout(() => setVerifyMsg(''), 5000);
    } catch {
      setVerifyMsg('Error al enviar');
      addToast({ type: 'error', title: 'Error', message: 'No se pudo enviar el correo de verificación.' });
      setTimeout(() => setVerifyMsg(''), 3000);
    }
  };

  const handleSaveWarehouse = async () => {
    setIsSavingWarehouse(true);
    try {
      const db = await getDatabase();
      const userDoc = await db.users.findOne({ selector: { id: user.id } }).exec();
      if (userDoc) {
        await userDoc.patch({
          warehouseName: warehouseName.trim(),
          warehouseConfig: JSON.stringify(warehouseConfig),
          updatedAt: new Date().toISOString()
        } as any);
      }
      setTimeout(() => {
        setIsSavingWarehouse(false);
        addToast({ type: 'success', title: 'Bodega guardada', message: 'La configuración de tu bodega ha sido actualizada.' });
      }, 600);
    } catch (err) {
      setIsSavingWarehouse(false);
      addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar la configuración de la bodega.' });
    }
  };

  const toggleProductActive = useCallback((productId: string) => {
    setWarehouseConfig(prev => {
      const isActive = prev.activeProductIds.includes(productId);
      return {
        ...prev,
        activeProductIds: isActive
          ? prev.activeProductIds.filter(id => id !== productId)
          : [...prev.activeProductIds, productId]
      };
    });
  }, []);

  const handleActivateAll = () => {
    const allIds = allProducts.filter(p => !p.deletedAt).map(p => p.id);
    setWarehouseConfig(prev => ({ ...prev, activeProductIds: allIds }));
  };

  const handleDeactivateAll = () => {
    setWarehouseConfig(prev => ({ ...prev, activeProductIds: [] }));
  };

  const handleSaveCatalog = async () => {
    setIsSavingCatalog(true);
    try {
      const db = await getDatabase();
      const userDoc = await db.users.findOne({ selector: { id: user.id } }).exec();
      if (userDoc) {
        await userDoc.patch({
          warehouseConfig: JSON.stringify(warehouseConfig),
          updatedAt: new Date().toISOString()
        } as any);
      }
      setTimeout(() => {
        setIsSavingCatalog(false);
        addToast({ type: 'success', title: 'Catálogo guardado', message: `${activeCount} productos activos en tu bodega.` });
      }, 600);
    } catch (err) {
      setIsSavingCatalog(false);
      addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar la personalización del catálogo.' });
    }
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      const activeProducts = allProducts.filter(p => !p.deletedAt && warehouseConfig.activeProductIds.includes(p.id));
      if (activeProducts.length === 0) {
        addToast({ type: 'warning', title: 'Sin productos', message: 'Activa al menos un producto para exportar el catálogo.' });
        setIsExportingPDF(false);
        return;
      }

      // Build HTML for PDF
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });

      // Group products by category
      const grouped: Record<string, ProductDocType[]> = {};
      activeProducts.forEach(p => {
        const cat = p.category || 'Sin categoría';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
      });

      let tableRows = '';
      Object.keys(grouped).sort().forEach(cat => {
        tableRows += `<tr><td colspan="5" style="background:#0ea5a4;color:#fff;font-weight:800;padding:10px 14px;font-size:13px;border:none;">${cat}</td></tr>`;
        grouped[cat].forEach((p, i) => {
          const bgColor = i % 2 === 0 ? '#f8fafb' : '#ffffff';
          tableRows += `
            <tr style="background:${bgColor};">
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:700;">${p.name}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#64748b;font-family:monospace;">${p.code}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:800;color:#0ea5a4;">$${p.price.toFixed(2)}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:700;">${p.stock} u.</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:11px;color:${p.stock <= (p.minStock || 5) ? '#ef4444' : '#22c55e'};font-weight:700;">${p.stock <= (p.minStock || 5) ? 'Stock Bajo' : 'Disponible'}</td>
            </tr>
          `;
        });
      });

      const html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>Catálogo de Productos - ${warehouseName || 'Mi Bodega'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fff; }
            .header { background: linear-gradient(135deg, #0ea5a4 0%, #0c8c8b 100%); color: #fff; padding: 32px 40px; }
            .header h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
            .header p { font-size: 12px; opacity: 0.85; }
            .meta { display: flex; gap: 32px; padding: 20px 40px; background: #f8fafb; border-bottom: 2px solid #e5e7eb; font-size: 12px; color: #64748b; }
            .meta strong { color: #1a1a2e; }
            table { width: 100%; border-collapse: collapse; margin-top: 0; }
            th { background: #1a1a2e; color: #fff; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
            .footer { text-align: center; padding: 24px; font-size: 10px; color: #94a3b8; border-top: 2px solid #e5e7eb; margin-top: 20px; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📦 ${warehouseName || 'Catálogo de Productos'}</h1>
            <p>${warehouseConfig.address || 'StockMasterPro — Sistema de Inventario Inteligente'}</p>
          </div>
          <div class="meta">
            <span>📅 Fecha: <strong>${dateStr}</strong></span>
            <span>📦 Total Productos: <strong>${activeProducts.length}</strong></span>
            <span>📂 Categorías: <strong>${Object.keys(grouped).length}</strong></span>
            ${warehouseConfig.phone ? `<span>📞 Tel: <strong>${warehouseConfig.phone}</strong></span>` : ''}
            ${warehouseConfig.rif ? `<span>🏢 RIF: <strong>${warehouseConfig.rif}</strong></span>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código</th>
                <th>Precio USD</th>
                <th>Stock</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="footer">
            Generado por StockMasterPro © ${now.getFullYear()} — Catálogo exclusivo de ${warehouseName || 'esta bodega'}. Precios sujetos a cambios.
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      addToast({ type: 'success', title: 'PDF generado', message: 'El catálogo se ha abierto para impresión/exportación.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: 'No se pudo generar el PDF del catálogo.' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // ════════════════════════════════════════════════════
  // TAB NAV DEFINITIONS
  // ════════════════════════════════════════════════════
  const tabs: { id: ProfileTab; label: string; icon: any }[] = [
    { id: 'account', label: 'Mi Cuenta', icon: User },
    { id: 'warehouse', label: 'Mi Bodega', icon: Warehouse },
    { id: 'catalog', label: 'Mi Catálogo', icon: Package },
  ];

  // ── Shared input style ──
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '42px',
    padding: '0 12px 0 40px',
    borderRadius: '12px',
    border: '1.5px solid var(--border-color)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.25s ease'
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 800,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  };

  const iconInInputStyle: React.CSSProperties = {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted)'
  };

  // ════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════
  return (
    <div className="view-container-layout animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>

      {/* ── HEADER WIDGET ── */}
      <div className="widget view-header-widget has-grid-content" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* User avatar with gradient initials */}
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-gold) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 900,
              color: '#fff',
              letterSpacing: '1px',
              boxShadow: '0 4px 16px rgba(14, 165, 164, 0.3)',
              flexShrink: 0
            }}>
              {initials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>{user.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{user.email}</span>
            </div>
            <span className="view-header-pill pill-teal" style={{ marginLeft: '4px' }}>
              {user.role}
            </span>
            <span className="view-header-pill" style={{
              backgroundColor: user.offline ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
              color: user.offline ? '#ef4444' : '#22c55e',
              border: `1px solid ${user.offline ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`
            }}>
              {user.offline ? 'OFFLINE' : 'ONLINE'}
            </span>
          </div>
          <div className="info-tooltip-wrapper">
            <Info size={18} className="info-tooltip-icon" style={{ color: 'var(--text-secondary)', cursor: 'help', opacity: 0.8 }} />
            <span className="tooltip-text">
              Administra tu perfil de usuario, configura tu bodega y personaliza el catálogo de productos que ofreces.
            </span>
          </div>
        </div>
      </div>

      {/* ── TAB NAVIGATION ── */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '12px',
                border: isActive ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                backgroundColor: isActive ? 'var(--brand-primary)' : 'var(--bg-card)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                transform: isActive ? 'translateY(-1px)' : 'none',
                boxShadow: isActive ? '0 4px 14px rgba(14, 165, 164, 0.25)' : 'none'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════ */}
      {/* TAB 1: MI CUENTA                                */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === 'account' && (
        <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>

            {/* ── Panel: Datos de Perfil ── */}
            <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <User size={20} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Información Personal
                </h3>
              </div>

              {/* Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Nombre Completo</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={iconInInputStyle} />
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Tu nombre completo"
                    className="search-input"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={labelStyle}>Correo Electrónico</label>
                  <button
                    onClick={handleSendVerification}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: 'var(--brand-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {verifyMsg ? <CheckCircle size={12} /> : <Mail size={12} />}
                    {verifyMsg || 'Verificar correo'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={iconInInputStyle} />
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="search-input"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Role (read-only) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Rol Asignado</label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(14, 165, 164, 0.06)',
                  border: '1.5px solid rgba(14, 165, 164, 0.15)'
                }}>
                  <Shield size={16} style={{ color: 'var(--brand-primary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--brand-primary)' }}>
                    {user.role === 'ADMIN' ? 'Administrador (Control Total)' :
                     user.role === 'AUDITOR' ? 'Auditor (Reportes y Bitácora)' :
                     'Cajero (Operación POS)'}
                  </span>
                </div>
              </div>

              {/* Save profile button */}
              <button
                onClick={handleSaveProfile}
                disabled={isSavingAccount}
                className="btn-yellow"
                style={{
                  padding: '12px 0',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSavingAccount ? 'not-allowed' : 'pointer',
                  opacity: isSavingAccount ? 0.7 : 1
                }}
              >
                {isSavingAccount ? (
                  <><span className="spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%' }} /><span>GUARDANDO...</span></>
                ) : (
                  <><Save size={16} /><span>GUARDAR PERFIL</span></>
                )}
              </button>
            </div>

            {/* ── Panel: Seguridad ── */}
            <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Lock size={20} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Seguridad y Credenciales
                </h3>
              </div>

              {/* Current Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Contraseña Actual</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={iconInInputStyle} />
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Tu contraseña actual"
                    className="search-input"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Nueva Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={iconInInputStyle} />
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="search-input"
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Password strength meter */}
                {newPassword && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <div style={{ flex: 1, height: '4px', borderRadius: '4px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                      <div style={{ width: `${(pwStrength.score / 6) * 100}%`, height: '100%', borderRadius: '4px', backgroundColor: pwStrength.color, transition: 'all 0.3s ease' }} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: pwStrength.color }}>{pwStrength.label}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Confirmar Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck size={16} style={iconInInputStyle} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className="search-input"
                    style={{
                      ...inputStyle,
                      borderColor: confirmPassword && confirmPassword !== newPassword ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'
                    }}
                  />
                  {confirmPassword && (
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                      {confirmPassword === newPassword
                        ? <CheckCircle size={16} style={{ color: '#22c55e' }} />
                        : <AlertCircle size={16} style={{ color: '#ef4444' }} />
                      }
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleChangePassword}
                disabled={isSavingPassword}
                className="btn-pill-dark"
                style={{
                  padding: '12px 0',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isSavingPassword ? 'not-allowed' : 'pointer',
                  opacity: isSavingPassword ? 0.7 : 1,
                  border: '1.5px solid var(--border-color)'
                }}
              >
                {isSavingPassword ? 'CAMBIANDO...' : 'CAMBIAR CONTRASEÑA'}
              </button>

              {/* Separator */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={16} style={{ color: 'var(--brand-gold)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>Código PIN Offline</span>
                </div>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  El PIN de 4-6 dígitos se usa para iniciar sesión rápidamente cuando no hay conexión a internet.
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <Hash size={16} style={iconInInputStyle} />
                    <input
                      type="password"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Nuevo PIN"
                      className="search-input"
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Hash size={16} style={iconInInputStyle} />
                    <input
                      type="password"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Confirmar PIN"
                      className="search-input"
                      style={{
                        ...inputStyle,
                        borderColor: confirmPin && confirmPin !== newPin ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-color)'
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleChangePin}
                  disabled={isSavingPin}
                  className="btn-pill-dark"
                  style={{
                    padding: '10px 0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: isSavingPin ? 'not-allowed' : 'pointer',
                    opacity: isSavingPin ? 0.7 : 1,
                    border: '1.5px solid var(--border-color)'
                  }}
                >
                  {isSavingPin ? 'GUARDANDO...' : 'ACTUALIZAR PIN OFFLINE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* TAB 2: MI BODEGA                                */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === 'warehouse' && (
        <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>

            {/* ── Panel: Identificación de la Bodega ── */}
            <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Building2 size={20} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Identificación de la Bodega
                </h3>
              </div>

              {/* Warehouse Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Nombre de la Sucursal / Bodega</label>
                <div style={{ position: 'relative' }}>
                  <Warehouse size={16} style={iconInInputStyle} />
                  <input
                    type="text"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    placeholder="Ej: Sucursal Chacao - Almacén A"
                    className="search-input"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Address */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Dirección Física</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ ...iconInInputStyle, top: '18px' }} />
                  <textarea
                    value={warehouseConfig.address}
                    onChange={(e) => setWarehouseConfig(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Av. Principal, Centro Comercial, Local 12..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 40px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      resize: 'none',
                      lineHeight: '1.5',
                      outline: 'none',
                      transition: 'all 0.25s ease'
                    }}
                  />
                </div>
              </div>

              {/* Phone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Teléfono de la Sucursal</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={iconInInputStyle} />
                  <input
                    type="text"
                    value={warehouseConfig.phone}
                    onChange={(e) => setWarehouseConfig(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ej: 0212-555-1234"
                    className="search-input"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Local RIF */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>RIF de la Sucursal (Opcional)</label>
                <div style={{ position: 'relative' }}>
                  <Tag size={16} style={iconInInputStyle} />
                  <input
                    type="text"
                    value={warehouseConfig.rif}
                    onChange={(e) => setWarehouseConfig(prev => ({ ...prev, rif: e.target.value }))}
                    placeholder="Ej: J-40812991-0"
                    className="search-input"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* ── Panel: Estado Operativo ── */}
            <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Power size={20} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Estado Operativo y Preferencias
                </h3>
              </div>

              {/* Status selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Estado de la Bodega</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {([
                    { value: 'OPEN', label: 'Abierta', color: '#22c55e', emoji: '🟢' },
                    { value: 'CLOSED', label: 'Cerrada', color: '#ef4444', emoji: '🔴' },
                    { value: 'MAINTENANCE', label: 'Mantenimiento', color: '#f59e0b', emoji: '🟡' }
                  ] as const).map(opt => {
                    const isSelected = warehouseConfig.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setWarehouseConfig(prev => ({ ...prev, status: opt.value }))}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '14px 8px',
                          borderRadius: '12px',
                          border: isSelected ? `1.5px solid ${opt.color}` : '1.5px solid var(--border-color)',
                          backgroundColor: isSelected ? `${opt.color}10` : 'var(--bg-input)',
                          color: isSelected ? opt.color : 'var(--text-secondary)',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Default Currency */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Moneda por Defecto</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { value: 'USD', label: 'Dólar USD', emoji: '💵' },
                    { value: 'VES', label: 'Bolívar VES', emoji: '🏦' },
                    { value: 'EUR', label: 'Euro EUR', emoji: '💶' }
                  ].map(opt => {
                    const isSelected = warehouseConfig.defaultCurrency === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setWarehouseConfig(prev => ({ ...prev, defaultCurrency: opt.value }))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px 8px',
                          borderRadius: '12px',
                          border: isSelected ? '1.5px solid var(--brand-primary)' : '1.5px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(14, 165, 164, 0.08)' : 'var(--bg-input)',
                          color: isSelected ? 'var(--brand-primary)' : 'var(--text-secondary)',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span>{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary info */}
              <div style={{
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: 'rgba(14, 165, 164, 0.04)',
                border: '1px solid rgba(14, 165, 164, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Resumen de Bodega</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package size={14} style={{ color: 'var(--brand-primary)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700 }}>
                      {activeCount} de {totalCount} productos activos
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <DollarSign size={14} style={{ color: 'var(--brand-gold)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 700 }}>
                      Moneda: {warehouseConfig.defaultCurrency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save warehouse button */}
          <div className="widget" style={{ padding: '16px 20px', borderRadius: 'var(--card-radius)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSaveWarehouse}
              disabled={isSavingWarehouse}
              className="btn-yellow"
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isSavingWarehouse ? 'not-allowed' : 'pointer',
                opacity: isSavingWarehouse ? 0.7 : 1
              }}
            >
              {isSavingWarehouse ? (
                <><span className="spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%' }} /><span>GUARDANDO...</span></>
              ) : (
                <><Save size={16} /><span>GUARDAR CONFIGURACIÓN DE BODEGA</span></>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* TAB 3: MI CATÁLOGO                              */}
      {/* ════════════════════════════════════════════════ */}
      {activeTab === 'catalog' && (
        <div className="animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Toolbar: Search + Filters + Actions ── */}
          <div className="widget" style={{ padding: '16px 20px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search size={16} style={iconInInputStyle} />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Buscar por nombre, código o categoría..."
                  className="search-input"
                  style={{ ...inputStyle, height: '38px' }}
                />
              </div>

              {/* Filter pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700 }}>
                  <Filter size={13} />
                </div>
                {([
                  { value: 'all' as const, label: `Todos (${totalCount})` },
                  { value: 'active' as const, label: `Activos (${activeCount})` },
                  { value: 'inactive' as const, label: `Inactivos (${totalCount - activeCount})` }
                ]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCatalogFilter(opt.value)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '20px',
                      border: catalogFilter === opt.value
                        ? (opt.value === 'active' ? '1.5px solid #22c55e' : opt.value === 'inactive' ? '1.5px solid #ef4444' : '1.5px solid var(--brand-primary)')
                        : '1.5px solid var(--border-color)',
                      backgroundColor: catalogFilter === opt.value
                        ? (opt.value === 'active' ? 'rgba(34,197,94,0.08)' : opt.value === 'inactive' ? 'rgba(239,68,68,0.08)' : 'var(--brand-primary-light)')
                        : 'var(--bg-input)',
                      color: catalogFilter === opt.value
                        ? (opt.value === 'active' ? '#22c55e' : opt.value === 'inactive' ? '#ef4444' : 'var(--brand-primary)')
                        : 'var(--text-secondary)',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleActivateAll}
                  className="btn-pill-dark"
                  style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(34,197,94,0.2)', backgroundColor: 'rgba(34,197,94,0.06)', color: '#22c55e', cursor: 'pointer' }}
                >
                  <ToggleRight size={14} /> Activar Todos
                </button>
                <button
                  onClick={handleDeactivateAll}
                  className="btn-pill-dark"
                  style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer' }}
                >
                  <ToggleLeft size={14} /> Desactivar Todos
                </button>
              </div>
              <button
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="btn-pill-dark"
                style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(14,165,164,0.2)', backgroundColor: 'rgba(14,165,164,0.06)', color: 'var(--brand-primary)', cursor: 'pointer' }}
              >
                <FileDown size={14} /> {isExportingPDF ? 'Generando...' : 'Exportar Catálogo PDF'}
              </button>
            </div>
          </div>

          {/* ── Product Grid ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {filteredCatalogProducts.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                <Package size={48} style={{ color: 'var(--border-color)', marginBottom: '12px' }} />
                <p style={{ fontSize: '14px', fontWeight: 700 }}>
                  {catalogSearch ? `No se encontraron productos para "${catalogSearch}"` : 'No hay productos en el inventario.'}
                </p>
              </div>
            ) : (
              filteredCatalogProducts.map(product => {
                const isActive = warehouseConfig.activeProductIds.includes(product.id);
                const isLowStock = product.stock <= (product.minStock || 5);
                const priceVES = convertToVES(product.price);

                return (
                  <div
                    key={product.id}
                    className="widget"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '16px',
                      borderRadius: 'var(--card-radius)',
                      minHeight: '185px',
                      position: 'relative',
                      transition: 'all 0.25s ease',
                      opacity: isActive ? 1 : 0.5,
                      border: isActive ? '1.5px solid rgba(14, 165, 164, 0.25)' : '1.5px solid var(--border-color)',
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleProductActive(product.id)}
                  >
                    {/* Active/Inactive badge */}
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 10px',
                      borderRadius: '50px',
                      fontSize: '9px',
                      fontWeight: 800,
                      backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)',
                      color: isActive ? '#22c55e' : '#94a3b8',
                      border: `1px solid ${isActive ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.15)'}`
                    }}>
                      {isActive ? <ToggleRight size={10} /> : <ToggleLeft size={10} />}
                      {isActive ? 'ACTIVO' : 'INACTIVO'}
                    </div>

                    <div style={{ paddingRight: '70px' }}>
                      <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {product.category || 'Sin categoría'}
                      </span>
                      <h4 style={{ fontSize: '13.5px', fontWeight: 800, margin: '4px 0 2px 0', lineHeight: '1.2', color: 'var(--text-primary)' }}>
                        {product.name}
                      </h4>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        SKU: {product.code}
                      </span>
                    </div>

                    {/* Price + stock row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '15px', fontWeight: 850, color: 'var(--text-primary)' }}>
                          {formatUSD(product.price)}
                        </span>
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--brand-gold)', fontFamily: 'monospace', marginTop: '1px' }}>
                          Bs. {priceVES.toLocaleString('es-VE', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <span className={`status-badge ${product.stock === 0 ? 'shipped' : isLowStock ? 'shipped' : 'delivered'}`} style={{ fontSize: '10px' }}>
                          {product.stock === 0 ? 'Agotado' : `${product.stock} u.`}
                        </span>
                        {isLowStock && product.stock > 0 && (
                          <span style={{ fontSize: '8px', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <AlertTriangle size={9} /> Stock bajo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Save catalog bar ── */}
          <div className="widget" style={{ padding: '16px 20px', borderRadius: 'var(--card-radius)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700 }}>
              📦 <strong style={{ color: 'var(--brand-primary)' }}>{activeCount}</strong> de {totalCount} productos seleccionados para esta bodega
            </span>
            <button
              onClick={handleSaveCatalog}
              disabled={isSavingCatalog}
              className="btn-yellow"
              style={{
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isSavingCatalog ? 'not-allowed' : 'pointer',
                opacity: isSavingCatalog ? 0.7 : 1
              }}
            >
              {isSavingCatalog ? (
                <><span className="spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%' }} /><span>GUARDANDO...</span></>
              ) : (
                <><Save size={16} /><span>GUARDAR CATÁLOGO PERSONALIZADO</span></>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
