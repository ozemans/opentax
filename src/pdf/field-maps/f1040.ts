// Field map for Form 1040 (U.S. Individual Income Tax Return)
// Maps engine field names from mapForm1040() to placeholder PDF field names.

import type { FieldMap } from './types';

export const f1040FieldMap: FieldMap = {
  // Personal info
  firstName: { pdfFieldName: 'f1040_firstName', type: 'text' },
  lastName: { pdfFieldName: 'f1040_lastName', type: 'text' },
  ssn: { pdfFieldName: 'f1040_ssn', type: 'text' },
  address: { pdfFieldName: 'f1040_address', type: 'text' },
  city: { pdfFieldName: 'f1040_city', type: 'text' },
  state: { pdfFieldName: 'f1040_state', type: 'text' },
  zip: { pdfFieldName: 'f1040_zip', type: 'text' },
  filingStatus: { pdfFieldName: 'f1040_filingStatus', type: 'text' },

  // Spouse
  spouseFirstName: { pdfFieldName: 'f1040_spouseFirstName', type: 'text' },
  spouseLastName: { pdfFieldName: 'f1040_spouseLastName', type: 'text' },
  spouseSSN: { pdfFieldName: 'f1040_spouseSSN', type: 'text' },

  // Dependents (up to 4)
  dependent1_name: { pdfFieldName: 'f1040_dep1_name', type: 'text' },
  dependent1_ssn: { pdfFieldName: 'f1040_dep1_ssn', type: 'text' },
  dependent1_relationship: { pdfFieldName: 'f1040_dep1_rel', type: 'text' },
  dependent1_ctc: { pdfFieldName: 'f1040_dep1_ctc', type: 'checkbox' },
  dependent2_name: { pdfFieldName: 'f1040_dep2_name', type: 'text' },
  dependent2_ssn: { pdfFieldName: 'f1040_dep2_ssn', type: 'text' },
  dependent2_relationship: { pdfFieldName: 'f1040_dep2_rel', type: 'text' },
  dependent2_ctc: { pdfFieldName: 'f1040_dep2_ctc', type: 'checkbox' },
  dependent3_name: { pdfFieldName: 'f1040_dep3_name', type: 'text' },
  dependent3_ssn: { pdfFieldName: 'f1040_dep3_ssn', type: 'text' },
  dependent3_relationship: { pdfFieldName: 'f1040_dep3_rel', type: 'text' },
  dependent3_ctc: { pdfFieldName: 'f1040_dep3_ctc', type: 'checkbox' },
  dependent4_name: { pdfFieldName: 'f1040_dep4_name', type: 'text' },
  dependent4_ssn: { pdfFieldName: 'f1040_dep4_ssn', type: 'text' },
  dependent4_relationship: { pdfFieldName: 'f1040_dep4_rel', type: 'text' },
  dependent4_ctc: { pdfFieldName: 'f1040_dep4_ctc', type: 'checkbox' },

  // Income
  line1: { pdfFieldName: 'f1040_line1', type: 'text' },
  line2b: { pdfFieldName: 'f1040_line2b', type: 'text' },
  line3a: { pdfFieldName: 'f1040_line3a', type: 'text' },
  line3b: { pdfFieldName: 'f1040_line3b', type: 'text' },
  line7: { pdfFieldName: 'f1040_line7', type: 'text' },
  line8: { pdfFieldName: 'f1040_line8', type: 'text' },
  line9: { pdfFieldName: 'f1040_line9', type: 'text' },
  line11: { pdfFieldName: 'f1040_line11', type: 'text' },
  line12: { pdfFieldName: 'f1040_line12', type: 'text' },
  line13: { pdfFieldName: 'f1040_line13', type: 'text' },
  line14: { pdfFieldName: 'f1040_line14', type: 'text' },
  line15: { pdfFieldName: 'f1040_line15', type: 'text' },
  line16: { pdfFieldName: 'f1040_line16', type: 'text' },
  line17: { pdfFieldName: 'f1040_line17', type: 'text' },
  line19: { pdfFieldName: 'f1040_line19', type: 'text' },
  line23: { pdfFieldName: 'f1040_line23', type: 'text' },
  line24: { pdfFieldName: 'f1040_line24', type: 'text' },
  line25: { pdfFieldName: 'f1040_line25', type: 'text' },
  line26: { pdfFieldName: 'f1040_line26', type: 'text' },
  line27: { pdfFieldName: 'f1040_line27', type: 'text' },
  line28: { pdfFieldName: 'f1040_line28', type: 'text' },
  line33: { pdfFieldName: 'f1040_line33', type: 'text' },
  line34: { pdfFieldName: 'f1040_line34', type: 'text' },
  line35a: { pdfFieldName: 'f1040_line35a', type: 'text' },
  line37: { pdfFieldName: 'f1040_line37', type: 'text' },

  // Direct deposit
  routingNumber: { pdfFieldName: 'f1040_routingNumber', type: 'text' },
  accountNumber: { pdfFieldName: 'f1040_accountNumber', type: 'text' },
  accountType: { pdfFieldName: 'f1040_accountType', type: 'text' },

  // Informational (effectiveTaxRate, marginalTaxRate are intentionally NOT mapped
  // since they don't appear on the actual IRS form)
};
