import { useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { SkipLink } from '@/ui/components/SkipLink';
import { AmericanFlagLogo } from '@/ui/components/AmericanFlagLogo';
import { InterviewNav } from '@/ui/components/InterviewNav';
import { RefundTracker } from '@/ui/components/RefundTracker';
import { PrivacyBadge } from '@/ui/components/PrivacyBadge';
import { INTERVIEW_PAGES } from '@/ui/data/interviewPages';
import { useInterviewProgress } from '@/ui/hooks/useInterviewProgress';

export function InterviewLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { completedSteps, markComplete, setCurrentStep } = useInterviewProgress();

  // Derive current step from pathname
  const currentStep = useMemo(() => {
    const idx = INTERVIEW_PAGES.findIndex((p) => p.path === location.pathname);
    return idx >= 0 ? idx : 0;
  }, [location.pathname]);

  // Keep the interview progress hook in sync with the current step
  useMemo(() => {
    setCurrentStep(currentStep);
  }, [currentStep, setCurrentStep]);

  // Auto-mark all steps before current as complete (navigating forward implies completion)
  useMemo(() => {
    for (let i = 0; i < currentStep; i++) {
      markComplete(i);
    }
  }, [currentStep, markComplete]);

  const totalSteps = INTERVIEW_PAGES.length;

  const steps = useMemo(
    () =>
      INTERVIEW_PAGES.map((p) => ({
        label: p.label,
        shortLabel: p.shortLabel,
      })),
    []
  );

  const canGoBack = currentStep > 0;
  const canGoNext = currentStep < totalSteps - 1;

  const handleStepClick = useCallback(
    (step: number) => {
      const page = INTERVIEW_PAGES[step];
      if (page) navigate(page.path);
    },
    [navigate]
  );

  const handleBack = useCallback(() => {
    if (canGoBack) {
      const page = INTERVIEW_PAGES[currentStep - 1];
      if (page) navigate(page.path);
    }
  }, [canGoBack, currentStep, navigate]);

  const handleNext = useCallback(() => {
    if (canGoNext) {
      // Mark current step as complete when moving forward
      markComplete(currentStep);
      const page = INTERVIEW_PAGES[currentStep + 1];
      if (page) navigate(page.path);
    }
  }, [canGoNext, currentStep, navigate, markComplete]);

  return (
    <div className="min-h-screen bg-surface">
      <SkipLink />

      {/* Header — slim: logo + mobile progress */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-light/20 shadow-card">
        <div className="max-w-7xl mx-auto">
          {/* Brand row + refund estimate */}
          <div className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
            <div className="flex items-center gap-2.5">
              <AmericanFlagLogo className="h-6" />
              <span className="text-lg font-display font-bold text-navy">OpenTax</span>
            </div>
            <RefundTracker />
          </div>

          {/* Mobile-only: compact progress bar (hide entire nav on desktop) */}
          <div className="lg:hidden">
            <InterviewNav
              currentStep={currentStep}
              totalSteps={totalSteps}
              steps={steps}
              completedSteps={completedSteps}
              onStepClick={handleStepClick}
              onBack={handleBack}
              onNext={handleNext}
              canGoBack={canGoBack}
              canGoNext={canGoNext}
            />
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-4 py-6 lg:px-8 lg:py-8">
        <div className="flex gap-8 items-start">
          {/* Page content */}
          <main id="main-content" className="flex-1 min-w-0 pb-24 lg:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Desktop right sidebar: vertical progress steps */}
          <aside
            className="hidden lg:block sticky top-24 w-56 flex-shrink-0"
            aria-label="Progress"
          >
            <InterviewNav
              currentStep={currentStep}
              totalSteps={totalSteps}
              steps={steps}
              completedSteps={completedSteps}
              onStepClick={handleStepClick}
              onBack={handleBack}
              onNext={handleNext}
              canGoBack={canGoBack}
              canGoNext={canGoNext}
            />
          </aside>
        </div>
      </div>

      {/* Mobile fixed bottom bar: Back/Next */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-light/20 shadow-card">
        <div className="flex gap-3 max-w-lg mx-auto px-4 pt-2.5 pb-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <button
            type="button"
            onClick={handleBack}
            disabled={!canGoBack}
            className="flex-1 rounded-xl border border-slate-light px-4 py-2.5 text-sm
                       font-display font-medium text-slate-dark
                       hover:bg-surface transition-colors
                       focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-1
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext}
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-display font-medium
                       text-white hover:bg-primary-dark transition-colors
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {/* Floating privacy badge (desktop only) */}
      <PrivacyBadge variant="floating" />

      {/* SR announcements region */}
      <div id="sr-announcements" aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  );
}
