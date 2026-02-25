// PDF Field Mapping Types
// Defines the structure for mapping engine form fields to PDF template field names.

export type PdfFieldType = 'text' | 'checkbox';

export interface PdfFieldMapping {
  pdfFieldName: string;
  type: PdfFieldType;
  transform?: (value: string | number) => string;
}

export type FieldMap = Record<string, PdfFieldMapping>;
