import { createContext, useReducer, useState, useEffect, type ReactNode } from 'react';
import type { TaxInput, TaxResult, FederalConfig } from '../../engine/types';
import type { TaxAction } from './actions';
import { taxReducer } from './reducer';
import { createDefaultTaxInput } from './defaults';
import { computeFullReturn } from '../../engine/index';
import { useLocalStorage } from '../hooks/useLocalStorage';
import federalConfigJson from '../../../config/federal-2025.json';

const federalConfig = federalConfigJson as unknown as FederalConfig;

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface TaxStateContextValue {
  input: TaxInput;
  result: TaxResult | null;
  isComputing: boolean;
  dispatch: React.Dispatch<TaxAction>;
  isLoading: boolean;
  lastSavedAt: Date | null;
  clearAll: () => Promise<void>;
}

export const TaxContext = createContext<TaxStateContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TaxProviderProps {
  children: ReactNode;
}

export function TaxProvider({ children }: TaxProviderProps) {
  const [input, dispatch] = useReducer(taxReducer, undefined, createDefaultTaxInput);
  const [result, setResult] = useState<TaxResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  // Auto-save/restore to IndexedDB
  const { isLoading, lastSavedAt, clearAll } = useLocalStorage(input, dispatch);

  // Debounced computation whenever input changes
  useEffect(() => {
    setIsComputing(true);

    const timer = setTimeout(() => {
      try {
        const computed = computeFullReturn(input, federalConfig);
        setResult(computed);
      } catch (err) {
        console.error('[OpenTax] Engine computation error:', err);
        // Don't crash — leave previous result or null
      } finally {
        setIsComputing(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [input]);

  const value: TaxStateContextValue = {
    input,
    result,
    isComputing,
    dispatch,
    isLoading,
    lastSavedAt,
    clearAll,
  };

  return <TaxContext value={value}>{children}</TaxContext>;
}
