import { getBaseUrl } from '../config';
import { addLog } from './logger';

export type WsEventListener = (data: any) => void;

let socket: WebSocket | null = null;
let isConnected = false;
const listeners: Set<WsEventListener> = new Set();
let reconnectTimer: any = null;
let retryCount = 0;
const MAX_RETRIES = 3;

export const getWsUrl = (): string => {
  const baseUrl = getBaseUrl();
  let wsUrl = baseUrl.replace('/api', '').replace(/\/$/, '');
  if (wsUrl.startsWith('https://')) {
    wsUrl = wsUrl.replace('https://', 'wss://');
  } else if (wsUrl.startsWith('http://')) {
    wsUrl = wsUrl.replace('http://', 'ws://');
  } else {
    wsUrl = `ws://${wsUrl}`;
  }
  return `${wsUrl}/ws`;
};

export const initWebSocket = (): WebSocket | null => {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket;
  }

  if (retryCount >= MAX_RETRIES) {
    // Vercel serverless functions do not support persistent WebSockets
    return null;
  }

  const url = getWsUrl();
  addLog('SYSTEM', `Connecting WebSocket to ${url}...`);

  try {
    socket = new WebSocket(url);

    socket.onopen = () => {
      isConnected = true;
      retryCount = 0;
      addLog('SYSTEM', `⚡ WebSocket Connected to ${url}`);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        addLog('SYSTEM', `WS Received: ${parsed.type || 'EVENT'}`, parsed);
        listeners.forEach((fn) => fn(parsed));
      } catch (err) {
        // raw text
        addLog('SYSTEM', `WS Received Raw: ${event.data}`);
      }
    };

    socket.onerror = (error) => {
      addLog('API_ERR', `WebSocket Error on ${url}`, error);
    };

    socket.onclose = () => {
      isConnected = false;
      retryCount++;
      socket = null;
      if (retryCount < MAX_RETRIES && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          initWebSocket();
        }, 5000);
      }
    };

    return socket;
  } catch (e: any) {
    retryCount++;
    addLog('API_ERR', `Failed to initialize WebSocket: ${e.message}`);
    return null;
  }
};

export const sendWsMessage = (type: string, payload: any) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    initWebSocket();
  }
  if (socket && socket.readyState === WebSocket.OPEN) {
    const data = JSON.stringify({ type, ...payload });
    socket.send(data);
    addLog('SYSTEM', `WS Sent: ${type}`, payload);
  } else {
    addLog('API_ERR', `Cannot send WS ${type}: Socket not open`);
  }
};

export const subscribeWs = (listener: WsEventListener) => {
  listeners.add(listener);
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    initWebSocket();
  }
  return () => {
    listeners.delete(listener);
  };
};

export const getWsStatus = () => isConnected;
