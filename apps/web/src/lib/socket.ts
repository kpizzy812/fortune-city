const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Socket.IO needs the raw server URL, not the /api prefix.
 * In production API_URL is '/api' (nginx rewrites), but sockets
 * go through '/socket.io/' which nginx proxies directly to the API.
 * In dev API_URL is 'http://localhost:3001' — use as-is.
 */
export const WS_BASE_URL = API_URL.startsWith('/') ? '' : API_URL;
