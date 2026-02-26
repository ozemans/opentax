/**
 * Drag-drop PDF upload component for consolidated 1099 documents.
 *
 * Handles PDF upload, password-protected PDFs, extraction, parsing,
 * and multi-section preview before import.
 *
 * pdfjs-dist is lazy-loaded to keep the initial bundle small.
 */

import { useState, useRef, useCallback } from 'react';
import type { Parsed1099Result } from '@/utils/1099-parser';
import { LoadingSpinner } from '@/ui/components/LoadingSpinner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Document1099UploadProps {
  onImport: (result: Parsed1099Result) => void;
}

type UploadState =
  | { step: 'idle' }
  | { step: 'password'; fileBytes: ArrayBuffer }
  | { step: 'loading'; message: string }
  | { step: 'preview'; result: Parsed1099Result }
  | { step: 'error'; message: string };

interface SectionSelection {
  includeINT: boolean;
  includeDIV: boolean;
  includeB: boolean;
  includeNEC: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCentsToDollars(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Document1099Upload({ onImport }: Document1099UploadProps) {
  const [state, setState] = useState<UploadState>({ step: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState<SectionSelection>({
    includeINT: true,
    includeDIV: true,
    includeB: true,
    includeNEC: true,
  });
  const [password, setPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----- Core processing pipeline -----

  const processFile = useCallback(async (fileBytes: ArrayBuffer, pwd?: string) => {
    setState({ step: 'loading', message: 'Extracting text from PDF...' });

    try {
      // Lazy-load PDF extraction
      const { extractPdfText } = await import('@/utils/pdf-extract');
      const extraction = await extractPdfText(fileBytes, pwd);

      if (extraction.needsPassword) {
        setState({ step: 'password', fileBytes });
        return;
      }

      if (extraction.items.length === 0) {
        setState({
          step: 'error',
          message: 'No text could be extracted from this PDF. It may be a scanned image.',
        });
        return;
      }

      setState({ step: 'loading', message: 'Parsing 1099 data...' });

      // Lazy-load the parser
      const { parse1099Pdf } = await import('@/utils/1099-parser');
      const result = parse1099Pdf(extraction.items);

      const totalSections =
        result.form1099INTs.length +
        result.form1099DIVs.length +
        result.form1099Bs.length +
        result.form1099NECs.length;

      if (totalSections === 0) {
        setState({
          step: 'error',
          message:
            result.warnings.length > 0
              ? result.warnings.join(' ')
              : 'No 1099 data could be extracted from this PDF.',
        });
        return;
      }

      // Reset selection to include all found sections
      setSelection({
        includeINT: result.form1099INTs.length > 0,
        includeDIV: result.form1099DIVs.length > 0,
        includeB: result.form1099Bs.length > 0,
        includeNEC: result.form1099NECs.length > 0,
      });

      setState({ step: 'preview', result });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setState({ step: 'error', message });
    }
  }, []);

  // ----- File handling -----

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setState({ step: 'error', message: 'Please upload a PDF file.' });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const bytes = e.target?.result as ArrayBuffer;
        processFile(bytes);
      };
      reader.onerror = () =>
        setState({ step: 'error', message: 'Error reading file.' });
      reader.readAsArrayBuffer(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ----- Password handling -----

  const handlePasswordSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (state.step === 'password') {
        processFile(state.fileBytes, password);
        setPassword('');
      }
    },
    [state, password, processFile],
  );

  // ----- Import handling -----

  const handleImport = useCallback(() => {
    if (state.step !== 'preview') return;

    const result: Parsed1099Result = {
      ...state.result,
      form1099INTs: selection.includeINT ? state.result.form1099INTs : [],
      form1099DIVs: selection.includeDIV ? state.result.form1099DIVs : [],
      form1099Bs: selection.includeB ? state.result.form1099Bs : [],
      form1099NECs: selection.includeNEC ? state.result.form1099NECs : [],
    };

    onImport(result);
    setState({ step: 'idle' });
  }, [state, selection, onImport]);

  const handleCancel = useCallback(() => {
    setState({ step: 'idle' });
    setPassword('');
  }, []);

  // ----- Render helpers -----

  const hasAnySelected =
    state.step === 'preview' &&
    ((selection.includeINT && state.result.form1099INTs.length > 0) ||
      (selection.includeDIV && state.result.form1099DIVs.length > 0) ||
      (selection.includeB && state.result.form1099Bs.length > 0) ||
      (selection.includeNEC && state.result.form1099NECs.length > 0));

  // ===================================================================
  // RENDER
  // ===================================================================

  return (
    <div className="space-y-4">
      {/* Drop zone — always visible unless loading/preview */}
      {(state.step === 'idle' || state.step === 'error') && (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center
              transition-colors duration-200
              ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-light hover:border-highlight hover:bg-highlight-light/30'
              }
            `}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            aria-label="Upload 1099 PDF document"
          >
            <svg
              className="mx-auto h-10 w-10 text-slate-light"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
            <p className="mt-3 text-sm font-display font-medium text-slate-dark">
              Drop 1099 PDF here or click to browse
            </p>
            <p className="mt-1 text-xs font-body text-slate">
              Supports consolidated 1099s from Fidelity, Schwab, Vanguard, and other brokers
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
                // Reset so the same file can be re-selected
                e.target.value = '';
              }}
              className="hidden"
              aria-hidden="true"
            />
          </div>

          {state.step === 'error' && (
            <div
              role="alert"
              className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-3"
            >
              <p className="text-sm font-body text-accent">{state.message}</p>
            </div>
          )}
        </>
      )}

      {/* Password prompt */}
      {state.step === 'password' && (
        <div className="rounded-2xl border border-slate-light/30 p-6 space-y-4">
          <p className="text-sm font-display font-medium text-slate-dark">
            This PDF is password-protected
          </p>
          <form onSubmit={handlePasswordSubmit} className="flex gap-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter PDF password"
              className="flex-1 rounded-xl border border-slate-light px-4 py-2
                         text-sm font-body text-slate-dark
                         focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              autoFocus
            />
            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-2 text-sm font-display font-medium
                         text-white hover:bg-primary-dark transition-colors
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              Unlock
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-slate-light px-4 py-2 text-sm
                         font-display font-medium text-slate-dark hover:bg-surface
                         transition-colors focus:outline-none focus:ring-2
                         focus:ring-highlight focus:ring-offset-1"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Loading state */}
      {state.step === 'loading' && (
        <div className="rounded-2xl border border-slate-light/30 p-8">
          <LoadingSpinner message={state.message} />
        </div>
      )}

      {/* Preview */}
      {state.step === 'preview' && (
        <div className="rounded-2xl border border-slate-light/30 p-6 space-y-5">
          {/* Header */}
          <div>
            <h3 className="text-base font-display font-semibold text-slate-dark">
              1099 Import Preview
            </h3>
            {(state.result.brokerName || state.result.taxYear) && (
              <p className="mt-1 text-sm font-body text-slate">
                {state.result.brokerName}
                {state.result.brokerName && state.result.taxYear && ' \u2014 '}
                {state.result.taxYear && `Tax Year ${state.result.taxYear}`}
              </p>
            )}
          </div>

          {/* Section previews */}
          <div className="space-y-3">
            {/* 1099-INT */}
            {state.result.form1099INTs.length > 0 && (
              <SectionPreview
                label="1099-INT"
                checked={selection.includeINT}
                onToggle={() =>
                  setSelection((s) => ({ ...s, includeINT: !s.includeINT }))
                }
              >
                {state.result.form1099INTs.map((f, i) => (
                  <div key={i} className="flex justify-between text-sm font-body">
                    <span className="text-slate">{f.payerName || 'Interest Income'}</span>
                    <div className="text-right tabular-nums">
                      <span className="text-slate-dark">${formatCentsToDollars(f.interest)}</span>
                      {(f.federalWithheld ?? 0) > 0 && (
                        <span className="ml-3 text-xs text-slate">
                          Withheld: ${formatCentsToDollars(f.federalWithheld ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </SectionPreview>
            )}

            {/* 1099-DIV */}
            {state.result.form1099DIVs.length > 0 && (
              <SectionPreview
                label="1099-DIV"
                checked={selection.includeDIV}
                onToggle={() =>
                  setSelection((s) => ({ ...s, includeDIV: !s.includeDIV }))
                }
              >
                {state.result.form1099DIVs.map((f, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-sm font-body text-slate">
                      {f.payerName || 'Dividends'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm font-body tabular-nums">
                      <span className="text-slate">Ordinary: ${formatCentsToDollars(f.ordinaryDividends)}</span>
                      <span className="text-slate">Qualified: ${formatCentsToDollars(f.qualifiedDividends)}</span>
                      {f.totalCapitalGain > 0 && (
                        <span className="text-slate">Cap Gain: ${formatCentsToDollars(f.totalCapitalGain)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </SectionPreview>
            )}

            {/* 1099-B */}
            {state.result.form1099Bs.length > 0 && (
              <SectionPreview
                label="1099-B"
                checked={selection.includeB}
                onToggle={() =>
                  setSelection((s) => ({ ...s, includeB: !s.includeB }))
                }
              >
                <div className="text-sm font-body">
                  <p className="text-slate-dark">
                    {state.result.form1099Bs.length} transaction{state.result.form1099Bs.length !== 1 ? 's' : ''}
                  </p>
                  <div className="mt-1 flex gap-4 tabular-nums">
                    {(() => {
                      const netGainLoss = state.result.form1099Bs.reduce(
                        (sum, t) => sum + t.gainLoss,
                        0,
                      );
                      return (
                        <span
                          className={
                            netGainLoss >= 0 ? 'text-success' : 'text-accent'
                          }
                        >
                          Net: {netGainLoss >= 0 ? '+' : ''}$
                          {formatCentsToDollars(netGainLoss)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </SectionPreview>
            )}

            {/* 1099-NEC */}
            {state.result.form1099NECs.length > 0 && (
              <SectionPreview
                label="1099-NEC"
                checked={selection.includeNEC}
                onToggle={() =>
                  setSelection((s) => ({ ...s, includeNEC: !s.includeNEC }))
                }
              >
                {state.result.form1099NECs.map((f, i) => (
                  <div key={i} className="flex justify-between text-sm font-body">
                    <span className="text-slate">{f.payerName || 'Nonemployee Compensation'}</span>
                    <span className="text-slate-dark tabular-nums">
                      ${formatCentsToDollars(f.nonemployeeCompensation)}
                    </span>
                  </div>
                ))}
              </SectionPreview>
            )}
          </div>

          {/* Warnings */}
          {state.result.warnings.length > 0 && (
            <div className="rounded-xl bg-warning/10 border border-warning/20 px-4 py-3">
              <p className="text-xs font-display font-medium text-warning mb-1">
                Warnings
              </p>
              <ul className="space-y-0.5">
                {state.result.warnings.map((w, i) => (
                  <li key={i} className="text-xs font-body text-warning">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={!hasAnySelected}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-display font-medium
                         text-white hover:bg-primary-dark transition-colors
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import Selected
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-slate-light px-6 py-3 text-sm
                         font-display font-medium text-slate-dark hover:bg-surface
                         transition-colors focus:outline-none focus:ring-2
                         focus:ring-highlight focus:ring-offset-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Preview sub-component
// ---------------------------------------------------------------------------

interface SectionPreviewProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SectionPreview({ label, checked, onToggle, children }: SectionPreviewProps) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        checked
          ? 'border-primary/30 bg-primary/5'
          : 'border-slate-light/30 bg-surface opacity-60'
      }`}
    >
      <label className="flex items-center gap-3 cursor-pointer mb-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="h-4 w-4 rounded border-slate-light text-primary
                     focus:ring-2 focus:ring-primary focus:ring-offset-1"
        />
        <span className="text-sm font-display font-semibold text-slate-dark">
          {label}
        </span>
      </label>
      <div className="ml-7 space-y-1">{children}</div>
    </div>
  );
}
