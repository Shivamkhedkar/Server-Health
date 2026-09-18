import React, { useMemo } from 'react';

// The signature element of the redesign: a live waveform built directly
// from the last ~40 real samples (CPU load), styled like an instrument
// heartbeat rather than a generic line chart. Reflects health status color.
export default function PulseStrip({ series = [], statusColor = '#2bd97c' }) {
  const points = useMemo(() => {
    const W = 600;
    const H = 64;
    const pad = 6;
    if (series.length < 2) return '';
    const max = 100;
    const step = W / (series.length - 1);
    return series
      .map((v, i) => {
        const x = i * step;
        const y = H - pad - (Math.min(100, Math.max(0, v)) / max) * (H - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [series]);

  const last = series[series.length - 1] ?? 0;

  return (
    <div className="relative w-full h-16 overflow-hidden rounded-xl telemetry-panel">
      <div
        className="absolute inset-0 opacity-40 animate-scan pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${statusColor}22, transparent)`,
          width: '40%'
        }}
      />
      {points && (
        <svg viewBox="0 0 600 64" preserveAspectRatio="none" className="w-full h-full">
          <polyline
            points={points}
            fill="none"
            stroke={statusColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 6px ${statusColor}88)` }}
          />
        </svg>
      )}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
        <span className="live-dot w-2 h-2 rounded-full" style={{ color: statusColor, backgroundColor: statusColor }} />
        <span className="data-num text-xs font-bold" style={{ color: statusColor }}>{last.toFixed(1)}%</span>
      </div>
    </div>
  );
}
