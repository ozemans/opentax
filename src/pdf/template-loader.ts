// Template Loader
// Provides the default template loader that fetches IRS PDF templates
// from the /pdf-templates/ directory.

import type { FormId, TemplateLoader } from './types';
import { PdfTemplateError } from './types';

/**
 * Map FormId to the PDF template filename.
 * Filenames follow a normalized kebab-case pattern.
 */
const formFilenames: Record<FormId, string> = {
  f1040: 'f1040',
  schedule1: 'schedule-1',
  schedule2: 'schedule-2',
  schedule3: 'schedule-3',
  scheduleA: 'schedule-a',
  scheduleB: 'schedule-b',
  scheduleC: 'schedule-c',
  scheduleD: 'schedule-d',
  scheduleSE: 'schedule-se',
  f8949: 'f8949',
  f8959: 'f8959',
  f8960: 'f8960',
};

/**
 * Default template loader that fetches PDF templates from /pdf-templates/.
 * Intended for use in the browser — fetches via the Fetch API.
 */
export const defaultTemplateLoader: TemplateLoader = async (formId: FormId): Promise<Uint8Array> => {
  const filename = formFilenames[formId];
  if (!filename) {
    throw new PdfTemplateError(`Unknown form ID: ${formId}`);
  }

  const url = `/pdf-templates/${filename}.pdf`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new PdfTemplateError(
        `Failed to fetch template for ${formId}: HTTP ${response.status}`,
      );
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (err) {
    if (err instanceof PdfTemplateError) throw err;
    throw new PdfTemplateError(
      `Failed to load template for ${formId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};
