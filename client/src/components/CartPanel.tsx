import React from 'react';
import { ShoppingCart, Trash2, Clock, ChevronRight } from 'lucide-react';
import type { ProductDocType, ClientDocType } from '../db/database';
import { useExchangeRate } from '../contexts/ExchangeRateContext';
import { useBusinessSettings } from '../contexts/BusinessSettingsContext';
import CustomSelect from './CustomSelect';

const discountOptions = [
  { value: 'NONE', label: 'Ninguno' },
  { value: 'PERCENT', label: '%' },
  { value: 'FIXED', label: '$' }
];

const surchargeOptions = [
  { value: 'NONE', label: 'Ninguno' },
  { value: 'PERCENT', label: '%' },
  { value: 'FIXED', label: '$' }
];

interface CartItem {
  product: ProductDocType;
  quantity: number;
}

const formatQuantity = (name: string, quantity: number) => {
  const lowercaseName = name.toLowerCase();
  let unit = 'u.';
  if (lowercaseName.includes('kg') || lowercaseName.includes('kilo')) {
    unit = 'kg';
  } else if (lowercaseName.includes('gr') || lowercaseName.includes('gramo')) {
    unit = 'g';
  } else if (lowercaseName.includes('lt') || lowercaseName.includes('litro') || lowercaseName.includes('lts')) {
    unit = 'lt';
  } else if (lowercaseName.includes('ml')) {
    unit = 'ml';
  }
  
  const formattedQty = Number.isInteger(quantity) 
    ? String(quantity) 
    : quantity.toFixed(3).replace(/\.?0+$/, '');
    
  return `${formattedQty} ${unit}`;
};

interface CartPanelProps {
  cart: CartItem[];
  cartItemsCount: number;
  subtotalUSD: number;
  ivaUSD: number;
  totalUSD: number;
  paymentMethod: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CRÉDITO';
  setPaymentMethod: (method: 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'CRÉDITO') => void;
  selectedClient: ClientDocType | null;
  onUpdateQuantity: (productId: string, amount: number) => void;
  onSetQuantity: (productId: string, qty: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
  onOpenCheckout: () => void;
  onSuspendSale: () => void;
  onShowClientSelector: () => void;
  suspendedSalesCount: number;
  onToggleSuspendedPanel: () => void;
  discountType: 'NONE' | 'PERCENT' | 'FIXED';
  setDiscountType: (type: 'NONE' | 'PERCENT' | 'FIXED') => void;
  discountValue: number;
  setDiscountValue: (val: number) => void;
  surchargeType: 'NONE' | 'PERCENT' | 'FIXED';
  setSurchargeType: (type: 'NONE' | 'PERCENT' | 'FIXED') => void;
  surchargeValue: number;
  setSurchargeValue: (val: number) => void;
  discountUSD: number;
  surchargeUSD: number;
  netSubtotalUSD: number;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  cartItemsCount,
  subtotalUSD,
  ivaUSD,
  totalUSD,
  paymentMethod,
  setPaymentMethod,
  selectedClient,
  onUpdateQuantity,
  onSetQuantity,
  onRemoveFromCart,
  onClearCart,
  onOpenCheckout,
  onSuspendSale,
  onShowClientSelector,
  suspendedSalesCount,
  onToggleSuspendedPanel,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  surchargeType,
  setSurchargeType,
  surchargeValue,
  setSurchargeValue,
  discountUSD,
  surchargeUSD,
  netSubtotalUSD,
}) => {
  const { formatVES, formatUSD } = useExchangeRate();
  const { settings } = useBusinessSettings();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', overflow: 'hidden' }}>
      {/* Lista de Items */}
      <div style={{ flex: 1, overflowY: 'auto', margin: '12px 0', paddingRight: '4px' }}>
        {cart.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: '13px', minHeight: '200px' }}>
            <ShoppingCart size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px', opacity: 0.5 }} />
            <span>El carrito de compras está vacío.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {cart.map((item) => {
              const itemPrice = (selectedClient && selectedClient.clientType === 'Mayorista')
                ? (item.product.wholesalePrice || item.product.price)
                : item.product.price;
              return (
                <div
                  key={item.product.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border-color)',
                  }}
                >
                  <div style={{ flexGrow: 1, minWidth: 0, marginRight: '8px' }}>
                    <h5 style={{ fontWeight: 800, fontSize: '12.5px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', margin: 0 }}>
                      {item.product.name}
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--brand-primary)', fontWeight: 700 }}>
                        {formatUSD(itemPrice)} x {formatQuantity(item.product.name, item.quantity)} = {formatUSD(itemPrice * item.quantity)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, -1)}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        border: '1.5px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px'
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          onSetQuantity(item.product.id, val);
                        }
                      }}
                      step="any"
                      min="0.001"
                      style={{
                        width: '58px',
                        textAlign: 'center',
                        background: 'var(--bg-card)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontWeight: 800,
                        fontSize: '12px',
                        outline: 'none',
                        padding: '3px 0',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, 1)}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        border: '1.5px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px'
                      }}
                    >
                      +
                    </button>

                    <button
                      onClick={() => onRemoveFromCart(item.product.id)}
                      style={{ border: 'none', backgroundColor: 'transparent', color: '#ef4444', cursor: 'pointer', marginLeft: '2px', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Totales y Métodos de Pago */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Formulario de Descuento y Recargo */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backgroundColor: 'var(--bg-input)',
          padding: '12px',
          borderRadius: '14px',
          border: '1.5px solid var(--border-color)'
        }}>
          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Descuento / Recargo General
          </span>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Descuento select + input */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700 }}>Descuento</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <CustomSelect
                  value={discountType}
                  onChange={(val) => {
                    setDiscountType(val as any);
                    setDiscountValue(0);
                  }}
                  options={discountOptions}
                  style={{
                    flex: discountType === 'NONE' ? 1 : '0 0 85px',
                    minWidth: discountType === 'NONE' ? 'auto' : '85px'
                  }}
                />
                {discountType !== 'NONE' && (
                  <input
                    type="number"
                    min="0"
                    placeholder="Valor"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '11px',
                      height: '32px',
                      boxSizing: 'border-box'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Recargo select + input */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 700 }}>Recargo</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <CustomSelect
                  value={surchargeType}
                  onChange={(val) => {
                    setSurchargeType(val as any);
                    setSurchargeValue(0);
                  }}
                  options={surchargeOptions}
                  style={{
                    flex: surchargeType === 'NONE' ? 1 : '0 0 85px',
                    minWidth: surchargeType === 'NONE' ? 'auto' : '85px'
                  }}
                />
                {surchargeType !== 'NONE' && (
                  <input
                    type="number"
                    min="0"
                    placeholder="Valor"
                    value={surchargeValue || ''}
                    onChange={(e) => setSurchargeValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '11px',
                      height: '32px',
                      boxSizing: 'border-box'
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Desglose de Precios en Moneda Dual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Subtotal:</span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 700 }}>{formatUSD(subtotalUSD)}</span>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{formatVES(subtotalUSD)}</span>
            </div>
          </div>

          {discountUSD > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', marginTop: '4px' }}>
              <span>Descuento ({discountType === 'PERCENT' ? `${discountValue}%` : 'Fijo'}):</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontWeight: 700 }}>- {formatUSD(discountUSD)}</span>
                <span style={{ display: 'block', fontSize: '10px', color: 'rgba(239, 68, 68, 0.7)' }}>- {formatVES(discountUSD)}</span>
              </div>
            </div>
          )}

          {surchargeUSD > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--brand-gold)', marginTop: '4px' }}>
              <span>Recargo ({surchargeType === 'PERCENT' ? `${surchargeValue}%` : 'Fijo'}):</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontWeight: 700 }}>+ {formatUSD(surchargeUSD)}</span>
                <span style={{ display: 'block', fontSize: '10px', color: 'rgba(251, 191, 36, 0.7)' }}>+ {formatVES(surchargeUSD)}</span>
              </div>
            </div>
          )}

          {(discountUSD > 0 || surchargeUSD > 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
              <span>Base Imponible:</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{formatUSD(netSubtotalUSD)}</span>
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{formatVES(netSubtotalUSD)}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '4px' }}>
            <span>IVA ({settings.ivaRate}%):</span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontWeight: 700 }}>{formatUSD(ivaUSD)}</span>
              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>{formatVES(ivaUSD)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '14.5px', color: 'var(--text-primary)', borderTop: '1.5px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
            <span>Total a Pagar:</span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', color: 'var(--brand-primary)' }}>{formatUSD(totalUSD)}</span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--brand-gold)', fontFamily: 'monospace' }}>{formatVES(totalUSD)}</span>
            </div>
          </div>
        </div>

        {/* Selector de Métodos de Pago */}
        <div>
          <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Método de Pago
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
            {(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CRÉDITO'] as const).map((method) => {
              const isActive = paymentMethod === method;
              const isDisabled = method === 'CRÉDITO' && !selectedClient;
              return (
                <button
                  key={method}
                  disabled={isDisabled}
                  onClick={() => setPaymentMethod(method)}
                  style={{
                    padding: '8px 0',
                    borderRadius: '10px',
                    border: isActive ? '1.5px solid var(--brand-teal)' : '1.5px solid var(--border-color)',
                    backgroundColor: isActive ? 'rgba(14, 165, 164, 0.08)' : 'var(--bg-input)',
                    color: isActive ? 'var(--brand-teal)' : 'var(--text-secondary)',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1,
                    transition: 'all 0.2s ease',
                  }}
                  title={isDisabled ? 'Seleccione un cliente para habilitar crédito' : ''}
                >
                  {method}
                </button>
              );
            })}
          </div>
        </div>

        {/* Suspended Sales Badge */}
        {suspendedSalesCount > 0 && (
          <button
            className="suspended-sales-badge"
            onClick={onToggleSuspendedPanel}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Clock size={14} />
            <span>{suspendedSalesCount} venta(s) en espera</span>
            <span className="badge-count">{suspendedSalesCount}</span>
          </button>
        )}

        {/* Action Buttons Row */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Suspend Button */}
          <button
            onClick={onSuspendSale}
            disabled={cart.length === 0}
            className="btn-pill-dark"
            style={{
              flex: '0 0 auto',
              padding: '12px 14px',
              borderRadius: 'var(--button-radius)',
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              opacity: cart.length === 0 ? 0.5 : 1,
            }}
            title="Suspender venta actual"
          >
            <Clock size={16} />
          </button>

          {/* Clear Cart Button */}
          <button
            onClick={onClearCart}
            disabled={cart.length === 0}
            className="btn-pill-dark"
            style={{
              flex: '0 0 auto',
              padding: '12px 14px',
              borderRadius: 'var(--button-radius)',
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              opacity: cart.length === 0 ? 0.5 : 1,
              color: '#ef4444',
            }}
            title="Vaciar carrito"
          >
            <Trash2 size={16} />
          </button>

          {/* Proceed to Payment Button */}
          <button
            onClick={onOpenCheckout}
            disabled={cart.length === 0}
            className="btn-yellow"
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 'var(--button-radius)',
              fontWeight: 800,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              opacity: cart.length === 0 ? 0.5 : 1,
            }}
          >
            <span>Proceder al Cobro</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
