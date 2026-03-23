import { useState, useRef, useCallback, useEffect } from "react";
import { useNobarSocket } from "./hooks/useNobarSocket";
import { parseVideoUrl, generateRoomId } from "./utils/videoUtils";
import YouTubePlayer from "./components/YouTubePlayer";
import DirectPlayer from "./components/DirectPlayer";
import Chat from "./components/Chat";
import "./App.css";

const WS_URL = import.meta.env.VITE_WS_URL || "wss://your-server.railway.app";
const SYNC_THRESHOLD = 2.5;

export default function App() {
  const [screen, setScreen] = useState("lobby");
  const [roomId, setRoomId] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [myName, setMyName] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [users, setUsers] = useState([]);
  const [videoInfo, setVideoInfo] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [messages, setMessages] = useState([]);

  const playerRef = useRef(null);
  const isHostRef = useRef(false);
  const pendingSyncRef = useRef(null);
  const playerReadyRef = useRef(false);
  const heartbeatRef = useRef(null);
  const sendRef = useRef(null);

  isHostRef.current = isHost;

  const addSystemMsg = useCallback((text) => {
    setMessages((m) => [...m, { type: "system", text }]);
  }, []);

  const applySync = useCallback((currentTime, playing) => {
    if (!playerReadyRef.current) {
      pendingSyncRef.current = { currentTime, playing };
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    const ct = player.getCurrentTime();
    if (Math.abs(ct - currentTime) > SYNC_THRESHOLD) {
      player.seekTo(currentTime);
    }
    if (playing) player.play();
    else player.pause();
  }, []);

  const handleMessage = useCallback((msg) => {
    const send = sendRef.current;
    switch (msg.type) {
      case "joined": {
        setIsHost(msg.isHost);
        isHostRef.current = msg.isHost;
        if (msg.state?.videoUrl) {
          const info = parseVideoUrl(msg.state.videoUrl);
          setVideoInfo(info);
          pendingSyncRef.current = {
            currentTime: msg.state.currentTime,
            playing: msg.state.playing,
          };
        }
        break;
      }
      case "users":
        setUsers(msg.users);
        break;
      case "promoted_host":
        setIsHost(true);
        isHostRef.current = true;
        addSystemMsg("👑 Kamu sekarang jadi host!");
        break;
      case "user_joined":
        addSystemMsg(`👋 ${msg.name} bergabung`);
        break;
      case "user_left":
        addSystemMsg(`👋 ${msg.name} keluar`);
        break;
      case "load_video": {
        const info = parseVideoUrl(msg.url);
        setVideoInfo(info);
        playerReadyRef.current = false;
        addSystemMsg(`🎬 ${msg.by} memutar video baru`);
        break;
      }
      case "play":
        if (!isHostRef.current) applySync(msg.currentTime, true);
        break;
      case "pause":
        if (!isHostRef.current) applySync(msg.currentTime, false);
        break;
      case "seek":
        if (!isHostRef.current) playerRef.current?.seekTo(msg.currentTime);
        break;
      case "sync":
        applySync(msg.currentTime, msg.playing);
        break;
      case "sync_request":
        if (isHostRef.current && send) {
          const ct = playerRef.current?.getCurrentTime() ?? 0;
          send({ type: "sync_response", requesterId: msg.requesterId, currentTime: ct });
        }
        break;
      case "chat":
        setMessages((m) => [...m, { name: msg.name, text: msg.text }]);
        break;
      default:
        break;
    }
  }, [addSystemMsg, applySync]);

  const { send, connected } = useNobarSocket(screen === "room" ? WS_URL : null, {
    onMessage: handleMessage,
  });

  sendRef.current = send;

  function applySync(currentTime, playing) {
    if (!playerReadyRef.current) {
      pendingSyncRef.current = { currentTime, playing };
      return;
    }
    const player = playerRef.current;
    if (!player) return;
    const ct = player.getCurrentTime();
    if (Math.abs(ct - currentTime) > SYNC_THRESHOLD) {
      player.seekTo(currentTime);
    }
    if (playing) player.play();
    else player.pause();
  }

  // Host heartbeat
  useEffect(() => {
    if (!isHost || screen !== "room") return;
    heartbeatRef.current = setInterval(() => {
      if (!playerRef.current || !playerReadyRef.current) return;
      send({
        type: "heartbeat",
        currentTime: playerRef.current.getCurrentTime(),
        playing: !playerRef.current.isPaused(),
      });
    }, 3000);
    return () => clearInterval(heartbeatRef.current);
  }, [isHost, screen, send]);

  // Join room
  function handleJoin(asHost) {
    const name = nameInput.trim();
    if (!name) return;
    const rid = asHost ? generateRoomId() : roomInput.trim().toUpperCase();
    if (!rid) return;
    setMyName(name);
    setRoomId(rid);
    setScreen("room");
    setTimeout(() => send({ type: "join", roomId: rid, name }), 300);
  }

  // Load video
  function handleLoadVideo() {
    const info = parseVideoUrl(urlInput.trim());
    if (!info) {
      setUrlError("URL tidak dikenali. Coba link YouTube, Google Drive, atau direct MP4.");
      return;
    }
    setUrlError("");
    send({ type: "load_video", url: urlInput.trim(), videoType: info.type });
    setUrlInput("");
  }

  // Host playback controls — called when host interacts with player
  const onHostStateChange = useCallback(
    (ytState) => {
      if (!isHostRef.current) return;
      // YT states: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
      if (ytState === 1) {
        send({ type: "play", currentTime: playerRef.current?.getCurrentTime() });
      } else if (ytState === 2) {
        send({ type: "pause", currentTime: playerRef.current?.getCurrentTime() });
      }
    },
    [send]
  );

  const onPlayerReady = useCallback(() => {
    playerReadyRef.current = true;
    if (pendingSyncRef.current) {
      const { currentTime, playing } = pendingSyncRef.current;
      pendingSyncRef.current = null;
      setTimeout(() => applySync(currentTime, playing), 500);
    }
    if (!isHostRef.current) {
      send({ type: "request_sync" });
    }
  }, [send, applySync]);

  function sendChat(text) {
    setMessages((m) => [...m, { name: myName, text }]);
    send({ type: "chat", name: myName, text });
  }

  // LOBBY SCREEN
  if (screen === "lobby") {
    return (
      <div className="lobby">
        <div className="lobby-card">
          <div className="logo">🎬 Nobar</div>
          <p className="tagline">Nonton bareng, sync real-time, koneksi masing-masing</p>
          <input
            className="input"
            placeholder="Nama kamu"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={20}
          />
          <div className="lobby-actions">
            <button
              className="btn btn-primary"
              onClick={() => handleJoin(true)}
              disabled={!nameInput.trim()}
            >
              🏠 Buat Room
            </button>
            <div className="divider">atau</div>
            <input
              className="input input-code"
              placeholder="Kode Room (6 huruf)"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button
              className="btn btn-secondary"
              onClick={() => handleJoin(false)}
              disabled={!nameInput.trim() || roomInput.trim().length < 2}
            >
              🚪 Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ROOM SCREEN
  return (
    <div className="room-layout">
      {/* Header */}
      <header className="room-header">
        <div className="room-header-left">
          <span className="logo-small">🎬 Nobar</span>
          <span className="room-code">
            Room: <strong>{roomId}</strong>
          </span>
          {isHost && <span className="host-badge">👑 Host</span>}
        </div>
        <div className="room-header-right">
          <span className={`conn-dot ${connected ? "online" : "offline"}`} />
          <span className="conn-label">{connected ? "Connected" : "Reconnecting..."}</span>
          <button className="btn-leave" onClick={() => { setScreen("lobby"); setVideoInfo(null); }}>
            Keluar
          </button>
        </div>
      </header>

      <div className="room-body">
        {/* Video area */}
        <div className="video-area">
          <div className="video-wrapper">
            {!videoInfo ? (
              <div className="video-placeholder">
                <div className="placeholder-icon">🎬</div>
                <p>{isHost ? "Masukkan link video di bawah untuk mulai nonton" : "Menunggu host memutar video..."}</p>
              </div>
            ) : videoInfo.type === "youtube" ? (
              <YouTubePlayer
                ref={playerRef}
                videoId={videoInfo.videoId}
                onReady={onPlayerReady}
                onStateChange={onHostStateChange}
              />
            ) : (
              <DirectPlayer
                ref={playerRef}
                url={videoInfo.embedUrl}
                type={videoInfo.type}
              />
            )}
          </div>

          {/* URL input */}
          <div className="url-bar">
            <input
              className="input url-input"
              placeholder="Paste link video: YouTube, Google Drive, MP4, dll..."
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
            />
            <button className="btn btn-load" onClick={handleLoadVideo}>
              Putar
            </button>
          </div>
          {urlError && <p className="url-error">{urlError}</p>}

          {/* Non-host sync button */}
          {!isHost && videoInfo && (
            <button className="btn-sync" onClick={() => send({ type: "request_sync" })}>
              🔄 Sync ke Host
            </button>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Users */}
          <div className="users-panel">
            <div className="panel-title">👥 Penonton ({users.length})</div>
            <div className="users-list">
              {users.map((u) => (
                <div key={u.id} className="user-item">
                  <span className="user-avatar">{u.name[0]?.toUpperCase()}</span>
                  <span className="user-name">{u.name}</span>
                  {u.isHost && <span className="host-badge-small">👑</span>}
                  {u.name === myName && <span className="me-badge">Kamu</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <Chat messages={messages} onSend={sendChat} myName={myName} />
        </div>
      </div>
    </div>
  );
}