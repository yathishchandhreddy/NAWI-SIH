import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';
import {
  Scale,
  ShieldCheck,
  UserCheck,
  Award,
  Settings,
  Wifi,
  WifiOff,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOfflineMode: boolean;
  onToggleOffline: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  isOfflineMode,
  onToggleOffline,
}) => {
  const { currentUser, switchUser, users } = useAuth();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'tester':
        return {
          label: 'TESTER',
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: <Scale className="w-3.5 h-3.5" />,
        };
      case 'reviewer':
        return {
          label: 'REVIEWER',
          bg: 'bg-amber-100 text-amber-800 border-amber-300',
          icon: <UserCheck className="w-3.5 h-3.5" />,
        };
      case 'approver':
        return {
          label: 'APPROVER',
          bg: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: <Award className="w-3.5 h-3.5" />,
        };
      case 'admin':
        return {
          label: 'ADMIN',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: <Settings className="w-3.5 h-3.5" />,
        };
    }
  };

  const badge = getRoleBadge(currentUser.role);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand / Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-inner border border-blue-400">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">NAWI Metrology</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                  OIML R-76
                </span>
                <span className="hidden md:inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold uppercase tracking-wider">
                  SIH26035
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Legal Metrology Digital Test Report & Verification System
              </p>
            </div>
          </div>

          {/* Right Controls: Offline Mode Toggle & Role Switcher */}
          <div className="flex items-center space-x-3">
            {/* Offline Simulation Toggle */}
            <button
              onClick={onToggleOffline}
              title={isOfflineMode ? 'Switch to Online Mode' : 'Simulate Offline Mode (Drafting into IndexedDB)'}
              className={`flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-md border font-medium transition-colors ${
                isOfflineMode
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isOfflineMode ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="hidden sm:inline">Offline Draft Mode</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Cloud Sync Online</span>
                </>
              )}
            </button>

            {/* Quick Role Switcher for Live SIH Demo */}
            <div className="relative">
              <button
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="flex items-center space-x-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-1.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="text-left hidden md:block">
                  <div className="text-xs font-semibold text-slate-200">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400">{currentUser.lab.substring(0, 28)}...</div>
                </div>
                <div className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium border ${badge.bg}`}>
                  {badge.icon}
                  <span>{badge.label}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 text-slate-800 animate-in fade-in duration-150">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
                      <span>Switch Active User</span>
                      <span className="text-[10px] text-blue-600 lowercase">SIH Live Demo</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Switch roles to test Tester submission, Reviewer audit, Approver signature.
                    </p>
                  </div>
                  <div className="py-1">
                    {users.map((u) => {
                      const uBadge = getRoleBadge(u.role);
                      const isSelected = u.id === currentUser.id;
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            switchUser(u.id);
                            setRoleDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-blue-50/80 font-medium' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{u.name}</div>
                            <div className="text-[11px] text-slate-500">{u.designation}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${uBadge.bg}`}>
                            {uBadge.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto pb-2 pt-1 border-t border-slate-800 text-xs font-medium scrollbar-none">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'dashboard'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Dashboard & Analytics
          </button>
          <button
            onClick={() => onSelectTab('instruments')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'instruments'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            NAWI Instruments
          </button>
          <button
            onClick={() => onSelectTab('testing')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'testing'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Test Execution & Plan
          </button>
          <button
            onClick={() => onSelectTab('review')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'review'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Review & Approval Workflow
          </button>
          <button
            onClick={() => onSelectTab('reports')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'reports'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Digital Test Reports
          </button>
          <button
            onClick={() => onSelectTab('verify')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'verify'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            QR & SHA-256 Verification
          </button>
          <button
            onClick={() => onSelectTab('audit')}
            className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
              currentTab === 'audit'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Audit Trail
          </button>
        </nav>
      </div>
    </header>
  );
};
