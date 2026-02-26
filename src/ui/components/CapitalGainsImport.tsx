import { useState, useRef, useCallback } from 'react';
import type { Form1099B } from '@/engine/types';

interface CapitalGainsImportProps {
  transactions: Form1099B[];
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<Form1099B>) => void;
  onRemove: (index: number) => void;
  onBulkImport: (transactions: Form1099B[]) => void;
}

interface ParsedRow {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  isLongTerm: boolean;
}

function formatCentsToDollars(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Basic CSV parser — handles the most common CSV formats from brokerages.
 * Expects headers: description, dateAcquired, dateSold, proceeds, costBasis
 * The csv-import utility from Agent 1 will replace this. TODO: Wire up csv-import utility.
 */
function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  const descIdx = headers.findIndex((h) => h.includes('description') || h.includes('security'));
  const acquiredIdx = headers.findIndex((h) => h.includes('acquired') || h.includes('purchase'));
  const soldIdx = headers.findIndex((h) => h.includes('sold') || h.includes('sale'));
  const proceedsIdx = headers.findIndex((h) => h.includes('proceeds') || h.includes('sales price'));
  const basisIdx = headers.findIndex((h) => h.includes('basis') || h.includes('cost'));

  if (proceedsIdx === -1 || basisIdx === -1) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
    if (cols.length < Math.max(proceedsIdx, basisIdx) + 1) continue;

    const proceedsDollars = parseFloat(cols[proceedsIdx].replace(/[$,]/g, ''));
    const basisDollars = parseFloat(cols[basisIdx].replace(/[$,]/g, ''));
    if (isNaN(proceedsDollars) || isNaN(basisDollars)) continue;

    const proceeds = Math.round(proceedsDollars * 100);
    const costBasis = Math.round(basisDollars * 100);
    const dateAcquired = acquiredIdx >= 0 ? cols[acquiredIdx] : '';
    const dateSold = soldIdx >= 0 ? cols[soldIdx] : '';

    // Determine if long-term from dates if available
    let isLongTerm = false;
    if (dateAcquired && dateSold && dateAcquired !== 'VARIOUS') {
      const acquired = new Date(dateAcquired);
      const sold = new Date(dateSold);
      const diff = sold.getTime() - acquired.getTime();
      isLongTerm = diff > 365.25 * 24 * 60 * 60 * 1000;
    }

    rows.push({
      description: descIdx >= 0 ? cols[descIdx] : `Transaction ${i}`,
      dateAcquired: dateAcquired || '',
      dateSold: dateSold || '',
      proceeds,
      costBasis,
      gainLoss: proceeds - costBasis,
      isLongTerm,
    });
  }

  return rows;
}

function parsedToForm1099B(row: ParsedRow): Form1099B {
  return {
    description: row.description,
    dateAcquired: row.dateAcquired,
    dateSold: row.dateSold,
    proceeds: row.proceeds,
    costBasis: row.costBasis,
    gainLoss: row.gainLoss,
    isLongTerm: row.isLongTerm,
    basisReportedToIRS: true,
    category: row.isLongTerm ? '8949_D' : '8949_A',
  };
}

export function CapitalGainsImport({
  transactions,
  onAdd,
  onUpdate: _onUpdate,
  onRemove,
  onBulkImport,
}: CapitalGainsImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setParseError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setParseError('Could not parse any transactions from this CSV. Expected columns: description, dateAcquired, dateSold, proceeds, costBasis.');
        return;
      }
      setPreview(parsed);
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
    [handleFile]
  );

  const handleConfirmImport = useCallback(() => {
    if (!preview) return;
    const forms = preview.map(parsedToForm1099B);
    onBulkImport(forms);
    setPreview(null);
  }, [preview, onBulkImport]);

  // Compute summaries
  const stGains = transactions.filter((t) => !t.isLongTerm && t.gainLoss > 0).reduce((s, t) => s + t.gainLoss, 0);
  const stLosses = transactions.filter((t) => !t.isLongTerm && t.gainLoss < 0).reduce((s, t) => s + t.gainLoss, 0);
  const ltGains = transactions.filter((t) => t.isLongTerm && t.gainLoss > 0).reduce((s, t) => s + t.gainLoss, 0);
  const ltLosses = transactions.filter((t) => t.isLongTerm && t.gainLoss < 0).reduce((s, t) => s + t.gainLoss, 0);
  const net = stGains + stLosses + ltGains + ltLosses;

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center
          transition-colors duration-200
          ${isDragging
            ? 'border-teal bg-teal/5'
            : 'border-slate-light hover:border-lavender hover:bg-lavender-light/30'}
        `}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        aria-label="Import CSV file with capital gains transactions"
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
          Drop CSV here or click to browse
        </p>
        <p className="mt-1 text-xs font-body text-slate">
          Supports CSV exports from most brokerages
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {parseError && (
        <p role="alert" className="text-sm font-body text-error">{parseError}</p>
      )}

      {/* Preview table */}
      {preview && (
        <div className="space-y-3">
          <h3 className="text-sm font-display font-semibold text-slate-dark">
            Preview ({preview.length} transactions)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-slate-light/30">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-surface text-left">
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Description</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Acquired</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Sold</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Proceeds</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Basis</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Gain/Loss</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Term</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-slate-light/20">
                    <td className="px-3 py-2 text-slate-dark">{row.description}</td>
                    <td className="px-3 py-2 text-slate">{row.dateAcquired || '-'}</td>
                    <td className="px-3 py-2 text-slate">{row.dateSold || '-'}</td>
                    <td className="px-3 py-2 text-right text-slate-dark tabular-nums">${formatCentsToDollars(row.proceeds)}</td>
                    <td className="px-3 py-2 text-right text-slate-dark tabular-nums">${formatCentsToDollars(row.costBasis)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${row.gainLoss >= 0 ? 'text-success' : 'text-coral'}`}>
                      {row.gainLoss >= 0 ? '+' : ''}${formatCentsToDollars(row.gainLoss)}
                    </td>
                    <td className="px-3 py-2 text-slate">{row.isLongTerm ? 'LT' : 'ST'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirmImport}
              className="rounded-xl bg-teal px-6 py-3 text-sm font-display font-medium
                         text-white hover:bg-teal-dark transition-colors
                         focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-1"
            >
              Confirm Import ({preview.length})
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-xl border border-slate-light px-6 py-3 text-sm
                         font-display font-medium text-slate-dark hover:bg-surface
                         transition-colors focus:outline-none focus:ring-2
                         focus:ring-lavender focus:ring-offset-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing transactions list */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-light/30">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-surface text-left">
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Description</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Proceeds</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Basis</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate text-right">Gain/Loss</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate">Term</th>
                  <th className="px-3 py-2 text-xs font-display font-medium text-slate"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={i} className="border-t border-slate-light/20">
                    <td className="px-3 py-2 text-slate-dark">{t.description || `Transaction ${i + 1}`}</td>
                    <td className="px-3 py-2 text-right text-slate-dark tabular-nums">${formatCentsToDollars(t.proceeds)}</td>
                    <td className="px-3 py-2 text-right text-slate-dark tabular-nums">${formatCentsToDollars(t.costBasis)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${t.gainLoss >= 0 ? 'text-success' : 'text-coral'}`}>
                      {t.gainLoss >= 0 ? '+' : ''}${formatCentsToDollars(t.gainLoss)}
                    </td>
                    <td className="px-3 py-2 text-slate">{t.isLongTerm ? 'LT' : 'ST'}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onRemove(i)}
                        className="text-xs font-display text-coral hover:text-coral-dark
                                   focus:outline-none focus:ring-2 focus:ring-coral rounded px-1"
                        aria-label={`Remove ${t.description || `transaction ${i + 1}`}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm font-body">
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs text-slate">ST Gains</p>
              <p className="font-medium text-success tabular-nums">${formatCentsToDollars(stGains)}</p>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs text-slate">ST Losses</p>
              <p className="font-medium text-coral tabular-nums">${formatCentsToDollars(stLosses)}</p>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs text-slate">LT Gains</p>
              <p className="font-medium text-success tabular-nums">${formatCentsToDollars(ltGains)}</p>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs text-slate">LT Losses</p>
              <p className="font-medium text-coral tabular-nums">${formatCentsToDollars(ltLosses)}</p>
            </div>
          </div>
          <div className={`text-sm font-display font-semibold ${net >= 0 ? 'text-success' : 'text-coral'}`}>
            Net Capital Gain/Loss: {net >= 0 ? '+' : ''}${formatCentsToDollars(net)}
          </div>
        </div>
      )}

      {/* Add manual transaction button */}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-xl border border-dashed border-slate-light px-6 py-3
                   w-full text-sm font-display font-medium text-slate
                   hover:border-teal hover:text-teal-dark hover:bg-teal/5
                   transition-colors focus:outline-none focus:ring-2
                   focus:ring-lavender focus:ring-offset-1"
      >
        + Add Transaction Manually
      </button>
    </div>
  );
}
