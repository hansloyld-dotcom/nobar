import { useEffect, useRef, useCallback, useState } from "react";

export function useNobarSocket(wsUrl, { onMessage, onOpen, onClose } = {}) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const reconnectTimer = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setReconnectCount(0);
      onOpen?.();
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(e.data);
        onMessage?.(msg);
      } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      onClose?.();
      // Auto reconnect with backoff
      setReconnectCount((c) => {
        const delay = Math.min(1000 * 2 ** c, 15000);
        reconnectTimer.current = setTimeout(connect, delay);
        return c + 1;
      });
    };

    ws.onerror = () => ws.close();
  }, [wsUrl]); // eslint-disable-line

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, connected, reconnectCount };
}
