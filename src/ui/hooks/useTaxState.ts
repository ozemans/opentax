import { useContext } from 'react';
import { TaxContext } from '../state/TaxContext';

export function useTaxState() {
  const ctx = useContext(TaxContext);
  if (!ctx) {
    throw new Error('useTaxState must be used within TaxProvider');
  }
  return ctx;
}
