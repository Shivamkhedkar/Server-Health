import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import api from '../api/api';
import { Bell, User, LogOut, ShieldCheck, ChevronDown } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hostname, setHostname] = useState(null);
  const [hasUnacknowledged, setHasUnacknowledged] = useState(false);
  const username = localStorage.getItem('username') || 'Admin Operator';
  const role = localStorage.getItem('role');
  const roleLabel = role === 'admin' ? 'DevOps Admin' : role === 'viewer' ? 'Viewer' : 'Team Member';

  useEffect(() => {
    let cancelled = false;
    api.get('/system/info')
      .then(res => { if (!cancelled) setHostname(res.data.hostname); })
      .catch(() => { /* leave hostname unset - the label just won't render */ });
    return () => { cancelled = true; };
  }, []);

  // The bell used to always show a red dot regardless of whether there was
  // anything to actually look at. Same real-data fix as the Sidebar badge.
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      api.get('/alerts')
        .then(res => { if (!cancelled) setHasUnacknowledged(res.data.some(a => !a.acknowledged)); })
        .catch(() => { if (!cancelled) setHasUnacknowledged(false); });
    };
    check();
    const interval = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between z-20 transition-colors duration-300">
      {/* Status Badge */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>SYSTEM OPERATIONAL</span>
        </div>
        {hostname && (
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline font-mono">Node: {hostname}</span>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-4">
        <ThemeToggle />

        {/* Alerts Notification Indicator */}
        <button 
          onClick={() => navigate('/alerts')}
          className="relative p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          title="Incident Alerts"
        >
          <Bell className="w-5 h-5" />
          {hasUnacknowledged && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-950" />
          )}
        </button>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
              <User className="w-5 h-5" />
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{username}</p>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-semibold">{roleLabel}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 rounded-2xl glass-panel py-2 border border-slate-200 dark:border-slate-700/50 shadow-2xl z-50">
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">Signed in as</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{username}</p>
              </div>
              <button
                onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center space-x-2 font-medium"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Security Settings</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center space-x-2 font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
