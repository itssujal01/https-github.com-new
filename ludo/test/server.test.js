import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';

const PORT = 3900 + Math.floor(Math.random() * 90);
const URL = `http://localhost:${PORT}`;
let server;
const sockets = [];

before(async () => {
  server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve) => server.stdout.on('data', (d) => d.toString().includes('server on') && resolve()));
});

after(() => {
  sockets.forEach((s) => s.close());
  server.kill();
});

function client() {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  return s;
}

const call = (s, event, payload) => new Promise((resolve) => s.emit(event, payload, resolve));
const waitFor = (s, event, pred = () => true) => new Promise((resolve) => {
  const h = (v) => { if (pred(v)) { s.off(event, h); resolve(v); } };
  s.on(event, h);
});

test('guests create, join, and only the current player can act', async () => {
  const a = client();
  const b = client();
  const created = await call(a, 'room:create', { name: '  Asha<script>  ', avatar: 3 });
  assert.equal(created.ok, true);
  assert.match(created.code, /^[A-Z2-9]{6}$/);
  assert.equal(created.state.players[0].name, 'Ashascript');
  assert.equal(created.state.players[0].token, undefined, 'tokens are never broadcast');

  const bad = await call(b, 'room:join', { code: 'ZZZZZZ', name: 'Ravi' });
  assert.deepEqual(bad, { ok: false, error: 'Room not found' });
  const joined = await call(b, 'room:join', { code: created.code.toLowerCase(), name: 'Ravi' });
  assert.equal(joined.ok, true);
  assert.equal(joined.state.players.length, 2);

  const notHost = await call(b, 'room:start');
  assert.equal(notHost.error, 'Only the host can do that');

  const started = waitFor(a, 'room:state', (st) => st.phase === 'playing');
  assert.equal((await call(a, 'room:start')).ok, true);
  const state = await started;
  assert.equal(state.game.turn, 'red');
  assert.ok(state.deadline > state.serverNow);

  assert.equal((await call(b, 'game:roll')).error, 'Not your turn');
  assert.equal((await call(a, 'game:move', { token: 0 })).error, "You can't move now");
  const events = waitFor(b, 'game:events');
  assert.equal((await call(a, 'game:roll')).ok, true);
  const batch = await events;
  assert.equal(batch.events[0].type, 'roll');
  assert.ok(batch.events[0].value >= 1 && batch.events[0].value <= 6);
});

test('a player can resume with their token and others cannot', async () => {
  const a = client();
  const created = await call(a, 'room:create', { name: 'Meera' });
  await call(a, 'room:addBot');
  await call(a, 'room:start');
  a.close();

  const b = client();
  const forged = await call(b, 'room:resume', { code: created.code, token: 'nope' });
  assert.equal(forged.ok, false);
  const resumed = await call(b, 'room:resume', { code: created.code, token: created.token });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.playerId, created.playerId);
  assert.equal(resumed.state.phase, 'playing');
});

test('malformed payloads and floods are rejected', async () => {
  const a = client();
  assert.equal((await call(a, 'room:create', 'x')).error, 'Bad request');
  assert.equal((await call(a, 'room:create', { name: '   ' })).error, 'Enter a name');
  const replies = await Promise.all(Array.from({ length: 30 }, () => call(a, 'game:roll')));
  assert.ok(replies.some((r) => r.error === 'Slow down'));
});

test('leaving mid-game forfeits and ends a two-player game', async () => {
  const a = client();
  const b = client();
  const created = await call(a, 'room:create', { name: 'Host' });
  await call(b, 'room:join', { code: created.code, name: 'Guest' });
  await call(a, 'room:start');
  const over = waitFor(b, 'game:events', (batch) => batch.events.some((e) => e.type === 'game-over'));
  await call(a, 'room:leave');
  const batch = await over;
  assert.deepEqual(batch.events.at(-1).rankings, ['yellow']);
  assert.equal((await call(a, 'game:roll')).error, 'You are not in a room');
});
