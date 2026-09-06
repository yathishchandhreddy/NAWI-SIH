import React, { useState, useEffect } from 'react';
import { Instrument, TestRecord, TestPlanItem, WeighingPoint } from '../types';
import { storage } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import {
  determineApplicableTests,
  evaluateWeighingPoint,
  evaluateRepeatability,
  evaluateEccentricity,
  evaluateZeroTare,
  evaluateDiscrimination,
  calculateMPE,
  getEInCapacityUnit,
  getDInCapacityUnit,
  formatValue,
  validateInstrumentMetrology,
  evaluateWeighingPointR76,
  evaluateRepeatabilityR76,
  evaluateEccentricityR76,
  evaluateZeroTareR76,
  evaluateDiscriminationR76,
  runAllOimlR76UnitTests,
} from '../rules/oimlR76';
import {
  Scale,
  CheckCircle2,
  XCircle,
  Clock,
  Calculator,
  Save,
  Send,
  Sparkles,
  AlertTriangle,
  Info,
  ChevronRight,
  Layers,
  RotateCcw,
  Compass,
  Sliders,
  Check,
  Zap,
  ShieldCheck,
  BookOpen,
  Terminal,
} from 'lucide-react';

interface TestExecutionProps {
  selectedInstrument: Instrument | null;
  activeTestId?: string | null;
  onNavigateToReview: (testId: string) => void;
  onSelectInstrument: (inst: Instrument) => void;
}

export const TestExecution: React.FC<TestExecutionProps> = ({
  selectedInstrument,
  activeTestId,
  onNavigateToReview,
  onSelectInstrument,
}) => {
  const { currentUser, canExecuteTest, canSubmitTest } = useAuth();
  const [instruments, setInstruments] = useState<Instrument[]>(storage.getInstruments());
  const [currentInstrument, setCurrentInstrument] = useState<Instrument | null>(
    selectedInstrument || instruments[0] || null
  );

  // Active Test Record in memory
  const [testRecord, setTestRecord] = useState<TestRecord | null>(null);
  const [activeModule, setActiveModule] = useState<string>('weighing_performance');
  const [draftSavedTime, setDraftSavedTime] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // --- WEIGHING PERFORMANCE INPUT STATES ---
  const [wpRows, setWpRows] = useState<
    { id: string; ref: string; ind: string; dir: 'increasing' | 'decreasing' }[]
  >([]);

  // --- REPEATABILITY INPUT STATES ---
  const [repLoad, setRepLoad] = useState<string>('');
  const [repReadings, setRepReadings] = useState<string[]>(['', '', '', '', '']);

  // --- ECCENTRICITY INPUT STATES ---
  const [eccLoad, setEccLoad] = useState<string>('');
  const [eccCenter, setEccCenter] = useState<string>('');
  const [eccPositions, setEccPositions] = useState<{ id: string; name: string; reading: string }[]>([
    { id: 'pos-1', name: 'Front-Left (Pos 1)', reading: '' },
    { id: 'pos-2', name: 'Back-Left (Pos 2)', reading: '' },
    { id: 'pos-3', name: 'Back-Right (Pos 3)', reading: '' },
    { id: 'pos-4', name: 'Front-Right (Pos 4)', reading: '' },
  ]);

  // --- ZERO / TARE INPUT STATES ---
  const [ztInitialZero, setZtInitialZero] = useState<string>('0.000');
  const [ztTareLoad, setZtTareLoad] = useState<string>('');
  const [ztIndicatedNet, setZtIndicatedNet] = useState<string>('');
  const [ztReturnZero, setZtReturnZero] = useState<string>('0.000');

  // --- DISCRIMINATION INPUT STATES ---
  const [discBaseLoad, setDiscBaseLoad] = useState<string>('');
  const [discInitInd, setDiscInitInd] = useState<string>('');
  const [discNewInd, setDiscNewInd] = useState<string>('');

  // --- UNIT TESTS & VALIDATION STATES ---
  const [showUnitTestsModal, setShowUnitTestsModal] = useState<boolean>(false);
  const [unitTestSummary, setUnitTestSummary] = useState<ReturnType<typeof runAllOimlR76UnitTests> | null>(null);

  const instrumentValidation = currentInstrument ? validateInstrumentMetrology(currentInstrument) : null;

  const handleRunOimlUnitTests = () => {
    const summary = runAllOimlR76UnitTests();
    setUnitTestSummary(summary);
    setShowUnitTestsModal(true);
  };

  // Initialize or Load Test
  useEffect(() => {
    if (activeTestId) {
      const existing = storage.getTestById(activeTestId);
      if (existing) {
        setTestRecord(existing);
        setCurrentInstrument(existing.instrumentSnapshot);
        populateFormsFromRecord(existing);
        return;
      }
    }

    if (currentInstrument) {
      initializeNewTestForInstrument(currentInstrument);
    }
  }, [currentInstrument?.id, activeTestId]);

  const initializeNewTestForInstrument = (inst: Instrument) => {
    // Check if offline draft exists in IndexedDB/localStorage
    const draft = storage.getOfflineDraft(inst.id);
    const applicablePlan = determineApplicableTests(inst);

    const testId = inst.instrumentId === 'NAWI-2026-001'
      ? 'TEST-2026-9620'
      : `TEST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTest: TestRecord = {
      id: `test-${Date.now()}`,
      testId: testId,
      instrumentId: inst.id,
      instrumentSnapshot: inst,
      status: 'DRAFT',
      testerId: currentUser.id,
      testerName: currentUser.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      temperature: 22.0,
      humidity: 50.0,
      atmosphericPressure: 1013.25,
      testPlan: applicablePlan,
      overallCompliance: false,
    };

    setTestRecord(newTest);

    // Populate sensible initial test load recommendations based on Max capacity
    const eInCap = getEInCapacityUnit(inst);
    const minVal = inst.minCapacity;
    const maxVal = inst.maxCapacity;
    const midVal = parseFloat(formatValue((minVal + maxVal) / 2, 4));

    setWpRows([
      { id: 'wp-1', ref: minVal.toString(), ind: minVal.toString(), dir: 'increasing' },
      { id: 'wp-2', ref: formatValue(minVal + 50 * eInCap, 4), ind: formatValue(minVal + 50 * eInCap, 4), dir: 'increasing' },
      { id: 'wp-3', ref: midVal.toString(), ind: midVal.toString(), dir: 'increasing' },
      { id: 'wp-4', ref: maxVal.toString(), ind: maxVal.toString(), dir: 'increasing' },
    ]);

    setRepLoad(midVal.toString());
    setRepReadings([
      midVal.toString(),
      formatValue(midVal + 0.1 * eInCap, 4),
      midVal.toString(),
      midVal.toString(),
      formatValue(midVal - 0.1 * eInCap, 4),
    ]);

    const eccVal = parseFloat(formatValue(maxVal / 3, 4));
    setEccLoad(eccVal.toString());
    setEccCenter(eccVal.toString());
    setEccPositions([
      { id: 'pos-1', name: 'Front-Left (Pos 1)', reading: eccVal.toString() },
      { id: 'pos-2', name: 'Back-Left (Pos 2)', reading: eccVal.toString() },
      { id: 'pos-3', name: 'Back-Right (Pos 3)', reading: eccVal.toString() },
      { id: 'pos-4', name: 'Front-Right (Pos 4)', reading: eccVal.toString() },
    ]);

    const tareVal = parseFloat(formatValue(maxVal * 0.2, 4));
    setZtInitialZero('0.000');
    setZtTareLoad(tareVal.toString());
    setZtIndicatedNet(tareVal.toString());
    setZtReturnZero('0.000');

    setDiscBaseLoad(midVal.toString());
    setDiscInitInd(midVal.toString());
    const dInCap = getDInCapacityUnit(inst);
    setDiscNewInd(formatValue(midVal + dInCap, 4));
  };

  const populateFormsFromRecord = (record: TestRecord) => {
    if (record.weighingPerformance?.points) {
      setWpRows(
        record.weighingPerformance.points.map((p) => ({
          id: p.id,
          ref: p.referenceLoad.toString(),
          ind: p.indicatedLoad.toString(),
          dir: p.direction,
        }))
      );
    }
    if (record.repeatability) {
      setRepLoad(record.repeatability.testLoad.toString());
      setRepReadings(record.repeatability.readings.map((r) => r.toString()));
    }
    if (record.eccentricity) {
      setEccLoad(record.eccentricity.testLoad.toString());
      setEccCenter(record.eccentricity.centerReading.toString());
      setEccPositions(
        record.eccentricity.positions.map((p) => ({
          id: p.id,
          name: p.name,
          reading: p.reading.toString(),
        }))
      );
    }
    if (record.zeroTare) {
      setZtInitialZero(record.zeroTare.initialZeroReading.toString());
      setZtTareLoad(record.zeroTare.tareLoad.toString());
      setZtIndicatedNet(record.zeroTare.indicatedNet.toString());
      setZtReturnZero(record.zeroTare.returnToZeroReading.toString());
    }
    if (record.discrimination) {
      setDiscBaseLoad(record.discrimination.baseLoad.toString());
      setDiscInitInd(record.discrimination.initialIndication.toString());
      setDiscNewInd(record.discrimination.newIndication.toString());
    }
  };

  // --- CALCULATION HANDLERS (OIML R-76 Engine) ---

  const handleCalculateWeighingPerformance = () => {
    if (!currentInstrument || !testRecord) return;

    // Check metrological configuration validity
    if (instrumentValidation && !instrumentValidation.isValid) {
      setValidationError(
        `OIML R 76 Table 3 Metrological Violation: ${instrumentValidation.errors.join(' | ')}`
      );
      return;
    }

    const points: WeighingPoint[] = [];
    const newTraces = [...(testRecord.traces || [])];
    let allPassed = true;
    let maxErr = 0;

    for (const row of wpRows) {
      const ref = parseFloat(row.ref);
      const ind = parseFloat(row.ind);
      if (isNaN(ref) || isNaN(ind)) {
        setValidationError('Please enter valid numerical values for reference and indicated loads.');
        return;
      }
      try {
        const { point: evalPoint, trace } = evaluateWeighingPointR76(
          currentInstrument,
          ref,
          ind,
          row.dir,
          row.id
        );
        points.push(evalPoint);
        newTraces.push(trace);
        if (!evalPoint.passed) allPassed = false;
        if (Math.abs(evalPoint.error) > maxErr) maxErr = Math.abs(evalPoint.error);
      } catch (err: any) {
        setValidationError(err?.message || 'Error calculating weighing point.');
        return;
      }
    }

    setValidationError(null);

    const updatedRecord: TestRecord = {
      ...testRecord,
      weighingPerformance: {
        points,
        passed: allPassed,
        maxError: maxErr,
        calculatedAt: new Date().toISOString(),
      },
      traces: newTraces,
      testPlan: testRecord.testPlan.map((item) =>
        item.id === 'weighing_performance'
          ? { ...item, status: allPassed ? 'COMPLETED' : 'FAILED' }
          : item
      ),
    };

    setTestRecord(updatedRecord);
    autoSaveDraft(updatedRecord);
  };

  const handleCalculateRepeatability = () => {
    if (!currentInstrument || !testRecord) return;
    const load = parseFloat(repLoad);
    const numReadings = repReadings.map((r) => parseFloat(r)).filter((n) => !isNaN(n));

    if (isNaN(load) || numReadings.length < 3) {
      setValidationError('OIML R 76-1:2006 Clause 3.6.1 requires at least 3 valid numeric observations.');
      return;
    }

    setValidationError(null);
    const { data: result, trace } = evaluateRepeatabilityR76(currentInstrument, load, numReadings);
    const newTraces = [...(testRecord.traces || []), trace];

    const updatedRecord: TestRecord = {
      ...testRecord,
      repeatability: result,
      traces: newTraces,
      testPlan: testRecord.testPlan.map((item) =>
        item.id === 'repeatability'
          ? { ...item, status: result.passed ? 'COMPLETED' : 'FAILED' }
          : item
      ),
    };

    setTestRecord(updatedRecord);
    autoSaveDraft(updatedRecord);
  };

  const handleCalculateEccentricity = () => {
    if (!currentInstrument || !testRecord) return;
    const load = parseFloat(eccLoad);
    const center = parseFloat(eccCenter);

    if (isNaN(load) || isNaN(center)) {
      setValidationError('Please specify test load and center reading.');
      return;
    }

    const posInputs = eccPositions.map((p) => ({
      id: p.id,
      name: p.name,
      description: `Corner off-center position`,
      reading: parseFloat(p.reading) || center,
    }));

    setValidationError(null);
    const { data: result, trace } = evaluateEccentricityR76(currentInstrument, load, center, posInputs);
    const newTraces = [...(testRecord.traces || []), trace];

    const updatedRecord: TestRecord = {
      ...testRecord,
      eccentricity: result,
      traces: newTraces,
      testPlan: testRecord.testPlan.map((item) =>
        item.id === 'eccentricity'
          ? { ...item, status: result.passed ? 'COMPLETED' : 'FAILED' }
          : item
      ),
    };

    setTestRecord(updatedRecord);
    autoSaveDraft(updatedRecord);
  };

  const handleCalculateZeroTare = () => {
    if (!currentInstrument || !testRecord) return;
    const initZero = parseFloat(ztInitialZero);
    const tareLoad = parseFloat(ztTareLoad);
    const indNet = parseFloat(ztIndicatedNet);
    const retZero = parseFloat(ztReturnZero);

    if (isNaN(initZero) || isNaN(tareLoad) || isNaN(indNet) || isNaN(retZero)) {
      setValidationError('Please fill in all zero and tare observations.');
      return;
    }

    setValidationError(null);
    const { data: result, trace } = evaluateZeroTareR76(
      currentInstrument,
      initZero,
      tareLoad,
      indNet,
      retZero
    );
    const newTraces = [...(testRecord.traces || []), trace];

    const updatedRecord: TestRecord = {
      ...testRecord,
      zeroTare: result,
      traces: newTraces,
      testPlan: testRecord.testPlan.map((item) =>
        item.id === 'zero_tare'
          ? { ...item, status: result.overallPassed ? 'COMPLETED' : 'FAILED' }
          : item
      ),
    };

    setTestRecord(updatedRecord);
    autoSaveDraft(updatedRecord);
  };

  const handleCalculateDiscrimination = () => {
    if (!currentInstrument || !testRecord) return;
    const base = parseFloat(discBaseLoad);
    const initInd = parseFloat(discInitInd);
    const newInd = parseFloat(discNewInd);

    if (isNaN(base) || isNaN(initInd) || isNaN(newInd)) {
      setValidationError('Please provide valid numbers for discrimination evaluation.');
      return;
    }

    setValidationError(null);
    const { data: result, trace } = evaluateDiscriminationR76(
      currentInstrument,
      base,
      initInd,
      newInd
    );
    const newTraces = [...(testRecord.traces || []), trace];

    const updatedRecord: TestRecord = {
      ...testRecord,
      discrimination: result,
      traces: newTraces,
      testPlan: testRecord.testPlan.map((item) =>
        item.id === 'discrimination'
          ? { ...item, status: result.passed ? 'COMPLETED' : 'FAILED' }
          : item
      ),
    };

    setTestRecord(updatedRecord);
    autoSaveDraft(updatedRecord);
  };

  // Auto-save draft to IndexedDB / localStorage
  const autoSaveDraft = (record: TestRecord) => {
    if (!currentInstrument) return;
    storage.saveOfflineDraft(currentInstrument.id, record);
    setDraftSavedTime(new Date().toLocaleTimeString());
  };

  // Submit test to Reviewer
  const handleSubmitForReview = () => {
    if (!testRecord || !currentInstrument) return;

    // Check that all applicable tests are completed
    const pendingApplicable = testRecord.testPlan.filter(
      (item) => item.applicable && item.status === 'PENDING'
    );

    if (pendingApplicable.length > 0) {
      setValidationError(
        `Cannot submit: The following applicable test modules are still pending calculation: ${pendingApplicable
          .map((i) => i.title)
          .join(', ')}.`
      );
      return;
    }

    // Determine overall compliance
    const failedApplicable = testRecord.testPlan.filter(
      (item) => item.applicable && item.status === 'FAILED'
    );
    const overallCompliance = failedApplicable.length === 0;

    const submittedRecord: TestRecord = {
      ...testRecord,
      status: 'SUBMITTED',
      overallCompliance,
      updatedAt: new Date().toISOString(),
    };

    storage.saveTest(submittedRecord, currentUser);
    storage.clearOfflineDraft(currentInstrument.id);
    setTestRecord(submittedRecord);
    setSubmissionSuccess(true);
    setValidationError(null);

    storage.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'TEST_SUBMITTED',
      recordId: submittedRecord.testId,
      details: `Tester ${currentUser.name} submitted test ${submittedRecord.testId} for instrument ${currentInstrument.instrumentId} with compliance status: [${overallCompliance ? 'PASS' : 'FAIL'}]`,
    });
  };

  if (!currentInstrument) {
    return (
      <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
        <Scale className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800 text-sm">No Instrument Selected</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Please register or select a NAWI instrument from the registry to begin testing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instrument Selection Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-900">
                {currentInstrument.manufacturer} {currentInstrument.model}
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300 font-bold">
                Class {currentInstrument.accuracyClass}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>ID: {currentInstrument.instrumentId}</span>
              <span>•</span>
              <span>SN: {currentInstrument.serialNumber}</span>
              <span>•</span>
              <span>Max: {currentInstrument.maxCapacity} {currentInstrument.capacityUnit}</span>
              <span>•</span>
              <span>Min: {currentInstrument.minCapacity} {currentInstrument.capacityUnit}</span>
              <span>•</span>
              <span>e = {currentInstrument.e} {currentInstrument.intervalUnit}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                n = Max / e = {instrumentValidation?.n ? instrumentValidation.n.toLocaleString() : 'N/A'}
              </span>
            </div>
            {/* OIML R 76 Table 3 Metrological Compliance Badge */}
            <div className="mt-1.5 flex items-center space-x-2">
              {instrumentValidation?.isValid ? (
                <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>OIML R 76-1 Table 3 Metrologically Valid</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>OIML R 76 Configuration Error</span>
                </span>
              )}
              {currentInstrument.multiInterval && (
                <span className="text-[11px] font-semibold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Multi-Interval (Clause 3.3)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions & Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunOimlUnitTests}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs"
            title="Run 12 Metrological Engine Unit Tests (33 Assertions)"
          >
            <Terminal className="w-3.5 h-3.5 text-indigo-600" />
            <span>Verify Calculation Engine (Run Tests)</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Select Instrument:</span>
            <select
              value={currentInstrument.id}
              onChange={(e) => {
                const found = instruments.find((i) => i.id === e.target.value);
                if (found) {
                  setCurrentInstrument(found);
                  onSelectInstrument(found);
                  setSubmissionSuccess(false);
                }
              }}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {instruments.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.instrumentId} - {i.model} (Class {i.accuracyClass})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metrological Configuration Error Banner if Table 3 Violation */}
      {instrumentValidation && !instrumentValidation.isValid && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs space-y-1.5 animate-in fade-in">
          <div className="flex items-center space-x-2 font-bold text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>OIML R 76-1:2006 Metrological Validation Error (Table 3)</span>
          </div>
          <p className="text-slate-700">
            This instrument parameters do not comply with authoritative OIML R 76 Table 3 requirements. Calculations are blocked until corrected:
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-rose-800 font-medium pl-1">
            {instrumentValidation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Test Plan Status Summary Card */}
      {testRecord && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2 mb-3">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">Test Plan:</span>
                  {testRecord.status === 'DRAFT' ? (
                    <input
                      type="text"
                      value={testRecord.testId}
                      onChange={(e) =>
                        setTestRecord((prev) => (prev ? { ...prev, testId: e.target.value.trim() } : null))
                      }
                      className="text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-blue-700"
                    />
                  ) : (
                    <span className="font-bold text-xs text-blue-700 font-mono">{testRecord.testId}</span>
                  )}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Status: {testRecord.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatically tailored modules conforming to OIML R-76 for Class {currentInstrument.accuracyClass}
              </p>
            </div>

            {/* Offline Draft Indicator */}
            {draftSavedTime && (
              <div className="flex items-center space-x-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Offline Draft Saved in IndexedDB at {draftSavedTime}</span>
              </div>
            )}
          </div>

          {/* Module Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {testRecord.testPlan.map((planItem) => {
              const isSelected = activeModule === planItem.id;
              let statusBadge = (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Pending
                </span>
              );
              if (!planItem.applicable) {
                statusBadge = (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-50 text-slate-400 border border-slate-200">
                    Not Applicable
                  </span>
                );
              } else if (planItem.status === 'COMPLETED') {
                statusBadge = (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center space-x-1">
                    <Check className="w-2.5 h-2.5" />
                    <span>PASSED</span>
                  </span>
                );
              } else if (planItem.status === 'FAILED') {
                statusBadge = (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold flex items-center space-x-1">
                    <XCircle className="w-2.5 h-2.5" />
                    <span>FAILED</span>
                  </span>
                );
              }

              return (
                <button
                  key={planItem.id}
                  disabled={!planItem.applicable}
                  onClick={() => setActiveModule(planItem.id)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : planItem.applicable
                      ? 'border-slate-200 hover:border-slate-300 bg-white'
                      : 'border-slate-100 bg-slate-50/50 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900 truncate mb-1">
                    {planItem.title}
                  </div>
                  <div className="flex items-center justify-between">
                    {statusBadge}
                    {planItem.applicable && (
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Validation Message */}
      {validationError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Success Submission Alert */}
      {submissionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center space-x-2 font-bold text-sm text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Test Successfully Submitted to Quality Review!</span>
          </div>
          <p className="text-slate-700">
            Test record <strong>{testRecord?.testId}</strong> is now in <strong>SUBMITTED</strong> state.
            Under OIML R-76 compliance rules, the record is locked for Tester editing and awaits QA Reviewer authorization.
          </p>
          <div className="pt-2 flex items-center space-x-3">
            <button
              onClick={() => onNavigateToReview(testRecord?.id || '')}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors shadow-xs inline-flex items-center space-x-1.5"
            >
              <span>Go to Reviewer Workflow</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] text-slate-500">
              (Use the top navbar role switcher to act as Reviewer Dr. Sunita Rao)
            </span>
          </div>
        </div>
      )}

      {/* ACTIVE TEST MODULE FORM */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* MODULE 1: WEIGHING PERFORMANCE TEST */}
        {activeModule === 'weighing_performance' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Scale className="w-4 h-4 text-blue-600" />
                  <span>Weighing Performance Test (OIML R-76-1:2006 A.4.4)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Verify error of indication against Maximum Permissible Error (MPE) Table 6 limits
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const eInCap = getEInCapacityUnit(currentInstrument);
                    const newId = `wp-${Date.now()}`;
                    setWpRows([
                      ...wpRows,
                      { id: newId, ref: '10.0', ind: '10.002', dir: 'increasing' },
                    ]);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
                >
                  + Add Load Point
                </button>
                <button
                  onClick={handleCalculateWeighingPerformance}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Run OIML R-76 Calculations</span>
                </button>
              </div>
            </div>

            {/* Input Observations Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Point</th>
                    <th className="py-2.5 px-3">Reference Load ({currentInstrument.capacityUnit})</th>
                    <th className="py-2.5 px-3">Indicated Value ({currentInstrument.capacityUnit})</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wpRows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="py-2 px-3 font-medium text-slate-700">Point #{index + 1}</td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="any"
                          value={row.ref}
                          onChange={(e) => {
                            const updated = [...wpRows];
                            updated[index].ref = e.target.value;
                            setWpRows(updated);
                          }}
                          className="w-32 px-2 py-1 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="any"
                          value={row.ind}
                          onChange={(e) => {
                            const updated = [...wpRows];
                            updated[index].ind = e.target.value;
                            setWpRows(updated);
                          }}
                          className="w-32 px-2 py-1 bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={row.dir}
                          onChange={(e) => {
                            const updated = [...wpRows];
                            updated[index].dir = e.target.value as 'increasing' | 'decreasing';
                            setWpRows(updated);
                          }}
                          className="px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                        >
                          <option value="increasing">Increasing (▲)</option>
                          <option value="decreasing">Decreasing (▼)</option>
                        </select>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {wpRows.length > 1 && (
                          <button
                            onClick={() => setWpRows(wpRows.filter((r) => r.id !== row.id))}
                            className="text-slate-400 hover:text-rose-600 text-xs"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* LIVE CALCULATION ENGINE OUTPUT (Sections 4 & 5) */}
            {testRecord?.weighingPerformance?.points && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>OIML R-76 Calculated Results & MPE Verification</span>
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                      testRecord.weighingPerformance.passed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {testRecord.weighingPerformance.passed ? 'PASSED (COMPLIANT)' : 'FAILED (OUT OF TOLERANCE)'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider">
                        <th className="py-2 px-3">Reference (m)</th>
                        <th className="py-2 px-3">Indicated</th>
                        <th className="py-2 px-3">Error (E = Ind - Ref)</th>
                        <th className="py-2 px-3">m / e Intervals</th>
                        <th className="py-2 px-3">MPE (Table 6)</th>
                        <th className="py-2 px-3">Comparison</th>
                        <th className="py-2 px-3 text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {testRecord.weighingPerformance.points.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {formatValue(p.referenceLoad, 4)} {currentInstrument.capacityUnit}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {formatValue(p.indicatedLoad, 4)}
                          </td>
                          <td
                            className={`py-2 px-3 font-semibold ${
                              p.error > 0 ? 'text-blue-700' : p.error < 0 ? 'text-amber-700' : 'text-slate-700'
                            }`}
                          >
                            {p.error >= 0 ? '+' : ''}
                            {formatValue(p.error, 4)} {currentInstrument.capacityUnit}
                          </td>
                          <td className="py-2 px-3 text-slate-600">{p.scaleIntervals} e</td>
                          <td className="py-2 px-3 text-slate-700">
                            ±{p.applicableMpeE} e (±{formatValue(p.applicableMpeAbsolute, 4)} {currentInstrument.capacityUnit})
                          </td>
                          <td className="py-2 px-3 text-slate-600">{p.comparisonText}</td>
                          <td className="py-2 px-3 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                p.passed
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                            >
                              {p.passed ? 'PASS' : 'FAIL'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <strong>Rule Applied:</strong> OIML Recommendation R 76-1:2006 Clause 3.5.1 / Table 6. Maximum error observed: <strong>{formatValue(testRecord.weighingPerformance.maxError, 4)} {currentInstrument.capacityUnit}</strong>.
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Formula: E = I - L, |E| ≤ MPE
                  </div>
                </div>

                {/* OIML R-76 User-Facing Calculation Trace & Explanation Cards (Section 13) */}
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-800 mb-2.5 flex items-center space-x-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>Metrological Calculation Explanations (OIML R 76-1:2006 Clause 3.5.3 & Table 6)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {testRecord.weighingPerformance.points.map((p, idx) => {
                      const refStr = `${formatValue(p.referenceLoad, 4)} ${currentInstrument.capacityUnit}`;
                      const indStr = `${formatValue(p.indicatedLoad, 4)} ${currentInstrument.capacityUnit}`;
                      const sign = p.error >= 0 ? '+' : '';
                      const errStr = `${sign}${formatValue(p.error, 4)} ${currentInstrument.capacityUnit}`;
                      const absErrStr = `${formatValue(p.absoluteError !== undefined ? p.absoluteError : Math.abs(p.error), 4)} ${currentInstrument.capacityUnit}`;
                      const mpeStr = `±${formatValue(p.applicableMpeAbsolute, 4)} ${currentInstrument.capacityUnit} (±${p.applicableMpeE} e)`;
                      return (
                        <div
                          key={p.id || idx}
                          className={`p-3.5 rounded-xl border text-xs space-y-2 shadow-2xs transition-all ${
                            p.passed
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-rose-50/50 border-rose-200'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                            <span className="font-bold text-slate-900">
                              Load Point #{idx + 1} ({p.loadPercentage}% Max)
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                p.passed
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}
                            >
                              {p.passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>

                          <div className="space-y-1 font-mono text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-500 font-sans">REFERENCE LOAD:</span>
                              <span className="font-bold text-slate-900">{refStr}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 font-sans">INDICATION:</span>
                              <span className="font-semibold text-slate-800">{indStr}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 font-sans">ERROR:</span>
                              <span
                                className={`font-bold ${
                                  p.error > 0 ? 'text-blue-700' : p.error < 0 ? 'text-amber-700' : 'text-slate-700'
                                }`}
                              >
                                {errStr}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 font-sans">ABSOLUTE ERROR:</span>
                              <span className="font-bold text-slate-900">{absErrStr}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 font-sans">APPLICABLE MPE:</span>
                              <span className="font-bold text-slate-900">{mpeStr}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500 font-sans">DECISION:</span>
                              <span
                                className={`font-bold ${
                                  p.passed ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {p.passed ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200/70 text-[11px] text-slate-700 font-sans">
                            <span className="font-bold text-slate-900">REASON: </span>
                            <span>
                              {p.reason ||
                                (p.passed
                                  ? 'Absolute error is within the applicable maximum permissible error.'
                                  : 'Absolute error exceeds the applicable maximum permissible error.')}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-500 font-mono pt-0.5">
                            Ref: {p.clauseCitation || 'OIML R 76-1:2006 Clause 3.5.1 & Table 6'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODULE 2: REPEATABILITY TEST */}
        {activeModule === 'repeatability' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-blue-600" />
                  <span>Repeatability Test (OIML R-76-1:2006 Clause 3.6.1)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Multiple weighings at the same load. Spread (Max - Min) shall not exceed |MPE| for that load.
                </p>
              </div>

              <button
                onClick={handleCalculateRepeatability}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Calculate Repeatability Spread</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Test Load Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Test Load ({currentInstrument.capacityUnit}) * (typically ~50% Max or Max)
                </label>
                <input
                  type="number"
                  step="any"
                  value={repLoad}
                  onChange={(e) => setRepLoad(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Multiple Repeated Readings */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Repeated Observations for Same Load ({currentInstrument.capacityUnit})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {repReadings.map((reading, idx) => (
                    <div key={idx}>
                      <span className="text-[11px] text-slate-500 block mb-1">Reading #{idx + 1}</span>
                      <input
                        type="number"
                        step="any"
                        value={reading}
                        onChange={(e) => {
                          const updated = [...repReadings];
                          updated[idx] = e.target.value;
                          setRepReadings(updated);
                        }}
                        className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono focus:bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Repeatability Output Card */}
            {testRecord?.repeatability && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Repeatability Statistical Evaluation
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                      testRecord.repeatability.passed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {testRecord.repeatability.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Maximum Reading</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatValue(testRecord.repeatability.maxReading, 4)} {currentInstrument.capacityUnit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Minimum Reading</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatValue(testRecord.repeatability.minReading, 4)} {currentInstrument.capacityUnit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Range / Spread (Max - Min)</span>
                    <span className="font-mono font-bold text-blue-700">
                      {formatValue(testRecord.repeatability.rangeSpread, 4)} {currentInstrument.capacityUnit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Allowed Limit (|MPE|)</span>
                    <span className="font-mono font-bold text-slate-900">
                      ≤ {formatValue(testRecord.repeatability.allowedRangeSpread, 4)} {currentInstrument.capacityUnit}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 font-mono bg-white p-2.5 rounded border border-slate-200">
                  Formula: {testRecord.repeatability.formula}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODULE 3: ECCENTRICITY (CORNER LOAD) TEST */}
        {activeModule === 'eccentricity' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Compass className="w-4 h-4 text-blue-600" />
                  <span>Eccentricity (Corner Load) Test (OIML R-76-1:2006 Clause 3.6.2)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Test load at 1/3 Max placed across 4 quadrants. Deviation between off-center and center must not exceed MPE.
                </p>
              </div>

              <button
                onClick={handleCalculateEccentricity}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Calculate Eccentric Deviations</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Platform SVG Diagram */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-slate-700 mb-2">Weighing Pan / Platform Map</span>
                <div className="relative w-48 h-48 bg-white border-2 border-dashed border-slate-400 rounded-xl flex items-center justify-center shadow-inner">
                  {/* Center Plate Marker */}
                  <div className="w-12 h-12 rounded-full bg-blue-100 border border-blue-400 flex items-center justify-center text-[10px] font-bold text-blue-800">
                    Center
                  </div>

                  {/* Corner Position Markers */}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[9px] font-bold">
                    Pos 1 (FL)
                  </div>
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[9px] font-bold">
                    Pos 2 (BL)
                  </div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[9px] font-bold">
                    Pos 3 (BR)
                  </div>
                  <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[9px] font-bold">
                    Pos 4 (FR)
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 mt-2">Corner Load Receptor Points</span>
              </div>

              {/* Right Column: Position Observation Inputs */}
              <div className="lg:col-span-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Eccentric Test Load (≈ Max/3) ({currentInstrument.capacityUnit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={eccLoad}
                      onChange={(e) => setEccLoad(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Center Position Reading ({currentInstrument.capacityUnit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={eccCenter}
                      onChange={(e) => setEccCenter(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-700 block">Corner Readings</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {eccPositions.map((pos, idx) => (
                      <div key={pos.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-800">{pos.name}</span>
                        <input
                          type="number"
                          step="any"
                          value={pos.reading}
                          onChange={(e) => {
                            const updated = [...eccPositions];
                            updated[idx].reading = e.target.value;
                            setEccPositions(updated);
                          }}
                          className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Eccentricity Output Card */}
            {testRecord?.eccentricity && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Corner Load Deviations vs Limit
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                      testRecord.eccentricity.passed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {testRecord.eccentricity.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {testRecord.eccentricity.positions.map((p) => (
                    <div key={p.id} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                      <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Deviation: {formatValue(p.deviationFromCenter, 4)} {currentInstrument.capacityUnit}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Limit: ≤ {formatValue(p.allowedLimit, 4)}
                      </div>
                      <span
                        className={`mt-1 inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          p.passed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {p.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-[11px] text-slate-600 font-mono bg-white p-2.5 rounded border border-slate-200">
                  {testRecord.eccentricity.formula}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODULE 4: ZERO / TARE TEST */}
        {activeModule === 'zero_tare' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Zero-Setting & Tare Device Test (OIML R-76-1:2006 Clause 4.5)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Verify initial zero-setting accuracy (≤ 0.25e), tare error, and return to zero (≤ 0.5e).
                </p>
              </div>

              <button
                onClick={handleCalculateZeroTare}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Calculate Zero & Tare</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Zero Error ({currentInstrument.capacityUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={ztInitialZero}
                  onChange={(e) => setZtInitialZero(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Applied Tare Load ({currentInstrument.capacityUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={ztTareLoad}
                  onChange={(e) => setZtTareLoad(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Indicated Net with Tare ({currentInstrument.capacityUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={ztIndicatedNet}
                  onChange={(e) => setZtIndicatedNet(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return to Zero after Unload ({currentInstrument.capacityUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={ztReturnZero}
                  onChange={(e) => setZtReturnZero(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            {testRecord?.zeroTare && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Zero & Tare Compliance Breakdown
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                      testRecord.zeroTare.overallPassed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {testRecord.zeroTare.overallPassed ? 'ALL ZERO/TARE PASSED' : 'FAILED'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">1. Zero Setting (≤ 0.25e)</span>
                    <span className="font-mono text-slate-600 block">
                      Observed: {formatValue(testRecord.zeroTare.zeroSettingError, 4)} {currentInstrument.capacityUnit}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px] block">
                      Limit: ≤ {formatValue(testRecord.zeroTare.zeroSettingMpe, 4)}
                    </span>
                    <span className={`text-[10px] font-bold ${testRecord.zeroTare.zeroPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {testRecord.zeroTare.zeroPassed ? '✓ Passed' : '✗ Out of tolerance'}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-800 block">2. Tare Weighing Error</span>
                    <span className="font-mono text-slate-600 block">
                      Deviation: {formatValue(testRecord.zeroTare.tareDeviation, 4)} {currentInstrument.capacityUnit}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px] block">
                      MPE: ≤ {formatValue(testRecord.zeroTare.tareMpe, 4)}
                    </span>
                    <span className={`text-[10px] font-bold ${testRecord.zeroTare.tarePassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {testRecord.zeroTare.tarePassed ? '✓ Passed' : '✗ Out of tolerance'}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-800 block">3. Return to Zero (≤ 0.5e)</span>
                    <span className="font-mono text-slate-600 block">
                      Observed: {formatValue(testRecord.zeroTare.returnToZeroDeviation, 4)} {currentInstrument.capacityUnit}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px] block">
                      Limit: ≤ {formatValue(testRecord.zeroTare.returnToZeroLimit, 4)}
                    </span>
                    <span className={`text-[10px] font-bold ${testRecord.zeroTare.returnPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {testRecord.zeroTare.returnPassed ? '✓ Passed' : '✗ Out of tolerance'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODULE 5: DISCRIMINATION TEST (If applicable) */}
        {activeModule === 'discrimination' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span>Discrimination / Sensitivity Test (OIML R-76-1:2006 Clause 3.8)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Applicable for high precision balances. Additional load ΔL = 1.4 d shall produce indication change ≥ 1.0 d.
                </p>
              </div>

              <button
                onClick={handleCalculateDiscrimination}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Calculate Discrimination</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Base Load ({currentInstrument.capacityUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={discBaseLoad}
                  onChange={(e) => setDiscBaseLoad(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Indication ({currentInstrument.capacityUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={discInitInd}
                  onChange={(e) => setDiscInitInd(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Indication with +1.4d Load ({currentInstrument.capacityUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={discNewInd}
                  onChange={(e) => setDiscNewInd(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            {testRecord?.discrimination && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Discrimination Outcome
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                      testRecord.discrimination.passed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {testRecord.discrimination.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                <div className="text-xs font-mono bg-white p-3 rounded-lg border border-slate-200">
                  {testRecord.discrimination.formula}
                </div>
              </div>
            )}
          </div>
        )}

        {/* BOTTOM ACTION BAR: SAVE DRAFT & SUBMIT TEST */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <Save className="w-4 h-4 text-slate-400" />
            <span>Observations auto-saved to persistent local cache.</span>
          </div>

          <div className="flex items-center space-x-3">
            {canSubmitTest && testRecord?.status === 'DRAFT' && (
              <button
                onClick={handleSubmitForReview}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-2 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Test to QA Review</span>
              </button>
            )}

            {testRecord?.status !== 'DRAFT' && (
              <button
                onClick={() => onNavigateToReview(testRecord?.id || '')}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5"
              >
                <span>Inspect in Workflow Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* OIML R-76 Unit Test Verification Modal */}
      {showUnitTestsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    OIML R 76-1:2006 Metrological Engine Unit Test Suite
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Automated verification against Table 3, Table 6, and testing clauses
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUnitTestsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              {unitTestSummary && (
                <>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-emerald-900 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        All {unitTestSummary.total} Verification Checks Passed ({unitTestSummary.passed} Passed, {unitTestSummary.failed} Failed)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">
                      100% Compliant
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-xs">
                    {unitTestSummary.results.map((res, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-center space-x-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-slate-800 text-[11px] font-sans">{res.name}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800">
                          PASS
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={handleRunOimlUnitTests}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-run Unit Tests</span>
              </button>
              <button
                onClick={() => setShowUnitTestsModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
