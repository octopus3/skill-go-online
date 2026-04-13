import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const PORT = Number(process.env.PORT || 3000);
const app = express();

const publicDir = path.join(projectRoot, "public");
const staticRoot = fs.existsSync(path.join(publicDir, "index.html")) ? publicDir : projectRoot;
app.use(express.static(staticRoot));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

/** @type {Map<string, { roomId: string, createdAt: number, clients: Map<string, any>, seatByClientId: Map<string, number>, setup: any, state: any }>} */
const rooms = new Map();

function getOrCreateRoom(roomId) {
  let r = rooms.get(roomId);
  if (!r) {
    r = {
      roomId,
      createdAt: Date.now(),
      clients: new Map(),
      seatByClientId: new Map(),
      setup: null,
      state: null,
    };
    rooms.set(roomId, r);
  }
  return r;
}

function roomSnapshot(room) {
  const players = [];
  for (const [cid, ws] of room.clients.entries()) {
    players.push({
      clientId: cid,
      connected: ws.readyState === ws.OPEN,
      seat: room.seatByClientId.get(cid) ?? null,
    });
  }
  return {
    roomId: room.roomId,
    players,
    hasSetup: Boolean(room.setup),
    hasState: Boolean(room.state),
  };
}

function send(ws, msg) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function broadcast(room, msg) {
  for (const ws of room.clients.values()) send(ws, msg);
}

function assignSeatsIfNeeded(room) {
  const taken = new Set(room.seatByClientId.values());
  for (const cid of room.clients.keys()) {
    if (room.seatByClientId.has(cid)) continue;
    if (!taken.has(1)) {
      room.seatByClientId.set(cid, 1); // 黑方
      taken.add(1);
    } else if (!taken.has(2)) {
      room.seatByClientId.set(cid, 2); // 白方
      taken.add(2);
    } else {
      room.seatByClientId.set(cid, 0); // 观战
    }
  }
}

function cleanupEmptyRooms() {
  const now = Date.now();
  for (const [roomId, r] of rooms.entries()) {
    const alive = [...r.clients.values()].some((ws) => ws.readyState === ws.OPEN);
    if (!alive && now - r.createdAt > 60_000) rooms.delete(roomId);
  }
}
setInterval(cleanupEmptyRooms, 30_000).unref?.();

wss.on("connection", (ws) => {
  const clientId = makeId();
  ws._clientId = clientId;
  ws._roomId = null;

  send(ws, { type: "hello", clientId });

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;

    if (msg.type === "join") {
      const roomId = String(msg.roomId || "").trim();
      if (!roomId) return send(ws, { type: "error", message: "roomId 不能为空" });

      // leave old room
      if (ws._roomId) {
        const old = rooms.get(ws._roomId);
        if (old) {
          old.clients.delete(clientId);
          old.seatByClientId.delete(clientId);
          broadcast(old, { type: "room", ...roomSnapshot(old) });
        }
      }

      const room = getOrCreateRoom(roomId);
      room.clients.set(clientId, ws);
      ws._roomId = roomId;
      assignSeatsIfNeeded(room);

      send(ws, {
        type: "joined",
        roomId,
        seat: room.seatByClientId.get(clientId) ?? 0,
        setup: room.setup,
        state: room.state,
      });
      broadcast(room, { type: "room", ...roomSnapshot(room) });
      return;
    }

    const roomId = ws._roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const seat = room.seatByClientId.get(clientId) ?? 0;

    if (msg.type === "set_setup") {
      if (seat !== 1) return; // 仅黑方创建设置
      room.setup = msg.setup || null;
      broadcast(room, { type: "setup", setup: room.setup });
      broadcast(room, { type: "room", ...roomSnapshot(room) });
      return;
    }

    if (msg.type === "set_state") {
      if (seat !== 1) return; // 仅黑方作为“主机”广播状态
      room.state = msg.state || null;
      broadcast(room, { type: "state", state: room.state });
      broadcast(room, { type: "room", ...roomSnapshot(room) });
      return;
    }

    if (msg.type === "reset_room") {
      if (seat !== 1) return;
      room.setup = null;
      room.state = null;
      broadcast(room, { type: "setup", setup: null });
      broadcast(room, { type: "state", state: null });
      broadcast(room, { type: "room", ...roomSnapshot(room) });
      return;
    }
  });

  ws.on("close", () => {
    const roomId = ws._roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.clients.delete(clientId);
    room.seatByClientId.delete(clientId);
    assignSeatsIfNeeded(room);
    broadcast(room, { type: "room", ...roomSnapshot(room) });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`skill-go-online: http://localhost:${PORT}`);
});

