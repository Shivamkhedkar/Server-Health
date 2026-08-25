import React, { useState } from 'react';
import api from '../api/api';
import { KeyRound, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('error', "New password and confirmation don't match.");
      return;
    }
    if (newPassword.length < 8) {
      showToast('error', 'New password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/users/me/password', { current_password: currentPassword, new_password: newPassword });
      showToast('success', 'Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast('error', err?.response?.data?.detail || 'Could not update your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
        <KeyRound className="w-4 h-4 text-rose-600 dark:text-rose-400" />
        <span>Change Your Password</span>
      </h2>
      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
        Available to every account, admin or viewer - this only changes your own login credentials.
      </p>

      {toast && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center space-x-2 ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          {toast.type === 'success'
            ? <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            : <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <input
          type="password" placeholder="Current password" required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="px-3 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
        />
        <input
          type="password" placeholder="New password" required minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="px-3 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
        />
        <input
          type="password" placeholder="Confirm new password" required minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="px-3 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold text-sm shadow-lg shadow-rose-500/30 hover:opacity-95 transition flex items-center space-x-2 disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        <span>{saving ? 'Updating...' : 'Update Password'}</span>
      </button>
    </form>
  );
}
