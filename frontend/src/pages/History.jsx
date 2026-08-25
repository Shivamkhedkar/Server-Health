import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/api';
import TrendChart from '../components/TrendChart';
import { History as HistoryIcon, Download, Calendar, ChevronLeft, ChevronRight, WifiOff } from 'lucide-react';

const RANGE_OPTIONS = [
  { label: 'Last 1 Hour', hours: 1 },
  { label: 'Last 6 Hours', hours: 6 },
  { label: 'Last 24 Hours', hours: 24 },
  { label: 'Last 7 Days', hours: 168 },
];

const ROWS_PER_PAGE = 15;

export default function History() {
  const [hours, setHours] = useState(24);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulated, setSimulated] = useState(false);
  const [page, setPage] = useState(1);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/metrics/history?hours=${hours}`);
      setHistoryData(res.data);
      setSimulated(false);
    } catch (err) {
      // 401s are handled globally (token cleared + redirect to /login by
      // the axios interceptor) - don't mask that with fake history data.
      if (err?.response?.status === 401) {
        return;
      }
      // Backend unreachable entirely (not just "no data yet") - show a
      // clearly-labelled simulated preview rather than a blank page.
      const now = Date.now();
      const dummy = Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(now - (20 - i) * ((hours * 3600000) / 20)).toISOString(),
        cpu_usage: +(20 + Math.random() * 40).toFixed(1),
        ram_usage: +(40 + Math.random() * 30).toFixed(1),
        disk_usage: 62.4,
        network_sent_mb: 15.2,
        network_recv_mb: 48.6
      }));
      setHistoryData(dummy);
      setSimulated(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchHistory();
    // Keep the history view reasonably fresh without hammering the API.
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  const exportToCSV = () => {
    const headers = ['Timestamp,CPU (%),RAM (%),Disk (%),Network Sent (MB),Network Recv (MB)\n'];
    const rows = historyData.map(d =>
      `${d.timestamp},${d.cpu_usage},${d.ram_usage},${d.disk_usage},${d.network_sent_mb},${d.network_recv_mb}`
    );
    const blob = new Blob([headers.concat(rows.join('\n'))], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devops_metrics_history_${hours}h.csv`;
    a.click();
  };

  const reversed = useMemo(() => historyData.slice().reverse(), [historyData]);
  const totalPages = Math.max(1, Math.ceil(reversed.length / ROWS_PER_PAGE));
  const pageRows = reversed.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const hasEnoughData = historyData.length >= 2;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-3">
            <HistoryIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            <span>Metrics Telemetry History</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Audit historical resource metrics and export logs</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 ml-2" />
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="bg-transparent text-slate-900 dark:text-slate-200 text-xs font-bold pr-3 py-1 focus:outline-none"
            >
              {RANGE_OPTIONS.map(opt => (
                <option key={opt.hours} value={opt.hours}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={exportToCSV}
            disabled={!historyData.length}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 hover:opacity-95 transition flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {simulated && (
        <div className="text-xs font-semibold text-[#ff5470] telemetry-panel rounded-xl px-4 py-2 flex items-center space-x-2">
          <WifiOff className="w-4 h-4" />
          <span>Backend unreachable - showing simulated numbers, not real history. Check that the API is running.</span>
        </div>
      )}

      {!loading && !simulated && !hasEnoughData && (
        <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 telemetry-panel rounded-xl px-4 py-3">
          Not enough real samples yet for this window. The collector persists a snapshot every ~5 seconds, so charts
          fill in automatically as data accumulates - try a shorter range or check back shortly.
        </div>
      )}

      {/* Per-metric trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider mb-4">CPU Usage</h2>
          <TrendChart
            dataPoints={historyData}
            rangeHours={hours}
            series={[{ key: 'cpu_usage', label: 'CPU', color: '#38d0e0', unit: '%' }]}
          />
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider mb-4">RAM Usage</h2>
          <TrendChart
            dataPoints={historyData}
            rangeHours={hours}
            series={[{ key: 'ram_usage', label: 'RAM', color: '#2bd97c', unit: '%' }]}
          />
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider mb-4">Disk Usage</h2>
          <TrendChart
            dataPoints={historyData}
            rangeHours={hours}
            series={[{ key: 'disk_usage', label: 'Disk', color: '#f5a623', unit: '%' }]}
          />
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider mb-4">Network I/O</h2>
          <TrendChart
            dataPoints={historyData}
            rangeHours={hours}
            yMax={undefined}
            series={[
              { key: 'network_recv_mb', label: 'Received', color: '#818cf8', unit: 'MB' },
              { key: 'network_sent_mb', label: 'Sent', color: '#f472b6', unit: 'MB' },
            ]}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">Detailed Telemetry Log</h3>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold">{historyData.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900/80 text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">CPU Usage</th>
                <th className="px-6 py-3">RAM Usage</th>
                <th className="px-6 py-3">Disk Usage</th>
                <th className="px-6 py-3">Network I/O</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono text-xs font-medium">
              {pageRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-100/60 dark:hover:bg-slate-900/40 transition">
                  <td className="px-6 py-3 text-slate-700 dark:text-slate-400">{new Date(row.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-3 font-bold text-blue-600 dark:text-blue-400">{row.cpu_usage}%</td>
                  <td className="px-6 py-3 font-bold text-purple-600 dark:text-purple-400">{row.ram_usage}%</td>
                  <td className="px-6 py-3 font-bold text-emerald-600 dark:text-emerald-400">{row.disk_usage}%</td>
                  <td className="px-6 py-3 font-bold text-amber-600 dark:text-amber-400">{row.network_recv_mb} MB in / {row.network_sent_mb} MB out</td>
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 font-sans">
                    No records for this window yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
