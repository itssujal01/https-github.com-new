import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let hasPhp = true;
try { execFileSync('php', ['-v']); } catch { hasPhp = false; }
const skip = !hasPhp && 'php not installed';

const PORT = 8200 + Math.floor(Math.random() * 90);
const API = `http://127.0.0.1:${PORT}/api.php`;
let server;
let dataDir;

before(async () => {
  if (!hasPhp) return;
  dataDir = mkdtempSync(path.join(tmpdir(), 'ludo-php-'));
  server = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', 'php'], {
    env: { ...process.env, LUDO_DATA_DIR: dataDir, LUDO_NO_RATE_LIMIT: '1', PHP_CLI_SERVER_WORKERS: '4' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(API); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
});

after(() => {
  server?.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

const call = async (body) => (await fetch(API, { method: 'POST', body: JSON.stringify(body) })).json();

const auth = (p) => ({ code: p.code, key: p.token });

test('guests play a full two-player game on the PHP server', { skip, timeout: 120_000 }, async () => {
  const a = await call({ action: 'create', name: 'Asha<script>', avatar: 1 });
  assert.equal(a.ok, true);
  assert.equal(a.state.players[0].name, 'Ashascript');
  assert.equal(a.state.players[0].token, undefined, 'secrets are never sent to others');
  const b = await call({ action: 'join', code: a.code.toLowerCase(), name: 'Ravi' });
  assert.equal(b.ok, true);
  assert.equal((await call({ action: 'start', ...auth(b) })).error, 'Only the host can do that');
  assert.equal((await call({ action: 'roll', code: a.code, key: 'x'.repeat(48) })).error, 'Session expired');
  assert.equal((await call({ action: 'start', ...auth(a) })).ok, true);

  const seats = { red: a, yellow: b };
  let since = 0;
  let state;
  for (let i = 0; i < 5000; i++) {
    const poll = await call({ action: 'poll', ...auth(a), since });
    for (const batch of poll.batches) {
      assert.equal(batch.seq, since + 1, 'event batches arrive in order');
      since = batch.seq;
    }
    state = poll.state;
    if (state.phase === 'finished') break;
    const game = state.game;
    const me = seats[game.turn];
    const other = seats[game.turn === 'red' ? 'yellow' : 'red'];
    assert.equal((await call({ action: 'roll', ...auth(other) })).error, 'Not your turn');
    if (game.stage === 'roll') {
      assert.equal((await call({ action: 'roll', ...auth(me) })).ok, true);
    } else {
      const illegal = [0, 1, 2, 3].find((t) => !game.legalMoves.includes(t));
      if (illegal !== undefined) {
        assert.equal((await call({ action: 'move', ...auth(me), token: illegal })).error, 'That token cannot move');
      }
      assert.equal((await call({ action: 'move', ...auth(me), token: game.legalMoves.at(-1) })).ok, true);
    }
  }
  assert.equal(state.phase, 'finished');
  assert.equal(state.game.rankings.length, 2);
  assert.equal(readdirSync(path.join(dataDir, 'rooms')).length, 1);

  assert.equal((await call({ action: 'rematch', ...auth(a) })).ok, true);
  await call({ action: 'leave', ...auth(a) });
  await call({ action: 'leave', ...auth(b) });
  assert.equal(readdirSync(path.join(dataDir, 'rooms')).length, 0, 'empty rooms are deleted');
});

test('bots take their turns without anyone acting', { skip, timeout: 20_000 }, async () => {
  const a = await call({ action: 'create', name: 'Host' });
  await call({ action: 'addBot', ...auth(a) });
  await call({ action: 'start', ...auth(a) });
  // Our own turn times out after 15s, so just let the bot go first by rolling once.
  await call({ action: 'roll', ...auth(a) });
  let poll;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    poll = await call({ action: 'poll', ...auth(a), since: 0 });
    if (poll.batches.some((batch) => batch.events.some((e) => e.type === 'roll' && e.color === 'yellow'))) break;
  }
  assert.ok(poll.batches.some((batch) => batch.events.some((e) => e.type === 'roll' && e.color === 'yellow')), 'bot rolled');
});

test('bad requests are rejected', { skip }, async () => {
  assert.equal((await fetch(API)).status, 405);
  assert.equal((await call({ action: 'join', code: '../../etc', name: 'x' })).error, 'Room not found');
  assert.equal((await call({ action: 'create', name: '   ' })).error, 'Enter a name');
  assert.equal((await call({ action: 'nope' })).error, 'Unknown action');
  const big = await fetch(API, { method: 'POST', body: 'x'.repeat(5000) });
  assert.equal((await big.json()).error, 'Bad request');
});
