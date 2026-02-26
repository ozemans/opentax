import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Interview steps (0-indexed)
// ---------------------------------------------------------------------------
// 0: Filing Status
// 1: Personal Info
// 2: Income
// 3: Investments
// 4: Adjustments
// 5: Deductions
// 6: Credits
// 7: State
// 8: Review
// 9: Results

export const TOTAL_STEPS = 10;

export interface UseInterviewProgressReturn {
  currentStep: number;
  completedSteps: Set<number>;
  isStepAccessible: (step: number) => boolean;
  markComplete: (step: number) => void;
  setCurrentStep: (step: number) => void;
}

/**
 * Tracks interview progress through the tax filing flow.
 *
 * Steps are accessible if:
 * - It's step 0 (always accessible), or
 * - The previous step has been completed.
 */
export function useInterviewProgress(): UseInterviewProgressReturn {
  const [currentStep, setCurrentStepState] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const isStepAccessible = useCallback(
    (step: number): boolean => {
      if (step < 0 || step >= TOTAL_STEPS) return false;
      if (step === 0) return true;
      // A step is accessible if the previous step is completed
      return completedSteps.has(step - 1);
    },
    [completedSteps],
  );

  const markComplete = useCallback((step: number) => {
    setCompletedSteps((prev) => {
      if (prev.has(step)) return prev;
      const next = new Set(prev);
      next.add(step);
      return next;
    });
  }, []);

  const setCurrentStep = useCallback(
    (step: number) => {
      if (step >= 0 && step < TOTAL_STEPS) {
        setCurrentStepState(step);
      }
    },
    [],
  );

  return {
    currentStep,
    completedSteps,
    isStepAccessible,
    markComplete,
    setCurrentStep,
  };
}
