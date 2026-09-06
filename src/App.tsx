import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { Instruments } from './pages/Instruments';
import { TestExecution } from './pages/TestExecution';
import { ReviewWorkflow } from './pages/ReviewWorkflow';
import { DigitalReportView } from './pages/DigitalReportView';
import { QrVerificationView } from './pages/QrVerificationView';
import { AuditTrailView } from './pages/AuditTrailView';
import { Instrument } from './types';
import { storage } from './services/storage';

export type NavTab =
  | 'dashboard'
  | 'instruments'
  | 'testing'
  | 'review'
  | 'reports'
  | 'verify'
  | 'audit';

const MainContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);

  // Check initial URL parameters for direct QR scan routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('reportId');
    const token = params.get('token');

    if (window.location.pathname === '/verify' || reportId || token) {
      setActiveTab('verify');
      if (reportId) setActiveReportId(reportId);
      if (token) setVerifyToken(token);
    }
  }, []);

  const handleNavigate = (tab: string, recordId?: string) => {
    let target: NavTab = 'dashboard';
    if (tab === 'instruments') target = 'instruments';
    else if (tab === 'testing' || tab === 'test_execution') target = 'testing';
    else if (tab === 'review' || tab === 'review_workflow') target = 'review';
    else if (tab === 'reports') target = 'reports';
    else if (tab === 'verify' || tab === 'qr_verify') target = 'verify';
    else if (tab === 'audit' || tab === 'audit_trail') target = 'audit';
    else target = 'dashboard';

    if (recordId) {
      if (target === 'testing') {
        setActiveTestId(recordId);
        const test = storage.getTestById(recordId);
        if (test) setSelectedInstrument(test.instrumentSnapshot);
      } else if (target === 'review') {
        setActiveTestId(recordId);
      } else if (target === 'reports' || target === 'verify') {
        setActiveReportId(recordId);
      }
    }

    setActiveTab(target);
  };

  const handleStartTest = (instrument: Instrument) => {
    setSelectedInstrument(instrument);
    setActiveTestId(null);
    setActiveTab('testing');
  };

  const handleNavigateToReview = (testId: string) => {
    setActiveTestId(testId);
    setActiveTab('review');
  };

  const handleNavigateToReport = (reportId: string) => {
    setActiveReportId(reportId);
    setActiveTab('reports');
  };

  const handleNavigateToVerify = (reportId: string, token: string) => {
    setActiveReportId(reportId);
    setVerifyToken(token);
    setActiveTab('verify');
  };

  const handleNavigateToTestFromReview = (testId: string) => {
    setActiveTestId(testId);
    const record = storage.getTestById(testId);
    if (record) {
      setSelectedInstrument(record.instrumentSnapshot);
    }
    setActiveTab('testing');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-blue-500 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        currentTab={activeTab}
        onSelectTab={handleNavigate}
        isOfflineMode={isOfflineMode}
        onToggleOffline={() => setIsOfflineMode((prev) => !prev)}
      />

      {/* Main Page Body Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            onNavigate={handleNavigate}
            onNavigateToExecution={(testId) => {
              setActiveTestId(testId);
              const test = storage.getTestById(testId);
              if (test) setSelectedInstrument(test.instrumentSnapshot);
              setActiveTab('testing');
            }}
            onNavigateToReview={(testId) => {
              setActiveTestId(testId);
              setActiveTab('review');
            }}
            onNavigateToReport={(reportId) => {
              setActiveReportId(reportId);
              setActiveTab('reports');
            }}
          />
        )}

        {activeTab === 'instruments' && (
          <Instruments
            onSelectInstrumentForTesting={handleStartTest}
            onStartTest={handleStartTest}
          />
        )}

        {activeTab === 'testing' && (
          <TestExecution
            selectedInstrument={selectedInstrument}
            activeTestId={activeTestId}
            onNavigateToReview={handleNavigateToReview}
            onSelectInstrument={(inst) => setSelectedInstrument(inst)}
          />
        )}

        {activeTab === 'review' && (
          <ReviewWorkflow
            selectedTestId={activeTestId}
            onNavigateToReport={handleNavigateToReport}
            onNavigateToTest={handleNavigateToTestFromReview}
          />
        )}

        {activeTab === 'reports' && (
          <DigitalReportView
            selectedReportId={activeReportId}
            onNavigateToVerify={handleNavigateToVerify}
          />
        )}

        {activeTab === 'verify' && (
          <QrVerificationView
            initialReportId={activeReportId}
            initialToken={verifyToken}
            onNavigateToReport={handleNavigateToReport}
          />
        )}

        {activeTab === 'audit' && <AuditTrailView />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-500 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-700">SIH26035 Prototype:</span>
            <span>NAWI Test Report Generator conforming to OIML R-76</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span>Smart India Hackathon 2026</span>
            <span>•</span>
            <span>Directorate of Legal Metrology, GoI</span>
            <span>•</span>
            <span>Offline-First (IndexedDB / LocalStorage)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
