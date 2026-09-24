// Board layout on a 15x15 grid, [col, row] with row 0 at the top.
// Yards: red top-left, green top-right, yellow bottom-right, blue bottom-left.
import { COLORS, START_INDEX, TRACK_LENGTH, LAST_TRACK, HOME, globalCell } from './engine.js';

function run(from, to, fixed, axis) {
  const cells = [];
  const step = from <= to ? 1 : -1;
  for (let v = from; v !== to + step; v += step) cells.push(axis === 'x' ? [v, fixed] : [fixed, v]);
  return cells;
}

// Shared track, index 0 = red's start cell, moving clockwise.
export const TRACK = [
  ...run(1, 5, 6, 'x'),
  ...run(5, 0, 6, 'y'),
  [7, 0],
  ...run(0, 5, 8, 'y'),
  ...run(9, 14, 6, 'x'),
  [14, 7],
  ...run(14, 9, 8, 'x'),
  ...run(9, 14, 8, 'y'),
  [7, 14],
  ...run(14, 9, 6, 'y'),
  ...run(5, 0, 8, 'x'),
  [0, 7],
  [0, 6],
];
if (TRACK.length !== TRACK_LENGTH) throw new Error('Track layout is broken');

export const HOME_COLUMN = {
  red: run(1, 5, 7, 'x'),
  green: run(1, 5, 7, 'y'),
  yellow: run(13, 9, 7, 'x'),
  blue: run(13, 9, 7, 'y'),
};

// Yard squares (top-left corner of the 6x6 area).
export const YARD_ORIGIN = { red: [0, 0], green: [9, 0], yellow: [9, 9], blue: [0, 9] };

// Direction from the board centre towards each color's side of the finish.
export const HOME_SIDE = { red: [-1, 0], green: [0, -1], yellow: [1, 0], blue: [0, 1] };

/** Grid [col,row] -> world [x,z] with the board centred on the origin. */
export const toWorld = ([c, r]) => [c - 7, r - 7];

export function yardCenter(color) {
  const [c, r] = YARD_ORIGIN[color];
  return toWorld([c + 2.5, r + 2.5]);
}

export function yardSlot(color, token) {
  const [x, z] = yardCenter(color);
  const dx = token % 2 ? 0.95 : -0.95;
  const dz = token < 2 ? -0.95 : 0.95;
  return [x + dx, z + dz];
}

export function homeSpot(color, token) {
  const [sx, sz] = HOME_SIDE[color];
  const spread = (token - 1.5) * 0.36;
  // Along the side of the centre triangle, perpendicular to its direction.
  return [sx * 0.85 + sz * spread, sz * 0.85 + sx * spread];
}

/** World [x,z] where a token with the given progress rests (before stacking offsets). */
export function tokenSpot(color, token, progress) {
  if (progress < 0) return yardSlot(color, token);
  if (progress === HOME) return homeSpot(color, token);
  if (progress > LAST_TRACK) return toWorld(HOME_COLUMN[color][progress - LAST_TRACK - 1]);
  return toWorld(TRACK[globalCell(color, progress)]);
}

/** A key identifying the square a token occupies, for stacking tokens on one cell. */
export function cellKey(color, token, progress) {
  if (progress < 0) return `yard:${color}:${token}`;
  if (progress === HOME) return `home:${color}:${token}`;
  if (progress > LAST_TRACK) return `col:${color}:${progress}`;
  return `track:${globalCell(color, progress)}`;
}

export const START_CELLS = Object.fromEntries(COLORS.map((c) => [c, TRACK[START_INDEX[c]]]));
