import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { Server, Lock, User, Mail, ArrowRight, ShieldCheck, UserPlus, LogIn, Zap } from 'lucide-react';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const authMessage = sessionStorage.getItem('authMessage');
    if (authMessage) {
      setError(authMessage);
      sessionStorage.removeItem('authMessage');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        const res = await api.post('/auth/register', { username, email, password });
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('refreshToken', res.data.refresh_token);
        localStorage.setItem('username', res.data.user.username);
        localStorage.setItem('userEmail', res.data.user.email);
        localStorage.setItem('role', res.data.user.role);
        navigate('/dashboard');
      } else {
        const res = await api.post('/auth/login', { username, password });
        localStorage.setItem('token', res.data.access_token);
        localStorage.setItem('refreshToken', res.data.refresh_token);
        localStorage.setItem('username', res.data.user.username);
        localStorage.setItem('userEmail', res.data.user.email);
        localStorage.setItem('role', res.data.user.role);
        navigate('/dashboard');
      }
    } catch (err) {
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Could not reach backend server on port 8000. Check that FastAPI is running.');
      } else {
        setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-slate-950 font-sans">
      {/* Cinematic Server Room Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
        style={{ backgroundImage: `url('/login_bg.jpg')` }}
      />

      {/* Cybernetic Dark Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/85 to-indigo-950/70" />
      <div className="absolute inset-0 cyber-grid-bg opacity-30" />

      {/* Ambient Pulsing Glow Orbs */}
      <div className="absolute top-1/4 left-1/5 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/5 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />

      {/* Clean Glassmorphic Login Card (No 3D tilt) */}
      <div className="w-full max-w-md relative z-10 glass-panel p-8 rounded-3xl border border-cyan-500/30 dark:border-cyan-500/20 shadow-2xl shadow-cyan-500/10 backdrop-blur-2xl transition-all duration-300">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 mx-auto flex items-center justify-center shadow-xl shadow-cyan-500/30 mb-3">
            <Server className="w-9 h-9 text-white" />
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center space-x-2">
            <span>DevOps Monitor Pro</span>
          </h1>
          <p className="text-xs text-cyan-300/80 mt-1 font-mono tracking-wide">
            {isRegistering ? '⚡ Create your account' : '🔒 Enterprise System Monitoring'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => { setIsRegistering(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
              !isRegistering
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => { setIsRegistering(true); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
              isRegistering
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5">Username</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-cyan-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition font-medium"
                placeholder="Enter username"
              />
            </div>
          </div>

          {isRegistering && (
            <div>
              <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-cyan-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition font-medium"
                  placeholder="Enter email address"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-cyan-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition font-medium"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 transition-all transform active:scale-98 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <Zap className="w-4 h-4 animate-spin text-cyan-300" />
                <span>Authenticating...</span>
              </span>
            ) : (
              <>
                <span>{isRegistering ? 'Create Account & Access Dashboard' : 'Sign In to Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
          <p className="text-[11px] text-slate-400 font-mono flex items-center justify-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>256-Bit Encrypted Real-Time Telemetry Session</span>
          </p>
        </div>
      </div>
    </div>
  );
}
