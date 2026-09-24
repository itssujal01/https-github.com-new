import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import { COLORS, YARD, HOME } from '../../shared/engine.js';
import { AVATARS, REACTIONS } from '../../shared/protocol.js';
import { World } from './scene/world.js';
import { buildBoard } from './scene/boardMesh.js';
import { Tokens } from './scene/tokens.js';
import { Dice } from './scene/dice.js';
import { wait } from './scene/tween.js';
import { Net, profile } from './net.js';
import { sound } from './sound.js';
import { h, toast } from './ui/dom.js';
import { COLOR_CSS, COLOR_LABEL } from './theme.js';

const world = new World(document.getElementById('scene'));
world.scene.add(buildBoard());
const tokens = new Tokens(world);
const dice = new Dice(world);
tokens.onStep = () => sound.step();
dice.onLand = () => sound.land();

const net = new Net();
const app = document.getElementById('app');

let room = null; // latest room state from the server
let screen = null; // 'home' | 'lobby' | 'game'
let queue = [];
let busy = false;
let generation = 0; // bumps to abandon an in-flight animation queue
let lastSeq = 0;
let clockOffset = 0;
let lastDice = null;
let autoMoveTimer = null;

const me = () => room?.players.find((p) => p.id === net.playerId);
const playerOf = (color) => room?.players.find((p) => p.color === color);
const nameOf = (color) => playerOf(color)?.name ?? COLOR_LABEL[color];

// ---------------------------------------------------------------- screens

function render(next) {
  screen = next;
  app.replaceChildren();
  app.className = `screen-${next}`;
  if (next === 'home') renderHome();
  if (next === 'lobby') renderLobby();
  if (next === 'game') renderGame();
}

function renderHome() {
  world.viewAs(null);
  dice.root.visible = false;
  tokens.setColors([]);
  const saved = profile.load();
  let avatar = saved.avatar ?? 0;
  const params = new URLSearchParams(location.search);
  const invited = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  const name = h('input', {
    class: 'input', placeholder: 'Your name', maxlength: 16, autocomplete: 'nickname', value: saved.name || '',
  });
  const code = h('input', {
    class: 'input code-input', placeholder: 'ROOM CODE', maxlength: 6, value: invited, autocapitalize: 'characters',
    oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); },
  });
  const avatars = h('div', { class: 'avatars' }, AVATARS.map((a, i) => h('button', {
    class: `avatar-pick${i === avatar ? ' on' : ''}`, type: 'button', 'aria-label': `Avatar ${i + 1}`,
    onclick: (e) => {
      avatar = i;
      avatars.querySelectorAll('.avatar-pick').forEach((b) => b.classList.remove('on'));
      e.currentTarget.classList.add('on');
    },
  }, a)));

  const getName = () => {
    const n = name.value.trim();
    if (!n) {
      name.focus();
      name.classList.add('shake');
      setTimeout(() => name.classList.remove('shake'), 500);
      toast('Enter your name first', 'error');
      return null;
    }
    profile.save({ name: n, avatar });
    sound.unlock();
    return n;
  };

  const busyWrap = (fn) => async (e) => {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    btn.disabled = true;
    try { await fn(); } finally { btn.disabled = false; }
  };

  const create = busyWrap(async () => {
    const n = getName();
    if (!n) return;
    const res = await net.create(n, avatar);
    if (!res.ok) toast(res.error, 'error');
  });
  const vsComputer = busyWrap(async () => {
    const n = getName();
    if (!n) return;
    const res = await net.create(n, avatar);
    if (!res.ok) return toast(res.error, 'error');
    for (let i = 0; i < 3; i++) await net.call('room:addBot');
    const started = await net.call('room:start');
    if (!started.ok) toast(started.error, 'error');
  });
  const join = busyWrap(async () => {
    const n = getName();
    if (!n) return;
    if (code.value.length !== 6) {
      code.focus();
      return toast('Enter the 6-character room code', 'error');
    }
    const res = await net.join(code.value, n, avatar);
    if (!res.ok) toast(res.error, 'error');
  });
  code.addEventListener('keydown', (e) => e.key === 'Enter' && join({ currentTarget: e.target.nextSibling }));

  app.append(h('main', { class: 'home' },
    h('div', { class: 'logo' },
      h('div', { class: 'logo-mark' }, h('span'), h('span'), h('span'), h('span')),
      h('h1', {}, 'LUDO ', h('b', {}, 'NOVA')),
      h('p', {}, 'Real-time 3D Ludo with friends · no sign-up')),
    h('section', { class: 'panel' },
      h('label', { class: 'label' }, 'Guest profile'),
      name,
      avatars,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary', onclick: create }, 'Create room'),
        h('button', { class: 'btn btn-ghost', onclick: vsComputer }, 'Play vs computer')),
      h('div', { class: 'divider' }, h('span', {}, 'or join a friend')),
      h('div', { class: 'row join' },
        code,
        h('button', { class: 'btn btn-accent', onclick: join }, 'Join'))),
    h('footer', { class: 'foot' }, 'Share the room code or link · 2–4 players · bots fill empty seats')));
  if (invited) (name.value ? code : name).focus();
}

function inviteLink() {
  return `${location.origin}${location.pathname}?room=${room.code}`;
}

async function share() {
  const url = inviteLink();
  if (navigator.share) {
    try { await navigator.share({ title: 'Ludo Nova', text: `Join my Ludo game! Room ${room.code}`, url }); return; } catch { /* cancelled */ }
  }
  await copy(url, 'Invite link copied');
}

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done, 'ok');
  } catch {
    toast(text, 'info', 5000);
  }
}

function renderLobby() {
  world.viewAs(null);
  dice.root.visible = false;
  tokens.setColors([]);
  const self = me();
  const host = room.hostId === net.playerId;
  const slots = Array.from({ length: 4 }, (_, i) => room.players[i]);

  app.append(h('main', { class: 'lobby' },
    h('section', { class: 'panel' },
      h('div', { class: 'lobby-head' },
        h('div', {},
          h('div', { class: 'label' }, 'Room code'),
          h('button', { class: 'room-code', title: 'Copy code', onclick: () => copy(room.code, 'Room code copied') },
            [...room.code].map((ch) => h('span', {}, ch)))),
        h('button', { class: 'btn btn-accent', onclick: share }, 'Invite friends')),
      h('ul', { class: 'slots' }, slots.map((p, i) => (p
        ? h('li', { class: 'slot filled' },
          h('span', { class: 'slot-avatar' }, AVATARS[p.avatar] ?? '🙂'),
          h('span', { class: 'slot-name' }, p.name,
            p.id === net.playerId ? h('em', {}, ' (you)') : null),
          p.id === room.hostId ? h('span', { class: 'tag tag-host' }, 'HOST') : null,
          p.isBot ? h('span', { class: 'tag' }, 'BOT') : null,
          !p.connected ? h('span', { class: 'tag tag-off' }, 'OFFLINE') : null,
          host && p.id !== net.playerId
            ? h('button', {
              class: 'slot-remove', 'aria-label': `Remove ${p.name}`,
              onclick: async () => { const r = await net.call('room:remove', { playerId: p.id }); if (!r.ok) toast(r.error, 'error'); },
            }, '✕')
            : null)
        : h('li', { class: 'slot empty' }, h('span', { class: 'slot-avatar' }, `${i + 1}`), h('span', { class: 'slot-name' }, 'Waiting for player…'))))),
      host
        ? h('div', { class: 'row' },
          h('button', {
            class: 'btn btn-ghost', disabled: room.players.length >= 4,
            onclick: async () => { const r = await net.call('room:addBot'); if (!r.ok) toast(r.error, 'error'); },
          }, '+ Add bot'),
          h('button', {
            class: 'btn btn-primary', disabled: room.players.length < 2,
            onclick: async () => { const r = await net.call('room:start'); if (!r.ok) toast(r.error, 'error'); },
          }, room.players.length < 2 ? 'Need 2+ players' : 'Start game'))
        : h('p', { class: 'hint' }, `Waiting for ${room.players.find((p) => p.id === room.hostId)?.name ?? 'the host'} to start…`),
      h('button', { class: 'btn btn-link', onclick: () => net.leave() }, 'Leave room')),
    self ? null : h('p', { class: 'hint' }, 'Joining…')));
}

// ------------------------------------------------------------------ game

let hud = null;

function viewColor() {
  return me()?.color ?? 'blue';
}

function renderGame() {
  resultsShown = false;
  const corners = ['bl', 'tl', 'tr', 'br'];
  const start = COLORS.indexOf(viewColor());
  const panels = {};
  const order = corners.map((_, i) => COLORS[(start + i) % 4]);
  order.forEach((color, i) => {
    const player = playerOf(color);
    if (!player) return;
    const timer = h('span', { class: 'timer' });
    const status = h('span', { class: 'p-status' });
    const bubble = h('span', { class: 'bubble' });
    const el = h('div', { class: `pcard pcard-${corners[i]}`, style: { '--c': COLOR_CSS[color] } },
      h('span', { class: 'p-avatar' }, timer, h('span', { class: 'p-emoji' }, AVATARS[player.avatar] ?? '🙂')),
      h('span', { class: 'p-info' },
        h('span', { class: 'p-name' }, player.name, player.id === net.playerId ? ' (you)' : ''),
        status),
      bubble);
    panels[color] = { el, timer, status, bubble };
  });

  const rollBtn = h('button', { class: 'roll-btn', onclick: () => tryRoll() }, h('span', {}, 'TAP TO ROLL'));
  const banner = h('div', { class: 'banner' });
  const reactions = h('div', { class: 'reactions' }, REACTIONS.map((r, i) => h('button', {
    class: 'reaction', onclick: () => { net.call('game:react', { reaction: i }); reactions.classList.remove('open'); },
  }, r)));
  const soundBtn = h('button', {
    class: 'icon-btn', 'aria-label': 'Toggle sound',
    onclick: (e) => { e.currentTarget.textContent = sound.toggle() ? '🔊' : '🔇'; },
  }, sound.enabled ? '🔊' : '🔇');

  app.append(
    h('div', { class: 'topbar' },
      h('button', { class: 'chip', onclick: () => copy(inviteLink(), 'Invite link copied') }, `ROOM ${room.code}`),
      h('div', { class: 'top-actions' },
        h('button', { class: 'icon-btn', 'aria-label': 'Reactions', onclick: () => reactions.classList.toggle('open') }, '😊'),
        soundBtn,
        h('button', {
          class: 'icon-btn', 'aria-label': 'Leave game',
          onclick: () => { if (room.phase !== 'playing' || confirm('Leave the game? You will forfeit.')) net.leave(); },
        }, '⎋'))),
    reactions,
    ...Object.values(panels).map((p) => p.el),
    banner,
    rollBtn,
  );
  hud = { panels, rollBtn, banner };
  world.viewAs(viewColor());
}

function updateHud(game) {
  if (!hud) return;
  const turnPlayer = playerOf(game.turn);
  const mine = turnPlayer?.id === net.playerId && room.phase === 'playing';
  for (const [color, panel] of Object.entries(hud.panels)) {
    const p = playerOf(color);
    const rank = game.rankings.indexOf(color);
    panel.el.classList.toggle('active', game.turn === color && game.stage !== 'over');
    panel.el.classList.toggle('gone', !p || !game.colors.includes(color));
    let status = '';
    if (!p || !game.colors.includes(color)) status = 'Left';
    else if (rank >= 0) status = ['🥇 1st', '🥈 2nd', '🥉 3rd', '4th'][rank];
    else if (!p.connected) status = 'Offline · auto';
    else if (p.auto) status = 'Away · auto';
    else if (p.isBot) status = 'Bot';
    else status = `${game.tokens[color].filter((t) => t === HOME).length}/4 home`;
    panel.status.textContent = status;
  }
  hud.rollBtn.classList.toggle('show', mine && game.stage === 'roll' && !busy);
  dice.setPulse(mine && game.stage === 'roll' && !busy);
  if (mine && game.stage === 'move' && !busy) tokens.setMovable(game.turn, game.legalMoves);
  else tokens.setMovable(game.turn, []);
  if (!busy && game.stage !== 'over') {
    hud.banner.textContent = mine
      ? (game.stage === 'roll' ? 'Your turn — roll the dice' : `You rolled ${game.dice} — pick a token`)
      : `${nameOf(game.turn)}'s turn`;
    hud.banner.style.setProperty('--c', COLOR_CSS[game.turn]);
    hud.banner.classList.add('show');
  }
}

// Countdown ring on the active player's card.
world.onTick(() => {
  if (!hud || !room?.game) return;
  const deadline = room.deadline;
  for (const [color, panel] of Object.entries(hud.panels)) {
    let frac = 0;
    if (deadline && color === room.game.turn && !busy) {
      const left = deadline - (Date.now() + clockOffset);
      frac = Math.max(0, Math.min(1, left / 15000));
      panel.el.classList.toggle('hurry', left < 5000);
    }
    panel.timer.style.setProperty('--p', frac.toFixed(3));
  }
});

function applyDisplay() {
  const game = room?.game;
  if (!game) return;
  tokens.setColors(game.colors);
  tokens.sync(game.tokens);
  if (game.stage !== 'over') dice.moveTo(game.turn);
  updateHud(game);
  if (room.phase === 'finished') showResults();
  else maybeAutoMove(game);
}

/** Skip the choice when it doesn't matter: one legal move, or only yard tokens. */
function maybeAutoMove(game) {
  clearTimeout(autoMoveTimer);
  if (game.stage !== 'move' || playerOf(game.turn)?.id !== net.playerId) return;
  const moves = game.legalMoves;
  const allYard = moves.every((i) => game.tokens[game.turn][i] === YARD);
  const samePlace = new Set(moves.map((i) => game.tokens[game.turn][i])).size === 1;
  if (moves.length === 1 || allYard || samePlace) {
    autoMoveTimer = setTimeout(() => sendMove(moves[0]), 350);
  }
}

async function sendMove(token) {
  clearTimeout(autoMoveTimer);
  tokens.setMovable(room.game.turn, []);
  const res = await net.call('game:move', { token });
  if (!res.ok) { toast(res.error, 'error'); sound.error(); updateHud(room.game); }
}

async function tryRoll() {
  const game = room?.game;
  if (!game || busy || game.stage !== 'roll' || playerOf(game.turn)?.id !== net.playerId) return;
  sound.unlock();
  hud.rollBtn.classList.remove('show');
  dice.setPulse(false);
  const res = await net.call('game:roll');
  if (!res.ok) { toast(res.error, 'error'); updateHud(room.game); }
}

// Event animations, played strictly in order.
async function playEvent(e) {
  switch (e.type) {
    case 'turn':
      await dice.moveTo(e.color);
      if (playerOf(e.color)?.id === net.playerId) sound.turn();
      break;
    case 'roll':
      hud?.banner.classList.remove('show');
      await dice.moveTo(e.color);
      sound.dice();
      await dice.roll(e.value);
      lastDice = e.value;
      break;
    case 'move':
      await tokens.move(e.color, e.token, e.from, e.to);
      break;
    case 'capture':
      sound.capture();
      toast(`${nameOf(e.color)} captured ${nameOf(e.victim)}!`, 'hit');
      await tokens.capture(e.victim, e.token);
      break;
    case 'home':
      sound.home();
      break;
    case 'three-sixes':
      toast(`Three 6s in a row! ${nameOf(e.color)} loses the turn`, 'hit');
      await wait(400);
      break;
    case 'no-move':
      if (playerOf(e.color)?.id === net.playerId) toast(lastDice === 6 ? 'No move — roll again' : 'No moves possible', 'info', 1400);
      await wait(350);
      break;
    case 'finish':
      toast(`${nameOf(e.color)} finished ${['1st', '2nd', '3rd'][e.rank - 1] ?? ''}!`, 'ok');
      sound.win();
      break;
    case 'forfeit':
      toast(`${COLOR_LABEL[e.color]} left the game`, 'info');
      break;
    default:
      break;
  }
}

async function pump() {
  if (busy) return;
  busy = true;
  const gen = generation;
  updateHud(room.game);
  while (queue.length && gen === generation) {
    const e = queue.shift();
    try { await playEvent(e); } catch (err) { console.error(err); }
  }
  if (gen !== generation) return; // a newer pump took over
  busy = false;
  applyDisplay();
}

/** Drop any queued animation and jump straight to the server state. */
function resync() {
  generation++;
  queue = [];
  busy = false;
  applyDisplay();
}

// ---------------------------------------------------------------- results

let resultsShown = false;
function showResults() {
  if (resultsShown || !room?.game) return;
  resultsShown = true;
  const host = room.hostId === net.playerId;
  const winner = room.game.rankings[0];
  if (playerOf(winner)?.id === net.playerId) sound.win();
  const overlay = h('div', { class: 'overlay' },
    h('section', { class: 'panel results' },
      h('div', { class: 'trophy' }, '🏆'),
      h('h2', {}, `${nameOf(winner)} wins!`),
      h('ol', { class: 'ranks' }, room.game.rankings.map((c, i) => h('li', { style: { '--c': COLOR_CSS[c] } },
        h('span', { class: 'medal' }, ['🥇', '🥈', '🥉', '4'][i]),
        h('span', { class: 'p-emoji' }, AVATARS[playerOf(c)?.avatar] ?? '🙂'),
        h('span', {}, nameOf(c))))),
      h('div', { class: 'row' },
        host ? h('button', {
          class: 'btn btn-primary',
          onclick: async () => { const r = await net.call('room:rematch'); if (!r.ok) toast(r.error, 'error'); },
        }, 'Play again') : h('p', { class: 'hint' }, 'Waiting for host to start a rematch…'),
        h('button', { class: 'btn btn-ghost', onclick: () => net.leave() }, 'Leave'))));
  app.append(overlay);
}

// ------------------------------------------------------------ net events

let hudKey = null;
function onState(state) {
  clockOffset = state.serverNow - Date.now();
  room = state;
  if (room.phase === 'lobby') {
    resultsShown = false;
    queue = [];
    busy = false;
    generation++;
    hudKey = null;
    render('lobby');
    return;
  }
  // Rebuild the HUD when the seating changes (start, someone left, we (re)joined).
  const key = `${net.playerId}|${room.players.map((p) => `${p.id}:${p.color}`).join()}`;
  if (screen !== 'game' || key !== hudKey) {
    if (screen === 'lobby') toast('Game on! Roll a 6 to bring a token out.', 'ok');
    hudKey = key;
    render('game');
  }
  if (!busy) applyDisplay();
}

net.addEventListener('room:state', ({ detail }) => onState(detail));

net.addEventListener('game:events', ({ detail }) => {
  if (detail.seq <= lastSeq) return;
  const missed = detail.seq !== lastSeq + 1;
  lastSeq = detail.seq;
  // Events that start a game arrive while we still show the lobby: the state that follows covers them.
  if (!room || room.phase === 'lobby') return;
  if (missed || document.hidden || queue.length > 12) {
    // Out of sync or not visible: skip animations and show the final state.
    setTimeout(resync, 0);
    return;
  }
  queue.push(...detail.events);
  pump();
});

net.addEventListener('game:reaction', ({ detail }) => {
  const player = room?.players.find((p) => p.id === detail.playerId);
  const panel = player?.color && hud?.panels[player.color];
  if (!panel) return;
  panel.bubble.textContent = REACTIONS[detail.reaction] ?? '';
  panel.bubble.classList.remove('pop');
  void panel.bubble.offsetWidth;
  panel.bubble.classList.add('pop');
});

net.addEventListener('joined', ({ detail }) => {
  lastSeq = detail.state.seq;
  history.replaceState(null, '', location.pathname);
  onState(detail.state);
});

net.addEventListener('left', ({ detail }) => {
  room = null;
  hud = null;
  queue = [];
  busy = false;
  generation++;
  lastSeq = 0;
  hudKey = null;
  resultsShown = false;
  if (detail) toast(detail, 'info');
  render('home');
});

let offlineBanner = null;
net.addEventListener('connection', ({ detail: online }) => {
  if (online) { offlineBanner?.remove(); offlineBanner = null; return; }
  if (!offlineBanner) {
    offlineBanner = h('div', { class: 'offline' }, 'Connection lost — reconnecting…');
    document.body.append(offlineBanner);
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && busy) resync();
});

// ------------------------------------------------------------------ input

const canvas = document.getElementById('scene');
canvas.addEventListener('pointerdown', (e) => {
  if (screen !== 'game' || !room?.game || busy) return;
  const game = room.game;
  if (playerOf(game.turn)?.id !== net.playerId) return;
  if (game.stage === 'roll' && dice.hit(e)) return tryRoll();
  if (game.stage === 'move') {
    const hit = tokens.pick(e);
    if (hit) sendMove(hit.token);
  }
});

// Keyboard: Space/Enter rolls, 1-4 moves that token.
window.addEventListener('keydown', (e) => {
  if (screen !== 'game' || e.target !== document.body || !room?.game || busy) return;
  const game = room.game;
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    tryRoll();
  } else if (/^[1-4]$/.test(e.key) && game.stage === 'move' && playerOf(game.turn)?.id === net.playerId) {
    const token = Number(e.key) - 1;
    if (game.legalMoves.includes(token)) sendMove(token);
  }
});

render('home');
