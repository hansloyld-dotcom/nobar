const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

const wss = new WebSocketServer({ server });

// rooms: Map<roomId, { clients: Map<clientId, {ws, name, isHost}>, state: RoomState }>
const rooms = new Map();

function createRoom(roomId) {
  rooms.set(roomId, {
    clients: new Map(),
    state: {
      videoUrl: null,
      videoType: null, // 'youtube' | 'direct' | 'gdrive'
      playing: false,
      currentTime: 0,
      lastUpdated: Date.now(),
      hostId: null,
    },
  });
  return rooms.get(roomId);
}

function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  // Estimate current time based on last update
  const state = { ...room.state };
  if (state.playing) {
    const elapsed = (Date.now() - state.lastUpdated) / 1000;
    state.currentTime = state.currentTime + elapsed;
  }
  return state;
}

function broadcast(roomId, message, excludeClientId = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(message);
  room.clients.forEach((client, clientId) => {
    if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  });
}

function broadcastAll(roomId, message) {
  broadcast(roomId, message, null);
}

function broadcastUserList(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const users = Array.from(room.clients.entries()).map(([id, c]) => ({
    id,
    name: c.name,
    isHost: c.isHost,
  }));
  broadcastAll(roomId, { type: "users", users });
}

wss.on("connection", (ws) => {
  const clientId = randomUUID();
  let currentRoomId = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const { type } = msg;

    if (type === "join") {
      const { roomId, name } = msg;
      if (!roomId || !name) return;

      // Leave previous room
      if (currentRoomId) leaveRoom(currentRoomId);

      currentRoomId = roomId.toUpperCase().trim();
      let room = rooms.get(currentRoomId);
      if (!room) room = createRoom(currentRoomId);

      const isHost = room.clients.size === 0;
      if (isHost) room.state.hostId = clientId;

      room.clients.set(clientId, { ws, name, isHost });

      // Send current state to new joiner
      ws.send(
        JSON.stringify({
          type: "joined",
          clientId,
          isHost,
          roomId: currentRoomId,
          state: getRoomState(currentRoomId),
        })
      );

      broadcast(currentRoomId, { type: "user_joined", name, isHost }, clientId);
      broadcastUserList(currentRoomId);
      return;
    }

    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const client = room.clients.get(clientId);
    if (!client) return;

    if (type === "load_video") {
      // Anyone can suggest a video
      room.state.videoUrl = msg.url;
      room.state.videoType = msg.videoType;
      room.state.playing = false;
      room.state.currentTime = 0;
      room.state.lastUpdated = Date.now();
      broadcastAll(currentRoomId, {
        type: "load_video",
        url: msg.url,
        videoType: msg.videoType,
        by: client.name,
      });
      return;
    }

    // Only host controls playback
    if (!client.isHost) {
      if (type === "request_sync") {
        // Non-host can request current time from host
        const hostEntry = Array.from(room.clients.entries()).find(
          ([, c]) => c.isHost
        );
        if (hostEntry) {
          hostEntry[1].ws.send(
            JSON.stringify({ type: "sync_request", requesterId: clientId })
          );
        }
      }
      return;
    }

    if (type === "play") {
      room.state.playing = true;
      room.state.currentTime = msg.currentTime ?? room.state.currentTime;
      room.state.lastUpdated = Date.now();
      broadcast(currentRoomId, { type: "play", currentTime: room.state.currentTime }, clientId);
    } else if (type === "pause") {
      room.state.playing = false;
      room.state.currentTime = msg.currentTime ?? room.state.currentTime;
      room.state.lastUpdated = Date.now();
      broadcast(currentRoomId, { type: "pause", currentTime: room.state.currentTime }, clientId);
    } else if (type === "seek") {
      room.state.currentTime = msg.currentTime;
      room.state.lastUpdated = Date.now();
      broadcast(currentRoomId, { type: "seek", currentTime: msg.currentTime }, clientId);
    } else if (type === "sync_response") {
      // Host replies to a sync request
      const requester = room.clients.get(msg.requesterId);
      if (requester && requester.ws.readyState === WebSocket.OPEN) {
        requester.ws.send(
          JSON.stringify({
            type: "sync",
            currentTime: msg.currentTime,
            playing: room.state.playing,
          })
        );
      }
    } else if (type === "heartbeat") {
      // Host periodically sends its current time so server state stays accurate
      room.state.currentTime = msg.currentTime;
      room.state.playing = msg.playing;
      room.state.lastUpdated = Date.now();
    }
  });

  function leaveRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    const client = room.clients.get(clientId);
    if (!client) return;

    const wasHost = client.isHost;
    room.clients.delete(clientId);

    if (room.clients.size === 0) {
      rooms.delete(roomId);
      return;
    }

    if (wasHost) {
      // Promote next client to host
      const [newHostId, newHostClient] = room.clients.entries().next().value;
      newHostClient.isHost = true;
      room.state.hostId = newHostId;
      newHostClient.ws.send(JSON.stringify({ type: "promoted_host" }));
    }

    broadcast(roomId, { type: "user_left", name: client.name });
    broadcastUserList(roomId);
  }

  ws.on("close", () => {
    if (currentRoomId) leaveRoom(currentRoomId);
  });
});

server.listen(PORT, () => {
  console.log(`Nobar WS server running on port ${PORT}`);
});
