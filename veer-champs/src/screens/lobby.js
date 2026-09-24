import { h, icon, go, toast, sheet, seg, topbar, money, coinIcon, cashIcon, fmt } from '../ui/kit.js';
import { store, MODES, AVATARS, modeCurrencies, tablesFor, cashTotal } from '../data.js';
import { rulesSheet } from './game.js';

export function lobbyScreen(modeId = 'classic') {
  if (!MODES.some((m) => m.id === modeId)) modeId = 'classic';
  let mode = modeId;
  let currency = sessionStorage.getItem('vc:cur') || 'coins';
  let players = 'all';

  const modeTabs = h('div', { class: 'mode-cards' });
  const curBox = h('div');
  const filterBox = h('div');
  const list = h('div', { class: 'stack' });

  function drawModes() {
    modeTabs.replaceChildren(...MODES.map((m) => {
      const cur = modeCurrencies(m.id);
      const off = cur.length === 0;
      return h('button', {
        class: `mode-card${m.id === mode ? ' on' : ''}${off ? ' off' : ''}`,
        onclick: () => { if (off) return toast(`${m.name} is paused right now`); mode = m.id; drawAll(); },
      },
      m.hot ? h('span', { class: 'tag tag-hot mc-hot' }, 'Hot') : null,
      h('span', { class: 'mc-ico' }, icon(m.icon)),
      h('b', {}, m.name),
      h('span', { class: 'dim' }, m.time));
    }));
  }

  function drawAll() {
    const available = modeCurrencies(mode);
    if (!available.includes(currency)) currency = available[0] ?? 'coins';
    drawModes();
    const m = MODES.find((x) => x.id === mode);
    curBox.replaceChildren(
      h('div', { class: 'mode-desc card-flat' },
        h('p', {}, m.desc),
        h('button', { class: 'link-btn', onclick: () => rulesSheet(m) }, icon('help'), ' Rules')),
      available.length > 1
        ? seg([
          { value: 'coins', label: 'Coins', icon: coinIcon('coin-ico') },
          { value: 'cash', label: 'Cash', icon: cashIcon('cash-ico') },
        ], currency, (v) => { currency = v; sessionStorage.setItem('vc:cur', v); drawTables(); })
        : null);
    filterBox.replaceChildren(m.players.length > 1 ? h('div', { class: 'tabs' },
      [['all', 'All'], ['2', '2 Players'], ['4', '4 Players']].map(([v, l]) => h('button', {
        class: `tab${players === v ? ' on' : ''}`, onclick: () => { players = v; drawAll(); },
      }, l))) : null);
    drawTables();
  }

  function drawTables() {
    const tables = tablesFor(mode, currency).filter((t) => players === 'all' || String(t.players) === players);
    list.replaceChildren(...tables.map((t) => h('div', { class: `table-row ${t.currency}` },
      h('div', { class: 'tr-prize' },
        h('span', { class: 'dim' }, 'Prize'),
        money(t.currency, t.prize, 'tr-amt')),
      h('div', { class: 'tr-meta' },
        h('span', { class: 'row', style: { gap: '4px' } }, icon('users', 'tiny'), `${t.players}P`),
        h('span', { class: 'row', style: { gap: '4px' } }, h('i', { class: 'dot-live' }), `${fmt.num(t.online)} online`)),
      h('button', { class: `btn btn-sm ${t.currency === 'cash' ? 'btn-cash' : 'btn-gold'}`, onclick: () => join(t) },
        t.entry === 0 ? 'Free' : [t.currency === 'cash' ? '₹' : '', fmt.num(t.entry)]))));
    if (!tables.length) list.replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'big' }, '🛠️'), 'No tables here right now.'));
  }

  function join(t) {
    const u = store.user;
    const balance = t.currency === 'cash' ? cashTotal() : u.coins;
    if (balance < t.entry) {
      return sheet((close) => [
        h('h3', { style: { fontSize: '22px', marginBottom: '6px' } }, 'Not enough balance'),
        h('p', { class: 'muted', style: { marginBottom: '16px' } }, `You need ${t.currency === 'cash' ? fmt.inr(t.entry) : `${fmt.num(t.entry)} coins`} to join this table.`),
        h('button', { class: `btn btn-block ${t.currency === 'cash' ? 'btn-cash' : 'btn-gold'}`, onclick: () => { close(); go(t.currency === 'cash' ? 'addcash' : 'shop/coins'); } },
          t.currency === 'cash' ? 'Add cash' : 'Get coins'),
      ]);
    }
    if (t.currency === 'cash' && store.user.kyc === 'none') {
      toast('Verify your age once to play cash games', 'err');
      return go('kyc');
    }
    store.update((s) => {
      if (t.currency === 'cash') {
        // Bonus first (capped at 10% of entry), then deposit, then winnings.
        let due = t.entry;
        const fromBonus = Math.min(s.user.cash.bonus, Math.floor(t.entry * 0.1));
        s.user.cash.bonus -= fromBonus; due -= fromBonus;
        const fromDeposit = Math.min(s.user.cash.deposit, due);
        s.user.cash.deposit -= fromDeposit; due -= fromDeposit;
        s.user.cash.winnings -= due;
      } else s.user.coins -= t.entry;
    });
    go(`matchmaking/${t.mode}/${t.currency}/${t.entry}/${t.players}`);
  }

  drawAll();
  return h('section', { class: 'screen' },
    topbar('Ludo', {
      backTo: 'home',
      right: [h('button', { class: 'chip-cur', onclick: () => go('wallet') }, currency === 'cash' ? cashIcon() : coinIcon(), currency === 'cash' ? fmt.inr(cashTotal()) : fmt.short(store.user.coins))],
    }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: '0' } },
      modeTabs,
      curBox,
      h('div', { class: 'row', style: { gap: '10px' } },
        h('button', { class: 'side-card', onclick: () => go('private') }, h('span', { class: 'sc-ico', style: { background: 'var(--grad-violet)' } }, icon('users')), h('b', {}, 'Play with friends'), h('span', { class: 'dim' }, 'Private room')),
        h('button', { class: 'side-card', onclick: () => go(`game/${mode}/practice/0/${mode === 'team' ? 4 : 2}`) }, h('span', { class: 'sc-ico', style: { background: 'var(--grad-cash)' } }, icon('robot')), h('b', {}, 'Practice'), h('span', { class: 'dim' }, 'vs computer, free'))),
      h('div', { class: 'section-title' }, h('h3', {}, 'Choose a table')),
      filterBox,
      list));
}

export function matchmakingScreen(mode, currency, entry, players) {
  const n = Number(players);
  const m = MODES.find((x) => x.id === mode) ?? MODES[0];
  const u = store.user;
  const slots = Array.from({ length: n }, (_, i) => h('div', { class: `mm-slot${i === 0 ? ' filled' : ''}` },
    h('span', { class: 'avatar', style: { '--size': '64px' } }, i === 0 ? AVATARS[u.avatar] : '?'),
    h('b', {}, i === 0 ? 'You' : 'Searching…')));
  const status = h('p', { class: 'muted' }, 'Finding players with a similar level…');
  const secs = h('b', {}, '0s');
  let t = 0;
  const names = ['Rohan', 'Diya', 'Kabir'];
  const timer = setInterval(() => {
    t++;
    secs.textContent = `${t}s`;
    const fill = Math.min(n - 1, Math.floor(t / 1.2));
    for (let i = 1; i <= fill; i++) {
      const s = slots[i];
      if (!s.classList.contains('filled')) {
        s.classList.add('filled');
        s.replaceChildren(h('span', { class: 'avatar', style: { '--size': '64px' } }, AVATARS[(i * 5 + 3) % AVATARS.length]), h('b', {}, names[i - 1]));
      }
    }
    if (fill === n - 1) {
      status.textContent = 'Match found! Starting…';
      clearInterval(timer);
      setTimeout(() => go(`game/${mode}/${currency}/${entry}/${n}`, { replace: true }), 900);
    }
  }, 1000);
  const el = h('section', { class: 'screen mm' },
    h('div', { class: 'mm-rings' }, h('span'), h('span'), h('span')),
    h('div', { class: 'pad stack center', style: { marginTop: 'calc(40px + var(--safe-top))', alignItems: 'center' } },
      h('span', { class: 'tag tag-coin' }, `${m.name} · ${n} players`),
      h('h1', { style: { fontSize: '28px' } }, 'Finding opponents'),
      status,
      h('div', { class: `mm-slots n${n}` }, slots),
      h('div', { class: 'card-flat row between', style: { width: '100%' } },
        h('span', { class: 'dim' }, 'Entry'), money(currency, Number(entry)),
        h('span', { class: 'dim' }, 'Wait'), secs),
      h('p', { class: 'dim' }, store.config.botFill ? 'Tip: tap a glowing token to move it.' : ''),
      h('button', {
        class: 'btn btn-ghost', onclick: () => {
          store.update((s) => { if (currency === 'cash') s.user.cash.deposit += Number(entry); else s.user.coins += Number(entry); });
          toast('Search cancelled. Entry refunded.');
          go(`lobby/${mode}`, { replace: true });
        },
      }, 'Cancel')));
  return { el, cleanup: () => clearInterval(timer) };
}

export function privateRoomScreen() {
  let tab = 'create';
  let mode = 'classic';
  let size = 4;
  const body = h('div', { class: 'stack' });
  const code = 'VC' + Math.random().toString(36).slice(2, 6).toUpperCase();

  function draw() {
    if (tab === 'create') {
      body.replaceChildren(
        h('div', { class: 'label' }, 'Mode'),
        h('div', { class: 'tabs' }, MODES.map((m) => h('button', { class: `tab${m.id === mode ? ' on' : ''}`, onclick: () => { mode = m.id; if (m.id === 'team') size = 4; draw(); } }, icon(m.icon), m.name))),
        h('div', { class: 'label' }, 'Players'),
        seg([{ value: 2, label: '2 Players' }, { value: 4, label: '4 Players' }], size, (v) => { size = mode === 'team' ? 4 : v; draw(); }),
        h('div', { class: 'card room-card center' },
          h('span', { class: 'dim' }, 'Room code'),
          h('div', { class: 'room-code' }, [...code].map((c) => h('span', {}, c))),
          h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } },
            h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { navigator.clipboard?.writeText(code); toast('Code copied', 'ok'); } }, icon('copy'), 'Copy'),
            h('button', { class: 'btn btn-cash btn-sm', onclick: () => toast('Opening WhatsApp…') }, icon('share'), 'WhatsApp'))),
        h('div', { class: 'label' }, `Players (1/${size})`),
        h('div', { class: 'stack' }, Array.from({ length: size }, (_, i) => h('div', { class: 'card-flat row' },
          h('span', { class: 'avatar', style: { '--size': '38px' } }, i === 0 ? AVATARS[store.user.avatar] : '·'),
          h('span', { class: 'grow' }, i === 0 ? `${store.user.name} (host)` : 'Waiting…'),
          i === 0 ? h('span', { class: 'tag tag-coin' }, 'Host') : h('button', { class: 'btn btn-ghost btn-sm', onclick: () => toast('Bot added') }, icon('robot'), 'Bot')))),
        h('button', { class: 'btn btn-saffron btn-block', onclick: () => go(`game/${mode}/practice/0/${size}`) }, 'Start game'));
    } else {
      const input = h('input', { maxlength: 6, placeholder: 'ENTER CODE', style: { textTransform: 'uppercase', letterSpacing: '0.3em', textAlign: 'center' } });
      body.replaceChildren(
        h('p', { class: 'muted' }, 'Ask your friend for the 6-character room code.'),
        h('label', { class: 'field' }, input),
        h('button', {
          class: 'btn btn-saffron btn-block',
          onclick: () => (input.value.trim().length === 6 ? go('game/classic/practice/0/4') : toast('Enter the 6-character code', 'err')),
        }, 'Join room'));
    }
  }
  draw();
  return h('section', { class: 'screen' },
    topbar('Play with friends', { backTo: 'lobby/classic' }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      seg([{ value: 'create', label: 'Create room' }, { value: 'join', label: 'Join room' }], tab, (v) => { tab = v; draw(); }),
      body));
}
