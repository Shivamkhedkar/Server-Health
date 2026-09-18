import React from 'react';

export default function HealthGauge({ score }) {
  const getStatusColor = (val) => {
    if (val >= 80) return { text: 'text-[#2bd97c]', border: 'border-[#2bd97c]', bg: 'bg-[#2bd97c]/10', label: 'OPTIMAL' };
    if (val >= 50) return { text: 'text-[#f5a623]', border: 'border-[#f5a623]', bg: 'bg-[#f5a623]/10', label: 'MODERATE' };
    return { text: 'text-[#ff5470]', border: 'border-[#ff5470]', bg: 'bg-[#ff5470]/10', label: 'CRITICAL' };
  };

  const status = getStatusColor(score);

  return (
    <div className="p-6 rounded-2xl telemetry-panel flex flex-col items-center justify-center relative overflow-hidden h-full">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-4">Server Health Index</h3>
      
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Glowing Circle */}
        <div className={`absolute inset-0 rounded-full border-4 ${status.border} opacity-20 animate-ping-slow`} />
        <div className="w-32 h-32 rounded-full border-8 border-slate-200 dark:border-slate-900 flex items-center justify-center bg-white dark:bg-slate-950/80 shadow-xl">
          <div className="text-center">
            <span className={`text-3xl font-extrabold ${status.text}`}>{score}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold block">/ 100</span>
          </div>
        </div>
      </div>

      <div className={`mt-4 px-3.5 py-1 rounded-full ${status.bg} border ${status.border}/30 text-xs font-extrabold ${status.text}`}>
        STATUS: {status.label}
      </div>
    </div>
  );
}
