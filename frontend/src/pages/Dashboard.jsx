import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { fetchMockOverview } from '../api/mockData';
import StatReadout from '../components/StatReadout';
import LiveChart from '../components/LiveChart';
import HealthGauge from '../components/HealthGauge';
import PulseStrip from '../components/PulseStrip';
import CoreGrid from '../components/CoreGrid';
import ProcessTable from '../components/ProcessTable';
import IOPanel from '../components/IOPanel';
import Tilt3DCard from '../components/Tilt3DCard';
import { Cpu, HardDrive, MemoryStick, Wifi, WifiOff, Radio, Gauge, Server as ServerIcon, ChevronDown } from 'lucide-react';

const Server3DCube = lazy(() => import('../components/Server3DCube'));

const STATUS_COLOR = {
  HEALTHY: '#2bd97c',
  ONLINE: '#2bd97c',
  WARNING: '#f5a623',
  CRITICAL: '#ff5470',
  OFFLINE: '#64748b',
};

export default function Dashboard() {
  const { id: routeServerId } = useParams();
  const navigate = useNavigate();

  const [servers, setServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(routeServerId || 'local');
  const [serverMeta, setServerMeta] = useState(null);

  const [overview, setOverview] = useState(() => fetchMockOverview());
  const [history, setHistory] = useState([]);
  const [cpuSeries, setCpuSeries] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const pollRef = useRef(null);
  const metaRef = useRef(null);

  // Sync route parameter changes
  useEffect(() => {
    if (routeServerId) {
      setSelectedServerId(routeServerId);
    }
  }, [routeServerId]);

  // Load registered servers list for dropdown selector
  useEffect(() => {
    api.get('/servers')
      .then(res => setServers(res.data || []))
      .catch(() => setServers([]));
  }, []);

  const applySnapshot = useCallback((data, source) => {
    setOverview(data);
    const snap = data.live || data.current;
    if (snap) {
      setHistory(prev => [...prev, snap].slice(-30));
      setCpuSeries(prev => [...prev, snap.cpu_usage ?? 0].slice(-40));
    }
    setConnection(source);
  }, []);

  // Fast current metric poll (runs every 1000ms)
  const pollCurrentMetric = useCallback(async () => {
    try {
      if (!selectedServerId || selectedServerId === 'local') {
        const res = await api.get('/metrics/overview');
        applySnapshot(res.data, 'polling');
      } else {
        const curRes = await api.get(`/servers/${selectedServerId}/metrics/current`);
        const curMetric = curRes.data;
        const srvData = metaRef.current;

        if (!curMetric) {
          applySnapshot(fetchMockOverview(), 'simulated');
          return;
        }

        const formattedSnap = {
          cpu_usage: curMetric.cpu_usage || 0,
          ram_usage: curMetric.ram_usage || 0,
          disk_usage: curMetric.disk_usage || 0,
          ram_used_gb: ((curMetric.ram_usage || 0) * 0.16).toFixed(1),
          ram_total_gb: '16.0',
          disk_used_gb: ((curMetric.disk_usage || 0) * 5.0).toFixed(1),
          disk_total_gb: '500.0',
          net_sent_mb: curMetric.network_sent_mb || 0,
          net_recv_mb: curMetric.network_recv_mb || 0,
          process_count: curMetric.process_count || 0,
          cpu_per_core: (Array.isArray(curMetric.cpu_per_core) && curMetric.cpu_per_core.length > 0)
            ? curMetric.cpu_per_core
            : [curMetric.cpu_usage || 0, curMetric.cpu_usage || 0, curMetric.cpu_usage || 0, curMetric.cpu_usage || 0],
        };

        const serverOverview = {
          status: (curMetric.status || srvData?.status || 'HEALTHY').toUpperCase(),
          health_score: Math.max(0, Math.round(100 - (curMetric.cpu_usage * 0.4 + curMetric.ram_usage * 0.4 + curMetric.disk_usage * 0.2))),
          uptime_seconds: 86400,
          current: formattedSnap,
          live: formattedSnap,
        };

        applySnapshot(serverOverview, 'polling');
      }
    } catch (err) {
      if (err?.response?.status === 401) return;
      applySnapshot(fetchMockOverview(), 'simulated');
    }
  }, [selectedServerId, applySnapshot]);

  // Initial metadata and history load on server selection change
  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      setHistory([]);
      setCpuSeries([]);

      if (!selectedServerId || selectedServerId === 'local') {
        setServerMeta(null);
        metaRef.current = null;
      } else {
        try {
          const [srvRes, histRes] = await Promise.allSettled([
            api.get(`/servers/${selectedServerId}`),
            api.get(`/servers/${selectedServerId}/metrics/history`),
          ]);
          if (!active) return;
          if (srvRes.status === 'fulfilled') {
            setServerMeta(srvRes.value.data);
            metaRef.current = srvRes.value.data;
          }
          if (histRes.status === 'fulfilled' && Array.isArray(histRes.value.data) && histRes.value.data.length > 0) {
            setHistory(histRes.value.data.slice(-30));
          }
        } catch {
          // Ignore initial load error
        }
      }
      pollCurrentMetric();
    };

    loadInitialData();

    if (pollRef.current) clearInterval(pollRef.current);
    // Ultra-fast 1000ms polling for instant real-time updates
    pollRef.current = setInterval(pollCurrentMetric, 1000);

    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedServerId, pollCurrentMetric]);

  const handleServerChange = (e) => {
    const val = e.target.value;
    setSelectedServerId(val);
    if (val === 'local') {
      navigate('/dashboard');
    } else {
      navigate(`/servers/${val}/dashboard`);
    }
  };

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
    polling: { label: 'FAST STREAM · 1s', icon: Wifi, color: '#2bd97c' },
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
      {/* Header + Server Dropdown Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <ServerIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {serverMeta ? serverMeta.name : 'Local Engine Host'}
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                {serverMeta ? (serverMeta.environment || 'Remote') : 'Engine Host'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              {serverMeta ? (serverMeta.hostname || serverMeta.ip_address || 'Monitored Server') : 'Single-sampled real-time engine telemetry'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Server Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedServerId}
              onChange={handleServerChange}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="local">🖥️ Local Engine Host</option>
              {servers.map((srv) => (
                <option key={srv.id} value={srv.id}>
                  💻 {srv.name} ({srv.status.toUpperCase()})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          <div
            className="flex items-center space-x-2 px-3 py-1.5 rounded-full telemetry-panel"
            style={{ color: connectionMeta.color }}
          >
            <connectionMeta.icon className="w-3.5 h-3.5" />
            <span className="text-xs font-bold tracking-wide data-num">{connectionMeta.label}</span>
          </div>
        </div>
      </div>

      {connection === 'simulated' && (
        <div className="text-xs font-semibold text-[#ff5470] telemetry-panel rounded-xl px-4 py-2 data-num">
          Backend unreachable - showing simulated numbers. Check backend API connection.
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
              <Suspense fallback={<div className="h-48 flex items-center justify-center text-xs text-slate-500 font-mono">Initializing 3D Core...</div>}>
                <Server3DCube status={overview.status} healthScore={health_score} />
              </Suspense>
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
