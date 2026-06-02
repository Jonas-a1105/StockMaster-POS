import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface BusinessSettings {
  ivaRate: number; // standard: 16%
  igtfRate: number; // standard: 3%
  paperWidth: '80mm' | '58mm';
  businessName: string;
  businessAddress: string;
  businessRIF: string;
  isPOSLocked: boolean; // blocks sales when cash register is closed
  lastClosingTime: string | null;
}

interface BusinessSettingsContextValue {
  settings: BusinessSettings;
  updateSettings: (newSettings: Partial<BusinessSettings>) => void;
  validateRIF: (rif: string) => boolean;
  formatRIF: (rif: string) => string;
}

const BusinessSettingsContext = createContext<BusinessSettingsContextValue | null>(null);

const STORAGE_KEY = 'stockmaster_business_settings';

const DEFAULT_SETTINGS: BusinessSettings = {
  ivaRate: 16,
  igtfRate: 3,
  paperWidth: '80mm',
  businessName: 'Distribuidora StockMaster C.A.',
  businessAddress: 'Av. Francisco de Miranda, Edif. Torre Centro, Piso 5, Chacao, Caracas',
  businessRIF: 'J-40812991-0',
  isPOSLocked: false,
  lastClosingTime: null
};

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BusinessSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const updateSettings = useCallback((newSettings: Partial<BusinessSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Validation logic for Venezuelan RIF
  // Format: J-12345678-9, V-12345678-9, G-12345678-9, E-12345678-9
  const validateRIF = useCallback((rif: string): boolean => {
    const cleanRif = rif.toUpperCase().replace(/[^JVEG0-9]/g, '');
    if (cleanRif.length < 9 || cleanRif.length > 10) return false;
    
    const typeChar = cleanRif[0];
    if (!['V', 'J', 'E', 'G'].includes(typeChar)) return false;

    // Check digit algorithm for Venezuelan RIF
    const weights = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    const typeValues: Record<string, number> = { V: 1, E: 2, J: 3, G: 4 };
    
    let sum = typeValues[typeChar] * weights[0];
    
    // Remaining digits
    const digitsStr = cleanRif.slice(1);
    // If it's 9 characters total (J123456789), weights shift
    // Usually RIF is J-12345678-9 (1 letter + 8 digits + 1 check digit)
    // If it's only J12345678 (8 digits), we left-pad or format
    const bodyStr = digitsStr.slice(0, -1).padStart(8, '0');
    const checkDigit = parseInt(digitsStr.slice(-1), 10);

    for (let i = 0; i < 8; i++) {
      sum += parseInt(bodyStr[i], 10) * weights[i + 1];
    }

    const remainder = sum % 11;
    let computedCheck = 11 - remainder;
    if (computedCheck >= 10) computedCheck = 0;

    return computedCheck === checkDigit;
  }, []);

  // Formats input automatically to X-12345678-9
  const formatRIF = useCallback((rif: string): string => {
    let clean = rif.toUpperCase().replace(/[^JVEG0-9]/g, '');
    if (clean.length === 0) return '';
    
    const type = ['J', 'V', 'E', 'G'].includes(clean[0]) ? clean[0] : 'V';
    let nums = clean.replace(/[^0-9]/g, '');
    
    if (nums.length > 9) nums = nums.slice(0, 9);
    
    if (nums.length <= 8) {
      // e.g. V-12345678
      if (nums.length > 0) {
        return `${type}-${nums}`;
      }
      return type;
    } else {
      // e.g. V-12345678-9
      return `${type}-${nums.slice(0, 8)}-${nums.slice(8)}`;
    }
  }, []);

  return (
    <BusinessSettingsContext.Provider value={{
      settings,
      updateSettings,
      validateRIF,
      formatRIF
    }}>
      {children}
    </BusinessSettingsContext.Provider>
  );
}

export function useBusinessSettings() {
  const ctx = useContext(BusinessSettingsContext);
  if (!ctx) throw new Error('useBusinessSettings must be used inside BusinessSettingsProvider');
  return ctx;
}
