import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ExchangeRateContextValue {
  dolarRate: number;
  isManual: boolean;
  isStale: boolean;
  lastUpdated: Date | null;
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
const TIMESTAMP_KEY = 'stockmaster_dolar_rate_updated_at';
const DEFAULT_RATE = 40.50; // Fallback rate in Bolivare Soberanos per USD

const FALLBACK_API = 'https://pydolarvenezuela-api.vercel.app/api/v1/dollar/unit/bcv';

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

  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem(TIMESTAMP_KEY);
      return saved ? new Date(saved) : null;
    } catch {
      return null;
    }
  });

  const isStale = lastUpdated ? (Date.now() - lastUpdated.getTime()) > 2 * 60 * 60 * 1000 : true;

  const saveRate = useCallback((rate: number) => {
    const now = new Date();
    setDolarRate(rate);
    setLastUpdated(now);
    localStorage.setItem(STORAGE_KEY, rate.toString());
    localStorage.setItem(TIMESTAMP_KEY, now.toISOString());
  }, []);

  const fetchLiveRate = useCallback(async () => {
    // Si la tasa está configurada en modo manual, no sobreescribir automáticamente
    const savedIsManual = localStorage.getItem(MANUAL_KEY) === 'true';
    if (savedIsManual) {
      console.log('🪙 Modo Tasa Manual activo. Omitiendo fetch automático de tasa BCV.');
      return;
    }

    const tryApi = async (url: string, parser: (data: any) => number | null): Promise<number | null> => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const data = await res.json();
        const rate = parser(data);
        return (typeof rate === 'number' && rate > 0) ? rate : null;
      } catch {
        return null;
      }
    };

    const apis: [string, (d: any) => number | null][] = [
      ['https://ve.dolarapi.com/v1/dolares/oficial', (d) => d.promedio || d.venta || d.compra],
      [FALLBACK_API, (d) => d?.price || d?.promedio || null],
    ];

    for (const [url, parser] of apis) {
      const rate = await tryApi(url, parser);
      if (rate !== null) {
        saveRate(rate);
        console.log(`🪙 Tasa BCV cargada desde ${url}: Bs. ${rate}`);
        return;
      }
    }

    console.warn('⚠️ No se pudo obtener la tasa BCV en vivo. Usando último valor guardado.');
  }, [saveRate]);

  useEffect(() => {
    if (navigator.onLine) {
      fetchLiveRate();
    }

    const handleOnline = () => fetchLiveRate();
    window.addEventListener('online', handleOnline);

    // Auto-refresh rate every 30 minutes (only when online)
    let interval: ReturnType<typeof setInterval> | null = null;
    const startInterval = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        if (navigator.onLine) fetchLiveRate();
      }, 30 * 60 * 1000);
    };
    const handleOffline = () => { if (interval) clearInterval(interval); interval = null; };
    const handleBackOnline = () => startInterval();

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleBackOnline);

    if (navigator.onLine) startInterval();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleBackOnline);
      if (interval) clearInterval(interval);
    };
  }, [fetchLiveRate]);

  const updateRate = useCallback((newRate: number) => {
    if (newRate > 0) {
      saveRate(newRate);
      setIsManual(true);
      localStorage.setItem(MANUAL_KEY, 'true');
    }
  }, [saveRate]);

  const resetToLiveRate = useCallback(async () => {
    setIsManual(false);
    localStorage.setItem(MANUAL_KEY, 'false');
    await fetchLiveRate();
  }, [fetchLiveRate]);

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
      isStale,
      lastUpdated,
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

