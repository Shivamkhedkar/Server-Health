"""
Central real-time metrics collector.

Why this exists:
  Previously, both the `/metrics/overview` REST endpoint AND the `/metrics/ws`
  websocket independently called `psutil.cpu_percent(interval=None)` on every
  request. psutil's non-blocking cpu_percent() measures the delta *since the
  last call*. When two different code paths call it concurrently and at
  different rates, each call resets the other's measurement window, producing
  inconsistent / jumpy numbers - which is why the dashboard, the REST route,
  and Task Manager could all disagree.

  This module samples the system exactly ONCE per second, from a single
  background task, and caches the result. Every endpoint and every websocket
  client reads the same cached snapshot, so all real-time numbers are
  internally consistent.

  It also fixes a real bug: the old code reported cumulative network bytes
  (since boot) as if it were a "MB/s" rate. This module computes true
  per-second throughput (and disk I/O throughput) from deltas.

Note on Docker: if this backend runs inside a Docker container (see
docker-compose.yml), psutil reports the container's / VM's view of CPU and
memory - not your physical host. On Linux Docker this is usually close to
host numbers. On Docker Desktop (Windows/Mac), the engine runs inside a
lightweight Linux VM, so CPU/RAM % will legitimately differ from Windows
Task Manager. For host-accurate numbers, run the backend natively
(uvicorn app.main:app) instead of via Docker.
"""

import asyncio
import logging
import os
import time
from collections import deque
from typing import Optional

import psutil

logger = logging.getLogger("devops_monitor.collector")

SAMPLE_INTERVAL_SECONDS = 1.0
PERSIST_EVERY_N_SAMPLES = 5  # write to DB every ~5s instead of every second
HISTORY_BUFFER_SIZE = 120  # in-memory ring buffer (~2 min at 1s sampling)


class MetricsCollector:
    def __init__(self):
        self.snapshot: Optional[dict] = None
        self.recent: deque = deque(maxlen=HISTORY_BUFFER_SIZE)
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self._sample_count = 0

        self._prev_net = None
        self._prev_disk = None
        self._prev_time = None
        self._persist_cb = None

    def set_persist_callback(self, cb):
        """cb(snapshot: dict) -> None, called every PERSIST_EVERY_N_SAMPLES samples."""
        self._persist_cb = cb

    async def start(self):
        if self._running:
            return
        self._running = True
        # Prime psutil's internal counters so the first real sample is accurate
        psutil.cpu_percent(percpu=True)
        for p in psutil.process_iter():
            try:
                p.cpu_percent(None)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        self._prev_net = psutil.net_io_counters()
        try:
            self._prev_disk = psutil.disk_io_counters()
        except Exception:
            self._prev_disk = None
        self._prev_time = time.time()

        self._task = asyncio.create_task(self._loop())
        logger.info("MetricsCollector started (sampling every %ss)", SAMPLE_INTERVAL_SECONDS)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass

    async def _loop(self):
        loop = asyncio.get_event_loop()
        while self._running:
            try:
                self._sample()
                self._sample_count += 1
                if self._persist_cb and self._sample_count % PERSIST_EVERY_N_SAMPLES == 0:
                    # Run the persist callback (DB write + threshold check +
                    # any outbound email/Telegram alert dispatch) in a worker
                    # thread rather than calling it inline. It used to be
                    # called directly here, on the same asyncio event loop
                    # that also serves the /metrics/ws stream and every other
                    # request - so a slow/unreachable SMTP server or Telegram
                    # API (each with its own several-second timeout) would
                    # stall metrics sampling and every connected websocket
                    # client for as long as the network call hung.
                    try:
                        await loop.run_in_executor(None, self._persist_cb, self.snapshot)
                    except Exception:
                        logger.exception("persist callback failed")
            except Exception:
                logger.exception("metrics sampling failed")
            await asyncio.sleep(SAMPLE_INTERVAL_SECONDS)

    def _sample(self):
        now = time.time()
        dt = max(now - (self._prev_time or now), 0.001)

        cpu_per_core = psutil.cpu_percent(percpu=True)
        cpu_usage = round(sum(cpu_per_core) / max(len(cpu_per_core), 1), 1)

        vm = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        net = psutil.net_io_counters()
        sent_rate_mbps = round(max(0, net.bytes_sent - self._prev_net.bytes_sent) / dt / (1024 * 1024), 3)
        recv_rate_mbps = round(max(0, net.bytes_recv - self._prev_net.bytes_recv) / dt / (1024 * 1024), 3)

        read_rate_mbps = write_rate_mbps = 0.0
        try:
            diskio = psutil.disk_io_counters()
            if diskio and self._prev_disk:
                read_rate_mbps = round(max(0, diskio.read_bytes - self._prev_disk.read_bytes) / dt / (1024 * 1024), 3)
                write_rate_mbps = round(
                    max(0, diskio.write_bytes - self._prev_disk.write_bytes) / dt / (1024 * 1024), 3
                )
            self._prev_disk = diskio
        except Exception:
            pass

        try:
            load_avg = list(os.getloadavg())
        except (AttributeError, OSError):
            load_avg = [0.0, 0.0, 0.0]

        top_processes = []
        try:
            procs = []
            for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
                info = p.info
                if info.get("cpu_percent") is None:
                    continue
                procs.append(info)
            procs.sort(key=lambda i: i.get("cpu_percent") or 0, reverse=True)
            top_processes = [
                {
                    "pid": p["pid"],
                    "name": (p.get("name") or "?")[:32],
                    "cpu_percent": round(p.get("cpu_percent") or 0, 1),
                    "memory_percent": round(p.get("memory_percent") or 0, 1),
                }
                for p in procs[:6]
            ]
        except Exception:
            pass

        status = "HEALTHY"
        if cpu_usage > 85.0 or vm.percent > 90.0 or disk.percent > 90.0:
            status = "CRITICAL"
        elif cpu_usage > 70.0 or vm.percent > 75.0 or disk.percent > 80.0:
            status = "WARNING"

        self.snapshot = {
            "timestamp": now,
            "cpu_usage": cpu_usage,
            "cpu_per_core": [round(c, 1) for c in cpu_per_core],
            "ram_usage": round(vm.percent, 1),
            "ram_used_gb": round(vm.used / (1024**3), 2),
            "ram_total_gb": round(vm.total / (1024**3), 2),
            "disk_usage": round(disk.percent, 1),
            "disk_used_gb": round(disk.used / (1024**3), 2),
            "disk_total_gb": round(disk.total / (1024**3), 2),
            "disk_read_mbps": read_rate_mbps,
            "disk_write_mbps": write_rate_mbps,
            "network_sent_mbps": sent_rate_mbps,
            "network_recv_mbps": recv_rate_mbps,
            "network_sent_total_mb": round(net.bytes_sent / (1024 * 1024), 1),
            "network_recv_total_mb": round(net.bytes_recv / (1024 * 1024), 1),
            "process_count": len(psutil.pids()),
            "load_avg": load_avg,
            "top_processes": top_processes,
            "status": status,
        }
        self.recent.append(self.snapshot)

        self._prev_net = net
        self._prev_time = now


# Single shared instance used across the whole app
collector = MetricsCollector()
