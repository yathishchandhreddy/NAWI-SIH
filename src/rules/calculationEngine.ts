/**
 * OIML R 76-1:2006 Metrological Calculation Engine
 * 
 * Implements authoritative mathematical evaluations for:
 * - Weighing Performance (Indication Error & MPE compliance, Clause 3.5.1, 3.5.3, A.4.4)
 * - Repeatability (Indication spread, Clause 3.6.1, A.4.10)
 * - Eccentricity (Corner / off-center load distribution, Clause 3.6.2, A.4.7)
 * - Zero-Setting & Zero-Return (Clause 4.5.2, A.4.2, A.4.3)
 * - Tare Device (Clause 3.5.3.3, 4.6, A.4.6)
 * - Discrimination / Sensitivity (Clause 3.8.2.2, A.4.8)
 */

import {
  Instrument,
  WeighingPoint,
  RepeatabilityData,
  EccentricityData,
  EccentricityPosition,
  ZeroTareData,
  DiscriminationData,
  CalculationTrace,
} from '../types';
import { convertMass, formatMass, roundToPrecision, formatCleanNumber } from './unitConversion';
import { calculateR76MPE } from './mpeEngine';
import { validateInstrumentMetrology, validateTestLoad } from './validation';

/**
 * Result structure for user-facing calculation explanation.
 */
export interface UserFacingExplanation {
  referenceLoadFormatted: string;
  indicationFormatted: string;
  errorFormatted: string;
  absoluteErrorFormatted: string;
  applicableMpeFormatted: string;
  decision: 'PASS' | 'FAIL';
  reason: string;
  ruleDescription: string;
  clauseCitation: string;
}

/**
 * Evaluates a single Weighing Performance test point.
 * Error E = I - L per OIML R 76-1 Clause 3.5.3.1.
 * Decision: PASS when |E| <= MPE, FAIL otherwise.
 */
export function evaluateWeighingPointR76(
  instrument: Instrument,
  referenceLoad: number,
  indicatedLoad: number,
  direction: 'increasing' | 'decreasing' = 'increasing',
  pointId = `wp-${Date.now()}-${Math.floor(Math.random() * 1000)}`
): { point: WeighingPoint; trace: CalculationTrace; explanation: UserFacingExplanation } {
  // 1. Validation check
  const loadVal = validateTestLoad(instrument, referenceLoad);
  if (!loadVal.isValid) {
    throw new Error(loadVal.error || 'Invalid test load.');
  }

  // 2. Indication error: E = I - L
  const error = roundToPrecision(indicatedLoad - referenceLoad, 6);
  const absoluteError = roundToPrecision(Math.abs(error), 6);

  // 3. Determine dynamic MPE from rule engine
  const mpeResult = calculateR76MPE(instrument, referenceLoad);
  const toleranceEps = 1e-9;
  const passed = absoluteError <= mpeResult.mpe + toleranceEps;

  // 4. Percentage of Max
  const loadPercentage =
    instrument.maxCapacity > 0
      ? Math.round((referenceLoad / instrument.maxCapacity) * 100)
      : 0;

  // 5. User-facing explanation details
  const sign = error >= 0 ? '+' : '';
  const refFormatted = `${formatCleanNumber(referenceLoad, 4)} ${instrument.capacityUnit}`;
  const indFormatted = `${formatCleanNumber(indicatedLoad, 4)} ${instrument.capacityUnit}`;
  const errFormatted = `${sign}${formatCleanNumber(error, 4)} ${instrument.capacityUnit}`;
  const absErrFormatted = `${formatCleanNumber(absoluteError, 4)} ${instrument.capacityUnit}`;
  const mpeFormatted = `±${formatCleanNumber(mpeResult.mpe, 4)} ${instrument.capacityUnit} (±${mpeResult.mpeE} e)`;

  const reason = passed
    ? `Absolute error (${absErrFormatted}) is within the applicable maximum permissible error (${mpeFormatted}).`
    : `Absolute error (${absErrFormatted}) exceeds the applicable maximum permissible error (${mpeFormatted}) by ${formatCleanNumber(
        absoluteError - mpeResult.mpe,
        4
      )} ${instrument.capacityUnit}.`;

  const comparisonText = `|${errFormatted}| ${passed ? '≤' : '>'} ${mpeFormatted}`;

  const explanation: UserFacingExplanation = {
    referenceLoadFormatted: refFormatted,
    indicationFormatted: indFormatted,
    errorFormatted: errFormatted,
    absoluteErrorFormatted: absErrFormatted,
    applicableMpeFormatted: mpeFormatted,
    decision: passed ? 'PASS' : 'FAIL',
    reason,
    ruleDescription: mpeResult.ruleDescription,
    clauseCitation: mpeResult.sourceReference,
  };

  const point: WeighingPoint = {
    id: pointId,
    loadPercentage,
    referenceLoad,
    indicatedLoad,
    error,
    absoluteError,
    scaleIntervals: Math.round(mpeResult.scaleIntervals),
    applicableMpeE: mpeResult.mpeE,
    applicableMpeAbsolute: mpeResult.mpe,
    comparisonText,
    passed,
    direction,
    ruleReference: mpeResult.ruleDescription,
    reason,
    formula: `E = I - L = ${indFormatted} - ${refFormatted} = ${errFormatted}; |E| ≤ MPE`,
    appliedRuleId: 'R76-RULE-ERROR-INDICATION',
    clauseCitation: mpeResult.sourceReference,
    activeE: mpeResult.e,
    isMultiInterval: mpeResult.isMultiInterval,
    activeRangeIndex: mpeResult.activeRangeIndex,
  };

  const trace: CalculationTrace = {
    calculationId: `trace-wp-${Date.now()}`,
    testType: 'weighing_performance',
    testLoad: referenceLoad,
    testLoadUnit: instrument.capacityUnit,
    indication: indicatedLoad,
    error,
    absoluteError,
    mpe: mpeResult.mpe,
    mpeUnit: instrument.capacityUnit,
    formula: 'E = I - L; Decision: |E| <= MPE',
    ruleUsed: mpeResult.ruleDescription,
    r76Reference: mpeResult.sourceReference,
    decision: passed ? 'PASS' : 'FAIL',
    reason,
    timestamp: new Date().toISOString(),
    inputValues: {
      referenceLoad,
      indicatedLoad,
      direction,
      scaleIntervals: mpeResult.scaleIntervals,
      accuracyClass: instrument.accuracyClass,
      e: mpeResult.e,
    },
  };

  return { point, trace, explanation };
}

/**
 * Evaluates Repeatability Test per OIML R 76-1 Clause 3.6.1 & Clause A.4.10.
 * Acceptance criterion: Spread = I_max - I_min <= |MPE(L)|.
 */
export function evaluateRepeatabilityR76(
  instrument: Instrument,
  testLoad: number,
  readings: number[]
): { data: RepeatabilityData; trace: CalculationTrace; explanation: UserFacingExplanation } {
  const validReadings = readings.filter((r) => !isNaN(r) && r > 0);

  if (validReadings.length < 3) {
    const errorMsg = 'At least 3 valid observations are required for OIML R 76-1 repeatability evaluation.';
    return {
      data: {
        testLoad,
        readings: validReadings,
        maxReading: 0,
        minReading: 0,
        rangeSpread: 0,
        allowedRangeSpread: 0,
        passed: false,
        ruleReference: 'OIML R 76-1:2006 Clause 3.6.1 & A.4.10',
        formula: 'Spread = I_max - I_min ≤ |MPE|',
        calculatedAt: new Date().toISOString(),
      },
      trace: {
        calculationId: `trace-rep-${Date.now()}`,
        testType: 'repeatability',
        testLoad,
        testLoadUnit: instrument.capacityUnit,
        indication: 0,
        error: 0,
        absoluteError: 0,
        mpe: 0,
        mpeUnit: instrument.capacityUnit,
        formula: 'Spread = I_max - I_min <= |MPE|',
        ruleUsed: 'OIML R 76-1 Clause 3.6.1',
        r76Reference: 'Clause 3.6.1 & Clause A.4.10',
        decision: 'FAIL',
        reason: errorMsg,
        timestamp: new Date().toISOString(),
        inputValues: { testLoad, readings },
      },
      explanation: {
        referenceLoadFormatted: `${testLoad} ${instrument.capacityUnit}`,
        indicationFormatted: 'N/A',
        errorFormatted: 'N/A',
        absoluteErrorFormatted: 'N/A',
        applicableMpeFormatted: 'N/A',
        decision: 'FAIL',
        reason: errorMsg,
        ruleDescription: 'Clause 3.6.1 Repeatability: At least 3 weighings required.',
        clauseCitation: 'OIML R 76-1:2006 Clause 3.6.1',
      },
    };
  }

  const maxReading = Math.max(...validReadings);
  const minReading = Math.min(...validReadings);
  const rangeSpread = roundToPrecision(maxReading - minReading, 6);

  // MPE at this test load
  const mpeResult = calculateR76MPE(instrument, testLoad);
  const allowedRangeSpread = mpeResult.mpe;
  const passed = rangeSpread <= allowedRangeSpread + 1e-9;

  const unit = instrument.capacityUnit;
  const spreadFormatted = `${formatCleanNumber(rangeSpread, 4)} ${unit}`;
  const allowedFormatted = `${formatCleanNumber(allowedRangeSpread, 4)} ${unit}`;
  const maxFormatted = `${formatCleanNumber(maxReading, 4)} ${unit}`;
  const minFormatted = `${formatCleanNumber(minReading, 4)} ${unit}`;

  const reason = passed
    ? `Difference between maximum (${maxFormatted}) and minimum (${minFormatted}) indication (${spreadFormatted}) does not exceed the maximum permissible error for this load (${allowedFormatted}).`
    : `Difference between maximum (${maxFormatted}) and minimum (${minFormatted}) indication (${spreadFormatted}) exceeds the maximum permissible error (${allowedFormatted}) by ${formatCleanNumber(
        rangeSpread - allowedRangeSpread,
        4
      )} ${unit}.`;

  const formula = `Spread (${spreadFormatted}) = I_max (${maxFormatted}) - I_min (${minFormatted}) ≤ |MPE| (${allowedFormatted})`;

  const explanation: UserFacingExplanation = {
    referenceLoadFormatted: `${formatCleanNumber(testLoad, 4)} ${unit}`,
    indicationFormatted: `Range: [${minFormatted} to ${maxFormatted}]`,
    errorFormatted: spreadFormatted,
    absoluteErrorFormatted: spreadFormatted,
    applicableMpeFormatted: allowedFormatted,
    decision: passed ? 'PASS' : 'FAIL',
    reason,
    ruleDescription: `Repeatability requirement: ${formula}`,
    clauseCitation: 'OIML R 76-1:2006 Clause 3.6.1 & Clause A.4.10',
  };

  const data: RepeatabilityData = {
    testLoad,
    readings: validReadings,
    maxReading,
    minReading,
    rangeSpread,
    allowedRangeSpread,
    passed,
    ruleReference: 'OIML R 76-1:2006 Clause 3.6.1 & Clause A.4.10',
    formula,
    calculatedAt: new Date().toISOString(),
  };

  const trace: CalculationTrace = {
    calculationId: `trace-rep-${Date.now()}`,
    testType: 'repeatability',
    testLoad,
    testLoadUnit: unit,
    indication: maxReading,
    error: rangeSpread,
    absoluteError: rangeSpread,
    mpe: allowedRangeSpread,
    mpeUnit: unit,
    formula,
    ruleUsed: 'OIML R 76-1 Clause 3.6.1',
    r76Reference: 'Clause 3.6.1 & Clause A.4.10',
    decision: passed ? 'PASS' : 'FAIL',
    reason,
    timestamp: new Date().toISOString(),
    inputValues: {
      testLoad,
      readings: validReadings,
      maxReading,
      minReading,
      rangeSpread,
      mpe: allowedRangeSpread,
    },
  };

  return { data, trace, explanation };
}

/**
 * Evaluates Eccentricity (Corner Load) Test per OIML R 76-1 Clause 3.6.2 & Clause A.4.7.
 * Requirements: Error at any eccentric position <= MPE for that load.
 */
export function evaluateEccentricityR76(
  instrument: Instrument,
  testLoad: number,
  centerReading: number,
  positionsInput: { id: string; name: string; description: string; reading: number }[]
): { data: EccentricityData; trace: CalculationTrace; explanation: UserFacingExplanation } {
  const mpeResult = calculateR76MPE(instrument, testLoad);
  const allowedLimit = mpeResult.mpe;
  const unit = instrument.capacityUnit;

  let maxDeviation = 0;
  const positions: EccentricityPosition[] = positionsInput.map((pos) => {
    // Both deviation from center and direct position indication error
    const deviationFromCenter = roundToPrecision(Math.abs(pos.reading - centerReading), 6);
    const positionError = roundToPrecision(Math.abs(pos.reading - testLoad), 6);
    const effectiveDeviation = Math.max(deviationFromCenter, positionError);

    if (effectiveDeviation > maxDeviation) {
      maxDeviation = effectiveDeviation;
    }

    const passed = effectiveDeviation <= allowedLimit + 1e-9;
    return {
      id: pos.id,
      name: pos.name,
      description: pos.description,
      reading: pos.reading,
      deviationFromCenter: effectiveDeviation,
      allowedLimit,
      passed,
    };
  });

  const passed = maxDeviation <= allowedLimit + 1e-9 && positions.every((p) => p.passed);

  const formula = `Max Deviation (${formatCleanNumber(maxDeviation, 4)} ${unit}) ≤ MPE (${formatCleanNumber(
    allowedLimit,
    4
  )} ${unit}) at L ≈ Max/3`;

  const reason = passed
    ? `Maximum observed eccentric deviation (${formatCleanNumber(
        maxDeviation,
        4
      )} ${unit}) across all ${positions.length} loading positions is within the maximum permissible error (${formatCleanNumber(
        allowedLimit,
        4
      )} ${unit}).`
    : `Maximum observed eccentric deviation (${formatCleanNumber(
        maxDeviation,
        4
      )} ${unit}) exceeds the maximum permissible error limit (${formatCleanNumber(allowedLimit, 4)} ${unit}).`;

  const explanation: UserFacingExplanation = {
    referenceLoadFormatted: `${formatCleanNumber(testLoad, 4)} ${unit}`,
    indicationFormatted: `Center: ${formatCleanNumber(centerReading, 4)} ${unit}`,
    errorFormatted: `${formatCleanNumber(maxDeviation, 4)} ${unit}`,
    absoluteErrorFormatted: `${formatCleanNumber(maxDeviation, 4)} ${unit}`,
    applicableMpeFormatted: `±${formatCleanNumber(allowedLimit, 4)} ${unit}`,
    decision: passed ? 'PASS' : 'FAIL',
    reason,
    ruleDescription: formula,
    clauseCitation: 'OIML R 76-1:2006 Clause 3.6.2 & Clause A.4.7',
  };

  const data: EccentricityData = {
    testLoad,
    centerReading,
    positions,
    maxDeviation,
    allowedLimit,
    passed,
    ruleReference: 'OIML R 76-1:2006 Clause 3.6.2 & Clause A.4.7',
    formula,
    calculatedAt: new Date().toISOString(),
  };

  const trace: CalculationTrace = {
    calculationId: `trace-ecc-${Date.now()}`,
    testType: 'eccentricity',
    testLoad,
    testLoadUnit: unit,
    indication: centerReading,
    error: maxDeviation,
    absoluteError: maxDeviation,
    mpe: allowedLimit,
    mpeUnit: unit,
    formula,
    ruleUsed: 'OIML R 76-1 Clause 3.6.2',
    r76Reference: 'Clause 3.6.2 & Clause A.4.7',
    decision: passed ? 'PASS' : 'FAIL',
    reason,
    timestamp: new Date().toISOString(),
    inputValues: { testLoad, centerReading, positions: positionsInput, maxDeviation },
  };

  return { data, trace, explanation };
}

/**
 * Evaluates Zero-Setting and Tare Tests.
 * Requirements:
 * - Clause 4.5.2.2: Zero setting error <= +/-0.25 e
 * - Clause 3.5.3.3: Tare net error <= MPE for net load
 * - Clause A.4.3: Return to zero <= +/-0.5 e
 */
export function evaluateZeroTareR76(
  instrument: Instrument,
  initialZeroReading: number,
  tareLoad: number,
  indicatedNet: number,
  returnToZeroReading: number
): { data: ZeroTareData; trace: CalculationTrace; explanation: UserFacingExplanation } {
  const eInCap = convertMass(instrument.e, instrument.intervalUnit, instrument.capacityUnit);
  const unit = instrument.capacityUnit;

  // 1. Zero Setting Error (Clause 4.5.2.2: |E_0| <= 0.25 e)
  const zeroSettingError = roundToPrecision(Math.abs(initialZeroReading), 6);
  const zeroSettingMpe = roundToPrecision(0.25 * eInCap, 6);
  const zeroPassed = zeroSettingError <= zeroSettingMpe + 1e-9;

  // 2. Tare Net Accuracy (Clause 3.5.3.3: |E_net| <= MPE(L_net))
  const tareDeviation = roundToPrecision(Math.abs(indicatedNet - tareLoad), 6);
  const tareMpeResult = calculateR76MPE(instrument, tareLoad);
  const tarePassed = tareDeviation <= tareMpeResult.mpe + 1e-9;

  // 3. Return to zero (Clause A.4.3: |R_0| <= 0.5 e)
  const returnToZeroDeviation = roundToPrecision(Math.abs(returnToZeroReading), 6);
  const returnToZeroLimit = roundToPrecision(0.5 * eInCap, 6);
  const returnPassed = returnToZeroDeviation <= returnToZeroLimit + 1e-9;

  const overallPassed = zeroPassed && tarePassed && returnPassed;

  const formula = `Zero Setting (|Δ0| ≤ 0.25e = ${formatCleanNumber(
    zeroSettingMpe,
    4
  )}), Tare Net (|ΔNet| ≤ MPE = ${formatCleanNumber(
    tareMpeResult.mpe,
    4
  )}), Return to Zero (|R0| ≤ 0.5e = ${formatCleanNumber(returnToZeroLimit, 4)})`;

  const reason = overallPassed
    ? `All zero and tare evaluations satisfy OIML R 76 requirements: Zero error (${formatCleanNumber(
        zeroSettingError,
        4
      )} ≤ ${formatCleanNumber(zeroSettingMpe, 4)} ${unit}), Tare error (${formatCleanNumber(
        tareDeviation,
        4
      )} ≤ ${formatCleanNumber(tareMpeResult.mpe, 4)} ${unit}), and Return-to-zero (${formatCleanNumber(
        returnToZeroDeviation,
        4
      )} ≤ ${formatCleanNumber(returnToZeroLimit, 4)} ${unit}).`
    : `One or more zero/tare criteria failed: ${
        !zeroPassed
          ? `Zero setting error (${formatCleanNumber(zeroSettingError, 4)}) > 0.25 e (${formatCleanNumber(
              zeroSettingMpe,
              4
            )}). `
          : ''
      }${
        !tarePassed
          ? `Tare error (${formatCleanNumber(tareDeviation, 4)}) > MPE (${formatCleanNumber(
              tareMpeResult.mpe,
              4
            )}). `
          : ''
      }${
        !returnPassed
          ? `Return to zero error (${formatCleanNumber(
              returnToZeroDeviation,
              4
            )}) > 0.5 e (${formatCleanNumber(returnToZeroLimit, 4)}).`
          : ''
      }`;

  const explanation: UserFacingExplanation = {
    referenceLoadFormatted: `Tare: ${formatCleanNumber(tareLoad, 4)} ${unit}`,
    indicationFormatted: `Net: ${formatCleanNumber(indicatedNet, 4)} ${unit}`,
    errorFormatted: `${formatCleanNumber(tareDeviation, 4)} ${unit}`,
    absoluteErrorFormatted: `${formatCleanNumber(tareDeviation, 4)} ${unit}`,
    applicableMpeFormatted: `±${formatCleanNumber(tareMpeResult.mpe, 4)} ${unit}`,
    decision: overallPassed ? 'PASS' : 'FAIL',
    reason,
    ruleDescription: formula,
    clauseCitation: 'OIML R 76-1 Clauses 4.5.2, 4.6 & Clause A.4.3',
  };

  const data: ZeroTareData = {
    initialZeroReading,
    zeroSettingError,
    zeroSettingMpe,
    zeroPassed,
    tareLoad,
    indicatedNet,
    tareDeviation,
    tareMpe: tareMpeResult.mpe,
    tarePassed,
    returnToZeroReading,
    returnToZeroDeviation,
    returnToZeroLimit,
    returnPassed,
    overallPassed,
    ruleReference: 'OIML R 76-1 Clauses 4.5.2, 4.6 & Clause A.4.3',
    formula,
    calculatedAt: new Date().toISOString(),
  };

  const trace: CalculationTrace = {
    calculationId: `trace-zt-${Date.now()}`,
    testType: 'zero_tare',
    testLoad: tareLoad,
    testLoadUnit: unit,
    indication: indicatedNet,
    error: tareDeviation,
    absoluteError: tareDeviation,
    mpe: tareMpeResult.mpe,
    mpeUnit: unit,
    formula,
    ruleUsed: 'OIML R 76-1 Clauses 4.5.2, 4.6 & A.4.3',
    r76Reference: 'Clause 4.5.2 & Clause A.4.3',
    decision: overallPassed ? 'PASS' : 'FAIL',
    reason,
    timestamp: new Date().toISOString(),
    inputValues: { initialZeroReading, tareLoad, indicatedNet, returnToZeroReading },
  };

  return { data, trace, explanation };
}

/**
 * Evaluates Discrimination / Sensitivity Test per OIML R 76-1 Clause 3.8.2.2 & Clause A.4.8.
 * Extra load ΔL = 1.4 d placed on loaded instrument shall produce an indication change of at least 1.0 d.
 */
export function evaluateDiscriminationR76(
  instrument: Instrument,
  baseLoad: number,
  initialIndication: number,
  newIndication: number
): { data: DiscriminationData; trace: CalculationTrace; explanation: UserFacingExplanation } {
  const dVal = instrument.d || instrument.e;
  const dInCap = convertMass(dVal, instrument.intervalUnit, instrument.capacityUnit);
  const extraLoad = roundToPrecision(1.4 * dInCap, 6);
  const changeObserved = roundToPrecision(Math.abs(newIndication - initialIndication), 6);
  const requiredChange = roundToPrecision(1.0 * dInCap, 6);
  const passed = changeObserved >= requiredChange - 1e-9;
  const unit = instrument.capacityUnit;

  const formula = `Change Observed (${formatCleanNumber(changeObserved, 4)} ${unit}) ≥ Required 1.0 d (${formatCleanNumber(
    requiredChange,
    4
  )} ${unit}) when adding ΔL = 1.4 d (${formatCleanNumber(extraLoad, 4)} ${unit})`;

  const reason = passed
    ? `Adding extra load ΔL = 1.4 d produced a noticeable indication change of ${formatCleanNumber(
        changeObserved,
        4
      )} ${unit}, which meets or exceeds the required 1.0 d (${formatCleanNumber(requiredChange, 4)} ${unit}).`
    : `Adding extra load ΔL = 1.4 d resulted in an indication change of only ${formatCleanNumber(
        changeObserved,
        4
      )} ${unit}, which is less than the required 1.0 d (${formatCleanNumber(requiredChange, 4)} ${unit}).`;

  const explanation: UserFacingExplanation = {
    referenceLoadFormatted: `Base: ${formatCleanNumber(baseLoad, 4)} ${unit} + ΔL (${formatCleanNumber(extraLoad, 4)})`,
    indicationFormatted: `${formatCleanNumber(initialIndication, 4)} → ${formatCleanNumber(newIndication, 4)} ${unit}`,
    errorFormatted: `${formatCleanNumber(changeObserved, 4)} ${unit}`,
    absoluteErrorFormatted: `${formatCleanNumber(changeObserved, 4)} ${unit}`,
    applicableMpeFormatted: `≥ ${formatCleanNumber(requiredChange, 4)} ${unit}`,
    decision: passed ? 'PASS' : 'FAIL',
    reason,
    ruleDescription: formula,
    clauseCitation: 'OIML R 76-1:2006 Clause 3.8.2.2 & Clause A.4.8',
  };

  const data: DiscriminationData = {
    baseLoad,
    initialIndication,
    extraLoad,
    newIndication,
    changeObserved,
    requiredChange,
    passed,
    ruleReference: 'OIML R 76-1:2006 Clause 3.8.2.2 & Clause A.4.8',
    formula,
    calculatedAt: new Date().toISOString(),
  };

  const trace: CalculationTrace = {
    calculationId: `trace-disc-${Date.now()}`,
    testType: 'discrimination',
    testLoad: baseLoad,
    testLoadUnit: unit,
    indication: newIndication,
    error: changeObserved,
    absoluteError: changeObserved,
    mpe: requiredChange,
    mpeUnit: unit,
    formula,
    ruleUsed: 'OIML R 76-1 Clause 3.8.2.2',
    r76Reference: 'Clause 3.8.2.2 & Clause A.4.8',
    decision: passed ? 'PASS' : 'FAIL',
    reason,
    timestamp: new Date().toISOString(),
    inputValues: { baseLoad, initialIndication, newIndication, extraLoad, requiredChange },
  };

  return { data, trace, explanation };
}
