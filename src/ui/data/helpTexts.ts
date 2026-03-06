export const HELP_TEXTS: Record<string, { content: string; irsReference?: string }> = {
  // ── Filing Status ──
  filingStatus: {
    content:
      'Your filing status determines your tax brackets, standard deduction, and eligibility for certain credits. Most single people choose "Single" and most married couples choose "Married Filing Jointly."',
    irsReference: 'Form 1040',
  },

  // ── Personal Info: Taxpayer ──
  'taxpayer.firstName': {
    content: 'Your legal first name exactly as it appears on your Social Security card.',
    irsReference: 'Form 1040',
  },
  'taxpayer.lastName': {
    content: 'Your legal last name exactly as it appears on your Social Security card.',
    irsReference: 'Form 1040',
  },
  'taxpayer.ssn': {
    content:
      'Your Social Security Number, required for filing. This data never leaves your device — it is only used to fill your PDF forms locally.',
    irsReference: 'Form 1040',
  },
  'taxpayer.dateOfBirth': {
    content:
      'Used to check if you qualify for the extra standard deduction for taxpayers 65 or older (born before Jan 2, 1961 for 2025).',
    irsReference: 'Form 1040',
  },
  taxpayerAge65OrOlder: {
    content:
      'Check this if you were 65 or older on January 1 of next year. You get a larger standard deduction — an extra $1,850 (single/HOH) or $1,550 (married).',
    irsReference: 'Form 1040',
  },
  taxpayerBlind: {
    content:
      'Check this if you are legally blind. You get the same extra standard deduction as taxpayers 65+.',
    irsReference: 'Form 1040',
  },

  // ── Personal Info: Spouse ──
  'spouse.firstName': {
    content: "Your spouse's legal first name as on their Social Security card.",
    irsReference: 'Form 1040',
  },
  'spouse.lastName': {
    content: "Your spouse's legal last name as on their Social Security card.",
    irsReference: 'Form 1040',
  },
  'spouse.ssn': {
    content: "Your spouse's Social Security Number, required when filing jointly or separately.",
    irsReference: 'Form 1040',
  },
  'spouse.dateOfBirth': {
    content:
      'Used to check if your spouse qualifies for the extra standard deduction for taxpayers 65+.',
    irsReference: 'Form 1040',
  },
  spouseAge65OrOlder: {
    content:
      'Check if your spouse was 65+ on Jan 1 of next year. Adds to the standard deduction.',
    irsReference: 'Form 1040',
  },
  spouseBlind: {
    content: 'Check if your spouse is legally blind. Adds to the standard deduction.',
    irsReference: 'Form 1040',
  },

  // ── Personal Info: Address ──
  'address.street': {
    content: 'Your current mailing address where the IRS should send any correspondence.',
    irsReference: 'Form 1040',
  },
  'address.city': {
    content: 'City of your mailing address.',
    irsReference: 'Form 1040',
  },
  'address.state': {
    content: 'State of your mailing address.',
    irsReference: 'Form 1040',
  },
  'address.zip': {
    content: '5-digit ZIP code of your mailing address.',
    irsReference: 'Form 1040',
  },

  // ── Personal Info: Dependents ──
  'dependent.firstName': {
    content: "Dependent's legal first name as on their Social Security card.",
  },
  'dependent.lastName': {
    content: "Dependent's legal last name as on their Social Security card.",
  },
  'dependent.ssn': {
    content:
      "Dependent's Social Security Number. Required to claim them on your return and receive the Child Tax Credit.",
    irsReference: 'Form 1040',
  },
  'dependent.dateOfBirth': {
    content:
      'Used to check if they qualify for the Child Tax Credit (must be under 17 at end of tax year).',
    irsReference: 'Schedule 8812',
  },
  'dependent.relationship': {
    content:
      'How this person is related to you — child, stepchild, foster child, sibling, parent, or other qualifying relative.',
    irsReference: 'Form 1040',
  },
  'dependent.monthsLivedWithYou': {
    content:
      'Must have lived with you for more than half the year (6+ months) to count as a qualifying dependent.',
    irsReference: 'Form 1040',
  },
  'dependent.isStudent': {
    content:
      'Check if they were a full-time student for at least 5 months during the year. This extends the dependent age limit from 19 to 24.',
    irsReference: 'Form 1040',
  },
  'dependent.isDisabled': {
    content:
      'Check if permanently and totally disabled. There is no age limit for claiming a disabled dependent.',
    irsReference: 'Form 1040',
  },

  // ── W-2 Income ──
  'w2.employerName': {
    content:
      'The name of the company or organization that employed you, as shown on your W-2.',
    irsReference: 'W-2, Box c',
  },
  'w2.employerEIN': {
    content:
      "Your employer's 9-digit Employer Identification Number. Found in Box b of your W-2 (format: XX-XXXXXXX).",
    irsReference: 'W-2, Box b',
  },
  'w2.wages': {
    content:
      'The total amount your employer paid you in wages, salary, and tips before deductions. This is the main number that determines your income tax. (W-2 Box 1)',
    irsReference: 'W-2, Box 1',
  },
  'w2.federalWithheld': {
    content:
      'Federal income tax your employer already withheld from your paychecks throughout the year. This counts toward what you owe — if too much was withheld, you get a refund. (W-2 Box 2)',
    irsReference: 'W-2, Box 2',
  },
  'w2.socialSecurityWages': {
    content:
      'Wages subject to Social Security tax. May differ from Box 1 because some pre-tax deductions (like 401k) reduce income tax wages but not Social Security wages. (W-2 Box 3)',
    irsReference: 'W-2, Box 3',
  },
  'w2.socialSecurityWithheld': {
    content:
      'Social Security tax your employer withheld — 6.2% of Box 3, up to the annual wage cap ($176,100 for 2025). (W-2 Box 4)',
    irsReference: 'W-2, Box 4',
  },
  'w2.medicareWages': {
    content:
      'Wages subject to Medicare tax. Usually the same as or higher than Box 1. (W-2 Box 5)',
    irsReference: 'W-2, Box 5',
  },
  'w2.medicareWithheld': {
    content:
      'Medicare tax your employer withheld — 1.45% of Box 5, with no wage cap. High earners pay an additional 0.9%. (W-2 Box 6)',
    irsReference: 'W-2, Box 6',
  },
  'w2.stateCode': {
    content: 'The state where you worked for this employer. (W-2 Box 15)',
    irsReference: 'W-2, Box 15',
  },
  'w2.stateWages': {
    content:
      'Wages subject to state income tax. Often the same as Box 1 but may differ. (W-2 Box 16)',
    irsReference: 'W-2, Box 16',
  },
  'w2.stateWithheld': {
    content:
      'State income tax your employer withheld from your paychecks. (W-2 Box 17)',
    irsReference: 'W-2, Box 17',
  },
  'w2.localWages': {
    content:
      'Wages subject to local/city tax (e.g., New York City). Only needed if you work in a city with local income tax. (W-2 Box 18)',
    irsReference: 'W-2, Box 18',
  },
  'w2.localWithheld': {
    content: 'Local/city income tax withheld by your employer. (W-2 Box 19)',
    irsReference: 'W-2, Box 19',
  },
  'w2.locality': {
    content:
      "Name of the local tax jurisdiction, e.g., 'NYC' or 'Yonkers'. (W-2 Box 20)",
    irsReference: 'W-2, Box 20',
  },
  'w2.box14Code': {
    content:
      'Special deduction codes from your employer. Common NY codes: 414H (pension contribution), NYPFL (paid family leave), IRC 125 (pre-tax benefits like health insurance). (W-2 Box 14)',
    irsReference: 'W-2, Box 14',
  },
  'w2.box14Amount': {
    content: 'Dollar amount for this Box 14 deduction code. (W-2 Box 14)',
    irsReference: 'W-2, Box 14',
  },

  // ── 1099-INT ──
  '1099int.payerName': {
    content: 'The bank or institution that paid you interest.',
    irsReference: '1099-INT',
  },
  '1099int.interest': {
    content:
      'Total interest income from this bank or institution. This is taxed as ordinary income — same rate as your wages. (1099-INT Box 1)',
    irsReference: '1099-INT, Box 1',
  },
  '1099int.earlyWithdrawalPenalty': {
    content:
      "Penalty your bank charged for withdrawing a CD or savings account early. This reduces your taxable income — it's a deduction. (1099-INT Box 2)",
    irsReference: '1099-INT, Box 2',
  },
  '1099int.federalWithheld': {
    content:
      'Federal tax your bank withheld from your interest. Uncommon — usually $0. (1099-INT Box 4)',
    irsReference: '1099-INT, Box 4',
  },

  // ── 1099-DIV ──
  '1099div.payerName': {
    content: 'The company or fund that paid you dividends.',
    irsReference: '1099-DIV',
  },
  '1099div.ordinaryDividends': {
    content:
      'Total dividends paid to you, including both ordinary and qualified dividends. Ordinary dividends are taxed at your regular income rate. (1099-DIV Box 1a)',
    irsReference: '1099-DIV, Box 1a',
  },
  '1099div.qualifiedDividends': {
    content:
      'The portion of your dividends that qualifies for lower tax rates (0%, 15%, or 20% instead of your regular rate). This is already included in Box 1a — not an additional amount. (1099-DIV Box 1b)',
    irsReference: '1099-DIV, Box 1b',
  },
  '1099div.totalCapitalGain': {
    content:
      'Capital gain distributions from mutual funds. The fund sold investments at a profit and passed the gains to you. Taxed at long-term capital gains rates. (1099-DIV Box 2a)',
    irsReference: '1099-DIV, Box 2a',
  },
  '1099div.federalWithheld': {
    content:
      'Federal tax withheld from your dividends. Uncommon — usually $0. (1099-DIV Box 4)',
    irsReference: '1099-DIV, Box 4',
  },

  // ── 1099-NEC ──
  '1099nec.payerName': {
    content:
      'The company or person that paid you as a freelancer or independent contractor.',
    irsReference: '1099-NEC',
  },
  '1099nec.nonemployeeCompensation': {
    content:
      'Income you earned as a freelancer, contractor, or gig worker. Unlike W-2 wages, no taxes were withheld — you owe both income tax AND self-employment tax (15.3%) on this amount. (1099-NEC Box 1)',
    irsReference: '1099-NEC, Box 1',
  },
  '1099nec.federalWithheld': {
    content:
      'Federal tax withheld from your freelance/contract pay. Uncommon — usually $0. (1099-NEC Box 4)',
    irsReference: '1099-NEC, Box 4',
  },

  // ── Other Income ──
  otherIncome: {
    content:
      'Any other taxable income not reported on a W-2 or 1099 — for example, gambling winnings, prizes, jury duty pay, or hobby income.',
    irsReference: 'Schedule 1, Line 8z',
  },
  otherIncomeDescription: {
    content:
      "Briefly describe where this income came from — e.g., 'Gambling winnings', 'Jury duty pay', 'Prize income'. Required by the IRS on Schedule 1.",
    irsReference: 'Schedule 1, Line 8z',
  },

  // ── Adjustments to Income ──
  studentLoanInterest: {
    content:
      'Interest you paid on qualified student loans. Deductible up to $2,500 — this reduces your taxable income directly. Phases out at higher incomes.',
    irsReference: 'Schedule 1, Line 21',
  },
  educatorExpenses: {
    content:
      'Out-of-pocket classroom expenses for K-12 teachers, instructors, counselors, principals, or aides. Deductible up to $300 ($600 if married and both are educators).',
    irsReference: 'Schedule 1, Line 11',
  },
  hsaDeduction: {
    content:
      'Contributions you made to a Health Savings Account (HSA). You must have a high-deductible health plan. 2025 limits: $4,300 (self-only) or $8,550 (family).',
    irsReference: 'Form 8889',
  },
  iraDeduction: {
    content:
      'Contributions to a Traditional IRA that may be tax-deductible. 2025 limit: $7,000 ($8,000 if 50+). If you have a workplace retirement plan, the deduction may be reduced or eliminated at higher incomes.',
    irsReference: 'Schedule 1, Line 20',
  },
  hasWorkplaceRetirementPlan: {
    content:
      'Check this if your employer offers a retirement plan you participate in (401k, 403b, SEP, SIMPLE, or pension). This affects whether your IRA contribution is deductible.',
    irsReference: 'Schedule 1, Line 20',
  },

  // ── Deductions ──
  standardDeduction: {
    content:
      'A fixed dollar amount that reduces your taxable income. Most people take the standard deduction — only itemize if your eligible expenses add up to more.',
    irsReference: 'Form 1040, Line 12',
  },
  itemizedDeductions: {
    content:
      'Instead of the standard deduction, you can add up your actual eligible expenses (medical, taxes, mortgage interest, charity). Only worth it if the total exceeds your standard deduction.',
    irsReference: 'Schedule A',
  },
  'itemized.medicalExpenses': {
    content:
      'Medical and dental expenses you paid out of pocket (not reimbursed by insurance). Only the amount exceeding 7.5% of your income counts as a deduction.',
    irsReference: 'Schedule A, Line 4',
  },
  'itemized.stateLocalTaxes': {
    content:
      'State and local income taxes (or sales taxes) you paid. Combined with real estate taxes, capped at $10,000 ($5,000 if married filing separately). The 2025 SALT cap may be higher for some filers.',
    irsReference: 'Schedule A, Line 5a',
  },
  'itemized.realEstateTaxes': {
    content:
      'Property taxes you paid on real estate you own. Combined with state/local income taxes under the $10,000 SALT cap. Enter the full amount — the cap is applied automatically.',
    irsReference: 'Schedule A, Line 5b',
  },
  'itemized.mortgageInterest': {
    content:
      'Interest you paid on your home mortgage. Deductible on mortgage debt up to $750,000 ($375,000 if married filing separately) for your primary and secondary home.',
    irsReference: 'Schedule A, Line 8a',
  },
  'itemized.charitableCash': {
    content:
      'Cash donations to qualified charities (churches, nonprofits, etc.). Keep receipts for donations of $250+. Limited to 60% of your income.',
    irsReference: 'Schedule A, Line 12',
  },
  'itemized.charitableNonCash': {
    content:
      'Non-cash donations (clothing, furniture, household items, vehicles) to qualified charities. Must be in good condition. Limited to 30% of your income.',
    irsReference: 'Schedule A, Line 12',
  },
  'itemized.otherDeductions': {
    content:
      'Other itemized deductions such as gambling losses (up to your gambling winnings), certain business expenses, or amortizable bond premiums.',
    irsReference: 'Schedule A',
  },

  // ── Credits ──
  childTaxCredit: {
    content:
      'Up to $2,000 per qualifying child under 17. Partially refundable — even if you owe no tax, you may get up to $1,700 back per child.',
    irsReference: 'Schedule 8812',
  },
  childCareCreditExpenses: {
    content:
      'What you paid for daycare, babysitters, or after-school care so you (and your spouse) could work. Max: $3,000 for one child, $6,000 for two or more.',
    irsReference: 'Form 2441',
  },
  educationCredits: {
    content:
      'American Opportunity Credit (up to $2,500/student, first 4 years of college) or Lifetime Learning Credit (up to $2,000/return, any level of education).',
    irsReference: 'Form 8863',
  },
  'educationExpenses.studentSSN': {
    content:
      'The Social Security Number of the student. Could be you, your spouse, or a dependent.',
    irsReference: 'Form 8863',
  },
  earnedIncomeCredit: {
    content:
      'A refundable credit for low-to-moderate income workers. The amount depends on your income, filing status, and number of qualifying children. You could get up to $7,830 back.',
    irsReference: 'Schedule EIC',
  },
  retirementSaversCredit: {
    content:
      'A credit for contributing to a retirement account (IRA, 401k, etc.). Worth up to $1,000 ($2,000 if married filing jointly). Income limits apply — designed for lower-income savers.',
    irsReference: 'Form 8880',
  },

  // ── Capital Gains / Investments ──
  '1099b.description': {
    content:
      "A short description of what you sold — e.g., '100 shares AAPL' or 'Bitcoin'. This appears on Form 8949.",
    irsReference: 'Form 8949',
  },
  '1099b.dateAcquired': {
    content:
      "The date you originally bought or received this investment. If you acquired shares on multiple dates, enter 'VARIOUS'. (1099-B Box 1b)",
    irsReference: '1099-B, Box 1b',
  },
  '1099b.dateSold': {
    content:
      'The date you sold or disposed of this investment. (1099-B Box 1c)',
    irsReference: '1099-B, Box 1c',
  },
  '1099b.proceeds': {
    content:
      'The total amount you received from the sale, before any fees. (1099-B Box 1d)',
    irsReference: '1099-B, Box 1d',
  },
  '1099b.costBasis': {
    content:
      "What you originally paid for this investment (your cost basis). If your broker didn't report it, check your purchase records. (1099-B Box 1e)",
    irsReference: '1099-B, Box 1e',
  },
  '1099b.isLongTerm': {
    content:
      'Auto-calculated from your dates: held longer than 1 year = long-term (taxed at lower rates: 0%, 15%, or 20%). Override if your broker reported differently.',
    irsReference: 'Form 8949',
  },
  'capitalGainsSummary.shortTermGainLoss': {
    content:
      'Net gain or loss from investments held 1 year or less. Use a negative number for a net loss. Short-term gains are taxed at your regular income rate.',
    irsReference: 'Schedule D',
  },
  'capitalGainsSummary.longTermGainLoss': {
    content:
      'Net gain or loss from investments held longer than 1 year. Use a negative number for a net loss. Long-term gains get lower tax rates (0%, 15%, or 20%).',
    irsReference: 'Schedule D',
  },
  priorYearCapitalLossCarryforward: {
    content:
      "Capital losses from previous years that exceeded the $3,000 annual deduction limit. You can find this on your prior year's Schedule D or tax software summary.",
    irsReference: 'Schedule D, Line 6 or 14',
  },
  priorYearLTCapitalLossCarryforward: {
    content:
      'Long-term capital losses from prior years that exceeded the $3,000 annual limit. Check your prior year Schedule D for the carryforward amount.',
    irsReference: 'Schedule D, Line 14',
  },

  // ── State Taxes ──
  stateOfResidence: {
    content:
      'The state where you lived on December 31 of the tax year. This determines whether you owe state income tax and which state forms to file.',
  },
  nyResidencyType: {
    content:
      'Full-year resident = you lived in New York all year. Non-resident = you worked in NY but lived in another state.',
    irsReference: 'NY IT-201 / IT-203',
  },
  isNYC: {
    content:
      'NYC residents pay both New York State and New York City income tax — an additional 3-4% on top of state tax.',
    irsReference: 'NYC Form 1127',
  },
  nycEstimatedPayments: {
    content:
      'Total NYC estimated tax payments you made during the year using NYC-200V vouchers.',
    irsReference: 'NYC-200V',
  },
  retirementIncome: {
    content:
      'Pension or annuity income from a 1099-R. New York exempts up to $20,000 from qualifying government retirement plans (federal, state, local).',
    irsReference: 'NY IT-201',
  },
  ny529Contributions: {
    content:
      'Contributions to a New York 529 college savings plan. Deductible up to $5,000 (single) or $10,000 (married filing jointly) from your NY state income.',
    irsReference: 'NY IT-201',
  },

  // ── Review / Payments ──
  estimatedTaxPayments: {
    content:
      'Quarterly tax payments you made directly to the IRS during the year using Form 1040-ES. Common for freelancers and self-employed workers. These count toward what you owe.',
    irsReference: 'Form 1040, Line 26',
  },
  'directDeposit.routingNumber': {
    content:
      "Your bank's 9-digit routing number. Found on the bottom left of your checks, or in your banking app under 'account details.'",
    irsReference: 'Form 1040, Line 35b',
  },
  'directDeposit.accountNumber': {
    content:
      'Your bank account number. Found on the bottom of your checks (between routing and check numbers), or in your banking app.',
    irsReference: 'Form 1040, Line 35c',
  },
  'directDeposit.accountType': {
    content:
      'Choose whether the IRS should deposit your refund into a checking or savings account.',
    irsReference: 'Form 1040, Line 35a',
  },
};
