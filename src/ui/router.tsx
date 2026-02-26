import { createBrowserRouter } from 'react-router';
import { InterviewLayout } from './layouts/InterviewLayout';
import { WelcomePage } from './pages/WelcomePage';
import { FilingStatusPage } from './pages/FilingStatusPage';
import { PersonalInfoPage } from './pages/PersonalInfoPage';
import { IncomePage } from './pages/IncomePage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { AdjustmentsPage } from './pages/AdjustmentsPage';
import { DeductionsPage } from './pages/DeductionsPage';
import { CreditsPage } from './pages/CreditsPage';
import { StatePage } from './pages/StatePage';
import { ReviewPage } from './pages/ReviewPage';
import { ResultsPage } from './pages/ResultsPage';

// ---------------------------------------------------------------------------
// Interview step configuration
// ---------------------------------------------------------------------------

export interface InterviewStep {
  id: string;
  path: string;
  label: string;
  stepNumber: number;
}

export const INTERVIEW_STEPS: InterviewStep[] = [
  { id: 'welcome',        path: '/',              label: 'Welcome',        stepNumber: 0 },
  { id: 'filing-status',  path: '/filing-status',  label: 'Filing Status',  stepNumber: 1 },
  { id: 'personal-info',  path: '/personal-info',  label: 'Personal Info',  stepNumber: 2 },
  { id: 'income',         path: '/income',         label: 'Income',         stepNumber: 3 },
  { id: 'investments',    path: '/investments',    label: 'Investments',    stepNumber: 4 },
  { id: 'adjustments',    path: '/adjustments',    label: 'Adjustments',    stepNumber: 5 },
  { id: 'deductions',     path: '/deductions',     label: 'Deductions',     stepNumber: 6 },
  { id: 'credits',        path: '/credits',        label: 'Credits',        stepNumber: 7 },
  { id: 'state',          path: '/state',          label: 'State Taxes',    stepNumber: 8 },
  { id: 'review',         path: '/review',         label: 'Review',         stepNumber: 9 },
  { id: 'results',        path: '/results',        label: 'Results',        stepNumber: 10 },
];

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const router = createBrowserRouter([
  {
    element: <InterviewLayout />,
    children: [
      { path: '/', element: <WelcomePage /> },
      { path: '/filing-status', element: <FilingStatusPage /> },
      { path: '/personal-info', element: <PersonalInfoPage /> },
      { path: '/income', element: <IncomePage /> },
      { path: '/investments', element: <InvestmentsPage /> },
      { path: '/adjustments', element: <AdjustmentsPage /> },
      { path: '/deductions', element: <DeductionsPage /> },
      { path: '/credits', element: <CreditsPage /> },
      { path: '/state', element: <StatePage /> },
      { path: '/review', element: <ReviewPage /> },
      { path: '/results', element: <ResultsPage /> },
    ],
  },
]);
