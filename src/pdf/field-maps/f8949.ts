// Field map for Form 8949 (Sales and Other Dispositions of Capital Assets)
// Maps engine field names from mapForm8949() to placeholder PDF field names.
// Each row on Form 8949 has the same set of fields, suffixed by row number.
// The f8949-handler uses these field maps per-row.

import type { FieldMap } from './types';

// Per-row field template (without row suffix for base mapping)
const baseRowFields: FieldMap = {
  description: { pdfFieldName: 'f8949_description', type: 'text' },
  dateAcquired: { pdfFieldName: 'f8949_dateAcquired', type: 'text' },
  dateSold: { pdfFieldName: 'f8949_dateSold', type: 'text' },
  proceeds: { pdfFieldName: 'f8949_proceeds', type: 'text' },
  basis: { pdfFieldName: 'f8949_basis', type: 'text' },
  gainLoss: { pdfFieldName: 'f8949_gainLoss', type: 'text' },
  category: { pdfFieldName: 'f8949_category', type: 'text' },
};

// Generate row-specific fields for up to 14 rows per page
const rowFields: FieldMap = {};
for (let row = 1; row <= 14; row++) {
  for (const [key, mapping] of Object.entries(baseRowFields)) {
    rowFields[`row${row}_${key}`] = {
      pdfFieldName: `f8949_row${row}_${mapping.pdfFieldName.replace('f8949_', '')}`,
      type: mapping.type,
    };
  }
}

export const f8949FieldMap: FieldMap = {
  ...baseRowFields,
  ...rowFields,
};
