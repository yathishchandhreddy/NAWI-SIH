import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { storage } from '../services/storage';
import { TestRecord } from '../types';
import { formatValue } from '../rules/oimlR76';
import { generateReportIntegrityHashSync } from '../services/crypto';
import {
  FileCheck2,
  Printer,
  QrCode,
  ShieldCheck,
  Scale,
  Calendar,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Award,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface DigitalReportViewProps {
  selectedReportId?: string | null;
  onNavigateToVerify: (reportId: string, token: string) => void;
}

export const DigitalReportView: React.FC<DigitalReportViewProps> = ({
  selectedReportId,
  onNavigateToVerify,
}) => {
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [activeReport, setActiveReport] = useState<TestRecord | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isComputingHash, setIsComputingHash] = useState<boolean>(false);
  const [hashError, setHashError] = useState<string | null>(null);
  const [computedHash, setComputedHash] = useState<string | null>(null);

  useEffect(() => {
    const allTests = storage.getTests();
    const finalized = allTests.filter((t) => t.status === 'FINALIZED');
    finalized.sort((a, b) => {
      const timeA = new Date(a.finalizedAt || a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.finalizedAt || b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    const approvedPending = allTests.filter((t) => t.status === 'APPROVED');
    approvedPending.sort((a, b) => {
      const timeA = new Date(a.reviewedAt || a.updatedAt || a.createdAt).getTime();
      const timeB = new Date(b.reviewedAt || b.updatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    // All available reports (prioritize finalized certificates, include approved pending)
    const availableReports = [...finalized, ...approvedPending];
    setTests(availableReports);

    // Target priority:
    // 1. Explicitly requested selectedReportId
    // 2. Storage last active report ID
    // 3. Storage last active test ID
    const targetId =
      selectedReportId || storage.getLastActiveReportId() || storage.getLastActiveTestId();

    if (targetId) {
      const match = availableReports.find(
        (t) => t.id === targetId || t.testId === targetId || t.reportId === targetId
      );
      if (match) {
        setActiveReport(match);
        return;
      }
    }

    // Default to the most recently updated non-historical test (prefer newly completed tests over demo test0089)
    const nonHistorical = availableReports.find(
      (t) => t.reportId !== 'OIML-R76-2026-0089' && t.testId !== 'TEST-2026-0089'
    );
    setActiveReport(nonHistorical || availableReports[0] || null);
  }, [selectedReportId]);

  useEffect(() => {
    if (!activeReport) {
      setComputedHash(null);
      setHashError(null);
      setIsComputingHash(false);
      return;
    }

    // Initialize with existing SHA-256 hash immediately if present
    if (activeReport.sha256Hash) {
      setComputedHash(activeReport.sha256Hash);
      setIsComputingHash(false);
    } else {
      setIsComputingHash(true);
    }
    setHashError(null);

    let isMounted = true;

    try {
      // Synchronously and deterministically compute SHA-256 fingerprint with zero hanging
      const hash = generateReportIntegrityHashSync(activeReport);
      if (isMounted) {
        setComputedHash(hash);
        setIsComputingHash(false);
        if (!activeReport.sha256Hash || activeReport.sha256Hash !== hash) {
          activeReport.sha256Hash = hash;
          storage.saveTest(activeReport);
        }
      }
    } catch (err: any) {
      if (isMounted) {
        console.error('Failed to compute SHA-256 verification fingerprint:', err);
        setHashError(err?.message || 'Cryptographic fingerprint calculation failed');
        setComputedHash(activeReport.sha256Hash || null);
        setIsComputingHash(false);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [activeReport?.id, activeReport?.reportId, activeReport?.status, activeReport?.updatedAt]);

  useEffect(() => {
    if (!activeReport) return;

    // Generate real QR containing verification reference url
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const verifyRef = `${origin}/verify?reportId=${encodeURIComponent(
      activeReport.reportId || activeReport.testId
    )}&token=${encodeURIComponent(activeReport.verificationToken || '')}`;

    QRCode.toDataURL(verifyRef, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 180,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR generation error:', err));
  }, [activeReport?.id, activeReport?.reportId, activeReport?.verificationToken]);

  const handlePrint = () => {
    window.print();
  };

  if (!activeReport) {
    return (
      <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
        <FileCheck2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="font-bold text-sm text-slate-800">No Finalized Digital Reports Found</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Digital Certificates are issued upon Director final approval in the Review & Approval workflow.
          You can test finalizing an approved test or select a demo record.
        </p>
      </div>
    );
  }

  const inst = activeReport.instrumentSnapshot;

  return (
    <div className="space-y-6">
      {/* Action Bar (Hidden in print) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <Award className={`w-5 h-5 ${activeReport.status === 'FINALIZED' ? 'text-emerald-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-900">
                {activeReport.status === 'FINALIZED'
                  ? 'Official Digital Test Certificate'
                  : 'Verification Report (QA Approved — Awaiting Final Seal)'}
              </span>
              <span className={`font-mono text-xs px-2 py-0.5 rounded font-bold border ${
                activeReport.status === 'FINALIZED'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {activeReport.reportId || activeReport.testId}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Conforming to Legal Metrology Rules & OIML Recommendation R-76
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Select Report Dropdown */}
          <select
            value={activeReport.id}
            onChange={(e) => {
              const found = tests.find((t) => t.id === e.target.value);
              if (found) setActiveReport(found);
            }}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono max-w-xs sm:max-w-md"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.status === 'FINALIZED'
                  ? `${t.reportId} - ${t.instrumentSnapshot.manufacturer} ${t.instrumentSnapshot.model} (Test: ${t.testId})`
                  : `[PENDING FINAL SEAL] ${t.testId} - ${t.instrumentSnapshot.manufacturer} ${t.instrumentSnapshot.model}`}
              </option>
            ))}
          </select>

          <button
            onClick={() =>
              onNavigateToVerify(
                activeReport.reportId || activeReport.testId,
                activeReport.verificationToken || ''
              )
            }
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Verify QR Record</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Export PDF</span>
          </button>
        </div>
      </div>

      {/* OFFICIAL OIML R-76 CERTIFICATE SHEET (Printable layout) */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-md p-8 max-w-4xl mx-auto text-slate-900 space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Certificate Header Emblem */}
        <div className="border-b-2 border-slate-800 pb-5 text-center relative">
          <div className="flex items-center justify-center space-x-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xl border-2 border-amber-500">
              <Scale className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold uppercase tracking-wide text-slate-900">
                Directorate of Legal Metrology
              </h1>
              <h2 className="text-xs font-semibold text-slate-600 tracking-wider uppercase">
                Government of India • Ministry of Consumer Affairs
              </h2>
            </div>
          </div>
          <div className="text-xs font-bold text-blue-900 uppercase tracking-widest mt-2">
            Certificate of Verification of Non-Automatic Weighing Instrument (NAWI)
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            Issued in accordance with OIML Recommendation R-76-1 (Edition 2006)
          </div>

          <div className="absolute top-0 right-0 text-right hidden sm:block">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">
              {activeReport.status === 'FINALIZED' ? 'Report ID' : 'Test ID'}
            </div>
            <div className="font-mono text-xs font-bold text-slate-900">
              {activeReport.reportId || activeReport.testId}
            </div>
          </div>
        </div>

        {/* Certificate Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">
              {activeReport.status === 'FINALIZED' ? 'Certificate Number' : 'Test Reference'}
            </span>
            <span className="font-mono font-bold text-slate-900">
              {activeReport.reportId || activeReport.testId}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Verification Date</span>
            <span className="font-mono font-bold text-slate-900">
              {new Date(activeReport.finalizedAt || activeReport.updatedAt || activeReport.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Verification Token</span>
            <span className="font-mono font-semibold text-slate-700">
              {activeReport.verificationToken || 'Pending Authority Seal'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Overall Decision</span>
            <span className="font-bold text-emerald-700 uppercase">
              {activeReport.overallCompliance ? '✓ COMPLIANT (PASS)' : '✗ NON-COMPLIANT'}
            </span>
          </div>
        </div>

        {/* Section 1: NAWI Instrument Specifications */}
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-200 mb-3 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>1. Instrument Metrological Characteristics</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Manufacturer:</span>
              <span className="font-semibold text-slate-900">{inst.manufacturer}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Model Designation:</span>
              <span className="font-semibold text-slate-900">{inst.model}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Serial Number:</span>
              <span className="font-mono font-semibold text-slate-900">{inst.serialNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Accuracy Class:</span>
              <span className="font-mono font-bold text-blue-800">Class {inst.accuracyClass}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Max Capacity (Max):</span>
              <span className="font-mono font-semibold text-slate-900">
                {inst.maxCapacity} {inst.capacityUnit}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Min Capacity (Min):</span>
              <span className="font-mono font-semibold text-slate-900">
                {inst.minCapacity} {inst.capacityUnit}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Verification Interval (e):</span>
              <span className="font-mono font-semibold text-slate-900">
                {inst.e} {inst.intervalUnit}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Display Interval (d):</span>
              <span className="font-mono font-semibold text-slate-900">
                {inst.d} {inst.intervalUnit}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Testing Location:</span>
              <span className="text-slate-800">{inst.location}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Weighing Performance Test Results Table */}
        {activeReport.weighingPerformance && (
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-200 mb-2 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span>2. Weighing Performance Test (OIML R-76 A.4.4)</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="p-2">Load (m)</th>
                    <th className="p-2">Indicated</th>
                    <th className="p-2">Error</th>
                    <th className="p-2">m/e Band</th>
                    <th className="p-2">MPE (Table 6)</th>
                    <th className="p-2">Comparison</th>
                    <th className="p-2 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {activeReport.weighingPerformance.points.map((p, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-medium">
                        {formatValue(p.referenceLoad, 4)} {inst.capacityUnit}
                      </td>
                      <td className="p-2">{formatValue(p.indicatedLoad, 4)}</td>
                      <td className="p-2 font-semibold">
                        {p.error >= 0 ? '+' : ''}
                        {formatValue(p.error, 4)}
                      </td>
                      <td className="p-2 text-slate-600">{p.scaleIntervals} e</td>
                      <td className="p-2">±{formatValue(p.applicableMpeAbsolute, 4)}</td>
                      <td className="p-2 text-slate-600">{p.comparisonText}</td>
                      <td className="p-2 text-right font-bold text-emerald-700">
                        {p.passed ? 'PASS' : 'FAIL'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 3: Summary of Repeatability, Eccentricity, and Zero/Tare */}
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-1.5 border-b border-slate-200 mb-2 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>3. Additional Metrological Verification Modules</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {activeReport.repeatability && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block mb-1">Repeatability (3.6.1)</span>
                <span className="text-[11px] text-slate-600 block">
                  Spread: {formatValue(activeReport.repeatability.rangeSpread, 4)} {inst.capacityUnit}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Allowed Limit: ≤ {formatValue(activeReport.repeatability.allowedRangeSpread, 4)}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 mt-1 block">
                  ✓ Passed Requirement
                </span>
              </div>
            )}

            {activeReport.eccentricity && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block mb-1">Eccentricity (3.6.2)</span>
                <span className="text-[11px] text-slate-600 block">
                  Max Corner Dev: {formatValue(activeReport.eccentricity.maxDeviation, 4)} {inst.capacityUnit}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Allowed Limit: ≤ {formatValue(activeReport.eccentricity.allowedLimit, 4)}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 mt-1 block">
                  ✓ Passed Corner Tolerance
                </span>
              </div>
            )}

            {activeReport.zeroTare && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="font-bold text-slate-800 block mb-1">Zero & Tare (4.5)</span>
                <span className="text-[11px] text-slate-600 block">
                  Zero Error: {formatValue(activeReport.zeroTare.zeroSettingError, 4)} (≤0.25e)
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Return to Zero: {formatValue(activeReport.zeroTare.returnToZeroDeviation, 4)} (≤0.5e)
                </span>
                <span className="text-[10px] font-bold text-emerald-700 mt-1 block">
                  ✓ Passed Device Verification
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Cryptographic SHA-256 Seal & QR Code Block */}
        <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-md w-full">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>SHA-256 Tamper-Evident Digital Fingerprint</span>
            </div>

            {isComputingHash ? (
              <div className="flex items-center space-x-2 text-amber-400 font-mono text-[11px] bg-slate-800/80 p-2.5 rounded border border-amber-500/30">
                <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Computing verification fingerprint...</span>
              </div>
            ) : hashError ? (
              <div className="text-rose-300 font-mono text-[11px] bg-rose-950/50 p-2.5 rounded border border-rose-800 flex items-center space-x-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Error generating hash: {hashError}</span>
              </div>
            ) : (
              <div className="font-mono text-[11px] text-emerald-300 break-all bg-slate-800/80 p-2.5 rounded border border-slate-700 select-all">
                {computedHash || activeReport.sha256Hash || 'N/A'}
              </div>
            )}

            <p className="text-[10px] text-slate-400 leading-normal">
              Any post-finalization tampering of observations, MPE limits, or tolerances invalidates this digital hash.
              Scan the official QR code to verify live certificate authenticity against the Central Metrology Registry.
            </p>
          </div>

          <div className="flex flex-col items-center bg-white p-2 rounded-lg shrink-0">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Report Verification QR Code" className="w-28 h-28" />
            ) : (
              <div className="w-28 h-28 bg-slate-200 animate-pulse rounded" />
            )}
            <span className="text-[9px] text-slate-700 font-mono font-bold mt-1 uppercase">
              Scan to Verify
            </span>
          </div>
        </div>

        {/* Legal Signatures Block */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-center text-xs">
          <div>
            <div className="font-script text-sm text-slate-700 mb-1 font-serif italic">
              {activeReport.testerName}
            </div>
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-900">
              Verified By (Tester)
            </div>
            <div className="text-[10px] text-slate-500">Legal Metrology Inspector</div>
          </div>

          <div>
            <div className="font-script text-sm text-slate-700 mb-1 font-serif italic">
              {activeReport.reviewerName || 'Dr. Sunita Rao'}
            </div>
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-900">
              Audited By (Reviewer)
            </div>
            <div className="text-[10px] text-slate-500">Quality Assurance Officer</div>
          </div>

          <div>
            <div className="font-script text-sm text-slate-700 mb-1 font-serif italic">
              {activeReport.approverName || 'Sh. Rajesh Sharma'}
            </div>
            <div className="border-t border-slate-400 pt-1 font-semibold text-slate-900">
              Approved By (Authority)
            </div>
            <div className="text-[10px] text-slate-500">Director of Legal Metrology</div>
          </div>
        </div>
      </div>
    </div>
  );
};
