import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const bytes = readFileSync(resolve(__dirname, '../public/pdf-templates/f1040.pdf'));
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();
  const fields = form.getFields();

  for (const f of fields) {
    const name = f.getName();
    if (name.includes('Page1') && (name.includes('f1_0') || name.includes('f1_1'))) {
      const type = f.constructor.name;
      let extra = '';
      if (type === 'PDFTextField') {
        try {
          const tf = form.getTextField(name);
          const ml = tf.getMaxLength();
          if (ml !== undefined) {
            extra = ` maxLen=${ml}`;
          }
        } catch (e) {
          // ignore
        }
      }
      console.log(`${type}: ${name}${extra}`);
    }
  }
}

main();
