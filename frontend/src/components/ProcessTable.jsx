import React from 'react';
import { Terminal } from 'lucide-react';

export default function ProcessTable({ processes = [] }) {
  return (
    <div className="telemetry-panel rounded-2xl p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-[#38d0e0]" />
          <span>Top Processes (Live)</span>
        </h3>
      </div>

      {processes.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-600 data-num">Waiting for process sample...</p>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-600 px-2 pb-1">
            <span className="col-span-2">PID</span>
            <span className="col-span-6">Name</span>
            <span className="col-span-2 text-right">CPU</span>
            <span className="col-span-2 text-right">MEM</span>
          </div>
          {processes.map((p) => (
            <div
              key={p.pid}
              className="grid grid-cols-12 items-center px-2 py-1.5 rounded-lg text-xs data-num hover:bg-slate-100 dark:hover:bg-white/[0.03] transition"
            >
              <span className="col-span-2 text-slate-400 dark:text-slate-600">{p.pid}</span>
              <span className="col-span-6 truncate text-slate-700 dark:text-slate-300 font-medium">{p.name}</span>
              <span
                className="col-span-2 text-right font-bold"
                style={{ color: p.cpu_percent > 50 ? '#ff5470' : p.cpu_percent > 20 ? '#f5a623' : '#2bd97c' }}
              >
                {p.cpu_percent.toFixed(1)}%
              </span>
              <span className="col-span-2 text-right text-slate-500 dark:text-slate-400">{p.memory_percent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
