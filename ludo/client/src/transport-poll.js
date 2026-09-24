// Transport for plain PHP hosting: HTTP requests to api.php, polling for updates.
// Emits the same events as the Socket.IO server, so the rest of the app is unaware.

const ACTIONS = {
  'room:create': 'create',
  'room:join': 'join',
  'room:resume': 'resume',
  'room:leave': 'leave',
  'room:addBot': 'addBot',
  'room:remove': 'remove',
  'room:start': 'start',
  'room:rematch': 'rematch',
  'game:roll': 'roll',
  'game:move': 'move',
  'game:react': 'react',
};

const API = new URL('api.php', window.location.href).toString();

export function createTransport() {
  const listeners = new Map();
  const emit = (event, data) => (listeners.get(event) || []).forEach((fn) => fn(data));
  let session = null; // {code, token}
  let since = 0;
  let rsince = 0;
  let skipOldReactions = false;
  let phase = 'lobby';
  let timer = null;
  let inFlight = false;
  let failures = 0;
  let online = true;

  async function post(body) {
    const ctrl = new AbortController();
    const kill = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'same-origin',
        cache: 'no-store',
        signal: ctrl.signal,
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error('bad-response'); }
      setOnline(true);
      return data;
    } catch (err) {
      if (err.message === 'bad-response') {
        return { ok: false, error: 'Game server (api.php) is not working. PHP 7.4+ is required.' };
      }
      setOnline(false);
      return { ok: false, error: 'Not connected, retrying…', network: true };
    } finally {
      clearTimeout(kill);
    }
  }

  function setOnline(value) {
    if (value) {
      failures = 0;
      if (!online) { online = true; emit('connect'); }
    } else if (++failures >= 2 && online) {
      online = false;
      emit('disconnect');
    }
  }

  function schedule(ms) {
    clearTimeout(timer);
    if (!session) return;
    const idle = document.hidden ? 2500 : phase === 'playing' ? 650 : 1200;
    timer = setTimeout(poll, ms ?? idle);
  }

  async function poll() {
    if (!session || inFlight) return;
    inFlight = true;
    const current = session;
    const res = await post({ action: 'poll', code: current.code, key: current.token, since, rsince });
    inFlight = false;
    if (session !== current) return; // left or switched rooms meanwhile
    if (res.ok) {
      for (const batch of res.batches) {
        if (batch.seq > since) {
          since = batch.seq;
          emit('game:events', batch);
        }
      }
      for (const r of res.reactions) {
        if (r.id > rsince) {
          rsince = r.id;
          // Reactions sent before we (re)joined are not replayed.
          if (!skipOldReactions) emit('game:reaction', r);
        }
      }
      skipOldReactions = false;
      phase = res.state.phase;
      since = Math.max(since, res.state.seq);
      emit('room:state', res.state);
    } else if (res.error === 'Session expired') {
      session = null;
      emit('room:closed');
      return;
    }
    schedule();
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(0); });
  // No handshake needed: report "connected" right away so a saved session resumes.
  setTimeout(() => emit('connect'), 0);

  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    get connected() { return online; },
    setSession(s) {
      session = s;
      if (!s) clearTimeout(timer);
    },
    async call(event, payload = {}) {
      const action = ACTIONS[event];
      if (!action) return { ok: false, error: 'Unknown action' };
      const body = { action, ...payload };
      // The player's secret travels as `key` (`token` is the piece index for moves).
      if (action === 'resume') Object.assign(body, { code: payload.code, key: payload.token, token: undefined });
      else if (!['create', 'join'].includes(action) && session) Object.assign(body, { code: session.code, key: session.token });
      const res = await post(body);
      if (res.ok && res.token) {
        session = { code: res.code, token: res.token };
        since = res.state.seq;
        rsince = 0;
        skipOldReactions = true;
        phase = res.state.phase;
        schedule(300);
      } else if (action === 'leave') {
        session = null;
        clearTimeout(timer);
      } else if (session) {
        schedule(res.ok ? 120 : undefined); // fetch the result of our action quickly
      }
      if (res.network) delete res.network;
      return res;
    },
  };
}
