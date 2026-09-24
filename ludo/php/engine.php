<?php
// PHP port of shared/engine.js: the pure Ludo rules. Keep the two in sync;
// test/php-engine.test.js plays random games through both and compares them.
// Compatible with PHP 7.4+.

const LUDO_COLORS = ['red', 'green', 'yellow', 'blue'];
const LUDO_TOKENS = 4;
const LUDO_TRACK = 52;
const LUDO_YARD = -1;
const LUDO_LAST_TRACK = 50;
const LUDO_HOME = 56;
const LUDO_START = ['red' => 0, 'green' => 13, 'yellow' => 26, 'blue' => 39];
const LUDO_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
const LUDO_MAX_SIXES = 3;
const LUDO_SEATS = [
    2 => ['red', 'yellow'],
    3 => ['red', 'green', 'yellow'],
    4 => ['red', 'green', 'yellow', 'blue'],
];

class LudoRuleError extends Exception {}

function ludo_global_cell(string $color, int $p): ?int
{
    if ($p < 0 || $p > LUDO_LAST_TRACK) return null;
    return (LUDO_START[$color] + $p) % LUDO_TRACK;
}

function ludo_is_safe(int $cell): bool
{
    return in_array($cell, LUDO_SAFE, true);
}

function ludo_create(array $colors): array
{
    $ordered = array_values(array_filter(LUDO_COLORS, function ($c) use ($colors) {
        return in_array($c, $colors, true);
    }));
    if (count($ordered) < 2 || count($ordered) !== count($colors)) throw new LudoRuleError('Invalid colors');
    $tokens = [];
    foreach ($ordered as $c) $tokens[$c] = array_fill(0, LUDO_TOKENS, LUDO_YARD);
    return [
        'colors' => $ordered,
        'tokens' => $tokens,
        'turn' => $ordered[0],
        'stage' => 'roll',
        'dice' => null,
        'sixesInRow' => 0,
        'legalMoves' => [],
        'rankings' => [],
        'moveCount' => 0,
    ];
}

function ludo_target(int $p, int $dice): ?int
{
    if ($p === LUDO_HOME) return null;
    if ($p === LUDO_YARD) return $dice === 6 ? 0 : null;
    $to = $p + $dice;
    return $to > LUDO_HOME ? null : $to;
}

function ludo_legal_moves(array $g, string $color, int $dice): array
{
    $moves = [];
    foreach ($g['tokens'][$color] as $i => $p) {
        if (ludo_target($p, $dice) !== null) $moves[] = $i;
    }
    return $moves;
}

function ludo_active(array $g): array
{
    return array_values(array_filter($g['colors'], function ($c) use ($g) {
        return !in_array($c, $g['rankings'], true);
    }));
}

function ludo_next_turn(array $g): string
{
    $active = ludo_active($g);
    $n = count($g['colors']);
    $idx = array_search($g['turn'], $g['colors'], true);
    for ($step = 1; $step <= $n; $step++) {
        $c = $g['colors'][($idx + $step) % $n];
        if (in_array($c, $active, true)) return $c;
    }
    return $g['turn'];
}

function ludo_end_turn(array &$g, bool $extra): void
{
    $g['dice'] = null;
    $g['legalMoves'] = [];
    if ($g['stage'] === 'over') return;
    $g['stage'] = 'roll';
    if ($extra && !in_array($g['turn'], $g['rankings'], true)) return;
    $g['sixesInRow'] = 0;
    $g['turn'] = ludo_next_turn($g);
}

/** @return array{0: array, 1: array} [game, events] */
function ludo_roll(array $g, int $dice): array
{
    if ($g['stage'] !== 'roll') throw new LudoRuleError('Not time to roll');
    if ($dice < 1 || $dice > 6) throw new LudoRuleError('Bad dice value');
    $color = $g['turn'];
    $events = [['type' => 'roll', 'color' => $color, 'value' => $dice]];

    $g['sixesInRow'] = $dice === 6 ? $g['sixesInRow'] + 1 : 0;
    if ($g['sixesInRow'] >= LUDO_MAX_SIXES) {
        $events[] = ['type' => 'three-sixes', 'color' => $color];
        $g['sixesInRow'] = 0;
        ludo_end_turn($g, false);
        $events[] = ['type' => 'turn', 'color' => $g['turn']];
        return [$g, $events];
    }

    $moves = ludo_legal_moves($g, $color, $dice);
    if (!$moves) {
        $events[] = ['type' => 'no-move', 'color' => $color];
        ludo_end_turn($g, $dice === 6);
        $events[] = ['type' => 'turn', 'color' => $g['turn']];
        return [$g, $events];
    }

    $g['dice'] = $dice;
    $g['legalMoves'] = $moves;
    $g['stage'] = 'move';
    return [$g, $events];
}

/** @return array{0: array, 1: array} [game, events] */
function ludo_move(array $g, int $token): array
{
    if ($g['stage'] !== 'move') throw new LudoRuleError('Not time to move');
    if (!in_array($token, $g['legalMoves'], true)) throw new LudoRuleError('Illegal move');
    $color = $g['turn'];
    $from = $g['tokens'][$color][$token];
    $dice = $g['dice'];
    $to = ludo_target($from, $dice);
    $g['tokens'][$color][$token] = $to;
    $g['moveCount']++;

    $events = [['type' => 'move', 'color' => $color, 'token' => $token, 'from' => $from, 'to' => $to]];
    $extra = $dice === 6;

    $cell = ludo_global_cell($color, $to);
    if ($cell !== null && !ludo_is_safe($cell)) {
        foreach ($g['colors'] as $other) {
            if ($other === $color) continue;
            foreach ($g['tokens'][$other] as $i => $p) {
                if (ludo_global_cell($other, $p) === $cell) {
                    $g['tokens'][$other][$i] = LUDO_YARD;
                    $events[] = ['type' => 'capture', 'color' => $color, 'victim' => $other, 'token' => $i, 'from' => $p];
                    $extra = true;
                }
            }
        }
    }

    if ($to === LUDO_HOME) {
        $events[] = ['type' => 'home', 'color' => $color, 'token' => $token];
        $extra = true;
        $done = true;
        foreach ($g['tokens'][$color] as $p) if ($p !== LUDO_HOME) $done = false;
        if ($done) {
            $g['rankings'][] = $color;
            $events[] = ['type' => 'finish', 'color' => $color, 'rank' => count($g['rankings'])];
        }
    }

    if (count(ludo_active($g)) <= 1) {
        foreach (ludo_active($g) as $c) $g['rankings'][] = $c;
        $g['stage'] = 'over';
        $events[] = ['type' => 'game-over', 'rankings' => $g['rankings']];
    }

    ludo_end_turn($g, $extra);
    if ($g['stage'] !== 'over') $events[] = ['type' => 'turn', 'color' => $g['turn']];
    return [$g, $events];
}

/** @return array{0: array, 1: array} [game, events] */
function ludo_forfeit(array $g, string $color): array
{
    if ($g['stage'] === 'over' || in_array($color, $g['rankings'], true)) return [$g, []];
    $events = [['type' => 'forfeit', 'color' => $color]];
    $g['colors'] = array_values(array_filter($g['colors'], function ($c) use ($color) {
        return $c !== $color;
    }));
    unset($g['tokens'][$color]);
    $wasTurn = $g['turn'] === $color;
    if (count(ludo_active($g)) <= 1) {
        foreach (ludo_active($g) as $c) $g['rankings'][] = $c;
        $g['stage'] = 'over';
        $g['dice'] = null;
        $g['legalMoves'] = [];
        $events[] = ['type' => 'game-over', 'rankings' => $g['rankings']];
        return [$g, $events];
    }
    if ($wasTurn) {
        $order = array_values(array_filter(LUDO_COLORS, function ($c) use ($g, $color) {
            return in_array($c, $g['colors'], true) || $c === $color;
        }));
        $idx = array_search($color, $order, true);
        $after = array_merge(array_slice($order, $idx + 1), array_slice($order, 0, $idx));
        $active = ludo_active($g);
        foreach ($after as $c) {
            if (in_array($c, $active, true)) { $g['turn'] = $c; break; }
        }
        $g['stage'] = 'roll';
        $g['dice'] = null;
        $g['legalMoves'] = [];
        $g['sixesInRow'] = 0;
        $events[] = ['type' => 'turn', 'color' => $g['turn']];
    }
    return [$g, $events];
}

function ludo_bot_move(array $g): int
{
    $color = $g['turn'];
    $dice = $g['dice'];
    $best = $g['legalMoves'][0];
    $bestScore = -INF;
    foreach ($g['legalMoves'] as $i) {
        $from = $g['tokens'][$color][$i];
        $to = ludo_target($from, $dice);
        $score = $to / 10;
        if ($to === LUDO_HOME) $score += 100;
        if ($from === LUDO_YARD) $score += 60;
        $cell = ludo_global_cell($color, $to);
        if ($cell !== null) {
            if (!ludo_is_safe($cell) && ludo_occupied_by_opponent($g, $color, $cell)) $score += 80;
            if (ludo_is_safe($cell)) $score += 25;
            else $score -= ludo_threat($g, $color, $cell) * 30;
        } elseif ($to > LUDO_LAST_TRACK) {
            $score += 30;
        }
        $fromCell = ludo_global_cell($color, $from);
        if ($fromCell !== null && !ludo_is_safe($fromCell)) $score += ludo_threat($g, $color, $fromCell) * 20;
        if ($score > $bestScore) {
            $bestScore = $score;
            $best = $i;
        }
    }
    return $best;
}

function ludo_occupied_by_opponent(array $g, string $color, int $cell): bool
{
    foreach ($g['colors'] as $c) {
        if ($c === $color) continue;
        foreach ($g['tokens'][$c] as $p) if (ludo_global_cell($c, $p) === $cell) return true;
    }
    return false;
}

function ludo_threat(array $g, string $color, int $cell): int
{
    $n = 0;
    foreach ($g['colors'] as $c) {
        if ($c === $color) continue;
        foreach ($g['tokens'][$c] as $p) {
            $gc = ludo_global_cell($c, $p);
            if ($gc === null) continue;
            $dist = ($cell - $gc + LUDO_TRACK) % LUDO_TRACK;
            if ($dist >= 1 && $dist <= 6 && $p + $dist <= LUDO_LAST_TRACK) $n++;
        }
    }
    return $n;
}
