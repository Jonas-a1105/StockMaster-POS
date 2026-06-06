import { useState, useEffect } from 'react';
import { 
  Building2, MapPin, Printer, Percent, ShieldCheck, AlertCircle, Save, CheckCircle, Download, Upload, Info, ArrowUpCircle, RefreshCw, HelpCircle, Sparkles
} from 'lucide-react';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';
import { useToast } from './ToastNotification';
import { getDatabase } from '../db/database';

interface BusinessSettingsProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  onOpenUpdater?: () => void;
}

export default function BusinessSettings({ user, onOpenUpdater }: BusinessSettingsProps) {
  const { settings, updateSettings, validateRIF, formatRIF } = useBusinessSettings();
  const { addToast } = useToast();

  const [businessName, setBusinessName] = useState(settings.businessName);
  const [businessAddress, setBusinessAddress] = useState(settings.businessAddress);
  const [businessRIF, setBusinessRIF] = useState(settings.businessRIF);
  const [ivaRate, setIvaRate] = useState(settings.ivaRate.toString());
  const [igtfRate, setIgtfRate] = useState(settings.igtfRate.toString());
  const [paperWidth, setPaperWidth] = useState<'80mm' | '58mm'>(settings.paperWidth);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = user.role === 'ADMIN';

  // Format RIF on mount/settings change
  useEffect(() => {
    setBusinessName(settings.businessName);
    setBusinessAddress(settings.businessAddress);
    setBusinessRIF(settings.businessRIF);
    setIvaRate(settings.ivaRate.toString());
    setIgtfRate(settings.igtfRate.toString());
    setPaperWidth(settings.paperWidth);
  }, [settings]);

  const handleRifChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRIF(e.target.value);
    setBusinessRIF(formatted);
  };

  const isRifValid = validateRIF(businessRIF);

  const handleSave = () => {
    if (!isAdmin) {
      addToast({ 
        type: 'error', 
        title: 'Acceso Denegado', 
        message: 'Solo los administradores pueden guardar configuraciones fiscales.' 
      });
      return;
    }

    if (!businessName.trim()) {
      addToast({ type: 'warning', title: 'Datos incompletos', message: 'El nombre de la empresa no puede estar vacío.' });
      return;
    }

    if (!isRifValid) {
      addToast({ type: 'error', title: 'RIF inválido', message: 'Por favor, introduce un RIF válido para Venezuela (ej. J-40812991-0).' });
      return;
    }

    setIsSaving(true);

    const parsedIva = parseFloat(ivaRate) || 0;
    const parsedIgtf = parseFloat(igtfRate) || 0;

    // Simulate saving delay for premium UX loader
    setTimeout(() => {
      updateSettings({
        businessName,
        businessAddress,
        businessRIF,
        ivaRate: parsedIva,
        igtfRate: parsedIgtf,
        paperWidth
      });
      setIsSaving(false);
      addToast({ 
        type: 'success', 
        title: 'Ajustes guardados', 
        message: 'Las configuraciones fiscales y del comercio se actualizaron correctamente.' 
      });
    }, 800);
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      // 1. Gather all localStorage items starting with stockmaster_
      const localData: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('stockmaster_')) {
          const val = localStorage.getItem(key);
          if (val) localData[key] = val;
        }
      }

      // 2. Fetch all RxDB collections
      const db = await getDatabase();
      const collectionNames = ['products', 'clients', 'sales', 'users', 'suppliers', 'purchases', 'payroll', 'attendance', 'auditLogs', 'expenses'];
      const rxdbData: Record<string, any[]> = {};

      for (const name of collectionNames) {
        const collection = (db as any)[name];
        if (collection) {
          const docs = await collection.find().exec();
          rxdbData[name] = docs.map((d: any) => d.toJSON());
        }
      }

      const backupObj = {
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        localStorage: localData,
        rxdb: rxdbData
      };

      const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const filename = `stockmaster_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast({
        type: 'success',
        title: 'Copia de seguridad exitosa',
        message: 'La base de datos RxDB y las configuraciones locales se han respaldado correctamente.'
      });
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Error al exportar',
        message: 'No se pudo generar la copia de seguridad de los datos locales.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const backupObj = JSON.parse(text);

      if (!backupObj.localStorage || !backupObj.rxdb) {
        throw new Error("Formato de respaldo inválido");
      }

      // 1. Restore localStorage keys
      Object.keys(backupObj.localStorage).forEach(key => {
        localStorage.setItem(key, backupObj.localStorage[key]);
      });

      // 2. Restore all RxDB collections dynamically
      const db = await getDatabase();
      const collectionNames = ['products', 'clients', 'sales', 'users', 'suppliers', 'purchases', 'payroll', 'attendance', 'auditLogs', 'expenses'];

      for (const name of collectionNames) {
        const docs = backupObj.rxdb[name];
        if (docs && Array.isArray(docs)) {
          const collection = (db as any)[name];
          if (collection) {
            for (const docData of docs) {
              const existing = await collection.findOne({ selector: { id: docData.id } }).exec();
              if (existing) {
                await existing.patch(docData);
              } else {
                await collection.insert(docData);
              }
            }
          }
        }
      }

      addToast({
        type: 'success',
        title: 'Respaldo restaurado',
        message: 'Los datos locales y de IndexedDB se han importado. Se recomienda recargar la página.'
      });

      // Automatically reload page after 2 seconds to apply changes cleanly
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Error de importación',
        message: 'El archivo de respaldo está corrupto o tiene un formato no compatible.'
      });
    } finally {
      setIsImporting(false);
      // Reset input element
      e.target.value = '';
    }
  };

  return (
    <div className="view-container-layout animate-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', paddingBottom: '30px' }}>
      
      {/* HEADER SECTION */}
      <div className="widget view-header-widget has-grid-content" style={{ padding: '20px', borderRadius: 'var(--card-radius)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="info-tooltip-wrapper">
              <Info size={18} className="info-tooltip-icon" style={{ color: 'var(--text-secondary)', cursor: 'help', opacity: 0.8 }} />
              <span className="tooltip-text">
                Define los parámetros operacionales, datos fiscales y configuración de facturación del comercio.
              </span>
            </div>
            {businessRIF && (
              <span className="view-header-pill pill-teal">
                RIF: {businessRIF}
              </span>
            )}
            {ivaRate && (
              <span className="view-header-pill pill-purple">
                IVA: {ivaRate}%
              </span>
            )}
          </div>
          {!isAdmin && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              color: '#ef4444',
              fontSize: '11px',
              fontWeight: 700
            }}>
              <AlertCircle size={14} />
              <span>Modo Lectura (Requiere Rol Admin)</span>
            </div>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {/* PANEL 1: DATOS FISCALES DEL COMERCIO */}
        <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Building2 size={20} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Identificación Fiscal del Comercio
            </h3>
          </div>

          {/* Nombre comercial */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Razón Social / Nombre Comercial
            </label>
            <input 
              type="text" 
              value={businessName} 
              onChange={(e) => setBusinessName(e.target.value)} 
              disabled={!isAdmin || isSaving}
              className="search-input" 
              placeholder="Ej. Distribuidora StockMaster C.A."
              autoComplete="organization"
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                borderRadius: '12px',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
            />
          </div>

          {/* RIF de la empresa con validación reactiva */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Registro de Información Fiscal (RIF)
              </label>
              {businessRIF && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: isRifValid ? '#22c55e' : '#ef4444'
                }}>
                  {isRifValid ? (
                    <>
                      <ShieldCheck size={12} />
                      <span>Estructura RIF Válida</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} />
                      <span>RIF Inválido</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <input 
              type="text" 
              value={businessRIF} 
              onChange={handleRifChange} 
              disabled={!isAdmin || isSaving}
              className="search-input" 
              placeholder="Ej. J-40812991-0"
              autoComplete="tax-id"
              style={{
                width: '100%',
                height: '42px',
                padding: '0 12px',
                borderRadius: '12px',
                border: `1.5px solid ${businessRIF ? (isRifValid ? 'var(--border-color)' : 'rgba(239, 68, 68, 0.4)') : 'var(--border-color)'}`,
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                letterSpacing: '0.5px'
              }}
            />
            {businessRIF && !isRifValid && (
              <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600 }}>
                Formato de RIF inválido. Debe ser: J-XXXXXXXX-X
              </span>
            )}
          </div>

          {/* Dirección fiscal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Dirección Fiscal de Impresión
            </label>
            <div style={{ position: 'relative' }}>
              <textarea 
                value={businessAddress} 
                onChange={(e) => setBusinessAddress(e.target.value)} 
                disabled={!isAdmin || isSaving}
                placeholder="Ej. Av. Francisco de Miranda, Chacao, Caracas..."
                rows={3}
                autoComplete="street-address"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  resize: 'none',
                  lineHeight: '1.5'
                }}
              />
              <MapPin size={16} style={{ position: 'absolute', bottom: '12px', right: '12px', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* PANEL 2: IMPUESTOS Y CONFIGURACIÓN POS */}
        <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Percent size={20} style={{ color: 'var(--brand-primary)' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Impuestos y Configuración POS
            </h3>
          </div>

          {/* IVA estándar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Impuesto al Valor Agregado (IVA)
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                value={ivaRate} 
                onChange={(e) => setIvaRate(e.target.value)} 
                disabled={!isAdmin || isSaving}
                className="search-input" 
                placeholder="16"
                min="0"
                max="100"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 32px 0 12px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              />
              <span style={{ position: 'absolute', right: '12px', top: '12px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>
                %
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              La alícuota estándar en Venezuela es del 16%. También aplica 8% para zonas especiales o exento (0%).
            </span>
          </div>

          {/* IGTF */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Impuesto a Grandes Transacciones (IGTF)
            </label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                value={igtfRate} 
                onChange={(e) => setIgtfRate(e.target.value)} 
                disabled={!isAdmin || isSaving}
                className="search-input" 
                placeholder="3"
                min="0"
                max="100"
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 32px 0 12px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '13px'
                }}
              />
              <span style={{ position: 'absolute', right: '12px', top: '12px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>
                %
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              El porcentaje legal para cobros en divisas efectivo o criptomonedas es del 3%.
            </span>
          </div>

          {/* Impresora térmica */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Ancho de Ticket Térmico
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {(['80mm', '58mm'] as const).map((width) => {
                const isSelected = paperWidth === width;
                return (
                  <button
                    key={width}
                    onClick={() => isAdmin && setPaperWidth(width)}
                    disabled={!isAdmin || isSaving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 0',
                      borderRadius: '12px',
                      border: isSelected ? '1.5px solid var(--brand-teal)' : '1.5px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(14, 165, 164, 0.08)' : 'var(--bg-input)',
                      color: isSelected ? 'var(--brand-teal)' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: isAdmin ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Printer size={14} />
                    <span>{width} {width === '80mm' ? '(Estándar)' : '(Compacto)'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* C6: RESPALDO Y RESTAURACIÓN DE DATOS LOCALES */}
      <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <ShieldCheck size={20} style={{ color: 'var(--brand-teal)' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Respaldo y Restauración de Datos
          </h3>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Exporta una copia de seguridad local en formato JSON con todas las configuraciones locales y base de datos reactiva offline (clientes, productos, ventas y nómina) o restaura un respaldo existente en el sistema.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
          <button
            onClick={handleExportBackup}
            disabled={isExporting || isImporting}
            className="btn-pill-dark"
            style={{
              padding: '12px',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '12px',
              justifyContent: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: (isExporting || isImporting) ? 'not-allowed' : 'pointer',
              opacity: (isExporting || isImporting) ? 0.7 : 1,
              backgroundColor: 'rgba(14, 165, 164, 0.1)',
              color: 'var(--brand-teal)',
              border: 'none'
            }}
          >
            <Download size={14} />
            <span>EXPORTAR RESPALDO COMPLETO</span>
          </button>

          <div style={{ position: 'relative' }}>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              disabled={isExporting || isImporting}
              id="restore-file-input"
              style={{ display: 'none' }}
            />
            <label
              htmlFor="restore-file-input"
              style={{
                padding: '12px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '12px',
                justifyContent: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: (isExporting || isImporting) ? 'not-allowed' : 'pointer',
                opacity: (isExporting || isImporting) ? 0.7 : 1,
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1.5px solid var(--border-color)',
                textAlign: 'center'
              }}
            >
              <Upload size={14} />
              <span>IMPORTAR RESPALDO COMPLETO</span>
            </label>
          </div>
        </div>
      </div>

      {/* SOFTWARE UPDATER WIDGET */}
      <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <ArrowUpCircle size={20} style={{ color: 'var(--brand-primary)' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Actualizaciones del Sistema
          </h3>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, flex: 1 }}>
            Versión actual del POS: <strong>v2.1.0</strong>. Comprueba si hay nuevas versiones del sistema para obtener mejoras fiscales, de seguridad y nuevas animaciones.
          </p>

          <button
            type="button"
            onClick={onOpenUpdater}
            className="btn-yellow"
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--button-radius)',
              fontSize: '12.5px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} />
            <span>Buscar Actualizaciones</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN: TUTORIAL DE INDUCCIÓN */}
      <div className="widget" style={{ padding: '24px', borderRadius: 'var(--card-radius)', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <HelpCircle size={20} style={{ color: 'var(--brand-primary)' }} />
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Guía de Inducción Interactiva
          </h3>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, flex: 1 }}>
            ¿Necesitas repasar el tutorial? Puedes activar el asistente de inducción para volver a configurar los parámetros y realizar paso a paso el registro de productos y ventas de prueba.
          </p>

          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('stockmaster_onboarding_completed');
              localStorage.removeItem('stockmaster_tutorial_active');
              localStorage.removeItem('stockmaster_tutorial_step');
              window.location.reload();
            }}
            className="btn-pill-dark"
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--button-radius)',
              fontSize: '12.5px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1px solid var(--brand-primary)',
              color: 'var(--brand-primary)',
              backgroundColor: 'var(--brand-primary-light)'
            }}
          >
            <Sparkles size={14} />
            <span>Iniciar Asistente y Tutorial</span>
          </button>
        </div>
      </div>

      {/* FOOTER SAVE PANEL */}
      {isAdmin && (
        <div className="widget" style={{
          padding: '16px 20px',
          borderRadius: 'var(--card-radius)',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-yellow"
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 800,
              gap: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1
            }}
          >
            {isSaving ? (
              <>
                <span className="spin" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid white', borderTop: '2px solid transparent', borderRadius: '50%' }} />
                <span>GUARDANDO...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>GUARDAR CONFIGURACIÓN</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
