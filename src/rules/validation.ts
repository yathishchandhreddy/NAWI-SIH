/**
 * OIML R 76-1:2006 Metrological Parameter & Instrument Validation Service
 * 
 * Implements strict compliance verification against:
 * - Clause 3.2, Table 3: Principles of classification (Accuracy class, e, n, Min)
 * - Clause 3.3: Multi-interval parameters
 * - Clause 3.4.1: Auxiliary indicating devices (relationship between d and e)
 * - Section 15 of System Requirements: Input sanity & boundary preconditions
 */

import { Instrument, InstrumentValidationResult, AccuracyClass } from '../types';
import { convertMass, roundToPrecision } from './unitConversion';

export interface ClassLimits {
  nMin: number;
  nMax: number;
  minMultipleOfE: number;
  minEInGrams: number;
}

/**
 * Normalizes AccuracyClass representation ('IV' -> 'IIII')
 */
export function canonicalizeAccuracyClass(cls: AccuracyClass | string): 'I' | 'II' | 'III' | 'IIII' {
  if (cls === 'IV' || cls === 'IIII') return 'IIII';
  if (cls === 'I') return 'I';
  if (cls === 'II') return 'II';
  return 'III';
}

/**
 * Returns the official OIML R 76-1 Table 3 limits for a given class and verification scale interval e.
 */
export function getTable3Limits(
  accuracyClass: AccuracyClass | string,
  eInGrams: number
): ClassLimits {
  const cClass = canonicalizeAccuracyClass(accuracyClass);

  switch (cClass) {
    case 'I':
      return {
        nMin: 50000,
        nMax: Infinity,
        minMultipleOfE: 100,
        minEInGrams: 0.001, // 1 mg
      };

    case 'II':
      if (eInGrams < 0.1) {
        return {
          nMin: 100,
          nMax: 100000,
          minMultipleOfE: 20,
          minEInGrams: 0.001,
        };
      }
      return {
        nMin: 5000,
        nMax: 100000,
        minMultipleOfE: 50,
        minEInGrams: 0.1,
      };

    case 'III':
      if (eInGrams < 5.0) {
        return {
          nMin: 100,
          nMax: 10000,
          minMultipleOfE: 20,
          minEInGrams: 0.1,
        };
      }
      return {
        nMin: 500,
        nMax: 10000,
        minMultipleOfE: 20,
        minEInGrams: 0.1,
      };

    case 'IIII':
      return {
        nMin: 100,
        nMax: 1000,
        minMultipleOfE: 10,
        minEInGrams: 5.0,
      };
  }
}

/**
 * Validates complete instrument metrological configuration against OIML R 76-1:2006.
 */
export function validateInstrumentMetrology(
  instrument: Instrument
): InstrumentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Basic numeric positivity checks
  if (!instrument.maxCapacity || instrument.maxCapacity <= 0) {
    errors.push('Maximum capacity (Max) must be strictly greater than 0.');
  }

  if (instrument.minCapacity === undefined || instrument.minCapacity < 0) {
    errors.push('Minimum capacity (Min) cannot be negative.');
  }

  if (instrument.maxCapacity && instrument.minCapacity && instrument.minCapacity > instrument.maxCapacity) {
    errors.push(`Minimum capacity (${instrument.minCapacity}) cannot exceed Maximum capacity (${instrument.maxCapacity}).`);
  }

  if (!instrument.e || instrument.e <= 0) {
    errors.push('Verification scale interval (e) must be strictly greater than 0.');
  }

  if (instrument.d !== undefined && instrument.d <= 0) {
    errors.push('Actual scale interval (d) must be greater than 0.');
  }

  // If basic positivity fails, return early
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
      n: 0,
      nMinRequired: 0,
      nMaxAllowed: 0,
      minAllowed: 0,
      details: {
        accuracyClass: instrument.accuracyClass,
        max: instrument.maxCapacity || 0,
        min: instrument.minCapacity || 0,
        e: instrument.e || 0,
        d: instrument.d || 0,
        n: 0,
      },
    };
  }

  // 2. Unit conversion to base units for standard comparison
  const eInGrams = convertMass(instrument.e, instrument.intervalUnit, 'g');
  const dInGrams = instrument.d ? convertMass(instrument.d, instrument.intervalUnit, 'g') : eInGrams;
  const maxInGrams = convertMass(instrument.maxCapacity, instrument.capacityUnit, 'g');
  const minInGrams = convertMass(instrument.minCapacity, instrument.capacityUnit, 'g');

  // e in capacity units
  const eInCapUnit = convertMass(instrument.e, instrument.intervalUnit, instrument.capacityUnit);

  // 3. Number of verification scale intervals: n = Max / e
  const n = roundToPrecision(maxInGrams / eInGrams, 2);

  // 4. Check against OIML R 76-1 Table 3 limits
  const limits = getTable3Limits(instrument.accuracyClass, eInGrams);
  const minAllowedInGrams = limits.minMultipleOfE * eInGrams;
  const minAllowedInCapUnit = convertMass(minAllowedInGrams, 'g', instrument.capacityUnit);

  // Verification scale interval e minimum check
  if (eInGrams < limits.minEInGrams - 1e-9) {
    errors.push(
      `OIML R 76-1 Table 3 Violation: For Class ${instrument.accuracyClass}, verification scale interval e must be >= ${limits.minEInGrams} g (current e = ${eInGrams} g).`
    );
  }

  // Number of scale intervals n check
  if (n < limits.nMin) {
    errors.push(
      `OIML R 76-1 Table 3 Violation: For Class ${instrument.accuracyClass}, number of verification scale intervals n = Max/e must be >= ${limits.nMin} (calculated n = ${Math.round(n)}).`
    );
  }

  if (limits.nMax !== Infinity && n > limits.nMax) {
    errors.push(
      `OIML R 76-1 Table 3 Violation: For Class ${instrument.accuracyClass}, number of verification scale intervals n = Max/e must be <= ${limits.nMax} (calculated n = ${Math.round(n)}).`
    );
  }

  // Min capacity check: Min >= minMultipleOfE * e
  if (minInGrams < minAllowedInGrams - 1e-9) {
    warnings.push(
      `OIML R 76-1 Table 3 Warning: Minimum capacity Min (${instrument.minCapacity} ${instrument.capacityUnit}) is below recommended Min = ${limits.minMultipleOfE} e (${roundToPrecision(minAllowedInCapUnit, 4)} ${instrument.capacityUnit}).`
    );
  }

  // 5. Scale intervals relationship: Clause 3.4.1 (d <= e <= 10d)
  if (dInGrams > eInGrams + 1e-9) {
    errors.push(
      `OIML R 76-1 Clause 3.1.2 Violation: Actual scale interval d (${instrument.d} ${instrument.intervalUnit}) cannot exceed verification scale interval e (${instrument.e} ${instrument.intervalUnit}).`
    );
  }

  if (dInGrams < eInGrams) {
    // Has auxiliary indicating device
    const cClass = canonicalizeAccuracyClass(instrument.accuracyClass);
    if (cClass !== 'I' && cClass !== 'II') {
      errors.push(
        `OIML R 76-1 Clause 3.4.1 Violation: Auxiliary indicating devices (d < e) are only permitted for Class I and Class II instruments.`
      );
    }
    if (eInGrams > 10 * dInGrams + 1e-9) {
      errors.push(
        `OIML R 76-1 Clause 3.4.1 Violation: For auxiliary indicating devices, e must be <= 10 d (current e = ${instrument.e}, 10d = ${10 * instrument.d}).`
      );
    }
  }

  // 6. Multi-interval validation (if configured)
  if (instrument.multiInterval && instrument.multiIntervalRanges && instrument.multiIntervalRanges.length > 0) {
    let prevMax = 0;
    let prevE = 0;
    instrument.multiIntervalRanges.forEach((range, idx) => {
      if (range.max <= prevMax) {
        errors.push(`Multi-interval Range ${idx + 1}: Max (${range.max}) must be greater than previous range Max (${prevMax}).`);
      }
      if (range.e <= prevE && idx > 0) {
        errors.push(`Multi-interval Range ${idx + 1}: Verification scale interval e (${range.e}) must be greater than previous range e (${prevE}).`);
      }
      prevMax = range.max;
      prevE = range.e;
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    n: Math.round(n),
    nMinRequired: limits.nMin,
    nMaxAllowed: limits.nMax,
    minAllowed: roundToPrecision(minAllowedInCapUnit, 4),
    details: {
      accuracyClass: instrument.accuracyClass,
      max: instrument.maxCapacity,
      min: instrument.minCapacity,
      e: instrument.e,
      d: instrument.d || instrument.e,
      n: Math.round(n),
    },
  };
}

/**
 * Validates a test load against instrument Max capacity.
 * R76 allows testing up to Max + 9e.
 */
export function validateTestLoad(
  instrument: Instrument,
  testLoad: number
): { isValid: boolean; error?: string } {
  if (testLoad < 0) {
    return { isValid: false, error: 'Test load cannot be negative.' };
  }

  const eInCapUnit = convertMass(instrument.e, instrument.intervalUnit, instrument.capacityUnit);
  const overloadLimit = instrument.maxCapacity + 9 * eInCapUnit;

  if (testLoad > overloadLimit + 1e-9) {
    return {
      isValid: false,
      error: `Test load (${testLoad} ${instrument.capacityUnit}) exceeds maximum permissible overload limit Max + 9e (${roundToPrecision(overloadLimit, 4)} ${instrument.capacityUnit}).`,
    };
  }

  return { isValid: true };
}
