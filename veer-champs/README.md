# Veer Champs (UI prototype)

Clickable prototype of the Veer Champs gaming platform: every player screen and the admin panel, with Ludo playable against bots in all four modes (Classic, Quick, Timer, 2 vs 2).

This is **phase 1: design**. Data is mock data kept in the browser (localStorage). Admin changes (for example turning cash off for a mode) show up in the app right away, so the controls can be tried out. Login, wallet, payments and real multiplayer come in the next phase (PHP + MySQL on cPanel).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ can be uploaded as-is to cPanel public_html
```

## Screens

- **Player app:** splash, login (Truecaller / Google / mobile OTP / guest), OTP, profile setup, home, Ludo lobby (modes, coins/cash, tables), matchmaking, private room, match, result, tournaments + detail, leaderboard, wallet, add cash, withdraw, KYC, transactions, shop, rewards + spin wheel, refer & earn, friends, notifications, profile, match history, settings (incl. responsible gaming), help & tickets, terms / privacy / fair play.
- **Admin panel** (`#/admin`): dashboard, users (ban/unban, including chat-only, voice-only and device bans), games & modes (coins/cash per mode, entry amounts, commission, real-money master switch), tournaments, payments & withdrawal queue, KYC queue, reports & chat filter, automation & fraud rules, rewards & economy, content & push, staff & roles, audit log, settings.

## Layout

```
src/ui/kit.js        DOM helper, icons, router, sheets, toasts
src/data.js          mock data + admin-controlled config
src/game/board2d.js  flat SVG Ludo board with pin tokens
src/game/dice3d.js   CSS 3D dice
src/screens/*.js     player screens
src/admin/admin.js   admin panel
shared/engine.js     rules engine (shared with the server), now with 2v2 teams
```
