import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { Server } from 'socket.io';
import {
  Room, UserError, getRoom, roomCount, sweepRooms, cleanName, cleanAvatar, MAX_ROOMS,
} from './rooms.js';

const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === 'production';
// Comma-separated list of allowed browser origins when the client is hosted elsewhere.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const MAX_CONNECTIONS_PER_IP = 12;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.get('/health', (_req, res) => res.json({ ok: true, rooms: roomCount() }));

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: 'index.html', maxAge: PROD ? '1h' : 0 }));
  app.get(/^\/(?!socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 4_096,
  pingInterval: 10_000,
  pingTimeout: 8_000,
  cors: ALLOWED_ORIGINS.length ? { origin: ALLOWED_ORIGINS } : undefined,
  connectionStateRecovery: undefined,
});

/** Send a room update to every connected member of the room. */
function emit(room, event, payload) {
  if (event === 'kicked') {
    for (const s of io.sockets.sockets.values()) {
      if (s.data.roomCode === room.code && s.data.playerId === payload) {
        s.emit('room:kicked');
        s.data.roomCode = null;
        s.data.playerId = null;
        s.leave(room.code);
      }
    }
    return;
  }
  if (event === 'closed') {
    io.to(room.code).emit('room:closed');
    io.in(room.code).socketsLeave(room.code);
    return;
  }
  const name = { state: 'room:state', events: 'game:events', reaction: 'game:reaction' }[event];
  if (name) io.to(room.code).emit(name, payload);
}

const connectionsPerIp = new Map();
function clientIp(socket) {
  if (process.env.TRUST_PROXY === '1') {
    const fwd = socket.handshake.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  }
  return socket.handshake.address;
}

io.use((socket, next) => {
  const ip = clientIp(socket);
  const n = connectionsPerIp.get(ip) ?? 0;
  if (n >= MAX_CONNECTIONS_PER_IP) return next(new Error('Too many connections'));
  connectionsPerIp.set(ip, n + 1);
  socket.data.ip = ip;
  next();
});

io.on('connection', (socket) => {
  // Token bucket: 12 actions burst, refilling 6 per second.
  let tokens = 12;
  let last = Date.now();
  const allow = () => {
    const now = Date.now();
    tokens = Math.min(12, tokens + ((now - last) / 1000) * 6);
    last = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };

  const current = () => {
    const room = getRoom(socket.data.roomCode);
    const player = room?.players.find((p) => p.id === socket.data.playerId);
    if (!room || !player) throw new UserError('You are not in a room');
    return { room, player };
  };

  const attach = (room, player) => {
    detach();
    socket.data.roomCode = room.code;
    socket.data.playerId = player.id;
    socket.join(room.code);
  };

  function detach() {
    const room = getRoom(socket.data.roomCode);
    if (room) socket.leave(room.code);
    socket.data.roomCode = null;
    socket.data.playerId = null;
  }

  const joinReply = (room, player) => ({
    ok: true, code: room.code, token: player.token, playerId: player.id, state: room.publicState(),
  });

  /** Wrap a handler with rate limiting, payload checks and error replies. */
  const on = (event, handler) => {
    socket.on(event, (...args) => {
      const ack = typeof args.at(-1) === 'function' ? args.pop() : null;
      const reply = ack ?? (() => {});
      const payload = args[0] ?? {};
      if (!allow()) return reply({ ok: false, error: 'Slow down' });
      if (args.length > 1 || typeof payload !== 'object' || Array.isArray(payload)) {
        return reply({ ok: false, error: 'Bad request' });
      }
      try {
        reply(handler(payload) ?? { ok: true });
      } catch (err) {
        if (!(err instanceof UserError)) console.error(`[${event}]`, err);
        reply({ ok: false, error: err instanceof UserError ? err.message : 'Something went wrong' });
      }
    });
  };

  on('room:create', ({ name, avatar }) => {
    const clean = cleanName(name);
    if (!clean) throw new UserError('Enter a name');
    if (roomCount() >= MAX_ROOMS) throw new UserError('Server is busy, try again soon');
    leaveCurrent();
    const room = new Room(emit);
    const player = room.addHuman(clean, cleanAvatar(avatar));
    attach(room, player);
    room.broadcastState();
    return joinReply(room, player);
  });

  on('room:join', ({ code, name, avatar }) => {
    const clean = cleanName(name);
    if (!clean) throw new UserError('Enter a name');
    const room = getRoom(code);
    if (!room) throw new UserError('Room not found');
    leaveCurrent();
    const player = room.addHuman(clean, cleanAvatar(avatar));
    attach(room, player);
    room.broadcastState();
    return joinReply(room, player);
  });

  on('room:resume', ({ code, token }) => {
    const room = getRoom(code);
    const player = room?.byToken(token);
    if (!room || !player) throw new UserError('Session expired');
    // Only one live socket per player: the old one is dropped from the room.
    for (const s of io.sockets.sockets.values()) {
      if (s.id !== socket.id && s.data.playerId === player.id) {
        s.emit('room:kicked', 'Opened in another tab');
        s.leave(room.code);
        s.data.roomCode = null;
        s.data.playerId = null;
      }
    }
    attach(room, player);
    room.setConnected(player, true);
    return joinReply(room, player);
  });

  function leaveCurrent() {
    const room = getRoom(socket.data.roomCode);
    const player = room?.players.find((p) => p.id === socket.data.playerId);
    detach();
    if (room && player) room.leave(player);
  }

  on('room:leave', () => { leaveCurrent(); });
  on('room:addBot', () => { const { room, player } = current(); room.addBot(player.id); });
  on('room:remove', ({ playerId }) => {
    const { room, player } = current();
    room.removePlayer(player.id, playerId);
  });
  on('room:start', () => { const { room, player } = current(); room.start(player.id); });
  on('room:rematch', () => { const { room, player } = current(); room.rematch(player.id); });
  on('game:roll', () => { const { room, player } = current(); room.roll(player); });
  on('game:move', ({ token }) => { const { room, player } = current(); room.move(player, token); });
  on('game:react', ({ reaction }) => { const { room, player } = current(); room.react(player, reaction); });

  socket.on('disconnect', () => {
    const ip = socket.data.ip;
    const n = (connectionsPerIp.get(ip) ?? 1) - 1;
    if (n <= 0) connectionsPerIp.delete(ip);
    else connectionsPerIp.set(ip, n);

    const room = getRoom(socket.data.roomCode);
    const player = room?.players.find((p) => p.id === socket.data.playerId);
    if (!room || !player) return;
    room.setConnected(player, false);
  });
});

setInterval(() => sweepRooms(), 30_000).unref();

httpServer.listen(PORT, () => {
  console.log(`Ludo Nova server on http://localhost:${PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    io.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3_000).unref();
  });
}
