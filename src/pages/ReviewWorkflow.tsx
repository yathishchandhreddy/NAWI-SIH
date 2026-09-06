import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { TestRecord, TestStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { generateReportIntegrityHash } from '../services/crypto';
import { formatValue } from '../rules/oimlR76';
import {
  UserCheck,
  Award,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  Send,
  MessageSquare,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  Scale,
  Sparkles,
} from 'lucide-react';

interface ReviewWorkflowProps {
  selectedTestId?: string | null;
  onNavigateToReport: (reportId: string) => void;
  onNavigateToTest: (testId: string) => void;
}

export const ReviewWorkflow: React.FC<ReviewWorkflowProps> = ({
  selectedTestId,
  onNavigateToReport,
  onNavigateToTest,
}) => {
  const { currentUser, canReviewTest, canApproveTest, canFinalizeReport } = useAuth();
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<TestRecord | null>(null);

  // Comments / Notes input state
  const [commentText, setCommentText] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTests();
  }, [selectedTestId]);

  const loadTests = () => {
    const all = storage.getTests();
    setTests(all);

    if (selectedTestId) {
      const match = all.find((t) => t.id === selectedTestId || t.testId === selectedTestId);
      if (match) {
        setSelectedRecord(match);
        return;
      }
    }

    // Default to first pending review or approval if any, else first
    const pending = all.find(
      (t) => t.status === 'SUBMITTED' || t.status === 'UNDER_REVIEW' || t.status === 'APPROVED'
    );
    setSelectedRecord(pending || all[0] || null);
  };

  // --- REVIEWER ACTION: APPROVE REVIEW ---
  const handleReviewerApprove = () => {
    if (!selectedRecord) return;
    if (!canReviewTest) {
      setActionError('Access Denied: Only users with Reviewer role can perform QA reviews.');
      return;
    }

    const now = new Date().toISOString();
    const updated: TestRecord = {
      ...selectedRecord,
      status: 'APPROVED',
      reviewerId: currentUser.id,
      reviewerName: currentUser.name,
      reviewerNotes: commentText.trim() || 'All observations and calculations verified against OIML R-76 MPE tables.',
      reviewedAt: now,
      updatedAt: now,
    };

    storage.saveTest(updated, currentUser);
    storage.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'TEST_REVIEWED',
      recordId: updated.testId,
      details: `QA Reviewer ${currentUser.name} reviewed & approved calculations. Moved to APPROVER queue.`,
    });

    setSelectedRecord(updated);
    loadTests();
    setCommentText('');
    setActionError(null);
    setActionSuccess(`Test ${updated.testId} approved by QA Reviewer. Now awaiting Director Approval.`);
  };

  // --- REVIEWER/APPROVER ACTION: REQUEST CORRECTION ---
  const handleRequestCorrection = () => {
    if (!selectedRecord) return;
    if (!commentText.trim()) {
      setActionError('A specific correction comment is mandatory when rejecting or requesting corrections.');
      return;
    }

    const now = new Date().toISOString();
    const updated: TestRecord = {
      ...selectedRecord,
      status: 'CORRECTION_REQUIRED',
      reviewerNotes: `Correction required: ${commentText.trim()}`,
      updatedAt: now,
    };

    storage.saveTest(updated, currentUser);
    storage.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'CORRECTION_REQUESTED',
      recordId: updated.testId,
      details: `${currentUser.role.toUpperCase()} requested correction: "${commentText.trim()}"`,
    });

    setSelectedRecord(updated);
    loadTests();
    setCommentText('');
    setActionError(null);
    setActionSuccess(`Correction request dispatched to Tester. Status set to CORRECTION_REQUIRED.`);
  };

  // --- APPROVER ACTION: FINALIZE REPORT ---
  const handleFinalizeReport = async () => {
    if (!selectedRecord) return;
    if (!canFinalizeReport) {
      setActionError('Access Denied: Only authorized Approving Authority can finalize certificates.');
      return;
    }
    if (selectedRecord.status !== 'APPROVED') {
      setActionError('Cannot finalize: Only test records in APPROVED state can be finalized.');
      return;
    }

    const now = new Date().toISOString();
    const reportId = `OIML-R76-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationToken = `VRF-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-2026`;

    const draftFinal: TestRecord = {
      ...selectedRecord,
      status: 'FINALIZED',
      approverId: currentUser.id,
      approverName: currentUser.name,
      approverNotes: commentText.trim() || 'Conforms to Legal Metrology standards and OIML R-76. Final certificate approved.',
      approvedAt: now,
      finalizedAt: now,
      finalizedBy: currentUser.name,
      reportId,
      verificationToken,
      updatedAt: now,
    };

    // Calculate real SHA-256 hash
    let shaHash = '';
    try {
      shaHash = await generateReportIntegrityHash(draftFinal);
      draftFinal.sha256Hash = shaHash;
    } catch (err: any) {
      console.error('Error generating SHA-256 hash:', err);
      setActionError(`Failed to generate cryptographic hash: ${err?.message || 'Crypto error'}`);
      return;
    }

    storage.saveTest(draftFinal, currentUser);
    storage.addAuditLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'REPORT_FINALIZED',
      recordId: reportId,
      details: `Director ${currentUser.name} finalized OIML R-76 Certificate with SHA-256 digest [${shaHash.substring(0, 16)}...]`,
    });

    setSelectedRecord(draftFinal);
    loadTests();
    setCommentText('');
    setActionError(null);
    setActionSuccess(`Report ${reportId} officially finalized with QR and cryptographic SHA-256 seal.`);
  };

  const getStatusBadge = (status: TestStatus) => {
    switch (status) {
      case 'FINALIZED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'APPROVED':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'CORRECTION_REQUIRED':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'DRAFT':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>Review & Approval Workflow</span>
          </h2>
          <p className="text-xs text-slate-500">
            Multi-stage verification stage-gate: Tester Submission → QA Reviewer Verification → Director Final Approval
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500">Active Role:</span>
          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase">
            {currentUser.role}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Two Column Layout: Queue on Left, Inspection Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Test Queue */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Verification Queue ({tests.length})
            </h3>
            <span className="text-[11px] text-slate-500">Select to inspect</span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {tests.map((t) => {
              const isSelected = selectedRecord?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedRecord(t);
                    setActionError(null);
                    setActionSuccess(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-slate-900">
                      {t.reportId || t.testId}
                    </span>
                    <span
                      className={`text-[9px] px-2 py-0.2 rounded-full font-bold border ${getStatusBadge(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 truncate font-medium">
                    {t.instrumentSnapshot.manufacturer} {t.instrumentSnapshot.model}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span>Tester: {t.testerName}</span>
                    <span className="font-mono">Class {t.instrumentSnapshot.accuracyClass}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Audit & Action Panel */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs lg:col-span-2 space-y-5">
          {selectedRecord ? (
            <>
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-base text-slate-900">
                      {selectedRecord.reportId || selectedRecord.testId}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadge(
                        selectedRecord.status
                      )}`}
                    >
                      {selectedRecord.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    Instrument: {selectedRecord.instrumentSnapshot.instrumentId} • SN: {selectedRecord.instrumentSnapshot.serialNumber} • Class {selectedRecord.instrumentSnapshot.accuracyClass}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onNavigateToTest(selectedRecord.id)}
                    className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
                  >
                    Open Observation Data
                  </button>
                  {selectedRecord.status === 'FINALIZED' && (
                    <button
                      onClick={() =>
                        onNavigateToReport(
                          selectedRecord.reportId || selectedRecord.testId || selectedRecord.id
                        )
                      }
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>View Official Certificate</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Summary of Modules Tested */}
              <div>
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2">
                  Completed OIML R-76 Test Modules
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Weighing Performance */}
                  {selectedRecord.weighingPerformance && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800">Weighing Performance</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                            selectedRecord.weighingPerformance.passed
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {selectedRecord.weighingPerformance.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {selectedRecord.weighingPerformance.points.length} load points evaluated against Table 6 MPE bands. Max error: {formatValue(selectedRecord.weighingPerformance.maxError, 4)} {selectedRecord.instrumentSnapshot.capacityUnit}.
                      </div>
                    </div>
                  )}

                  {/* Repeatability */}
                  {selectedRecord.repeatability && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800">Repeatability</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                            selectedRecord.repeatability.passed
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {selectedRecord.repeatability.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Spread: {formatValue(selectedRecord.repeatability.rangeSpread, 4)} ≤ Allowed {formatValue(selectedRecord.repeatability.allowedRangeSpread, 4)} {selectedRecord.instrumentSnapshot.capacityUnit}.
                      </div>
                    </div>
                  )}

                  {/* Eccentricity */}
                  {selectedRecord.eccentricity && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800">Eccentricity (Corner Load)</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                            selectedRecord.eccentricity.passed
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {selectedRecord.eccentricity.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Max corner deviation: {formatValue(selectedRecord.eccentricity.maxDeviation, 4)} ≤ Allowed {formatValue(selectedRecord.eccentricity.allowedLimit, 4)}.
                      </div>
                    </div>
                  )}

                  {/* Zero / Tare */}
                  {selectedRecord.zeroTare && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800">Zero & Tare Device</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                            selectedRecord.zeroTare.overallPassed
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}
                        >
                          {selectedRecord.zeroTare.overallPassed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Zero error: {formatValue(selectedRecord.zeroTare.zeroSettingError, 4)} (≤0.25e) • Tare & Return within limits.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reviewer / Approver Trail Notes */}
              {(selectedRecord.reviewerNotes || selectedRecord.approverNotes) && (
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 text-xs space-y-2">
                  <div className="font-bold text-blue-900 flex items-center space-x-1.5">
                    <MessageSquare className="w-4 h-4 text-blue-700" />
                    <span>Audit Notes & Authority Remarks</span>
                  </div>
                  {selectedRecord.reviewerNotes && (
                    <div>
                      <strong className="text-slate-800">QA Reviewer ({selectedRecord.reviewerName || 'Dr. Sunita Rao'}):</strong>{' '}
                      <span className="text-slate-700">{selectedRecord.reviewerNotes}</span>
                    </div>
                  )}
                  {selectedRecord.approverNotes && (
                    <div>
                      <strong className="text-slate-800">Director ({selectedRecord.approverName || 'Sh. Rajesh Sharma'}):</strong>{' '}
                      <span className="text-slate-700">{selectedRecord.approverNotes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ACTION AREA (ROLE GATED) */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Workflow Authorization Actions
                </div>

                {/* Comment / Remarks input */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Quality Audit Remarks / Correction Instructions:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter observation audit findings, correction requirements, or legal approval remarks..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {/* Rejection / Request Correction */}
                  <button
                    onClick={handleRequestCorrection}
                    disabled={selectedRecord.status === 'FINALIZED'}
                    className="px-3.5 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Request Correction
                  </button>

                  <div className="flex items-center space-x-2">
                    {/* Stage 1: Reviewer Approval (Moves to APPROVED) */}
                    {(selectedRecord.status === 'SUBMITTED' || selectedRecord.status === 'UNDER_REVIEW') && (
                      canReviewTest ? (
                        <button
                          onClick={handleReviewerApprove}
                          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>Approve Review (Quality QA Sign-off)</span>
                        </button>
                      ) : (
                        <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                          Awaiting QA Reviewer sign-off
                        </div>
                      )
                    )}

                    {/* Stage 2: Approver Finalization (Moves to FINALIZED) */}
                    {selectedRecord.status === 'APPROVED' && (
                      canFinalizeReport ? (
                        <button
                          onClick={handleFinalizeReport}
                          className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-2 transition-colors"
                        >
                          <Award className="w-4 h-4" />
                          <span>Finalize Report & Issue Digital Certificate</span>
                        </button>
                      ) : (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 font-medium">
                          <span>Awaiting Approving Authority (Director) signature</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              Select a test record from the queue to review and approve.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
