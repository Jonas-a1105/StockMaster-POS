import React from 'react';
import { Camera, X } from 'lucide-react';
import type { ProductDocType } from '../db/database';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
  manualScanCode: string;
  setManualScanCode: (code: string) => void;
  onBarcodeScanned: (code: string) => void;
  products: ProductDocType[];
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  isMobile,
  manualScanCode,
  setManualScanCode,
  onBarcodeScanned,
  products,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-registration-backdrop" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: isMobile ? 'flex-start' : 'center',
      alignItems: isMobile ? 'stretch' : 'center',
      flexDirection: isMobile ? 'column' : 'row',
      zIndex: 1600,
      padding: isMobile ? 0 : '20px',
    }}>
      <style>{`
        @keyframes scannerLaserEffect {
          0% { top: 5%; }
          50% { top: 90%; }
          100% { top: 5%; }
        }
      `}</style>
      
      <div className={`widget ${!isMobile ? 'animate-entrance' : ''} modal-registration-content`} style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '680px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: isMobile ? 0 : 'var(--card-radius)',
        border: isMobile ? 'none' : '1.5px solid var(--border-color)',
        boxShadow: isMobile ? 'none' : '0 20px 50px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 240px',
        height: isMobile ? '100dvh' : 'auto',
        maxHeight: isMobile ? '100dvh' : '90vh',
      }}>
        
        {/* PANEL DE CÁMARA / VISOR */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: isMobile ? 'none' : '1.5px solid var(--border-color)' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={18} style={{ color: 'var(--brand-primary)' }} />
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Visor del Escáner WebRTC</span>
            </div>
            {isMobile && (
              <button 
                onClick={onClose}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Visor Video Feed */}
          <div style={{ 
            flex: 1, 
            backgroundColor: '#000', 
            position: 'relative', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: '260px',
            overflow: 'hidden',
          }}>
            <video 
              id="barcode-scanner-video"
              playsInline 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '260px' }}
            />

            {/* Laser de escaneo */}
            <div 
              className="scanner-laser"
              style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                height: '3px',
                backgroundColor: '#22c55e',
                boxShadow: '0 0 10px #22c55e, 0 0 18px #22c55e',
                zIndex: 10,
                animation: 'scannerLaserEffect 2.8s infinite ease-in-out',
              }}
            />

            {/* Retícula del escáner */}
            <div style={{
              position: 'absolute',
              width: '200px',
              height: '140px',
              border: '2px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '16px',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ color: '#fff', fontSize: '9px', fontWeight: 700, backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '50px', letterSpacing: '0.5px' }}>
                CENTRAR CÓDIGO
              </div>
            </div>
          </div>

          {/* Controles del Input Manual en Visor */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-input)' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Entrada Manual de Código
            </span>
            <form 
              onSubmit={(e) => { e.preventDefault(); onBarcodeScanned(manualScanCode); }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input 
                type="text" 
                placeholder="Escriba código (Ej: 1001) y Enter..." 
                className="search-input"
                value={manualScanCode}
                onChange={(e) => setManualScanCode(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--border-color)' }}
              />
              <button type="submit" className="btn-yellow" style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 800, borderRadius: '8px' }}>
                Ingresar
              </button>
            </form>
          </div>
        </div>

        {/* PANEL LATERAL DE SIMULACIÓN (HIGH FIDELITY DEVELOPER TOOL) */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--brand-gold)' }}>Simulador de Escáner</span>
            {!isMobile && (
              <button 
                onClick={onClose}
                style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Lista de productos para escaneo simulado */}
          <div style={{ flex: 1, padding: '16px', paddingBottom: isMobile ? '80px' : '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: isMobile ? '160px' : '360px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', lineHeight: '1.3' }}>
              Haga clic en un producto para simular que la cámara ha enfocado y descodificado su código de barras:
            </span>

            {products.map((prod) => (
              <button
                key={prod.id}
                onClick={() => onBarcodeScanned(prod.code)}
                className="btn-pill-dark table-row-hover"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  justifyContent: 'space-between',
                  textAlign: 'left',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                  {prod.name}
                </span>
                <span style={{ fontFamily: 'monospace', color: 'var(--brand-primary)', fontSize: '10px', flexShrink: 0 }}>
                  [{prod.code}]
                </span>
              </button>
            ))}
          </div>

          {/* Botón de cerrar para mobiles */}
          <div style={{
            padding: '14px 16px',
            borderTop: '1.5px solid var(--border-color)',
            display: 'flex',
            backgroundColor: 'var(--bg-input)',
            ...(isMobile ? { position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 10 } : {}),
          }}>
            <button
              onClick={onClose}
              className="btn-pill-dark"
              style={{ width: '100%', padding: '10px 0', borderRadius: '8px', justifyContent: 'center', backgroundColor: 'var(--bg-card)' }}
            >
              Cerrar Escáner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
