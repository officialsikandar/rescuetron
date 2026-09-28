// Config for React Native / Expo Mobile App connecting to Express / Node Server

// PRODUCTION RENDER SERVER URL
export const RENDER_SERVER_URL = 'https://rescuetron.onrender.com/api';

// PUBLIC SHARED APP BACKEND URL FALLBACK
export const SHARED_SERVER_URL = RENDER_SERVER_URL;

let customApiUrl: string | null = null;

export const setCustomApiUrl = (url: string) => {
  let formatted = url.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `http://${formatted}`;
  }
  if (!formatted.endsWith('/api')) {
    formatted = `${formatted.replace(/\/$/, '')}/api`;
  }
  customApiUrl = formatted;
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('RESCUETRON_CUSTOM_API_URL', formatted);
  }
};

export const getBaseUrl = (): string => {
  if (customApiUrl) {
    return customApiUrl;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem('RESCUETRON_CUSTOM_API_URL');
    if (saved) {
      customApiUrl = saved;
      return saved;
    }
  }

  // Check Expo Environment Variable
  if (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Web Browser Preview
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    if (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')) {
      return 'http://localhost:3000/api';
    }
    if (window.location.origin.includes('ais-dev-') || window.location.origin.includes('ais-pre-')) {
      return RENDER_SERVER_URL;
    }
    return `${window.location.origin}/api`;
  }

  // Default to Production Render Backend
  return RENDER_SERVER_URL;
};

export const API_BASE_URL = getBaseUrl();
