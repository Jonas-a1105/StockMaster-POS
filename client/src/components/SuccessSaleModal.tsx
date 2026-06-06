import React, { useEffect, useRef, useCallback } from 'react';
import { Printer, Check, Receipt, ShoppingCart } from 'lucide-react';
import { animate } from 'animejs';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { printTicket, type TicketData } from '../utils/thermal';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';

interface SuccessSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketReceipt: {
    ticketNumber: string;
    cashierName?: string;
    clientName?: string;
    items?: Array<{ name: string; quantity: number; price: number }>;
    date?: string;
    subtotalUSD?: number;
    ivaUSD?: number;
    igtfUSD?: number;
    totalUSD: number;
    paymentMethod: string;
    dolarRate: number;
    paymentBreakdown?: {
      usd: number;
      ves: number;
      eur: number;
      change: number;
      changeCurrency: string;
    };
  } | null;
  onViewDetailedTicket: () => void;
  isMobile: boolean;
}

export const SuccessSaleModal: React.FC<SuccessSaleModalProps> = ({
  isOpen,
  onClose,
  ticketReceipt,
  onViewDetailedTicket,
  isMobile,
}) => {
  const { formatVES, formatUSD } = useExchangeRate();
  const { settings: businessSettings } = useBusinessSettings();
  const animationTriggered = useRef(false);

  useEffect(() => {
    if (isOpen && ticketReceipt) {
      animationTriggered.current = true;

      // 1. Animación del contenedor modal (escalado y fade-in)
      animate('.success-modal-card', {
        scale: [0.85, 1],
        opacity: [0, 1],
        duration: 250,
        easing: 'outBack'
      });

      // 2. Animación del círculo de fondo verde
      animate('.success-check-circle-fill', {
        scale: [0, 1],
        duration: 300,
        easing: 'outBack',
        delay: 100
      });

      // 3. Animación de trazado de la palomita blanca (SVG checkmark path)
      const path = document.querySelector('.success-check-path') as SVGPathElement;
      if (path) {
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
        animate(path, {
          strokeDashoffset: [length, 0],
          duration: 220,
          easing: 'easeOutQuad',
          delay: 200
        });
      }

      // 4. Animación radial burst de chispas
      animate('.success-sparkle-dot', {
        translateX: (el: HTMLElement, i: number) => {
          const angle = (i * 60 * Math.PI) / 180;
          return [0, Math.cos(angle) * 50];
        },
        translateY: (el: HTMLElement, i: number) => {
          const angle = (i * 60 * Math.PI) / 180;
          return [0, Math.sin(angle) * 50];
        },
        scale: [0, 1.3, 0],
        opacity: [0, 1, 0],
        duration: 550,
        easing: 'easeOutQuad',
        delay: 200
      });

      // 5. Animación de los campos de texto y detalles en cascada (Stagger)
      animate('.success-stagger-item', {
        translateY: [15, 0],
        opacity: [0, 1],
        delay: (el: HTMLElement, i: number) => 300 + i * 40,
        duration: 300,
        easing: 'outBack'
      });
    }
  }, [isOpen, ticketReceipt]);

  if (!isOpen || !ticketReceipt) return null;

  const totalVES = ticketReceipt.totalUSD * ticketReceipt.dolarRate;
  const breakdown = ticketReceipt.paymentBreakdown;
  const changeValue = breakdown?.change || 0;
  const changeCurrency = breakdown?.changeCurrency || 'VES';

  return (
    <div className="modal-registration-backdrop" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1600,
      padding: '20px',
    }} onClick={onClose}>
      <div
        className="widget success-modal-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--card-radius)',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '30px 24px',
          textAlign: 'center',
          opacity: 0,
          transform: 'scale(0.85)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ANIMATED CHECKMARK CONTAINER */}
        <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Sparkles (Chispas de éxito radiales) */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="success-sparkle-dot"
              style={{
                position: 'absolute',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: i % 2 === 0 ? 'var(--brand-teal)' : 'var(--brand-gold)',
                opacity: 0,
                transform: 'scale(0)'
              }}
            />
          ))}

          {/* SVG Checkmark */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" style={{ width: '80px', height: '80px', zIndex: 10 }}>
            {/* Círculo base de pista */}
            <circle cx="26" cy="26" r="25" fill="none" stroke="rgba(34, 197, 94, 0.15)" strokeWidth="2.5" />
            {/* Círculo relleno animado */}
            <circle
              className="success-check-circle-fill"
              cx="26"
              cy="26"
              r="25"
              fill="#22c55e"
              style={{ transform: 'scale(0)', transformOrigin: 'center' }}
            />
            {/* Trazo blanco de la palomita */}
            <path
              className="success-check-path"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.1 27.2l7.1 7.2 16.7-16.8"
            />
          </svg>
        </div>

        {/* TITLE AND TICKET */}
        <h3 className="success-stagger-item" style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
          ¡Venta Procesada!
        </h3>
        <span className="success-stagger-item" style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '50px', backgroundColor: 'var(--brand-primary-light)', color: 'var(--brand-primary)', letterSpacing: '0.5px' }}>
          TICKET: {ticketReceipt.ticketNumber}
        </span>

        {/* AMOUNT CARD */}
        <div
          className="success-stagger-item"
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-primary)',
            border: '1.5px solid var(--border-color)',
            borderRadius: '16px',
            padding: '16px',
            margin: '20px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Monto Total Cobrado
          </span>
          <strong style={{ fontSize: '26px', color: '#22c55e', lineHeight: 1 }}>
            {formatUSD(ticketReceipt.totalUSD)}
          </strong>
          <span style={{ fontSize: '12px', color: 'var(--brand-gold)', fontWeight: 800, fontFamily: 'monospace' }}>
            Bs. {totalVES.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* PAYMENT METHOD AND CHANGE DETAILS */}
        <div
          className="success-stagger-item"
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '28px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Método de Pago:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{ticketReceipt.paymentMethod}</strong>
          </div>
          
          {changeValue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(251, 191, 36, 0.05)', padding: '10px 12px', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.15)' }}>
              <span style={{ fontWeight: 700, color: 'var(--brand-gold)' }}>Vuelto a entregar:</span>
              <strong style={{ color: 'var(--brand-gold)', fontSize: '14px', fontFamily: 'monospace' }}>
                {changeCurrency === 'USD' ? formatUSD(changeValue) : formatVES(changeValue)}
              </strong>
            </div>
          )}
        </div>

        {/* BUTTON ACTIONS */}
        <div className="success-stagger-item" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            {/* Print button */}
            <button
              onClick={() => {
                const td: TicketData = {
                  title: 'StockMasterPro',
                  businessName: businessSettings.businessName || 'Mi Negocio',
                  businessRIF: businessSettings.businessRIF,
                  ticketNumber: ticketReceipt.ticketNumber,
                  date: ticketReceipt.date || new Date().toLocaleString('es-VE'),
                  cashier: ticketReceipt.cashierName || '',
                  client: ticketReceipt.clientName,
                  items: (ticketReceipt.items || []).map(i => ({ name: i.name, qty: i.quantity, price: i.price, total: i.price * i.quantity })),
                  subtotal: ticketReceipt.subtotalUSD ?? ticketReceipt.totalUSD,
                  iva: ticketReceipt.ivaUSD ?? 0,
                  igtf: ticketReceipt.igtfUSD,
                  total: ticketReceipt.totalUSD,
                  paymentMethod: ticketReceipt.paymentMethod,
                  dolarRate: ticketReceipt.dolarRate,
                };
                printTicket(td);
              }}
              className="btn-pill-dark"
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 'var(--button-radius)',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '12.5px',
                backgroundColor: 'var(--bg-input)'
              }}
            >
              <Printer size={15} />
              <span>Imprimir</span>
            </button>

            {/* View ticket details button */}
            <button
              onClick={onViewDetailedTicket}
              className="btn-pill-dark"
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 'var(--button-radius)',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '12.5px',
                backgroundColor: 'var(--bg-input)'
              }}
            >
              <Receipt size={15} />
              <span>Ver Factura</span>
            </button>
          </div>

          {/* Next sale button */}
          <button
            onClick={onClose}
            className="btn-yellow"
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 'var(--button-radius)',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 800
            }}
          >
            <ShoppingCart size={15} />
            <span>NUEVA VENTA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
