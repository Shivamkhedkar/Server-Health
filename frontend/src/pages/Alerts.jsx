import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/api';
import { AlertTriangle, CheckCircle, Check, Siren, ShieldAlert, Info, BellOff } from 'lucide-react';

const initialMockAlerts = [
  { id: 1, alert_type: 'High CPU Peak', severity: 'CRITICAL', message: 'CPU utilization spiked to 89.1% during batch backup', timestamp: new Date(Date.now() - 900000).toISOString(), acknowledged: false },
  { id: 2, alert_type: 'RAM Utilization', severity: 'WARNING', message: 'RAM usage exceeded 75% memory threshold', timestamp: new Date(Date.now() - 3600000).toISOString(), acknowledged: true },
  { id: 3, alert_type: 'Storage Warning', severity: 'WARNING', message: 'Partition /var/log reached 78% capacity', timestamp: new Date(Date.now() - 7200000).toISOString(), acknowledged: true },
  { id: 4, alert_type: 'Prometheus Collector', severity: 'INFO', message: 'Prometheus scrape target successfully registered', timestamp: new Date(Date.now() - 14400000).toISOString(), acknowledged: true },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [simulated, setSimulated] = useState(false);
  const isAdmin = localStorage.getItem('role') === 'admin';

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(res.data);
      setSimulated(false);
    } catch (err) {
      // 401s are handled globally (token cleared + redirect to /login by
      // the axios interceptor) - don't mask that with fake alert data.
      if (err?.response?.status === 401) return;
      setAlerts(initialMockAlerts);
      setSimulated(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Auto-refresh so newly triggered alerts (email/telegram-notified)
    // show up here without a manual reload.
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    try {
      await api.post(`/alerts/${id}/acknowledge`);
    } catch {
      // Optimistic update already applied; a background refresh will
      // reconcile if the request actually failed.
    }
  };

  const counts = useMemo(() => ({
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
    WARNING: alerts.filter(a => a.severity === 'WARNING').length,
    INFO: alerts.filter(a => a.severity === 'INFO').length,
    UNACK: alerts.filter(a => !a.acknowledged).length,
  }), [alerts]);

  const filteredAlerts = alerts.filter(a => filter === 'ALL' || a.severity === filter);

  const summaryCards = [
    { key: 'UNACK', label: 'Unacknowledged', value: counts.UNACK, icon: BellOff, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
    { key: 'CRITICAL', label: 'Critical', value: counts.CRITICAL, icon: Siren, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
    { key: 'WARNING', label: 'Warning', value: counts.WARNING, icon: ShieldAlert, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { key: 'INFO', label: 'Info', value: counts.INFO, icon: Info, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-3">
            <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-500" />
            <span>Incident Alert Center</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Real-time system automated alerts and incident handling</p>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                filter === sev
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {simulated && (
        <div className="text-xs font-semibold text-[#ff5470] telemetry-panel rounded-xl px-4 py-2">
          Backend unreachable - showing simulated alerts, not real incidents. Check that the API is running.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <button
            key={card.key}
            onClick={() => setFilter(card.key === 'UNACK' ? 'ALL' : card.key)}
            className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-left hover:border-slate-300 dark:hover:border-slate-700 transition"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-4.5 h-4.5 ${card.color}`} />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{card.value}</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-0.5">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Alerts Table Card */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900/80 text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Severity</th>
                <th className="px-6 py-4">Alert Event</th>
                <th className="px-6 py-4">Incident Message</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium">
              {filteredAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-slate-100/60 dark:hover:bg-slate-900/40 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                          : alert.severity === 'WARNING'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{alert.alert_type}</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300 max-w-md">{alert.message}</td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {new Date(alert.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {alert.acknowledged ? (
                      <span className="inline-flex items-center space-x-1 text-xs text-emerald-700 dark:text-emerald-400 font-extrabold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Resolved</span>
                      </span>
                    ) : isAdmin ? (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-500/30 text-xs font-bold transition flex items-center space-x-1 ml-auto"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Acknowledge</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-xs text-amber-700 dark:text-amber-400 font-extrabold">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Active</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && !filteredAlerts.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                    No {filter !== 'ALL' ? filter.toLowerCase() : ''} alerts right now - system is healthy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
