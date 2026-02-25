// Field map for Form 8959 (Additional Medicare Tax)
// Maps engine field names from mapForm8959() to placeholder PDF field names.

import type { FieldMap } from './types';

export const f8959FieldMap: FieldMap = {
  medicareWages: { pdfFieldName: 'f8959_medicareWages', type: 'text' },
  additionalMedicareTax: { pdfFieldName: 'f8959_additionalMedicareTax', type: 'text' },
  selfEmploymentMedicareWages: { pdfFieldName: 'f8959_selfEmploymentMedicareWages', type: 'text' },
  combinedMedicareWages: { pdfFieldName: 'f8959_combinedMedicareWages', type: 'text' },
  w2MedicareWithheld: { pdfFieldName: 'f8959_w2MedicareWithheld', type: 'text' },
};
