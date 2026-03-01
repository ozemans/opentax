// PDF Generator — Return Package Orchestrator
// Determines which forms are needed, fills them in parallel, and merges
// into a single PDF in IRS filing order. Includes state form generation.

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
 * Map state-level formId strings (from StateConfig.formId) to the PDF FormId type.
 * Each state module returns a formId string in its StateTaxResult (e.g., 'IT-201').
 * This maps those strings to the FormId union member used by the PDF module.
 *
 * States with no PDF template (e.g. OH 'IT-1040', NH 'DP-10') return undefined
 * and are silently skipped — their formId strings don't appear in this set.
 */
const STATE_FORM_IDS_WITH_TEMPLATES = new Set<FormId>([
  'it201',    // New York (resident)
  'ftb540',   // California
  'va760',    // Virginia
  'il1040',   // Illinois
  'pa40',     // Pennsylvania
  'nj1040',   // New Jersey
  'maForm1',  // Massachusetts
]);

// Explicit remaps for configs whose formId string differs from the FormId union value
const STATE_FORM_ID_REMAP: Record<string, FormId> = {
  'IT-201': 'it201',  // NY config uses 'IT-201'; FormId is 'it201'
};

function mapStateFormId(formId: string): FormId | undefined {
  if (formId in STATE_FORM_ID_REMAP) return STATE_FORM_ID_REMAP[formId];
  if (STATE_FORM_IDS_WITH_TEMPLATES.has(formId as FormId)) return formId as FormId;
  return undefined;
}

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
 * 5. Fills and appends state forms after federal forms.
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
    try {
      const bytes = await fillForm(formId, formData, templateLoader);
      return { formId, bytes };
    } catch (err) {
      console.error(`[PDF] Failed to fill ${formId}:`, err);
      throw err;
    }
  });

  // Handle Form 8949 separately (multi-page, per-category Part I/II split)
  let f8949Pages: Uint8Array[] = [];
  if (result.needsForm8949) {
    try {
      f8949Pages = await fillForm8949(result.capitalGainsResult.categorized, templateLoader);
    } catch (err) {
      console.error('[PDF] Failed to fill Form 8949:', err);
      throw err;
    }
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

  // ── State Form Generation ──
  // Iterate over state results and fill any state forms that have valid formIds.
  // State forms are appended after all federal forms.
  if (result.stateResults) {
    const stateFormPromises: Promise<Uint8Array>[] = [];

    for (const [, stateResult] of Object.entries(result.stateResults)) {
      if (!stateResult.formId || stateResult.formId === 'none') {
        continue;
      }

      const formId = mapStateFormId(stateResult.formId);
      if (!formId) {
        console.warn(`No PDF FormId mapping for state form: ${stateResult.formId}`);
        continue;
      }

      stateFormPromises.push(
        fillForm(formId, stateResult.formData, templateLoader),
      );
    }

    if (stateFormPromises.length > 0) {
      const stateFormBytes = await Promise.all(stateFormPromises);
      allPdfs.push(...stateFormBytes);
    }
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
    // State forms get their data from stateResults.formData (handled in the state loop)
    default: return undefined;
  }
}
