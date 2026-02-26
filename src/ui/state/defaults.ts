import type {
  TaxInput,
  W2,
  Form1099INT,
  Form1099DIV,
  Form1099B,
  Form1099NEC,
  Form1099G,
  Form1099R,
  Form1099K,
  Dependent,
  ItemizedDeductions,
  ScheduleCData,
  ScheduleCExpenses,
} from '../../engine/types';

// ---------------------------------------------------------------------------
// Factory functions — each returns a valid "empty" instance
// ---------------------------------------------------------------------------

export function createEmptyW2(): W2 {
  return {
    employerEIN: '',
    employerName: '',
    wages: 0,
    federalWithheld: 0,
    socialSecurityWages: 0,
    socialSecurityWithheld: 0,
    medicareWages: 0,
    medicareWithheld: 0,
    stateWages: 0,
    stateWithheld: 0,
    stateCode: '',
  };
}

export function createEmpty1099INT(): Form1099INT {
  return {
    payerName: '',
    interest: 0,
  };
}

export function createEmpty1099DIV(): Form1099DIV {
  return {
    payerName: '',
    ordinaryDividends: 0,
    qualifiedDividends: 0,
    totalCapitalGain: 0,
  };
}

export function createEmpty1099B(): Form1099B {
  return {
    description: '',
    dateAcquired: '',
    dateSold: '',
    proceeds: 0,
    costBasis: 0,
    gainLoss: 0,
    isLongTerm: false,
    basisReportedToIRS: true,
    category: '8949_A',
  };
}

export function createEmpty1099NEC(): Form1099NEC {
  return {
    payerName: '',
    nonemployeeCompensation: 0,
  };
}

export function createEmpty1099G(): Form1099G {
  return {
    unemployment: 0,
  };
}

export function createEmpty1099R(): Form1099R {
  return {
    grossDistribution: 0,
    taxableAmount: 0,
    distributionCode: '',
  };
}

export function createEmpty1099K(): Form1099K {
  return {
    grossAmount: 0,
    alreadyReportedOnScheduleC: false,
  };
}

export function createEmptyDependent(): Dependent {
  return {
    firstName: '',
    lastName: '',
    ssn: '',
    relationship: '',
    dateOfBirth: '',
    monthsLivedWithYou: 12,
    isStudent: false,
    isDisabled: false,
    qualifiesForCTC: false,
    qualifiesForODC: false,
  };
}

export function createEmptyItemizedDeductions(): ItemizedDeductions {
  return {
    medicalExpenses: 0,
    stateLocalTaxesPaid: 0,
    realEstateTaxes: 0,
    mortgageInterest: 0,
    charitableCash: 0,
    charitableNonCash: 0,
  };
}

export function createEmptyScheduleCExpenses(): ScheduleCExpenses {
  return {};
}

export function createEmptyScheduleC(): ScheduleCData {
  return {
    businessName: '',
    businessCode: '',
    grossReceipts: 0,
    expenses: createEmptyScheduleCExpenses(),
  };
}

// ---------------------------------------------------------------------------
// Default TaxInput — valid empty return ready for the engine
// ---------------------------------------------------------------------------

export function createDefaultTaxInput(): TaxInput {
  return {
    taxYear: 2025,
    filingStatus: 'single',
    taxpayer: {
      firstName: '',
      lastName: '',
      ssn: '',
      dateOfBirth: '',
    },
    dependents: [],
    address: {
      street: '',
      city: '',
      state: '',
      zip: '',
    },

    // Income
    w2s: [],
    form1099INTs: [],
    form1099DIVs: [],
    form1099Bs: [],
    form1099NECs: [],
    form1099Gs: [],
    form1099Rs: [],
    form1099Ks: [],

    // Adjustments
    estimatedTaxPayments: 0,

    // Deductions
    useItemizedDeductions: false,

    // State
    stateOfResidence: '',
  };
}
