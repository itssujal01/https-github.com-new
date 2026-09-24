import { io } from 'socket.io-client';

const SESSION_KEY = 'ludo:session';
const PROFILE_KEY = 'ludo:profile';

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage blocked: sessions just won't survive a refresh */ }
}

export const profile = {
  load: () => read(PROFILE_KEY) ?? { name: '', avatar: 0 },
  save: (p) => write(PROFILE_KEY, { name: p.name, avatar: p.avatar }),
};

export class Net extends EventTarget {
  constructor() {
    super();
    this.session = read(SESSION_KEY); // {code, token}
    this.playerId = null;
    this.socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 4000 });
    this.socket.on('connect', () => {
      this.fire('connection', true);
      if (this.session) this.resume();
    });
    this.socket.on('disconnect', () => this.fire('connection', false));
    this.socket.on('connect_error', (err) => this.fire('connection-error', err.message));
    for (const ev of ['room:state', 'game:events', 'game:reaction']) {
      this.socket.on(ev, (data) => this.fire(ev, data));
    }
    this.socket.on('room:kicked', (reason) => this.end(reason || 'You were removed from the room'));
    this.socket.on('room:closed', () => this.end('The room was closed'));
  }

  fire(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  call(event, payload = {}) {
    return new Promise((resolve) => {
      if (!this.socket.connected) return resolve({ ok: false, error: 'Not connected, retrying…' });
      this.socket.timeout(8000).emit(event, payload, (err, res) => {
        resolve(err ? { ok: false, error: 'Server did not respond' } : res);
      });
    });
  }

  async enter(event, payload) {
    const res = await this.call(event, payload);
    if (res.ok) {
      this.session = { code: res.code, token: res.token };
      this.playerId = res.playerId;
      write(SESSION_KEY, this.session);
      this.fire('joined', res);
    }
    return res;
  }

  create(name, avatar) { return this.enter('room:create', { name, avatar }); }
  join(code, name, avatar) { return this.enter('room:join', { code, name, avatar }); }

  async resume() {
    const res = await this.enter('room:resume', this.session);
    if (!res.ok && res.error === 'Session expired') this.end(null);
    return res;
  }

  async leave() {
    await this.call('room:leave');
    this.end(null);
  }

  end(reason) {
    this.session = null;
    this.playerId = null;
    write(SESSION_KEY, null);
    this.fire('left', reason);
  }
}
