import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, applyRoll, applyMove, forfeit, chooseBotMove, globalCell,
  YARD, HOME,
} from '../shared/engine.js';

const types = (events) => events.map((e) => e.type);

test('a token needs a six to leave the yard', () => {
  const g = createGame(['red', 'yellow']);
  const r = applyRoll(g, 4);
  assert.deepEqual(types(r.events), ['roll', 'no-move', 'turn']);
  assert.equal(r.game.turn, 'yellow');

  const six = applyRoll(g, 6);
  assert.equal(six.game.stage, 'move');
  assert.deepEqual(six.game.legalMoves, [0, 1, 2, 3]);
  const m = applyMove(six.game, 0);
  assert.equal(m.game.tokens.red[0], 0);
  assert.equal(m.game.turn, 'red', 'six gives another turn');
});

test('three sixes in a row forfeit the turn', () => {
  let g = createGame(['red', 'yellow']);
  g = applyMove(applyRoll(g, 6).game, 0).game;
  g = applyMove(applyRoll(g, 6).game, 0).game;
  const r = applyRoll(g, 6);
  assert.ok(types(r.events).includes('three-sixes'));
  assert.equal(r.game.turn, 'yellow');
  assert.equal(r.game.tokens.red[0], 6);
});

test('landing on an opponent captures it and grants an extra turn', () => {
  const g = createGame(['red', 'yellow']);
  // yellow progress 30 sits on global cell (26+30)%52 = 4 = red progress 4
  g.tokens.yellow[0] = 30;
  g.tokens.red[0] = 1;
  const r = applyMove(applyRoll(g, 3).game, 0);
  assert.equal(globalCell('red', 4), globalCell('yellow', 30));
  assert.ok(types(r.events).includes('capture'));
  assert.equal(r.game.tokens.yellow[0], YARD);
  assert.equal(r.game.turn, 'red');
});

test('no capture on safe cells', () => {
  const g = createGame(['red', 'yellow']);
  g.tokens.yellow[0] = 34; // global 8, a star
  g.tokens.red[0] = 5;
  const r = applyMove(applyRoll(g, 3).game, 0);
  assert.equal(r.game.tokens.yellow[0], 34);
  assert.equal(r.game.turn, 'yellow');
});

test('home column tokens cannot be captured and need an exact roll', () => {
  const g = createGame(['red', 'yellow']);
  g.tokens.red = [53, YARD, YARD, YARD];
  const over = applyRoll(g, 5);
  assert.deepEqual(types(over.events), ['roll', 'no-move', 'turn']);
  const exact = applyMove(applyRoll(g, 3).game, 0);
  assert.equal(exact.game.tokens.red[0], HOME);
  assert.ok(types(exact.events).includes('home'));
  assert.equal(exact.game.turn, 'red', 'reaching home grants an extra turn');
});

test('the game ends when only one player is left', () => {
  const g = createGame(['red', 'yellow']);
  g.tokens.red = [HOME, HOME, HOME, 55];
  const r = applyMove(applyRoll(g, 1).game, 3);
  assert.equal(r.game.stage, 'over');
  assert.deepEqual(r.game.rankings, ['red', 'yellow']);
});

test('a finished player is skipped while the others keep playing', () => {
  const g = createGame(['red', 'green', 'yellow']);
  g.tokens.red = [HOME, HOME, HOME, 55];
  const r = applyMove(applyRoll(g, 1).game, 3);
  assert.equal(r.game.stage, 'roll');
  assert.equal(r.game.turn, 'green');
  assert.deepEqual(r.game.rankings, ['red']);
});

test('forfeit removes a player and passes the turn on', () => {
  const g = createGame(['red', 'green', 'yellow']);
  const r = forfeit(g, 'red');
  assert.equal(r.game.turn, 'green');
  assert.deepEqual(r.game.colors, ['green', 'yellow']);
  const end = forfeit(r.game, 'green');
  assert.equal(end.game.stage, 'over');
  assert.deepEqual(end.game.rankings, ['yellow']);
});

test('illegal actions are rejected', () => {
  const g = createGame(['red', 'yellow']);
  assert.throws(() => applyMove(g, 0));
  assert.throws(() => applyRoll(g, 7));
  const rolled = applyRoll(g, 6).game;
  assert.throws(() => applyRoll(rolled, 3));
  assert.throws(() => applyMove(rolled, 9));
});

test('bot prefers capturing over a plain advance', () => {
  const g = createGame(['red', 'yellow']);
  g.tokens.red = [1, 20, YARD, YARD];
  g.tokens.yellow[0] = 30; // global 4 = red progress 4
  const rolled = applyRoll(g, 3).game;
  assert.equal(chooseBotMove(rolled), 0);
});

test('random games always terminate with consistent state', () => {
  for (let n = 0; n < 200; n++) {
    let g = createGame(n % 2 ? ['red', 'green', 'yellow', 'blue'] : ['green', 'blue']);
    let steps = 0;
    while (g.stage !== 'over' && steps++ < 20000) {
      if (g.stage === 'roll') g = applyRoll(g, 1 + Math.floor(Math.random() * 6)).game;
      else g = applyMove(g, chooseBotMove(g)).game;
      for (const c of g.colors) {
        for (const p of g.tokens[c]) assert.ok(p >= YARD && p <= HOME);
      }
    }
    assert.equal(g.stage, 'over');
    assert.equal(g.rankings.length, g.colors.length);
  }
});
