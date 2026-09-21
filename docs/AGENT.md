# Server Health Platform Agent (`shp_agent.py`)

## Overview
`shp_agent.py` is a lightweight, single-file Python daemon that collects host system telemetry (CPU, RAM, Disk, Uptime, Processes, OS metadata) and transmits metrics to the Server Health Platform over HTTP(S).

## Quick Start / Installation

### Prerequisites
- Python 3.8+
- `psutil` library (`pip install psutil`)

### One-Line Install & Run
```bash
curl -O http://<YOUR_SHP_SERVER>:8000/agent/shp_agent.py
pip install psutil
python3 shp_agent.py --server-url http://<YOUR_SHP_SERVER>:8000 --api-key shp_a1b2c3d4e5f6...
```

### Environment Variables
- `SHP_SERVER_URL`: Base URL of the Server Health Platform backend (e.g. `http://localhost:8000`)
- `SHP_API_KEY`: Server API key (`shp_...`)
- `SHP_INTERVAL`: Ingestion interval in seconds (default: `10`)

### Command Line Flags
- `--server-url`: Server Base URL
- `--api-key`: API key (`shp_...`)
- `--interval`: Collection interval (seconds)
- `--once`: Collect metrics once and exit

## Key Capabilities & Security
1. **Offline Metric Buffering**: If network connection to SHP Server is temporarily interrupted, `shp_agent.py` buffers up to 100 metric snapshots in memory.
2. **Exponential Backoff**: Reconnect attempts use backoff to prevent flooding when network recovers.
3. **API Key Authentication**: Ingestion requests send `X-API-Key` headers. Secrets are stored hashed on the server side (SHA-256).
