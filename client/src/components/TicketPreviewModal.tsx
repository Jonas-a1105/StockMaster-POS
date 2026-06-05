import React from 'react';
import { X, CheckCircle, Printer } from 'lucide-react';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';

interface TicketPreviewModalProps {
  ticketReceipt: any;
  onClose: () => void;
  isMobile: boolean;
}

export const TicketPreviewModal: React.FC<TicketPreviewModalProps> = ({
  ticketReceipt,
  onClose,
  isMobile,
}) => {
  const { settings } = useBusinessSettings();

  if (!ticketReceipt) return null;

  const ivaPercentage = ticketReceipt.ivaRate ?? settings.ivaRate;

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
    }} onClick={onClose}>
      <div className={`widget ${!isMobile ? 'animate-entrance' : ''} modal-registration-content`} style={{
        width: '100%',
        maxWidth: isMobile ? '100%' : '440px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: isMobile ? 0 : 'var(--card-radius)',
        border: isMobile ? 'none' : '1.5px solid var(--border-color)',
        boxShadow: isMobile ? 'none' : '0 20px 50px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: isMobile ? '100dvh' : 'auto',
        maxHeight: isMobile ? '100dvh' : '90vh',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CheckCircle size={18} style={{ color: '#22c55e' }} />
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              ¡Cobro Procesado!
            </h4>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Recibo de Factura Física Venezuela */}
        <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', flex: 1 }}>
          <div style={{
            backgroundColor: 'white',
            color: '#1a1a1a',
            fontFamily: 'Courier New, Courier, monospace',
            padding: '20px 16px',
            borderRadius: '12px',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
            fontSize: '11.5px',
            lineHeight: '1.4',
          }}>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>{settings.businessName.toUpperCase()}</div>
            <div style={{ textAlign: 'center', fontSize: '10px', color: '#555' }}>RIF: {settings.businessRIF}</div>
            <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '10px' }}>{settings.businessAddress.toUpperCase()}</div>
            <div style={{ textAlign: 'center', marginBottom: '12px', fontWeight: 'bold' }}>=== FACTURA DE VENTA FISCAL ===</div>

            <div>Ticket: {ticketReceipt.ticketNumber}</div>
            <div>Fecha: {ticketReceipt.date}</div>
            <div>Cajero: {ticketReceipt.cashierName}</div>
            <div>Cliente: {ticketReceipt.clientName}</div>
            {ticketReceipt.clientId && <div style={{ fontSize: '9px', color: '#555' }}>RIF/Cédula: {ticketReceipt.clientId}</div>}
            <div>Pago: {ticketReceipt.paymentMethod}</div>
            {ticketReceipt.paymentBreakdown && (
              <div style={{ fontSize: '9.5px', color: '#555', marginTop: '4px', borderLeft: '2px solid var(--border-color)', paddingLeft: '6px' }}>
                {ticketReceipt.paymentBreakdown.usd > 0 && <div>Recibido USD: ${ticketReceipt.paymentBreakdown.usd.toFixed(2)}</div>}
                {ticketReceipt.paymentBreakdown.ves > 0 && <div>Recibido VES: Bs. {ticketReceipt.paymentBreakdown.ves.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</div>}
                {ticketReceipt.paymentBreakdown.eur > 0 && <div>Recibido EUR: €{ticketReceipt.paymentBreakdown.eur.toFixed(2)}</div>}
                {ticketReceipt.paymentBreakdown.change > 0 && (
                  <div>
                    Vuelto ({ticketReceipt.paymentBreakdown.changeCurrency}): {ticketReceipt.paymentBreakdown.changeCurrency === 'USD'
                      ? `$${ticketReceipt.paymentBreakdown.change.toFixed(2)}`
                      : `Bs. ${ticketReceipt.paymentBreakdown.change.toLocaleString('es-VE', { minimumFractionDigits: 2 })}`}
                  </div>
                )}
              </div>
            )}
            <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>

            {ticketReceipt.items.map((item: any, i: number) => {
              const itemCostVES = item.price * ticketReceipt.dolarRate;
              const itemSubtotalVES = item.subtotal * ticketReceipt.dolarRate;
              return (
                <div key={i} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.quantity}x {item.name.substring(0, 16)}</span>
                    <span>${item.subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#555' }}>
                    <span>A tasa Bs.{ticketReceipt.dolarRate.toFixed(2)} c/u: Bs.{itemCostVES.toFixed(1)}</span>
                    <span>Bs.{itemSubtotalVES.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}

            <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal USD:</span>
              <span>${ticketReceipt.subtotalUSD.toFixed(2)}</span>
            </div>
            {ticketReceipt.discountUSD > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Descuento:</span>
                <span>-${ticketReceipt.discountUSD.toFixed(2)}</span>
              </div>
            )}
            {ticketReceipt.surchargeUSD > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Recargo:</span>
                <span>+${ticketReceipt.surchargeUSD.toFixed(2)}</span>
              </div>
            )}
            {(ticketReceipt.discountUSD > 0 || ticketReceipt.surchargeUSD > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>Base Imp.:</span>
                <span>${ticketReceipt.netSubtotalUSD.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IVA RIF ({ivaPercentage}%):</span>
              <span>${ticketReceipt.ivaUSD.toFixed(2)}</span>
            </div>
            {ticketReceipt.igtfUSD > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--brand-gold)' }}>
                <span>Recargo IGTF (3%):</span>
                <span>${ticketReceipt.igtfUSD.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', marginTop: '4px' }}>
              <span>TOTAL USD:</span>
              <span>${ticketReceipt.totalUSD.toFixed(2)}</span>
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }}></div>

            {/* Visual VES equivalences */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', color: '#000' }}>
              <span>TOTAL BS. BCV:</span>
              <span>Bs. {(ticketReceipt.totalUSD * ticketReceipt.dolarRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ fontSize: '9px', color: '#555', textAlign: 'right', marginTop: '2px' }}>
              (Ref. Tasa Oficial: Bs. {ticketReceipt.dolarRate.toFixed(2)})
            </div>

            <div style={{ borderBottom: '1.5px dashed #000', margin: '8px 0' }}></div>
            <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '8px', fontWeight: 'bold' }}>¡GRACIAS POR SU COMPRA!</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1.5px solid var(--border-color)',
          display: 'flex',
          gap: '10px',
          backgroundColor: 'var(--bg-input)',
          ...(isMobile ? { position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 10 } : {}),
        }}>
          <button
            onClick={() => window.print()}
            className="btn-pill-dark"
            style={{ flex: 1, gap: '6px', justifyContent: 'center', borderRadius: 'var(--button-radius)', backgroundColor: 'var(--bg-card)' }}
          >
            <Printer size={15} />
            <span>Imprimir</span>
          </button>
          <button
            onClick={onClose}
            className="btn-yellow"
            style={{ flex: 1, justifyContent: 'center', borderRadius: 'var(--button-radius)' }}
          >
            <span>Listo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
