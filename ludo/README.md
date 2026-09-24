# Ludo Nova

Real-time multiplayer 3D Ludo in the browser. Players join as guests: no sign-up, just a name, an avatar and a room code or invite link.

## Features

- **Guest rooms:** create a room, share the 6-letter code or link, and 2 to 4 players join in real time.
- **Play vs computer:** one tap starts a game against 3 bots. In a room, the host can also add bots to empty seats.
- **3D board:** built with Three.js. Tokens hop cell by cell, and captured tokens fly back to their yard.
- **Physics dice:** cannon-es simulates each throw. The server decides the number, and the throw is re-oriented so every player sees the same face land.
- **Ludo King rules:** a 6 brings a token out, a 6 gives another roll, three 6s in a row lose the turn, a capture or reaching home gives an extra turn, and finishing needs an exact roll. Tokens are safe on the 8 start and star cells.
- **Reconnect:** a refresh or dropped connection resumes the same seat. While a player is offline, their turns are played automatically.
- **Turn timer:** each roll and each move gets 15 seconds, then an automatic move is made. After two timeouts in a row, the player is marked away and auto-played until they act again.
- **Reactions:** 8 preset emoji reactions. There is no free-text chat, so there is nothing to moderate.
- **Mobile friendly:** the camera fits the board to portrait and landscape screens, and each player sees their own yard bottom-left.

## Security

- **Server-authoritative:** dice come from `crypto.randomInt` on the server, and every roll or move is checked against the rules engine. Clients only send intents ("roll", "move token 2").
- **Unguessable secrets:** room codes are 6 characters from a 31-letter alphabet. Each seat gets a 192-bit reconnect token that is never broadcast. Public player IDs are separate random values.
- **Input validation:** every payload is type-checked. Names are Unicode-normalized, stripped of control and markup characters and capped at 16 characters. The client renders all text with `textContent`, never `innerHTML`.
- **Abuse limits:** a per-socket token-bucket rate limit, at most 12 connections per IP, 4 KB maximum messages, a cap on total rooms, and idle rooms are swept automatically.
- **HTTP hardening:** Helmet with a strict Content Security Policy (`script-src 'self'`, `frame-ancestors 'none'`, …).

## Project layout

```
shared/engine.js    Pure rules engine (used by the server; tested)
shared/board.js     Board geometry: track, home columns, yards
shared/protocol.js  Shared constants: timings, avatars, reactions
php/                PHP backend for shared hosting (api.php, engine.php, .htaccess)
server/index.js     Express + Socket.IO server, security middleware
server/rooms.js     Rooms, seats, turn timer, bots, reconnects
client/             Vite app: Three.js scene, dice, tokens, UI
test/               node:test suites for engine, board and server
```

## Two ways to host it

| | **PHP / cPanel** (easiest) | **Node.js** |
|---|---|---|
| Needs | Any host with PHP 7.4+ | Node.js 20+ (VPS, Render, Railway, …) |
| Setup | Upload one zip to `public_html`, extract | `npm install && npm run build && npm start` |
| Real-time | HTTP polling (~0.6 s delay) | WebSockets (instant) |
| Server code | `php/api.php` + `php/engine.php` | `server/` |

Both backends use the same rules. `test/php-engine.test.js` plays random games through the JS and PHP engines and checks that every step matches.

### PHP / cPanel

```bash
npm install
npm run build:cpanel    # -> build/ludo-nova-cpanel.zip
```

Upload `ludo-nova-cpanel.zip` to `public_html` (or a subfolder), then extract it. That is the whole install. The zip contains `INSTALL.txt` with step-by-step instructions. Rooms are stored as files in `data/`, which must be writable (755). Room files begin with a PHP exit guard, so they stay private even on servers that ignore `.htaccess`.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # server on :3000 + Vite on http://localhost:5173
```

To test multiplayer, open the page in two browsers (or one normal and one private window).

Production build:

```bash
npm run build
npm start          # serves dist/ and the game server on $PORT (default 3000)
npm test
```

## Deploy

The server keeps rooms in memory, so run **one instance**. For more instances, add the Socket.IO Redis adapter and a shared room store.

- **Docker:** `docker build -t ludo-nova . && docker run -p 8080:8080 ludo-nova`
- **Render / Railway / Fly.io:** use the Dockerfile, or set the build command to `npm install && npm run build` and the start command to `npm start`. WebSockets work out of the box on these hosts.

Environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `TRUST_PROXY` | unset | Set to `1` behind a reverse proxy, so per-IP limits use `X-Forwarded-For` |
| `ALLOWED_ORIGINS` | unset | Comma-separated origins, only if the client is hosted on a different domain |

## Ideas for later

- Accounts, friends list and stats (the guest flow stays as it is)
- Redis adapter for horizontal scaling
- Team mode (2v2) and a quick mode with fewer tokens
- Custom dice and token skins
