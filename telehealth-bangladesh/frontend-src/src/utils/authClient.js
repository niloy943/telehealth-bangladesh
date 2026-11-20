/**
 * HealNSight Enterprise Token Refresh & Auth Interceptor
 * Transparently refreshes expired JWT access tokens using rotating refresh tokens,
 * preventing unexpected 401 session expiration cascades.
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(newToken) {
  refreshSubscribers.forEach(cb => cb(newToken));
  refreshSubscribers = [];
}

function onRefreshFailed() {
  refreshSubscribers.forEach(cb => cb(null));
  refreshSubscribers = [];
}

/**
 * Attempts to refresh the JWT access token using the stored refresh token.
 */
export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("tv_refresh");
  if (!refreshToken) {
    return null;
  }

  try {
    const resp = await fetch(`${API_BASE}/api/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
      _skipAuthInterceptor: true
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.access) {
        localStorage.setItem("tv_token", data.access);
        if (data.refresh) {
          localStorage.setItem("tv_refresh", data.refresh);
        }
        window.dispatchEvent(new CustomEvent('healnsight_token_refreshed', { detail: data.access }));
        return data.access;
      }
    } else {
      // Refresh token invalid, blacklisted, or expired
      localStorage.removeItem("tv_token");
      localStorage.removeItem("tv_refresh");
      window.dispatchEvent(new CustomEvent('healnsight_session_expired'));
      return null;
    }
  } catch (err) {
    console.warn("Token refresh network notice:", err);
    return null;
  }
}

/**
 * Installs global fetch interceptor to transparently retry 401s after refreshing the access token.
 */
export function setupAuthInterceptor() {
  if (typeof window === 'undefined' || window.__healnsight_auth_interceptor_installed) {
    return;
  }
  window.__healnsight_auth_interceptor_installed = true;

  const originalFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    // Check if internal bypass flag is set
    if (init && init._skipAuthInterceptor) {
      const cleanInit = { ...init };
      delete cleanInit._skipAuthInterceptor;
      return originalFetch.call(this, input, cleanInit);
    }

    const url = typeof input === 'string' ? input : (input?.url || '');
    const isAuthEndpoint = url.includes('/api/token/refresh/') ||
                           url.includes('/api/login/') ||
                           url.includes('/api/auth/register') ||
                           url.includes('/api/auth/login');

    const response = await originalFetch.call(this, input, init);

    // If request succeeded or is an authentication endpoint, return directly
    if (response.status !== 401 || isAuthEndpoint) {
      return response;
    }

    // 401 Unauthorized encountered: attempt silent token refresh
    const refreshToken = localStorage.getItem("tv_refresh");
    if (!refreshToken) {
      return response;
    }

    if (!isRefreshing) {
      isRefreshing = true;

      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (!newToken) {
        onRefreshFailed();
        return response;
      }

      onRefreshed(newToken);

      // Retry original request with new token
      const retryInit = { ...init };
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${newToken}`);
      retryInit.headers = headers;

      return originalFetch.call(this, input, retryInit);
    }

    // If refresh is already in flight, queue this request
    return new Promise((resolve) => {
      subscribeTokenRefresh(async (newToken) => {
        if (!newToken) {
          resolve(response);
          return;
        }

        const retryInit = { ...init };
        const headers = new Headers(init.headers || {});
        headers.set('Authorization', `Bearer ${newToken}`);
        retryInit.headers = headers;

        try {
          const retryRes = await originalFetch.call(window, input, retryInit);
          resolve(retryRes);
        } catch (err) {
          resolve(response);
        }
      });
    });
  };
}

