import React, { useState, useEffect } from 'react';
import api from '../api/api';
import ChangePasswordCard from '../components/ChangePasswordCard';
import {
  Settings as SettingsIcon,
  Save,
  Mail,
  Send,
  Sliders,
  BellRing,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Trash2,
  Database,
  Gauge,
  KeyRound,
  Zap
} from 'lucide-react';

const DEFAULTS = {
  cpu_threshold: 85,
  ram_threshold: 90,
  disk_threshold: 90,
  email_alerts_enabled: false,
  telegram_alerts_enabled: false,
  alert_recipient_email: '',
  telegram_chat_id_override: '',
  metrics_retention_days: 90,
  scrape_interval_seconds: 2,
};

const TABS = [
  { id: 'THRESHOLDS', label: 'Alert Thresholds', icon: Sliders },
  { id: 'NOTIFICATIONS', label: 'Notification Channels', icon: BellRing },
  { id: 'ENGINE', label: 'Engine & Database', icon: Gauge },
  { id: 'SECURITY', label: 'Account Security', icon: KeyRound },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('THRESHOLDS');
  const [form, setForm] = useState(DEFAULTS);
  const [meta, setMeta] = useState({ smtp_configured: false, telegram_configured: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [toast, setToast] = useState(null);
  const [testing, setTesting] = useState(null);

  const isAdmin = localStorage.getItem('role') === 'admin';

  const loadSettings = async () => {
    try {
      const res = await api.get('/settings');
      setForm({
        cpu_threshold: Number(res.data.cpu_threshold),
        ram_threshold: Number(res.data.ram_threshold),
        disk_threshold: Number(res.data.disk_threshold),
        email_alerts_enabled: res.data.email_alerts_enabled === 'true',
        telegram_alerts_enabled: res.data.telegram_alerts_enabled === 'true',
        alert_recipient_email: res.data.alert_recipient_email || '',
        telegram_chat_id_override: res.data.telegram_chat_id_override || '',
        metrics_retention_days: Number(res.data.metrics_retention_days) || 90,
        scrape_interval_seconds: Number(res.data.scrape_interval_seconds) || 2,
      });
      setMeta({ smtp_configured: res.data.smtp_configured, telegram_configured: res.data.telegram_configured });
    } catch {
      // Keep defaults if backend temporarily unreachable
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      showToast('success', 'Settings successfully saved to core configuration!');
    } catch (err) {
      showToast('error', err?.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel) => {
    setTesting(channel);
    try {
      await api.post('/settings/test-notification', { channel });
      showToast('success', `Test ${channel === 'email' ? 'email' : 'Telegram message'} sent successfully!`);
    } catch (err) {
      showToast('error', err?.response?.data?.detail || `Failed to send test ${channel} alert.`);
    } finally {
      setTesting(null);
    }
  };

  const handlePrune = async () => {
    if (!window.confirm('Are you sure you want to prune historical metrics older than retention limit?')) return;
    setPruning(true);
    try {
      const res = await api.post('/settings/prune');
      showToast('success', res.data.message);
    } catch (err) {
      showToast('error', err?.response?.data?.detail || 'Failed to prune database metrics.');
    } finally {
      setPruning(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-3">
            <SettingsIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            <span>Platform Configuration Center</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Manage alert thresholds, dispatch channels, engine performance, and security</p>
        </div>

        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-xs shadow-lg shadow-indigo-500/30 hover:opacity-95 transition flex items-center space-x-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        )}
      </div>

      {toast && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center space-x-2 shadow-lg animate-in fade-in ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          {toast.type === 'success'
            ? <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            : <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {!isAdmin && (
        <div className="p-4 rounded-2xl border text-xs font-bold flex items-center space-x-2 bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-5 h-5" />
          <span>You are signed in as a viewer — settings are read-only. Contact an admin to update rules.</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center space-x-2 ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <fieldset disabled={!isAdmin} className="space-y-6">

        {/* TAB 1: THRESHOLDS */}
        {activeTab === 'THRESHOLDS' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                    <Sliders className="w-5 h-5 text-blue-500" />
                    <span>Resource Trigger Thresholds</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Automated incident creation fires when telemetry exceeds these limits</p>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  REAL-TIME MONITORING ACTIVE
                </span>
              </div>

              <div className="space-y-8">
                {/* CPU Threshold */}
                <div className="space-y-3 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                  <div className="flex justify-between items-center text-xs font-extrabold">
                    <span className="text-slate-900 dark:text-slate-200 flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></span>
                      <span className="text-sm">CPU Spike Trigger</span>
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono text-base font-black px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30">
                      {form.cpu_threshold}%
                    </span>
                  </div>
                  <input
                    type="range" min="50" max="98"
                    value={form.cpu_threshold}
                    onChange={(e) => setForm(f => ({ ...f, cpu_threshold: Number(e.target.value) }))}
                    className="w-full accent-blue-500 bg-slate-200 dark:bg-slate-950 rounded-lg cursor-pointer h-2"
                  />
                  {/* Visual Zone Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-900 h-2.5 rounded-full overflow-hidden flex font-mono text-[9px] font-bold">
                    <div style={{ width: `${form.cpu_threshold - 15}%` }} className="bg-emerald-500 h-full" title="Safe Zone"></div>
                    <div style={{ width: '15%' }} className="bg-amber-500 h-full" title="Warning Zone"></div>
                    <div style={{ width: `${100 - form.cpu_threshold}%` }} className="bg-rose-500 h-full" title="Critical Zone"></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">🟢 Normal (&lt; {form.cpu_threshold - 15}%)</span>
                    <span className="text-amber-600 dark:text-amber-400">🟡 Warning ({form.cpu_threshold - 15}% - {form.cpu_threshold}%)</span>
                    <span className="text-rose-600 dark:text-rose-400 font-black">🔴 Critical Incident (&gt; {form.cpu_threshold}%)</span>
                  </div>
                </div>

                {/* RAM Threshold */}
                <div className="space-y-3 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                  <div className="flex justify-between items-center text-xs font-extrabold">
                    <span className="text-slate-900 dark:text-slate-200 flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500 animate-pulse"></span>
                      <span className="text-sm">RAM Memory Limit Trigger</span>
                    </span>
                    <span className="text-purple-600 dark:text-purple-400 font-mono text-base font-black px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30">
                      {form.ram_threshold}%
                    </span>
                  </div>
                  <input
                    type="range" min="50" max="98"
                    value={form.ram_threshold}
                    onChange={(e) => setForm(f => ({ ...f, ram_threshold: Number(e.target.value) }))}
                    className="w-full accent-purple-500 bg-slate-200 dark:bg-slate-950 rounded-lg cursor-pointer h-2"
                  />
                  {/* Visual Zone Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-900 h-2.5 rounded-full overflow-hidden flex">
                    <div style={{ width: `${form.ram_threshold - 15}%` }} className="bg-emerald-500 h-full"></div>
                    <div style={{ width: '15%' }} className="bg-amber-500 h-full"></div>
                    <div style={{ width: `${100 - form.ram_threshold}%` }} className="bg-rose-500 h-full"></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">🟢 Normal (&lt; {form.ram_threshold - 15}%)</span>
                    <span className="text-amber-600 dark:text-amber-400">🟡 Warning ({form.ram_threshold - 15}% - {form.ram_threshold}%)</span>
                    <span className="text-rose-600 dark:text-rose-400 font-black">🔴 Critical Incident (&gt; {form.ram_threshold}%)</span>
                  </div>
                </div>

                {/* Disk Threshold */}
                <div className="space-y-3 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                  <div className="flex justify-between items-center text-xs font-extrabold">
                    <span className="text-slate-900 dark:text-slate-200 flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
                      <span className="text-sm">Storage Partition Capacity Warning</span>
                    </span>
                    <span className="text-amber-600 dark:text-amber-500 font-mono text-base font-black px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      {form.disk_threshold}%
                    </span>
                  </div>
                  <input
                    type="range" min="50" max="98"
                    value={form.disk_threshold}
                    onChange={(e) => setForm(f => ({ ...f, disk_threshold: Number(e.target.value) }))}
                    className="w-full accent-amber-500 bg-slate-200 dark:bg-slate-950 rounded-lg cursor-pointer h-2"
                  />
                  {/* Visual Zone Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-900 h-2.5 rounded-full overflow-hidden flex">
                    <div style={{ width: `${form.disk_threshold - 10}%` }} className="bg-emerald-500 h-full"></div>
                    <div style={{ width: '10%' }} className="bg-amber-500 h-full"></div>
                    <div style={{ width: `${100 - form.disk_threshold}%` }} className="bg-rose-500 h-full"></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400">🟢 Normal (&lt; {form.disk_threshold - 10}%)</span>
                    <span className="text-amber-600 dark:text-amber-400">🟡 Warning ({form.disk_threshold - 10}% - {form.disk_threshold}%)</span>
                    <span className="text-rose-600 dark:text-rose-400 font-black">🔴 Critical Incident (&gt; {form.disk_threshold}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: NOTIFICATIONS */}
        {activeTab === 'NOTIFICATIONS' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                  <BellRing className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span>Incident Notification Channels</span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Dispatches real-time alert notifications directly to Telegram Bot and Email</p>
              </div>

              <div className="space-y-4">
                {/* Telegram Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        <Send className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                          <span>Telegram Bot Webhook</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${meta.telegram_configured ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'}`}>
                            {meta.telegram_configured ? 'CONFIGURED' : 'DEV MODE'}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Sends instant alert cards directly to your Telegram channel or personal chat</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.telegram_alerts_enabled}
                        onChange={(e) => setForm(f => ({ ...f, telegram_alerts_enabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <input
                      type="text"
                      placeholder="Telegram Chat ID Override (e.g. 123456789)"
                      value={form.telegram_chat_id_override}
                      onChange={(e) => setForm(f => ({ ...f, telegram_chat_id_override: e.target.value }))}
                      className="w-full sm:flex-1 px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleTest('telegram')}
                      disabled={testing === 'telegram'}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-xs font-extrabold transition flex items-center justify-center space-x-1.5 disabled:opacity-40"
                    >
                      {testing === 'telegram' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      <span>Send Test Telegram</span>
                    </button>
                  </div>
                </div>

                {/* Email Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                          <span>SMTP Email Gateway</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${meta.smtp_configured ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'}`}>
                            {meta.smtp_configured ? 'CONFIGURED' : 'DEV MODE'}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Sends detailed email incident notifications to your DevOps on-call inbox</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.email_alerts_enabled}
                        onChange={(e) => setForm(f => ({ ...f, email_alerts_enabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <input
                      type="email"
                      placeholder="devops-oncall@yourcompany.com"
                      value={form.alert_recipient_email}
                      onChange={(e) => setForm(f => ({ ...f, alert_recipient_email: e.target.value }))}
                      className="w-full sm:flex-1 px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleTest('email')}
                      disabled={testing === 'email' || !form.alert_recipient_email}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-extrabold transition flex items-center justify-center space-x-1.5 disabled:opacity-40"
                    >
                      {testing === 'email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      <span>Send Test Email</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ENGINE & DATABASE */}
        {activeTab === 'ENGINE' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Polling Frequency Card */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                <Gauge className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Telemetry Sampling Frequency</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">Controls how often host system metrics are sampled and broadcast via WebSocket stream</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {[
                  { sec: 1, label: '1.0s (High-Precision Live)', desc: 'Best for active debugging' },
                  { sec: 2, label: '2.0s (Standard Balanced)', desc: 'Recommended default' },
                  { sec: 5, label: '5.0s (Low Overhead)', desc: 'Saves CPU & storage' },
                ].map(rate => (
                  <button
                    key={rate.sec}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, scrape_interval_seconds: rate.sec }))}
                    className={`p-4 rounded-2xl border text-left transition ${
                      form.scrape_interval_seconds === rate.sec
                        ? 'bg-sky-500/10 dark:bg-sky-500/20 border-sky-500 text-sky-700 dark:text-sky-300 font-bold shadow-sm'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <p className="text-xs font-extrabold">{rate.label}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{rate.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Retention & Database Maintenance Card */}
            <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                    <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Database Retention & Pruning</span>
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Automated background pruner removes telemetry records older than cutoff</p>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handlePrune}
                    disabled={pruning}
                    className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-xs font-extrabold transition flex items-center space-x-1.5"
                  >
                    {pruning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Prune Stale Logs Now</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300">Retention Cutoff Period</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm font-extrabold">{form.metrics_retention_days} Days</span>
                </div>
                <input
                  type="range" min="1" max="365"
                  value={form.metrics_retention_days}
                  onChange={(e) => setForm(f => ({ ...f, metrics_retention_days: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 bg-slate-200 dark:bg-slate-950 rounded-lg cursor-pointer h-2"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SECURITY */}
        {activeTab === 'SECURITY' && (
          <div className="space-y-6 animate-in fade-in">
            <ChangePasswordCard />
          </div>
        )}

      </fieldset>
    </div>
  );
}
