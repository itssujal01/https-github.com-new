import { randomBytes, randomInt } from 'node:crypto';
import {
  createGame, applyRoll, applyMove, forfeit, chooseBotMove, SEATS_FOR_COUNT,
} from '../shared/engine.js';
import { AVATAR_COUNT, BOT_NAMES, REACTION_COUNT, TIMING } from '../shared/protocol.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const CODE_LENGTH = 6;
export const MAX_PLAYERS = 4;
export const MAX_ROOMS = 5000;

const LOBBY_RECONNECT_MS = 20_000;
const LOBBY_IDLE_MS = 30 * 60_000;
const EMPTY_ROOM_MS = 3 * 60_000;
const FINISHED_ROOM_MS = 15 * 60_000;

const rooms = new Map();

export function roomCount() {
  return rooms.size;
}

export function getRoom(code) {
  return typeof code === 'string' ? rooms.get(code.toUpperCase()) : undefined;
}

function newCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
}

const newId = () => randomBytes(8).toString('hex');
const newToken = () => randomBytes(24).toString('base64url');

/** Strip control/markup characters and collapse whitespace. */
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw
    .normalize('NFKC')
    .replace(/[\p{C}<>&"'`\\]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return name.length >= 1 ? name : null;
}

export function cleanAvatar(raw) {
  return Number.isInteger(raw) && raw >= 0 && raw < AVATAR_COUNT ? raw : 0;
}

export class Room {
  /** @param {(room: Room, event: string, payload: any) => void} emit */
  constructor(emit) {
    this.code = newCode();
    this.emit = emit;
    this.players = []; // {id, token, name, avatar, isBot, connected, color, timeouts}
    this.hostId = null;
    this.phase = 'lobby'; // 'lobby' | 'playing' | 'finished'
    this.game = null;
    this.deadline = null;
    this.timer = null;
    this.seq = 0;
    this.touched = Date.now();
    this.emptySince = null;
    rooms.set(this.code, this);
  }

  // ---- membership -------------------------------------------------------

  addHuman(name, avatar) {
    if (this.phase !== 'lobby') throw new UserError('Game already started');
    if (this.players.length >= MAX_PLAYERS) throw new UserError('Room is full');
    const player = {
      id: newId(), token: newToken(), name, avatar, isBot: false,
      connected: true, color: null, timeouts: 0,
    };
    this.players.push(player);
    if (!this.hostId) this.hostId = player.id;
    this.touch();
    return player;
  }

  addBot(byId) {
    this.requireHost(byId);
    if (this.phase !== 'lobby') throw new UserError('Game already started');
    if (this.players.length >= MAX_PLAYERS) throw new UserError('Room is full');
    const used = new Set(this.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? 'Bot';
    this.players.push({
      id: newId(), token: null, name, avatar: randomInt(AVATAR_COUNT), isBot: true,
      connected: true, color: null, timeouts: 0,
    });
    this.broadcastState();
  }

  removePlayer(byId, targetId) {
    this.requireHost(byId);
    if (this.phase !== 'lobby') throw new UserError('Game already started');
    const target = this.players.find((p) => p.id === targetId);
    if (!target || target.id === byId) throw new UserError('Cannot remove that player');
    this.players = this.players.filter((p) => p !== target);
    this.emit(this, 'kicked', target.id);
    this.broadcastState();
  }

  byToken(token) {
    return typeof token === 'string' ? this.players.find((p) => p.token === token) : undefined;
  }

  setConnected(player, connected) {
    player.connected = connected;
    clearTimeout(player.dropTimer);
    if (connected) player.timeouts = 0;
    else if (this.phase === 'lobby') {
      // Give a refreshing browser a moment to come back before freeing the seat.
      player.dropTimer = setTimeout(() => {
        if (!player.connected && this.players.includes(player)) this.leave(player);
      }, LOBBY_RECONNECT_MS);
    }
    this.emptySince = this.hasConnectedHuman() ? null : Date.now();
    this.broadcastState();
    // A disconnected player's turn is auto-played; reschedule accordingly.
    if (this.phase === 'playing' && this.game.turn === player.color) this.schedule([]);
  }

  leave(player) {
    clearTimeout(player.dropTimer);
    if (this.phase === 'playing' && player.color) {
      const { game, events } = forfeit(this.game, player.color);
      this.players = this.players.filter((p) => p !== player);
      this.applyGame(game, events);
    } else {
      this.players = this.players.filter((p) => p !== player);
    }
    if (this.hostId === player.id) {
      this.hostId = this.players.find((p) => !p.isBot)?.id ?? null;
    }
    this.emptySince = this.hasConnectedHuman() ? null : Date.now();
    this.touch();
    this.broadcastState();
  }

  hasConnectedHuman() {
    return this.players.some((p) => !p.isBot && p.connected);
  }

  requireHost(id) {
    if (id !== this.hostId) throw new UserError('Only the host can do that');
  }

  // ---- game flow --------------------------------------------------------

  start(byId) {
    this.requireHost(byId);
    if (this.phase !== 'lobby') throw new UserError('Game already started');
    if (this.players.length < 2) throw new UserError('Need at least 2 players (add a bot)');
    const seats = SEATS_FOR_COUNT[this.players.length];
    this.players.forEach((p, i) => { p.color = seats[i]; p.timeouts = 0; });
    this.phase = 'playing';
    this.game = createGame(seats);
    this.applyGame(this.game, [{ type: 'start' }, { type: 'turn', color: this.game.turn }]);
  }

  rematch(byId) {
    this.requireHost(byId);
    if (this.phase !== 'finished') throw new UserError('Game is not over yet');
    this.clearTimer();
    this.phase = 'lobby';
    this.game = null;
    this.deadline = null;
    this.players.forEach((p) => { p.color = null; });
    this.touch();
    this.broadcastState();
  }

  roll(player) {
    this.requireTurn(player, 'roll');
    player.timeouts = 0;
    this.doRoll();
  }

  move(player, tokenIndex) {
    this.requireTurn(player, 'move');
    if (!Number.isInteger(tokenIndex) || !this.game.legalMoves.includes(tokenIndex)) {
      throw new UserError('That token cannot move');
    }
    player.timeouts = 0;
    const { game, events } = applyMove(this.game, tokenIndex);
    this.applyGame(game, events);
  }

  react(player, reaction) {
    if (!Number.isInteger(reaction) || reaction < 0 || reaction >= REACTION_COUNT) return;
    const now = Date.now();
    if (player.lastReaction && now - player.lastReaction < TIMING.reactionCooldownMs) return;
    player.lastReaction = now;
    this.emit(this, 'reaction', { playerId: player.id, reaction });
  }

  requireTurn(player, stage) {
    if (this.phase !== 'playing') throw new UserError('Game is not running');
    if (player.color !== this.game.turn) throw new UserError('Not your turn');
    if (this.game.stage !== stage) throw new UserError(`You can't ${stage} now`);
  }

  doRoll() {
    const { game, events } = applyRoll(this.game, randomInt(1, 7));
    this.applyGame(game, events);
  }

  applyGame(game, events) {
    this.game = game;
    this.touch();
    if (game.stage === 'over' && this.phase === 'playing') this.phase = 'finished';
    if (events.length) {
      this.seq++;
      this.emit(this, 'events', { seq: this.seq, events });
    }
    this.schedule(events);
    this.broadcastState();
  }

  /** Decide who acts next and when: bots/offline players act, humans get a deadline. */
  schedule(events) {
    this.clearTimer();
    this.deadline = null;
    if (this.phase !== 'playing') return;
    const current = this.players.find((p) => p.color === this.game.turn);
    const animation = animationTime(events);
    const auto = !current || current.isBot || !current.connected || current.timeouts >= 2;
    const wait = animation + (auto ? TIMING.botThinkMs : TIMING.turnMs);
    if (!auto) this.deadline = Date.now() + wait;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        if (!auto && current) current.timeouts++;
        this.autoAct();
      } catch (err) {
        console.error('auto action failed', err);
      }
    }, wait);
  }

  autoAct() {
    if (this.phase !== 'playing') return;
    if (this.game.stage === 'roll') this.doRoll();
    else if (this.game.stage === 'move') {
      const { game, events } = applyMove(this.game, chooseBotMove(this.game));
      this.applyGame(game, events);
    }
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ---- views ------------------------------------------------------------

  publicState() {
    return {
      code: this.code,
      phase: this.phase,
      hostId: this.hostId,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot,
        connected: p.connected, color: p.color, auto: !p.isBot && p.timeouts >= 2,
      })),
      game: this.game,
      deadline: this.deadline,
      serverNow: Date.now(),
      seq: this.seq,
    };
  }

  broadcastState() {
    this.emit(this, 'state', this.publicState());
  }

  touch() {
    this.touched = Date.now();
  }

  destroy() {
    this.clearTimer();
    for (const p of this.players) clearTimeout(p.dropTimer);
    rooms.delete(this.code);
  }
}

export class UserError extends Error {}

/** Rough client animation time for a batch of events, so bots don't outrun it. */
export function animationTime(events) {
  let ms = 0;
  for (const e of events) {
    if (e.type === 'roll') ms += TIMING.diceMs;
    else if (e.type === 'move') ms += TIMING.stepMs * (e.from < 0 ? 1 : e.to - e.from) + 250;
    else if (e.type === 'capture') ms += TIMING.captureMs;
    else if (e.type === 'three-sixes' || e.type === 'no-move') ms += 500;
  }
  return ms;
}

export function sweepRooms(now = Date.now()) {
  for (const room of rooms.values()) {
    const idle = now - room.touched;
    const empty = room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_MS;
    if (
      empty
      || room.players.every((p) => p.isBot)
      || (room.phase === 'lobby' && idle > LOBBY_IDLE_MS)
      || (room.phase === 'finished' && idle > FINISHED_ROOM_MS)
    ) {
      room.emit(room, 'closed', null);
      room.destroy();
    }
  }
}
