/**
 * Verification script: Tests that fillForm() can load each real IRS template
 * and fill fields without errors. This validates that:
 * 1. Each PDF template loads successfully with pdf-lib
 * 2. getForm() works (not XFA-only)
 * 3. The mapped field names exist in the templates
 */

import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templatesDir = resolve(__dirname, '../public/pdf-templates');

// Import field maps
import { f1040FieldMap } from '../src/pdf/field-maps/f1040.js';
import { schedule1FieldMap } from '../src/pdf/field-maps/schedule1.js';
import { schedule2FieldMap } from '../src/pdf/field-maps/schedule2.js';
import { schedule3FieldMap } from '../src/pdf/field-maps/schedule3.js';
import { scheduleAFieldMap } from '../src/pdf/field-maps/scheduleA.js';
import { scheduleBFieldMap } from '../src/pdf/field-maps/scheduleB.js';
import { scheduleCFieldMap } from '../src/pdf/field-maps/scheduleC.js';
import { scheduleDFieldMap } from '../src/pdf/field-maps/scheduleD.js';
import { scheduleSEFieldMap } from '../src/pdf/field-maps/scheduleSE.js';
import { f8949FieldMap } from '../src/pdf/field-maps/f8949.js';
import { f8959FieldMap } from '../src/pdf/field-maps/f8959.js';
import { f8960FieldMap } from '../src/pdf/field-maps/f8960.js';
import { it201FieldMap } from '../src/pdf/field-maps/it201.js';
import type { FieldMap } from '../src/pdf/field-maps/types.js';

interface VerifyResult {
  form: string;
  totalMappings: number;
  found: number;
  missing: string[];
  errors: string[];
}

async function verifyForm(
  formName: string,
  pdfFile: string,
  fieldMap: FieldMap,
): Promise<VerifyResult> {
  const result: VerifyResult = {
    form: formName,
    totalMappings: 0,
    found: 0,
    missing: [],
    errors: [],
  };

  try {
    const bytes = readFileSync(resolve(templatesDir, pdfFile));
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    const allFields = new Set(form.getFields().map(f => f.getName()));

    for (const [engineKey, mapping] of Object.entries(fieldMap)) {
      // Skip base/placeholder fields (e.g., f8949 base row fields)
      if (mapping.pdfFieldName.startsWith('f8949_') && !mapping.pdfFieldName.startsWith('topmostSubform')) {
        continue;
      }

      result.totalMappings++;

      if (allFields.has(mapping.pdfFieldName)) {
        result.found++;

        // Try to actually set the value
        try {
          const pdfField = form.getField(mapping.pdfFieldName);
          if (mapping.type === 'text' && pdfField instanceof PDFTextField) {
            pdfField.setText('TEST');
          } else if (mapping.type === 'checkbox' && pdfField instanceof PDFCheckBox) {
            pdfField.check();
          }
        } catch (e) {
          result.errors.push(`${engineKey} -> "${mapping.pdfFieldName}": set failed: ${e}`);
        }
      } else {
        result.missing.push(`${engineKey} -> "${mapping.pdfFieldName}"`);
      }
    }
  } catch (e) {
    result.errors.push(`Failed to load PDF: ${e}`);
  }

  return result;
}

async function main() {
  const forms: [string, string, FieldMap][] = [
    ['Form 1040', 'f1040.pdf', f1040FieldMap],
    ['Schedule 1', 'schedule-1.pdf', schedule1FieldMap],
    ['Schedule 2', 'schedule-2.pdf', schedule2FieldMap],
    ['Schedule 3', 'schedule-3.pdf', schedule3FieldMap],
    ['Schedule A', 'schedule-a.pdf', scheduleAFieldMap],
    ['Schedule B', 'schedule-b.pdf', scheduleBFieldMap],
    ['Schedule C', 'schedule-c.pdf', scheduleCFieldMap],
    ['Schedule D', 'schedule-d.pdf', scheduleDFieldMap],
    ['Schedule SE', 'schedule-se.pdf', scheduleSEFieldMap],
    ['Form 8949', 'f8949.pdf', f8949FieldMap],
    ['Form 8959', 'f8959.pdf', f8959FieldMap],
    ['Form 8960', 'f8960.pdf', f8960FieldMap],
    ['IT-201', 'it-201.pdf', it201FieldMap],
  ];

  let totalFound = 0;
  let totalMissing = 0;
  let totalMappings = 0;

  for (const [name, file, fieldMap] of forms) {
    const result = await verifyForm(name, file, fieldMap);
    totalMappings += result.totalMappings;
    totalFound += result.found;
    totalMissing += result.missing.length;

    const status = result.missing.length === 0 && result.errors.length === 0 ? 'OK' : 'ISSUES';
    console.log(`\n[${status}] ${result.form}: ${result.found}/${result.totalMappings} fields found`);

    if (result.missing.length > 0) {
      console.log(`  Missing fields:`);
      for (const m of result.missing) {
        console.log(`    - ${m}`);
      }
    }

    if (result.errors.length > 0) {
      console.log(`  Errors:`);
      for (const e of result.errors) {
        console.log(`    - ${e}`);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${totalFound}/${totalMappings} field mappings verified (${totalMissing} missing)`);
  console.log(`${'='.repeat(60)}`);

  if (totalMissing > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
