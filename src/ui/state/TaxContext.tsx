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
  computeError: string | null;
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
  const [computeError, setComputeError] = useState<string | null>(null);

  // Auto-save/restore to IndexedDB
  const { isLoading, lastSavedAt, clearAll } = useLocalStorage(input, dispatch);

  // Debounced computation whenever input changes
  useEffect(() => {
    setIsComputing(true);
    setComputeError(null);

    const timer = setTimeout(() => {
      try {
        const computed = computeFullReturn(input, federalConfig);
        setResult(computed);
      } catch (err) {
        console.error('[OpenTax] Engine computation error:', err);
        setResult(null);
        setComputeError(
          err instanceof Error ? err.message : 'Tax computation failed',
        );
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
    computeError,
    dispatch,
    isLoading,
    lastSavedAt,
    clearAll,
  };

  return <TaxContext value={value}>{children}</TaxContext>;
}
