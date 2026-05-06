// Runtime environment configuration
// In production (on VPS), Nginx proxies /api/ and /socket.io/ to the backend.
// Leave VITE_API_URL as empty string so all API calls use relative URLs
// (e.g. /api/tasks) which Nginx then proxies to http://127.0.0.1:3000.
//
// To point to a different backend, set:
//   window.VITE_API_URL = 'https://api.yourdomain.com';

window.VITE_API_URL = '';
window.VITE_SOCKET_URL = '';
