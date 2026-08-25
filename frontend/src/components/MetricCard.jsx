import React from 'react';

export default function MetricCard({ title, value, unit, icon: Icon, color, progress, statusText }) {
  const colorMap = {
    blue: {
      gradient: 'from-blue-500/10 to-indigo-500/5 dark:from-blue-500/20 dark:to-indigo-500/5',
      border: 'border-blue-500/30 dark:border-blue-500/20',
      text: 'text-blue-600 dark:text-blue-400',
      bar: 'bg-blue-600 dark:bg-blue-500',
      iconBg: 'bg-blue-50 dark:bg-slate-900/60'
    },
    purple: {
      gradient: 'from-purple-500/10 to-pink-500/5 dark:from-purple-500/20 dark:to-pink-500/5',
      border: 'border-purple-500/30 dark:border-purple-500/20',
      text: 'text-purple-600 dark:text-purple-400',
      bar: 'bg-purple-600 dark:bg-purple-500',
      iconBg: 'bg-purple-50 dark:bg-slate-900/60'
    },
    emerald: {
      gradient: 'from-emerald-500/10 to-teal-500/5 dark:from-emerald-500/20 dark:to-teal-500/5',
      border: 'border-emerald-500/30 dark:border-emerald-500/20',
      text: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-600 dark:bg-emerald-500',
      iconBg: 'bg-emerald-50 dark:bg-slate-900/60'
    },
    amber: {
      gradient: 'from-amber-500/10 to-orange-500/5 dark:from-amber-500/20 dark:to-orange-500/5',
      border: 'border-amber-500/30 dark:border-amber-500/20',
      text: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-600 dark:bg-amber-500',
      iconBg: 'bg-amber-50 dark:bg-slate-900/60'
    }
  };

  const theme = colorMap[color] || colorMap.blue;

  return (
    <div className={`p-6 rounded-2xl glass-panel glass-card-hover border ${theme.border} bg-gradient-to-br ${theme.gradient}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</span>
        <div className={`p-2.5 rounded-xl ${theme.iconBg} ${theme.text}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <div className="flex items-baseline space-x-1">
          <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{value}</span>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400 ml-1">{unit}</span>
        </div>
        {statusText && (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {statusText}
          </span>
        )}
      </div>

      {/* Animated Progress Bar */}
      <div className="mt-4 w-full bg-slate-200 dark:bg-slate-950/60 rounded-full h-2 overflow-hidden border border-slate-300/60 dark:border-slate-800">
        <div
          className={`h-full ${theme.bar} transition-all duration-700 ease-out rounded-full`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
