import { useState, useCallback } from 'react';
import type { TaxInput } from '../../engine/types';
import type { TaxAction } from '../state/actions';
import { encryptTaxInput, decryptTaxInput, EncryptedFileError } from '../../utils/crypto';

interface UseEncryptedExportReturn {
  exportReturn: (password: string) => Promise<void>;
  importReturn: (file: File, password: string) => Promise<void>;
  isExporting: boolean;
  isImporting: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for encrypting and exporting / importing .opentax files.
 */
export function useEncryptedExport(
  input: TaxInput,
  dispatch: React.Dispatch<TaxAction>,
): UseEncryptedExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Encrypt the current TaxInput and trigger a browser file download.
   */
  const exportReturn = useCallback(
    async (password: string) => {
      setError(null);
      setIsExporting(true);

      try {
        const encrypted = await encryptTaxInput(input, password);
        const blob = new Blob([encrypted.buffer], { type: 'application/octet-stream' });

        const filename = `opentax-${input.taxYear}-return.opentax`;
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export';
        setError(message);
      } finally {
        setIsExporting(false);
      }
    },
    [input],
  );

  /**
   * Read a .opentax file, decrypt it, and load the data.
   */
  const importReturn = useCallback(
    async (file: File, password: string) => {
      setError(null);
      setIsImporting(true);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const taxInput = await decryptTaxInput(data, password);
        dispatch({ type: 'LOAD_INPUT', payload: taxInput });
      } catch (err) {
        if (err instanceof EncryptedFileError) {
          setError(err.message);
        } else {
          const message = err instanceof Error ? err.message : 'Failed to import';
          setError(message);
        }
      } finally {
        setIsImporting(false);
      }
    },
    [dispatch],
  );

  return {
    exportReturn,
    importReturn,
    isExporting,
    isImporting,
    error,
    clearError,
  };
}
