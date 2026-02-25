// Federal Form Field Mapping
// Maps computed TaxResult values to IRS form field names/numbers for PDF generation.
// References: IRS Form 1040 (2025), Schedule 1, 2, 3

import type { TaxResult, TaxInput } from '../types';

/**
 * Round cents to nearest dollar (half-up) for IRS form display.
 * IRS instruction: "Round off cents to the nearest dollar."
 */
function toDollars(cents: number): number {
  return Math.round(cents / 100);
}

/**
 * Format SSN as XXX-XX-XXXX.
 */
function formatSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length !== 9) return ssn;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/**
 * Generate Form 1040 field mappings.
 */
function mapForm1040(input: TaxInput, result: TaxResult): Record<string, string | number> {
  const fields: Record<string, string | number> = {};

  // Personal info
  fields['firstName'] = input.taxpayer.firstName;
  fields['lastName'] = input.taxpayer.lastName;
  fields['ssn'] = formatSSN(input.taxpayer.ssn);
  fields['address'] = input.address.street;
  fields['city'] = input.address.city;
  fields['state'] = input.address.state;
  fields['zip'] = input.address.zip;

  // Filing status (Line 1-5 checkboxes)
  fields['filingStatus'] = input.filingStatus;

  // Spouse info
  if (input.spouse) {
    fields['spouseFirstName'] = input.spouse.firstName;
    fields['spouseLastName'] = input.spouse.lastName;
    fields['spouseSSN'] = formatSSN(input.spouse.ssn);
  }

  // Dependents
  input.dependents.forEach((dep, i) => {
    fields[`dependent${i + 1}_name`] = `${dep.firstName} ${dep.lastName}`;
    fields[`dependent${i + 1}_ssn`] = formatSSN(dep.ssn);
    fields[`dependent${i + 1}_relationship`] = dep.relationship;
    if (dep.qualifiesForCTC) fields[`dependent${i + 1}_ctc`] = 'X';
  });

  // Income section
  // Line 1: Wages
  fields['line1'] = toDollars(result.incomeBreakdown.wages);
  // Line 2a: Tax-exempt interest (informational)
  // Line 2b: Taxable interest
  fields['line2b'] = toDollars(result.incomeBreakdown.interest);
  // Line 3a: Qualified dividends
  fields['line3a'] = toDollars(result.incomeBreakdown.qualifiedDividends);
  // Line 3b: Ordinary dividends
  fields['line3b'] = toDollars(result.incomeBreakdown.ordinaryDividends);
  // Line 7: Capital gain or loss
  const netCapGain = result.capitalGainsResult.deductibleLoss !== 0
    ? -toDollars(Math.abs(result.capitalGainsResult.deductibleLoss))
    : toDollars(result.capitalGainsResult.netCapitalGainLoss);
  fields['line7'] = netCapGain;
  // Line 8: Other income from Schedule 1
  if (result.needsSchedule1) {
    fields['line8'] = toDollars(
      result.incomeBreakdown.selfEmploymentIncome +
      result.incomeBreakdown.unemployment +
      result.incomeBreakdown.retirementDistributions +
      result.incomeBreakdown.otherIncome,
    );
  }
  // Line 9: Total income
  fields['line9'] = toDollars(result.totalIncome);
  // Line 10: Adjustments from Schedule 1
  // Line 11: AGI
  fields['line11'] = toDollars(result.adjustedGrossIncome);
  // Line 12: Standard or itemized deduction
  fields['line12'] = toDollars(result.deductionBreakdown.amount);
  // Line 13: QBI deduction
  if (result.selfEmploymentResult) {
    fields['line13'] = toDollars(result.selfEmploymentResult.qbiDeduction);
  }
  // Line 14: Total deductions
  fields['line14'] = toDollars(
    result.deductionBreakdown.amount + (result.selfEmploymentResult?.qbiDeduction ?? 0),
  );
  // Line 15: Taxable income
  fields['line15'] = toDollars(result.taxableIncome);
  // Line 16: Tax
  fields['line16'] = toDollars(
    result.taxBreakdown.ordinaryIncomeTax + result.taxBreakdown.capitalGainsTax,
  );
  // Line 17: AMT (from Schedule 2)
  if (result.taxBreakdown.amt > 0) {
    fields['line17'] = toDollars(result.taxBreakdown.amt);
  }
  // Line 19: Nonrefundable credits
  fields['line19'] = toDollars(result.creditBreakdown.childTaxCredit +
    result.creditBreakdown.otherDependentCredit +
    result.creditBreakdown.childCareCareCredit +
    result.creditBreakdown.educationCredits +
    result.creditBreakdown.saversCredit);
  // Line 23: Other taxes from Schedule 2 Part II (SE tax, Additional Medicare, NIIT)
  fields['line23'] = toDollars(
    result.taxBreakdown.selfEmploymentTax +
    result.taxBreakdown.additionalMedicareTax +
    result.taxBreakdown.netInvestmentIncomeTax,
  );
  // Line 24: Total tax
  fields['line24'] = toDollars(result.totalTax);
  // Line 25: Federal withholding
  fields['line25'] = toDollars(result.totalPayments - input.estimatedTaxPayments);
  // Line 26: Estimated tax payments
  if (input.estimatedTaxPayments > 0) {
    fields['line26'] = toDollars(input.estimatedTaxPayments);
  }
  // Line 27: EITC
  if (result.creditBreakdown.earnedIncomeCredit > 0) {
    fields['line27'] = toDollars(result.creditBreakdown.earnedIncomeCredit);
  }
  // Line 28: Additional CTC
  if (result.creditBreakdown.additionalChildTaxCredit > 0) {
    fields['line28'] = toDollars(result.creditBreakdown.additionalChildTaxCredit);
  }
  // Line 33: Total payments
  fields['line33'] = toDollars(result.totalPayments +
    result.creditBreakdown.earnedIncomeCredit +
    result.creditBreakdown.additionalChildTaxCredit);
  // Line 34: Overpayment (refund)
  if (result.refundOrOwed > 0) {
    fields['line34'] = toDollars(result.refundOrOwed);
    fields['line35a'] = toDollars(result.refundOrOwed);
    // Direct deposit info
    if (input.directDeposit) {
      fields['routingNumber'] = input.directDeposit.routingNumber;
      fields['accountNumber'] = input.directDeposit.accountNumber;
      fields['accountType'] = input.directDeposit.accountType;
    }
  }
  // Line 37: Amount owed
  if (result.refundOrOwed < 0) {
    fields['line37'] = toDollars(Math.abs(result.refundOrOwed));
  }
  // Effective/marginal rates (informational, not on form)
  fields['effectiveTaxRate'] = result.effectiveTaxRate;
  fields['marginalTaxRate'] = result.marginalTaxRate;

  return fields;
}

/**
 * Generate Schedule 1 field mappings (Additional Income and Adjustments).
 */
function mapSchedule1(input: TaxInput, result: TaxResult): Record<string, string | number> {
  const fields: Record<string, string | number> = {};

  // Part I: Additional Income
  if (result.incomeBreakdown.selfEmploymentIncome !== 0) {
    fields['line3'] = toDollars(result.incomeBreakdown.selfEmploymentIncome); // Business income
  }
  if (result.capitalGainsResult.netCapitalGainLoss !== 0) {
    fields['line4'] = toDollars(result.capitalGainsResult.netCapitalGainLoss); // Capital gain/loss
  }
  if (result.incomeBreakdown.unemployment > 0) {
    fields['line7'] = toDollars(result.incomeBreakdown.unemployment);
  }
  if (result.incomeBreakdown.otherIncome !== 0) {
    fields['line10'] = toDollars(result.incomeBreakdown.otherIncome);
  }

  // Part II: Adjustments
  if (result.selfEmploymentResult && result.selfEmploymentResult.halfSETaxDeduction > 0) {
    fields['line15'] = toDollars(result.selfEmploymentResult.halfSETaxDeduction);
  }
  if (input.hsaDeduction && input.hsaDeduction > 0) {
    fields['line17'] = toDollars(input.hsaDeduction);
  }
  if (input.iraDeduction && input.iraDeduction > 0) {
    fields['line20'] = toDollars(input.iraDeduction);
  }
  if (input.studentLoanInterest && input.studentLoanInterest > 0) {
    fields['line21'] = toDollars(input.studentLoanInterest);
  }
  if (input.educatorExpenses && input.educatorExpenses > 0) {
    fields['line11'] = toDollars(Math.min(input.educatorExpenses, 30000));
  }

  return fields;
}

/**
 * Generate all form field mappings from a TaxResult.
 * Returns the forms object ready for PDF generation.
 */
export function generateFormMappings(
  input: TaxInput,
  result: TaxResult,
): TaxResult['forms'] {
  const forms: TaxResult['forms'] = {
    f1040: mapForm1040(input, result),
  };

  if (result.needsSchedule1) {
    forms.schedule1 = mapSchedule1(input, result);
  }

  // Schedule A mapping (if itemized)
  if (result.needsScheduleA && result.deductionBreakdown.itemizedDetails) {
    const details = result.deductionBreakdown.itemizedDetails;
    forms.scheduleA = {
      line1: toDollars(details.medicalExpenses),
      line4: toDollars(Math.max(0, details.medicalExpenses - Math.round(result.adjustedGrossIncome * 0.075))),
      line5d: toDollars(details.saltCapped),
      line8a: toDollars(details.mortgageInterest),
      line11: toDollars(details.charitableCash),
      line12: toDollars(details.charitableNonCash),
      line17: toDollars(result.deductionBreakdown.itemizedAmount),
    };
  }

  // Schedule 2 (Additional Taxes) — AMT, SE tax, Additional Medicare, NIIT
  if (result.needsSchedule2) {
    forms.schedule2 = {
      line1: toDollars(result.taxBreakdown.amt),
      line6: toDollars(result.taxBreakdown.selfEmploymentTax),
      line11: toDollars(result.taxBreakdown.additionalMedicareTax),
      line12: toDollars(result.taxBreakdown.netInvestmentIncomeTax),
      line21: toDollars(
        result.taxBreakdown.selfEmploymentTax +
        result.taxBreakdown.additionalMedicareTax +
        result.taxBreakdown.netInvestmentIncomeTax,
      ),
    };
  }

  // Schedule 3 (Additional Credits)
  if (result.needsSchedule3) {
    forms.schedule3 = {};
    if (result.creditBreakdown.childCareCareCredit > 0) {
      forms.schedule3['line2'] = toDollars(result.creditBreakdown.childCareCareCredit);
    }
    if (result.creditBreakdown.educationCredits > 0) {
      forms.schedule3['line3'] = toDollars(result.creditBreakdown.educationCredits);
    }
    if (result.creditBreakdown.saversCredit > 0) {
      forms.schedule3['line4'] = toDollars(result.creditBreakdown.saversCredit);
    }
  }

  return forms;
}
