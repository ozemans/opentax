/**
 * Drag-drop PDF upload component for W-2 documents.
 *
 * Handles PDF upload, password-protected PDFs, extraction, parsing,
 * and preview before import.
 *
 * pdfjs-dist is lazy-loaded to keep the initial bundle small.
 */

import { useState, useRef, useCallback } from 'react';
import type { ParsedW2Result } from '@/utils/w2-parser';
import { LoadingSpinner } from '@/ui/components/LoadingSpinner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentW2UploadProps {
  onImport: (result: ParsedW2Result) => void;
}

type UploadState =
  | { step: 'idle' }
  | { step: 'password'; fileBytes: ArrayBuffer }
  | { step: 'loading'; message: string }
  | { step: 'preview'; result: ParsedW2Result; rawText?: string }
  | { step: 'error'; message: string };

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

export function DocumentW2Upload({ onImport }: DocumentW2UploadProps) {
  const [state, setState] = useState<UploadState>({ step: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const [password, setPassword] = useState('');
  const [showRawText, setShowRawText] = useState(false);
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

      let { items } = extraction;

      // If pdfjs found pages but no text, the PDF likely contains scanned images.
      // Fall back to Tesseract.js OCR (runs entirely client-side).
      if (items.length === 0 && extraction.numPages > 0) {
        setState({ step: 'loading', message: 'No text found — running OCR...' });
        const { extractTextViaOcr } = await import('@/utils/ocr-extract');
        const ocrItems = await extractTextViaOcr(fileBytes, (page, total) => {
          setState({ step: 'loading', message: `Running OCR... (page ${page} of ${total})` });
        });
        if (ocrItems.length === 0) {
          setState({
            step: 'error',
            message: 'Could not extract any text from this PDF, even with OCR.',
          });
          return;
        }
        items = ocrItems;
      }

      if (items.length === 0) {
        setState({
          step: 'error',
          message: 'No text could be extracted from this PDF.',
        });
        return;
      }

      // Build raw text dump for debugging
      const rawTextLines = items.map(
        (item, idx) =>
          `[${idx}] p${item.page} (${item.x.toFixed(1)}, ${item.y.toFixed(1)}) "${item.text}"`,
      );
      const rawText = `Total items: ${items.length}\nPages: ${extraction.numPages}\n\n${rawTextLines.join('\n')}`;

      setState({ step: 'loading', message: 'Parsing W-2 data...' });

      // Lazy-load the parser
      const { parseW2Pdf } = await import('@/utils/w2-parser');
      const result = parseW2Pdf(items);

      if (result.w2s.length === 0) {
        console.log('W-2 Parser Debug — Raw extracted text:\n', rawText);
        console.log('W-2 Parser Debug — Warnings:', result.warnings);
        setState({
          step: 'error',
          message:
            result.warnings.length > 0
              ? result.warnings.join(' ')
              : 'No W-2 data could be extracted from this PDF.',
        });
        return;
      }

      setState({ step: 'preview', result, rawText });
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
    onImport(state.result);
    setState({ step: 'idle' });
  }, [state, onImport]);

  const handleCancel = useCallback(() => {
    setState({ step: 'idle' });
    setPassword('');
  }, []);

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
            aria-label="Upload W-2 PDF document"
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
              Drop W-2 PDF here or click to browse
            </p>
            <p className="mt-1 text-xs font-body text-slate">
              Supports standard IRS W-2 forms including ADP-generated PDFs
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
              W-2 Import Preview
            </h3>
            {state.result.w2s.length > 0 && state.result.w2s[0].employerName && (
              <p className="mt-1 text-sm font-body text-slate">
                {state.result.w2s[0].employerName}
                {state.result.w2s[0].employerEIN && (
                  <> &mdash; EIN: {state.result.w2s[0].employerEIN}</>
                )}
              </p>
            )}
          </div>

          {/* W-2 data preview */}
          {state.result.w2s.map((w2, i) => (
            <div
              key={i}
              className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-body tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate">Wages (Box 1)</span>
                  <span className="text-slate-dark">${formatCentsToDollars(w2.wages)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Federal Withheld (Box 2)</span>
                  <span className="text-slate-dark">${formatCentsToDollars(w2.federalWithheld)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">SS Wages (Box 3)</span>
                  <span className="text-slate-dark">${formatCentsToDollars(w2.socialSecurityWages)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">SS Withheld (Box 4)</span>
                  <span className="text-slate-dark">${formatCentsToDollars(w2.socialSecurityWithheld)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Medicare Wages (Box 5)</span>
                  <span className="text-slate-dark">${formatCentsToDollars(w2.medicareWages)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate">Medicare Withheld (Box 6)</span>
                  <span className="text-slate-dark">${formatCentsToDollars(w2.medicareWithheld)}</span>
                </div>
                {w2.stateCode && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate">State (Box 15)</span>
                      <span className="text-slate-dark">{w2.stateCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate">State Wages (Box 16)</span>
                      <span className="text-slate-dark">${formatCentsToDollars(w2.stateWages)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate">State Withheld (Box 17)</span>
                      <span className="text-slate-dark">${formatCentsToDollars(w2.stateWithheld)}</span>
                    </div>
                  </>
                )}
                {(w2.localWages ?? 0) > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate">Local Wages (Box 18)</span>
                      <span className="text-slate-dark">${formatCentsToDollars(w2.localWages ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate">Local Withheld (Box 19)</span>
                      <span className="text-slate-dark">${formatCentsToDollars(w2.localWithheld ?? 0)}</span>
                    </div>
                    {w2.locality && (
                      <div className="flex justify-between col-span-2">
                        <span className="text-slate">Locality (Box 20)</span>
                        <span className="text-slate-dark">{w2.locality}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

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

          {/* Debug: raw extracted text */}
          {state.rawText && (
            <div>
              <button
                type="button"
                onClick={() => setShowRawText((v) => !v)}
                className="text-xs font-body text-slate underline"
              >
                {showRawText ? 'Hide' : 'Show'} raw extracted text (debug)
              </button>
              {showRawText && (
                <textarea
                  readOnly
                  value={state.rawText}
                  className="mt-2 w-full h-96 text-xs font-mono bg-surface border border-slate-light
                             rounded-lg p-3 text-slate-dark overflow-auto"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-display font-medium
                         text-white hover:bg-primary-dark transition-colors
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              Import
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
