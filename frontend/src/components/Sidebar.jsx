import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, AlertTriangle, History, Settings, Server, Cpu, Users } from 'lucide-react';
import api from '../api/api';

export default function Sidebar() {
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(null);
  const role = localStorage.getItem('role');

  // The alert badge used to be a hardcoded "3" regardless of what alerts
  // actually existed. Poll the real count instead, same cadence as the
  // Alerts page itself, so the sidebar and the page it links to always
  // agree.
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await api.get('/alerts');
        if (!cancelled) {
          const count = res.data.filter(a => !a.acknowledged).length;
          setUnacknowledgedCount(count);
        }
      } catch {
        // 401s are handled globally by the axios interceptor; any other
        // error just means we don't show a badge rather than a fake one.
        if (!cancelled) setUnacknowledgedCount(null);
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      path: '/alerts',
      label: 'Alert Center',
      icon: AlertTriangle,
      badge: unacknowledgedCount > 0 ? String(unacknowledgedCount) : null,
    },
    { path: '/history', label: 'Metrics History', icon: History },
    { path: '/settings', label: 'Settings', icon: Settings },
    // Team management is admin-only on the backend too - hiding the link
    // for viewers avoids sending them to a page that just 403s.
    ...(role === 'admin' ? [{ path: '/team', label: 'Team', icon: Users }] : []),
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between z-30 transition-colors duration-300">
      <div>
        {/* Logo Branding */}
        <div className="h-16 flex items-center px-6 space-x-3 border-b border-slate-200 dark:border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/30">
            <Server className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-base bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent">
              DevOps Monitor
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase font-bold">ENTERPRISE PRO</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                  }`
                }
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-full border border-rose-500/30">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* System Mini Widget */}
      <div className="p-4 m-4 rounded-2xl glass-panel border border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-400 mb-2">
          <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Core Engine Info</span>
        </div>
        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 space-y-1">
          <p>Engine: FastAPI 0.104</p>
          <p>Scrape: 2000ms</p>
          <p>Metrics: Prometheus</p>
        </div>
      </div>
    </aside>
  );
}
