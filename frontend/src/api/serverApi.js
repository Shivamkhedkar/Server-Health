import api from './api';

export async function fetchServers() {
  const res = await api.get('/servers');
  return res.data;
}

export async function createServer(payload) {
  const res = await api.post('/servers', payload);
  return res.data;
}

export async function fetchServer(serverId) {
  const res = await api.get(`/servers/${serverId}`);
  return res.data;
}

export async function updateServer(serverId, payload) {
  const res = await api.patch(`/servers/${serverId}`, payload);
  return res.data;
}

export async function deleteServer(serverId) {
  await api.delete(`/servers/${serverId}`);
}

export async function regenerateServerKey(serverId) {
  const res = await api.post(`/servers/${serverId}/regenerate-key`);
  return res.data;
}

export async function fetchServerSettings(serverId) {
  const res = await api.get(`/servers/${serverId}/settings`);
  return res.data;
}

export async function updateServerSettings(serverId, payload) {
  const res = await api.put(`/servers/${serverId}/settings`, payload);
  return res.data;
}

export async function fetchServerMetricsCurrent(serverId) {
  const res = await api.get(`/servers/${serverId}/metrics/current`);
  return res.data;
}

export async function fetchServerMetricsHistory(serverId, hours = 24) {
  const res = await api.get(`/servers/${serverId}/metrics/history?hours=${hours}`);
  return res.data;
}

export async function fetchServerAlerts(serverId) {
  const res = await api.get(`/servers/${serverId}/alerts`);
  return res.data;
}

export async function fetchNotificationPrefs() {
  const res = await api.get('/notifications/prefs');
  return res.data;
}

export async function updateNotificationPrefs(payload) {
  const res = await api.put('/notifications/prefs', payload);
  return res.data;
}

export async function generateTelegramLinkCode() {
  const res = await api.post('/notifications/telegram/link-code');
  return res.data;
}
