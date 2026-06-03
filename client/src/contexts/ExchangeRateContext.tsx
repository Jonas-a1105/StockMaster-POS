import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ExchangeRateContextValue {
  dolarRate: number;
  isManual: boolean;
  updateRate: (newRate: number) => void;
  resetToLiveRate: () => Promise<void>;
  convertToVES: (usdAmount: number) => number;
  formatVES: (usdAmount: number) => string;
  formatUSD: (usdAmount: number) => string;
  formatDual: (usdAmount: number) => string;
  fetchLiveRate: () => Promise<void>;
}

const ExchangeRateContext = createContext<ExchangeRateContextValue | null>(null);

const STORAGE_KEY = 'stockmaster_dolar_rate';
const MANUAL_KEY = 'stockmaster_dolar_rate_is_manual';
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

  const [isManual, setIsManual] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MANUAL_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const fetchLiveRate = useCallback(async () => {
    // Si la tasa está configurada en modo manual, no sobreescribir automáticamente
    const savedIsManual = localStorage.getItem(MANUAL_KEY) === 'true';
    if (savedIsManual) {
      console.log('🪙 Modo Tasa Manual activo. Omitiendo fetch automático de tasa BCV.');
      return;
    }

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
  }, [dolarRate]);

  useEffect(() => {
    if (navigator.onLine) {
      fetchLiveRate();
    }
    // Auto-refresh rate every 30 minutes
    const interval = setInterval(() => {
      if (navigator.onLine) fetchLiveRate();
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchLiveRate]);

  const updateRate = useCallback((newRate: number) => {
    if (newRate > 0) {
      setDolarRate(newRate);
      localStorage.setItem(STORAGE_KEY, newRate.toString());
      setIsManual(true);
      localStorage.setItem(MANUAL_KEY, 'true');
    }
  }, []);

  const resetToLiveRate = useCallback(async () => {
    setIsManual(false);
    localStorage.setItem(MANUAL_KEY, 'false');
    // Forzamos la obtención en vivo pasando por alto el check manual
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (res.ok) {
        const data = await res.json();
        const rate = data.promedio || data.venta || data.compra;
        if (typeof rate === 'number' && rate > 0) {
          setDolarRate(rate);
          localStorage.setItem(STORAGE_KEY, rate.toString());
          console.log(`🪙 Tasa restablecida a BCV Oficial: Bs. ${rate}`);
        }
      }
    } catch (err) {
      console.warn('⚠️ Error al restablecer tasa oficial. Permaneciendo en el último valor.');
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
      isManual,
      updateRate,
      resetToLiveRate,
      convertToVES,
      formatVES,
      formatUSD,
      formatDual,
      fetchLiveRate
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

