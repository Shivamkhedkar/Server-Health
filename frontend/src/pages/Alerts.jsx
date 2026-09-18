import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/api';
import {
  AlertTriangle,
  CheckCircle,
  Check,
  Siren,
  ShieldAlert,
  Info,
  BellOff,
  Search,
  Download,
  Zap,
  X,
  Radio,
  Mail,
  Send,
  Activity,
  Terminal,
  RefreshCw,
  CheckCheck
} from 'lucide-react';

const initialMockAlerts = [
  { id: 1, alert_type: 'High CPU Peak', severity: 'CRITICAL', message: 'CPU utilization spiked to 99.3%, exceeding 85.0% threshold', timestamp: new Date(Date.now() - 900000).toISOString(), acknowledged: false },
  { id: 2, alert_type: 'RAM Utilization', severity: 'WARNING', message: 'RAM usage exceeded 78% memory limit', timestamp: new Date(Date.now() - 3600000).toISOString(), acknowledged: true },
  { id: 3, alert_type: 'Storage Warning', severity: 'WARNING', message: 'Root partition usage at 78% capacity', timestamp: new Date(Date.now() - 7200000).toISOString(), acknowledged: true },
  { id: 4, alert_type: 'Prometheus Collector', severity: 'INFO', message: 'Prometheus scrape target successfully registered', timestamp: new Date(Date.now() - 14400000).toISOString(), acknowledged: true },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [simulated, setSimulated] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);
  
  // Form state for test alert trigger
  const [testForm, setTestForm] = useState({
    severity: 'CRITICAL',
    alert_type: 'CPU Threshold Spiked',
    message: 'Manual simulated alert triggered by DevOps administrator.'
  });
  const [triggering, setTriggering] = useState(false);

  const isAdmin = localStorage.getItem('role') === 'admin';

  const fetchAlerts = async () => {
    try {
      const [alertsRes, channelsRes] = await Promise.all([
        api.get('/alerts'),
        api.get('/alerts/channels').catch(() => ({ data: [] }))
      ]);
      setAlerts(alertsRes.data);
      if (channelsRes.data && channelsRes.data.length > 0) {
        setChannels(channelsRes.data);
      }
      setSimulated(false);
    } catch (err) {
      if (err?.response?.status === 401) return;
      setAlerts(initialMockAlerts);
      setChannels([
        { name: 'Telegram Bot', type: 'telegram', status: 'Active (Dev Mode)', details: 'Chat ID: Configured', is_configured: true },
        { name: 'SMTP Email', type: 'email', status: 'Active (Dev Mode)', details: 'Host: smtp.gmail.com:587', is_configured: true },
        { name: 'Prometheus Target', type: 'prometheus', status: 'Active', details: 'Endpoint: /metrics/overview', is_configured: true }
      ]);
      setSimulated(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (id, e) => {
    if (e) e.stopPropagation();
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    if (selectedAlert && selectedAlert.id === id) {
      setSelectedAlert(prev => prev ? { ...prev, acknowledged: true } : null);
    }
    try {
      await api.post(`/alerts/${id}/acknowledge`);
    } catch {
      // Optimistic update
    }
  };

  const handleAcknowledgeAll = async () => {
    setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
    try {
      await api.post('/alerts/acknowledge-all');
    } catch (err) {
      console.error('Failed to acknowledge all alerts', err);
    }
  };

  const handleTriggerTestAlert = async (e) => {
    e.preventDefault();
    setTriggering(true);
    try {
      const res = await api.post('/alerts', testForm);
      setAlerts(prev => [res.data, ...prev]);
      setShowTestModal(false);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to trigger test alert');
    } finally {
      setTriggering(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/alerts/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `incident_alerts_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      // Fallback CSV export in frontend
      let csvContent = "data:text/csv;charset=utf-8,ID,Timestamp,Severity,Alert Event,Incident Message,Acknowledged\n";
      alerts.forEach(a => {
        csvContent += `${a.id},"${a.timestamp}",${a.severity},"${a.alert_type}","${a.message}",${a.acknowledged}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `incident_alerts_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const counts = useMemo(() => ({
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
    WARNING: alerts.filter(a => a.severity === 'WARNING').length,
    INFO: alerts.filter(a => a.severity === 'INFO').length,
    UNACK: alerts.filter(a => !a.acknowledged).length,
  }), [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const matchesFilter = filter === 'ALL' || a.severity === filter;
      const matchesQuery = searchQuery === '' || 
        a.alert_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.message.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [alerts, filter, searchQuery]);

  const summaryCards = [
    { key: 'UNACK', label: 'Unacknowledged', value: counts.UNACK, icon: BellOff, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/10' },
    { key: 'CRITICAL', label: 'Critical', value: counts.CRITICAL, icon: Siren, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
    { key: 'WARNING', label: 'Warning', value: counts.WARNING, icon: ShieldAlert, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { key: 'INFO', label: 'Info', value: counts.INFO, icon: Info, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-3">
            <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-500 animate-pulse" />
            <span>Incident Alert Center</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Real-time system automated alerts and incident handling</p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowTestModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-extrabold text-xs shadow-md flex items-center space-x-1.5 transition transform hover:scale-[1.02]"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Trigger Test Alert</span>
            </button>
          )}

          {isAdmin && counts.UNACK > 0 && (
            <button
              onClick={handleAcknowledgeAll}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md flex items-center space-x-1.5 transition"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Acknowledge All</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-extrabold text-xs shadow-sm flex items-center space-x-1.5 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {simulated && (
        <div className="text-xs font-semibold text-[#ff5470] telemetry-panel rounded-xl px-4 py-2 flex items-center justify-between">
          <span>Backend unreachable - showing simulated alerts. Verify FastAPI server on port 8000.</span>
          <button onClick={fetchAlerts} className="underline text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white flex items-center space-x-1">
            <RefreshCw className="w-3.5 h-3.5 inline" /> <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Notification Dispatch Channels Bar */}
      {channels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {channels.map((ch, idx) => (
            <div key={idx} className="glass-panel p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${ch.type === 'telegram' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : ch.type === 'email' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                  {ch.type === 'telegram' ? <Send className="w-4 h-4" /> : ch.type === 'email' ? <Mail className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{ch.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{ch.details}</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping"></span>
                <span>{ch.status}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <button
            key={card.key}
            onClick={() => setFilter(card.key === 'UNACK' ? 'ALL' : card.key)}
            className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-left hover:border-slate-300 dark:hover:border-slate-700 transition transform hover:-translate-y-0.5"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-4.5 h-4.5 ${card.color}`} />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{card.value}</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-0.5">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search incident messages or event types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center space-x-2 bg-white dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm w-full md:w-auto justify-center">
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

      {/* Alerts Table Card */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">Incident Feed ({filteredAlerts.length})</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Click any row to open Root Cause Analysis</span>
        </div>

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
                <tr
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className="hover:bg-slate-100/60 dark:hover:bg-slate-900/60 cursor-pointer transition"
                >
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
                  <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {new Date(alert.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {alert.acknowledged ? (
                      <span className="inline-flex items-center space-x-1 text-xs text-emerald-700 dark:text-emerald-400 font-extrabold">
                        <CheckCircle className="w-4 h-4" />
                        <span>Resolved</span>
                      </span>
                    ) : isAdmin ? (
                      <button
                        onClick={(e) => handleAcknowledge(alert.id, e)}
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
                    No matching alerts found for your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🔍 Root Cause Analysis Modal / Drawer */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-700 p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-2xl ${selectedAlert.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                  <Siren className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                      {selectedAlert.severity}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">INCIDENT #{selectedAlert.id}</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{selectedAlert.alert_type}</h2>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Incident Summary */}
            <div className="bg-slate-100/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Incident Description</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedAlert.message}</p>
              <p className="text-xs font-mono text-slate-500 pt-1">
                Timestamp: {new Date(selectedAlert.timestamp).toLocaleString()}
              </p>
            </div>

            {/* Process Diagnostics (Keep dark terminal styling for terminal output) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Host Diagnostics Snapshot at Spike</span>
                </p>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Sample Rate: 1.0s</span>
              </div>
              <div className="bg-slate-900 dark:bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-slate-200 space-y-2 shadow-inner">
                <div className="flex justify-between border-b border-slate-800/80 pb-1 text-[11px] font-bold text-slate-400">
                  <span>PROCESS NAME</span>
                  <span>PID</span>
                  <span>CPU %</span>
                  <span>MEMORY</span>
                </div>
                <div className="flex justify-between text-rose-400 font-bold">
                  <span>python.exe (FastAPI Worker)</span>
                  <span>27772</span>
                  <span>64.2%</span>
                  <span>142 MB</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>node.exe (Vite Dev Engine)</span>
                  <span>19636</span>
                  <span>12.1%</span>
                  <span>111 MB</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>msedge.exe (Browser Renderer)</span>
                  <span>34020</span>
                  <span>8.5%</span>
                  <span>320 MB</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>System Idle Process</span>
                  <span>0</span>
                  <span>15.2%</span>
                  <span>0 MB</span>
                </div>
              </div>
            </div>

            {/* Audit Trail Timeline */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Incident Audit Trail</p>
              <div className="bg-slate-100/60 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="font-bold">1. Incident Triggered:</span>
                  <span className="text-slate-600 dark:text-slate-400">Metrics threshold rule violated</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span className="font-bold">2. Alerts Dispatched:</span>
                  <span className="text-slate-600 dark:text-slate-400">Sent via Telegram Bot & Dashboard Stream</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-300">
                  <span className={`w-2 h-2 rounded-full ${selectedAlert.acknowledged ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                  <span className="font-bold">3. Incident Status:</span>
                  <span className={selectedAlert.acknowledged ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-amber-600 dark:text-amber-400 font-extrabold'}>
                    {selectedAlert.acknowledged ? 'Resolved / Acknowledged' : 'Active Unacknowledged'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
              {!selectedAlert.acknowledged && isAdmin ? (
                <button
                  onClick={() => handleAcknowledge(selectedAlert.id)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-lg flex items-center space-x-2 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Acknowledge Incident</span>
                </button>
              ) : (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4" /> <span>Incident Resolved</span>
                </span>
              )}

              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-extrabold text-xs transition"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ Trigger Test Alert Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-700 p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-500 fill-current" />
                <span>Trigger Test Incident Alert</span>
              </h2>
              <button onClick={() => setShowTestModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTriggerTestAlert} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Severity Level</label>
                <select
                  value={testForm.severity}
                  onChange={(e) => setTestForm({ ...testForm, severity: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="CRITICAL">CRITICAL (Red Alert)</option>
                  <option value="WARNING">WARNING (Yellow Alert)</option>
                  <option value="INFO">INFO (Blue Notice)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Alert Event Title</label>
                <input
                  type="text"
                  value={testForm.alert_type}
                  onChange={(e) => setTestForm({ ...testForm, alert_type: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">Incident Message</label>
                <textarea
                  value={testForm.message}
                  onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={triggering}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-xs shadow-lg hover:brightness-110 transition"
                >
                  {triggering ? 'Triggering...' : 'Dispatch Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
