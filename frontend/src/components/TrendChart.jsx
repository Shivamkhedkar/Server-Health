import React from 'react';
import { Line } from 'react-chartjs-2';
import { useTheme } from '../hooks/useTheme';
import { parseUtcDate } from '../utils/dateUtils';
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

function formatAxisLabel(date, rangeHours) {
  if (!date) return '';
  if (rangeHours <= 1) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  if (rangeHours <= 6) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (rangeHours <= 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTooltipTitle(date) {
  if (!date) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function TrendChart({ dataPoints = [], series = [], rangeHours = 1, yMax = 100, height = 'h-72' }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const safeDataPoints = dataPoints || [];
  const dates = safeDataPoints.map(p => parseUtcDate(p?.timestamp));
  const labels = dates.map(d => formatAxisLabel(d, rangeHours));

  const chartData = {
    labels,
    datasets: series.map(s => ({
      label: s.unit ? `${s.label} (${s.unit})` : s.label,
      data: safeDataPoints.map(p => p?.[s.key] ?? 0),
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
        ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
      },
      y: {
        max: yMax,
        min: 0,
        grid: { color: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' },
        ticks: { color: isDark ? '#64748b' : '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
      }
    }
  };

  return (
    <div className={`w-full ${height}`}>
      <Line data={chartData} options={options} />
    </div>
  );
}
