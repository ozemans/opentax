import { useState, useCallback, useMemo } from 'react';
import type { TaxInput } from '../../engine/types';
import {
  isValidSSN,
  isValidDate,
  isValidZip,
  isValidEIN,
  isValidRoutingNumber,
  isNonNegativeCents,
} from '../../utils/validation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PageId =
  | 'filing-status'
  | 'personal-info'
  | 'income'
  | 'investments'
  | 'adjustments'
  | 'deductions'
  | 'credits'
  | 'state'
  | 'review';

export interface ValidationError {
  fieldPath: string;
  message: string;
}

export interface UseValidationReturn {
  getPageErrors: (pageId: PageId) => ValidationError[];
  isPageValid: (pageId: PageId) => boolean;
  getFieldError: (fieldPath: string) => string | null;
  touchField: (fieldPath: string) => void;
  getVisibleError: (fieldPath: string) => string | null;
}

// ---------------------------------------------------------------------------
// Validation rules per page
// ---------------------------------------------------------------------------

function validateFilingStatus(input: TaxInput): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!input.filingStatus) {
    errors.push({ fieldPath: 'filingStatus', message: 'Filing status is required' });
  }
  return errors;
}

function validatePersonalInfo(input: TaxInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.taxpayer.firstName.trim()) {
    errors.push({ fieldPath: 'taxpayer.firstName', message: 'First name is required' });
  }
  if (!input.taxpayer.lastName.trim()) {
    errors.push({ fieldPath: 'taxpayer.lastName', message: 'Last name is required' });
  }
  if (!input.taxpayer.ssn) {
    errors.push({ fieldPath: 'taxpayer.ssn', message: 'SSN is required' });
  } else if (!isValidSSN(input.taxpayer.ssn)) {
    errors.push({ fieldPath: 'taxpayer.ssn', message: 'Invalid SSN format' });
  }
  if (!input.taxpayer.dateOfBirth) {
    errors.push({ fieldPath: 'taxpayer.dateOfBirth', message: 'Date of birth is required' });
  } else if (!isValidDate(input.taxpayer.dateOfBirth)) {
    errors.push({ fieldPath: 'taxpayer.dateOfBirth', message: 'Invalid date' });
  }

  // Address
  if (!input.address.street.trim()) {
    errors.push({ fieldPath: 'address.street', message: 'Street address is required' });
  }
  if (!input.address.city.trim()) {
    errors.push({ fieldPath: 'address.city', message: 'City is required' });
  }
  if (!input.address.state) {
    errors.push({ fieldPath: 'address.state', message: 'State is required' });
  }
  if (!input.address.zip) {
    errors.push({ fieldPath: 'address.zip', message: 'ZIP code is required' });
  } else if (!isValidZip(input.address.zip)) {
    errors.push({ fieldPath: 'address.zip', message: 'Invalid ZIP code' });
  }

  // Spouse (required for MFJ / MFS)
  const needsSpouse =
    input.filingStatus === 'married_filing_jointly' ||
    input.filingStatus === 'married_filing_separately';
  if (needsSpouse) {
    if (!input.spouse?.firstName?.trim()) {
      errors.push({ fieldPath: 'spouse.firstName', message: 'Spouse first name is required' });
    }
    if (!input.spouse?.lastName?.trim()) {
      errors.push({ fieldPath: 'spouse.lastName', message: 'Spouse last name is required' });
    }
    if (!input.spouse?.ssn) {
      errors.push({ fieldPath: 'spouse.ssn', message: 'Spouse SSN is required' });
    } else if (!isValidSSN(input.spouse.ssn)) {
      errors.push({ fieldPath: 'spouse.ssn', message: 'Invalid spouse SSN' });
    }
    if (!input.spouse?.dateOfBirth) {
      errors.push({ fieldPath: 'spouse.dateOfBirth', message: 'Spouse date of birth is required' });
    } else if (!isValidDate(input.spouse.dateOfBirth)) {
      errors.push({ fieldPath: 'spouse.dateOfBirth', message: 'Invalid date' });
    }
  }

  // Dependents
  for (let i = 0; i < input.dependents.length; i++) {
    const dep = input.dependents[i];
    if (!dep.firstName.trim()) {
      errors.push({ fieldPath: `dependents.${i}.firstName`, message: 'First name is required' });
    }
    if (!dep.lastName.trim()) {
      errors.push({ fieldPath: `dependents.${i}.lastName`, message: 'Last name is required' });
    }
    if (!dep.ssn) {
      errors.push({ fieldPath: `dependents.${i}.ssn`, message: 'SSN is required' });
    } else if (!isValidSSN(dep.ssn)) {
      errors.push({ fieldPath: `dependents.${i}.ssn`, message: 'Invalid SSN' });
    }
    if (!dep.relationship.trim()) {
      errors.push({ fieldPath: `dependents.${i}.relationship`, message: 'Relationship is required' });
    }
    if (!dep.dateOfBirth) {
      errors.push({ fieldPath: `dependents.${i}.dateOfBirth`, message: 'Date of birth is required' });
    } else if (!isValidDate(dep.dateOfBirth)) {
      errors.push({ fieldPath: `dependents.${i}.dateOfBirth`, message: 'Invalid date' });
    }
  }

  return errors;
}

function validateIncome(input: TaxInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // W2 validation
  for (let i = 0; i < input.w2s.length; i++) {
    const w2 = input.w2s[i];
    if (!w2.employerName.trim()) {
      errors.push({ fieldPath: `w2s.${i}.employerName`, message: 'Employer name is required' });
    }
    if (w2.employerEIN && !isValidEIN(w2.employerEIN)) {
      errors.push({ fieldPath: `w2s.${i}.employerEIN`, message: 'Invalid EIN format' });
    }
    if (!isNonNegativeCents(w2.wages)) {
      errors.push({ fieldPath: `w2s.${i}.wages`, message: 'Wages must be non-negative' });
    }
    if (!isNonNegativeCents(w2.federalWithheld)) {
      errors.push({ fieldPath: `w2s.${i}.federalWithheld`, message: 'Withholding must be non-negative' });
    }
  }

  // 1099-INT validation
  for (let i = 0; i < input.form1099INTs.length; i++) {
    const form = input.form1099INTs[i];
    if (!form.payerName.trim()) {
      errors.push({ fieldPath: `form1099INTs.${i}.payerName`, message: 'Payer name is required' });
    }
    if (!isNonNegativeCents(form.interest)) {
      errors.push({ fieldPath: `form1099INTs.${i}.interest`, message: 'Interest must be non-negative' });
    }
  }

  // 1099-DIV validation
  for (let i = 0; i < input.form1099DIVs.length; i++) {
    const form = input.form1099DIVs[i];
    if (!form.payerName.trim()) {
      errors.push({ fieldPath: `form1099DIVs.${i}.payerName`, message: 'Payer name is required' });
    }
    if (!isNonNegativeCents(form.ordinaryDividends)) {
      errors.push({ fieldPath: `form1099DIVs.${i}.ordinaryDividends`, message: 'Dividends must be non-negative' });
    }
  }

  // 1099-NEC validation
  for (let i = 0; i < input.form1099NECs.length; i++) {
    const form = input.form1099NECs[i];
    if (!form.payerName.trim()) {
      errors.push({ fieldPath: `form1099NECs.${i}.payerName`, message: 'Payer name is required' });
    }
    if (!isNonNegativeCents(form.nonemployeeCompensation)) {
      errors.push({ fieldPath: `form1099NECs.${i}.nonemployeeCompensation`, message: 'Compensation must be non-negative' });
    }
  }

  return errors;
}

function validateInvestments(input: TaxInput): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let i = 0; i < input.form1099Bs.length; i++) {
    const form = input.form1099Bs[i];
    if (!form.description.trim()) {
      errors.push({ fieldPath: `form1099Bs.${i}.description`, message: 'Description is required' });
    }
    if (!form.dateSold) {
      errors.push({ fieldPath: `form1099Bs.${i}.dateSold`, message: 'Date sold is required' });
    }
  }

  if (input.priorYearCapitalLossCarryforward !== undefined && input.priorYearCapitalLossCarryforward < 0) {
    errors.push({ fieldPath: 'priorYearCapitalLossCarryforward', message: 'Carryforward must be non-negative' });
  }

  return errors;
}

function validateAdjustments(input: TaxInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (input.studentLoanInterest !== undefined && !isNonNegativeCents(input.studentLoanInterest)) {
    errors.push({ fieldPath: 'studentLoanInterest', message: 'Must be non-negative' });
  }
  if (input.educatorExpenses !== undefined && !isNonNegativeCents(input.educatorExpenses)) {
    errors.push({ fieldPath: 'educatorExpenses', message: 'Must be non-negative' });
  }
  if (input.hsaDeduction !== undefined && !isNonNegativeCents(input.hsaDeduction)) {
    errors.push({ fieldPath: 'hsaDeduction', message: 'Must be non-negative' });
  }
  if (input.iraDeduction !== undefined && !isNonNegativeCents(input.iraDeduction)) {
    errors.push({ fieldPath: 'iraDeduction', message: 'Must be non-negative' });
  }
  if (!isNonNegativeCents(input.estimatedTaxPayments)) {
    errors.push({ fieldPath: 'estimatedTaxPayments', message: 'Must be non-negative' });
  }

  return errors;
}

function validateDeductions(input: TaxInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (input.useItemizedDeductions && input.itemizedDeductions) {
    const d = input.itemizedDeductions;
    if (!isNonNegativeCents(d.medicalExpenses)) {
      errors.push({ fieldPath: 'itemizedDeductions.medicalExpenses', message: 'Must be non-negative' });
    }
    if (!isNonNegativeCents(d.stateLocalTaxesPaid)) {
      errors.push({ fieldPath: 'itemizedDeductions.stateLocalTaxesPaid', message: 'Must be non-negative' });
    }
    if (!isNonNegativeCents(d.realEstateTaxes)) {
      errors.push({ fieldPath: 'itemizedDeductions.realEstateTaxes', message: 'Must be non-negative' });
    }
    if (!isNonNegativeCents(d.mortgageInterest)) {
      errors.push({ fieldPath: 'itemizedDeductions.mortgageInterest', message: 'Must be non-negative' });
    }
    if (!isNonNegativeCents(d.charitableCash)) {
      errors.push({ fieldPath: 'itemizedDeductions.charitableCash', message: 'Must be non-negative' });
    }
    if (!isNonNegativeCents(d.charitableNonCash)) {
      errors.push({ fieldPath: 'itemizedDeductions.charitableNonCash', message: 'Must be non-negative' });
    }
  }

  return errors;
}

function validateCredits(input: TaxInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (input.childCareCreditExpenses !== undefined && !isNonNegativeCents(input.childCareCreditExpenses)) {
    errors.push({ fieldPath: 'childCareCreditExpenses', message: 'Must be non-negative' });
  }

  if (input.educationExpenses) {
    for (let i = 0; i < input.educationExpenses.length; i++) {
      const exp = input.educationExpenses[i];
      if (!isNonNegativeCents(exp.qualifiedExpenses)) {
        errors.push({ fieldPath: `educationExpenses.${i}.qualifiedExpenses`, message: 'Must be non-negative' });
      }
      if (!exp.studentSSN) {
        errors.push({ fieldPath: `educationExpenses.${i}.studentSSN`, message: 'Student SSN is required' });
      } else if (!isValidSSN(exp.studentSSN)) {
        errors.push({ fieldPath: `educationExpenses.${i}.studentSSN`, message: 'Invalid SSN' });
      }
    }
  }

  return errors;
}

function validateState(input: TaxInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.stateOfResidence) {
    errors.push({ fieldPath: 'stateOfResidence', message: 'State of residence is required' });
  }

  return errors;
}

function validateReview(input: TaxInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // Direct deposit validation (optional, but if partially filled, validate)
  if (input.directDeposit) {
    const dd = input.directDeposit;
    if (dd.routingNumber && !isValidRoutingNumber(dd.routingNumber)) {
      errors.push({ fieldPath: 'directDeposit.routingNumber', message: 'Invalid routing number' });
    }
    if (dd.routingNumber && !dd.accountNumber) {
      errors.push({ fieldPath: 'directDeposit.accountNumber', message: 'Account number is required' });
    }
    if (!dd.routingNumber && dd.accountNumber) {
      errors.push({ fieldPath: 'directDeposit.routingNumber', message: 'Routing number is required' });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Page validator map
// ---------------------------------------------------------------------------

const PAGE_VALIDATORS: Record<PageId, (input: TaxInput) => ValidationError[]> = {
  'filing-status': validateFilingStatus,
  'personal-info': validatePersonalInfo,
  'income': validateIncome,
  'investments': validateInvestments,
  'adjustments': validateAdjustments,
  'deductions': validateDeductions,
  'credits': validateCredits,
  'state': validateState,
  'review': validateReview,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useValidation(input: TaxInput): UseValidationReturn {
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const touchField = useCallback((fieldPath: string) => {
    setTouchedFields((prev) => {
      if (prev.has(fieldPath)) return prev;
      const next = new Set(prev);
      next.add(fieldPath);
      return next;
    });
  }, []);

  // Memoize all errors across all pages
  const allErrors = useMemo(() => {
    const map = new Map<PageId, ValidationError[]>();
    for (const pageId of Object.keys(PAGE_VALIDATORS) as PageId[]) {
      map.set(pageId, PAGE_VALIDATORS[pageId](input));
    }
    return map;
  }, [input]);

  const getPageErrors = useCallback(
    (pageId: PageId): ValidationError[] => allErrors.get(pageId) ?? [],
    [allErrors],
  );

  const isPageValid = useCallback(
    (pageId: PageId): boolean => (allErrors.get(pageId) ?? []).length === 0,
    [allErrors],
  );

  // Flatten all errors for field-level lookup
  const fieldErrorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const errors of allErrors.values()) {
      for (const err of errors) {
        if (!map.has(err.fieldPath)) {
          map.set(err.fieldPath, err.message);
        }
      }
    }
    return map;
  }, [allErrors]);

  const getFieldError = useCallback(
    (fieldPath: string): string | null => fieldErrorMap.get(fieldPath) ?? null,
    [fieldErrorMap],
  );

  const getVisibleError = useCallback(
    (fieldPath: string): string | null => {
      if (!touchedFields.has(fieldPath)) return null;
      return fieldErrorMap.get(fieldPath) ?? null;
    },
    [touchedFields, fieldErrorMap],
  );

  return {
    getPageErrors,
    isPageValid,
    getFieldError,
    touchField,
    getVisibleError,
  };
}
