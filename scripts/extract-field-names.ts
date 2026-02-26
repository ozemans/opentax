import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function extractFields(pdfPath: string) {
  const bytes = readFileSync(pdfPath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields();

  console.log(`\n=== ${pdfPath} ===`);
  console.log(`Total fields: ${fields.length}\n`);

  for (const field of fields) {
    const name = field.getName();
    const type = field.constructor.name;
    console.log(`  ${type}: "${name}"`);
  }
}

const templatesDir = resolve(__dirname, '../public/pdf-templates');
const files = [
  'f1040.pdf', 'schedule-1.pdf', 'schedule-2.pdf', 'schedule-3.pdf',
  'schedule-a.pdf', 'schedule-b.pdf', 'schedule-c.pdf', 'schedule-d.pdf',
  'schedule-se.pdf', 'f8949.pdf', 'f8959.pdf', 'f8960.pdf', 'it-201.pdf'
];

(async () => {
  for (const f of files) {
    try {
      await extractFields(resolve(templatesDir, f));
    } catch (e) {
      console.error(`Failed to extract from ${f}:`, e);
    }
  }
})();
