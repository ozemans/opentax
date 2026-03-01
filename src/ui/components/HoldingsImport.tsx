import { useState, useRef, useCallback } from 'react';
import type { TaxLot } from '@/engine/types';
import { parseHoldingsCSV } from '@/utils/holdings-parser';

interface HoldingsImportProps {
  lots: TaxLot[];
  onBulkImport: (lots: TaxLot[]) => void;
  onRemove: (index: number) => void;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShares(qty: number): string {
  return qty % 1 === 0
    ? qty.toLocaleString('en-US')
    : qty.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 6 });
}

export function HoldingsImport({ lots, onBulkImport, onRemove }: HoldingsImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<TaxLot[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setParseError('');
    setWarnings([]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseHoldingsCSV(text);
      if (result.lots.length === 0) {
        setParseError(
          'Could not parse any holdings from this file. Make sure it is a brokerage holdings CSV (Fidelity, Schwab, or Vanguard) with symbol and quantity columns.',
        );
        return;
      }
      if (result.warnings.length > 0) setWarnings(result.warnings);
      setPreview(result.lots);
    };
    reader.onerror = () => setParseError('Error reading file.');
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleConfirmImport = useCallback(() => {
    if (!preview) return;
    onBulkImport(preview);
    setPreview(null);
  }, [preview, onBulkImport]);

  const handleCancel = () => {
    setPreview(null);
    setParseError('');
    setWarnings([]);
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center
            transition-colors duration-200
            ${isDragging
              ? 'border-primary bg-primary/5'
              : 'border-slate-light hover:border-highlight hover:bg-highlight-light/30'}
          `}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          aria-label="Import holdings CSV"
        >
          <svg
            className="mx-auto h-10 w-10 text-slate-light"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="mt-3 text-sm font-display font-medium text-slate-dark">
            Drop holdings CSV here or click to browse
          </p>
          <p className="mt-1 text-xs font-body text-slate">
            Fidelity, Schwab, and Vanguard position exports supported
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      )}

      {parseError && (
        <p role="alert" className="text-sm font-body text-error">{parseError}</p>
      )}

      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs font-body text-amber-700">⚠ {w}</li>
          ))}
        </ul>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-semibold text-slate-dark">
              Preview — {preview.length} lot{preview.length !== 1 ? 's' : ''}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-slate-light px-3 py-1.5 text-xs font-body font-medium text-slate hover:border-slate hover:text-slate-dark transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="rounded-lg bg-highlight px-3 py-1.5 text-xs font-body font-medium text-white hover:bg-highlight-dark transition-colors"
              >
                Import {preview.length} lot{preview.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-light/30">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-surface text-left">
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Symbol</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Description</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Shares</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Acquired</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Cost/Share</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Total Basis</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Term</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-light/20">
                {preview.map((lot, i) => (
                  <tr key={i} className="hover:bg-surface/50 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-dark">{lot.symbol}</td>
                    <td className="px-3 py-2 text-slate max-w-[180px] truncate">{lot.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-dark">
                      {formatShares(lot.quantity)}
                    </td>
                    <td className="px-3 py-2 text-slate">{lot.dateAcquired}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-dark">
                      {formatCents(lot.unitCostBasis)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-dark">
                      {formatCents(lot.totalCostBasis)}
                    </td>
                    <td className="px-3 py-2">
                      {lot.isLongTerm === null ? (
                        <span className="text-slate text-xs">—</span>
                      ) : lot.isLongTerm ? (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">LT</span>
                      ) : (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">ST</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existing lots */}
      {lots.length > 0 && !preview && (
        <div className="space-y-3">
          <h3 className="text-sm font-display font-semibold text-slate-dark">
            Holdings ({lots.length} lot{lots.length !== 1 ? 's' : ''})
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-light/30">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-surface text-left">
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Symbol</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Description</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Shares</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Acquired</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Cost/Share</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Total Basis</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Term</th>
                  <th className="px-3 py-2 w-8" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-light/20">
                {lots.map((lot, i) => (
                  <tr key={lot.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-dark">{lot.symbol}</td>
                    <td className="px-3 py-2 text-slate max-w-[180px] truncate">{lot.description}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-dark">
                      {formatShares(lot.quantity)}
                    </td>
                    <td className="px-3 py-2 text-slate">{lot.dateAcquired}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-dark">
                      {formatCents(lot.unitCostBasis)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-dark">
                      {formatCents(lot.totalCostBasis)}
                    </td>
                    <td className="px-3 py-2">
                      {lot.isLongTerm === null ? (
                        <span className="text-slate text-xs">—</span>
                      ) : lot.isLongTerm ? (
                        <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">LT</span>
                      ) : (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">ST</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onRemove(i)}
                        className="text-slate hover:text-error transition-colors"
                        aria-label={`Remove ${lot.symbol} lot`}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
