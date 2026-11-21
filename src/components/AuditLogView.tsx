import React, { useMemo, useState } from 'react';
import { AuditLogEntry } from '../data/mockData';
import { formatDDMMYY, getLocalYYYYMMDD } from '../utils/dateUtils';
import { Download, Filter, ShieldAlert, Trash2 } from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
  isAdmin: boolean;
  onClearLogs: () => void;
  searchQuery: string;
}

const MODULES: Array<AuditLogEntry['module'] | 'All'> = [
  'All',
  'Inventory',
  'Sales',
  'Accounts',
  'Buyers',
  'Portal',
  'Transfers',
  'SalesReps',
  'Settings',
  'Users',
];

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  logs,
  isAdmin,
  onClearLogs,
  searchQuery,
}) => {
  const [moduleFilter, setModuleFilter] = useState<string>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((l) => {
      if (moduleFilter !== 'All' && l.module !== moduleFilter) return false;
      if (roleFilter !== 'All' && l.userRole !== roleFilter) return false;
      if (!q) return true;
      return (
        l.userName.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.module.toLowerCase().includes(q)
      );
    });
  }, [logs, moduleFilter, roleFilter, searchQuery]);

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User', 'Role', 'Module', 'Action', 'Target', 'Details'];
    const rows = filteredLogs.map((l) => [
      l.timestamp,
      `"${l.userName.replace(/"/g, '""')}"`,
      l.userRole,
      l.module,
      `"${l.action.replace(/"/g, '""')}"`,
      l.targetId || '',
      `"${l.details.replace(/"/g, '""')}"`,
    ]);
    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.setAttribute('href', encodeURI(csv));
    a.setAttribute('download', `Audit_Log_${getLocalYYYYMMDD()}.csv`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-600" />
            <span>System Activity &amp; Security Audit Trail</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic chronological log of inventory edits, invoices, payment verifications, warehouse transfers, and settings updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m === 'All' ? 'All Modules' : m}
              </option>
            ))}
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            <option value="All">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
            <option value="customer">Customer</option>
          </select>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

          {isAdmin && logs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Logs
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
            Audit Events ({filteredLogs.length})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5 font-bold">Date &amp; Time</th>
                <th className="p-3.5 font-bold">Actor</th>
                <th className="p-3.5 font-bold">Module</th>
                <th className="p-3.5 font-bold">Action</th>
                <th className="p-3.5 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-3.5 font-mono text-slate-500 whitespace-nowrap">
                    {formatDDMMYY(log.timestamp)}{' '}
                    <span className="text-[10px] text-slate-400">
                      {log.timestamp.slice(11, 16)}
                    </span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <div className="font-bold text-slate-900">{log.userName}</div>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-extrabold uppercase">
                      {log.userRole}
                    </span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 text-[10px] font-extrabold">
                      {log.module}
                    </span>
                  </td>
                  <td className="p-3.5 font-extrabold text-slate-800 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="p-3.5 text-slate-600 max-w-md">{log.details}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    No activity audit logs recorded yet.
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
