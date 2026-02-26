import type { FilingStatus } from '@/engine/types';

export const FILING_STATUS_OPTIONS: Array<{
  value: FilingStatus;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'single',
    label: 'Single',
    description: 'Unmarried or legally separated',
    icon: '\u{1F464}',
  },
  {
    value: 'married_filing_jointly',
    label: 'Married Filing Jointly',
    description: 'Married and filing a combined return',
    icon: '\u{1F465}',
  },
  {
    value: 'married_filing_separately',
    label: 'Married Filing Separately',
    description: 'Married but filing individual returns',
    icon: '\u2194',
  },
  {
    value: 'head_of_household',
    label: 'Head of Household',
    description: 'Unmarried and paying more than half the cost of maintaining a home',
    icon: '\u{1F3E0}',
  },
  {
    value: 'qualifying_surviving_spouse',
    label: 'Qualifying Surviving Spouse',
    description: 'Spouse died in the last 2 years with a dependent child',
    icon: '\u{1F54A}',
  },
];
