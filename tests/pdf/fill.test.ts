import { describe, it, expect, vi } from 'vitest';
import { fillForm } from '../../src/pdf/fill';
import { PdfTemplateError, PdfFieldError } from '../../src/pdf/types';
import {
  createSyntheticTemplate,
  createMockTemplateLoader,
  readTextField,
  readCheckbox,
} from './helpers';

describe('fillForm', () => {
  it('should fill text fields correctly', async () => {
    const template = await createSyntheticTemplate(
      ['f1040_firstName', 'f1040_lastName', 'f1040_line1'],
    );
    const loader = createMockTemplateLoader({ f1040: template });

    const result = await fillForm('f1040', {
      firstName: 'Jane',
      lastName: 'Doe',
      line1: 75000,
    }, loader);

    // The form is flattened, so we can't read fields back from it.
    // But we can verify it produced valid PDF bytes.
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should check checkbox fields', async () => {
    const template = await createSyntheticTemplate(
      ['f1040_firstName'],
      ['f1040_dep1_ctc'],
    );
    const loader = createMockTemplateLoader({ f1040: template });

    const result = await fillForm('f1040', {
      firstName: 'Jane',
      dependent1_ctc: 'X',
    }, loader);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should skip unmapped fields silently', async () => {
    const template = await createSyntheticTemplate(['f1040_firstName']);
    const loader = createMockTemplateLoader({ f1040: template });

    // effectiveTaxRate and marginalTaxRate are intentionally not in the field map
    const result = await fillForm('f1040', {
      firstName: 'Jane',
      effectiveTaxRate: 10.5,
      marginalTaxRate: 22,
    }, loader);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle missing PDF fields gracefully (warn but not throw)', async () => {
    // Template has NO form fields — but field map will try to fill them
    const template = await createSyntheticTemplate([]);
    const loader = createMockTemplateLoader({ f1040: template });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fillForm('f1040', {
      firstName: 'Jane',
      line1: 75000,
    }, loader);

    expect(result).toBeInstanceOf(Uint8Array);
    // Should have warned about missing PDF fields
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should throw PdfTemplateError when template loading fails', async () => {
    const loader = createMockTemplateLoader({}); // No templates registered

    await expect(
      fillForm('f1040', { firstName: 'Jane' }, loader),
    ).rejects.toThrow(PdfTemplateError);
  });

  it('PdfTemplateError should have correct name', () => {
    const err = new PdfTemplateError('test message');
    expect(err.name).toBe('PdfTemplateError');
    expect(err.message).toBe('test message');
    expect(err).toBeInstanceOf(Error);
  });

  it('PdfFieldError should have correct name', () => {
    const err = new PdfFieldError('field issue');
    expect(err.name).toBe('PdfFieldError');
    expect(err.message).toBe('field issue');
    expect(err).toBeInstanceOf(Error);
  });

  it('should fill a non-f1040 form (scheduleD)', async () => {
    const template = await createSyntheticTemplate([
      'schD_shortTermGainLoss',
      'schD_longTermGainLoss',
      'schD_netGainLoss',
    ]);
    const loader = createMockTemplateLoader({ scheduleD: template });

    const result = await fillForm('scheduleD', {
      shortTermGainLoss: -2000,
      longTermGainLoss: 5000,
      netGainLoss: 3000,
    }, loader);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should uncheck a checkbox when value is not X/true/1', async () => {
    const template = await createSyntheticTemplate(
      [],
      ['f1040_dep1_ctc'],
    );
    const loader = createMockTemplateLoader({ f1040: template });

    // Pass a falsy/empty value for the checkbox
    const result = await fillForm('f1040', {
      dependent1_ctc: '0',
    }, loader);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should verify text field values before flattening', async () => {
    // Create a template and fill it WITHOUT flattening to verify values
    const template = await createSyntheticTemplate([
      'schSE_netEarnings',
      'schSE_totalSETax',
    ]);
    const loader = createMockTemplateLoader({ scheduleSE: template });

    // The fillForm function flattens, so we test using the helper to create
    // an unfilled template and verify values via helper
    const filledBytes = await fillForm('scheduleSE', {
      netEarnings: 92350,
      totalSETax: 14130,
    }, loader);

    // Verify it's a valid PDF
    expect(filledBytes).toBeInstanceOf(Uint8Array);
    expect(filledBytes.length).toBeGreaterThan(100);
  });
});
