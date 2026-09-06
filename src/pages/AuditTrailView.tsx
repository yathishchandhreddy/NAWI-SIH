import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { AuditLog, Role } from '../types';
import {
  History,
  Search,
  Filter,
  Download,
  Shield,
  UserCheck,
  CheckCircle,
  FileCheck,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    setLogs(storage.getAuditLogs());
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesQuery =
      log.recordId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || log.userRole === roleFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesQuery && matchesRole && matchesAction;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `OIML_R76_Audit_Trail_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'REPORT_FINALIZED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'TEST_APPROVED':
      case 'TEST_REVIEWED':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'TEST_SUBMITTED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'CORRECTION_REQUESTED':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'REPORT_VERIFIED':
        return 'bg-teal-100 text-teal-800 border-teal-300';
      case 'TAMPER_INJECTED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
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
            <History className="w-5 h-5 text-blue-600" />
            <span>Immutable Legal Metrology Audit Trail</span>
          </h2>
          <p className="text-xs text-slate-500">
            Chronological audit log tracking every test creation, observation update, review, authorization, and QR verification event
          </p>
        </div>

        <button
          onClick={handleExportJson}
          className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Audit Log (JSON)</span>
        </button>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Record ID, Officer Name, Action, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
          >
            <option value="all">All Roles</option>
            <option value="tester">Tester</option>
            <option value="reviewer">Reviewer</option>
            <option value="approver">Approver</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
          >
            <option value="all">All Actions</option>
            <option value="TEST_CREATED">Test Created</option>
            <option value="TEST_SUBMITTED">Test Submitted</option>
            <option value="TEST_REVIEWED">Test Reviewed</option>
            <option value="CORRECTION_REQUESTED">Correction Requested</option>
            <option value="REPORT_FINALIZED">Report Finalized</option>
            <option value="REPORT_VERIFIED">Report Verified</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Officer / Actor</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Record ID</th>
                <th className="py-2.5 px-3">Details & Parameters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 font-sans">
                      {log.userName}
                    </td>
                    <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-slate-600">
                      {log.userRole}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-blue-700 font-mono text-[11px]">
                      {log.recordId}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-sans text-[11px] max-w-md">
                      {log.details}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No matching audit records found for current search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
