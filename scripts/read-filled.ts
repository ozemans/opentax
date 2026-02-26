// Read back all filled fields from a PDF and show their values + positions.
// Usage: npx tsx scripts/read-filled.ts [path-to-pdf]
import { readFileSync } from "fs";
import { PDFDocument, PDFTextField, PDFCheckBox } from "pdf-lib";

async function main() {
  const path = process.argv[2] || "wilson-family-1040.pdf";
  const bytes = readFileSync(path);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();

  for (const f of form.getFields()) {
    let v = "";
    if (f instanceof PDFTextField) v = f.getText() || "";
    else if (f instanceof PDFCheckBox) v = f.isChecked() ? "CHK" : "";
    if (!v) continue;

    const n = f.getName().split("topmostSubform[0].").pop() || f.getName();
    const w = f.acroField.getWidgets();
    const r = w[0]?.getRectangle();
    const p = r
      ? `x:${Math.round(r.x)} y:${Math.round(r.y)}`
      : "";
    console.log(`${n}  =  ${v}  ${p}`);
  }
}
main();
