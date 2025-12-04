// API configuration
// In development (vite dev server), use relative paths (proxy handles it)
// In production/Electron, use the actual server URL

const isElectron = typeof window !== 'undefined' && window.process?.type === 'renderer';
const isDev = import.meta.env.DEV;

// In web production, use relative paths (same origin)
// In Electron, use the full URL
const PRODUCTION_API_URL = import.meta.env.VITE_API_URL || 'https://touch.up.railway.app';

// For web: empty string (same origin), for Electron: full URL
export const API_URL = isElectron ? PRODUCTION_API_URL : (isDev ? '' : '');
export const SOCKET_URL = isElectron ? PRODUCTION_API_URL : undefined;
