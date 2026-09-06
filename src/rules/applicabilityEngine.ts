/**
 * OIML R 76-1:2006 Test Applicability Engine
 * 
 * Determines which test modules are legally and technically applicable
 * to an instrument configuration per OIML R 76-1:2006 requirements.
 */

import { Instrument, TestApplicabilityResult, TestPlanItem } from '../types';
import { convertMass } from './unitConversion';
import { canonicalizeAccuracyClass } from './validation';

/**
 * Evaluates the applicability of each standard OIML R 76 test module.
 */
export function evaluateTestApplicability(
  instrument: Instrument
): TestApplicabilityResult {
  const cClass = canonicalizeAccuracyClass(instrument.accuracyClass);
  const eInGrams = convertMass(instrument.e, instrument.intervalUnit, 'g');
  const dInGrams = instrument.d ? convertMass(instrument.d, instrument.intervalUnit, 'g') : eInGrams;
  const maxInGrams = convertMass(instrument.maxCapacity, instrument.capacityUnit, 'g');
  const n = eInGrams > 0 ? maxInGrams / eInGrams : 0;

  // 1. Weighing Performance Test (Clause 3.5.1 & A.4.4)
  const wpApplicable = true;
  const wpReason = 'Mandatory core test for all NAWI accuracy classes (OIML R 76-1 Clause 3.5.1 & Clause A.4.4).';
  const wpClause = 'Clause 3.5.1 & Clause A.4.4';

  // 2. Repeatability Test (Clause 3.6.1 & A.4.10)
  const repApplicable = true;
  const repReason = 'Mandatory test at ~50% Max and Max loads to verify spread |I_max - I_min| <= |MPE| (OIML R 76-1 Clause 3.6.1).';
  const repClause = 'Clause 3.6.1 & Clause A.4.10';

  // 3. Eccentricity Test (Clause 3.6.2 & A.4.7)
  const isCraneOrHangingOnly = instrument.instrumentType?.toLowerCase().includes('crane') ||
    instrument.instrumentType?.toLowerCase().includes('hanging_hook');
  const eccApplicable = !isCraneOrHangingOnly;
  const eccReason = eccApplicable
    ? 'Mandatory for instruments with rigid load receptor (pan, platform, bridge) per OIML R 76-1 Clause 3.6.2.'
    : 'Not Applicable: Single-point hanging suspended crane scale without planar load receptor.';
  const eccClause = 'Clause 3.6.2 & Clause A.4.7';

  // 4. Zero Setting & Zero Return Test (Clause 4.5.2 & A.4.3)
  const zeroApplicable = true;
  const zeroReason = 'Applicable to all electronic non-automatic weighing instruments with zero facility (OIML R 76-1 Clause 4.5.2 & A.4.3).';
  const zeroClause = 'Clause 4.5.2 & Clause A.4.3';

  // 5. Tare Device Test (Clause 4.6 & A.4.6)
  // Check if instrument explicitly has tare capability (default true for standard digital NAWI unless marked false)
  const hasTare = instrument.hasTareDevice !== false;
  const tareApplicable = hasTare;
  const tareReason = tareApplicable
    ? 'Applicable: Instrument is equipped with tare device/balancing facility (OIML R 76-1 Clause 4.6 & Clause A.4.6).'
    : 'Not Applicable: Instrument does not have a tare device or tare balancing mechanism.';
  const tareClause = 'Clause 4.6 & Clause A.4.6';

  // 6. Discrimination / Sensitivity Test (Clause 3.8 & A.4.8)
  // Per OIML R 76-1 Clause 3.8.2.2: Applicable to instruments with digital indication without continuous zero tracking,
  // or high accuracy Class I / II instruments, or instruments where d < e.
  const isHighPrecision = cClass === 'I' || cClass === 'II' || dInGrams < eInGrams;
  const discApplicable = isHighPrecision;
  const discReason = discApplicable
    ? `Applicable: High accuracy Class ${instrument.accuracyClass} (n=${Math.round(n)}) requires digital discrimination verification with ΔL = 1.4 d (OIML R 76-1 Clause 3.8.2.2 & Clause A.4.8).`
    : `Not Applicable: Standard Class ${instrument.accuracyClass} industrial platform scale exempt per R 76-1 Clause 3.8 prototype configuration.`;
  const discClause = 'Clause 3.8.2.2 & Clause A.4.8';

  return {
    weighingPerformance: { applicable: wpApplicable, reason: wpReason, clause: wpClause },
    repeatability: { applicable: repApplicable, reason: repReason, clause: repClause },
    eccentricity: { applicable: eccApplicable, reason: eccReason, clause: eccClause },
    zeroReturn: { applicable: zeroApplicable, reason: zeroReason, clause: zeroClause },
    tare: { applicable: tareApplicable, reason: tareReason, clause: tareClause },
    discrimination: { applicable: discApplicable, reason: discReason, clause: discClause },
  };
}

/**
 * Converts applicability evaluation into standardized TestPlanItem[] for TestRecord.
 */
export function buildTestPlanFromApplicability(
  instrument: Instrument
): TestPlanItem[] {
  const evalResult = evaluateTestApplicability(instrument);

  return [
    {
      id: 'weighing_performance',
      title: 'Weighing Performance Test',
      applicable: evalResult.weighingPerformance.applicable,
      applicabilityReason: evalResult.weighingPerformance.reason,
      status: 'PENDING',
    },
    {
      id: 'repeatability',
      title: 'Repeatability Test',
      applicable: evalResult.repeatability.applicable,
      applicabilityReason: evalResult.repeatability.reason,
      status: 'PENDING',
    },
    {
      id: 'eccentricity',
      title: 'Eccentricity (Corner Load) Test',
      applicable: evalResult.eccentricity.applicable,
      applicabilityReason: evalResult.eccentricity.reason,
      status: 'PENDING',
    },
    {
      id: 'zero_tare',
      title: 'Zero-Setting & Tare Device Test',
      applicable: evalResult.zeroReturn.applicable || evalResult.tare.applicable,
      applicabilityReason: evalResult.tare.applicable
        ? evalResult.tare.reason
        : evalResult.zeroReturn.reason,
      status: 'PENDING',
    },
    {
      id: 'discrimination',
      title: 'Discrimination / Sensitivity Test',
      applicable: evalResult.discrimination.applicable,
      applicabilityReason: evalResult.discrimination.reason,
      status: 'PENDING',
    },
  ];
}
