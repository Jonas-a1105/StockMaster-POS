import React from 'react';
import { X } from 'lucide-react';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalUSD: number;
  subtotalUSD: number;
  ivaUSD: number;
  igtfApplied: boolean;
  setIgtfApplied: (val: boolean) => void;
  igtfUSD: number;
  totalDueUSD: number;
  remainingUSD: number;
  changeUSD: number;
  changeVES: number;
  usdPaid: string;
  setUsdPaid: (val: string) => void;
  vesPaid: string;
  setVesPaid: (val: string) => void;
  eurPaid: string;
  setEurPaid: (val: string) => void;
  changeCurrency: 'USD' | 'VES';
  setChangeCurrency: (val: 'USD' | 'VES') => void;
  onConfirmCheckout: () => void;
  dolarRate: number;
  isMobile: boolean;
  selectedClient: any; // Cliente seleccionado
  paymentMethod: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CRÉDITO';
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  totalUSD,
  subtotalUSD,
  ivaUSD,
  igtfApplied,
  setIgtfApplied,
  igtfUSD,
  totalDueUSD,
  remainingUSD,
  changeUSD,
  changeVES,
  usdPaid,
  setUsdPaid,
  vesPaid,
  setVesPaid,
  eurPaid,
  setEurPaid,
  changeCurrency,
  setChangeCurrency,
  onConfirmCheckout,
  dolarRate,
  isMobile,
  selectedClient,
  paymentMethod,
}) => {
  const { formatVES, formatUSD } = useExchangeRate();
  const { settings } = useBusinessSettings();

  if (!isOpen) return null;

  const isCredit = paymentMethod === 'CRÉDITO';
  const creditLimit = selectedClient?.creditLimit || 0;
  const creditBalance = selectedClient?.creditBalance || 0;
  const remainingCredit = Math.max(0, creditLimit - creditBalance);
  const newCreditBalance = creditBalance + totalDueUSD;
  const isCreditApproved = selectedClient && creditLimit > 0 && newCreditBalance <= creditLimit;

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
      zIndex: 1500,
      padding: isMobile ? 0 : '20px',
    }} onClick={onClose}>
      <div
        className={`widget ${!isMobile ? 'animate-entrance' : ''} modal-registration-content`}
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '460px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: isMobile ? 0 : 'var(--card-radius)',
          border: isMobile ? 'none' : '1.5px solid var(--border-color)',
          boxShadow: isMobile ? 'none' : '0 20px 50px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: isMobile ? '100dvh' : 'auto',
          maxHeight: isMobile ? '100dvh' : '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1.5px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {isCredit ? 'Autorización de Compra a Crédito' : 'Registro de Cobro y Vuelto'}
          </h4>
          <button
            onClick={onClose}
            style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '24px', paddingBottom: isMobile ? '90px' : '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          {/* Resumen a Pagar */}
          <div style={{
            padding: '14px',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-primary)',
            border: '1.5px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' }}>TOTAL A COBRAR (BASE)</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '18px' }}>
                {formatUSD(totalUSD)}
              </strong>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '11px', color: 'var(--brand-gold)', fontWeight: 700, fontFamily: 'monospace' }}>
                {formatVES(totalUSD)}
              </span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Tasa: Bs. {dolarRate.toFixed(2)}</span>
            </div>
          </div>

          {isCredit ? (
            /* VISTA DE APROBACIÓN DE CRÉDITO */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                backgroundColor: 'rgba(14, 165, 164, 0.04)',
                border: '1.5px solid rgba(14, 165, 164, 0.15)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--brand-teal)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  EXPEDIENTE DE CRÉDITO DEL CLIENTE
                </span>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Cliente:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedClient?.name || 'Cliente General'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>RIF / Cédula:</span>
                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{selectedClient?.id || 'N/A'}</strong>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '9.5px', textTransform: 'uppercase' }}>Límite</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatUSD(creditLimit)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '9.5px', textTransform: 'uppercase' }}>Deuda Actual</span>
                    <strong style={{ color: '#ef4444' }}>{formatUSD(creditBalance)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '9.5px', textTransform: 'uppercase' }}>Disponible</span>
                    <strong style={{ color: '#22c55e' }}>{formatUSD(remainingCredit)}</strong>
                  </div>
                </div>
              </div>

              {/* Proyección y Estado */}
              <div style={{
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: isCreditApproved ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                border: `1.5px solid ${isCreditApproved ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                {isCreditApproved ? (
                  <>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      CRÉDITO AUTORIZADO
                    </span>
                    <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
                      Nuevo Saldo: {formatUSD(newCreditBalance)}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      La venta se encuentra dentro del límite de crédito disponible.
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      CRÉDITO RECHAZADO
                    </span>
                    <strong style={{ fontSize: '16px', color: '#ef4444' }}>
                      {creditLimit === 0 
                        ? 'Sin Línea de Crédito Autorizada' 
                        : `Excede Límite por ${formatUSD(newCreditBalance - creditLimit)}`}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {creditLimit === 0 
                        ? 'Establezca un límite de crédito mayor a cero para este cliente en el panel de clientes.' 
                        : 'El monto total supera el límite de crédito disponible.'}
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* VISTA DE PAGO EN DIVISAS Y EFECTIVO / MÉTODOS TRADICIONALES */
            <>
              {/* Toggle IGTF 3% Divisas */}
              <div style={{
                padding: '12px 14px',
                borderRadius: '14px',
                backgroundColor: igtfApplied ? 'rgba(251, 191, 36, 0.05)' : 'transparent',
                border: `1.5px solid ${igtfApplied ? 'rgba(251, 191, 36, 0.25)' : 'var(--border-color)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }} onClick={() => setIgtfApplied(!igtfApplied)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '85%' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: igtfApplied ? 'var(--brand-gold)' : 'var(--text-primary)' }}>
                    Aplicar Impuesto IGTF (3%)
                  </span>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                    Obligatorio para pagos en divisas físicas o cuentas extranjeras.
                  </span>
                </div>
                <div className={`theme-switcher-pill`} style={{
                  width: '36px',
                  height: '20px',
                  borderRadius: '10px',
                  backgroundColor: igtfApplied ? 'var(--brand-gold)' : 'var(--bg-input)',
                  position: 'relative',
                  transition: 'background-color 0.2s ease',
                }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    position: 'absolute',
                    top: '3px',
                    left: igtfApplied ? '19px' : '3px',
                    transition: 'left 0.2s ease',
                  }} />
                </div>
              </div>

              {/* Desglose Fiscal si IGTF está activo */}
              {igtfApplied && (
                <div className="animate-entrance" style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  fontSize: '11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Impuesto Base ({settings.ivaRate}% IVA):</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatUSD(ivaUSD)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Recargo IGTF (3%):</span>
                    <strong style={{ color: 'var(--brand-gold)' }}>{formatUSD(igtfUSD)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '2px', fontSize: '12px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total con Impuestos:</span>
                    <strong style={{ color: 'var(--brand-primary)' }}>{formatUSD(totalDueUSD)} / {formatVES(totalDueUSD)}</strong>
                  </div>
                </div>
              )}

              {/* Declarar Pagos Recibidos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Montos Recibidos del Cliente
                </label>

                {/* Dólares Efectivo */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1.2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--brand-primary)', width: '32px' }}>USD</span>
                  <input
                    type="text"
                    value={usdPaid}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setUsdPaid(val);
                      }
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                      textAlign: 'right',
                    }}
                    placeholder="0.00"
                  />
                </div>

                {/* Bolívares Pago Móvil/Punto */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1.2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--brand-gold)', width: '32px' }}>VES</span>
                  <input
                    type="text"
                    value={vesPaid}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setVesPaid(val);
                      }
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                      textAlign: 'right',
                    }}
                    placeholder="0.00"
                  />
                </div>

                {/* Euros Efectivo */}
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1.2px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#3b82f6', width: '32px' }}>EUR</span>
                  <input
                    type="text"
                    value={eurPaid}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                        setEurPaid(val);
                      }
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                      textAlign: 'right',
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Status de Balance y Vuelto */}
              <div style={{
                padding: '14px',
                borderRadius: '16px',
                backgroundColor: remainingUSD > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(14, 165, 164, 0.05)',
                border: `1.5px solid ${remainingUSD > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(14, 165, 164, 0.2)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
                textAlign: 'center',
              }}>
                {remainingUSD > 0 ? (
                  <>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#ef4444' }}>FALTA POR COBRAR</span>
                    <strong style={{ fontSize: '18px', color: '#ef4444' }}>
                      {formatUSD(remainingUSD)}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      o {formatVES(remainingUSD)}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--brand-primary)' }}>PAGO COMPLETADO</span>
                    <strong style={{ fontSize: '18px', color: 'var(--brand-primary)' }}>
                      {changeUSD > 0 ? formatUSD(changeUSD) : '$ 0.00'}
                    </strong>
                    {changeUSD > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Vuelto sugerido en Bolívares: <strong>{formatVES(changeUSD)}</strong>
                        </span>

                        {/* Selector moneda vuelto */}
                        <div style={{
                          display: 'flex',
                          backgroundColor: 'var(--bg-primary)',
                          padding: '3px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          alignSelf: 'center',
                          width: '180px',
                        }}>
                          <button
                            onClick={() => setChangeCurrency('VES')}
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: changeCurrency === 'VES' ? 'var(--bg-card)' : 'transparent',
                              color: changeCurrency === 'VES' ? 'var(--brand-gold)' : 'var(--text-secondary)',
                              fontWeight: 700,
                              fontSize: '10px',
                              cursor: 'pointer',
                            }}
                          >
                            Vuelto VES
                          </button>
                          <button
                            onClick={() => setChangeCurrency('USD')}
                            style={{
                              flex: 1,
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: changeCurrency === 'USD' ? 'var(--bg-card)' : 'transparent',
                              color: changeCurrency === 'USD' ? 'var(--brand-primary)' : 'var(--text-secondary)',
                              fontWeight: 700,
                              fontSize: '10px',
                              cursor: 'pointer',
                            }}
                          >
                            Vuelto USD
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Buttons */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1.5px solid var(--border-color)',
          display: 'flex',
          gap: '10px',
          backgroundColor: 'var(--bg-input)',
          ...(isMobile ? { position: 'fixed' as const, bottom: 0, left: 0, right: 0, zIndex: 10 } : {}),
        }}>
          <button
            onClick={onClose}
            className="btn-pill-dark"
            style={{ flex: 1, padding: '10px 0', fontSize: '12px', justifyContent: 'center', borderRadius: 'var(--button-radius)' }}
          >
            CANCELAR
          </button>
          <button
            onClick={onConfirmCheckout}
            disabled={isCredit ? !isCreditApproved : remainingUSD > 0}
            className="btn-yellow"
            style={{
              flex: 1,
              padding: '10px 0',
              fontSize: '12px',
              justifyContent: 'center',
              borderRadius: 'var(--button-radius)',
              opacity: (isCredit ? !isCreditApproved : remainingUSD > 0) ? 0.5 : 1,
              cursor: (isCredit ? !isCreditApproved : remainingUSD > 0) ? 'not-allowed' : 'pointer',
            }}
          >
            <span>PROCESAR FACTURA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
