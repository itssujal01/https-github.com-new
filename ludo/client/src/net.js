// Session handling on top of a transport: Socket.IO for the Node server, or
// HTTP polling for PHP hosting. Vite picks one at build time via '#transport'.
import { createTransport } from '#transport';

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
    this.transport = createTransport();
    this.transport.on('connect', () => {
      this.fire('connection', true);
      if (this.session) this.resume();
    });
    this.transport.on('disconnect', () => this.fire('connection', false));
    this.transport.on('connect_error', (err) => this.fire('connection-error', err?.message));
    for (const ev of ['room:state', 'game:events', 'game:reaction']) {
      this.transport.on(ev, (data) => this.fire(ev, data));
    }
    this.transport.on('room:kicked', (reason) => this.end(reason || 'You were removed from the room'));
    this.transport.on('room:closed', () => this.end('The room was closed'));
  }

  fire(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  call(event, payload = {}) {
    return this.transport.call(event, payload);
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
    this.transport.setSession(null);
    write(SESSION_KEY, null);
    this.fire('left', reason);
  }
}
