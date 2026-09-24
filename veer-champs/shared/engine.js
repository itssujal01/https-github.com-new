// Pure Ludo rules engine. No I/O, no randomness: the caller supplies dice
// values, so the server can use a secure RNG and tests can use fixed rolls.

export const COLORS = ['red', 'green', 'yellow', 'blue'];
export const TOKENS_PER_PLAYER = 4;
export const TRACK_LENGTH = 52;

// Token progress along its own route:
//   -1        in the yard
//   0..50     on the shared track (global cell = (START[color] + p) % 52)
//   51..55    in the color's home column
//   56        finished
export const YARD = -1;
export const LAST_TRACK = 50;
export const HOME = 56;

export const START_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };
// Start cells plus the four star cells (8 cells after each start).
export const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export const MAX_SIXES_IN_A_ROW = 3;

// Which seats play for a given player count (opposite corners for 2 players).
export const SEATS_FOR_COUNT = {
  2: ['red', 'yellow'],
  3: ['red', 'green', 'yellow'],
  4: ['red', 'green', 'yellow', 'blue'],
};

export function globalCell(color, progress) {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (START_INDEX[color] + progress) % TRACK_LENGTH;
}

export function isSafeCell(cell) {
  return SAFE_CELLS.has(cell);
}

/**
 * @param {string[]} colors seats taking part, in turn order
 * @param {{teams?: Record<string, number>}} [options] teams maps colour -> team id (2v2 mode)
 */
export function createGame(colors, options = {}) {
  if (!Array.isArray(colors) || colors.length < 2 || colors.length > 4) {
    throw new Error('A game needs 2 to 4 colors');
  }
  const ordered = COLORS.filter((c) => colors.includes(c));
  if (ordered.length !== colors.length) throw new Error('Invalid colors');
  const tokens = {};
  for (const c of ordered) tokens[c] = Array(TOKENS_PER_PLAYER).fill(YARD);
  return {
    colors: ordered,
    tokens,
    turn: ordered[0],
    stage: 'roll', // 'roll' | 'move' | 'over'
    dice: null,
    sixesInRow: 0,
    legalMoves: [],
    rankings: [],
    moveCount: 0,
    teams: options.teams ?? null,
  };
}

export function cloneGame(game) {
  return structuredClone(game);
}

/** Destination progress for a token, or null if the move is not allowed. */
export function targetFor(progress, dice) {
  if (progress === HOME) return null;
  if (progress === YARD) return dice === 6 ? 0 : null;
  const to = progress + dice;
  return to > HOME ? null : to;
}

export function legalMoves(game, color, dice) {
  const moves = [];
  game.tokens[color].forEach((p, i) => {
    if (targetFor(p, dice) !== null) moves.push(i);
  });
  return moves;
}

export function sameTeam(game, a, b) {
  return !!game.teams && game.teams[a] === game.teams[b];
}

function activeColors(game) {
  return game.colors.filter((c) => !game.rankings.includes(c));
}

function nextTurn(game) {
  const active = activeColors(game);
  const idx = game.colors.indexOf(game.turn);
  for (let step = 1; step <= game.colors.length; step++) {
    const c = game.colors[(idx + step) % game.colors.length];
    if (active.includes(c)) return c;
  }
  return game.turn;
}

function endTurn(game, extraTurn) {
  game.dice = null;
  game.legalMoves = [];
  if (game.stage === 'over') return;
  game.stage = 'roll';
  if (extraTurn && !game.rankings.includes(game.turn)) return;
  game.sixesInRow = 0;
  game.turn = nextTurn(game);
}

/**
 * Apply a dice roll for the current player.
 * @returns {{game: object, events: object[]}}
 */
export function applyRoll(input, dice) {
  if (input.stage !== 'roll') throw new Error('Not time to roll');
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new Error('Bad dice value');
  const game = cloneGame(input);
  const color = game.turn;
  const events = [{ type: 'roll', color, value: dice }];

  game.sixesInRow = dice === 6 ? game.sixesInRow + 1 : 0;
  if (game.sixesInRow >= MAX_SIXES_IN_A_ROW) {
    events.push({ type: 'three-sixes', color });
    game.sixesInRow = 0;
    endTurn(game, false);
    events.push({ type: 'turn', color: game.turn });
    return { game, events };
  }

  const moves = legalMoves(game, color, dice);
  if (moves.length === 0) {
    events.push({ type: 'no-move', color });
    // A six still earns another roll even when nothing can move.
    endTurn(game, dice === 6);
    events.push({ type: 'turn', color: game.turn });
    return { game, events };
  }

  game.dice = dice;
  game.legalMoves = moves;
  game.stage = 'move';
  return { game, events };
}

/**
 * Move one of the current player's tokens by the rolled dice.
 * @returns {{game: object, events: object[]}}
 */
export function applyMove(input, tokenIndex) {
  if (input.stage !== 'move') throw new Error('Not time to move');
  if (!input.legalMoves.includes(tokenIndex)) throw new Error('Illegal move');
  const game = cloneGame(input);
  const color = game.turn;
  const from = game.tokens[color][tokenIndex];
  const to = targetFor(from, game.dice);
  const dice = game.dice;
  game.tokens[color][tokenIndex] = to;
  game.moveCount++;

  const events = [{ type: 'move', color, token: tokenIndex, from, to }];
  let extraTurn = dice === 6;

  const cell = globalCell(color, to);
  if (cell !== null && !isSafeCell(cell)) {
    for (const other of game.colors) {
      if (other === color || sameTeam(game, color, other)) continue;
      game.tokens[other].forEach((p, i) => {
        if (globalCell(other, p) === cell) {
          game.tokens[other][i] = YARD;
          events.push({ type: 'capture', color, victim: other, token: i, from: p });
          extraTurn = true;
        }
      });
    }
  }

  if (to === HOME) {
    events.push({ type: 'home', color, token: tokenIndex });
    extraTurn = true;
    if (game.tokens[color].every((p) => p === HOME)) {
      game.rankings.push(color);
      events.push({ type: 'finish', color, rank: game.rankings.length });
    }
  }

  if (activeColors(game).length <= 1) {
    game.rankings.push(...activeColors(game));
    game.stage = 'over';
    events.push({ type: 'game-over', rankings: [...game.rankings] });
  }

  endTurn(game, extraTurn);
  if (game.stage !== 'over') events.push({ type: 'turn', color: game.turn });
  return { game, events };
}

/** Remove a player who left for good; their tokens leave the board. */
export function forfeit(input, color) {
  const game = cloneGame(input);
  if (game.stage === 'over' || game.rankings.includes(color)) return { game, events: [] };
  const events = [{ type: 'forfeit', color }];
  game.colors = game.colors.filter((c) => c !== color);
  delete game.tokens[color];
  const wasTurn = game.turn === color;
  if (activeColors(game).length <= 1) {
    game.rankings.push(...activeColors(game));
    game.stage = 'over';
    game.dice = null;
    game.legalMoves = [];
    events.push({ type: 'game-over', rankings: [...game.rankings] });
    return { game, events };
  }
  if (wasTurn) {
    // Pick the next seat that was after the leaver in the original order.
    const order = COLORS.filter((c) => game.colors.includes(c) || c === color);
    const idx = order.indexOf(color);
    const after = [...order.slice(idx + 1), ...order.slice(0, idx)];
    game.turn = after.find((c) => activeColors(game).includes(c));
    game.stage = 'roll';
    game.dice = null;
    game.legalMoves = [];
    game.sixesInRow = 0;
    events.push({ type: 'turn', color: game.turn });
  }
  return { game, events };
}

/**
 * Pick a move for an automated player (bot, timeout, disconnected player).
 * Priorities: finish > capture > leave yard > escape danger > land safe > advance.
 */
export function chooseBotMove(game) {
  const color = game.turn;
  const dice = game.dice;
  let best = game.legalMoves[0];
  let bestScore = -Infinity;
  for (const i of game.legalMoves) {
    const from = game.tokens[color][i];
    const to = targetFor(from, dice);
    let score = to / 10;
    if (to === HOME) score += 100;
    if (from === YARD) score += 60;
    const cell = globalCell(color, to);
    if (cell !== null) {
      if (!isSafeCell(cell) && occupiedByOpponent(game, color, cell)) score += 80;
      if (isSafeCell(cell)) score += 25;
      else score -= threatAt(game, color, cell) * 30;
    } else if (to > LAST_TRACK) {
      score += 30; // entered home column, can no longer be captured
    }
    const fromCell = globalCell(color, from);
    if (fromCell !== null && !isSafeCell(fromCell)) score += threatAt(game, color, fromCell) * 20;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function occupiedByOpponent(game, color, cell) {
  return game.colors.some(
    (c) => c !== color && !sameTeam(game, c, color) && game.tokens[c].some((p) => globalCell(c, p) === cell),
  );
}

// Number of opponent tokens within 1..6 cells behind `cell`.
function threatAt(game, color, cell) {
  let n = 0;
  for (const c of game.colors) {
    if (c === color || sameTeam(game, c, color)) continue;
    for (const p of game.tokens[c]) {
      const g = globalCell(c, p);
      if (g === null) continue;
      const dist = (cell - g + TRACK_LENGTH) % TRACK_LENGTH;
      // An opponent can only reach cells still on its own shared-track route.
      if (dist >= 1 && dist <= 6 && p + dist <= LAST_TRACK) n++;
    }
  }
  return n;
}
