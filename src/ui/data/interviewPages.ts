export interface InterviewPageConfig {
  id: string;
  path: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const INTERVIEW_PAGES: InterviewPageConfig[] = [
  {
    id: 'welcome',
    path: '/',
    label: 'Welcome',
    shortLabel: 'Start',
    description: 'Get started with your tax return',
  },
  {
    id: 'filing-status',
    path: '/filing-status',
    label: 'Filing Status',
    shortLabel: 'Status',
    description: 'Choose your filing status',
  },
  {
    id: 'personal-info',
    path: '/personal-info',
    label: 'Personal Info',
    shortLabel: 'Info',
    description: 'Your personal information',
  },
  {
    id: 'income',
    path: '/income',
    label: 'Income',
    shortLabel: 'Income',
    description: 'W-2s, 1099s, and other income',
  },
  {
    id: 'investments',
    path: '/investments',
    label: 'Investments',
    shortLabel: 'Invest',
    description: 'Capital gains and losses',
  },
  {
    id: 'adjustments',
    path: '/adjustments',
    label: 'Adjustments',
    shortLabel: 'Adjust',
    description: 'Above-the-line deductions',
  },
  {
    id: 'deductions',
    path: '/deductions',
    label: 'Deductions',
    shortLabel: 'Deduct',
    description: 'Standard or itemized deductions',
  },
  {
    id: 'credits',
    path: '/credits',
    label: 'Credits',
    shortLabel: 'Credits',
    description: 'Tax credits you may qualify for',
  },
  {
    id: 'state',
    path: '/state',
    label: 'State Taxes',
    shortLabel: 'State',
    description: 'State of residence and state taxes',
  },
  {
    id: 'review',
    path: '/review',
    label: 'Review',
    shortLabel: 'Review',
    description: 'Review and download your return',
  },
  {
    id: 'results',
    path: '/results',
    label: 'Results',
    shortLabel: 'Done',
    description: 'Your tax return summary',
  },
];
