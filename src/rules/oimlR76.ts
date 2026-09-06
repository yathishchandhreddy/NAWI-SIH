/**
 * OIML Recommendation R 76-1:2006 Calculation & MPE Rule Engine
 * 
 * Non-Automatic Weighing Instruments (NAWI)
 * Implements R76-based calculation and testing logic strictly referenced to
 * the official OIML Recommendation R 76-1 Edition 2006 (E).
 * 
 * Authoritative Clauses:
 * - Clause 3.2, Table 3: Classification, e, n, Min
 * - Clause 3.3: Multi-interval partial ranges
 * - Clause 3.4.1: Auxiliary indicating devices (d <= e <= 10d)
 * - Clause 3.5.1, Table 6: Maximum permissible errors on initial verification
 * - Clause 3.5.2: Maximum permissible errors in service
 * - Clause 3.5.3.1 & A.4.4.3: Calculation of indication error E = I - L
 * - Clause 3.6.1 & A.4.10: Repeatability spread limit
 * - Clause 3.6.2 & A.4.7: Eccentricity corner load limits
 * - Clause 3.8.2.2 & A.4.8: Discrimination with extra load 1.4 d
 * - Clause 4.5.2 & A.4.2 / A.4.3: Zero-setting and zero-return limits
 * - Clause 4.6 & A.4.6: Tare weighing accuracy
 */

import {
  AccuracyClass,
  Instrument,
  WeighingPoint,
  RepeatabilityData,
  EccentricityData,
  ZeroTareData,
  DiscriminationData,
  TestPlanItem,
  MpeRuleResult,
  CalculationTrace,
} from '../types';

import { convertMass, formatMass, roundToPrecision, formatCleanNumber } from './unitConversion';
import { calculateR76MPE, resolveActiveScaleInterval, VerificationType } from './mpeEngine';
import { validateInstrumentMetrology, validateTestLoad } from './validation';
import { evaluateTestApplicability, buildTestPlanFromApplicability } from './applicabilityEngine';
import {
  evaluateWeighingPointR76,
  evaluateRepeatabilityR76,
  evaluateEccentricityR76,
  evaluateZeroTareR76,
  evaluateDiscriminationR76,
  UserFacingExplanation,
} from './calculationEngine';

// Re-export modular components for deep traceability access
export * from './unitConversion';
export * from './oimlRuleMetadata';
export * from './validation';
export * from './mpeEngine';
export * from './applicabilityEngine';
export * from './calculationEngine';
export * from './oimlR76.test';

/**
 * Normalizes 'e' (verification scale interval) into the same unit as Max capacity.
 */
export function getEInCapacityUnit(instrument: Instrument): number {
  return convertMass(instrument.e, instrument.intervalUnit, instrument.capacityUnit);
}

/**
 * Normalizes 'd' (actual display scale interval) into the same unit as Max capacity.
 */
export function getDInCapacityUnit(instrument: Instrument): number {
  const dVal = instrument.d !== undefined ? instrument.d : instrument.e;
  return convertMass(dVal, instrument.intervalUnit, instrument.capacityUnit);
}

/**
 * Formats float to max precision without scientific notation noise.
 */
export function formatValue(val: number, precision = 4): string {
  return formatCleanNumber(val, precision);
}

export interface MpeEvaluation {
  mpeE: number; // in multiples of e (±0.5, ±1.0, ±1.5)
  mpeAbsolute: number; // in capacity unit
  scaleIntervals: number; // m / e
  ruleReference: string;
  formula: string;
}

/**
 * Evaluates Maximum Permissible Error (MPE) for a given test load m.
 * Delegates to the official OIML R 76-1 Table 6 Rule Engine.
 */
export function calculateMPE(
  instrument: Instrument,
  testLoad: number,
  verificationType: VerificationType = 'initial'
): MpeEvaluation {
  const result: MpeRuleResult = calculateR76MPE(instrument, testLoad, { verificationType });
  return {
    mpeE: result.mpeE,
    mpeAbsolute: result.mpe,
    scaleIntervals: result.scaleIntervals,
    ruleReference: result.ruleDescription,
    formula: `MPE = ±${result.mpeE} e = ±${formatCleanNumber(result.mpe, 4)} ${instrument.capacityUnit}`,
  };
}

/**
 * Evaluates Weighing Performance point using OIML R 76-1:2006 Clause 3.5.3.1.
 */
export function evaluateWeighingPoint(
  instrument: Instrument,
  referenceLoad: number,
  indicatedLoad: number,
  direction: 'increasing' | 'decreasing' = 'increasing',
  pointId = `wp-${Date.now()}`
): WeighingPoint {
  const { point } = evaluateWeighingPointR76(
    instrument,
    referenceLoad,
    indicatedLoad,
    direction,
    pointId
  );
  return point;
}

/**
 * Evaluates Repeatability Test per OIML R 76-1:2006 Clause 3.6.1 & A.4.10.
 */
export function evaluateRepeatability(
  instrument: Instrument,
  testLoad: number,
  readings: number[]
): RepeatabilityData {
  const { data } = evaluateRepeatabilityR76(instrument, testLoad, readings);
  return data;
}

/**
 * Evaluates Eccentricity Test per OIML R 76-1:2006 Clause 3.6.2 & A.4.7.
 */
export function evaluateEccentricity(
  instrument: Instrument,
  testLoad: number,
  centerReading: number,
  positionsInput: { id: string; name: string; description: string; reading: number }[]
): EccentricityData {
  const { data } = evaluateEccentricityR76(instrument, testLoad, centerReading, positionsInput);
  return data;
}

/**
 * Evaluates Zero and Tare Test per OIML R 76-1:2006 Clauses 4.5.2, 4.6 & A.4.3.
 */
export function evaluateZeroTare(
  instrument: Instrument,
  initialZeroReading: number,
  tareLoad: number,
  indicatedNet: number,
  returnToZeroReading: number
): ZeroTareData {
  const { data } = evaluateZeroTareR76(
    instrument,
    initialZeroReading,
    tareLoad,
    indicatedNet,
    returnToZeroReading
  );
  return data;
}

/**
 * Evaluates Discrimination / Sensitivity Test per OIML R 76-1:2006 Clause 3.8.2.2 & A.4.8.
 */
export function evaluateDiscrimination(
  instrument: Instrument,
  baseLoad: number,
  initialIndication: number,
  newIndication: number
): DiscriminationData {
  const { data } = evaluateDiscriminationR76(
    instrument,
    baseLoad,
    initialIndication,
    newIndication
  );
  return data;
}

/**
 * Determines which tests are applicable to an instrument configuration.
 */
export function determineApplicableTests(instrument: Instrument): TestPlanItem[] {
  return buildTestPlanFromApplicability(instrument);
}
