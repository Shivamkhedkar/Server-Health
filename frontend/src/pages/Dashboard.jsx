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
    setHistory(prev => [...prev, data.current].slice(-30));
    setCpuSeries(prev => [...prev, data.live?.cpu_usage ?? data.current.cpu_usage].slice(-40));
    setConnection(source);
  }, []);

  const pollOnce = useCallback(async () => {
    try {
      const res = await api.get('/metrics/overview');
      applySnapshot(res.data, 'polling');
    } catch (err) {
      // A 401 (expired/invalid token) is handled globally by the axios
      // response interceptor, which clears the token and redirects to
      // /login - falling back to simulated numbers here would just mask
      // that redirect for a moment. Only show the simulated preview for
      // genuine connectivity failures (network error, backend down, etc).
      if (err?.response?.status === 401) return;
      applySnapshot(fetchMockOverview(), 'simulated');
    }
  }, [applySnapshot]);

  useEffect(() => {
    let cancelled = false;

    // Seed the UI immediately so it never renders blank while the socket
    // is negotiating - swapped for real data the instant the first
    // websocket message arrives.
    setOverview(fetchMockOverview());

    const startPolling = () => {
      if (pollRef.current) return;
      pollOnce();
      pollRef.current = setInterval(pollOnce, 2000);
    };

    const connectWs = () => {
      if (cancelled) return;
      const token = localStorage.getItem('token');
      if (!token) return; // no session - let route guarding handle it
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Goes through the same host/port as the page itself (i.e. through
      // Nginx, exactly like every REST call under /api already does) -
      // NOT a hardcoded ":8000" straight to the backend container. That
      // hardcoded port only ever worked because the backend also happened
      // to be exposed directly to the host in dev; it would break the
      // moment that port is locked down (as it is in production - see
      // docker-compose.prod.yml) and it bypassed Nginx/TLS entirely.
      // Requires nginx.conf to proxy this path with the Upgrade/Connection
      // headers a WebSocket handshake needs (see frontend/nginx.conf).
      const wsUrl = `${wsProtocol}//${window.location.host}/api/metrics/ws?token=${encodeURIComponent(token)}`;
      let ws;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        startPolling();
        return;
      }
      wsRef.current = ws;

      const connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          startPolling();
        }
      }, 3000);

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
        // 1008 = policy violation - the backend rejected the token (missing,
        // expired, invalid). Don't silently fall back to polling/simulated
        // data and keep retrying forever with the same dead token; send the
        // user back to /login instead, same as any other 401.
        if (event.code === 1008) {
          handleAuthFailure();
          return;
        }
        startPolling();
        retryRef.current = setTimeout(connectWs, 4000);
      };
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
          value={`${current.cpu_usage}`}
          unit="%"
          sub={live?.load_avg ? `load ${live.load_avg.map(l => l.toFixed(2)).join(' / ')}` : undefined}
          progress={current.cpu_usage}
          color={current.cpu_usage > 85 ? 'red' : current.cpu_usage > 70 ? 'amber' : 'cyan'}
          icon={Cpu}
        />
        <StatReadout
          label="Memory (RAM)"
          value={`${current.ram_usage}`}
          unit="%"
          sub={live ? `${live.ram_used_gb} / ${live.ram_total_gb} GB` : undefined}
          progress={current.ram_usage}
          color={current.ram_usage > 90 ? 'red' : current.ram_usage > 75 ? 'amber' : 'green'}
          icon={MemoryStick}
        />
        <StatReadout
          label="Storage"
          value={`${current.disk_usage}`}
          unit="%"
          sub={live ? `${live.disk_used_gb} / ${live.disk_total_gb} GB` : undefined}
          progress={current.disk_usage}
          color={current.disk_usage > 90 ? 'red' : current.disk_usage > 80 ? 'amber' : 'green'}
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

      {/* Per-core + I/O row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CoreGrid cores={live?.cpu_per_core || []} />
        </div>
        <IOPanel live={live} />
      </div>

      {/* Chart + gauge + processes */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-2 telemetry-panel p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.14em]">
              CPU / RAM / Disk - 30 Sample Window
            </h2>
          </div>
          <LiveChart dataPoints={history} />
        </div>

        <div className="lg:col-span-1">
          <HealthGauge score={health_score} />
        </div>

        <div className="lg:col-span-1">
          <ProcessTable processes={live?.top_processes || []} />
        </div>
      </div>
    </div>
  );
}
