// Field Map Registry
// Central lookup for field maps by FormId.

import type { FormId } from '../types';
import type { FieldMap } from './types';
import { f1040FieldMap } from './f1040';
import { schedule1FieldMap } from './schedule1';
import { scheduleAFieldMap } from './scheduleA';
import { scheduleBFieldMap } from './scheduleB';
import { scheduleCFieldMap } from './scheduleC';
import { scheduleDFieldMap } from './scheduleD';
import { scheduleSEFieldMap } from './scheduleSE';
import { schedule2FieldMap } from './schedule2';
import { schedule3FieldMap } from './schedule3';
import { f8949FieldMap } from './f8949';
import { f8959FieldMap } from './f8959';
import { f8960FieldMap } from './f8960';
import { it201FieldMap } from './it201';

const registry: Record<FormId, FieldMap> = {
  f1040: f1040FieldMap,
  schedule1: schedule1FieldMap,
  scheduleA: scheduleAFieldMap,
  scheduleB: scheduleBFieldMap,
  scheduleC: scheduleCFieldMap,
  scheduleD: scheduleDFieldMap,
  scheduleSE: scheduleSEFieldMap,
  schedule2: schedule2FieldMap,
  schedule3: schedule3FieldMap,
  f8949: f8949FieldMap,
  f8959: f8959FieldMap,
  f8960: f8960FieldMap,
  it201: it201FieldMap,
};

/**
 * Get the field map for a given form ID.
 *
 * @param formId - The form identifier
 * @returns The field map for that form
 */
export function getFieldMap(formId: FormId): FieldMap {
  return registry[formId];
}
