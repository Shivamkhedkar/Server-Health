import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { handleAuthFailure } from '../api/api';
import { fetchMockOverview } from '../api/mockData';
import StatReadout from '../components/StatReadout';
import LiveChart from '../components/LiveChart';
import HealthGauge from '../components/HealthGauge';
import PulseStrip from '../components/PulseStrip';
import CoreGrid from '../components/CoreGrid';
import ProcessTable from '../components/ProcessTable';
import IOPanel from '../components/IOPanel';
import Server3DCube from '../components/Server3DCube';
import Tilt3DCard from '../components/Tilt3DCard';
import { Cpu, HardDrive, MemoryStick, Wifi, WifiOff, Radio, Gauge } from 'lucide-react';

const STATUS_COLOR = {
  HEALTHY: '#2bd97c',
  WARNING: '#f5a623',
  CRITICAL: '#ff5470',
};

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [cpuSeries, setCpuSeries] = useState([]);
  const [connection, setConnection] = useState('connecting'); // connecting | live | polling | simulated
  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const retryRef = useRef(null);

  const applySnapshot = useCallback((data, source) => {
    setOverview(data);
    const snap = data.live || data.current;
    setHistory(prev => [...prev, snap].slice(-30));
    setCpuSeries(prev => [...prev, data.live?.cpu_usage ?? data.current?.cpu_usage ?? 0].slice(-40));
    setConnection(source);
  }, []);

  const pollOnce = useCallback(async () => {
    try {
      const res = await api.get('/metrics/overview');
      applySnapshot(res.data, 'polling');
    } catch (err) {
      if (err?.response?.status === 401) return;
      applySnapshot(fetchMockOverview(), 'simulated');
    }
  }, [applySnapshot]);

  useEffect(() => {
    let cancelled = false;

    setHistory([]);
    setCpuSeries([]);
    setOverview(fetchMockOverview());

    const startPolling = () => {
      if (pollRef.current) return;
      pollOnce();
      pollRef.current = setInterval(pollOnce, 2000);
    };

    const connectWs = () => {
      if (cancelled) return;
      const token = localStorage.getItem('token');
      if (!token) {
        startPolling();
        return;
      }
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      const urlsToTry = [
        `${wsProtocol}//${window.location.host}/api/metrics/ws?token=${encodeURIComponent(token)}`,
        `${wsProtocol}//${window.location.hostname}:8000/api/metrics/ws?token=${encodeURIComponent(token)}`
      ];

      let urlIndex = 0;

      const tryNextWs = () => {
        if (cancelled) return;
        if (urlIndex >= urlsToTry.length) {
          startPolling();
          retryRef.current = setTimeout(() => {
            urlIndex = 0;
            connectWs();
          }, 5000);
          return;
        }

        const wsUrl = urlsToTry[urlIndex];
        urlIndex++;

        let ws;
        try {
          ws = new WebSocket(wsUrl);
        } catch {
          tryNextWs();
          return;
        }
        wsRef.current = ws;

        const connectTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            tryNextWs();
          }
        }, 2500);

        ws.onopen = () => {
          clearTimeout(connectTimeout);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            applySnapshot(data, 'live');
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = () => {
          clearTimeout(connectTimeout);
        };

        ws.onclose = (event) => {
          clearTimeout(connectTimeout);
          if (cancelled) return;
          if (event.code === 1008) {
            handleAuthFailure();
            return;
          }
          tryNextWs();
        };
      };

      tryNextWs();
    };

    connectWs();

    return () => {
      cancelled = true;
      if (wsRef.current) wsRef.current.close();
      if (pollRef.current) clearInterval(pollRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [applySnapshot, pollOnce]);

  if (!overview) {
    return <div className="p-8 text-center text-slate-500 font-medium data-num">Initializing telemetry link...</div>;
  }

  const { current, live, health_score, uptime_seconds } = overview;
  const statusColor = STATUS_COLOR[overview.status] || STATUS_COLOR.HEALTHY;

  const cpuVal = live?.cpu_usage ?? current?.cpu_usage ?? 0;
  const ramVal = live?.ram_usage ?? current?.ram_usage ?? 0;
  const diskVal = live?.disk_usage ?? current?.disk_usage ?? 0;

  const connectionMeta = {
    live: { label: 'LIVE · 1s STREAM', icon: Radio, color: statusColor },
    polling: { label: 'POLLING (WS DOWN)', icon: Wifi, color: '#f5a623' },
    simulated: { label: 'SIMULATED PREVIEW', icon: WifiOff, color: '#ff5470' },
    connecting: { label: 'CONNECTING...', icon: Radio, color: '#38d0e0' },
  }[connection];

  const uptimeStr = (() => {
    const s = Math.floor(uptime_seconds || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  })();

  return (
    <div className="space-y-6">
      {/* Header + connection status */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Server Health Overview
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 data-num">
            Single-sampled real-time telemetry - every panel reads the same source
          </p>
        </div>

        <div
          className="flex items-center space-x-2 px-3 py-1.5 rounded-full telemetry-panel"
          style={{ color: connectionMeta.color }}
        >
          <connectionMeta.icon className="w-3.5 h-3.5" />
          <span className="text-xs font-bold tracking-wide data-num">{connectionMeta.label}</span>
        </div>
      </div>

      {connection === 'simulated' && (
        <div className="text-xs font-semibold text-[#ff5470] telemetry-panel rounded-xl px-4 py-2 data-num">
          Backend unreachable - showing simulated numbers, not your real system. Check that the API is running on port 8000.
        </div>
      )}

      {/* Signature pulse strip */}
      <PulseStrip series={cpuSeries} statusColor={statusColor} />

      {/* Top stat readouts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatReadout
          label="CPU Utilization"
          value={`${cpuVal}`}
          unit="%"
          sub={live?.load_avg ? `load ${live.load_avg.map(l => l.toFixed(2)).join(' / ')}` : undefined}
          progress={cpuVal}
          color={cpuVal > 85 ? 'red' : cpuVal > 70 ? 'amber' : 'cyan'}
          icon={Cpu}
        />
        <StatReadout
          label="Memory (RAM)"
          value={`${ramVal}`}
          unit="%"
          sub={live ? `${live.ram_used_gb} / ${live.ram_total_gb} GB` : undefined}
          progress={ramVal}
          color={ramVal > 90 ? 'red' : ramVal > 75 ? 'amber' : 'green'}
          icon={MemoryStick}
        />
        <StatReadout
          label="Storage"
          value={`${diskVal}`}
          unit="%"
          sub={live ? `${live.disk_used_gb} / ${live.disk_total_gb} GB` : undefined}
          progress={diskVal}
          color={diskVal > 90 ? 'red' : diskVal > 80 ? 'amber' : 'green'}
          icon={HardDrive}
        />
        <StatReadout
          label="Health Index"
          value={`${health_score}`}
          unit="/100"
          sub={`uptime ${uptimeStr}`}
          progress={health_score}
          color={health_score > 80 ? 'green' : health_score > 50 ? 'amber' : 'red'}
          icon={Gauge}
        />
      </div>

      {/* 3D WebGL Server Core & Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Tilt3DCard maxTilt={10} className="h-full">
            <div className="telemetry-panel p-6 rounded-2xl h-full flex flex-col justify-between items-center text-center">
              <div className="w-full flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em]">
                  Real-Time 3D Telemetry Visualizer
                </span>
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <Server3DCube status={overview.status} healthScore={health_score} />
            </div>
          </Tilt3DCard>
        </div>

        <div className="lg:col-span-2 telemetry-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em]">
              CPU / RAM / Disk - 30 Sample Window
            </h2>
          </div>
          <LiveChart dataPoints={history} />
        </div>
      </div>

      {/* Per-core + I/O row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CoreGrid cores={live?.cpu_per_core || []} />
        </div>
        <IOPanel live={live} />
      </div>

      {/* Gauge + processes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <HealthGauge score={health_score} />
        </div>
        <div>
          <ProcessTable processes={live?.top_processes || []} />
        </div>
      </div>
    </div>
  );
}
