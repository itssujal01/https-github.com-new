<?php
// Ludo Nova game server for plain PHP hosting (cPanel, shared hosting).
// No database, no extensions beyond the PHP defaults: rooms are JSON files
// under data/, guarded by file locks. Clients poll this endpoint; turn timers
// and bots advance lazily whenever anyone in the room makes a request.
// Requires PHP 7.4+.

declare(strict_types=1);

require __DIR__ . '/engine.php';

const AVATAR_COUNT = 12;
const REACTION_COUNT = 8;
const BOT_NAMES = ['Nova Bot', 'Pixel Bot', 'Turbo Bot'];
const MAX_PLAYERS = 4;
const MAX_ROOMS = 2000;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Keep in sync with shared/protocol.js TIMING.
const TURN_MS = 15000;
const BOT_THINK_MS = 700;
const DICE_MS = 1500;
const STEP_MS = 170;
const CAPTURE_MS = 700;
const REACTION_COOLDOWN_MS = 1200;

const OFFLINE_AFTER_MS = 9000;      // no poll for this long = offline, auto-played
const LOBBY_DROP_MS = 25000;        // offline this long in the lobby = seat freed
const ROOM_EXPIRE_S = 1800;         // untouched room files are deleted after 30 min
const LOG_KEEP = 40;                // event batches kept for pollers to catch up
const SEEN_WRITE_MS = 3000;         // only rewrite the file for lastSeen this often

// Room files are .php starting with an exit guard, so even if a server ignores
// .htaccess and serves data/ directly, requesting a room file reveals nothing.
const HTACCESS_DENY = "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n";
const FILE_GUARD = "<?php http_response_code(404); exit; ?>\n";

$DATA = getenv('LUDO_DATA_DIR') ?: __DIR__ . '/data';

class UserError extends Exception {}

// ------------------------------------------------------------------ output

function send(array $body, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    header('Referrer-Policy: no-referrer');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function now_ms(): int
{
    return (int) floor(microtime(true) * 1000);
}

// ----------------------------------------------------------------- storage

function ensure_data_dir(string $dir): void
{
    if (!is_dir($dir . '/rooms') && !@mkdir($dir . '/rooms', 0755, true) && !is_dir($dir . '/rooms')) {
        send(['ok' => false, 'error' => 'Server setup: the data folder is not writable'], 500);
    }
    if (!is_dir($dir . '/rate')) @mkdir($dir . '/rate', 0755, true);
    if (!file_exists($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', HTACCESS_DENY);
    }
    if (!file_exists($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
}

function room_path(string $code): string
{
    global $DATA;
    return $DATA . '/rooms/' . $code . '.php';
}

function valid_code($code): ?string
{
    if (!is_string($code)) return null;
    $code = strtoupper($code);
    return preg_match('/^[A-HJ-NP-Z2-9]{6}$/', $code) ? $code : null;
}

/**
 * Open a room with an exclusive lock, run $fn on it, save if changed.
 * $fn receives the room array by reference and returns the reply.
 */
function with_room(string $code, callable $fn, bool $create = false)
{
    $path = room_path($code);
    if (!$create && !file_exists($path)) throw new UserError('Room not found');
    $fh = @fopen($path, $create ? 'x+' : 'r+');
    if (!$fh) throw new UserError($create ? 'Try again' : 'Room not found');
    try {
        if (!flock($fh, LOCK_EX)) throw new UserError('Server busy, try again');
        $raw = stream_get_contents($fh);
        $room = null;
        if ($raw !== false && strlen($raw) > strlen(FILE_GUARD)) {
            $room = json_decode(substr($raw, strlen(FILE_GUARD)), true);
        }
        if (!$create && !is_array($room)) throw new UserError('Room not found');
        $before = $create ? '' : json_encode($room, JSON_UNESCAPED_UNICODE);
        $reply = $fn($room);
        if ($room === null) {
            // Room deleted by the handler.
            ftruncate($fh, 0);
            flock($fh, LOCK_UN);
            fclose($fh);
            $fh = null;
            @unlink($path);
            return $reply;
        }
        $after = json_encode($room, JSON_UNESCAPED_UNICODE);
        if ($after !== $before) {
            ftruncate($fh, 0);
            rewind($fh);
            fwrite($fh, FILE_GUARD . $after);
            fflush($fh);
        }
        return $reply;
    } finally {
        if ($fh) {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
    }
}

function sweep_rooms(): void
{
    global $DATA;
    $limit = time() - ROOM_EXPIRE_S;
    foreach (glob($DATA . '/rooms/*.php') ?: [] as $f) {
        if (@filemtime($f) < $limit) @unlink($f);
    }
    foreach (glob($DATA . '/rate/*.json') ?: [] as $f) {
        if (@filemtime($f) < time() - 600) @unlink($f);
    }
}

// ------------------------------------------------------------ rate limiting

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0');
}

/** Per-IP token bucket: bursts of 60 requests, refilling 15 per second. */
function rate_limit(): void
{
    global $DATA;
    if (getenv('LUDO_NO_RATE_LIMIT') === '1') return; // automated tests only
    $path = $DATA . '/rate/' . substr(hash('sha256', client_ip() . '|ludo'), 0, 32) . '.json';
    $fh = @fopen($path, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    $state = json_decode((string) stream_get_contents($fh), true);
    $now = microtime(true);
    $tokens = is_array($state) ? (float) $state['t'] : 60.0;
    $last = is_array($state) ? (float) $state['l'] : $now;
    $tokens = min(60.0, $tokens + ($now - $last) * 15);
    $allowed = $tokens >= 1;
    if ($allowed) $tokens -= 1;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode(['t' => $tokens, 'l' => $now]));
    flock($fh, LOCK_UN);
    fclose($fh);
    if (!$allowed) send(['ok' => false, 'error' => 'Slow down'], 429);
}

// ------------------------------------------------------------------ helpers

function rand_id(int $bytes): string
{
    return bin2hex(random_bytes($bytes));
}

function new_code(): string
{
    for ($attempt = 0; $attempt < 20; $attempt++) {
        $code = '';
        for ($i = 0; $i < 6; $i++) $code .= CODE_ALPHABET[random_int(0, strlen(CODE_ALPHABET) - 1)];
        if (!file_exists(room_path($code))) return $code;
    }
    throw new UserError('Server busy, try again');
}

function clean_name($raw): ?string
{
    if (!is_string($raw)) return null;
    if (class_exists('Normalizer')) $raw = (string) Normalizer::normalize($raw, Normalizer::FORM_KC);
    $name = preg_replace('/[\p{C}<>&"\'`\\\\]/u', '', $raw);
    if ($name === null) return null; // invalid UTF-8
    $name = trim(preg_replace('/\s+/u', ' ', $name));
    $name = function_exists('mb_substr') ? mb_substr($name, 0, 16, 'UTF-8') : substr($name, 0, 16);
    return $name === '' ? null : $name;
}

function clean_avatar($raw): int
{
    return is_int($raw) && $raw >= 0 && $raw < AVATAR_COUNT ? $raw : 0;
}

function find_player(array $room, string $token): ?int
{
    foreach ($room['players'] as $i => $p) {
        if ($p['token'] !== null && hash_equals($p['token'], $token)) return $i;
    }
    return null;
}

function player_by_color(array $room, ?string $color): ?int
{
    foreach ($room['players'] as $i => $p) if ($p['color'] === $color && $color !== null) return $i;
    return null;
}

function is_online(array $p, int $now): bool
{
    return $p['isBot'] || $now - $p['lastSeen'] < OFFLINE_AFTER_MS;
}

function animation_time(array $events): int
{
    $ms = 0;
    foreach ($events as $e) {
        switch ($e['type']) {
            case 'roll': $ms += DICE_MS; break;
            case 'move': $ms += STEP_MS * ($e['from'] < 0 ? 1 : $e['to'] - $e['from']) + 250; break;
            case 'capture': $ms += CAPTURE_MS; break;
            case 'three-sixes':
            case 'no-move': $ms += 500; break;
        }
    }
    return $ms;
}

function new_room(string $code): array
{
    $now = now_ms();
    return [
        'code' => $code,
        'phase' => 'lobby',
        'hostId' => null,
        'players' => [],
        'game' => null,
        'seq' => 0,
        'log' => [],
        'reactions' => [],
        'reactionSeq' => 0,
        'lastActionAt' => $now,
        'lastAnim' => 0,
    ];
}

function add_human(array &$room, string $name, int $avatar): array
{
    if ($room['phase'] !== 'lobby') throw new UserError('Game already started');
    if (count($room['players']) >= MAX_PLAYERS) throw new UserError('Room is full');
    $p = [
        'id' => rand_id(8), 'token' => rand_id(24), 'name' => $name, 'avatar' => $avatar,
        'isBot' => false, 'color' => null, 'timeouts' => 0, 'lastSeen' => now_ms(), 'lastReaction' => 0,
    ];
    $room['players'][] = $p;
    if ($room['hostId'] === null) $room['hostId'] = $p['id'];
    return $p;
}

function remove_player(array &$room, int $idx): void
{
    $p = $room['players'][$idx];
    if ($room['phase'] === 'playing' && $p['color'] !== null) {
        [$game, $events] = ludo_forfeit($room['game'], $p['color']);
        array_splice($room['players'], $idx, 1);
        apply_game($room, $game, $events);
    } else {
        array_splice($room['players'], $idx, 1);
    }
    if ($room['hostId'] === $p['id']) {
        $room['hostId'] = null;
        foreach ($room['players'] as $q) {
            if (!$q['isBot']) { $room['hostId'] = $q['id']; break; }
        }
    }
}

function apply_game(array &$room, array $game, array $events): void
{
    $room['game'] = $game;
    if ($game['stage'] === 'over' && $room['phase'] === 'playing') $room['phase'] = 'finished';
    if ($events) {
        $room['seq']++;
        $room['log'][] = ['seq' => $room['seq'], 'events' => $events];
        if (count($room['log']) > LOG_KEEP) $room['log'] = array_slice($room['log'], -LOG_KEEP);
    }
    $room['lastActionAt'] = now_ms();
    $room['lastAnim'] = animation_time($events);
}

function auto_played(array $room, int $now): bool
{
    $i = player_by_color($room, $room['game']['turn']);
    if ($i === null) return true;
    $p = $room['players'][$i];
    return $p['isBot'] || !is_online($p, $now) || $p['timeouts'] >= 2;
}

/** Human turn deadline in ms, or null when the current seat is auto-played. */
function turn_deadline(array $room, int $now): ?int
{
    if ($room['phase'] !== 'playing' || auto_played($room, $now)) return null;
    return $room['lastActionAt'] + $room['lastAnim'] + TURN_MS;
}

/** Advance bots, offline players and expired turns. Called on every request. */
function tick(array &$room): void
{
    $now = now_ms();
    if ($room['phase'] === 'lobby') {
        foreach ($room['players'] as $i => $p) {
            if (!$p['isBot'] && $now - $p['lastSeen'] > LOBBY_DROP_MS) {
                remove_player($room, $i);
                tick($room);
                return;
            }
        }
        return;
    }
    // At most a few actions per request, so clients see a steady stream.
    for ($guard = 0; $guard < 3 && $room['phase'] === 'playing'; $guard++) {
        $ready = $room['lastActionAt'] + $room['lastAnim'];
        $auto = auto_played($room, $now);
        if ($auto && $now < $ready + BOT_THINK_MS) return;
        if (!$auto && $now < $ready + TURN_MS) return;
        if (!$auto) {
            $i = player_by_color($room, $room['game']['turn']);
            if ($i !== null) $room['players'][$i]['timeouts']++;
        }
        $game = $room['game'];
        if ($game['stage'] === 'roll') [$game, $events] = ludo_roll($game, random_int(1, 6));
        else [$game, $events] = ludo_move($game, ludo_bot_move($game));
        apply_game($room, $game, $events);
        // Next action is timed from now; stop so animations can play.
        return;
    }
}

function public_state(array $room): array
{
    $now = now_ms();
    $players = [];
    foreach ($room['players'] as $p) {
        $players[] = [
            'id' => $p['id'], 'name' => $p['name'], 'avatar' => $p['avatar'], 'isBot' => $p['isBot'],
            'connected' => is_online($p, $now), 'color' => $p['color'],
            'auto' => !$p['isBot'] && $p['timeouts'] >= 2,
        ];
    }
    return [
        'code' => $room['code'],
        'phase' => $room['phase'],
        'hostId' => $room['hostId'],
        'players' => $players,
        'game' => $room['game'],
        'deadline' => $room['phase'] === 'playing' ? turn_deadline($room, $now) : null,
        'serverNow' => $now,
        'seq' => $room['seq'],
    ];
}

function join_reply(array $room, array $player): array
{
    return [
        'ok' => true, 'code' => $room['code'], 'token' => $player['token'],
        'playerId' => $player['id'], 'state' => public_state($room),
    ];
}

// ---------------------------------------------------------------- requests

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    send(['ok' => false, 'error' => 'POST only'], 405);
}
$raw = file_get_contents('php://input', false, null, 0, 4097);
if ($raw === false || strlen($raw) > 4096) send(['ok' => false, 'error' => 'Bad request'], 400);
$req = json_decode($raw, true);
if (!is_array($req) || !isset($req['action']) || !is_string($req['action'])) {
    send(['ok' => false, 'error' => 'Bad request'], 400);
}

ensure_data_dir($DATA);
rate_limit();

$action = $req['action'];
$auth = function () use ($req): array {
    $code = valid_code($req['code'] ?? null);
    $token = $req['key'] ?? null; // the player's secret; 'token' is the piece index in 'move'
    if (!$code || !is_string($token) || strlen($token) !== 48) throw new UserError('Session expired');
    if (!file_exists(room_path($code))) throw new UserError('Session expired');
    return [$code, $token];
};

/**
 * Run an authenticated action on the caller's room.
 * $fn(&$room, $idx) returns an optional reply array.
 */
$act = function (callable $fn) use ($auth) {
    [$code, $token] = $auth();
    return with_room($code, function (&$room) use ($fn, $token) {
        $idx = find_player($room, $token);
        if ($idx === null) throw new UserError('Session expired');
        $now = now_ms();
        if ($now - $room['players'][$idx]['lastSeen'] > SEEN_WRITE_MS) $room['players'][$idx]['lastSeen'] = $now;
        tick($room);
        $idx = find_player($room, $token);
        if ($idx === null) throw new UserError('Session expired');
        $reply = $fn($room, $idx);
        if ($room !== null && count(array_filter($room['players'], function ($p) { return !$p['isBot']; })) === 0) {
            $room = null; // last human left
        }
        return $reply ?? ['ok' => true];
    });
};

$requireHost = function (array $room, int $idx): void {
    if ($room['players'][$idx]['id'] !== $room['hostId']) throw new UserError('Only the host can do that');
};

$requireTurn = function (array $room, int $idx, string $stage): void {
    if ($room['phase'] !== 'playing') throw new UserError('Game is not running');
    if ($room['players'][$idx]['color'] !== $room['game']['turn']) throw new UserError('Not your turn');
    if ($room['game']['stage'] !== $stage) throw new UserError("You can't $stage now");
};

try {
    switch ($action) {
        case 'create': {
            $name = clean_name($req['name'] ?? null);
            if (!$name) throw new UserError('Enter a name');
            if (random_int(1, 10) === 1) sweep_rooms();
            if (count(glob($DATA . '/rooms/*.php') ?: []) >= MAX_ROOMS) throw new UserError('Server is busy, try again soon');
            $code = new_code();
            $reply = with_room($code, function (&$room) use ($code, $name, $req) {
                $room = new_room($code);
                $p = add_human($room, $name, clean_avatar($req['avatar'] ?? 0));
                return join_reply($room, $p);
            }, true);
            send($reply);
        }
        case 'join': {
            $name = clean_name($req['name'] ?? null);
            if (!$name) throw new UserError('Enter a name');
            $code = valid_code($req['code'] ?? null);
            if (!$code) throw new UserError('Room not found');
            send(with_room($code, function (&$room) use ($name, $req) {
                tick($room);
                $p = add_human($room, $name, clean_avatar($req['avatar'] ?? 0));
                return join_reply($room, $p);
            }));
        }
        case 'resume':
            send($act(function (&$room, $idx) {
                $room['players'][$idx]['lastSeen'] = now_ms();
                $room['players'][$idx]['timeouts'] = 0;
                return join_reply($room, $room['players'][$idx]);
            }));
        case 'poll': {
            $since = is_int($req['since'] ?? null) ? $req['since'] : 0;
            $rsince = is_int($req['rsince'] ?? null) ? $req['rsince'] : 0;
            send($act(function (&$room) use ($since, $rsince) {
                $batches = array_values(array_filter($room['log'], function ($b) use ($since) { return $b['seq'] > $since; }));
                $reactions = array_values(array_filter($room['reactions'], function ($r) use ($rsince) { return $r['id'] > $rsince; }));
                return ['ok' => true, 'batches' => $batches, 'reactions' => $reactions, 'state' => public_state($room)];
            }));
        }
        case 'leave':
            send($act(function (&$room, $idx) {
                remove_player($room, $idx);
                return ['ok' => true];
            }));
        case 'addBot':
            send($act(function (&$room, $idx) use ($requireHost) {
                $requireHost($room, $idx);
                if ($room['phase'] !== 'lobby') throw new UserError('Game already started');
                if (count($room['players']) >= MAX_PLAYERS) throw new UserError('Room is full');
                $used = array_column($room['players'], 'name');
                $name = 'Bot';
                foreach (BOT_NAMES as $n) if (!in_array($n, $used, true)) { $name = $n; break; }
                $room['players'][] = [
                    'id' => rand_id(8), 'token' => null, 'name' => $name, 'avatar' => random_int(0, AVATAR_COUNT - 1),
                    'isBot' => true, 'color' => null, 'timeouts' => 0, 'lastSeen' => 0, 'lastReaction' => 0,
                ];
                return null;
            }));
        case 'remove':
            send($act(function (&$room, $idx) use ($requireHost, $req) {
                $requireHost($room, $idx);
                if ($room['phase'] !== 'lobby') throw new UserError('Game already started');
                $target = null;
                foreach ($room['players'] as $i => $p) if ($p['id'] === ($req['playerId'] ?? null)) $target = $i;
                if ($target === null || $target === $idx) throw new UserError('Cannot remove that player');
                array_splice($room['players'], $target, 1);
                return null;
            }));
        case 'start':
            send($act(function (&$room, $idx) use ($requireHost) {
                $requireHost($room, $idx);
                if ($room['phase'] !== 'lobby') throw new UserError('Game already started');
                $n = count($room['players']);
                if ($n < 2) throw new UserError('Need at least 2 players (add a bot)');
                $seats = LUDO_SEATS[$n];
                foreach ($room['players'] as $i => &$p) { $p['color'] = $seats[$i]; $p['timeouts'] = 0; }
                unset($p);
                $room['phase'] = 'playing';
                $game = ludo_create($seats);
                apply_game($room, $game, [['type' => 'start'], ['type' => 'turn', 'color' => $game['turn']]]);
                return null;
            }));
        case 'rematch':
            send($act(function (&$room, $idx) use ($requireHost) {
                $requireHost($room, $idx);
                if ($room['phase'] !== 'finished') throw new UserError('Game is not over yet');
                $room['phase'] = 'lobby';
                $room['game'] = null;
                foreach ($room['players'] as &$p) $p['color'] = null;
                unset($p);
                return null;
            }));
        case 'roll':
            send($act(function (&$room, $idx) use ($requireTurn) {
                $requireTurn($room, $idx, 'roll');
                $room['players'][$idx]['timeouts'] = 0;
                [$game, $events] = ludo_roll($room['game'], random_int(1, 6));
                apply_game($room, $game, $events);
                return null;
            }));
        case 'move':
            send($act(function (&$room, $idx) use ($requireTurn, $req) {
                $requireTurn($room, $idx, 'move');
                $token = $req['token'] ?? null;
                if (!is_int($token) || !in_array($token, $room['game']['legalMoves'], true)) {
                    throw new UserError('That token cannot move');
                }
                $room['players'][$idx]['timeouts'] = 0;
                [$game, $events] = ludo_move($room['game'], $token);
                apply_game($room, $game, $events);
                return null;
            }));
        case 'react':
            send($act(function (&$room, $idx) use ($req) {
                $r = $req['reaction'] ?? null;
                $now = now_ms();
                $p = &$room['players'][$idx];
                if (!is_int($r) || $r < 0 || $r >= REACTION_COUNT || $now - $p['lastReaction'] < REACTION_COOLDOWN_MS) return null;
                $p['lastReaction'] = $now;
                $room['reactionSeq']++;
                $room['reactions'][] = ['id' => $room['reactionSeq'], 'playerId' => $p['id'], 'reaction' => $r, 'at' => $now];
                $room['reactions'] = array_slice($room['reactions'], -10);
                return null;
            }));
        default:
            send(['ok' => false, 'error' => 'Unknown action'], 400);
    }
} catch (UserError $e) {
    send(['ok' => false, 'error' => $e->getMessage()]);
} catch (LudoRuleError $e) {
    send(['ok' => false, 'error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('ludo api: ' . $e);
    send(['ok' => false, 'error' => 'Something went wrong'], 500);
}
