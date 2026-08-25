import React from 'react';

function coreColor(v) {
  if (v > 85) return '#ff5470';
  if (v > 70) return '#f5a623';
  return '#2bd97c';
}

export default function CoreGrid({ cores = [] }) {
  if (!cores.length) return null;
  return (
    <div className="telemetry-panel rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Per-Core Load
        </h3>
        <span className="data-num text-[11px] text-slate-500 dark:text-slate-500">{cores.length} threads</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {cores.map((v, i) => {
          const color = coreColor(v);
          return (
            <div
              key={i}
              className="rounded-lg border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] p-2 flex flex-col items-center"
              title={`Core ${i}: ${v}%`}
            >
              <span className="data-num text-[10px] text-slate-400 dark:text-slate-600">C{i}</span>
              <div className="w-full h-10 mt-1 rounded bg-slate-200/70 dark:bg-black/30 relative overflow-hidden flex items-end">
                <div
                  className="w-full rounded transition-all duration-500"
                  style={{ height: `${Math.min(100, v)}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}66` }}
                />
              </div>
              <span className="data-num text-[10px] font-bold mt-1" style={{ color }}>{v.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
