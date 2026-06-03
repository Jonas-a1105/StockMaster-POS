import { useState, useEffect } from 'react';
import { X, Delete, Calculator, Info, Coins } from 'lucide-react';
import { useExchangeRate } from '../contexts/ExchangeRateContext';

interface RateCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RateCalculatorModal({ isOpen, onClose }: RateCalculatorModalProps) {
  const { dolarRate, isManual, updateRate, resetToLiveRate } = useExchangeRate();
  const eurRate = dolarRate * 1.085; // Standard market cross-rate approx

  const [isComplexView, setIsComplexView] = useState<boolean>(false);
  const [activeCurrency, setActiveCurrency] = useState<'USD' | 'VES' | 'EUR'>('USD');
  
  // Input raw values (as strings to allow partial typing like decimals)
  const [usdVal, setUsdVal] = useState<string>('0');
  const [vesVal, setVesVal] = useState<string>('0');
  const [eurVal, setEurVal] = useState<string>('0');

  // Math expression state for complex calculator mode
  const [expression, setExpression] = useState<string>('');
  const [evaluatedResult, setEvaluatedResult] = useState<number | null>(null);

  const [editingRate, setEditingRate] = useState<string>('');

  useEffect(() => {
    setEditingRate(dolarRate.toString());
  }, [dolarRate]);

  const handleSaveRate = () => {
    const val = parseFloat(editingRate);
    if (!isNaN(val) && val > 0) {
      updateRate(val);
    }
  };

  // Sync inputs helper when one currency changes
  const updateAllCurrencies = (value: number, source: 'USD' | 'VES' | 'EUR') => {
    if (source === 'USD') {
      setUsdVal(value === 0 ? '' : value.toString());
      setVesVal(value === 0 ? '' : (value * dolarRate).toFixed(2));
      setEurVal(value === 0 ? '' : (value / 1.085).toFixed(2));
    } else if (source === 'VES') {
      setVesVal(value === 0 ? '' : value.toString());
      const usd = value / dolarRate;
      setUsdVal(value === 0 ? '' : usd.toFixed(2));
      setEurVal(value === 0 ? '' : (usd / 1.085).toFixed(2));
    } else if (source === 'EUR') {
      setEurVal(value === 0 ? '' : value.toString());
      const usd = value * 1.085;
      setUsdVal(value === 0 ? '' : usd.toFixed(2));
      setVesVal(value === 0 ? '' : (usd * dolarRate).toFixed(2));
    }
  };

  // Safe arithmetic evaluator
  const evaluateExpression = (expr: string): number => {
    // Only allow numbers, decimals, and basic math operators
    const sanitized = expr.replace(/[^0-9+\-*/.]/g, '');
    if (!sanitized) return 0;
    try {
      // eslint-disable-next-line no-new-func
      const res = new Function(`return ${sanitized}`)();
      return typeof res === 'number' && isFinite(res) ? res : 0;
    } catch {
      return 0;
    }
  };

  // Handle standard keystrokes in simple view
  const handleInputChange = (val: string, currency: 'USD' | 'VES' | 'EUR') => {
    // Allow empty value, decimal points, and numbers
    if (val === '') {
      if (currency === 'USD') setUsdVal('');
      else if (currency === 'VES') setVesVal('');
      else if (currency === 'EUR') setEurVal('');
      return;
    }

    // Clean leading zeros except when typing decimal
    let cleaned = val;
    if (cleaned.length > 1 && cleaned.startsWith('0') && cleaned[1] !== '.') {
      cleaned = cleaned.substring(1);
    }

    if (currency === 'USD') {
      setUsdVal(cleaned);
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) updateAllCurrencies(parsed, 'USD');
    } else if (currency === 'VES') {
      setVesVal(cleaned);
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) updateAllCurrencies(parsed, 'VES');
    } else if (currency === 'EUR') {
      setEurVal(cleaned);
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) updateAllCurrencies(parsed, 'EUR');
    }
  };

  // Live preview expression evaluator as user types
  useEffect(() => {
    if (isComplexView && expression) {
      const parsed = evaluateExpression(expression);
      setEvaluatedResult(parsed);
    } else {
      setEvaluatedResult(null);
    }
  }, [expression, isComplexView]);

  // Handle calculator button presses in complex view
  const handleKeypadPress = (key: string) => {
    if (key === 'C') {
      setExpression('');
      setEvaluatedResult(null);
      updateAllCurrencies(0, activeCurrency);
    } else if (key === '=') {
      if (expression) {
        const finalResult = evaluateExpression(expression);
        updateAllCurrencies(finalResult, activeCurrency);
        setExpression(finalResult.toFixed(2));
        setEvaluatedResult(null);
      }
    } else if (key === 'del') {
      setExpression(prev => prev.slice(0, -1));
    } else {
      // Append operators/numbers
      setExpression(prev => {
        // Prevent consecutive operators
        const lastChar = prev.slice(-1);
        const operators = ['+', '-', '*', '/'];
        if (operators.includes(key) && operators.includes(lastChar)) {
          return prev.slice(0, -1) + key;
        }
        return prev + key;
      });
    }
  };

  // Sync expression when active input focused or changed
  const selectActiveCurrency = (currency: 'USD' | 'VES' | 'EUR') => {
    setActiveCurrency(currency);
    const currentVal = currency === 'USD' ? usdVal : currency === 'VES' ? vesVal : eurVal;
    // Set expression to current value to allow operating on it directly
    const num = parseFloat(currentVal) || 0;
    setExpression(num > 0 ? num.toString() : '');
    setEvaluatedResult(null);
  };

  // Close on Escape press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Preset equivalences table
  const presetsUSD = [1, 5, 10, 20, 50, 100, 200, 500];

  return (
    <div className="modal-backdrop active" style={{ zIndex: 1400 }} onClick={onClose}>
      <div 
        className="calculator-modal-body" 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--card-radius)',
          boxShadow: 'var(--card-shadow)',
          border: '1.5px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.01)',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calculator size={18} style={{ color: 'var(--brand-primary)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
              Calculadora Multidivisa BCV
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="theme-toggle-btn"
            style={{ width: '32px', height: '32px', borderRadius: '50%' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          
          {/* Rate Banner */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '16px',
            border: isManual ? '1.5px solid rgba(168, 85, 247, 0.25)' : '1.5px solid rgba(251, 191, 36, 0.2)',
            backgroundColor: isManual ? 'rgba(168, 85, 247, 0.05)' : 'rgba(251, 191, 36, 0.05)',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Coins size={14} style={{ color: isManual ? '#a855f7' : 'var(--brand-gold)' }} />
                {isManual ? 'Tasa Manual Personalizada:' : 'Tasa BCV Oficial:'}
              </span>
              <strong style={{ color: isManual ? '#a855f7' : 'var(--brand-gold)', fontSize: '13px' }}>Bs. {dolarRate.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: isManual ? '1px solid rgba(168, 85, 247, 0.1)' : '1px solid rgba(251, 191, 36, 0.1)', paddingTop: '4px', marginTop: '2px' }}>
              <span style={{ fontWeight: 500, opacity: 0.85 }}>Referencia EUR:</span>
              <span style={{ fontWeight: 700, opacity: 0.9 }}>Bs. {eurRate.toFixed(2)} <span style={{ fontSize: '10px', opacity: 0.7 }}>(1.085 USD)</span></span>
            </div>
          </div>

          {/* Ajuste Manual de Tasa de Cambio */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '16px',
            border: '1.2px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                Ajustar Tasa de Cambio
              </span>
              {isManual && (
                <button
                  type="button"
                  onClick={resetToLiveRate}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'rgba(14, 165, 164, 0.12)',
                    color: 'var(--brand-teal)',
                    fontSize: '10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="Restablecer la tasa oficial BCV obtenida automáticamente por internet"
                >
                  Restablecer BCV
                </button>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>Bs.</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={editingRate}
                  onChange={(e) => setEditingRate(e.target.value)}
                  placeholder={dolarRate.toFixed(2)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '10px',
                    border: '1.2px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 700,
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  className="glass-input"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveRate}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--brand-teal)',
                  color: '#060608',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                className="login-btn-gradient"
              >
                Guardar
              </button>
            </div>
          </div>

          {/* Toggle View Mode */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-primary)',
            padding: '4px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <button
              onClick={() => setIsComplexView(false)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: !isComplexView ? 'var(--bg-card)' : 'transparent',
                color: !isComplexView ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontWeight: !isComplexView ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: !isComplexView ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Conversor Simple
            </button>
            <button
              onClick={() => setIsComplexView(true)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isComplexView ? 'var(--bg-card)' : 'transparent',
                color: isComplexView ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontWeight: isComplexView ? 700 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: isComplexView ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              Teclado de Fórmulas
            </button>
          </div>

          {/* Input Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* USD Input */}
            <div 
              style={{
                padding: '10px 12px',
                borderRadius: '14px',
                backgroundColor: activeCurrency === 'USD' && isComplexView ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                border: `1.5px solid ${activeCurrency === 'USD' && isComplexView ? 'var(--brand-primary)' : 'var(--border-color)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onClick={() => selectActiveCurrency('USD')}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '0.5px' }}>DÓLARES (USD)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)' }}>$</span>
                  <input
                    type="text"
                    pattern="[0-9]*\.?[0-9]*"
                    value={activeCurrency === 'USD' && isComplexView && expression !== '' ? expression : usdVal}
                    onChange={(e) => handleInputChange(e.target.value, 'USD')}
                    readOnly={isComplexView}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '16px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                      padding: 0
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              {evaluatedResult !== null && activeCurrency === 'USD' && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  = ${(evaluatedResult).toFixed(2)}
                </div>
              )}
            </div>

            {/* VES Input */}
            <div 
              style={{
                padding: '10px 12px',
                borderRadius: '14px',
                backgroundColor: activeCurrency === 'VES' && isComplexView ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                border: `1.5px solid ${activeCurrency === 'VES' && isComplexView ? 'var(--brand-primary)' : 'var(--border-color)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onClick={() => selectActiveCurrency('VES')}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--brand-gold)', letterSpacing: '0.5px' }}>BOLÍVARES (VES)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-secondary)' }}>Bs.</span>
                  <input
                    type="text"
                    pattern="[0-9]*\.?[0-9]*"
                    value={activeCurrency === 'VES' && isComplexView && expression !== '' ? expression : vesVal}
                    onChange={(e) => handleInputChange(e.target.value, 'VES')}
                    readOnly={isComplexView}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '16px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                      padding: 0
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              {evaluatedResult !== null && activeCurrency === 'VES' && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  = Bs. {(evaluatedResult).toFixed(2)}
                </div>
              )}
            </div>

            {/* EUR Input */}
            <div 
              style={{
                padding: '10px 12px',
                borderRadius: '14px',
                backgroundColor: activeCurrency === 'EUR' && isComplexView ? 'var(--brand-primary-light)' : 'var(--bg-primary)',
                border: `1.5px solid ${activeCurrency === 'EUR' && isComplexView ? 'var(--brand-primary)' : 'var(--border-color)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onClick={() => selectActiveCurrency('EUR')}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6', letterSpacing: '0.5px' }}>EUROS (EUR)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)' }}>€</span>
                  <input
                    type="text"
                    pattern="[0-9]*\.?[0-9]*"
                    value={activeCurrency === 'EUR' && isComplexView && expression !== '' ? expression : eurVal}
                    onChange={(e) => handleInputChange(e.target.value, 'EUR')}
                    readOnly={isComplexView}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '16px',
                      fontWeight: 700,
                      width: '100%',
                      outline: 'none',
                      padding: 0
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              {evaluatedResult !== null && activeCurrency === 'EUR' && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  = €{(evaluatedResult).toFixed(2)}
                </div>
              )}
            </div>

          </div>

          {/* Calculator Keypad - shown only in complex view */}
          {isComplexView && (
            <div 
              className="animate-entrance"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                padding: '10px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)'
              }}
            >
              {/* Row 1 */}
              <button onClick={() => handleKeypadPress('7')} className="calc-key">7</button>
              <button onClick={() => handleKeypadPress('8')} className="calc-key">8</button>
              <button onClick={() => handleKeypadPress('9')} className="calc-key">9</button>
              <button onClick={() => handleKeypadPress('/')} className="calc-key op">/</button>
              
              {/* Row 2 */}
              <button onClick={() => handleKeypadPress('4')} className="calc-key">4</button>
              <button onClick={() => handleKeypadPress('5')} className="calc-key">5</button>
              <button onClick={() => handleKeypadPress('6')} className="calc-key">6</button>
              <button onClick={() => handleKeypadPress('*')} className="calc-key op">*</button>
              
              {/* Row 3 */}
              <button onClick={() => handleKeypadPress('1')} className="calc-key">1</button>
              <button onClick={() => handleKeypadPress('2')} className="calc-key">2</button>
              <button onClick={() => handleKeypadPress('3')} className="calc-key">3</button>
              <button onClick={() => handleKeypadPress('-')} className="calc-key op">-</button>
              
              {/* Row 4 */}
              <button onClick={() => handleKeypadPress('0')} className="calc-key">0</button>
              <button onClick={() => handleKeypadPress('.')} className="calc-key">.</button>
              <button onClick={() => handleKeypadPress('del')} className="calc-key op" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Delete size={15} />
              </button>
              <button onClick={() => handleKeypadPress('+')} className="calc-key op">+</button>

              {/* Row 5 - Action buttons */}
              <button 
                onClick={() => handleKeypadPress('C')} 
                style={{
                  gridColumn: 'span 2',
                  height: '42px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
              >
                LIMPIAR
              </button>
              <button 
                onClick={() => handleKeypadPress('=')} 
                style={{
                  gridColumn: 'span 2',
                  height: '42px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--brand-primary)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(14, 165, 164, 0.25)',
                  transition: 'opacity 0.2s ease'
                }}
              >
                CALCULAR
              </button>
            </div>
          )}

          {/* Quick lookup Conversion Table */}
          <div style={{
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-primary)'
          }}>
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Info size={13} style={{ color: 'var(--brand-primary)' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
                Tabla de Equivalencia de Caja (USD-VES-EUR)
              </span>
            </div>
            
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Dólares</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Bolívares (BCV)</th>
                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Euros (Ref)</th>
                  </tr>
                </thead>
                <tbody>
                  {presetsUSD.map((usd) => (
                    <tr 
                      key={usd} 
                      onClick={() => updateAllCurrencies(usd, 'USD')}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>$ {usd.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--brand-gold)', fontWeight: 700 }}>Bs. {(usd * dolarRate).toFixed(2)}</td>
                      <td style={{ padding: '8px 12px' }}>€ {(usd / 1.085).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
