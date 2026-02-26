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
    <nav aria-label="Tax return progress">
      {/* ── Desktop: vertical sidebar step list ── */}
      <div className="hidden lg:flex lg:flex-col">
        <div className="relative">
          {/* Vertical progress line (background) */}
          <div
            className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-light/30"
            aria-hidden="true"
          />
          {/* Vertical progress line (filled) */}
          <div
            className="absolute left-4 top-4 w-0.5 bg-primary transition-all duration-500 ease-smooth"
            style={{
              height: `${(currentStep / Math.max(totalSteps - 1, 1)) * 100}%`,
              maxHeight: 'calc(100% - 2rem)',
            }}
            aria-hidden="true"
          />

          <div className="flex flex-col gap-1">
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
                    relative z-10 flex items-center gap-3 rounded-lg px-1 py-1.5
                    focus:outline-none focus:ring-2 focus:ring-highlight focus:ring-offset-1
                    transition-colors duration-150
                    ${isClickable ? 'cursor-pointer hover:bg-highlight/50' : 'cursor-default'}
                  `}
                >
                  {/* Circle */}
                  <div
                    className={`
                      relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full
                      text-xs font-display font-semibold transition-all duration-300
                      ${isCompleted
                        ? 'bg-primary text-white'
                        : isCurrent
                          ? 'bg-highlight text-slate-dark ring-2 ring-primary/40 ring-offset-1'
                          : 'bg-white border-2 border-slate-light/40 text-slate-light'}
                    `}
                  >
                    {isCompleted ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                    {isCurrent && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" aria-hidden="true" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={`text-sm font-display leading-tight ${
                      isCurrent
                        ? 'text-slate-dark font-semibold'
                        : isCompleted
                          ? 'text-slate-dark'
                          : 'text-slate'
                    }`}
                  >
                    {step.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Back/Next buttons */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-light/20">
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack}
            className="flex-1 rounded-lg border border-slate-light px-3 py-2 text-sm
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
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-display font-medium
                       text-white hover:bg-primary-dark transition-colors
                       focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {/* ── Mobile: compact header bar + fixed bottom buttons ── */}
      <div className="lg:hidden">
        {/* Progress info in header */}
        <div className="px-4 py-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-display font-semibold text-slate-dark">
              {steps[currentStep]?.label || ''}
            </span>
            <span className="text-xs font-body text-slate">
              {currentStep + 1} / {totalSteps}
            </span>
          </div>
          {/* Thin progress bar */}
          <div
            className="h-1 w-full rounded-full bg-slate-light/30 overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-smooth"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

    </nav>
  );
}
