// PDF Generation Types
// Core types used across the PDF generation module.

export type FormId =
  | 'f1040' | 'scheduleA' | 'scheduleB' | 'scheduleC' | 'scheduleD'
  | 'scheduleSE' | 'schedule1' | 'schedule2' | 'schedule3'
  | 'f8949' | 'f8959' | 'f8960'
  | 'it201';

export type TemplateLoader = (formId: FormId) => Promise<Uint8Array>;

export class PdfTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfTemplateError';
  }
}

export class PdfFieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfFieldError';
  }
}
