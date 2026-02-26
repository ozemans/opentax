import { useEffect, useState, useRef, useCallback } from 'react';
import type { TaxInput } from '../../engine/types';
import type { TaxAction } from '../state/actions';
import { getDB } from './db';
import { migrateIfNeeded, CURRENT_SCHEMA_VERSION } from './migrations';

const CURRENT_KEY = 'current';
const SAVE_DEBOUNCE_MS = 1_500;

interface UseLocalStorageReturn {
  isLoading: boolean;
  lastSavedAt: Date | null;
  clearAll: () => Promise<void>;
}

/**
 * Auto-save and restore TaxInput to/from IndexedDB.
 *
 * On mount: loads the 'current' record and dispatches LOAD_INPUT.
 * On input change: debounces 1500ms, then saves to IndexedDB.
 */
export function useLocalStorage(
  input: TaxInput,
  dispatch: React.Dispatch<TaxAction>,
): UseLocalStorageReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const isInitialized = useRef(false);

  // --- Restore on mount ---
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const db = await getDB();
        const record = await db.get('returns', CURRENT_KEY);

        if (record && !cancelled) {
          const migrated = migrateIfNeeded(record.input, record.version);
          dispatch({ type: 'LOAD_INPUT', payload: migrated });
          setLastSavedAt(record.updatedAt);
        }
      } catch (err) {
        console.error('[OpenTax] Failed to restore from IndexedDB:', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          isInitialized.current = true;
        }
      }
    }

    restore();
    return () => { cancelled = true; };
  }, [dispatch]);

  // --- Auto-save on input change (debounced) ---
  useEffect(() => {
    // Don't save until initial load is complete
    if (!isInitialized.current) return;

    const timer = setTimeout(async () => {
      try {
        const db = await getDB();
        const now = new Date();
        await db.put('returns', {
          id: CURRENT_KEY,
          label: `${input.taxYear} Tax Return`,
          input,
          updatedAt: now,
          version: CURRENT_SCHEMA_VERSION,
        });
        setLastSavedAt(now);
      } catch (err) {
        console.error('[OpenTax] Failed to save to IndexedDB:', err);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [input]);

  // --- Clear all data ---
  const clearAll = useCallback(async () => {
    try {
      const db = await getDB();
      await db.clear('returns');
      setLastSavedAt(null);
      dispatch({ type: 'RESET' });
    } catch (err) {
      console.error('[OpenTax] Failed to clear IndexedDB:', err);
    }
  }, [dispatch]);

  return { isLoading, lastSavedAt, clearAll };
}
