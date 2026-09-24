import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createGame, applyRoll, applyMove, forfeit, chooseBotMove } from '../shared/engine.js';

let hasPhp = true;
try { execFileSync('php', ['-v']); } catch { hasPhp = false; }

function playJs({ colors, rolls, forfeits = {} }) {
  let g = createGame(colors);
  const out = [];
  let r = 0;
  for (let step = 0; g.stage !== 'over' && step < 5000; step++) {
    let res;
    if (forfeits[step]) res = forfeit(g, forfeits[step]);
    else if (g.stage === 'roll') res = applyRoll(g, rolls[r++ % rolls.length]);
    else res = applyMove(g, chooseBotMove(g));
    g = res.game;
    out.push({ events: res.events, game: g });
  }
  return out;
}

test('the PHP engine plays exactly like the JS engine', { skip: !hasPhp && 'php not installed' }, () => {
  for (let n = 0; n < 40; n++) {
    const input = {
      colors: [['red', 'yellow'], ['red', 'green', 'yellow'], ['red', 'green', 'yellow', 'blue']][n % 3],
      rolls: Array.from({ length: 997 }, () => 1 + Math.floor(Math.random() * 6)),
      forfeits: n % 5 === 4 ? { 120: 'green' } : {},
    };
    const php = JSON.parse(execFileSync('php', ['test/php-runner.php'], { input: JSON.stringify(input), maxBuffer: 1 << 28 }));
    const js = JSON.parse(JSON.stringify(playJs(input)));
    assert.equal(php.length, js.length, `game ${n} length`);
    for (let i = 0; i < js.length; i++) assert.deepEqual(php[i], js[i], `game ${n} step ${i}`);
  }
});
