/**
 * Environment configuration
 * Reads from window environment variables (set by env-config.js)
 * Falls back to import.meta.env variables (set during build time)
 * Falls back to development defaults
 */

declare global {
  interface Window {
    VITE_API_URL?: string;
    VITE_SOCKET_URL?: string;
  }
}

export const getApiUrl = (): string => {
  // First check runtime-injected environment variables (set in public/env-config.js)
  if (window.VITE_API_URL) {
    return window.VITE_API_URL;
  }

  // Then check build-time environment variables
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // On local development: hit backend directly (Vite dev server also proxies /api/)
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000';
    }
  }

  // On production (live VPS): return '' so axios uses relative URLs like /api/tasks/...
  // Nginx will proxy /api/ and /socket.io/ to http://127.0.0.1:3000
  return '';
};

export const getSocketUrl = (): string => {
  // First check runtime-injected environment variables
  if (window.VITE_SOCKET_URL) {
    return window.VITE_SOCKET_URL;
  }

  // Then check build-time environment variables
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  // Default based on API URL (convert http->ws or https->wss)
  const apiUrl = getApiUrl();
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    return apiUrl.replace('http://', 'ws://');
  }

  // Final fallback for development (backend runs on port 3000 by default)
  return 'http://localhost:3000';
};

export default {
  apiUrl: getApiUrl(),
  socketUrl: getSocketUrl(),
};
