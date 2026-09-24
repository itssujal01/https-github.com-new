import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACK, HOME_COLUMN } from '../shared/board.js';
import { COLORS, globalCell, LAST_TRACK, START_INDEX, SAFE_CELLS } from '../shared/engine.js';

const adjacent = ([a, b], [c, d]) => Math.abs(a - c) + Math.abs(b - d) === 1
  || (Math.abs(a - c) === 1 && Math.abs(b - d) === 1); // corners of the cross turn diagonally

test('the track is a closed loop of distinct neighbouring cells', () => {
  assert.equal(new Set(TRACK.map(String)).size, 52);
  TRACK.forEach((cell, i) => assert.ok(adjacent(cell, TRACK[(i + 1) % 52]), `gap after ${i}`));
});

test('each home column starts next to its colour\'s last track cell', () => {
  for (const c of COLORS) {
    const entry = TRACK[globalCell(c, LAST_TRACK)];
    assert.ok(adjacent(entry, HOME_COLUMN[c][0]), c);
    assert.ok(SAFE_CELLS.has(START_INDEX[c]));
  }
});
