import type {
  TaxInput,
  FilingStatus,
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
} from '../../engine/types';

// ---------------------------------------------------------------------------
// Scalar / nested field paths
// ---------------------------------------------------------------------------

/** Top-level scalar fields that can be set directly */
type ScalarFieldPath =
  | 'filingStatus'
  | 'taxYear'
  | 'stateOfResidence'
  | 'useItemizedDeductions'
  | 'otherIncome'
  | 'studentLoanInterest'
  | 'educatorExpenses'
  | 'hsaDeduction'
  | 'iraDeduction'
  | 'estimatedTaxPayments'
  | 'childCareCreditExpenses'
  | 'priorYearCapitalLossCarryforward'
  | 'taxpayerAge65OrOlder'
  | 'taxpayerBlind'
  | 'spouseAge65OrOlder'
  | 'spouseBlind';

/** Dotted paths for nested objects */
type TaxpayerFieldPath =
  | 'taxpayer.firstName'
  | 'taxpayer.lastName'
  | 'taxpayer.ssn'
  | 'taxpayer.dateOfBirth';

type SpouseFieldPath =
  | 'spouse.firstName'
  | 'spouse.lastName'
  | 'spouse.ssn'
  | 'spouse.dateOfBirth';

type AddressFieldPath =
  | 'address.street'
  | 'address.city'
  | 'address.state'
  | 'address.zip';

type DirectDepositFieldPath =
  | 'directDeposit.routingNumber'
  | 'directDeposit.accountNumber'
  | 'directDeposit.accountType';

type FieldPath =
  | ScalarFieldPath
  | TaxpayerFieldPath
  | SpouseFieldPath
  | AddressFieldPath
  | DirectDepositFieldPath;

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

export type TaxAction =
  // Generic field setter (scalar and 1-2 level nested)
  | { type: 'SET_FIELD'; path: FieldPath; value: string | number | boolean | FilingStatus }

  // W2 operations
  | { type: 'ADD_W2' }
  | { type: 'UPDATE_W2'; index: number; updates: Partial<W2> }
  | { type: 'REMOVE_W2'; index: number }

  // 1099-INT operations
  | { type: 'ADD_1099_INT' }
  | { type: 'UPDATE_1099_INT'; index: number; updates: Partial<Form1099INT> }
  | { type: 'REMOVE_1099_INT'; index: number }

  // 1099-DIV operations
  | { type: 'ADD_1099_DIV' }
  | { type: 'UPDATE_1099_DIV'; index: number; updates: Partial<Form1099DIV> }
  | { type: 'REMOVE_1099_DIV'; index: number }

  // 1099-B operations
  | { type: 'ADD_1099_B' }
  | { type: 'UPDATE_1099_B'; index: number; updates: Partial<Form1099B> }
  | { type: 'REMOVE_1099_B'; index: number }
  | { type: 'IMPORT_1099_BS'; payload: Form1099B[] }

  // 1099-NEC operations
  | { type: 'ADD_1099_NEC' }
  | { type: 'UPDATE_1099_NEC'; index: number; updates: Partial<Form1099NEC> }
  | { type: 'REMOVE_1099_NEC'; index: number }

  // Bulk import operations (append to existing arrays)
  | { type: 'IMPORT_W2S'; payload: W2[] }
  | { type: 'IMPORT_1099_INTS'; payload: Form1099INT[] }
  | { type: 'IMPORT_1099_DIVS'; payload: Form1099DIV[] }
  | { type: 'IMPORT_1099_NECS'; payload: Form1099NEC[] }

  // 1099-G operations
  | { type: 'ADD_1099_G' }
  | { type: 'UPDATE_1099_G'; index: number; updates: Partial<Form1099G> }
  | { type: 'REMOVE_1099_G'; index: number }

  // 1099-R operations
  | { type: 'ADD_1099_R' }
  | { type: 'UPDATE_1099_R'; index: number; updates: Partial<Form1099R> }
  | { type: 'REMOVE_1099_R'; index: number }

  // 1099-K operations
  | { type: 'ADD_1099_K' }
  | { type: 'UPDATE_1099_K'; index: number; updates: Partial<Form1099K> }
  | { type: 'REMOVE_1099_K'; index: number }

  // Dependent operations
  | { type: 'ADD_DEPENDENT' }
  | { type: 'UPDATE_DEPENDENT'; index: number; updates: Partial<Dependent> }
  | { type: 'REMOVE_DEPENDENT'; index: number }

  // Education expense operations
  | { type: 'ADD_EDUCATION_EXPENSE' }
  | { type: 'UPDATE_EDUCATION_EXPENSE'; index: number; updates: Partial<NonNullable<TaxInput['educationExpenses']>[number]> }
  | { type: 'REMOVE_EDUCATION_EXPENSE'; index: number }

  // Structured setters
  | { type: 'SET_SELF_EMPLOYMENT'; payload: ScheduleCData | undefined }
  | { type: 'SET_ITEMIZED_DEDUCTIONS'; payload: ItemizedDeductions | undefined }
  | { type: 'SET_ADJUSTMENTS'; payload: Partial<Pick<TaxInput, 'studentLoanInterest' | 'educatorExpenses' | 'hsaDeduction' | 'iraDeduction'>> }
  | { type: 'SET_RETIREMENT_SAVERS_CREDIT'; payload: TaxInput['retirementSaversCredit'] }
  | { type: 'SET_ADDITIONAL_STATES'; payload: string[] }

  // Bulk operations
  | { type: 'LOAD_INPUT'; payload: TaxInput }
  | { type: 'RESET' };
