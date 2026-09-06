export type Role = 'tester' | 'reviewer' | 'approver' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  designation: string;
  lab: string;
}

export type AccuracyClass = 'I' | 'II' | 'III' | 'IIII' | 'IV';

export interface MultiIntervalRange {
  rangeIndex: number;
  max: number;
  e: number;
  d?: number;
}

export interface Instrument {
  id: string;
  instrumentId: string; // e.g. NAWI-2026-001
  manufacturer: string;
  model: string;
  serialNumber: string;
  instrumentType: string;
  accuracyClass: AccuracyClass;
  maxCapacity: number;
  minCapacity: number;
  capacityUnit: 'kg' | 'g';
  e: number; // verification scale interval
  d: number; // actual display scale interval
  intervalUnit: 'kg' | 'g' | 'mg';
  location: string;
  registrationDate: string;
  registeredBy: string;
  multiInterval?: boolean;
  multiIntervalRanges?: MultiIntervalRange[];
  hasTareDevice?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OimlRuleMetadata {
  ruleId: string;
  standard: 'OIML R 76-1:2006';
  section: string;
  description: string;
  formula: string;
  applicability: string;
  lastVerified: string;
}

export interface MpeRuleResult {
  testLoad: number;
  testLoadUnit: string;
  accuracyClass: AccuracyClass;
  e: number;
  eUnit: string;
  scaleIntervals: number; // m / e
  mpeE: number; // in multiples of e (±0.5, ±1.0, ±1.5)
  mpe: number; // in capacity unit or test load unit
  mpeUnit: string;
  ruleDescription: string;
  sourceReference: string;
  applicableRangeDescription: string;
  isMultiInterval?: boolean;
  activeRangeIndex?: number;
}

export interface CalculationTrace {
  calculationId: string;
  testType: TestModuleType;
  testLoad: number;
  testLoadUnit: string;
  indication: number;
  error: number;
  absoluteError: number;
  mpe: number;
  mpeUnit: string;
  formula: string;
  ruleUsed: string;
  r76Reference: string;
  decision: 'PASS' | 'FAIL';
  reason: string;
  timestamp: string;
  user?: string;
  inputValues: Record<string, any>;
}

export interface InstrumentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  n: number;
  nMinRequired: number;
  nMaxAllowed: number;
  minAllowed: number;
  details: {
    accuracyClass: AccuracyClass;
    max: number;
    min: number;
    e: number;
    d: number;
    n: number;
  };
}

export interface TestApplicabilityResult {
  weighingPerformance: { applicable: boolean; reason: string; clause: string };
  repeatability: { applicable: boolean; reason: string; clause: string };
  eccentricity: { applicable: boolean; reason: string; clause: string };
  zeroReturn: { applicable: boolean; reason: string; clause: string };
  tare: { applicable: boolean; reason: string; clause: string };
  discrimination: { applicable: boolean; reason: string; clause: string };
}

export type TestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CORRECTION_REQUIRED'
  | 'APPROVED'
  | 'FINALIZED';

export type TestModuleType =
  | 'weighing_performance'
  | 'repeatability'
  | 'eccentricity'
  | 'zero_tare'
  | 'discrimination';

export interface CalculationResult {
  testName: string;
  inputValues: Record<string, any>;
  formula: string;
  calculatedResult: number | string;
  applicableMpe: number | string;
  comparison: string;
  passed: boolean;
  ruleReference: string;
}

// Weighing Performance Point
export interface WeighingPoint {
  id: string;
  loadPercentage: number;
  referenceLoad: number; // in capacityUnit
  indicatedLoad: number; // in capacityUnit
  error: number; // indicated - reference
  absoluteError?: number; // |indicated - reference|
  scaleIntervals: number; // m / e in dimensionless scale intervals
  applicableMpeE: number; // in ±e (e.g. 0.5, 1.0, 1.5)
  applicableMpeAbsolute: number; // in capacityUnit
  comparisonText: string;
  passed: boolean;
  direction: 'increasing' | 'decreasing';
  ruleReference: string;
  reason?: string;
  formula?: string;
  appliedRuleId?: string;
  clauseCitation?: string;
  activeE?: number;
  isMultiInterval?: boolean;
  activeRangeIndex?: number;
}

export interface WeighingPerformanceData {
  points: WeighingPoint[];
  passed: boolean;
  maxError: number;
  calculatedAt: string;
}

// Repeatability
export interface RepeatabilityData {
  testLoad: number; // in capacityUnit (e.g. 50% or Max)
  readings: number[]; // e.g. 5 readings
  maxReading: number;
  minReading: number;
  rangeSpread: number; // max - min
  allowedRangeSpread: number; // R76 requirement (usually |MPE| for this load)
  passed: boolean;
  ruleReference: string;
  formula: string;
  calculatedAt: string;
}

// Eccentricity
export interface EccentricityPosition {
  id: string;
  name: string;
  description: string;
  reading: number;
  deviationFromCenter: number; // |reading - centerReading| or error
  allowedLimit: number; // MPE at eccentricity test load
  passed: boolean;
}

export interface EccentricityData {
  testLoad: number; // e.g. 1/3 Max per R76
  centerReading: number;
  positions: EccentricityPosition[];
  maxDeviation: number;
  allowedLimit: number;
  passed: boolean;
  ruleReference: string;
  formula: string;
  calculatedAt: string;
}

// Zero and Tare
export interface ZeroTareData {
  initialZeroReading: number;
  zeroSettingError: number; // <= 0.25 e
  zeroSettingMpe: number;
  zeroPassed: boolean;
  tareLoad: number;
  indicatedNet: number;
  tareDeviation: number;
  tareMpe: number;
  tarePassed: boolean;
  returnToZeroReading: number;
  returnToZeroDeviation: number;
  returnToZeroLimit: number;
  returnPassed: boolean;
  overallPassed: boolean;
  ruleReference: string;
  formula: string;
  calculatedAt: string;
}

// Discrimination
export interface DiscriminationData {
  baseLoad: number;
  initialIndication: number;
  extraLoad: number; // delta L = 1.4 d
  newIndication: number;
  changeObserved: number;
  requiredChange: number; // at least 1 d
  passed: boolean;
  ruleReference: string;
  formula: string;
  calculatedAt: string;
}

export interface TestPlanItem {
  id: TestModuleType;
  title: string;
  applicable: boolean;
  applicabilityReason: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export interface TestRecord {
  id: string;
  testId: string; // e.g. TEST-2026-001
  instrumentId: string;
  instrumentSnapshot: Instrument;
  status: TestStatus;
  testerId: string;
  testerName: string;
  createdAt: string;
  updatedAt: string;
  
  // Environment
  temperature: number; // °C
  humidity: number; // %
  atmosphericPressure: number; // hPa
  
  // Test modules
  testPlan: TestPlanItem[];
  weighingPerformance?: WeighingPerformanceData;
  repeatability?: RepeatabilityData;
  eccentricity?: EccentricityData;
  zeroTare?: ZeroTareData;
  discrimination?: DiscriminationData;
  traces?: CalculationTrace[];
  
  // Review & Approval Workflow
  reviewerId?: string;
  reviewerName?: string;
  reviewerNotes?: string;
  reviewedAt?: string;
  
  approverId?: string;
  approverName?: string;
  approverNotes?: string;
  approvedAt?: string;
  
  // Final Certification
  finalizedAt?: string;
  finalizedBy?: string;
  reportId?: string;
  verificationToken?: string;
  sha256Hash?: string;
  verificationUrl?: string;
  overallCompliance: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: Role;
  action:
    | 'LOGIN'
    | 'INSTRUMENT_CREATED'
    | 'INSTRUMENT_UPDATED'
    | 'TEST_CREATED'
    | 'OBSERVATION_UPDATED'
    | 'CALCULATION_EXECUTED'
    | 'TEST_SUBMITTED'
    | 'REVIEW_STARTED'
    | 'CORRECTION_REQUESTED'
    | 'TEST_REVIEWED'
    | 'TEST_APPROVED'
    | 'REPORT_FINALIZED'
    | 'REPORT_VERIFIED'
    | 'TAMPER_DETECTED';
  recordId: string;
  details: string;
}

export interface MetrologyStats {
  totalInstruments: number;
  totalTests: number;
  draftTests: number;
  submittedTests: number;
  underReviewTests: number;
  approvedTests: number;
  finalizedReports: number;
  passedTests: number;
  failedTests: number;
  compliancePercentage: number;
}
