// Fallback Live Metrics Simulator - used only if the backend/websocket is
// genuinely unreachable (e.g. network error, backend down), so the
// dashboard never renders a blank screen silently. The UI clearly flags
// this as SIMULATED (see ConnectionBadge). This must NEVER be used to mask
// an expired/invalid auth token - that case is handled globally by the
// axios response interceptor in api.js, which redirects to /login instead.
export const fetchMockOverview = () => {
  const cpu = +(20 + Math.random() * 35).toFixed(1);
  const ram = +(45 + Math.random() * 20).toFixed(1);
  const disk = 62.4;
  const status = cpu > 80 ? 'CRITICAL' : cpu > 60 ? 'WARNING' : 'HEALTHY';
  const cores = Array.from({ length: 8 }, () => +(cpu + (Math.random() * 20 - 10)).toFixed(1));
  const now = new Date().toISOString();

  const current = {
    id: Date.now(),
    timestamp: now,
    cpu_usage: cpu,
    ram_usage: ram,
    disk_usage: disk,
    network_sent_mb: +(12.4 + Math.random() * 4).toFixed(1),
    network_recv_mb: +(45.2 + Math.random() * 12).toFixed(1),
    process_count: Math.floor(140 + Math.random() * 15),
    status
  };

  return {
    current,
    live: {
      timestamp: now,
      cpu_usage: cpu,
      cpu_per_core: cores,
      ram_usage: ram,
      ram_used_gb: +(ram / 100 * 16).toFixed(2),
      ram_total_gb: 16,
      disk_usage: disk,
      disk_used_gb: +(disk / 100 * 512).toFixed(2),
      disk_total_gb: 512,
      disk_read_mbps: +(Math.random() * 5).toFixed(2),
      disk_write_mbps: +(Math.random() * 3).toFixed(2),
      network_sent_mbps: +(Math.random() * 2).toFixed(2),
      network_recv_mbps: +(Math.random() * 6).toFixed(2),
      network_sent_total_mb: current.network_sent_mb,
      network_recv_total_mb: current.network_recv_mb,
      process_count: current.process_count,
      load_avg: [1.2, 1.0, 0.9],
      top_processes: [],
      status
    },
    health_score: +(100 - (cpu * 0.4 + ram * 0.4)).toFixed(1),
    status,
    uptime_seconds: 142500
  };
};
