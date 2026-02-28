// State Tax Module Interfaces
//
// All monetary values are integers in CENTS. $50,000 = 5_000_000 cents.
// NEVER use floating point for money — only integers + Math.round().

import type { FilingStatus, TaxBracket } from '../types';

// ---------------------------------------------------------------------------
// StateTaxInput — What state modules receive
// ---------------------------------------------------------------------------

export interface StateTaxInput {
  federalAGI: number;
  federalTaxableIncome: number;
  federalTotalIncome: number;
  filingStatus: FilingStatus;
  taxYear: number;
  taxpayerAge65OrOlder: boolean;
  taxpayerBlind: boolean;
  spouseAge65OrOlder: boolean;
  spouseBlind: boolean;
  numDependents: number;
  numQualifyingChildren: number;
  numChildrenUnder4?: number;
  wages: number;
  taxableInterest: number;
  ordinaryDividends: number;
  qualifiedDividends: number;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;
  netCapitalGainLoss: number;
  selfEmploymentIncome: number;
  unemployment: number;
  retirementDistributions: number;
  socialSecurityIncome: number;
  otherIncome: number;
  federalEITC: number;
  federalChildTaxCredit: number;
  stateWages: number;
  stateWithheld: number;
  stateEstimatedPayments: number;
  federalItemizedDeductions: number;
  usedFederalItemized: boolean;
  propertyTaxes: number;
  mortgageInterest: number;
  charitableContributions: number;
  medicalExpenses: number;
  stateLocalTaxesPaid: number;
  isRenter: boolean;
  rentPaid: number;
  locality?: string;
  residencyType?: 'resident' | 'nonresident' | 'part_year';
  nySourceIncome?: number;  // NY-sourced wages for non-residents (cents)
}

// ---------------------------------------------------------------------------
// StateTaxResult — Output from state modules
// ---------------------------------------------------------------------------

export interface StateTaxResult {
  stateCode: string;
  stateName: string;
  hasIncomeTax: boolean;
  stateAGI: number;
  stateAdditions: number;
  stateSubtractions: number;
  stateDeduction: number;
  stateExemptions: number;
  stateTaxableIncome: number;
  stateTaxBeforeCredits: number;
  stateCredits: number;
  stateSurtax: number;
  localTax: number;
  stateTaxAfterCredits: number;
  stateWithheld: number;
  stateEstimatedPayments: number;
  stateRefundOrOwed: number;
  effectiveRate: number;
  marginalRate: number;
  creditBreakdown: Record<string, number>;
  formData: Record<string, string | number>;
  formId: string;
}

// ---------------------------------------------------------------------------
// StateConfig — Configuration for a state's tax rules
// ---------------------------------------------------------------------------

export interface StateConfig {
  stateCode: string;
  stateName: string;
  taxYear: number;
  hasIncomeTax: boolean;
  startingPoint: 'federal_agi' | 'federal_taxable_income' | 'own_computation';
  brackets?: Partial<Record<FilingStatus, TaxBracket[]>>;
  flatRate?: number;
  standardDeduction?: Partial<Record<FilingStatus, number>>;
  personalExemption?: {
    taxpayer: Partial<Record<FilingStatus, number>>;
    spouse: number;
    dependent: number;
    age65Additional?: number;
    blindAdditional?: number;
    tiers?: Array<{ maxAgi: number | null; amount: number }>;
  };
  socialSecurityExempt: boolean;
  retirementExemption?: Partial<Record<FilingStatus, number>>;
  capitalGainsTreatment: 'ordinary' | 'preferential' | 'exempt';
  shortTermCapGainsRate?: number;
  surtax?: {
    threshold: Partial<Record<FilingStatus, number>>;
    rate: number;
    description: string;
  };
  localTax?: Record<string, {
    brackets: TaxBracket[] | Partial<Record<FilingStatus, TaxBracket[]>>;
    standardDeduction?: Partial<Record<FilingStatus, number>>;
  }>;
  credits?: {
    eitc?: { type: 'percent_of_federal'; percentOfFederal: number; refundable: boolean }
      | {
          type: 'independent';
          refundable: boolean;
          investmentIncomeLimit: number;
          tiers: Array<{
            children: number;
            maxCredit: number;
            phaseInRate: number;
            completedPhaseIn: number;
            phaseOutBegins: number;
            phaseOutRate: number;
            phaseOutEnds: number;
          }>;
        };
    propertyTax?: { maxCredit: Partial<Record<FilingStatus, number>>; eligibilityIncomeLimit?: number };
    rentersCredit?: { amount: Partial<Record<FilingStatus, number>>; agiLimit: Partial<Record<FilingStatus, number>> };
    childCredit?: { amountPerChild: number; amountPerChildUnder4?: number; agiPhaseOut: Partial<Record<FilingStatus, number>> };
  };
  specialTaxes?: { sdi?: { rate: number; wageBase: number } };
  formId: string;
  formName: string;
}

// ---------------------------------------------------------------------------
// StateModule — Interface that each state module implements
// ---------------------------------------------------------------------------

export interface StateModule {
  readonly stateCode: string;
  readonly stateName: string;
  readonly hasIncomeTax: boolean;
  compute(input: StateTaxInput, config: StateConfig): StateTaxResult;
}
