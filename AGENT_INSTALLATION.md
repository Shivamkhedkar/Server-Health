# Monitoring Agent Installation & Configuration Guide

This guide explains how to install and configure the **Server Health Monitoring Agent (`shp_agent.py`)** on Linux and Windows servers.

---

## 📋 Prerequisites

- **Python 3.8+** installed on target server.
- `psutil` and `requests` Python packages.
- Outbound HTTP/HTTPS network access to your backend API server (default port `8000`).

---

## 🚀 Step 1: Register Server & Generate API Key

1. Log in to the DevOps Monitor Pro web dashboard as an authorized user.
2. Navigate to **My Servers** (`/servers`) in the navigation sidebar.
3. Click **Add New Server**.
4. Enter the **Server Name**, **Hostname/IP**, and **Environment** (e.g. `Production`, `Staging`, `Development`).
5. Click **Create Server**.
6. Copy the generated **Server API Key** (e.g., `srv_sec_1a2b3c4d5e6f...`).

---

## 💻 Step 2: Agent Installation

### Option A: Windows Server Installation

1. Create directory `C:\Program Files\DevOpsAgent`.
2. Copy `agent/shp_agent.py` into `C:\Program Files\DevOpsAgent\shp_agent.py`.
3. Open PowerShell as Administrator and install requirements:
   ```powershell
   pip install psutil requests
   ```
4. Test run the agent manually:
   ```powershell
   python "C:\Program Files\DevOpsAgent\shp_agent.py" --server-url http://YOUR_BACKEND_IP:8000 --api-key srv_sec_YOUR_API_KEY
   ```

---

### Option B: Linux Server Installation (systemd Daemon)

1. Create installation directory:
   ```bash
   sudo mkdir -p /opt/devops-agent
   sudo cp agent/shp_agent.py /opt/devops-agent/shp_agent.py
   ```
2. Install Python dependencies:
   ```bash
   sudo pip3 install psutil requests
   ```
3. Create systemd service file `/etc/systemd/system/devops-agent.service`:
   ```ini
   [Unit]
   Description=DevOps Server Health Monitoring Agent
   After=network.target

   [Service]
   Type=simple
   User=root
   ExecStart=/usr/bin/python3 /opt/devops-agent/shp_agent.py --server-url http://YOUR_BACKEND_IP:8000 --api-key srv_sec_YOUR_API_KEY
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
4. Enable and start service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable devops-agent
   sudo systemctl start devops-agent
   ```
5. Check agent status:
   ```bash
   sudo systemctl status devops-agent
   ```

---

## 🛡️ Security Best Practices

- Always run the backend behind HTTPS/TLS (Nginx/Reverse Proxy) in production deployments.
- Never commit Server API Keys to public Git repositories.
- Restrict agent API key scope so an agent key can only submit metrics for its assigned server ID.
