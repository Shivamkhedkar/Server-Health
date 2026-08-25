import React from 'react';
import { ArrowDown, ArrowUp, HardDriveDownload, HardDriveUpload } from 'lucide-react';

function Row({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-200/70 dark:border-white/5 last:border-0">
      <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <span className="data-num text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

export default function IOPanel({ live }) {
  if (!live) return null;
  return (
    <div className="telemetry-panel rounded-2xl p-5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
        Network &amp; Disk I/O
      </h3>
      <Row icon={ArrowDown} label="Network In" value={`${live.network_recv_mbps.toFixed(2)} MB/s`} color="#38d0e0" />
      <Row icon={ArrowUp} label="Network Out" value={`${live.network_sent_mbps.toFixed(2)} MB/s`} color="#2bd97c" />
      <Row icon={HardDriveDownload} label="Disk Read" value={`${live.disk_read_mbps.toFixed(2)} MB/s`} color="#f5a623" />
      <Row icon={HardDriveUpload} label="Disk Write" value={`${live.disk_write_mbps.toFixed(2)} MB/s`} color="#ff5470" />
    </div>
  );
}
