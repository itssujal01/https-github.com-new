// Ludo match screen. In the prototype the match runs locally against bots;
// in production the same screen is driven by server events.
import { h, icon, go, sheet, toast, confirmBox, money } from '../ui/kit.js';
import { Board2D, wait, TOKEN_HEX } from '../game/board2d.js';
import { Dice3D } from '../game/dice3d.js';
import { sound } from '../game/sound.js';
import { store, AVATARS, MODES } from '../data.js';
import {
  COLORS, YARD, HOME, createGame, applyRoll, applyMove, chooseBotMove, sameTeam,
} from '../../shared/engine.js';

const BOT_NAMES = ['Rohan', 'Diya', 'Kabir', 'Ishita', 'Arjun', 'Meera', 'Vivaan', 'Anaya'];
const QUICK_CHAT = ['Well played! 👏', 'Jaldi chalo! ⏩', 'Lucky roll 🍀', 'Oops 😅', 'Good game 🤝', 'Main aa raha hoon 😎', 'Bach ke rehna! 😈', 'Thank you 🙏'];
const EMOJI = ['😂', '😎', '😡', '😭', '🔥', '👏', '🙏', '😱', '🤣', '💪', '🥳', '😴'];
const CORNERS = ['bl', 'tl', 'tr', 'br'];
const TEAMS = { red: 0, yellow: 0, green: 1, blue: 1 };

export function gameScreen(modeId = 'classic', currency = 'coins', entry = '0', players = '2') {
  const mode = MODES.find((m) => m.id === modeId) ?? MODES[0];
  const nPlayers = modeId === 'team' ? 4 : Number(players) === 4 ? 4 : 2;
  const entryAmt = Number(entry) || 0;
  const cfg = store.config.modes[mode.id] ?? { commission: 10 };
  const prize = currency === 'practice' ? 0 : Math.floor(entryAmt * nPlayers * (1 - cfg.commission / 100));
  const seats = nPlayers === 2 ? ['red', 'yellow'] : [...COLORS];
  const me = store.user;
  const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const players_ = seats.map((color, i) => ({
    color,
    isMe: i === 0,
    name: i === 0 ? me.name : shuffled[i],
    avatar: i === 0 ? me.avatar : (i * 5 + 3) % AVATARS.length,
    level: i === 0 ? me.level : 3 + ((i * 7) % 20),
    muted: false,
  }));
  const myColor = 'red';
  const tokensPer = mode.tokens;

  let game = createGame(seats, { teams: mode.id === 'team' ? TEAMS : undefined });
  if (tokensPer === 2) for (const c of seats) game.tokens[c] = [YARD, YARD, HOME, HOME];
  const bonus = Object.fromEntries(seats.map((c) => [c, 0]));
  const endAt = mode.minutes ? Date.now() + mode.minutes * 60_000 : null;
  let over = false;
  let destroyed = false;
  let turnEndsAt = 0;
  let waiting = null; // resolver for the human's pending choice

  // ------------------------------------------------------------ layout

  const board = new Board2D({ tokensPerColor: tokensPer });
  board.setView(myColor);
  board.setColors(seats);
  board.sync(game.tokens);
  const dice = new Dice3D({ size: 50, skin: me.settings.dice });

  const panels = {};
  const order = CORNERS.map((_, i) => COLORS[(COLORS.indexOf(myColor) + i) % 4]);
  const panelEls = { tl: null, tr: null, bl: null, br: null };
  order.forEach((color, i) => {
    const corner = CORNERS[i];
    const p = players_.find((x) => x.color === color);
    if (!p) { panelEls[corner] = h('div', { class: 'pp pp-empty' }); return; }
    const ring = h('span', { class: 'pp-ring' });
    const sub = h('span', { class: 'pp-sub' });
    const bubble = h('span', { class: 'pp-bubble' });
    const diceSlot = h('button', { class: 'pp-dice', 'aria-label': `${p.name} dice`, onclick: () => p.isMe && waiting?.roll?.() });
    const avatarBtn = h('button', { class: 'pp-av', onclick: () => playerSheet(p) },
      ring, h('span', { class: 'avatar', style: { '--size': '46px', borderColor: TOKEN_HEX[color] } }, AVATARS[p.avatar],
        h('span', { class: 'lvl' }, p.level)));
    const el = h('div', { class: `pp pp-${corner}${p.isMe ? ' me' : ''}`, style: { '--c': TOKEN_HEX[color] } },
      avatarBtn,
      h('div', { class: 'pp-info' },
        h('span', { class: 'pp-name' }, p.isMe ? 'You' : p.name,
          mode.id === 'team' ? h('span', { class: 'pp-team' }, TEAMS[color] === TEAMS[myColor] ? 'TEAM' : 'RIVAL') : null),
        sub),
      diceSlot,
      bubble);
    panels[color] = { el, ring, sub, bubble, diceSlot, player: p };
    panelEls[corner] = el;
  });

  const clock = h('span', { class: 'g-clock' }, icon('clock'), h('b', {}, ''));
  const prizePill = h('div', { class: 'g-prize' },
    h('span', { class: 'dim' }, `${mode.name} · ${nPlayers}P`),
    currency === 'practice'
      ? h('b', {}, 'Practice')
      : h('span', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'dim' }, 'Win'), money(currency, prize)));
  const micBtn = h('button', { class: 'g-act', 'aria-label': 'Microphone', onclick: toggleMic }, icon('micOff'), h('span', {}, 'Mic'));
  const hint = h('div', { class: 'g-hint' });

  const root = h('section', { class: 'screen game-screen' },
    h('header', { class: 'g-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Menu', onclick: menu }, icon('menu')),
      prizePill,
      endAt ? clock : h('button', { class: 'icon-btn', 'aria-label': 'Sound', onclick: (e) => { e.currentTarget.replaceChildren(icon(sound.toggle() ? 'volume' : 'volumeOff')); } }, icon(sound.enabled ? 'volume' : 'volumeOff'))),
    h('div', { class: 'g-row' }, panelEls.tl, panelEls.tr),
    h('div', { class: 'g-board' }, board.el, hint),
    h('div', { class: 'g-row' }, panelEls.bl, panelEls.br),
    h('footer', { class: 'g-actions' },
      h('button', { class: 'g-act', onclick: chatSheet }, icon('chat'), h('span', {}, 'Chat')),
      h('button', { class: 'g-act', onclick: emojiSheet }, icon('smile'), h('span', {}, 'Emoji')),
      micBtn,
      h('button', { class: 'g-act', onclick: () => rulesSheet(mode) }, icon('help'), h('span', {}, 'Rules'))));

  board.onTokenTap = (color, i) => waiting?.move?.(i);

  // -------------------------------------------------------- live bits

  let raf = 0;
  const tick = () => {
    if (destroyed) return;
    const left = Math.max(0, turnEndsAt - Date.now());
    const active = panels[game.turn];
    for (const p of Object.values(panels)) p.ring.style.setProperty('--p', p === active && turnEndsAt ? (left / (store.config.turnSeconds * 1000)).toFixed(3) : '0');
    active?.el.classList.toggle('hurry', turnEndsAt && left < 5000);
    if (endAt) {
      const s = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      clock.querySelector('b').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      clock.classList.toggle('hurry', s <= 60);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  function score(color) {
    // Timer mode: 1 point per step travelled (lost when captured) + 20 per capture.
    const steps = game.tokens[color].reduce((sum, p) => sum + (p < 0 ? 0 : p + 1), 0);
    return steps + bonus[color];
  }

  function refreshPanels() {
    for (const [color, p] of Object.entries(panels)) {
      p.el.classList.toggle('active', game.turn === color && !over);
      if (mode.minutes) p.sub.replaceChildren(h('b', { class: 'gold' }, `⭐ ${score(color)}`), ' pts');
      else {
        const home = game.tokens[color].filter((t) => t === HOME).length - (4 - tokensPer);
        p.sub.textContent = `${home}/${tokensPer} home`;
      }
    }
  }

  function placeDice(color) {
    panels[color]?.diceSlot.append(dice.el);
    for (const p of Object.values(panels)) p.diceSlot.classList.toggle('has', p === panels[color]);
  }

  function say(color, text) {
    const p = panels[color];
    if (!p) return;
    p.bubble.textContent = text;
    p.bubble.classList.remove('pop');
    void p.bubble.offsetWidth;
    p.bubble.classList.add('pop');
  }

  // ------------------------------------------------------------ turns

  function waitHuman(kind, moves) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => { waiting = null; resolve({ auto: true }); }, turnEndsAt - Date.now());
      waiting = {
        roll: kind === 'roll' ? () => { clearTimeout(timeout); waiting = null; resolve({}); } : null,
        move: kind === 'move' ? (i) => { if (moves.includes(i)) { clearTimeout(timeout); waiting = null; resolve({ token: i }); } } : null,
      };
    });
  }

  async function playEvents(events) {
    for (const e of events) {
      if (destroyed) return;
      if (e.type === 'move') await board.move(e.color, e.token, e.from, e.to, () => sound.step());
      else if (e.type === 'capture') {
        sound.capture();
        bonus[e.color] += 20;
        say(e.color, '⚔️ Cut!');
        await board.capture(e.victim, e.token);
      } else if (e.type === 'home') {
        sound.home();
        say(e.color, '🏠 Home!');
      } else if (e.type === 'three-sixes') {
        toast('Three 6s — turn lost!');
      }
    }
  }

  function teamDone() {
    if (mode.id !== 'team') return null;
    for (const t of [0, 1]) {
      const members = seats.filter((c) => TEAMS[c] === t);
      if (members.every((c) => game.tokens[c].every((p) => p === HOME))) return t;
    }
    return null;
  }

  async function loop() {
    await wait(700);
    refreshPanels();
    while (!destroyed && !over) {
      const color = game.turn;
      const p = panels[color].player;
      placeDice(color);
      refreshPanels();
      turnEndsAt = Date.now() + store.config.turnSeconds * 1000;
      if (p.isMe) {
        sound.turn();
        dice.el.classList.add('tap-me');
        hint.textContent = 'Tap the dice to roll';
        hint.classList.add('show');
        await waitHuman('roll');
        dice.el.classList.remove('tap-me');
        hint.classList.remove('show');
      } else {
        await wait(650 + Math.random() * 500);
      }
      if (destroyed) return;

      const value = 1 + Math.floor(Math.random() * 6);
      sound.dice();
      await dice.roll(value);
      sound.land();
      let res = applyRoll(game, value);
      game = res.game;
      await playEvents(res.events);
      if (res.events.some((e) => e.type === 'no-move') && p.isMe) toast(value === 6 ? 'No move — roll again' : 'No moves this time');

      if (game.stage === 'move') {
        const moves = game.legalMoves;
        const spots = new Set(moves.map((i) => game.tokens[color][i]));
        let token;
        if (p.isMe && spots.size > 1) {
          turnEndsAt = Date.now() + store.config.turnSeconds * 1000;
          board.setMovable(color, moves);
          hint.textContent = 'Tap a glowing token';
          hint.classList.add('show');
          const choice = await waitHuman('move', moves);
          board.setMovable(color, []);
          hint.classList.remove('show');
          token = choice.auto ? chooseBotMove(game) : choice.token;
        } else {
          await wait(p.isMe ? 200 : 350);
          token = p.isMe ? moves[0] : chooseBotMove(game);
        }
        if (destroyed) return;
        turnEndsAt = 0;
        res = applyMove(game, token);
        game = res.game;
        await playEvents(res.events);
      }
      turnEndsAt = 0;
      refreshPanels();

      const winningTeam = teamDone();
      if (winningTeam !== null) return finish({ team: winningTeam });
      if (game.stage === 'over') return finish({});
      if (endAt && Date.now() >= endAt) return finish({ timeUp: true });
      await wait(250);
    }
  }

  function finish({ team, timeUp }) {
    over = true;
    turnEndsAt = 0;
    let ranking;
    if (mode.minutes) ranking = [...seats].sort((a, b) => score(b) - score(a));
    else if (team !== undefined) ranking = [...seats].sort((a, b) => (TEAMS[a] === team ? -1 : 0) - (TEAMS[b] === team ? -1 : 0));
    else ranking = game.rankings.length ? [...game.rankings, ...seats.filter((c) => !game.rankings.includes(c))] : seats;
    const won = team !== undefined ? TEAMS[myColor] === team : ranking[0] === myColor;
    if (won) sound.win();
    const result = {
      won, timeUp: !!timeUp, mode: mode.name, currency, entry: entryAmt, prize: won ? prize : 0, nPlayers,
      ranking: ranking.map((c) => {
        const p = players_.find((x) => x.color === c);
        return { color: c, name: p.isMe ? 'You' : p.name, avatar: p.avatar, score: mode.minutes ? score(c) : null, isMe: p.isMe };
      }),
    };
    if (won && currency !== 'practice') {
      store.update((s) => {
        if (currency === 'cash') s.user.cash.winnings += prize;
        else s.user.coins += prize;
        s.user.stats.won++;
      });
    }
    store.update((s) => { s.user.stats.played++; });
    sessionStorage.setItem('vc:result', JSON.stringify(result));
    setTimeout(() => !destroyed && go('result'), 900);
  }

  // ------------------------------------------------------------ sheets

  function menu() {
    sheet((close) => [
      h('h3', { style: { fontSize: '20px', marginBottom: '12px' } }, 'Match menu'),
      h('div', { class: 'card-flat list', style: { padding: 0 } },
        h('button', { class: 'list-item', onclick: close }, h('span', { class: 'li-ico' }, icon('play')), h('span', { class: 'grow' }, 'Resume')),
        h('button', { class: 'list-item', onclick: () => { close(); rulesSheet(mode); } }, h('span', { class: 'li-ico' }, icon('help')), h('span', { class: 'grow' }, 'How to play')),
        h('button', { class: 'list-item', onclick: () => { toast(sound.toggle() ? 'Sound on' : 'Sound off'); } }, h('span', { class: 'li-ico' }, icon('volume')), h('span', { class: 'grow' }, 'Sound on/off')),
        h('button', {
          class: 'list-item',
          onclick: async () => {
            close();
            const ok = await confirmBox({
              title: 'Leave match?',
              text: currency === 'practice' ? 'This practice game will end.' : 'You will lose your entry fee. Your tokens will be auto-played.',
              ok: 'Leave', danger: true,
            });
            if (ok) go('lobby/' + mode.id, { replace: true });
          },
        }, h('span', { class: 'li-ico', style: { color: 'var(--danger)' } }, icon('logout')), h('span', { class: 'grow', style: { color: 'var(--danger)' } }, 'Leave match'))),
    ]);
  }

  function playerSheet(p) {
    sheet((close) => [
      h('div', { class: 'row', style: { gap: '14px', marginBottom: '14px' } },
        h('span', { class: 'avatar', style: { '--size': '64px', borderColor: TOKEN_HEX[p.color] } }, AVATARS[p.avatar], h('span', { class: 'lvl' }, `Lv ${p.level}`)),
        h('div', { class: 'grow' },
          h('h3', { style: { fontSize: '22px' } }, p.isMe ? me.name : p.name),
          h('div', { class: 'dim' }, p.isMe ? 'This is you' : `Win rate ${40 + (p.level % 30)}% · ${120 + p.level * 9} games`))),
      p.isMe ? h('p', { class: 'muted' }, 'Tap other players to mute, add or report them.') : h('div', { class: 'stack' },
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-ghost btn-sm grow', onclick: () => { p.muted = !p.muted; toast(p.muted ? `${p.name} muted` : `${p.name} unmuted`); close(); } }, icon(p.muted ? 'volume' : 'volumeOff'), p.muted ? 'Unmute' : 'Mute'),
          h('button', { class: 'btn btn-violet btn-sm grow', onclick: () => { toast('Friend request sent', 'ok'); close(); } }, icon('users'), 'Add friend')),
        h('button', { class: 'btn btn-ghost btn-sm', style: { color: 'var(--danger)' }, onclick: () => { close(); reportSheet(p); } }, icon('flag'), 'Report player')),
    ]);
  }

  function reportSheet(p) {
    sheet((close) => [
      h('h3', { style: { fontSize: '20px', marginBottom: '6px' } }, `Report ${p.name}`),
      h('p', { class: 'dim', style: { marginBottom: '12px' } }, 'Our team reviews every report. Chat and voice are attached as evidence.'),
      h('div', { class: 'stack' }, ['Abusive chat or voice', 'Cheating / teaming up', 'Leaving games on purpose', 'Offensive name or photo'].map((r) => h('button', {
        class: 'btn btn-ghost btn-block', style: { justifyContent: 'flex-start' },
        onclick: () => { close(); toast('Report sent. Thank you!', 'ok'); },
      }, r))),
    ]);
  }

  function chatSheet() {
    if (!store.config.chat.quick && !store.config.chat.text) return toast('Chat is turned off for this match');
    const input = h('input', { placeholder: 'Type a message…', maxlength: 60 });
    const send = (text) => {
      const clean = text.trim().slice(0, 60);
      if (!clean) return;
      say(myColor, clean);
      closeFn();
      // A bot sometimes answers.
      if (Math.random() < 0.6) {
        const other = seats.filter((c) => c !== myColor)[Math.floor(Math.random() * (seats.length - 1))];
        setTimeout(() => say(other, QUICK_CHAT[Math.floor(Math.random() * QUICK_CHAT.length)]), 1200);
      }
    };
    const closeFn = sheet(() => [
      h('h3', { style: { fontSize: '20px', marginBottom: '12px' } }, 'Quick chat'),
      h('div', { class: 'qc-grid' }, QUICK_CHAT.map((q) => h('button', { class: 'qc', onclick: () => send(q) }, q))),
      store.config.chat.text ? h('form', {
        class: 'field', style: { marginTop: '14px' },
        onsubmit: (e) => { e.preventDefault(); send(input.value); },
      }, input, h('button', { class: 'icon-btn', type: 'submit', 'aria-label': 'Send', style: { background: 'var(--grad-saffron)' } }, icon('send'))) : null,
      h('p', { class: 'dim center', style: { marginTop: '10px' } }, 'Bad words are blocked automatically.'),
    ]);
  }

  function emojiSheet() {
    const closeFn = sheet(() => [
      h('h3', { style: { fontSize: '20px', marginBottom: '12px' } }, 'Send a reaction'),
      h('div', { class: 'emoji-grid' }, EMOJI.map((e) => h('button', { onclick: () => { say(myColor, e); closeFn(); } }, e))),
    ]);
  }

  let micOn = false;
  function toggleMic() {
    if (!store.config.chat.voice) return toast('Voice chat is turned off');
    micOn = !micOn;
    micBtn.classList.toggle('on', micOn);
    micBtn.replaceChildren(icon(micOn ? 'mic' : 'micOff'), h('span', {}, micOn ? 'Live' : 'Mic'));
    panels[myColor].el.classList.toggle('talking', micOn);
    toast(micOn ? 'Mic on — players can hear you' : 'Mic off');
  }

  loop();

  return {
    el: root,
    cleanup() {
      destroyed = true;
      cancelAnimationFrame(raf);
    },
  };
}

export function rulesSheet(mode) {
  sheet(() => [
    h('h3', { style: { fontSize: '22px', marginBottom: '6px' } }, `${mode.name} rules`),
    h('p', { class: 'muted', style: { marginBottom: '14px' } }, mode.desc),
    h('ul', { class: 'rules' },
      h('li', {}, 'Roll a 6 to bring a token out of your yard.'),
      h('li', {}, 'A 6, a capture or reaching home gives you another roll.'),
      h('li', {}, 'Three 6s in a row cancel your turn.'),
      h('li', {}, 'Stars and start cells are safe: no one can capture you there.'),
      h('li', {}, 'You need the exact number to reach home.'),
      mode.minutes ? h('li', {}, 'Timer mode: +1 point per step, +20 per capture. A captured token loses its points.') : null,
      mode.id === 'team' ? h('li', {}, 'Partners sit opposite and cannot capture each other.') : null,
      h('li', {}, `You get ${store.config.turnSeconds} seconds per move, then the game plays for you.`)),
  ]);
}

