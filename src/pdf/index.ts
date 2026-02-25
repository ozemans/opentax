// PDF Module Public API
// Re-exports all public functions and types.

export { fillForm } from './fill';
export { mergePdfs } from './merge';
export { generateReturnPackage } from './generator';
export { fillForm8949 } from './f8949-handler';
export { defaultTemplateLoader } from './template-loader';

export type { FormId, TemplateLoader } from './types';
export { PdfTemplateError, PdfFieldError } from './types';
export type { PdfFieldType, PdfFieldMapping, FieldMap } from './field-maps/types';
export { getFieldMap } from './field-maps/index';
