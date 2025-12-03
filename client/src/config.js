// API configuration
// In development (vite dev server), use relative paths (proxy handles it)
// In production/Electron, use the actual server URL

const isElectron = typeof window !== 'undefined' && window.process?.type === 'renderer';
const isDev = import.meta.env.DEV;

// Set your production server URL here
const PRODUCTION_API_URL = import.meta.env.VITE_API_URL || 'https://corpomessenger-production.up.railway.app';

export const API_URL = isDev && !isElectron ? '' : PRODUCTION_API_URL;
export const SOCKET_URL = isDev && !isElectron ? undefined : PRODUCTION_API_URL;
