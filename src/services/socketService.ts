type SocketListener = (event: {
  type: string;
  alertId?: string;
  alert?: any;
  settings?: any;
  contacts?: any;
  user?: any;
  source?: string;
}) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private listeners: Set<SocketListener> = new Set();
  private reconnectTimer: any = null;
  private isConnecting = false;
  private retryCount = 0;
  private maxRetries = 3;

  connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.isConnecting) return;
    if (this.retryCount >= this.maxRetries) {
      // Serverless host (Vercel) does not support persistent WebSockets
      return;
    }

    this.isConnecting = true;

    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProtocol}//${wsHost}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.retryCount = 0;
        console.log('⚡ [Real-Time WebSocket] Connected to Rescuetron Live Hub at', wsUrl);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.listeners.forEach((cb) => cb(payload));
        } catch (e) {
          // ignore
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        this.retryCount++;
        if (this.retryCount < this.maxRetries && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 5000);
        }
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (err) {
      this.isConnecting = false;
      this.retryCount++;
    }
  }

  subscribe(listener: SocketListener) {
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const socketService = new SocketService();
