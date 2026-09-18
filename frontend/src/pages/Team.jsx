import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { Users, UserPlus, Trash2, Loader2, ShieldCheck, Eye, AlertCircle, ShieldAlert, KeyRound, X } from 'lucide-react';

const emptyForm = { username: '', email: '', password: '', role: 'viewer' };

export default function Team() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [resettingFor, setResettingFor] = useState(null); // member id currently showing the reset row
  const [resetPassword, setResetPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const currentUsername = localStorage.getItem('username');

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      setMembers(res.data);
    } catch (err) {
      // A 403 here means this account isn't actually an admin (stale
      // localStorage role, or backend/frontend role got out of sync) -
      // the sidebar already hides this link from non-admins, this is
      // just the belt-and-suspenders case.
      if (err?.response?.status !== 401) {
        showToast('error', err?.response?.data?.detail || 'Could not load team members.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/users', form);
      showToast('success', `Account "${form.username}" created.`);
      setForm(emptyForm);
      loadMembers();
    } catch (err) {
      showToast('error', err?.response?.data?.detail || 'Could not create the account.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (member) => {
    if (!window.confirm(`Remove ${member.username}'s account? This can't be undone.`)) return;
    setDeletingId(member.id);
    try {
      await api.delete(`/users/${member.id}`);
      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (err) {
      showToast('error', err?.response?.data?.detail || 'Could not remove that account.');
    } finally {
      setDeletingId(null);
    }
  };

  const openResetFor = (member) => {
    setResettingFor(member.id);
    setResetPassword('');
  };

  const handleResetPassword = async (e, member) => {
    e.preventDefault();
    if (resetPassword.length < 8) {
      showToast('error', 'New password must be at least 8 characters.');
      return;
    }
    setResetSaving(true);
    try {
      await api.put(`/users/${member.id}/password`, { new_password: resetPassword });
      showToast('success', `Password reset for "${member.username}". Share the new password with them securely.`);
      setResettingFor(null);
      setResetPassword('');
    } catch (err) {
      showToast('error', err?.response?.data?.detail || 'Could not reset that password.');
    } finally {
      setResetSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center space-x-3">
          <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
          <span>Team & Accounts</span>
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
          Manage who can sign in to this monitor. Admins can change thresholds, notification channels, and
          acknowledge alerts; viewers can see everything but not change anything.
        </p>
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

      {/* Create new member */}
      <form onSubmit={handleCreate} className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Add a Team Member</span>
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            type="text" placeholder="Username" required
            value={form.username}
            onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
            className="px-3 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <input
            type="email" placeholder="Email" required
            value={form.email}
            onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            className="px-3 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <input
            type="password" placeholder="Temporary password" required minLength={8}
            value={form.password}
            onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
            className="px-3 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
          <select
            value={form.role}
            onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
            className="px-3 py-2.5 rounded-lg text-sm font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            <option value="viewer">Viewer (read-only)</option>
            <option value="admin">Admin (full access)</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/30 hover:opacity-95 transition flex items-center space-x-2 disabled:opacity-60"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          <span>{creating ? 'Creating...' : 'Create Account'}</span>
        </button>
      </form>

      {/* Member list */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900/80 text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium">
              {members.map((member) => (
                <React.Fragment key={member.id}>
                  <tr className="hover:bg-slate-100/60 dark:hover:bg-slate-900/40 transition">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">
                      {member.username}
                      {member.username === currentUsername && (
                        <span className="ml-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">You</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{member.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${
                        member.role === 'admin'
                          ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30'
                          : 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30'
                      }`}>
                        {member.role === 'admin' ? <ShieldAlert className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{member.role === 'admin' ? 'Admin' : 'Viewer'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openResetFor(member)}
                        title="Reset this account's password"
                        className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-400 hover:text-white border border-indigo-200 dark:border-indigo-500/30 transition inline-flex"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        disabled={deletingId === member.id || member.username === currentUsername}
                        title={member.username === currentUsername ? "You can't remove your own account" : 'Remove account'}
                        className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-600 text-rose-700 dark:text-rose-400 hover:text-white border border-rose-200 dark:border-rose-500/30 transition disabled:opacity-30 disabled:cursor-not-allowed inline-flex"
                      >
                        {deletingId === member.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                  {resettingFor === member.id && (
                    <tr className="bg-slate-50 dark:bg-slate-900/60">
                      <td colSpan={4} className="px-6 py-4">
                        <form onSubmit={(e) => handleResetPassword(e, member)} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            New password for {member.username}:
                          </span>
                          <input
                            type="password" autoFocus required minLength={8}
                            placeholder="New password (min 8 characters)"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                          <button
                            type="submit"
                            disabled={resetSaving}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:opacity-90 transition disabled:opacity-60 flex items-center gap-1.5"
                          >
                            {resetSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setResettingFor(null)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!loading && !members.length && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                    No team members found.
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
