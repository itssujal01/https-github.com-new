import { h, icon, go, toast, modal, coinIcon, cashIcon, fmt } from '../ui/kit.js';
import { store, AVATARS, GAMES, BANNERS, NOTIFS, cashTotal } from '../data.js';
import { brandMark } from './auth.js';

export function bottomNav(active) {
  const item = (id, label, ic, to) => h('button', { class: active === id ? 'on' : '', onclick: () => go(to) }, icon(ic), label);
  return h('nav', { class: 'bottom-nav' },
    item('home', 'Home', 'home', 'home'),
    item('events', 'Events', 'trophy', 'tournaments'),
    h('button', { class: 'nav-play', onclick: () => go('lobby/timer'), 'aria-label': 'Quick play' }, h('span', { class: 'play-orb' }, icon('play')), 'Play'),
    item('ranks', 'Ranks', 'chart', 'leaderboard'),
    item('wallet', 'Wallet', 'wallet', 'wallet'));
}

/** Header with avatar, balances and notifications. */
export function appHeader() {
  const u = store.user;
  const unread = NOTIFS.filter((n) => n.unread).length;
  return h('header', { class: 'app-head' },
    h('button', { class: 'row', style: { gap: '10px' }, onclick: () => go('profile') },
      h('span', { class: 'avatar', style: { '--size': '42px' } }, AVATARS[u.avatar], h('span', { class: 'lvl' }, u.level)),
      h('span', { class: 'head-name' }, h('b', {}, u.name), h('span', { class: 'dim' }, `ID ${u.id}`))),
    h('div', { class: 'row', style: { gap: '6px' } },
      h('button', { class: 'chip-cur', onclick: () => go('shop/coins') }, coinIcon(), fmt.short(u.coins), h('span', { class: 'plus' }, icon('plus'))),
      store.config.realMoney
        ? h('button', { class: 'chip-cur', onclick: () => go('wallet') }, cashIcon(), fmt.inr(cashTotal()), h('span', { class: 'plus' }, icon('plus')))
        : null,
      h('button', { class: 'icon-btn', 'aria-label': 'Notifications', onclick: () => go('notifications') }, icon('bell'), unread ? h('span', { class: 'badge-dot' }, unread) : null)));
}

function gameArt(id) {
  const art = {
    ludo: () => h('div', { class: 'art-ludo' }, ['#ef3b4f', '#1fbf6a', '#2f8bff', '#ffc21a'].map((c) => h('span', { style: { background: c } }))),
    snakes: () => h('span', { class: 'art-emoji' }, '🐍'),
    cricket: () => h('span', { class: 'art-emoji' }, '🏏'),
    cards: () => h('span', { class: 'art-emoji' }, '🃏'),
    carrom: () => h('span', { class: 'art-emoji' }, '🎯'),
    tictactoe: () => h('span', { class: 'art-emoji' }, '⭕'),
    connect4: () => h('span', { class: 'art-emoji' }, '🔴'),
    quiz: () => h('span', { class: 'art-emoji' }, '🧠'),
  };
  return (art[id] ?? art.quiz)();
}

function banners() {
  const track = h('div', { class: 'banner-track' }, BANNERS.map((b) => h('button', {
    class: 'banner shine', style: { background: b.grad }, onclick: () => go(b.to),
  },
  h('div', { class: 'grow' }, h('h3', {}, b.title), h('p', {}, b.text)),
  h('span', { class: 'banner-cta' }, b.cta))));
  const dots = h('div', { class: 'banner-dots' }, BANNERS.map((_, i) => h('span', { class: i === 0 ? 'on' : '' })));
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
  }, { passive: true });
  return h('div', {}, track, dots);
}

export function homeScreen() {
  const cfg = store.config;
  const live = GAMES.filter((g) => cfg.gameStatus[g.id] === 'live');
  const soon = GAMES.filter((g) => cfg.gameStatus[g.id] === 'soon');
  const ludo = GAMES[0];

  const el = h('section', { class: 'screen' },
    appHeader(),
    h('div', { class: 'scroll' },
      h('div', { class: 'pad stack', style: { paddingTop: '4px' } },
        cfg.maintenance ? h('div', { class: 'card-flat row', style: { borderColor: 'var(--gold)' } }, icon('tools'), h('span', {}, 'Scheduled maintenance tonight 2–3 AM. Games may pause.')) : null,
        banners(),
        h('div', { class: 'quick-row' },
          quick('gift', 'Daily Bonus', 'var(--grad-saffron)', () => dailyBonus()),
          quick('star', 'Spin & Win', 'var(--grad-violet)', () => go('rewards')),
          quick('users', 'Refer & Earn', 'var(--grad-cash)', () => go('refer')),
          quick('cart', 'Shop', 'var(--grad-gold)', () => go('shop'))),

        cfg.gameStatus.ludo === 'live' ? h('button', { class: 'hero-game shine', onclick: () => go('lobby/classic') },
          h('div', { class: 'hero-art' }, gameArt('ludo'), h('span', { class: 'hero-dice' }, '🎲')),
          h('div', { class: 'hero-info' },
            h('span', { class: 'tag tag-live' }, `${fmt.num(2481)} playing`),
            h('h2', {}, 'LUDO'),
            h('p', {}, ludo.tagline),
            h('span', { class: 'row', style: { gap: '6px', marginTop: '6px' } },
              h('span', { class: 'tag tag-coin' }, 'Coins'),
              cfg.realMoney ? h('span', { class: 'tag tag-cash' }, 'Cash') : null,
              h('span', { class: 'tag tag-hot' }, 'Timer mode')))) : null,

        live.length > 1 ? h('div', { class: 'section-title' }, h('h3', {}, 'More games')) : null,
        live.length > 1 ? h('div', { class: 'game-grid' }, live.filter((g) => g.id !== 'ludo').map((g) => gameTile(g, false))) : null,

        soon.length ? h('div', { class: 'section-title' }, h('h3', {}, 'Coming soon'), h('span', { class: 'dim' }, `${soon.length} games`)) : null,
        soon.length ? h('div', { class: 'game-grid' }, soon.map((g) => gameTile(g, true))) : null,

        h('div', { class: 'section-title' }, h('h3', {}, 'Live tournaments'), h('button', { onclick: () => go('tournaments') }, 'See all')),
        h('button', { class: 'card row', style: { textAlign: 'left' }, onclick: () => go('tournaments') },
          h('span', { style: { fontSize: '40px' } }, '🏆'),
          h('div', { class: 'grow' }, h('b', { style: { fontSize: '17px' } }, 'Weekend Mega'), h('div', { class: 'dim' }, 'Prize pool 1,00,000 coins · starts in 3h')),
          h('span', { class: 'btn btn-gold btn-sm' }, 'Join')),
        h('p', { class: 'dim center', style: { padding: '8px 0 16px' } }, 'Play responsibly · 18+ only for cash games'))),
    bottomNav('home'));

  // First open of the day: show the daily bonus.
  if (!store.user.claimedToday && !sessionStorage.getItem('vc:bonusShown')) {
    sessionStorage.setItem('vc:bonusShown', '1');
    setTimeout(() => dailyBonus(), 600);
  }
  return el;
}

function quick(ic, label, bg, onclick) {
  return h('button', { class: 'quick', onclick }, h('span', { class: 'quick-ico', style: { background: bg } }, icon(ic)), h('span', {}, label));
}

function gameTile(g, soon) {
  return h('button', {
    class: `game-tile${soon ? ' soon' : ''}`, style: { '--gc': g.color },
    onclick: () => (soon ? notifyMe(g) : go(`lobby/${g.id}`)),
  },
  h('div', { class: 'gt-art' }, gameArt(g.id)),
  h('b', {}, g.name),
  h('span', { class: 'dim' }, g.tagline),
  soon ? h('span', { class: 'tag tag-soon gt-tag' }, icon('lock'), 'Soon') : null);
}

function notifyMe(g) {
  modal((close) => [
    h('div', { class: 'gt-art big', style: { '--gc': g.color } }, gameArt(g.id)),
    h('h3', { style: { fontSize: '22px', margin: '10px 0 6px' } }, `${g.name} is coming soon`),
    h('p', { class: 'muted', style: { marginBottom: '16px' } }, "We'll notify you the moment it launches."),
    h('button', { class: 'btn btn-gold btn-block', onclick: () => { close(); toast("You're on the list!", 'ok'); } }, icon('bell'), 'Notify me'),
  ]);
}

export function dailyBonus() {
  const cfg = store.config;
  const u = store.user;
  modal((close) => [
    h('h3', { style: { fontSize: '24px', marginBottom: '4px' } }, 'Daily Bonus'),
    h('p', { class: 'muted', style: { marginBottom: '14px' } }, 'Log in every day. Day 7 is the jackpot!'),
    h('div', { class: 'daily-grid' }, cfg.dailyBonus.map((amt, i) => {
      const day = i + 1;
      const state = day < u.streakDay || (day === u.streakDay && u.claimedToday) ? 'done' : day === u.streakDay ? 'today' : '';
      return h('div', { class: `daily ${state}${day === 7 ? ' jackpot' : ''}` },
        h('span', { class: 'dim' }, `Day ${day}`), coinIcon('coin-ico'), h('b', {}, fmt.num(amt)),
        state === 'done' ? h('span', { class: 'daily-check' }, icon('check')) : null);
    })),
    h('button', {
      class: 'btn btn-gold btn-block', style: { marginTop: '16px' }, disabled: u.claimedToday,
      onclick: () => {
        const amt = cfg.dailyBonus[u.streakDay - 1];
        store.update((s) => { s.user.coins += amt; s.user.claimedToday = true; });
        close();
        toast(`+${amt} coins added!`, 'ok');
        go('home', { replace: true });
      },
    }, u.claimedToday ? 'Come back tomorrow' : 'Claim'),
    u.claimedToday ? null : h('button', {
      class: 'link-btn', style: { marginTop: '10px' },
      onclick: () => {
        const amt = cfg.dailyBonus[u.streakDay - 1] * 2;
        store.update((s) => { s.user.coins += amt; s.user.claimedToday = true; });
        close();
        toast(`Ad watched: +${amt} coins!`, 'ok');
        go('home', { replace: true });
      },
    }, icon('tv'), ' Watch ad to double'),
  ]);
}

export { brandMark };
