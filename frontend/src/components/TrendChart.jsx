import React from 'react';
import { Line } from 'react-chartjs-2';
import { useTheme } from '../hooks/useTheme';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Picks a sensible label format for a timestamp given the total window
// being displayed, so a 7-day chart shows dates while a 1-hour chart shows
// seconds - and a tooltip always shows the full date + time regardless.
function formatAxisLabel(date, rangeHours) {
  if (rangeHours <= 1) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  if (rangeHours <= 6) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (rangeHours <= 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  // Multi-day windows (e.g. 7 days): show the date plus time so points on
  // different days are distinguishable.
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTooltipTitle(date) {
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Generic time-series chart.
 * @param dataPoints  array of samples with a `timestamp` field plus whatever series keys reference
 * @param series      [{ key, label, color, fillOpacity, unit }]
 * @param rangeHours  total width of the window in hours, used to pick label granularity
 * @param yMax        optional fixed y-axis max (defaults to auto)
 * @param height      tailwind height class override
 */
export default function TrendChart({ dataPoints, series, rangeHours = 1, yMax = 100, height = 'h-72' }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const dates = dataPoints.map(p => new Date(p.timestamp));
  const labels = dates.map(d => formatAxisLabel(d, rangeHours));

  const chartData = {
    labels,
    datasets: series.map(s => ({
      label: s.unit ? `${s.label} (${s.unit})` : s.label,
      data: dataPoints.map(p => p[s.key]),
      borderColor: s.color,
      backgroundColor: isDark
        ? s.color + '20'
        : s.color + '14',
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHoverRadius: 5,
      borderWidth: 2,
    }))
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: isDark ? '#cbd5e1' : '#334155',
          font: { family: 'Plus Jakarta Sans', size: 12, weight: '700' },
          boxWidth: 12,
          usePointStyle: true,
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#334155',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(203, 213, 225, 0.8)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const idx = items[0].dataIndex;
            return dates[idx] ? formatTooltipTitle(dates[idx]) : '';
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          color: isDark ? '#94a3b8' : '#475569',
          font: { weight: '600' },
          autoSkip: true,
          maxRotation: 0,
          maxTicksLimit: 8,
        }
      },
      y: {
        min: 0,
        max: yMax,
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: isDark ? '#94a3b8' : '#475569', font: { weight: '600' } }
      }
    }
  };

  return (
    <div className={`${height} w-full`}>
      <Line data={chartData} options={options} />
    </div>
  );
}
