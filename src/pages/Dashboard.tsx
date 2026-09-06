import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { MetrologyStats, TestRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Scale,
  FileCheck2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ArrowRight,
  TrendingUp,
  FileText,
  Activity,
  Layers,
  Award,
} from 'lucide-react';

interface DashboardProps {
  onNavigate?: (tab: string, recordId?: string) => void;
  onNavigateToExecution?: (testId: string) => void;
  onNavigateToReview?: (testId: string) => void;
  onNavigateToReport?: (reportId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onNavigateToExecution,
  onNavigateToReview,
  onNavigateToReport,
}) => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<MetrologyStats>(storage.getStats());
  const [recentTests, setRecentTests] = useState<TestRecord[]>(storage.getTests());

  const handleNav = (tab: string, recordId?: string) => {
    if (tab === 'testing' && recordId && onNavigateToExecution) {
      onNavigateToExecution(recordId);
      return;
    }
    if (tab === 'review' && recordId && onNavigateToReview) {
      onNavigateToReview(recordId);
      return;
    }
    if (tab === 'reports' && recordId && onNavigateToReport) {
      onNavigateToReport(recordId);
      return;
    }
    if (onNavigate) {
      onNavigate(tab, recordId);
    }
  };

  useEffect(() => {
    // Refresh stats from real storage
    setStats(storage.getStats());
    setRecentTests(storage.getTests());
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FINALIZED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'APPROVED':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'UNDER_REVIEW':
        return 'bg-amber-100 text-amber-800 border-amber-300';
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
      {/* Top Banner / SIH Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center space-x-2 text-xs text-blue-300 uppercase font-bold tracking-wider mb-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Smart India Hackathon 2026 • Problem Statement SIH26035</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Non-Automatic Weighing Instruments (NAWI) Metrology Verification
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Full traceable software engine conforming to <strong className="text-white">OIML Recommendation R-76 (2006)</strong>.
            Executes real-time MPE tolerance calculations, dynamic test plans, cryptographic SHA-256 seal generation,
            and tamper-evident QR code report verification for legal metrology authorities.
          </p>

          <div className="flex flex-wrap gap-3 mt-4 pt-2">
            <button
              onClick={() => handleNav('instruments')}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-sm"
            >
              <Scale className="w-4 h-4" />
              <span>Register NAWI Instrument</span>
            </button>
            <button
              onClick={() => handleNav('testing')}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Execute R-76 Tests</span>
            </button>
            <button
              onClick={() => handleNav('verify')}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Verify Finalized Report QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Analytics KPI Grid (Computed from actual storage) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Instruments */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Registered NAWIs</span>
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalInstruments}</div>
          <div className="text-[11px] text-slate-500 mt-1">Class I, II, III & IV</div>
        </div>

        {/* Total Tests */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Total Test Records</span>
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalTests}</div>
          <div className="text-[11px] text-slate-500 mt-1">All lifecycle states</div>
        </div>

        {/* In Review / Pending */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Under Review / Pending</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {stats.submittedTests + stats.underReviewTests}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {stats.submittedTests} submitted • {stats.underReviewTests} reviewing
          </div>
        </div>

        {/* Finalized Reports */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Finalized Certificates</span>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.finalizedReports}</div>
          <div className="text-[11px] text-slate-500 mt-1">With QR & SHA-256</div>
        </div>

        {/* Compliance Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>R-76 Compliance Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.compliancePercentage}%</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {stats.passedTests} passed • {stats.failedTests} non-compliant
          </div>
        </div>
      </div>

      {/* Two Column Grid: State Machine Flow & Recent Records */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Traceable State Machine Pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs lg:col-span-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>R-76 Verification Pipeline</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                LIVE RBAC
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-4">
              Stage-gate state machine enforcing roles, observations validation, approval, and cryptographic finalization:
            </p>

            <div className="space-y-3 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              <div className="relative">
                <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                <div className="text-xs font-bold text-slate-900">1. Draft & Observations</div>
                <div className="text-[11px] text-slate-500">
                  Tester records load points, calculates MPE tolerances, saves offline draft.
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white" />
                <div className="text-xs font-bold text-slate-900">2. Submission & QA Review</div>
                <div className="text-[11px] text-slate-500">
                  Reviewer examines errors vs OIML R-76 Table 6, approves or requests correction.
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-purple-600 ring-4 ring-white" />
                <div className="text-xs font-bold text-slate-900">3. Director Approval</div>
                <div className="text-[11px] text-slate-500">
                  Legal metrology approving authority sanctions certificate issuance.
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-white" />
                <div className="text-xs font-bold text-slate-900">4. Finalization & Digital Seal</div>
                <div className="text-[11px] text-slate-500">
                  Generates tamper-evident SHA-256 digest, prints PDF, and assigns verifiable QR.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Your current role:</span>
              <span className="font-bold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {currentUser.role}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Metrology Test Records */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Recent Metrology Test Records</h3>
              <p className="text-xs text-slate-500">Persistent live database records</p>
            </div>
            <button
              onClick={() => handleNav('testing')}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center space-x-1"
            >
              <span>View All Tests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTests.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No test records found. Click "Execute R-76 Tests" to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="pb-2">Test ID</th>
                    <th className="pb-2">Instrument</th>
                    <th className="pb-2">Class</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Tester</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTests.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 font-mono font-medium text-slate-900">
                        {t.reportId || t.testId}
                      </td>
                      <td className="py-2.5">
                        <div className="font-medium text-slate-900">
                          {t.instrumentSnapshot.manufacturer} {t.instrumentSnapshot.model}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          SN: {t.instrumentSnapshot.serialNumber}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-bold border border-slate-200">
                          Class {t.instrumentSnapshot.accuracyClass}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                            t.status
                          )}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-600">{t.testerName}</td>
                      <td className="py-2.5 text-right">
                        {t.status === 'FINALIZED' ? (
                          <button
                            onClick={() => handleNav('reports', t.id)}
                            className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-[11px] transition-colors border border-blue-200 inline-flex items-center space-x-1"
                          >
                            <span>View Report</span>
                            <FileCheck2 className="w-3 h-3" />
                          </button>
                        ) : t.status === 'SUBMITTED' || t.status === 'UNDER_REVIEW' ? (
                          <button
                            onClick={() => handleNav('review', t.id)}
                            className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium text-[11px] transition-colors border border-amber-200 inline-flex items-center space-x-1"
                          >
                            <span>Review</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleNav('testing', t.id)}
                            className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-[11px] transition-colors inline-flex items-center space-x-1"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
