interface InterviewNavProps {
  currentStep: number;
  totalSteps: number;
  steps: Array<{ label: string; shortLabel: string }>;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
}

export function InterviewNav({
  currentStep,
  totalSteps,
  steps,
  completedSteps,
  onStepClick,
  onBack,
  onNext,
  canGoBack,
  canGoNext,
}: InterviewNavProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <nav aria-label="Tax return progress" className="w-full">
      {/* Desktop step bar */}
      <div className="hidden lg:block py-4 px-6">
        <div className="relative flex items-center justify-between">
          {/* Progress line (background) */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-light/30" aria-hidden="true" />
          {/* Progress line (filled) */}
          <div
            className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 ease-smooth"
            style={{ width: `${(currentStep / Math.max(totalSteps - 1, 1)) * 100}%` }}
            aria-hidden="true"
          />

          {steps.map((step, index) => {
            const isCompleted = completedSteps.has(index);
            const isCurrent = index === currentStep;
            const isClickable = isCompleted || isCurrent;

            return (
              <button
                key={index}
                type="button"
                onClick={() => isClickable && onStepClick(index)}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${step.label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                className={`
                  relative z-10 flex flex-col items-center gap-1.5
                  focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-2 rounded-lg p-1
                  ${isClickable ? 'cursor-pointer' : 'cursor-default'}
                `}
              >
                {/* Circle */}
                <div
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-full
                    text-sm font-display font-semibold transition-all duration-300
                    ${isCompleted
                      ? 'bg-primary text-white'
                      : isCurrent
                        ? 'bg-highlight text-slate-dark ring-2 ring-highlight ring-offset-2'
                        : 'bg-white border-2 border-slate-light/50 text-slate-light'}
                  `}
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                  {/* Pulse animation for current step */}
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-highlight/30" aria-hidden="true" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-xs font-display whitespace-nowrap ${
                    isCurrent ? 'text-slate-dark font-semibold' : 'text-slate'
                  }`}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile compact nav */}
      <div className="lg:hidden px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-display font-semibold text-slate-dark">
            {steps[currentStep]?.label || ''}
          </span>
          <span className="text-xs font-body text-slate">
            Step {currentStep + 1} of {totalSteps}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-slate-light/30 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-smooth"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Back/Next buttons */}
      <div className="flex justify-between px-4 lg:px-6 pb-4 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className="rounded-xl border border-slate-light px-6 py-3 text-sm
                     font-display font-medium text-slate-dark
                     hover:bg-surface transition-colors
                     focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-1
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-display font-medium
                     text-white hover:bg-primary-dark transition-colors
                     focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
