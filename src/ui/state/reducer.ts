import type { TaxInput } from '../../engine/types';
import type { TaxAction } from './actions';
import {
  createDefaultTaxInput,
  createEmptyW2,
  createEmpty1099INT,
  createEmpty1099DIV,
  createEmpty1099B,
  createEmpty1099NEC,
  createEmpty1099G,
  createEmpty1099R,
  createEmpty1099K,
  createEmptyDependent,
} from './defaults';

// ---------------------------------------------------------------------------
// Array helpers
// ---------------------------------------------------------------------------

function updateArrayItem<T>(arr: readonly T[], index: number, updates: Partial<T>): T[] {
  if (index < 0 || index >= arr.length) return [...arr];
  return arr.map((item, i) => (i === index ? { ...item, ...updates } : item));
}

function removeArrayItem<T>(arr: readonly T[], index: number): T[] {
  if (index < 0 || index >= arr.length) return [...arr];
  return arr.filter((_, i) => i !== index);
}

// ---------------------------------------------------------------------------
// Dot-path field setter (1-2 levels deep)
// ---------------------------------------------------------------------------

function setField(state: TaxInput, path: string, value: unknown): TaxInput {
  const parts = path.split('.');

  if (parts.length === 1) {
    return { ...state, [parts[0]]: value };
  }

  if (parts.length === 2) {
    const [parent, child] = parts;

    // Handle spouse — create default structure if it doesn't exist
    if (parent === 'spouse') {
      const existing = state.spouse ?? {
        firstName: '',
        lastName: '',
        ssn: '',
        dateOfBirth: '',
      };
      return {
        ...state,
        spouse: { ...existing, [child]: value },
      };
    }

    // Handle directDeposit — create default structure if it doesn't exist
    if (parent === 'directDeposit') {
      const existing = state.directDeposit ?? {
        routingNumber: '',
        accountNumber: '',
        accountType: 'checking' as const,
      };
      return {
        ...state,
        directDeposit: { ...existing, [child]: value },
      };
    }

    // Handle taxpayer, address — always exist
    const parentObj = state[parent as keyof TaxInput];
    if (parentObj && typeof parentObj === 'object' && !Array.isArray(parentObj)) {
      return {
        ...state,
        [parent]: { ...(parentObj as Record<string, unknown>), [child]: value },
      };
    }
  }

  return state;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function taxReducer(state: TaxInput, action: TaxAction): TaxInput {
  switch (action.type) {
    // --- Generic field ---
    case 'SET_FIELD':
      return setField(state, action.path, action.value);

    // --- W2 ---
    case 'ADD_W2':
      return { ...state, w2s: [...state.w2s, createEmptyW2()] };
    case 'UPDATE_W2':
      return { ...state, w2s: updateArrayItem(state.w2s, action.index, action.updates) };
    case 'REMOVE_W2':
      return { ...state, w2s: removeArrayItem(state.w2s, action.index) };

    // --- 1099-INT ---
    case 'ADD_1099_INT':
      return { ...state, form1099INTs: [...state.form1099INTs, createEmpty1099INT()] };
    case 'UPDATE_1099_INT':
      return { ...state, form1099INTs: updateArrayItem(state.form1099INTs, action.index, action.updates) };
    case 'REMOVE_1099_INT':
      return { ...state, form1099INTs: removeArrayItem(state.form1099INTs, action.index) };

    // --- 1099-DIV ---
    case 'ADD_1099_DIV':
      return { ...state, form1099DIVs: [...state.form1099DIVs, createEmpty1099DIV()] };
    case 'UPDATE_1099_DIV':
      return { ...state, form1099DIVs: updateArrayItem(state.form1099DIVs, action.index, action.updates) };
    case 'REMOVE_1099_DIV':
      return { ...state, form1099DIVs: removeArrayItem(state.form1099DIVs, action.index) };

    // --- 1099-B ---
    case 'ADD_1099_B':
      return { ...state, form1099Bs: [...state.form1099Bs, createEmpty1099B()] };
    case 'UPDATE_1099_B':
      return { ...state, form1099Bs: updateArrayItem(state.form1099Bs, action.index, action.updates) };
    case 'REMOVE_1099_B':
      return { ...state, form1099Bs: removeArrayItem(state.form1099Bs, action.index) };
    case 'IMPORT_1099_BS':
      return { ...state, form1099Bs: action.payload };

    // --- 1099-NEC ---
    case 'ADD_1099_NEC':
      return { ...state, form1099NECs: [...state.form1099NECs, createEmpty1099NEC()] };
    case 'UPDATE_1099_NEC':
      return { ...state, form1099NECs: updateArrayItem(state.form1099NECs, action.index, action.updates) };
    case 'REMOVE_1099_NEC':
      return { ...state, form1099NECs: removeArrayItem(state.form1099NECs, action.index) };

    // --- Bulk imports (append to existing) ---
    case 'IMPORT_W2S':
      return { ...state, w2s: [...state.w2s, ...action.payload] };
    case 'IMPORT_1099_INTS':
      return { ...state, form1099INTs: [...state.form1099INTs, ...action.payload] };
    case 'IMPORT_1099_DIVS':
      return { ...state, form1099DIVs: [...state.form1099DIVs, ...action.payload] };
    case 'IMPORT_1099_NECS':
      return { ...state, form1099NECs: [...state.form1099NECs, ...action.payload] };

    // --- 1099-G ---
    case 'ADD_1099_G':
      return { ...state, form1099Gs: [...state.form1099Gs, createEmpty1099G()] };
    case 'UPDATE_1099_G':
      return { ...state, form1099Gs: updateArrayItem(state.form1099Gs, action.index, action.updates) };
    case 'REMOVE_1099_G':
      return { ...state, form1099Gs: removeArrayItem(state.form1099Gs, action.index) };

    // --- 1099-R ---
    case 'ADD_1099_R':
      return { ...state, form1099Rs: [...state.form1099Rs, createEmpty1099R()] };
    case 'UPDATE_1099_R':
      return { ...state, form1099Rs: updateArrayItem(state.form1099Rs, action.index, action.updates) };
    case 'REMOVE_1099_R':
      return { ...state, form1099Rs: removeArrayItem(state.form1099Rs, action.index) };

    // --- 1099-K ---
    case 'ADD_1099_K':
      return { ...state, form1099Ks: [...state.form1099Ks, createEmpty1099K()] };
    case 'UPDATE_1099_K':
      return { ...state, form1099Ks: updateArrayItem(state.form1099Ks, action.index, action.updates) };
    case 'REMOVE_1099_K':
      return { ...state, form1099Ks: removeArrayItem(state.form1099Ks, action.index) };

    // --- Dependents ---
    case 'ADD_DEPENDENT':
      return { ...state, dependents: [...state.dependents, createEmptyDependent()] };
    case 'UPDATE_DEPENDENT':
      return { ...state, dependents: updateArrayItem(state.dependents, action.index, action.updates) };
    case 'REMOVE_DEPENDENT':
      return { ...state, dependents: removeArrayItem(state.dependents, action.index) };

    // --- Education expenses ---
    case 'ADD_EDUCATION_EXPENSE': {
      const existing = state.educationExpenses ?? [];
      return {
        ...state,
        educationExpenses: [
          ...existing,
          { type: 'american_opportunity' as const, qualifiedExpenses: 0, studentSSN: '' },
        ],
      };
    }
    case 'UPDATE_EDUCATION_EXPENSE': {
      const existing = state.educationExpenses ?? [];
      return {
        ...state,
        educationExpenses: updateArrayItem(existing, action.index, action.updates),
      };
    }
    case 'REMOVE_EDUCATION_EXPENSE': {
      const existing = state.educationExpenses ?? [];
      const updated = removeArrayItem(existing, action.index);
      return {
        ...state,
        educationExpenses: updated.length > 0 ? updated : undefined,
      };
    }

    // --- Capital gains summary ---
    case 'SET_CAPITAL_GAINS_SUMMARY':
      return { ...state, capitalGainsSummary: action.payload };

    // --- Structured setters ---
    case 'SET_SELF_EMPLOYMENT':
      return { ...state, scheduleCData: action.payload };
    case 'SET_ITEMIZED_DEDUCTIONS':
      return { ...state, itemizedDeductions: action.payload };
    case 'SET_ADJUSTMENTS':
      return { ...state, ...action.payload };
    case 'SET_RETIREMENT_SAVERS_CREDIT':
      return { ...state, retirementSaversCredit: action.payload };
    case 'SET_ADDITIONAL_STATES':
      return { ...state, additionalStates: action.payload };

    // --- Bulk operations ---
    case 'LOAD_INPUT':
      return action.payload;
    case 'RESET':
      return createDefaultTaxInput();

    default: {
      // Exhaustiveness check: if we reach here, we missed an action type
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
