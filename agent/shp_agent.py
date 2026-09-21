#!/usr/bin/env python3
"""
Server Health Platform (SHP) Lightweight Monitoring Agent
Single-file Python daemon to collect and push host metrics to SHP Server.
"""
import argparse
import json
import logging
import os
import platform
import socket
import sys
import time
import uuid
import urllib.error
import urllib.request
from typing import List, Dict, Any

try:
    import psutil
except ImportError:
    psutil = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("shp_agent")

BUFFER_FILE = ".shp_agent_buffer.json"


class SHPAgent:
    def __init__(
        self,
        server_url: str,
        api_key: str,
        interval: int = 5,
        max_buffer_size: int = 100,
    ):
        self.server_url = server_url.rstrip("/")
        self.api_key = api_key
        self.interval = interval
        self.max_buffer_size = max_buffer_size
        self.buffer: List[Dict[str, Any]] = self._load_disk_buffer()
        self.ingest_endpoint = f"{self.server_url}/api/agent/ingest"

    def _load_disk_buffer(self) -> List[Dict[str, Any]]:
        if os.path.exists(BUFFER_FILE):
            try:
                with open(BUFFER_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        logger.info("Loaded %d unsent metric sample(s) from persistent disk buffer.", len(data))
                        return data
            except Exception as exc:
                logger.warning("Could not read disk buffer file: %s", exc)
        return []

    def _save_disk_buffer(self) -> None:
        try:
            with open(BUFFER_FILE, "w", encoding="utf-8") as f:
                json.dump(self.buffer, f)
        except Exception as exc:
            logger.warning("Could not persist buffer to disk: %s", exc)

    def collect_metrics(self) -> Dict[str, Any]:
        if not psutil:
            raise RuntimeError("psutil library is required for shp_agent. Install with: pip install psutil")

        vm = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        net = psutil.net_io_counters()
        mac_addr = ":".join([f"{(uuid.getnode() >> i) & 0xff:02x}" for i in range(0, 48, 8)][::-1])
        uptime_sec = round(time.time() - psutil.boot_time(), 1)

        return {
            "cpu_usage": round(psutil.cpu_percent(interval=0.5), 1),
            "ram_usage": round(vm.percent, 1),
            "disk_usage": round(disk.percent, 1),
            "network_sent_mb": round(net.bytes_sent / (1024 * 1024), 2),
            "network_recv_mb": round(net.bytes_recv / (1024 * 1024), 2),
            "process_count": len(psutil.pids()),
            "hostname": socket.gethostname(),
            "os_info": f"{platform.system()} {platform.release()}",
            "mac_address": mac_addr,
            "uptime_seconds": uptime_sec,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def send_payload(self, payload: Dict[str, Any]) -> bool:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.ingest_endpoint,
            data=data,
            headers={
                "Content-Type": "application/json",
                "X-API-Key": self.api_key,
                "User-Agent": "SHPAgent/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if 200 <= resp.status < 300:
                    return True
                logger.warning("Server returned HTTP status %d", resp.status)
                return False
        except urllib.error.HTTPError as exc:
            logger.warning("HTTP error posting metrics: %d %s", exc.code, exc.reason)
            return False
        except Exception as exc:
            logger.warning("Network error posting metrics: %s", exc)
            return False

    def buffer_payload(self, payload: Dict[str, Any]) -> None:
        if len(self.buffer) >= self.max_buffer_size:
            self.buffer.pop(0)  # Evict oldest metric sample
        self.buffer.append(payload)
        self._save_disk_buffer()

    def flush_buffer(self) -> int:
        flushed = 0
        while self.buffer:
            sample = self.buffer[0]
            if self.send_payload(sample):
                self.buffer.pop(0)
                flushed += 1
            else:
                break
        self._save_disk_buffer()
        return flushed

    def run_once(self) -> bool:
        sample = self.collect_metrics()
        if self.send_payload(sample):
            if self.buffer:
                self.flush_buffer()
            logger.info("Successfully pushed metric snapshot to %s", self.server_url)
            return True
        else:
            self.buffer_payload(sample)
            logger.warning("Buffered metric snapshot (buffer depth: %d)", len(self.buffer))
            return False

    def run_forever(self) -> None:
        logger.info("Starting SHP Agent monitoring loop (interval=%ds, server=%s)...", self.interval, self.server_url)
        backoff = 0
        while True:
            try:
                success = self.run_once()
                if success:
                    backoff = 0
                    time.sleep(self.interval)
                else:
                    backoff = min(60, backoff * 2 if backoff > 0 else 2)
                    logger.info("Retrying in %d seconds (exponential backoff)...", backoff)
                    time.sleep(backoff)
            except KeyboardInterrupt:
                logger.info("Agent stopped by user signal.")
                break
            except Exception as exc:
                logger.error("Unexpected error in agent loop: %s", exc)
                time.sleep(self.interval)


def main():
    parser = argparse.ArgumentParser(description="SHP Server Monitoring Agent")
    parser.add_argument(
        "--server-url",
        default=os.getenv("SHP_SERVER_URL", "http://localhost:8000"),
        help="SHP Server Base URL",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("SHP_API_KEY", ""),
        help="SHP Server API Key (shp_...)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=int(os.getenv("SHP_INTERVAL", "5")),
        help="Collection interval in seconds (default: 5)",
    )
    parser.add_argument("--once", action="store_true", help="Run collection once and exit")

    args = parser.parse_args()

    if not args.api_key:
        logger.error("API key is required. Specify via --api-key or SHP_API_KEY env var.")
        sys.exit(1)

    agent = SHPAgent(server_url=args.server_url, api_key=args.api_key, interval=args.interval)

    if args.once:
        success = agent.run_once()
        sys.exit(0 if success else 1)
    else:
        agent.run_forever()


if __name__ == "__main__":
    main()
