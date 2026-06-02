import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ExchangeRateContextValue {
  dolarRate: number;
  updateRate: (newRate: number) => void;
  convertToVES: (usdAmount: number) => number;
  formatVES: (usdAmount: number) => string;
  formatUSD: (usdAmount: number) => string;
  formatDual: (usdAmount: number) => string;
}

const ExchangeRateContext = createContext<ExchangeRateContextValue | null>(null);

const STORAGE_KEY = 'stockmaster_dolar_rate';
const DEFAULT_RATE = 40.50; // Fallback rate in Bolivare Soberanos per USD

export function ExchangeRateProvider({ children }: { children: ReactNode }) {
  const [dolarRate, setDolarRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? parseFloat(saved) : DEFAULT_RATE;
    } catch {
      return DEFAULT_RATE;
    }
  });

  const fetchLiveRate = async () => {
    try {
      // Free public API for BCV Official exchange rate in Venezuela
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (res.ok) {
        const data = await res.json();
        const rate = data.promedio || data.venta || data.compra;
        if (typeof rate === 'number' && rate > 0) {
          setDolarRate(rate);
          localStorage.setItem(STORAGE_KEY, rate.toString());
          console.log(`🪙 Tasa de Cambio BCV Oficial cargada en vivo: Bs. ${rate}`);
        }
      }
    } catch (err) {
      console.warn('⚠️ No se pudo obtener la tasa BCV en vivo (Modo Offline o API no disponible). Usando fallback local:', dolarRate);
    }
  };

  useEffect(() => {
    if (navigator.onLine) {
      fetchLiveRate();
    }
    // Auto-refresh rate every 30 minutes
    const interval = setInterval(() => {
      if (navigator.onLine) fetchLiveRate();
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const updateRate = useCallback((newRate: number) => {
    if (newRate > 0) {
      setDolarRate(newRate);
      localStorage.setItem(STORAGE_KEY, newRate.toString());
    }
  }, []);

  const convertToVES = useCallback((usdAmount: number) => {
    return usdAmount * dolarRate;
  }, [dolarRate]);

  const formatVES = useCallback((usdAmount: number) => {
    const ves = convertToVES(usdAmount);
    return `Bs. ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [convertToVES]);

  const formatUSD = useCallback((usdAmount: number) => {
    return `$ ${usdAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  const formatDual = useCallback((usdAmount: number) => {
    return `${formatUSD(usdAmount)} / ${formatVES(usdAmount)}`;
  }, [formatUSD, formatVES]);

  return (
    <ExchangeRateContext.Provider value={{
      dolarRate,
      updateRate,
      convertToVES,
      formatVES,
      formatUSD,
      formatDual
    }}>
      {children}
    </ExchangeRateContext.Provider>
  );
}

export function useExchangeRate() {
  const ctx = useContext(ExchangeRateContext);
  if (!ctx) throw new Error('useExchangeRate must be used inside ExchangeRateProvider');
  return ctx;
}
