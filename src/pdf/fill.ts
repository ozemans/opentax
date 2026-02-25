// PDF Form Fill
// Loads a PDF template, maps engine fields to PDF fields, fills them, and returns flattened bytes.

import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import type { FormId, TemplateLoader } from './types';
import { PdfTemplateError } from './types';
import { getFieldMap } from './field-maps/index';

/**
 * Fill a PDF form template with field values.
 *
 * 1. Loads the PDF template via templateLoader.
 * 2. Looks up the field map for the given formId.
 * 3. For each entry in `fields`, finds the corresponding PDF field mapping
 *    and sets the value (text or checkbox).
 * 4. Flattens the form (makes it non-editable) and returns the PDF bytes.
 *
 * - Unmapped engine fields (no entry in field map) are silently skipped.
 * - Missing PDF fields (mapping exists but field not found in PDF) are warned but not thrown.
 *
 * @param formId - The form identifier (e.g., 'f1040', 'scheduleA')
 * @param fields - Record of engine field names → values from TaxResult.forms
 * @param templateLoader - Function to load PDF template bytes
 * @returns Filled, flattened PDF as Uint8Array
 */
export async function fillForm(
  formId: FormId,
  fields: Record<string, string | number>,
  templateLoader: TemplateLoader,
): Promise<Uint8Array> {
  // Load template
  let templateBytes: Uint8Array;
  try {
    templateBytes = await templateLoader(formId);
  } catch (err) {
    throw new PdfTemplateError(
      `Failed to load template for ${formId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Load document
  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();

  // Get field map for this form
  const fieldMap = getFieldMap(formId);

  // Fill fields
  for (const [engineField, value] of Object.entries(fields)) {
    const mapping = fieldMap[engineField];
    if (!mapping) {
      // No mapping for this engine field — skip silently.
      // Some fields like effectiveTaxRate are informational only.
      continue;
    }

    // Apply optional transform
    const displayValue = mapping.transform
      ? mapping.transform(value)
      : String(value);

    try {
      const pdfField = form.getField(mapping.pdfFieldName);

      if (mapping.type === 'text' && pdfField instanceof PDFTextField) {
        pdfField.setText(displayValue);
      } else if (mapping.type === 'checkbox' && pdfField instanceof PDFCheckBox) {
        if (displayValue === 'X' || displayValue === 'true' || displayValue === '1') {
          pdfField.check();
        } else {
          pdfField.uncheck();
        }
      }
    } catch {
      // PDF field not found in template — warn but don't throw.
      // This can happen with placeholder field names before real IRS templates.
      console.warn(
        `PDF field "${mapping.pdfFieldName}" not found in ${formId} template`,
      );
    }
  }

  // Flatten the form (makes it non-editable)
  form.flatten();

  return pdfDoc.save();
}
