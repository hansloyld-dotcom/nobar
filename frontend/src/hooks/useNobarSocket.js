import { useEffect, useRef, useCallback, useState } from "react";

export function useNobarSocket(wsUrl, handlers) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef(null);
  const reconnectCount = useRef(0);
  const mountedRef = useRef(true);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const connect = useCallback(() => {
    if (!wsUrl) return;
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try { wsRef.current.close(); } catch {}
    }
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      reconnectCount.current = 0;
      handlersRef.current?.onOpen?.();
    };
    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(e.data);
        handlersRef.current?.onMessage?.(msg);
      } catch {}
    };
    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      handlersRef.current?.onClose?.();
      const delay = Math.min(1000 * Math.pow(2, reconnectCount.current), 15000);
      reconnectCount.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }, [wsUrl]);

  useEffect(() => {
    if (!wsUrl) return;
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [connect, wsUrl]);

  const send = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send, connected };
}