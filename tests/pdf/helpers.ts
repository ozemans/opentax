// PDF Test Helpers
// Creates synthetic PDF templates with named form fields for testing.

import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import type { FormId, TemplateLoader } from '../../src/pdf/types';

/**
 * Create a synthetic PDF template with named text and checkbox fields.
 * Returns raw PDF bytes suitable for use with pdf-lib's PDFDocument.load().
 */
export async function createSyntheticTemplate(
  textFields: string[],
  checkboxFields: string[] = [],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const form = pdfDoc.getForm();

  // Create text fields
  textFields.forEach((name, i) => {
    const field = form.createTextField(name);
    field.addToPage(page, {
      x: 50,
      y: 700 - i * 30,
      width: 200,
      height: 20,
    });
  });

  // Create checkbox fields
  checkboxFields.forEach((name, i) => {
    const field = form.createCheckBox(name);
    field.addToPage(page, {
      x: 300,
      y: 700 - i * 30,
      width: 15,
      height: 15,
    });
  });

  return pdfDoc.save();
}

/**
 * Create a mock TemplateLoader that returns pre-built templates.
 * Throws PdfTemplateError for unregistered form IDs.
 */
export function createMockTemplateLoader(
  templates: Partial<Record<FormId, Uint8Array>>,
): TemplateLoader {
  return async (formId: FormId): Promise<Uint8Array> => {
    const template = templates[formId];
    if (!template) {
      throw new Error(`No template registered for form: ${formId}`);
    }
    return template;
  };
}

/**
 * Load a PDF and read a text field's value.
 * Useful for verifying fill results.
 */
export async function readTextField(
  pdfBytes: Uint8Array,
  fieldName: string,
): Promise<string | undefined> {
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  try {
    const field = form.getField(fieldName);
    if (field instanceof PDFTextField) {
      return field.getText() ?? undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Load a PDF and read whether a checkbox is checked.
 */
export async function readCheckbox(
  pdfBytes: Uint8Array,
  fieldName: string,
): Promise<boolean | undefined> {
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  try {
    const field = form.getField(fieldName);
    if (field instanceof PDFCheckBox) {
      return field.isChecked();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Count the number of pages in a PDF.
 */
export async function getPageCount(pdfBytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}
