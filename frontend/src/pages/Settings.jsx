import React, { useState, useEffect } from 'react';
import api from '../api/api';
import ChangePasswordCard from '../components/ChangePasswordCard';
import { Settings as SettingsIcon, Save, Mail, Send, Sliders, BellRing, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

const DEFAULTS = {
  cpu_threshold: 85,
  ram_threshold: 90,
  disk_threshold: 90,
  email_alerts_enabled: false,
  telegram_alerts_enabled: false,
  alert_recipient_email: '',
  telegram_chat_id_override: '',
  metrics_retention_days: 90,
};

export default function Settings() {
  const [form, setForm] = useState(DEFAULTS);
  const [meta, setMeta] = useState({ smtp_configured: false, telegram_configured: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }
  const [testing, setTesting] = useState(null); // 'email' | 'telegram' | null
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
      });
      setMeta({ smtp_configured: res.data.smtp_configured, telegram_configured: res.data.telegram_configured });
    } catch {
      // Backend unreachable - keep sane defaults so the form is still usable
      // once the API comes back; saving will simply fail with a clear error.
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
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      showToast('success', 'Settings successfully updated and saved to core configuration!');
    } catch (err) {
      showToast('error', err?.response?.data?.detail || 'Failed to save settings - check the backend connection.');
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

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-3">
          <SettingsIcon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <span>Platform Settings & Notifications</span>
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">Configure threshold rules, SMTP email triggers, and bot webhooks</p>
      </div>

      {toast && (
        <div className={`p-4 rounded-xl border text-sm font-bold flex items-center space-x-2 ${
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
        <div className="p-4 rounded-xl border text-sm font-bold flex items-center space-x-2 bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-5 h-5" />
          <span>You&apos;re signed in as a viewer - these settings are read-only. Ask an administrator to make changes.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <fieldset disabled={!isAdmin} className="space-y-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Resource Threshold Trigger Limits</span>
          </h2>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-800 dark:text-slate-300">CPU Threshold Trigger</span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-extrabold text-sm">{form.cpu_threshold}%</span>
              </div>
              <input
                type="range" min="50" max="98"
                value={form.cpu_threshold}
                onChange={(e) => setForm(f => ({ ...f, cpu_threshold: Number(e.target.value) }))}
                className="w-full accent-blue-600 bg-slate-200 dark:bg-slate-900 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-800 dark:text-slate-300">RAM Threshold Trigger</span>
                <span className="text-purple-600 dark:text-purple-400 font-mono font-extrabold text-sm">{form.ram_threshold}%</span>
              </div>
              <input
                type="range" min="50" max="98"
                value={form.ram_threshold}
                onChange={(e) => setForm(f => ({ ...f, ram_threshold: Number(e.target.value) }))}
                className="w-full accent-purple-600 bg-slate-200 dark:bg-slate-900 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-slate-800 dark:text-slate-300">Disk Threshold Trigger</span>
                <span className="text-amber-600 dark:text-amber-400 font-mono font-extrabold text-sm">{form.disk_threshold}%</span>
              </div>
              <input
                type="range" min="50" max="98"
                value={form.disk_threshold}
                onChange={(e) => setForm(f => ({ ...f, disk_threshold: Number(e.target.value) }))}
                className="w-full accent-amber-600 bg-slate-200 dark:bg-slate-900 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Data Retention */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Metrics Data Retention</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            The collector writes a metrics row roughly every 5 seconds. A background job prunes rows older than this
            window automatically, hourly, so the database doesn&apos;t grow forever.
          </p>
          <div>
            <div className="flex justify-between text-xs font-bold mb-2">
              <span className="text-slate-800 dark:text-slate-300">Retain Metrics For</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-extrabold text-sm">{form.metrics_retention_days} days</span>
            </div>
            <input
              type="range" min="1" max="365"
              value={form.metrics_retention_days}
              onChange={(e) => setForm(f => ({ ...f, metrics_retention_days: Number(e.target.value) }))}
              className="w-full accent-emerald-600 bg-slate-200 dark:bg-slate-900 rounded-lg"
            />
          </div>
        </div>

        {/* Integration Switches */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
            <BellRing className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Incident Alert Dispatch Channels</span>
          </h2>

          <div className="space-y-4">
            {/* Email */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-200">Email SMTP Dispatch</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {meta.smtp_configured ? 'SMTP server configured on backend' : 'SMTP_* env vars not set on backend - add them to enable this channel'}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.email_alerts_enabled}
                  onChange={(e) => setForm(f => ({ ...f, email_alerts_enabled: e.target.checked }))}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-3 pl-8">
                <input
                  type="email"
                  placeholder="alerts-recipient@example.com"
                  value={form.alert_recipient_email}
                  onChange={(e) => setForm(f => ({ ...f, alert_recipient_email: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <button
                  type="button"
                  onClick={() => handleTest('email')}
                  disabled={testing === 'email' || !form.alert_recipient_email}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {testing === 'email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Send Test
                </button>
              </div>
            </div>

            {/* Telegram */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-200">Telegram Bot Webhook</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {meta.telegram_configured ? 'Telegram bot configured' : 'TELEGRAM_BOT_TOKEN not set on backend, or no chat ID - add below or via env'}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.telegram_alerts_enabled}
                  onChange={(e) => setForm(f => ({ ...f, telegram_alerts_enabled: e.target.checked }))}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-3 pl-8">
                <input
                  type="text"
                  placeholder="Telegram chat ID (optional override of server default)"
                  value={form.telegram_chat_id_override}
                  onChange={(e) => setForm(f => ({ ...f, telegram_chat_id_override: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <button
                  type="button"
                  onClick={() => handleTest('telegram')}
                  disabled={testing === 'telegram'}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-blue-600/10 text-blue-700 dark:text-blue-300 hover:bg-blue-600 hover:text-white transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {testing === 'telegram' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Send Test
                </button>
              </div>
            </div>
          </div>
        </div>

        </fieldset>

        {isAdmin && (
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/30 hover:opacity-95 transition flex items-center space-x-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : 'Save System Settings'}</span>
          </button>
        )}
      </form>

      <ChangePasswordCard />
    </div>
  );
}
