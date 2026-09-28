export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'API_REQ' | 'API_RES' | 'API_ERR' | 'SYSTEM' | 'EMAIL_OTP';
  message: string;
  details?: any;
}

const logHistory: LogEntry[] = [];
const listeners: Array<(logs: LogEntry[]) => void> = [];

export const addLog = (
  type: LogEntry['type'],
  message: string,
  details?: any
) => {
  const entry: LogEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toLocaleTimeString(),
    type,
    message,
    details,
  };
  logHistory.unshift(entry);
  if (logHistory.length > 100) {
    logHistory.pop();
  }
  listeners.forEach((fn) => fn([...logHistory]));
};

export const getLogs = (): LogEntry[] => [...logHistory];

export const subscribeLogs = (fn: (logs: LogEntry[]) => void) => {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx !== -1) listeners.splice(idx, 1);
  };
};

export const clearLogs = () => {
  logHistory.length = 0;
  listeners.forEach((fn) => fn([]));
};
