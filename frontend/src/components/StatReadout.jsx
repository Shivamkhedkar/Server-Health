import React from 'react';
import Tilt3DCard from './Tilt3DCard';

const COLOR_MAP = {
  green: { text: '#2bd97c', ring: 'rgba(43, 217, 124, 0.35)', bar: 'bg-[#2bd97c]' },
  cyan: { text: '#38d0e0', ring: 'rgba(56, 208, 224, 0.35)', bar: 'bg-[#38d0e0]' },
  amber: { text: '#f5a623', ring: 'rgba(245, 166, 35, 0.35)', bar: 'bg-[#f5a623]' },
  red: { text: '#ff5470', ring: 'rgba(255, 84, 112, 0.35)', bar: 'bg-[#ff5470]' },
};

export default function StatReadout({ label, value, unit, sub, progress, color = 'green', icon: Icon }) {
  const theme = COLOR_MAP[color] || COLOR_MAP.green;

  return (
    <Tilt3DCard maxTilt={12} className="h-full">
      <div className="telemetry-panel rounded-2xl p-5 flex flex-col justify-between min-h-[148px] h-full transition-shadow duration-300 hover:shadow-xl hover:shadow-indigo-500/10">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {label}
          </span>
          {Icon && <Icon className="w-5 h-5 animate-pulse" style={{ color: theme.text }} />}
        </div>

        <div className="mt-2 flex items-baseline space-x-1.5">
          <span className="data-num text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">{value}</span>
          {unit && <span className="data-num text-sm font-semibold text-slate-500 dark:text-slate-400">{unit}</span>}
        </div>

        {sub && <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-500 data-num">{sub}</p>}

        {typeof progress === 'number' && (
          <div className="mt-3 w-full h-1.5 rounded-full bg-slate-200/70 dark:bg-white/5 overflow-hidden relative">
            <div
              className={`h-full ${theme.bar} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%`, boxShadow: `0 0 12px ${theme.ring}` }}
            />
          </div>
        )}
      </div>
    </Tilt3DCard>
  );
}
