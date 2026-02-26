// Federal Form Field Mapping
// Maps computed TaxResult values to IRS form field names/numbers for PDF generation.
// References: IRS Form 1040 (2025), Schedules 1–SE, Forms 8949/8959/8960

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

  // Filing status — IRS Form 1040 uses separate checkboxes per status
  fields['filingStatusSingle'] = input.filingStatus === 'single' ? 'X' : '';
  fields['filingStatusMFJ'] = input.filingStatus === 'married_filing_jointly' ? 'X' : '';
  fields['filingStatusMFS'] = input.filingStatus === 'married_filing_separately' ? 'X' : '';
  fields['filingStatusHoH'] = input.filingStatus === 'head_of_household' ? 'X' : '';
  fields['filingStatusQSS'] = input.filingStatus === 'qualifying_surviving_spouse' ? 'X' : '';

  // Spouse info
  if (input.spouse) {
    fields['spouseFirstName'] = input.spouse.firstName;
    fields['spouseLastName'] = input.spouse.lastName;
    fields['spouseSSN'] = formatSSN(input.spouse.ssn);
  }

  // Dependents (IRS form has separate first name / last name columns)
  input.dependents.forEach((dep, i) => {
    fields[`dependent${i + 1}_firstName`] = dep.firstName;
    fields[`dependent${i + 1}_lastName`] = dep.lastName;
    fields[`dependent${i + 1}_ssn`] = dep.ssn;
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
  // Line 7: Capital gain or loss (only if there are actual capital gains/losses)
  // Note: Line 7 has no fillable text field on the 2025 f1040.pdf — value goes on Schedule D.
  // We still generate the field for completeness / other form consumers.
  const cgDeductibleLoss = result.capitalGainsResult?.deductibleLoss ?? 0;
  const cgNetGainLoss = result.capitalGainsResult?.netCapitalGainLoss ?? 0;
  if (cgDeductibleLoss !== 0 || cgNetGainLoss !== 0) {
    const netCapGain = cgDeductibleLoss !== 0
      ? -toDollars(Math.abs(cgDeductibleLoss))
      : toDollars(cgNetGainLoss);
    fields['line7'] = netCapGain;
  }
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
  // Line 25a: W-2 withholding (for the 25a sub-line on the form)
  const w2Withholding = input.w2s.reduce((sum, w2) => sum + w2.federalWithheld, 0);
  fields['line25a'] = toDollars(w2Withholding);
  // Line 25: Total federal withholding (Line 25d = sum of 25a through 25c)
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
 * Generate Schedule B field mappings (Interest and Ordinary Dividends).
 * Part I: Interest payer names and amounts.
 * Part II: Dividend payer names and amounts.
 * Ref: IRS Schedule B (Form 1040)
 */
function mapScheduleB(input: TaxInput, result: TaxResult): Record<string, string | number> {
  const fields: Record<string, string | number> = {};

  // Part I: Interest
  input.form1099INTs.forEach((f, i) => {
    fields[`interest_payer_${i + 1}`] = f.payerName;
    fields[`interest_amount_${i + 1}`] = toDollars(f.interest);
  });
  fields['totalInterest'] = toDollars(result.incomeBreakdown.interest);

  // Part II: Dividends
  input.form1099DIVs.forEach((f, i) => {
    fields[`dividend_payer_${i + 1}`] = f.payerName;
    fields[`dividend_amount_${i + 1}`] = toDollars(f.ordinaryDividends);
  });
  fields['totalDividends'] = toDollars(result.incomeBreakdown.ordinaryDividends);

  return fields;
}

/**
 * Generate Schedule C field mappings (Profit or Loss From Business).
 * Should only be called when scheduleCData exists.
 * Ref: IRS Schedule C (Form 1040)
 */
function mapScheduleC(input: TaxInput, result: TaxResult): Record<string, string | number> {
  const fields: Record<string, string | number> = {};
  const data = input.scheduleCData!;
  const seResult = result.selfEmploymentResult!;

  // Header
  fields['businessName'] = data.businessName;
  fields['businessCode'] = data.businessCode;

  // Income
  fields['grossReceipts'] = toDollars(data.grossReceipts);
  if (data.costOfGoodsSold) {
    fields['costOfGoodsSold'] = toDollars(data.costOfGoodsSold);
  }
  fields['grossIncome'] = toDollars(
    data.grossReceipts - (data.costOfGoodsSold ?? 0),
  );
  if (data.otherIncome) {
    fields['otherIncome'] = toDollars(data.otherIncome);
  }

  // Expenses
  const expenses = data.expenses;
  if (expenses.advertising) fields['advertising'] = toDollars(expenses.advertising);
  if (expenses.carAndTruck) fields['carAndTruck'] = toDollars(expenses.carAndTruck);
  if (expenses.commissions) fields['commissions'] = toDollars(expenses.commissions);
  if (expenses.insurance) fields['insurance'] = toDollars(expenses.insurance);
  if (expenses.legalAndProfessional) fields['legalAndProfessional'] = toDollars(expenses.legalAndProfessional);
  if (expenses.officeExpenses) fields['officeExpenses'] = toDollars(expenses.officeExpenses);
  if (expenses.supplies) fields['supplies'] = toDollars(expenses.supplies);
  if (expenses.utilities) fields['utilities'] = toDollars(expenses.utilities);
  if (expenses.otherExpenses) fields['otherExpenses'] = toDollars(expenses.otherExpenses);

  const totalExpenses =
    (expenses.advertising ?? 0) + (expenses.carAndTruck ?? 0) +
    (expenses.commissions ?? 0) + (expenses.insurance ?? 0) +
    (expenses.legalAndProfessional ?? 0) + (expenses.officeExpenses ?? 0) +
    (expenses.supplies ?? 0) + (expenses.utilities ?? 0) +
    (expenses.otherExpenses ?? 0);
  fields['totalExpenses'] = toDollars(totalExpenses);

  // Net profit
  fields['netProfit'] = toDollars(seResult.scheduleCNetProfit);

  // Home office
  if (seResult.homeOfficeDeduction > 0) {
    fields['homeOfficeDeduction'] = toDollars(seResult.homeOfficeDeduction);
  }

  return fields;
}

/**
 * Generate Schedule D field mappings (Capital Gains and Losses).
 * Ref: IRS Schedule D (Form 1040)
 */
function mapScheduleD(_input: TaxInput, result: TaxResult): Record<string, string | number> {
  const fields: Record<string, string | number> = {};
  const cg = result.capitalGainsResult;

  // Part I: Short-Term
  fields['shortTermGainLoss'] = toDollars(cg.netShortTerm);

  // Part II: Long-Term
  fields['longTermGainLoss'] = toDollars(cg.netLongTerm);

  // Part III: Summary
  fields['netGainLoss'] = toDollars(cg.netCapitalGainLoss);

  if (cg.deductibleLoss !== 0) {
    fields['deductibleLoss'] = toDollars(cg.deductibleLoss);
  }
  if (cg.carryforwardLoss > 0) {
    fields['carryforward'] = toDollars(cg.carryforwardLoss);
  }

  return fields;
}

/**
 * Generate Schedule SE field mappings (Self-Employment Tax).
 * Ref: IRS Schedule SE (Form 1040)
 */
function mapScheduleSE(_input: TaxInput, result: TaxResult): Record<string, string | number> {
  const fields: Record<string, string | number> = {};
  const se = result.selfEmploymentResult!;

  fields['netEarnings'] = toDollars(se.seTaxableIncome);
  fields['socialSecurityTax'] = toDollars(se.socialSecurityTax);
  fields['medicareTax'] = toDollars(se.medicareTax);
  fields['totalSETax'] = toDollars(se.totalSETax);
  fields['deductibleHalf'] = toDollars(se.halfSETaxDeduction);

  return fields;
}

/**
 * Generate Form 8949 field mappings (Sales and Other Dispositions of Capital Assets).
 * Returns an ARRAY of records (one per transaction).
 * Ref: IRS Form 8949
 */
function mapForm8949(input: TaxInput, _result: TaxResult): Record<string, string | number>[] {
  return input.form1099Bs.map((tx) => ({
    description: tx.description,
    dateAcquired: tx.dateAcquired,
    dateSold: tx.dateSold,
    proceeds: toDollars(tx.proceeds),
    basis: toDollars(tx.costBasis),
    gainLoss: toDollars(tx.gainLoss),
    category: tx.category,
  }));
}

/**
 * Generate Form 8959 field mappings (Additional Medicare Tax).
 * Ref: IRS Form 8959
 */
function mapForm8959(input: TaxInput, result: TaxResult): Record<string, string | number> {
  const fields: Record<string, string | number> = {};

  // Medicare wages from all W-2s (Box 5)
  const medicareWages = input.w2s.reduce((sum, w2) => sum + w2.medicareWages, 0);
  fields['medicareWages'] = toDollars(medicareWages);

  // Threshold (filing-status dependent — stored in config, but we get from breakdown)
  // The threshold is implied by the additional medicare tax amount.
  // We derive: excess = wages - threshold, tax = excess * 0.009
  // For display: show the tax amount
  fields['additionalMedicareTax'] = toDollars(result.taxBreakdown.additionalMedicareTax);

  // Self-employment Medicare wages if applicable
  if (result.selfEmploymentResult) {
    fields['selfEmploymentMedicareWages'] = toDollars(result.selfEmploymentResult.seTaxableIncome);
  }

  // Combined wages for threshold computation
  const combinedWages = medicareWages + (result.selfEmploymentResult?.seTaxableIncome ?? 0);
  fields['combinedMedicareWages'] = toDollars(combinedWages);

  // Withholding from W-2 (Medicare withholding already paid)
  const w2MedicareWithheld = input.w2s.reduce((sum, w2) => sum + w2.medicareWithheld, 0);
  fields['w2MedicareWithheld'] = toDollars(w2MedicareWithheld);

  return fields;
}

/**
 * Generate Form 8960 field mappings (Net Investment Income Tax).
 * Ref: IRS Form 8960
 */
function mapForm8960(input: TaxInput, result: TaxResult): Record<string, string | number> {
  const fields: Record<string, string | number> = {};

  // Investment income components
  const interestIncome = input.form1099INTs.reduce((sum, f) => sum + f.interest, 0);
  const dividendIncome = input.form1099DIVs.reduce((sum, f) => sum + f.ordinaryDividends, 0);
  const capitalGains = Math.max(0, result.capitalGainsResult.netCapitalGainLoss);

  fields['interestIncome'] = toDollars(interestIncome);
  fields['dividendIncome'] = toDollars(dividendIncome);
  fields['capitalGainsIncome'] = toDollars(capitalGains);

  const totalInvestmentIncome = interestIncome + dividendIncome + capitalGains + (input.otherIncome ?? 0);
  fields['totalInvestmentIncome'] = toDollars(totalInvestmentIncome);

  // MAGI (same as AGI for most filers)
  fields['magi'] = toDollars(result.adjustedGrossIncome);

  // NIIT amount
  fields['niitAmount'] = toDollars(result.taxBreakdown.netInvestmentIncomeTax);

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

  // Schedule B (Interest and Dividends)
  if (result.needsScheduleB) {
    forms.scheduleB = mapScheduleB(input, result);
  }

  // Schedule C (Business Income / Self-Employment)
  if (result.needsScheduleC && input.scheduleCData && result.selfEmploymentResult) {
    forms.scheduleC = mapScheduleC(input, result);
  }

  // Schedule D (Capital Gains and Losses)
  if (result.needsScheduleD) {
    forms.scheduleD = mapScheduleD(input, result);
  }

  // Schedule SE (Self-Employment Tax)
  if (result.needsScheduleSE && result.selfEmploymentResult) {
    forms.scheduleSE = mapScheduleSE(input, result);
  }

  // Form 8949 (Sales of Capital Assets)
  if (result.needsForm8949) {
    forms.f8949 = mapForm8949(input, result);
  }

  // Form 8959 (Additional Medicare Tax)
  if (result.needsForm8959) {
    forms.f8959 = mapForm8959(input, result);
  }

  // Form 8960 (Net Investment Income Tax)
  if (result.needsForm8960) {
    forms.f8960 = mapForm8960(input, result);
  }

  return forms;
}
