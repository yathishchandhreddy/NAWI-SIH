/**
 * Automated Metrological Unit Test Suite for OIML R 76-1:2006 Calculation Engine
 * 
 * Verifies all 12 test requirements specified in user prompt Section 18:
 * 1. Valid PASS case
 * 2. Valid FAIL case
 * 3. Boundary case where |error| = MPE
 * 4. Error just above MPE (|error| = MPE + eps)
 * 5. Different accuracy classes (I, II, III, IIII)
 * 6. Different e values and units (kg, g, mg)
 * 7. Different test-load ranges (0.5e, 1.0e, 1.5e limits)
 * 8. Multi-interval instruments (automatic e_i switching)
 * 9. Invalid instrument configuration (detection & prevention)
 * 10. Missing observations / invalid inputs
 * 11. Unit conversion precision (kg <-> g <-> mg)
 * 12. Zero / Tare calculations (0.25e zero, tare net MPE, 0.5e zero return)
 */

import { Instrument } from '../types';
import {
  convertMass,
  calculateR76MPE,
  evaluateWeighingPointR76,
  evaluateRepeatabilityR76,
  evaluateEccentricityR76,
  evaluateZeroTareR76,
  evaluateDiscriminationR76,
  validateInstrumentMetrology,
  evaluateTestApplicability,
} from './oimlR76';

interface TestSummary {
  name: string;
  passed: boolean;
  details: string;
}

const testResults: TestSummary[] = [];

function assert(condition: boolean, testName: string, message?: string) {
  if (!condition) {
    const detail = `FAILED: ${testName} - ${message || 'Assertion failed'}`;
    console.error(`❌ ${detail}`);
    testResults.push({ name: testName, passed: false, details: message || 'Assertion failed' });
    throw new Error(detail);
  } else {
    console.log(`✅ PASSED: ${testName}`);
    testResults.push({ name: testName, passed: true, details: 'OK' });
  }
}

export function runAllOimlR76UnitTests(): { total: number; passed: number; failed: number; results: TestSummary[] } {
  console.log('================================================================');
  console.log('   OIML R 76-1:2006 METROLOGICAL ENGINE AUTOMATED UNIT TESTS   ');
  console.log('================================================================\n');

  // Standard Test Instrument: Class III, Max = 15 kg, e = 5 g (0.005 kg), d = 5 g
  const standardClassIII: Instrument = {
    id: 'inst-test-01',
    instrumentId: 'NAWI-TEST-CLASS-III',
    manufacturer: 'Mettler-Precision',
    model: 'R76-Std-15K',
    serialNumber: 'SN-2026-TEST',
    instrumentType: 'Platform Scale',
    accuracyClass: 'III',
    maxCapacity: 15,
    minCapacity: 0.1, // 20 e = 0.100 kg
    capacityUnit: 'kg',
    e: 5,
    d: 5,
    intervalUnit: 'g',
    location: 'Metrology Testing Lab 1',
    registrationDate: '2026-01-15',
    registeredBy: 'Metrology Officer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // --- 1. Valid PASS Case ---
  {
    // At L = 2.0 kg (400 e <= 500 e -> MPE = +/-0.5 e = +/-0.0025 kg)
    // Indication = 2.0010 kg -> Error = +0.0010 kg <= 0.0025 kg -> PASS
    const res = evaluateWeighingPointR76(standardClassIII, 2.0, 2.001);
    assert(res.point.passed === true, 'Test 1: Valid PASS Case', 'Expected PASS for error 0.001 kg within MPE 0.0025 kg');
    assert(res.point.applicableMpeE === 0.5, 'Test 1: MPE coefficient is 0.5e');
  }

  // --- 2. Valid FAIL Case ---
  {
    // At L = 2.0 kg (MPE = 0.0025 kg), Indication = 2.0040 kg -> Error = +0.0040 kg > 0.0025 kg -> FAIL
    const res = evaluateWeighingPointR76(standardClassIII, 2.0, 2.004);
    assert(res.point.passed === false, 'Test 2: Valid FAIL Case', 'Expected FAIL for error 0.004 kg exceeding MPE 0.0025 kg');
    assert(res.point.error === 0.004, 'Test 2: Error computation is exact');
  }

  // --- 3. Boundary Case where |error| = MPE ---
  {
    // At L = 5.0 kg (1000 e in range 500e < m <= 2000e -> MPE = +/-1.0 e = +/-0.0050 kg)
    // Indication = 5.0050 kg -> Error = +0.0050 kg == MPE -> Must PASS boundary
    const res = evaluateWeighingPointR76(standardClassIII, 5.0, 5.005);
    assert(res.point.passed === true, 'Test 3: Boundary Case |error| = MPE', 'Expected PASS exactly on boundary');
    assert(res.point.applicableMpeE === 1.0, 'Test 3: Range 1000e has MPE 1.0e');
  }

  // --- 4. Error just above MPE (Boundary + epsilon) ---
  {
    // At L = 5.0 kg (MPE = 0.0050 kg), Indication = 5.0051 kg -> Error = 0.0051 kg > MPE -> Must FAIL
    const res = evaluateWeighingPointR76(standardClassIII, 5.0, 5.0051);
    assert(res.point.passed === false, 'Test 4: Error just above MPE', 'Expected FAIL for error just above boundary');
  }

  // --- 5. Different Accuracy Classes (I, II, III, IIII) ---
  {
    // Class I (Micro-analytical balance: Max = 200 g, e = 1 mg, d = 0.1 mg)
    const classI: Instrument = {
      ...standardClassIII,
      accuracyClass: 'I',
      maxCapacity: 200,
      minCapacity: 0.1,
      capacityUnit: 'g',
      e: 1,
      d: 0.1,
      intervalUnit: 'mg',
    };
    // At L = 40 g = 40,000 e (<= 50,000 e -> MPE = +/-0.5 e = 0.0005 g)
    const mpeI = calculateR76MPE(classI, 40);
    assert(mpeI.mpeE === 0.5, 'Test 5: Class I Table 6 evaluation', `Expected 0.5e, got ${mpeI.mpeE}e`);

    // Class II (Precision balance: Max = 3000 g, e = 0.05 g)
    const classII: Instrument = {
      ...standardClassIII,
      accuracyClass: 'II',
      maxCapacity: 3000,
      minCapacity: 1,
      capacityUnit: 'g',
      e: 50,
      d: 50,
      intervalUnit: 'mg',
    };
    // At L = 400 g = 8,000 e (5,000e < m <= 20,000e -> MPE = +/-1.0 e = 0.05 g)
    const mpeII = calculateR76MPE(classII, 400);
    assert(mpeII.mpeE === 1.0, 'Test 5: Class II Table 6 evaluation', `Expected 1.0e, got ${mpeII.mpeE}e`);

    // Class IIII (Ordinary platform: Max = 1000 kg, e = 1 kg)
    const classIIII: Instrument = {
      ...standardClassIII,
      accuracyClass: 'IIII',
      maxCapacity: 1000,
      minCapacity: 10,
      capacityUnit: 'kg',
      e: 1,
      d: 1,
      intervalUnit: 'kg',
    };
    // At L = 40 kg = 40 e (<= 50 e -> MPE = +/-0.5 e = 0.5 kg)
    const mpeIIII_low = calculateR76MPE(classIIII, 40);
    assert(mpeIIII_low.mpeE === 0.5, 'Test 5: Class IIII low load', `Expected 0.5e, got ${mpeIIII_low.mpeE}e`);

    // At L = 100 kg = 100 e (50e < m <= 200e -> MPE = +/-1.0 e = 1.0 kg)
    const mpeIIII_mid = calculateR76MPE(classIIII, 100);
    assert(mpeIIII_mid.mpeE === 1.0, 'Test 5: Class IIII mid load', `Expected 1.0e, got ${mpeIIII_mid.mpeE}e`);

    // At L = 500 kg = 500 e (m > 200e -> MPE = +/-1.5 e = 1.5 kg)
    const mpeIIII_high = calculateR76MPE(classIIII, 500);
    assert(mpeIIII_high.mpeE === 1.5, 'Test 5: Class IIII high load', `Expected 1.5e, got ${mpeIIII_high.mpeE}e`);
  }

  // --- 6. Different 'e' Values and Units ---
  {
    // Capacity in kg, e in mg: Max = 1 kg, e = 50 mg = 0.00005 kg
    const instMg: Instrument = {
      ...standardClassIII,
      maxCapacity: 1,
      minCapacity: 0.001,
      capacityUnit: 'kg',
      e: 50,
      d: 50,
      intervalUnit: 'mg',
    };
    const mpeMg = calculateR76MPE(instMg, 0.02); // 20 g = 400 e <= 500 e -> 0.5 e = 25 mg = 0.000025 kg
    assert(mpeMg.mpe === 0.000025, 'Test 6: e in mg converted to kg capacity unit', `Got ${mpeMg.mpe}`);
  }

  // --- 7. Different Test-Load Ranges (MPE transitions 0.5e -> 1.0e -> 1.5e) ---
  {
    // Class III instrument with e = 5 g = 0.005 kg
    // Range A: 0 <= m <= 500 e (0 to 2.5 kg) -> 0.5 e (0.0025 kg)
    const rA = calculateR76MPE(standardClassIII, 2.5);
    assert(rA.mpeE === 0.5, 'Test 7: Range A upper boundary 500e -> 0.5e');

    // Range B: 500 e < m <= 2000 e (2.505 kg to 10.0 kg) -> 1.0 e (0.0050 kg)
    const rB = calculateR76MPE(standardClassIII, 2.505);
    assert(rB.mpeE === 1.0, 'Test 7: Range B just above 500e -> 1.0e');

    // Range C: m > 2000 e (> 10.0 kg up to 15 kg) -> 1.5 e (0.0075 kg)
    const rC = calculateR76MPE(standardClassIII, 12.0);
    assert(rC.mpeE === 1.5, 'Test 7: Range C (> 2000e) -> 1.5e');
    assert(rC.mpe === 0.0075, 'Test 7: Range C MPE absolute value is 0.0075 kg');
  }

  // --- 8. Multi-Interval Instruments (Dynamic e_i switching) ---
  {
    // Multi-interval dual-range instrument:
    // Range 1: 0 to 6 kg, e1 = 2 g (0.002 kg)
    // Range 2: 6 to 15 kg, e2 = 5 g (0.005 kg)
    const multiIntervalInst: Instrument = {
      ...standardClassIII,
      multiInterval: true,
      multiIntervalRanges: [
        { rangeIndex: 1, max: 6, e: 2, d: 2 },
        { rangeIndex: 2, max: 15, e: 5, d: 5 },
      ],
    };

    // Test at L = 4 kg (within Range 1 -> must use e1 = 2 g = 0.002 kg)
    const mpeRange1 = calculateR76MPE(multiIntervalInst, 4.0);
    assert(mpeRange1.e === 2, 'Test 8: Multi-interval selects e1 = 2g for L=4kg');
    assert(mpeRange1.activeRangeIndex === 1, 'Test 8: Active range is 1');

    // Test at L = 10 kg (within Range 2 -> must use e2 = 5 g = 0.005 kg)
    const mpeRange2 = calculateR76MPE(multiIntervalInst, 10.0);
    assert(mpeRange2.e === 5, 'Test 8: Multi-interval selects e2 = 5g for L=10kg');
    assert(mpeRange2.activeRangeIndex === 2, 'Test 8: Active range is 2');
  }

  // --- 9. Invalid Instrument Configuration Detection ---
  {
    // Instrument with n = Max / e < n_min for Class III (Table 3 requires n >= 500 for e >= 5g)
    // Max = 2 kg, e = 10 g -> n = 200 < 500 -> Invalid
    const invalidConfig: Instrument = {
      ...standardClassIII,
      maxCapacity: 2,
      e: 10,
      intervalUnit: 'g',
    };
    const val = validateInstrumentMetrology(invalidConfig);
    assert(val.isValid === false, 'Test 9: Invalid n < n_min is rejected');
    assert(val.errors.some((e) => e.includes('Table 3 Violation')), 'Test 9: Error mentions Table 3 violation');

    // Negative capacity or e <= 0
    const invalidZeroE: Instrument = {
      ...standardClassIII,
      e: 0,
    };
    const valZeroE = validateInstrumentMetrology(invalidZeroE);
    assert(valZeroE.isValid === false, 'Test 9: e=0 is rejected');
  }

  // --- 10. Missing Observations / Invalid Inputs ---
  {
    // Repeatability with fewer than 3 readings must fail per OIML R 76-1
    const repRes = evaluateRepeatabilityR76(standardClassIII, 5.0, [5.001, 5.002]); // only 2 readings
    assert(repRes.data.passed === false, 'Test 10: Repeatability rejects < 3 observations');
    assert(repRes.data.ruleReference.includes('Clause 3.6.1'), 'Test 10: Cites Clause 3.6.1');
  }

  // --- 11. Unit Conversion Precision ---
  {
    // 1 kg = 1,000 g = 1,000,000 mg
    assert(convertMass(1.5, 'kg', 'g') === 1500, 'Test 11: 1.5 kg -> 1500 g');
    assert(convertMass(250, 'mg', 'g') === 0.25, 'Test 11: 250 mg -> 0.25 g');
    assert(convertMass(0.005, 'kg', 'mg') === 5000, 'Test 11: 0.005 kg -> 5000 mg');
  }

  // --- 12. Zero / Tare Calculations ---
  {
    // Standard Class III: e = 5 g = 0.005 kg
    // Zero setting limit: 0.25 e = 0.00125 kg
    // Zero return limit: 0.5 e = 0.0025 kg
    // Tare load = 2.0 kg (MPE = 0.0025 kg)
    // Valid pass case:
    const validZT = evaluateZeroTareR76(
      standardClassIII,
      0.0005, // zero error 0.0005 <= 0.00125 -> PASS
      2.0, // tare
      2.001, // net error 0.001 <= 0.0025 -> PASS
      0.001 // return 0.001 <= 0.0025 -> PASS
    );
    assert(validZT.data.overallPassed === true, 'Test 12: Valid Zero & Tare PASS');
    assert(validZT.data.zeroSettingMpe === 0.00125, 'Test 12: Zero setting MPE is 0.25e');

    // Failed tare net error case:
    const failedZT = evaluateZeroTareR76(
      standardClassIII,
      0.0005,
      2.0,
      2.005, // net error 0.005 > MPE 0.0025 -> FAIL
      0.001
    );
    assert(failedZT.data.overallPassed === false, 'Test 12: Failed Tare error is detected');
    assert(failedZT.data.tarePassed === false, 'Test 12: Tare sub-test marked failed');
  }

  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = testResults.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`   TEST RUN COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED   `);
  console.log('================================================================\n');

  return {
    total: testResults.length,
    passed: passedCount,
    failed: failedCount,
    results: testResults,
  };
}

// Auto-run if executed directly via tsx/node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('oimlR76.test')) {
  try {
    const summary = runAllOimlR76UnitTests();
    if (summary.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}
