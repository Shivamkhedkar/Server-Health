import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Clears the stale session and sends the user back to /login with an
// explicit message. Shared by the axios 401 interceptor below AND the
// metrics websocket's close handler (Dashboard.jsx) - a websocket auth
// rejection doesn't go through axios, but it's the same underlying
// "your session is no longer valid" situation and deserves the same
// response instead of silently freezing the live charts.
export function handleAuthFailure(message = 'Your session has expired. Please log in again.') {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
  if (window.location.pathname !== '/login') {
    sessionStorage.setItem('authMessage', message);
    window.location.href = '/login';
  }
}

// Access tokens are short-lived (30 min default - see backend
// ACCESS_TOKEN_EXPIRE_MINUTES) so that a leaked token doesn't stay useful
// for long. Rather than forcing a full re-login every time one expires,
// a single 401 triggers one attempt to silently exchange the refresh
// token (obtained at login, POST /auth/refresh) for a new access token
// and retries the original request. If the refresh token is itself
// missing/expired/invalid, that call gets its own 401, which is treated
// as a real session-expired event instead of retried recursively.
let refreshPromise = null;

async function getNewAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then((res) => {
        localStorage.setItem('token', res.data.access_token);
        return res.data.access_token;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response && error.response.status === 401 && !original?._retried && !original?.url?.includes('/auth/')) {
      original._retried = true;
      const newToken = await getNewAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      handleAuthFailure();
    } else if (error.response && error.response.status === 401 && original?.url?.includes('/auth/refresh')) {
      handleAuthFailure();
    }
    return Promise.reject(error);
  }
);

export default api;
