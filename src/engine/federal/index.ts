// Federal Tax Engine — Main Orchestrator
// Wires all modules together in dependency order to compute a complete TaxResult.
//
// Computation flow:
//   1. Self-employment (Schedule C + SE tax) → halfSETaxDeduction
//   2. Income aggregation → total income (with capital gains)
//   3. Adjustments + AGI
//   4. Deductions (standard vs itemized)
//   5. QBI deduction → taxable income
//   6. Tax computation (QDCG worksheet or ordinary rates)
//   7. AMT
//   8. Credits (nonrefundable + refundable)
//   9. Additional Medicare Tax + NIIT
//   10. Total tax, payments, refund/owed
//   11. Form field mappings
//
// All monetary values are integers in CENTS.

import type {
  TaxInput,
  TaxResult,
  FederalConfig,
  IncomeBreakdown,
  TaxBreakdown,
  CreditBreakdown,
  CapitalGainsResult,
  SelfEmploymentResult,
} from '../types';

import { computeTotalIncome, computeAdjustments } from './income';
import { computeDeductions } from './deductions';
import { computeCapitalGains } from './capital-gains';
import {
  computeOrdinaryTax,
  getMarginalRate,
  computeQualifiedDividendAndCapGainTax,
} from './brackets';
import {
  computeScheduleC,
  computeSelfEmploymentTax,
  computeQBIDeduction,
} from './self-employment';
import { computeAllCredits } from './credits';
import { computeAMT } from './amt';
import { computeNIIT, computeInvestmentIncome } from './niit';
import { generateFormMappings } from './forms';

/**
 * Sum all federal withholding from income documents.
 */
function computeTotalWithholding(input: TaxInput): number {
  let total = 0;
  total += input.w2s.reduce((sum, w2) => sum + w2.federalWithheld, 0);
  total += input.form1099INTs.reduce((sum, f) => sum + (f.federalWithheld ?? 0), 0);
  total += input.form1099DIVs.reduce((sum, f) => sum + (f.federalWithheld ?? 0), 0);
  total += input.form1099NECs.reduce((sum, f) => sum + (f.federalWithheld ?? 0), 0);
  total += input.form1099Gs.reduce((sum, f) => sum + (f.federalWithheld ?? 0), 0);
  total += input.form1099Rs.reduce((sum, f) => sum + (f.federalWithheld ?? 0), 0);
  return total;
}

/**
 * Compute a complete federal tax return.
 *
 * This is the main entry point for the federal tax engine.
 * Takes a TaxInput with all income documents and returns a fully populated TaxResult.
 */
export function computeFederalTax(input: TaxInput, config: FederalConfig): TaxResult {
  // ══════════════════════════════════════════════════════════════════════════
  // Phase 1: Self-Employment (needed early for halfSETaxDeduction adjustment)
  // ══════════════════════════════════════════════════════════════════════════

  const scheduleCResult = input.scheduleCData
    ? computeScheduleC(input.scheduleCData, config)
    : { netProfit: 0, homeOfficeDeduction: 0 };

  const w2SSWages = input.w2s.reduce((sum, w2) => sum + w2.socialSecurityWages, 0);

  const seTaxResult = computeSelfEmploymentTax(
    scheduleCResult.netProfit,
    w2SSWages,
    input.filingStatus,
    config,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 2: Capital Gains (1099-B + 1099-DIV capital gain distributions)
  // ══════════════════════════════════════════════════════════════════════════

  const rawCapGains = computeCapitalGains(
    input.form1099Bs,
    input.priorYearCapitalLossCarryforward ?? 0,
    input.filingStatus,
    config,
  );

  // 1099-DIV capital gain distributions (Box 2a) are long-term gains not
  // included in the 1099-B capital gains module. Add them here.
  const capGainFromDIV = input.form1099DIVs.reduce(
    (sum, f) => sum + f.totalCapitalGain, 0,
  );
  const section1250FromDIV = input.form1099DIVs.reduce(
    (sum, f) => sum + (f.section1250Gain ?? 0), 0,
  );
  const collectiblesFromDIV = input.form1099DIVs.reduce(
    (sum, f) => sum + (f.collectiblesGain ?? 0), 0,
  );

  // Adjust capital gains to include 1099-DIV distributions
  const adjustedNetLT = rawCapGains.netLongTerm + capGainFromDIV;
  const adjustedNetCapGainLoss = rawCapGains.netShortTerm + adjustedNetLT;

  // Re-apply loss limitation on adjusted net
  const lossLimit = config.capitalLossLimit[input.filingStatus];
  let finalDeductibleLoss = 0;
  let finalCarryforward = 0;

  if (adjustedNetCapGainLoss < 0) {
    const absLoss = Math.abs(adjustedNetCapGainLoss);
    finalDeductibleLoss = -Math.min(absLoss, lossLimit);
    finalCarryforward = Math.max(0, absLoss - lossLimit);
  }

  const capitalGainsResult: CapitalGainsResult = {
    ...rawCapGains,
    longTermGains: rawCapGains.longTermGains + capGainFromDIV,
    netLongTerm: adjustedNetLT,
    netCapitalGainLoss: adjustedNetCapGainLoss,
    deductibleLoss: finalDeductibleLoss,
    carryforwardLoss: finalCarryforward,
    collectiblesGain: rawCapGains.collectiblesGain + collectiblesFromDIV,
    section1250Gain: rawCapGains.section1250Gain + section1250FromDIV,
  };

  // Amount to add to total income: full gain if positive, limited loss if negative
  const capGainForIncome = adjustedNetCapGainLoss >= 0
    ? adjustedNetCapGainLoss
    : finalDeductibleLoss;

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 3: Income & AGI
  // ══════════════════════════════════════════════════════════════════════════

  // Base income from income.ts (wages, interest, dividends, NEC, unemployment,
  // retirement, Schedule C net, other). Does NOT include capital gains.
  const baseIncome = computeTotalIncome(input);
  const totalIncome = baseIncome + capGainForIncome;

  // Adjustments use totalIncome for phase-out calculations
  const adjustments = computeAdjustments(
    input, totalIncome, seTaxResult.halfSETaxDeduction, config,
  );
  const agi = totalIncome - adjustments;

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 4: Deductions
  // ══════════════════════════════════════════════════════════════════════════

  const deductionBreakdown = computeDeductions(
    input.filingStatus,
    agi,
    input.useItemizedDeductions,
    input.itemizedDeductions,
    config,
    input.taxpayerAge65OrOlder ?? false,
    input.taxpayerBlind ?? false,
    input.spouseAge65OrOlder ?? false,
    input.spouseBlind ?? false,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 5: QBI Deduction & Taxable Income
  // ══════════════════════════════════════════════════════════════════════════

  const taxableIncomeBeforeQBI = Math.max(0, agi - deductionBreakdown.amount);

  // QBI = Schedule C net profit (only if positive)
  const qbi = Math.max(0, scheduleCResult.netProfit);
  const qbiDeduction = computeQBIDeduction(
    qbi, taxableIncomeBeforeQBI, input.filingStatus, config,
  );

  const taxableIncome = Math.max(0, taxableIncomeBeforeQBI - qbiDeduction);

  // Assemble SelfEmploymentResult
  const selfEmploymentResult: SelfEmploymentResult | undefined = input.scheduleCData
    ? {
        scheduleCNetProfit: scheduleCResult.netProfit,
        homeOfficeDeduction: scheduleCResult.homeOfficeDeduction,
        seTaxableIncome: seTaxResult.seTaxableIncome,
        socialSecurityTax: seTaxResult.socialSecurityTax,
        medicareTax: seTaxResult.medicareTax,
        totalSETax: seTaxResult.totalSETax,
        halfSETaxDeduction: seTaxResult.halfSETaxDeduction,
        qbiDeduction,
      }
    : undefined;

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 6: Tax Computation (Line 16)
  // ══════════════════════════════════════════════════════════════════════════

  const qualifiedDividends = input.form1099DIVs.reduce(
    (sum, f) => sum + f.qualifiedDividends, 0,
  );
  const netLTCG = Math.max(0, adjustedNetLT);
  const totalPreferential = qualifiedDividends + netLTCG;

  let ordinaryIncomeTax: number;
  let capitalGainsTax: number;

  if (totalPreferential > 0 && taxableIncome > 0) {
    // Use the Qualified Dividends and Capital Gain Tax Worksheet
    const qdcgTax = computeQualifiedDividendAndCapGainTax({
      taxableIncome,
      ordinaryIncome: Math.max(0, taxableIncome - totalPreferential),
      qualifiedDividends,
      netLTCG,
      collectiblesGain: capitalGainsResult.collectiblesGain,
      section1250Gain: capitalGainsResult.section1250Gain,
      filingStatus: input.filingStatus,
      config,
    });

    // Split: ordinary portion at ordinary rates, remainder is capital gains tax
    const taxOnOrdinaryPortion = computeOrdinaryTax(
      Math.max(0, taxableIncome - totalPreferential),
      input.filingStatus,
      config,
    );
    ordinaryIncomeTax = taxOnOrdinaryPortion;
    capitalGainsTax = qdcgTax - taxOnOrdinaryPortion;
  } else {
    ordinaryIncomeTax = computeOrdinaryTax(taxableIncome, input.filingStatus, config);
    capitalGainsTax = 0;
  }

  const line16Tax = ordinaryIncomeTax + capitalGainsTax;

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 7: AMT
  // ══════════════════════════════════════════════════════════════════════════

  const amt = computeAMT(
    {
      taxableIncome,
      itemizedSALT: deductionBreakdown.itemizedDetails?.saltCapped ?? 0,
      regularTax: line16Tax,
      filingStatus: input.filingStatus,
      usedItemized: deductionBreakdown.type === 'itemized',
    },
    config,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 8: Credits
  // ══════════════════════════════════════════════════════════════════════════

  const taxLiabilityForCredits = line16Tax + amt;
  const wages = input.w2s.reduce((sum, w2) => sum + w2.wages, 0);
  const necIncome = input.form1099NECs.reduce(
    (sum, f) => sum + f.nonemployeeCompensation, 0,
  );
  const earnedIncome = wages + Math.max(0, scheduleCResult.netProfit) + necIncome;
  const investmentIncome = computeInvestmentIncome(input);

  // Simplification: use CTC-qualifying children count for EITC
  // (EITC qualifying extends to under 19, or under 24 if student)
  const numQualifyingChildrenForEITC = input.dependents.filter(
    d => d.qualifiesForCTC,
  ).length;

  const credits = computeAllCredits({
    dependents: input.dependents,
    agi,
    filingStatus: input.filingStatus,
    taxLiability: taxLiabilityForCredits,
    earnedIncome,
    investmentIncome,
    numQualifyingChildrenForEITC,
    childCareExpenses: input.childCareCreditExpenses ?? 0,
    numChildCareQualifying: input.dependents.filter(
      d => d.qualifiesForCTC || d.qualifiesForODC,
    ).length,
    educationExpenses: input.educationExpenses,
    saversContributions: input.retirementSaversCredit?.contributions ?? 0,
    config,
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 9: Additional Medicare Tax
  // ══════════════════════════════════════════════════════════════════════════

  const w2MedicareWages = input.w2s.reduce(
    (sum, w2) => sum + w2.medicareWages, 0,
  );
  const combinedMedicareEarnings = w2MedicareWages + seTaxResult.seTaxableIncome;
  const additionalMedicareThreshold =
    config.medicare.additionalThreshold[input.filingStatus];
  const additionalMedicareTax = Math.round(
    Math.max(0, combinedMedicareEarnings - additionalMedicareThreshold) *
      config.medicare.additionalRate,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 10: NIIT
  // ══════════════════════════════════════════════════════════════════════════

  const niit = computeNIIT(
    { magi: agi, investmentIncome, filingStatus: input.filingStatus },
    config,
  );

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 11: Total Tax
  // ══════════════════════════════════════════════════════════════════════════

  // Form 1040 Lines 16-24:
  // Line 16: Tax (from QDCG worksheet or tax table)
  // Line 17: AMT
  // Line 18: Line 16 + Line 17
  // Line 19: Nonrefundable credits
  // Line 21: max(0, Line 18 - Line 19)
  // Line 23: Other taxes (SE + Additional Medicare + NIIT) from Schedule 2 Part II
  // Line 24: Total tax = Line 21 + Line 23
  const selfEmploymentTax = seTaxResult.totalSETax;
  const afterAMT = line16Tax + amt;
  const afterCredits = Math.max(0, afterAMT - credits.nonrefundable);
  const otherTaxes = selfEmploymentTax + additionalMedicareTax + niit;
  const totalTax = afterCredits + otherTaxes;

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 12: Payments & Refund/Owed
  // ══════════════════════════════════════════════════════════════════════════

  const federalWithholding = computeTotalWithholding(input);
  const totalPayments = federalWithholding + input.estimatedTaxPayments;
  const refundOrOwed = totalPayments + credits.refundable - totalTax;

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 13: Rates
  // ══════════════════════════════════════════════════════════════════════════

  const effectiveTaxRate =
    totalIncome > 0
      ? Math.round((totalTax / totalIncome) * 10000) / 100
      : 0;

  const marginalRate = getMarginalRate(taxableIncome, input.filingStatus, config);
  const marginalTaxRate = Math.round(marginalRate * 10000) / 100;

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 14: Breakdowns
  // ══════════════════════════════════════════════════════════════════════════

  const interest = input.form1099INTs.reduce(
    (sum, f) => sum + f.interest - (f.taxExemptInterest ?? 0), 0,
  );
  const ordinaryDividends = input.form1099DIVs.reduce(
    (sum, f) => sum + f.ordinaryDividends, 0,
  );
  const unemployment = input.form1099Gs.reduce(
    (sum, f) => sum + f.unemployment, 0,
  );
  const retirementDistributions = input.form1099Rs.reduce(
    (sum, f) => sum + f.taxableAmount, 0,
  );

  const incomeBreakdown: IncomeBreakdown = {
    wages,
    interest,
    ordinaryDividends,
    qualifiedDividends,
    shortTermCapitalGains: rawCapGains.netShortTerm,
    longTermCapitalGains: adjustedNetLT,
    selfEmploymentIncome: scheduleCResult.netProfit + necIncome,
    unemployment,
    retirementDistributions,
    otherIncome: input.otherIncome ?? 0,
  };

  const taxBreakdown: TaxBreakdown = {
    ordinaryIncomeTax,
    capitalGainsTax,
    selfEmploymentTax,
    additionalMedicareTax,
    netInvestmentIncomeTax: niit,
    amt,
  };

  const creditBreakdown: CreditBreakdown = {
    childTaxCredit: credits.childTaxCredit,
    additionalChildTaxCredit: credits.additionalChildTaxCredit,
    otherDependentCredit: credits.otherDependentCredit,
    earnedIncomeCredit: credits.earnedIncomeCredit,
    childCareCareCredit: credits.childCareCareCredit,
    educationCredits: credits.educationCredits,
    saversCredit: credits.saversCredit,
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 15: Schedule Flags
  // ══════════════════════════════════════════════════════════════════════════

  const needsSchedule1 =
    scheduleCResult.netProfit !== 0 ||
    necIncome > 0 ||
    unemployment > 0 ||
    (input.otherIncome ?? 0) !== 0 ||
    adjustments > 0 ||
    capGainFromDIV > 0 ||
    capitalGainsResult.netCapitalGainLoss !== 0;

  const needsSchedule2 =
    amt > 0 || selfEmploymentTax > 0 || additionalMedicareTax > 0 || niit > 0;

  const needsSchedule3 =
    credits.educationCredits > 0 ||
    credits.saversCredit > 0 ||
    credits.childCareCareCredit > 0;

  const needsScheduleA = deductionBreakdown.type === 'itemized';
  const needsScheduleB = interest > 150000 || ordinaryDividends > 150000;
  const needsScheduleC = !!input.scheduleCData;
  const needsScheduleD =
    input.form1099Bs.length > 0 || capGainFromDIV > 0;
  const needsScheduleSE = seTaxResult.totalSETax > 0;
  const needsForm8949 = input.form1099Bs.length > 0;
  const needsForm8959 = additionalMedicareTax > 0;
  const needsForm8960 = niit > 0;

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 16: Assemble Result
  // ══════════════════════════════════════════════════════════════════════════

  const result: TaxResult = {
    totalIncome,
    adjustedGrossIncome: agi,
    taxableIncome,
    totalTax,
    totalCredits: credits.nonrefundable + credits.refundable,
    totalPayments,
    refundOrOwed,
    effectiveTaxRate,
    marginalTaxRate,

    incomeBreakdown,
    deductionBreakdown,
    taxBreakdown,
    creditBreakdown,
    capitalGainsResult,
    selfEmploymentResult,

    // Placeholder — populated below
    forms: { f1040: {} },

    needsSchedule1,
    needsSchedule2,
    needsSchedule3,
    needsScheduleA,
    needsScheduleB,
    needsScheduleC,
    needsScheduleD,
    needsScheduleSE,
    needsForm8949,
    needsForm8959,
    needsForm8960,

    stateResults: {},
  };

  // Generate form field mappings (needs the mostly-complete result)
  result.forms = generateFormMappings(input, result);

  return result;
}

// Re-export individual modules for direct access
export { computeTotalIncome, computeAdjustments, computeAGI } from './income';
export { computeStandardDeduction, computeSaltCap, computeItemizedDeductions, computeDeductions } from './deductions';
export { computeCapitalGains, categorizeTransactions } from './capital-gains';
export { computeOrdinaryTax, getMarginalRate, computeQualifiedDividendAndCapGainTax } from './brackets';
export { computeScheduleC, computeSelfEmploymentTax, computeQBIDeduction, computeSelfEmployment } from './self-employment';
export { computeChildTaxCredit, computeOtherDependentCredit, computeChildCareCredit, computeEITC, computeEducationCredits, computeSaversCredit, computeAllCredits } from './credits';
export { computeAMT } from './amt';
export { computeNIIT, computeInvestmentIncome } from './niit';
export { generateFormMappings } from './forms';
