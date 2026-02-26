export const HELP_TEXTS: Record<string, { content: string; irsReference?: string }> = {
  // Filing Status
  filingStatus: {
    content:
      'Your filing status determines your tax brackets, standard deduction, and eligibility for certain credits.',
    irsReference: 'Form 1040',
  },

  // Personal Info
  'taxpayer.ssn': {
    content:
      'Your Social Security Number. Required for filing. This data never leaves your device.',
    irsReference: 'Form 1040',
  },
  'taxpayer.dateOfBirth': {
    content:
      'Used to determine age-related benefits like the additional standard deduction for taxpayers 65 or older.',
    irsReference: 'Form 1040',
  },
  'spouse.ssn': {
    content: "Your spouse's Social Security Number, required when filing jointly or separately.",
    irsReference: 'Form 1040',
  },

  // W-2 Fields
  'w2.employerName': {
    content: 'The name of the employer as shown on your W-2 form.',
    irsReference: 'W-2, Box c',
  },
  'w2.employerEIN': {
    content: "Your employer's Employer Identification Number. Found in Box b of your W-2.",
    irsReference: 'W-2, Box b',
  },
  'w2.wages': {
    content:
      'Box 1 on your W-2. Total taxable wages, salaries, and tips from this employer.',
    irsReference: 'W-2, Box 1',
  },
  'w2.federalWithheld': {
    content: 'Box 2 on your W-2. Federal income tax withheld by your employer.',
    irsReference: 'W-2, Box 2',
  },
  'w2.socialSecurityWages': {
    content:
      'Box 3 on your W-2. Total wages subject to Social Security tax. May differ from Box 1.',
    irsReference: 'W-2, Box 3',
  },
  'w2.socialSecurityWithheld': {
    content: 'Box 4 on your W-2. Social Security tax withheld (6.2% of Box 3).',
    irsReference: 'W-2, Box 4',
  },
  'w2.medicareWages': {
    content: 'Box 5 on your W-2. Total wages subject to Medicare tax.',
    irsReference: 'W-2, Box 5',
  },
  'w2.medicareWithheld': {
    content: 'Box 6 on your W-2. Medicare tax withheld (1.45% of Box 5).',
    irsReference: 'W-2, Box 6',
  },
  'w2.stateWages': {
    content: 'Box 16 on your W-2. State wages, tips, etc.',
    irsReference: 'W-2, Box 16',
  },
  'w2.stateWithheld': {
    content: 'Box 17 on your W-2. State income tax withheld.',
    irsReference: 'W-2, Box 17',
  },

  // 1099-INT
  '1099int.interest': {
    content:
      'Box 1 on your 1099-INT. Total interest income from this institution.',
    irsReference: '1099-INT, Box 1',
  },
  '1099int.earlyWithdrawalPenalty': {
    content:
      'Box 2 on your 1099-INT. Penalty for early withdrawal of savings, which is an above-the-line deduction.',
    irsReference: '1099-INT, Box 2',
  },

  // 1099-DIV
  '1099div.ordinaryDividends': {
    content:
      'Box 1a on your 1099-DIV. Total ordinary dividends, including qualified dividends.',
    irsReference: '1099-DIV, Box 1a',
  },
  '1099div.qualifiedDividends': {
    content:
      'Box 1b on your 1099-DIV. Qualified dividends taxed at lower capital gains rates.',
    irsReference: '1099-DIV, Box 1b',
  },
  '1099div.totalCapitalGain': {
    content:
      'Box 2a on your 1099-DIV. Total capital gain distributions from mutual funds.',
    irsReference: '1099-DIV, Box 2a',
  },

  // 1099-B / Capital Gains
  '1099b.description': {
    content: 'A short description of the security sold, e.g., "100 sh AAPL".',
    irsReference: 'Form 8949',
  },
  '1099b.dateAcquired': {
    content:
      'The date you acquired the security. Enter "VARIOUS" if acquired on multiple dates.',
    irsReference: '1099-B, Box 1b',
  },
  '1099b.dateSold': {
    content: 'The date the security was sold or disposed of.',
    irsReference: '1099-B, Box 1c',
  },
  '1099b.proceeds': {
    content: 'The total amount received from the sale.',
    irsReference: '1099-B, Box 1d',
  },
  '1099b.costBasis': {
    content:
      'Your cost or other basis in the security. If not reported by your broker, you may need to calculate it yourself.',
    irsReference: '1099-B, Box 1e',
  },

  // 1099-NEC
  '1099nec.nonemployeeCompensation': {
    content:
      'Box 1 on your 1099-NEC. Nonemployee compensation (freelance/contract income). Subject to self-employment tax.',
    irsReference: '1099-NEC, Box 1',
  },

  // Adjustments
  studentLoanInterest: {
    content:
      'Interest paid on qualified student loans, deductible up to $2,500. Phases out at higher incomes.',
    irsReference: 'Form 1040, Schedule 1, Line 21',
  },
  educatorExpenses: {
    content:
      'Unreimbursed educator expenses up to $300 for K-12 teachers, instructors, counselors, principals, or aides.',
    irsReference: 'Form 1040, Schedule 1, Line 11',
  },
  hsaDeduction: {
    content:
      'Contributions to a Health Savings Account. Limits: $4,300 (self-only) or $8,550 (family) for 2025.',
    irsReference: 'Form 8889',
  },
  iraDeduction: {
    content:
      'Contributions to a Traditional IRA that may be deductible depending on income and whether you have a workplace retirement plan.',
    irsReference: 'Form 1040, Schedule 1, Line 20',
  },
  estimatedTaxPayments: {
    content:
      'Total estimated tax payments you made for the tax year using Form 1040-ES.',
    irsReference: 'Form 1040, Line 26',
  },

  // Deductions
  standardDeduction: {
    content:
      'A fixed dollar amount that reduces your taxable income. The amount depends on your filing status and age.',
    irsReference: 'Form 1040, Line 12',
  },
  itemizedDeductions: {
    content:
      'If your eligible expenses exceed the standard deduction, you can itemize on Schedule A instead.',
    irsReference: 'Schedule A',
  },
  'itemized.medicalExpenses': {
    content:
      'Medical and dental expenses that exceed 7.5% of your adjusted gross income.',
    irsReference: 'Schedule A, Line 4',
  },
  'itemized.stateLocalTaxes': {
    content:
      'State and local income taxes or sales taxes paid. Your state/local taxes and real estate taxes are combined under the SALT cap: $10,000 maximum ($5,000 if MFS). Under the One Big Beautiful Bill Act (2025), the cap may be higher ($40,000) for incomes under the phase-down threshold.',
    irsReference: 'Schedule A, Line 5a',
  },
  'itemized.realEstateTaxes': {
    content:
      'Real estate taxes paid on property you own. Combined with state/local income or sales taxes under the SALT cap ($10,000 combined max, $5,000 if MFS). Enter the full amount — the cap is applied automatically.',
    irsReference: 'Schedule A, Line 5b',
  },
  'itemized.mortgageInterest': {
    content:
      'Interest paid on mortgage debt up to $750,000 ($375,000 if MFS) for your primary and secondary residences.',
    irsReference: 'Schedule A, Line 8a',
  },
  'itemized.charitableCash': {
    content:
      'Cash contributions to qualified charitable organizations. Limited to 60% of AGI.',
    irsReference: 'Schedule A, Line 12',
  },
  'itemized.charitableNonCash': {
    content:
      'Non-cash contributions (clothing, household items, etc.) to qualified organizations. Limited to 30% of AGI.',
    irsReference: 'Schedule A, Line 12',
  },

  // Credits
  childTaxCredit: {
    content:
      'Up to $2,000 per qualifying child under 17. Partially refundable up to $1,700.',
    irsReference: 'Form 1040, Schedule 8812',
  },
  childCareCreditExpenses: {
    content:
      'Expenses for the care of qualifying children under 13 or disabled dependents so you can work. Max $3,000 for one, $6,000 for two or more.',
    irsReference: 'Form 2441',
  },
  educationCredits: {
    content:
      'American Opportunity Credit (up to $2,500/student, first 4 years) or Lifetime Learning Credit (up to $2,000/return).',
    irsReference: 'Form 8863',
  },
  earnedIncomeCredit: {
    content:
      'A refundable credit for low- to moderate-income workers. Amount depends on income and number of qualifying children.',
    irsReference: 'Form 1040, Schedule EIC',
  },
  retirementSaversCredit: {
    content:
      "Credit for eligible contributions to IRAs or employer-sponsored retirement plans. Up to $1,000 ($2,000 if MFJ). Income limits apply.",
    irsReference: 'Form 8880',
  },

  // State
  stateOfResidence: {
    content:
      'The state where you lived on December 31 of the tax year. This determines your state tax obligations.',
  },

  // Capital Gains
  priorYearCapitalLossCarryforward: {
    content:
      'Capital losses from previous years that exceeded the $3,000 annual deduction limit. Found on your prior year Schedule D.',
    irsReference: 'Schedule D, Line 6 or 14',
  },

  // Direct Deposit
  'directDeposit.routingNumber': {
    content:
      'Your bank routing number (9 digits). Found on the bottom left of your checks or in your banking app.',
    irsReference: 'Form 1040, Line 35b',
  },
  'directDeposit.accountNumber': {
    content:
      'Your bank account number. Found on the bottom of your checks, between the routing number and check number.',
    irsReference: 'Form 1040, Line 35c',
  },
};
