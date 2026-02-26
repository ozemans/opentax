// PDF Generator — Return Package Orchestrator
// Determines which forms are needed, fills them in parallel, and merges
// into a single PDF in IRS filing order.

import type { TaxInput, TaxResult } from '../engine/types';
import type { FormId, TemplateLoader } from './types';
import { fillForm } from './fill';
import { fillForm8949 } from './f8949-handler';
import { mergePdfs } from './merge';
import { defaultTemplateLoader } from './template-loader';

/**
 * IRS filing order for forms. Form 1040 must be first, then schedules
 * in numeric/alphabetical order, then supplemental forms.
 */
const FORM_ORDER: FormId[] = [
  'f1040',
  'schedule1',
  'schedule2',
  'schedule3',
  'scheduleA',
  'scheduleB',
  'scheduleC',
  'scheduleD',
  'scheduleSE',
  'f8949',
  'f8959',
  'f8960',
];

/**
 * Map of needsScheduleX flags to FormId.
 * The f1040 is always included and handled separately.
 */
const FLAG_TO_FORM: { flag: keyof TaxResult; formId: FormId }[] = [
  { flag: 'needsSchedule1', formId: 'schedule1' },
  { flag: 'needsSchedule2', formId: 'schedule2' },
  { flag: 'needsSchedule3', formId: 'schedule3' },
  { flag: 'needsScheduleA', formId: 'scheduleA' },
  { flag: 'needsScheduleB', formId: 'scheduleB' },
  { flag: 'needsScheduleC', formId: 'scheduleC' },
  { flag: 'needsScheduleD', formId: 'scheduleD' },
  { flag: 'needsScheduleSE', formId: 'scheduleSE' },
  { flag: 'needsForm8959', formId: 'f8959' },
  { flag: 'needsForm8960', formId: 'f8960' },
];

/**
 * Determine which forms are required based on TaxResult flags.
 * Always includes f1040. Form 8949 is handled separately.
 */
function getRequiredForms(result: TaxResult): FormId[] {
  const forms: FormId[] = ['f1040'];

  for (const { flag, formId } of FLAG_TO_FORM) {
    if (result[flag]) {
      forms.push(formId);
    }
  }

  return forms;
}

/**
 * Generate a complete tax return PDF package.
 *
 * 1. Determines required forms from result flags.
 * 2. Fills all standard forms in parallel via Promise.all.
 * 3. Handles Form 8949 separately (multi-page).
 * 4. Merges all filled PDFs into a single document in IRS filing order.
 *
 * @param input - The taxpayer's input data
 * @param result - The computed tax result with form mappings
 * @param templateLoader - Optional custom template loader (defaults to fetch-based)
 * @returns Single merged PDF as Uint8Array
 */
export async function generateReturnPackage(
  _input: TaxInput,
  result: TaxResult,
  templateLoader: TemplateLoader = defaultTemplateLoader,
): Promise<Uint8Array> {
  const requiredForms = getRequiredForms(result);

  // Fill standard forms in parallel
  const formFillPromises = requiredForms.map(async (formId): Promise<{ formId: FormId; bytes: Uint8Array }> => {
    const formData = getFormData(result, formId);
    if (!formData) {
      // This shouldn't happen — but guard against it
      throw new Error(`No form data for required form: ${formId}`);
    }
    const bytes = await fillForm(formId, formData, templateLoader);
    return { formId, bytes };
  });

  // Handle Form 8949 separately (multi-page)
  let f8949Pages: Uint8Array[] = [];
  if (result.needsForm8949 && result.forms.f8949) {
    f8949Pages = await fillForm8949(result.forms.f8949, templateLoader);
  }

  // Wait for all standard forms
  const filledForms = await Promise.all(formFillPromises);

  // Sort all filled forms in IRS filing order
  const formOrderMap = new Map(FORM_ORDER.map((id, idx) => [id, idx]));
  filledForms.sort((a, b) => {
    const orderA = formOrderMap.get(a.formId) ?? 999;
    const orderB = formOrderMap.get(b.formId) ?? 999;
    return orderA - orderB;
  });

  // Build final PDF array: standard forms + 8949 pages (inserted at the right position)
  const allPdfs: Uint8Array[] = [];
  const f8949Position = formOrderMap.get('f8949') ?? 999;

  let f8949Inserted = false;
  for (const filled of filledForms) {
    const currentPosition = formOrderMap.get(filled.formId) ?? 999;

    // Insert 8949 pages before forms that come after it in the order
    if (!f8949Inserted && f8949Pages.length > 0 && currentPosition > f8949Position) {
      allPdfs.push(...f8949Pages);
      f8949Inserted = true;
    }

    allPdfs.push(filled.bytes);
  }

  // If 8949 pages haven't been inserted yet (all standard forms come before 8949), append them
  if (!f8949Inserted && f8949Pages.length > 0) {
    allPdfs.push(...f8949Pages);
  }

  return mergePdfs(allPdfs);
}

/**
 * Get the form data for a specific form from the TaxResult.
 */
function getFormData(result: TaxResult, formId: FormId): Record<string, string | number> | undefined {
  switch (formId) {
    case 'f1040': return result.forms.f1040;
    case 'schedule1': return result.forms.schedule1;
    case 'schedule2': return result.forms.schedule2;
    case 'schedule3': return result.forms.schedule3;
    case 'scheduleA': return result.forms.scheduleA;
    case 'scheduleB': return result.forms.scheduleB;
    case 'scheduleC': return result.forms.scheduleC;
    case 'scheduleD': return result.forms.scheduleD;
    case 'scheduleSE': return result.forms.scheduleSE;
    case 'f8959': return result.forms.f8959;
    case 'f8960': return result.forms.f8960;
    // f8949 is handled separately via fillForm8949
    default: return undefined;
  }
}
