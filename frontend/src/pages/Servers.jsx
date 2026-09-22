import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Plus,
  Activity,
  Key,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Terminal,
  Shield,
} from 'lucide-react';
import {
  fetchServers,
  createServer,
  deleteServer,
  regenerateServerKey,
} from '../api/serverApi';

export default function Servers() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerHostname, setNewServerHostname] = useState('');
  const [newServerIp, setNewServerIp] = useState('');
  const [newServerEnv, setNewServerEnv] = useState('Production');
  const [creating, setCreating] = useState(false);

  // Created/Regenerated Key Modal
  const [createdResult, setCreatedResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const navigate = useNavigate();
  const backendUrl = `${window.location.protocol}//${window.location.hostname}:8000`;

  const loadServers = async () => {
    setLoading(true);
    try {
      const data = await fetchServers();
      setServers(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch server fleet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleCreateServer = async (e) => {
    e.preventDefault();
    if (!newServerName.trim()) return;
    setCreating(true);
    try {
      const res = await createServer({
        name: newServerName.trim(),
        hostname: newServerHostname.trim() || undefined,
        ip_address: newServerIp.trim() || undefined,
        environment: newServerEnv,
      });
      setIsAddModalOpen(false);
      setNewServerName('');
      setNewServerHostname('');
      setNewServerIp('');
      setNewServerEnv('Production');
      setCreatedResult({
        name: res.name,
        apiKey: res.api_key,
      });
      await loadServers();
    } catch (err) {
      alert('Failed to register server: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteServer = async (serverId, serverName) => {
    if (!window.confirm(`Are you sure you want to delete server "${serverName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteServer(serverId);
      await loadServers();
    } catch (err) {
      alert('Failed to delete server: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRegenerateKey = async (serverId, serverName) => {
    if (!window.confirm(`Regenerating API key for "${serverName}" will disconnect any active agent using the old key. Continue?`)) {
      return;
    }
    try {
      const res = await regenerateServerKey(serverId);
      setCreatedResult({
        name: res.name,
        apiKey: res.api_key,
      });
    } catch (err) {
      alert('Failed to regenerate key: ' + (err.response?.data?.detail || err.message));
    }
  };

  const copyToClipboard = (text, setCopiedState) => {
    navigator.clipboard.writeText(text);
    setCopiedState(true);
    setTimeout(() => setCopiedState(false), 2000);
  };

  const getStatusBadge = (status) => {
    const s = (status || 'offline').toLowerCase();
    if (s === 'online' || s === 'healthy') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Online
        </span>
      );
    }
    if (s === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Warning
        </span>
      );
    }
    if (s === 'critical') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          Critical
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
        Offline
      </span>
    );
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="h-7 w-7 text-indigo-500" />
            Monitored Servers
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Register and manage host servers, install monitoring agents, and inspect per-server metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadServers}
            className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Refresh Fleet"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Server
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading && servers.length === 0 ? (
        <div className="flex justify-center items-center h-48 text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 dark:text-rose-400 text-sm">
          {error}
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
          <Server className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No servers registered yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-6">
            Register your first host server to generate an API key and install the lightweight monitoring agent.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((srv) => (
            <div
              key={srv.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {srv.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {srv.hostname || 'No Hostname'} {srv.ip_address ? `(${srv.ip_address})` : ''}
                    </p>
                  </div>
                  {getStatusBadge(srv.status)}
                </div>

                <div className="space-y-2 my-4 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">OS Info:</span>
                    <span className="font-medium truncate max-w-[180px]">{srv.os_info || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Seen:</span>
                    <span className="font-medium">
                      {srv.last_seen ? new Date(srv.last_seen).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => navigate(`/servers/${srv.id}/dashboard`)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold rounded-lg transition-colors"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Dashboard
                </button>
                <button
                  onClick={() => handleRegenerateKey(srv.id, srv.name)}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Regenerate API Key"
                >
                  <Key className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteServer(srv.id, srv.name)}
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                  title="Delete Server"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Server Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-500" />
              Register New Server
            </h3>
            <form onSubmit={handleCreateServer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Server Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Web DB-01"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Hostname (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. web01.mydomain.com"
                  value={newServerHostname}
                  onChange={(e) => setNewServerHostname(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  IP Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.100"
                  value={newServerIp}
                  onChange={(e) => setNewServerIp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Environment
                </label>
                <select
                  value={newServerEnv}
                  onChange={(e) => setNewServerEnv(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-200"
                >
                  <option value="Production">Production</option>
                  <option value="Staging">Staging</option>
                  <option value="Development">Development</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {creating ? 'Registering...' : 'Register Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API Key & Agent Installation Modal */}
      {createdResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-500" />
                API Key Created for &quot;{createdResult.name}&quot;
              </h3>
            </div>

            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Important:</strong> Copy this API key now. For security reasons, it will never be displayed again.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Server API Key:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdResult.apiKey}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-indigo-600 dark:text-indigo-400 select-all"
                />
                <button
                  onClick={() => copyToClipboard(createdResult.apiKey, setCopiedKey)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedKey ? 'Copied' : 'Copy Key'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-indigo-500" />
                One-Line Agent Install & Run Command:
              </label>
              <div className="relative">
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-slate-800">
                  {`curl -O ${backendUrl}/agent/shp_agent.py && python3 shp_agent.py --server-url ${backendUrl} --api-key ${createdResult.apiKey}`}
                </pre>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `curl -O ${backendUrl}/agent/shp_agent.py && python3 shp_agent.py --server-url ${backendUrl} --api-key ${createdResult.apiKey}`,
                      setCopiedCmd
                    )
                  }
                  className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1"
                  title="Copy Command"
                >
                  {copiedCmd ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setCreatedResult(null)}
                className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold rounded-xl shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
