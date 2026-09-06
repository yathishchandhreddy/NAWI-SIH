/**
 * OIML R 76-1:2006 Maximum Permissible Error (MPE) Rule Engine
 * 
 * Implements authoritative metrological rules from:
 * - OIML R 76-1 Clause 3.5.1, Table 6 (Initial Verification MPE)
 * - OIML R 76-1 Clause 3.5.2 (In-Service / Subsequent MPE)
 * - OIML R 76-1 Clause 3.3.1 (Multi-Interval Partial Ranges)
 */

import { Instrument, MpeRuleResult, AccuracyClass, MultiIntervalRange } from '../types';
import { convertMass, roundToPrecision, formatCleanNumber } from './unitConversion';
import { canonicalizeAccuracyClass } from './validation';

export type VerificationType = 'initial' | 'service';

export interface MpeEngineOptions {
  verificationType?: VerificationType;
  customE?: number; // e.g. for tare net load or partial range override
}

/**
 * Resolves active verification scale interval e for single or multi-interval instruments.
 * Clause 3.3.1: For multi-interval instruments, e_i applies where Max_(i-1) < m <= Max_i.
 */
export function resolveActiveScaleInterval(
  instrument: Instrument,
  testLoad: number
): {
  activeE: number;
  activeEUnit: 'kg' | 'g' | 'mg';
  activeRangeIndex?: number;
  isMultiInterval: boolean;
} {
  if (
    instrument.multiInterval &&
    instrument.multiIntervalRanges &&
    instrument.multiIntervalRanges.length > 0
  ) {
    // Sort ranges ascending by max
    const sortedRanges = [...instrument.multiIntervalRanges].sort((a, b) => a.max - b.max);

    for (let i = 0; i < sortedRanges.length; i++) {
      const range = sortedRanges[i];
      if (testLoad <= range.max + 1e-9 || i === sortedRanges.length - 1) {
        return {
          activeE: range.e,
          activeEUnit: instrument.intervalUnit,
          activeRangeIndex: range.rangeIndex || i + 1,
          isMultiInterval: true,
        };
      }
    }
  }

  return {
    activeE: instrument.e,
    activeEUnit: instrument.intervalUnit,
    isMultiInterval: false,
  };
}

/**
 * Evaluates OIML R 76-1 Table 6 MPE limits.
 */
export function calculateR76MPE(
  instrument: Instrument,
  testLoad: number,
  options: MpeEngineOptions = {}
): MpeRuleResult {
  const verificationType = options.verificationType || 'initial';
  const cClass = canonicalizeAccuracyClass(instrument.accuracyClass);

  // 1. Resolve active verification scale interval e
  const { activeE, activeEUnit, activeRangeIndex, isMultiInterval } =
    resolveActiveScaleInterval(instrument, testLoad);

  // Convert active e to capacity unit for consistent calculation with testLoad
  const eInCapUnit = convertMass(activeE, activeEUnit, instrument.capacityUnit);

  // Safety check per Section 16: Never silently invent or allow e <= 0
  if (eInCapUnit <= 0 || isNaN(eInCapUnit)) {
    return {
      testLoad,
      testLoadUnit: instrument.capacityUnit,
      accuracyClass: instrument.accuracyClass,
      e: 0,
      eUnit: activeEUnit,
      scaleIntervals: 0,
      mpeE: 0,
      mpe: 0,
      mpeUnit: instrument.capacityUnit,
      ruleDescription:
        'Applicable R76 rule could not be determined from the available instrument configuration (Invalid scale interval e).',
      sourceReference: 'OIML R 76-1:2006 Requirement Configuration Failure',
      applicableRangeDescription: 'Indeterminate',
      isMultiInterval,
      activeRangeIndex,
    };
  }

  // Calculate load in verification scale intervals: m / e
  const absLoad = Math.abs(testLoad);
  const scaleIntervals = roundToPrecision(absLoad / eInCapUnit, 2);

  // 2. Determine base MPE coefficient in e from Table 6
  let baseMpeE = 1.0;
  let rangeDesc = '';
  let tableRef = 'OIML R 76-1:2006 Clause 3.5.1, Table 6';

  switch (cClass) {
    case 'I':
      if (scaleIntervals <= 50000) {
        baseMpeE = 0.5;
        rangeDesc = '0 ≤ m ≤ 50,000 e';
      } else if (scaleIntervals <= 200000) {
        baseMpeE = 1.0;
        rangeDesc = '50,000 e < m ≤ 200,000 e';
      } else {
        baseMpeE = 1.5;
        rangeDesc = 'm > 200,000 e';
      }
      break;

    case 'II':
      if (scaleIntervals <= 5000) {
        baseMpeE = 0.5;
        rangeDesc = '0 ≤ m ≤ 5,000 e';
      } else if (scaleIntervals <= 20000) {
        baseMpeE = 1.0;
        rangeDesc = '5,000 e < m ≤ 20,000 e';
      } else {
        baseMpeE = 1.5;
        rangeDesc = 'm > 20,000 e';
      }
      break;

    case 'III':
      if (scaleIntervals <= 500) {
        baseMpeE = 0.5;
        rangeDesc = '0 ≤ m ≤ 500 e';
      } else if (scaleIntervals <= 2000) {
        baseMpeE = 1.0;
        rangeDesc = '500 e < m ≤ 2,000 e';
      } else {
        baseMpeE = 1.5;
        rangeDesc = 'm > 2,000 e';
      }
      break;

    case 'IIII':
      if (scaleIntervals <= 50) {
        baseMpeE = 0.5;
        rangeDesc = '0 ≤ m ≤ 50 e';
      } else if (scaleIntervals <= 200) {
        baseMpeE = 1.0;
        rangeDesc = '50 e < m ≤ 200 e';
      } else {
        baseMpeE = 1.5;
        rangeDesc = 'm > 200 e';
      }
      break;
  }

  // 3. In-service factor (Clause 3.5.2)
  const serviceMultiplier = verificationType === 'service' ? 2.0 : 1.0;
  const finalMpeE = baseMpeE * serviceMultiplier;

  // 4. Absolute MPE in capacity unit
  const mpeValue = roundToPrecision(finalMpeE * eInCapUnit, 6);

  // Description building
  const multiInfo = isMultiInterval
    ? ` [Multi-Interval Range ${activeRangeIndex}: e_${activeRangeIndex} = ${activeE} ${activeEUnit}]`
    : '';

  const verificationNote = verificationType === 'service' ? ' (In-Service 2× MPE per Clause 3.5.2)' : '';

  const ruleDescription = `Class ${instrument.accuracyClass} Range (${rangeDesc}): MPE = ±${finalMpeE} e = ±${formatCleanNumber(
    mpeValue,
    4
  )} ${instrument.capacityUnit}${multiInfo}${verificationNote}`;

  const sourceReference =
    verificationType === 'service'
      ? `${tableRef} & Clause 3.5.2`
      : `${tableRef} (Class ${instrument.accuracyClass})`;

  return {
    testLoad,
    testLoadUnit: instrument.capacityUnit,
    accuracyClass: instrument.accuracyClass,
    e: activeE,
    eUnit: activeEUnit,
    scaleIntervals,
    mpeE: finalMpeE,
    mpe: mpeValue,
    mpeUnit: instrument.capacityUnit,
    ruleDescription,
    sourceReference,
    applicableRangeDescription: rangeDesc,
    isMultiInterval,
    activeRangeIndex,
  };
}
