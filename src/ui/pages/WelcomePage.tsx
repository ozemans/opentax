import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { PrivacyBadge } from '@/ui/components/PrivacyBadge';
import { PasswordDialog } from '@/ui/components/PasswordDialog';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { useTaxState } from '@/ui/hooks/useTaxState';
import { useEncryptedExport } from '@/ui/hooks/useEncryptedExport';

const FEATURES = [
  {
    title: '100% Private',
    description: 'Your data never leaves your device. No servers, no tracking, no third parties.',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'IRS-Accurate',
    description: 'Built from IRS publications and form instructions. Every calculation is tested and verifiable.',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Free & Open Source',
    description: 'No hidden fees, no upsells. Inspect the code yourself. Community-driven and transparent.',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const headingRef = useFocusOnPageChange('welcome');
  const [showImport, setShowImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { input, dispatch } = useTaxState();
  const { importReturn, isImporting, error: importError, clearError } = useEncryptedExport(input, dispatch);

  function handleFileSelect() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowImport(true);
    }
    // Reset so re-selecting the same file works
    e.target.value = '';
  }

  async function handleImport(password: string) {
    if (!selectedFile) return;
    await importReturn(selectedFile, password);
    if (!importError) {
      setShowImport(false);
      setSelectedFile(null);
      navigate('/filing-status');
    }
  }

  function handleCloseImport() {
    setShowImport(false);
    setSelectedFile(null);
    clearError();
  }

  return (
    <div className="max-w-3xl mx-auto text-center space-y-10">
      {/* Hidden file input for .opentax files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".opentax"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-4xl sm:text-5xl font-display font-bold text-slate-dark
                     focus:outline-none"
        >
          OpenTax
        </h1>
        <p className="mt-3 text-lg font-body text-slate">
          Privacy-first tax filing. Free, open source, and entirely in your browser.
        </p>
      </motion.div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.15 + i * 0.1,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="rounded-2xl bg-white p-6 shadow-card text-center
                       hover:shadow-card-hover transition-shadow duration-200"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center
                            rounded-full bg-lavender-light text-teal-dark">
              {feature.icon}
            </div>
            <h2 className="mt-4 text-base font-display font-semibold text-slate-dark">
              {feature.title}
            </h2>
            <p className="mt-2 text-sm font-body text-slate leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>

      {/* CTA buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4"
      >
        <button
          type="button"
          onClick={() => navigate('/filing-status')}
          className="w-full sm:w-auto rounded-xl bg-teal px-8 py-4 text-base
                     font-display font-semibold text-white
                     hover:bg-teal-dark transition-colors
                     focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2
                     shadow-card hover:shadow-card-hover"
        >
          Start Your Return
        </button>
        <button
          type="button"
          onClick={handleFileSelect}
          className="w-full sm:w-auto rounded-xl border border-slate-light px-8 py-4
                     text-base font-display font-medium text-slate-dark
                     hover:bg-surface transition-colors
                     focus:outline-none focus:ring-2 focus:ring-lavender focus:ring-offset-2"
        >
          Import .opentax file
        </button>
      </motion.div>

      {/* Privacy badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="flex justify-center"
      >
        <PrivacyBadge variant="inline" />
      </motion.div>

      <PasswordDialog
        isOpen={showImport}
        onClose={handleCloseImport}
        onSubmit={handleImport}
        mode="import"
        error={importError ?? undefined}
        isLoading={isImporting}
      />
    </div>
  );
}
