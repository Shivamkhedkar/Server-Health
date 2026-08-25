import React from 'react';
import TrendChart from './TrendChart';

// Dashboard's rolling live window (last ~30 samples, a couple of minutes).
// Kept as a thin wrapper around TrendChart so the second-level time
// formatting used on the live dashboard stays distinct from the
// range-aware formatting used on the History page.
export default function LiveChart({ dataPoints }) {
  const series = [
    { key: 'cpu_usage', label: 'CPU Usage', color: '#38d0e0', unit: '%' },
    { key: 'ram_usage', label: 'RAM Usage', color: '#2bd97c', unit: '%' },
    { key: 'disk_usage', label: 'Disk Usage', color: '#f5a623', unit: '%' },
  ];

  return <TrendChart dataPoints={dataPoints} series={series} rangeHours={1} height="h-80" />;
}
