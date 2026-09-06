/**
 * Persistent Storage & Database Service
 * 
 * Implements relational entities (users, instruments, tests, test_plans, reports, audit_logs)
 * with IndexedDB for offline drafts and LocalStorage for durable cross-session data.
 */

import {
  Instrument,
  TestRecord,
  AuditLog,
  User,
  MetrologyStats,
  Role,
} from '../types';
import { generateReportIntegrityHash } from './crypto';

const STORAGE_KEYS = {
  INSTRUMENTS: 'nawi_instruments_v1',
  TESTS: 'nawi_tests_v1',
  AUDIT_LOGS: 'nawi_audit_logs_v1',
  CURRENT_USER: 'nawi_current_user_v1',
  OFFLINE_DRAFTS: 'nawi_offline_drafts_v1',
  LAST_ACTIVE_TEST: 'nawi_last_active_test_v1',
  LAST_ACTIVE_REPORT: 'nawi_last_active_report_v1',
};

// Initial realistic Seed Users
export const SEED_USERS: User[] = [
  {
    id: 'user-tester-01',
    name: 'Vikram Mehta',
    role: 'tester',
    email: 'v.mehta@metrology.gov.in',
    designation: 'Senior Metrological Officer (Legal Metrology)',
    lab: 'Central NAWI Verification Facility, New Delhi',
  },
  {
    id: 'user-reviewer-02',
    name: 'Dr. Sunita Rao',
    role: 'reviewer',
    email: 's.rao@metrology.gov.in',
    designation: 'Principal Quality Auditor',
    lab: 'Regional Standards Metrology Laboratory',
  },
  {
    id: 'user-approver-03',
    name: 'Sh. Rajesh Sharma',
    role: 'approver',
    email: 'r.sharma@metrology.gov.in',
    designation: 'Director of Legal Metrology & Approving Authority',
    lab: 'Directorate of Legal Metrology, GoI',
  },
  {
    id: 'user-admin-04',
    name: 'Meera Patel',
    role: 'admin',
    email: 'm.patel@metrology.gov.in',
    designation: 'System & Registry Administrator',
    lab: 'National Metrology Informatics Cell',
  },
];

// Initial realistic Instruments
const SEED_INSTRUMENTS: Instrument[] = [
  {
    id: 'inst-nawi-2026-001',
    instrumentId: 'NAWI-2026-001',
    manufacturer: 'Essae',
    model: 'DS-215',
    serialNumber: 'ES260815001',
    instrumentType: 'Electronic Non-Automatic Platform Scale',
    accuracyClass: 'III',
    maxCapacity: 30,
    minCapacity: 0.2, // 200 g
    capacityUnit: 'kg',
    e: 10,
    d: 10,
    intervalUnit: 'g',
    location: 'Central Legal Metrology Laboratory, Bay 2',
    registrationDate: '2026-03-01',
    registeredBy: 'Vikram Mehta',
    notes: 'Commercial trade weighing scale under OIML R-76 annual verification.',
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-01T09:00:00.000Z',
  },
  {
    id: 'inst-001',
    instrumentId: 'NAWI-2026-DEL-01',
    manufacturer: 'Essae Teraoka Ltd.',
    model: 'DS-215 Electronic Platform',
    serialNumber: 'ES-2025-99824',
    instrumentType: 'Electronic Non-Automatic Platform Scale',
    accuracyClass: 'III',
    maxCapacity: 30,
    minCapacity: 0.1,
    capacityUnit: 'kg',
    e: 10,
    d: 10,
    intervalUnit: 'g',
    location: 'Inspection Bay 3 - Wholesale Market Zone',
    registrationDate: '2026-02-15',
    registeredBy: 'Vikram Mehta',
    notes: 'Commercial trade weighing instrument subject to annual verification.',
    createdAt: '2026-02-15T09:30:00.000Z',
    updatedAt: '2026-02-15T09:30:00.000Z',
  },
  {
    id: 'inst-002',
    instrumentId: 'NAWI-2026-BLR-02',
    manufacturer: 'Mettler Toledo AG',
    model: 'ME204T Analytical Precision Balance',
    serialNumber: 'MT-904812-CH',
    instrumentType: 'Electromagnetic Force Compensation Balance',
    accuracyClass: 'I',
    maxCapacity: 220,
    minCapacity: 0.01,
    capacityUnit: 'g',
    e: 1,
    d: 0.1,
    intervalUnit: 'mg',
    location: 'Pharmaceutical Cleanroom Assay Laboratory 2',
    registrationDate: '2026-03-01',
    registeredBy: 'Vikram Mehta',
    notes: 'Special accuracy balance used for active pharmaceutical ingredients (API).',
    createdAt: '2026-03-01T11:00:00.000Z',
    updatedAt: '2026-03-01T11:00:00.000Z',
  },
  {
    id: 'inst-003',
    instrumentId: 'NAWI-2026-MUM-03',
    manufacturer: 'Avery Weigh-Tronix',
    model: 'BridgeMaster ZM510',
    serialNumber: 'AW-887103-IN',
    instrumentType: 'Heavy-Duty Motor Vehicle Weighbridge',
    accuracyClass: 'III',
    maxCapacity: 50000,
    minCapacity: 400,
    capacityUnit: 'kg',
    e: 20,
    d: 20,
    intervalUnit: 'kg',
    location: 'Jawaharlal Nehru Port Trust Terminal 1',
    registrationDate: '2026-03-02',
    registeredBy: 'Vikram Mehta',
    notes: 'Multi-cell electronic weighbridge for freight container verification.',
    createdAt: '2026-03-02T08:15:00.000Z',
    updatedAt: '2026-03-02T08:15:00.000Z',
  },
];

/**
 * Helper to initialize realistic seed test records
 */
function createInitialTests(): TestRecord[] {
  const nawi001 = SEED_INSTRUMENTS.find((i) => i.instrumentId === 'NAWI-2026-001') || SEED_INSTRUMENTS[0];
  
  // Create TEST-2026-9620 in APPROVED state (reviewed by QA, ready for Approving Authority finalization)
  const test9620: TestRecord = {
    id: 'test-2026-9620',
    testId: 'TEST-2026-9620',
    instrumentId: nawi001.id,
    instrumentSnapshot: nawi001,
    status: 'APPROVED',
    testerId: 'user-tester-01',
    testerName: 'Vikram Mehta',
    createdAt: '2026-03-05T09:15:00.000Z',
    updatedAt: '2026-03-05T13:30:00.000Z',
    temperature: 21.8,
    humidity: 50.0,
    atmosphericPressure: 1013.25,
    testPlan: [
      {
        id: 'weighing_performance',
        title: 'Weighing Performance Test',
        applicable: true,
        applicabilityReason: 'Mandatory core test (OIML R-76 A.4.4)',
        status: 'COMPLETED',
      },
      {
        id: 'repeatability',
        title: 'Repeatability Test',
        applicable: true,
        applicabilityReason: 'Mandatory test at ~50% Max (OIML R-76 A.4.10)',
        status: 'COMPLETED',
      },
      {
        id: 'eccentricity',
        title: 'Eccentricity (Corner Load) Test',
        applicable: true,
        applicabilityReason: 'Mandatory corner test (OIML R-76 A.4.7)',
        status: 'COMPLETED',
      },
      {
        id: 'zero_tare',
        title: 'Zero-Setting & Tare Device Test',
        applicable: true,
        applicabilityReason: 'Electronic tare facility test (OIML R-76 A.4.2)',
        status: 'COMPLETED',
      },
      {
        id: 'discrimination',
        title: 'Discrimination / Sensitivity Test',
        applicable: false,
        applicabilityReason: 'Not Applicable for Class III platform scale with d = e',
        status: 'PENDING',
      },
    ],
    weighingPerformance: {
      points: [
        {
          id: 'wp-1',
          loadPercentage: 0,
          referenceLoad: 0.2, // Min: 200 g
          indicatedLoad: 0.2,
          error: 0.0,
          scaleIntervals: 20,
          applicableMpeE: 0.5,
          applicableMpeAbsolute: 0.005,
          comparisonText: '|0.0000| ≤ 0.0050 kg',
          passed: true,
          direction: 'increasing',
          ruleReference: 'OIML R-76-1 Table 6: Class III (0 ≤ m ≤ 500 e)',
        },
        {
          id: 'wp-2',
          loadPercentage: 17,
          referenceLoad: 5.0, // 500e
          indicatedLoad: 5.001,
          error: 0.001,
          scaleIntervals: 500,
          applicableMpeE: 0.5,
          applicableMpeAbsolute: 0.005,
          comparisonText: '|+0.0010| ≤ 0.0050 kg',
          passed: true,
          direction: 'increasing',
          ruleReference: 'OIML R-76-1 Table 6: Class III (0 ≤ m ≤ 500 e)',
        },
        {
          id: 'wp-3',
          loadPercentage: 50,
          referenceLoad: 15.0, // 1500e
          indicatedLoad: 15.002,
          error: 0.002,
          scaleIntervals: 1500,
          applicableMpeE: 1.0,
          applicableMpeAbsolute: 0.01,
          comparisonText: '|+0.0020| ≤ 0.0100 kg',
          passed: true,
          direction: 'increasing',
          ruleReference: 'OIML R-76-1 Table 6: Class III (500 e < m ≤ 2,000 e)',
        },
        {
          id: 'wp-4',
          loadPercentage: 100,
          referenceLoad: 30.0, // Max: 3000e
          indicatedLoad: 30.003,
          error: 0.003,
          scaleIntervals: 3000,
          applicableMpeE: 1.5,
          applicableMpeAbsolute: 0.015,
          comparisonText: '|+0.0030| ≤ 0.0150 kg',
          passed: true,
          direction: 'increasing',
          ruleReference: 'OIML R-76-1 Table 6: Class III (m > 2,000 e)',
        },
      ],
      passed: true,
      maxError: 0.003,
      calculatedAt: '2026-03-05T10:30:00.000Z',
    },
    repeatability: {
      testLoad: 15.0,
      readings: [15.000, 15.001, 15.000],
      maxReading: 15.001,
      minReading: 15.000,
      rangeSpread: 0.001,
      allowedRangeSpread: 0.01,
      passed: true,
      ruleReference: 'OIML R-76-1:2006 Clause 3.6.1 Repeatability requirement',
      formula: 'Spread (0.0010 kg) = Max (15.0010) - Min (15.0000) ≤ Allowed MPE (0.0100 kg)',
      calculatedAt: '2026-03-05T11:00:00.000Z',
    },
    eccentricity: {
      testLoad: 10.0,
      centerReading: 10.000,
      positions: [
        {
          id: 'pos-1',
          name: 'Front-Left (Corner 1)',
          description: 'Corner 1 off-center quadrant',
          reading: 10.001,
          deviationFromCenter: 0.001,
          allowedLimit: 0.01,
          passed: true,
        },
        {
          id: 'pos-2',
          name: 'Back-Left (Corner 2)',
          description: 'Corner 2 off-center quadrant',
          reading: 10.000,
          deviationFromCenter: 0.0,
          allowedLimit: 0.01,
          passed: true,
        },
        {
          id: 'pos-3',
          name: 'Back-Right (Corner 3)',
          description: 'Corner 3 off-center quadrant',
          reading: 10.001,
          deviationFromCenter: 0.001,
          allowedLimit: 0.01,
          passed: true,
        },
        {
          id: 'pos-4',
          name: 'Front-Right (Corner 4)',
          description: 'Corner 4 off-center quadrant',
          reading: 10.000,
          deviationFromCenter: 0.0,
          allowedLimit: 0.01,
          passed: true,
        },
      ],
      maxDeviation: 0.001,
      allowedLimit: 0.01,
      passed: true,
      ruleReference: 'OIML R-76-1:2006 Clause 3.6.2 Eccentricity requirement',
      formula: 'Max Deviation (0.0010 kg) ≤ MPE (0.0100 kg) at L ≈ Max/3',
      calculatedAt: '2026-03-05T11:20:00.000Z',
    },
    zeroTare: {
      initialZeroReading: 0.000,
      zeroSettingError: 0.000,
      zeroSettingMpe: 0.0025,
      zeroPassed: true,
      tareLoad: 5.0,
      indicatedNet: 5.000,
      tareDeviation: 0.000,
      tareMpe: 0.005,
      tarePassed: true,
      returnToZeroReading: 0.000,
      returnToZeroDeviation: 0.000,
      returnToZeroLimit: 0.005,
      returnPassed: true,
      overallPassed: true,
      ruleReference: 'OIML R-76-1 Clauses 4.5.2 & 4.5.3 Zero/Tare rules',
      formula: 'Zero Setting (|Δ0| ≤ 0.25e), Tare (|ΔNet| ≤ MPE), Return (|R0| ≤ 0.5e)',
      calculatedAt: '2026-03-05T11:45:00.000Z',
    },
    reviewerId: 'user-reviewer-02',
    reviewerName: 'Dr. Sunita Rao',
    reviewerNotes: 'All observations and calculations verified against OIML R-76 MPE tables. All 4 core modules passed.',
    reviewedAt: '2026-03-05T13:30:00.000Z',
    overallCompliance: true,
  };

  // Historical finalized certificate record (OIML-R76-2026-0089)
  const historicalInst = SEED_INSTRUMENTS.find((i) => i.instrumentId === 'NAWI-2026-DEL-01') || SEED_INSTRUMENTS[1] || nawi001;
  const test0089: TestRecord = {
    id: 'test-2026-0089',
    testId: 'TEST-2026-0089',
    reportId: 'OIML-R76-2026-0089',
    instrumentId: historicalInst.id,
    instrumentSnapshot: historicalInst,
    status: 'FINALIZED',
    testerId: 'user-tester-01',
    testerName: 'Vikram Mehta',
    reviewerId: 'user-reviewer-02',
    reviewerName: 'Dr. Sunita Rao',
    reviewerNotes: 'Verified against OIML R-76 metrological rules. Conforms to tolerances.',
    reviewedAt: '2026-02-15T11:00:00.000Z',
    approverId: 'user-approver-03',
    approverName: 'Sh. Rajesh Sharma',
    approverNotes: 'Conforms to Legal Metrology standards and OIML R-76. Final certificate approved.',
    approvedAt: '2026-02-15T14:30:00.000Z',
    finalizedAt: '2026-02-15T14:30:00.000Z',
    finalizedBy: 'Sh. Rajesh Sharma',
    verificationToken: 'VRF-78A9-B2C1-2026',
    createdAt: '2026-02-15T09:00:00.000Z',
    updatedAt: '2026-02-15T14:30:00.000Z',
    temperature: 20.5,
    humidity: 48.0,
    atmosphericPressure: 1014.0,
    testPlan: [
      { id: 'weighing_performance', title: 'Weighing Performance Test', applicable: true, applicabilityReason: 'Mandatory core test', status: 'COMPLETED' },
      { id: 'repeatability', title: 'Repeatability Test', applicable: true, applicabilityReason: 'Mandatory core test', status: 'COMPLETED' },
      { id: 'eccentricity', title: 'Eccentricity Test', applicable: true, applicabilityReason: 'Mandatory core test', status: 'COMPLETED' },
      { id: 'zero_tare', title: 'Tare & Zero-Setting Test', applicable: true, applicabilityReason: 'Mandatory core test', status: 'COMPLETED' },
    ],
    weighingPerformance: {
      points: [
        { id: 'wp-01', loadPercentage: 0, referenceLoad: 0.1, indicatedLoad: 0.1, error: 0.0, scaleIntervals: 20, applicableMpeE: 0.5, applicableMpeAbsolute: 0.0025, comparisonText: '|0.0000| ≤ 0.0025 kg', passed: true, direction: 'increasing', ruleReference: 'OIML R-76-1 Table 6' },
        { id: 'wp-02', loadPercentage: 17, referenceLoad: 2.5, indicatedLoad: 2.501, error: 0.001, scaleIntervals: 500, applicableMpeE: 0.5, applicableMpeAbsolute: 0.0025, comparisonText: '|+0.0010| ≤ 0.0025 kg', passed: true, direction: 'increasing', ruleReference: 'OIML R-76-1 Table 6' },
        { id: 'wp-03', loadPercentage: 50, referenceLoad: 7.5, indicatedLoad: 7.501, error: 0.001, scaleIntervals: 1500, applicableMpeE: 1.0, applicableMpeAbsolute: 0.005, comparisonText: '|+0.0010| ≤ 0.0050 kg', passed: true, direction: 'increasing', ruleReference: 'OIML R-76-1 Table 6' },
        { id: 'wp-04', loadPercentage: 100, referenceLoad: 15.0, indicatedLoad: 15.002, error: 0.002, scaleIntervals: 3000, applicableMpeE: 1.5, applicableMpeAbsolute: 0.0075, comparisonText: '|+0.0020| ≤ 0.0075 kg', passed: true, direction: 'increasing', ruleReference: 'OIML R-76-1 Table 6' },
      ],
      passed: true,
      maxError: 0.002,
      calculatedAt: '2026-02-15T10:30:00.000Z',
    },
    repeatability: {
      testLoad: 7.5,
      readings: [7.500, 7.501, 7.500],
      maxReading: 7.501,
      minReading: 7.500,
      rangeSpread: 0.001,
      allowedRangeSpread: 0.005,
      passed: true,
      ruleReference: 'OIML R-76-1:2006 Clause 3.6.1',
      formula: 'Spread (0.0010 kg) ≤ Allowed MPE (0.0050 kg)',
      calculatedAt: '2026-02-15T11:00:00.000Z',
    },
    eccentricity: {
      testLoad: 5.0,
      centerReading: 5.000,
      positions: [
        { id: 'pos-1', name: 'Corner 1', description: 'Off-center quadrant 1', reading: 5.001, deviationFromCenter: 0.001, allowedLimit: 0.005, passed: true },
        { id: 'pos-2', name: 'Corner 2', description: 'Off-center quadrant 2', reading: 5.000, deviationFromCenter: 0.0, allowedLimit: 0.005, passed: true },
        { id: 'pos-3', name: 'Corner 3', description: 'Off-center quadrant 3', reading: 5.001, deviationFromCenter: 0.001, allowedLimit: 0.005, passed: true },
        { id: 'pos-4', name: 'Corner 4', description: 'Off-center quadrant 4', reading: 5.000, deviationFromCenter: 0.0, allowedLimit: 0.005, passed: true },
      ],
      maxDeviation: 0.001,
      allowedLimit: 0.005,
      passed: true,
      ruleReference: 'OIML R-76-1:2006 Clause 3.6.2',
      formula: 'Max Dev (0.0010 kg) ≤ MPE (0.0050 kg)',
      calculatedAt: '2026-02-15T11:20:00.000Z',
    },
    zeroTare: {
      initialZeroReading: 0.0,
      zeroSettingError: 0.0,
      zeroSettingMpe: 0.00125,
      zeroPassed: true,
      tareLoad: 2.5,
      indicatedNet: 2.5,
      tareDeviation: 0.0,
      tareMpe: 0.0025,
      tarePassed: true,
      returnToZeroReading: 0.0,
      returnToZeroDeviation: 0.0,
      returnToZeroLimit: 0.0025,
      returnPassed: true,
      overallPassed: true,
      ruleReference: 'OIML R-76-1 Clauses 4.5.2 & 4.5.3',
      formula: 'Zero (|Δ0| ≤ 0.25e), Tare (|ΔNet| ≤ MPE), Return (|R0| ≤ 0.5e)',
      calculatedAt: '2026-02-15T11:40:00.000Z',
    },
    overallCompliance: true,
  };

  return [test9620, test0089];
}

class StorageRepository {
  private instruments: Instrument[] = [];
  private tests: TestRecord[] = [];
  private auditLogs: AuditLog[] = [];
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    try {
      // 1. Instruments
      const storedInst = localStorage.getItem(STORAGE_KEYS.INSTRUMENTS);
      if (storedInst) {
        try {
          this.instruments = JSON.parse(storedInst);
          const hasNawi001 = this.instruments.some((i) => i.instrumentId === 'NAWI-2026-001');
          if (!hasNawi001) {
            const nawi001 = SEED_INSTRUMENTS.find((i) => i.instrumentId === 'NAWI-2026-001');
            if (nawi001) {
              this.instruments.unshift(nawi001);
              localStorage.setItem(STORAGE_KEYS.INSTRUMENTS, JSON.stringify(this.instruments));
            }
          }
        } catch (e) {
          this.instruments = [...SEED_INSTRUMENTS];
          localStorage.setItem(STORAGE_KEYS.INSTRUMENTS, JSON.stringify(this.instruments));
        }
      } else {
        this.instruments = [...SEED_INSTRUMENTS];
        localStorage.setItem(STORAGE_KEYS.INSTRUMENTS, JSON.stringify(this.instruments));
      }

      // 2. Tests
      const initialSeed = createInitialTests();
      const storedTests = localStorage.getItem(STORAGE_KEYS.TESTS);
      if (storedTests) {
        try {
          let parsed: TestRecord[] = JSON.parse(storedTests);
          
          // Ensure TEST-2026-9620 is available
          const has9620 = parsed.some(
            (t) => t.testId === 'TEST-2026-9620' || t.id === 'test-2026-9620'
          );
          if (!has9620) {
            const test9620 = initialSeed.find((t) => t.testId === 'TEST-2026-9620');
            if (test9620) parsed.unshift(test9620);
          }

          // Ensure historical report OIML-R76-2026-0089 is available in the historical archive
          const has0089 = parsed.some(
            (t) => t.reportId === 'OIML-R76-2026-0089' || t.testId === 'TEST-2026-0089'
          );
          if (!has0089) {
            const test0089 = initialSeed.find((t) => t.reportId === 'OIML-R76-2026-0089');
            if (test0089) parsed.push(test0089);
          }

          this.tests = parsed;
          localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(this.tests));
        } catch (e) {
          this.tests = initialSeed;
          localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(this.tests));
        }
      } else {
        this.tests = initialSeed;
        localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(this.tests));
      }

      // 3. Audit Logs
      const storedLogs = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (storedLogs) {
        this.auditLogs = JSON.parse(storedLogs);
      } else {
        this.auditLogs = [
          {
            id: 'log-01',
            timestamp: '2026-02-15T09:30:00.000Z',
            userId: 'user-tester-01',
            userName: 'Vikram Mehta',
            userRole: 'tester',
            action: 'INSTRUMENT_CREATED',
            recordId: 'NAWI-2026-DEL-01',
            details: 'Registered Essae DS-215 (Class III, Max 30 kg, e=10 g)',
          },
          {
            id: 'log-02',
            timestamp: '2026-03-04T10:00:00.000Z',
            userId: 'user-tester-01',
            userName: 'Vikram Mehta',
            userRole: 'tester',
            action: 'TEST_CREATED',
            recordId: 'TEST-2026-0089',
            details: 'Generated test plan for NAWI-2026-DEL-01',
          },
          {
            id: 'log-03',
            timestamp: '2026-03-04T11:55:00.000Z',
            userId: 'user-tester-01',
            userName: 'Vikram Mehta',
            userRole: 'tester',
            action: 'TEST_SUBMITTED',
            recordId: 'TEST-2026-0089',
            details: 'Submitted test record with 4 compliant modules for review',
          },
          {
            id: 'log-04',
            timestamp: '2026-03-04T13:15:00.000Z',
            userId: 'user-reviewer-02',
            userName: 'Dr. Sunita Rao',
            userRole: 'reviewer',
            action: 'TEST_REVIEWED',
            recordId: 'TEST-2026-0089',
            details: 'Reviewed and approved test calculations against OIML R-76 MPE tables',
          },
          {
            id: 'log-05',
            timestamp: '2026-03-04T14:30:00.000Z',
            userId: 'user-approver-03',
            userName: 'Sh. Rajesh Sharma',
            userRole: 'approver',
            action: 'REPORT_FINALIZED',
            recordId: 'OIML-R76-2026-0089',
            details: 'Finalized and issued OIML R-76 Digital Certificate with QR and SHA-256 seal',
          },
        ];
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
      }

      this.initialized = true;
    } catch (err) {
      console.error('Storage initialization failed:', err);
    }
  }

  // --- INSTRUMENTS ---

  public getInstruments(): Instrument[] {
    if (typeof window !== 'undefined') {
      const storedInst = localStorage.getItem(STORAGE_KEYS.INSTRUMENTS);
      if (storedInst) {
        try {
          this.instruments = JSON.parse(storedInst);
        } catch (e) {}
      }
    }
    return [...this.instruments];
  }

  public getInstrumentById(id: string): Instrument | undefined {
    return this.getInstruments().find((inst) => inst.id === id || inst.instrumentId === id);
  }

  public saveInstrument(instrument: Instrument, currentUser?: User): Instrument {
    if (typeof window !== 'undefined') {
      const storedInst = localStorage.getItem(STORAGE_KEYS.INSTRUMENTS);
      if (storedInst) {
        try {
          this.instruments = JSON.parse(storedInst);
        } catch (e) {}
      }
    }

    const existingIndex = this.instruments.findIndex(
      (i) => (instrument.id && i.id === instrument.id) || (instrument.instrumentId && i.instrumentId === instrument.instrumentId)
    );
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      this.instruments[existingIndex] = {
        ...this.instruments[existingIndex],
        ...instrument,
        updatedAt: now,
      };
      this.addAuditLog({
        userId: currentUser?.id || 'sys',
        userName: currentUser?.name || 'Authorized User',
        userRole: currentUser?.role || 'tester',
        action: 'INSTRUMENT_UPDATED',
        recordId: instrument.instrumentId,
        details: `Updated instrument specifications for ${instrument.model} (${instrument.accuracyClass})`,
      });
    } else {
      const newInst: Instrument = {
        ...instrument,
        id: instrument.id || `inst-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      this.instruments.unshift(newInst);
      this.addAuditLog({
        userId: currentUser?.id || 'sys',
        userName: currentUser?.name || 'Authorized User',
        userRole: currentUser?.role || 'tester',
        action: 'INSTRUMENT_CREATED',
        recordId: newInst.instrumentId,
        details: `Registered new NAWI ${newInst.manufacturer} ${newInst.model} (${newInst.accuracyClass}, Max ${newInst.maxCapacity} ${newInst.capacityUnit})`,
      });
    }

    localStorage.setItem(STORAGE_KEYS.INSTRUMENTS, JSON.stringify(this.instruments));
    return instrument;
  }

  // --- TESTS ---

  public getTests(): TestRecord[] {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.TESTS);
      if (stored) {
        try {
          this.tests = JSON.parse(stored);
        } catch (e) {}
      }
    }
    return [...this.tests];
  }

  public getTestById(id: string): TestRecord | undefined {
    return this.getTests().find((t) => t.id === id || t.testId === id || t.reportId === id);
  }

  public getTestByVerificationToken(token: string): TestRecord | undefined {
    return this.getTests().find((t) => t.verificationToken === token);
  }

  public saveTest(test: TestRecord, currentUser?: User): TestRecord {
    // Sync with localStorage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEYS.TESTS);
      if (stored) {
        try {
          this.tests = JSON.parse(stored);
        } catch (e) {}
      }
    }

    const existingIndex = this.tests.findIndex(
      (t) => (test.id && t.id === test.id) || (test.testId && t.testId === test.testId)
    );
    const now = new Date().toISOString();

    let savedRecord: TestRecord;

    if (existingIndex >= 0) {
      savedRecord = {
        ...this.tests[existingIndex],
        ...test,
        updatedAt: now,
      };
      this.tests[existingIndex] = savedRecord;
    } else {
      savedRecord = {
        ...test,
        id: test.id || `test-${Date.now()}`,
        createdAt: test.createdAt || now,
        updatedAt: now,
      };
      this.tests.unshift(savedRecord);
      this.addAuditLog({
        userId: currentUser?.id || test.testerId,
        userName: currentUser?.name || test.testerName,
        userRole: currentUser?.role || 'tester',
        action: 'TEST_CREATED',
        recordId: savedRecord.testId,
        details: `Created new test plan for instrument ${savedRecord.instrumentSnapshot?.instrumentId || savedRecord.instrumentId}`,
      });
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(this.tests));
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_TEST, savedRecord.testId || savedRecord.id);
      if (savedRecord.reportId) {
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_REPORT, savedRecord.reportId);
      }
    }
    return savedRecord;
  }

  public getLastActiveTestId(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_TEST);
    }
    return null;
  }

  public setLastActiveTestId(id: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_TEST, id);
    }
  }

  public getLastActiveReportId(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_REPORT);
    }
    return null;
  }

  public setLastActiveReportId(id: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_REPORT, id);
    }
  }

  public deleteTest(id: string): boolean {
    const idx = this.tests.findIndex((t) => t.id === id);
    if (idx >= 0) {
      this.tests.splice(idx, 1);
      localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(this.tests));
      return true;
    }
    return false;
  }

  // --- AUDIT LOGS ---

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const newLog: AuditLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(newLog);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
  }

  // --- OFFLINE DRAFT REPOSITORY (IndexedDB + fallback) ---

  public saveOfflineDraft(instrumentId: string, data: Partial<TestRecord>): void {
    try {
      const drafts = this.getOfflineDrafts();
      drafts[instrumentId] = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEYS.OFFLINE_DRAFTS, JSON.stringify(drafts));
    } catch (e) {
      console.warn('Failed to save offline draft:', e);
    }
  }

  public getOfflineDraft(instrumentId: string): Partial<TestRecord> | null {
    try {
      const drafts = this.getOfflineDrafts();
      return drafts[instrumentId] || null;
    } catch {
      return null;
    }
  }

  public clearOfflineDraft(instrumentId: string): void {
    try {
      const drafts = this.getOfflineDrafts();
      delete drafts[instrumentId];
      localStorage.setItem(STORAGE_KEYS.OFFLINE_DRAFTS, JSON.stringify(drafts));
    } catch {}
  }

  private getOfflineDrafts(): Record<string, any> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_DRAFTS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  // --- STATS & ANALYTICS ---

  public getStats(): MetrologyStats {
    const totalInstruments = this.instruments.length;
    const totalTests = this.tests.length;

    let draftTests = 0;
    let submittedTests = 0;
    let underReviewTests = 0;
    let approvedTests = 0;
    let finalizedReports = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const t of this.tests) {
      if (t.status === 'DRAFT') draftTests++;
      else if (t.status === 'SUBMITTED') submittedTests++;
      else if (t.status === 'UNDER_REVIEW') underReviewTests++;
      else if (t.status === 'APPROVED') approvedTests++;
      else if (t.status === 'FINALIZED') finalizedReports++;

      if (t.overallCompliance) {
        passedTests++;
      } else {
        failedTests++;
      }
    }

    const evaluatedTests = passedTests + failedTests;
    const compliancePercentage =
      evaluatedTests > 0 ? Math.round((passedTests / evaluatedTests) * 100) : 100;

    return {
      totalInstruments,
      totalTests,
      draftTests,
      submittedTests,
      underReviewTests,
      approvedTests,
      finalizedReports,
      passedTests,
      failedTests,
      compliancePercentage,
    };
  }

  // --- TAMPER DEMONSTRATION HELPER ---
  public corruptTestForTamperDemo(testId: string): TestRecord | undefined {
    const test = this.tests.find((t) => t.id === testId || t.testId === testId);
    if (!test || !test.weighingPerformance?.points?.length) return undefined;

    // Introduce an unauthorized alteration in an observation after report finalization
    test.weighingPerformance.points[0].indicatedLoad += 0.050; // Modified reading
    test.weighingPerformance.points[0].error += 0.050;

    localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(this.tests));

    this.addAuditLog({
      userId: 'unauthorized-actor',
      userName: 'External Tamper Simulation',
      userRole: 'tester',
      action: 'TAMPER_DETECTED',
      recordId: test.reportId || test.testId,
      details: 'Unauthorized modification introduced to indicated weight observation in finalized record',
    });

    return test;
  }
}

export const storage = new StorageRepository();
