import { h, icon, go, toast, topbar, seg, money, sheet, fmt } from '../ui/kit.js';
import { store, AVATARS, TOURNAMENTS, LEADERS, FRIENDS, NOTIFS, MODES } from '../data.js';
import { bottomNav } from './home.js';

const fmtTime = (s) => (s <= 0 ? 'Live now' : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`);

export function tournamentsScreen() {
  let tab = 'open';
  const list = h('div', { class: 'stack' });
  const draw = () => {
    const rows = TOURNAMENTS.filter((t) => (tab === 'live' ? t.status === 'live' : tab === 'open' ? t.status === 'open' : false))
      .filter((t) => t.currency === 'coins' || store.config.realMoney);
    list.replaceChildren(...(rows.length ? rows.map(tCard) : [h('div', { class: 'empty' }, h('div', { class: 'big' }, '🏁'), tab === 'mine' ? 'You have not joined any tournament yet.' : 'Nothing here right now.')]));
  };
  draw();
  return h('section', { class: 'screen' },
    h('header', { class: 'topbar' }, h('h2', {}, 'Tournaments')),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      seg([{ value: 'open', label: 'Upcoming' }, { value: 'live', label: 'Live' }, { value: 'mine', label: 'My events' }], tab, (v) => { tab = v; draw(); }),
      list),
    bottomNav('events'));
}

function tCard(t) {
  const mode = MODES.find((m) => m.id === t.mode);
  const pct = Math.round((t.joined / t.players) * 100);
  return h('button', { class: 'card t-card', onclick: () => go(`tournament/${t.id}`) },
    h('div', { class: 'row between' },
      h('div', {}, h('b', { style: { fontSize: '18px' } }, t.name), h('div', { class: 'dim' }, `Ludo ${mode.name} · Knockout`)),
      t.status === 'live' ? h('span', { class: 'tag tag-live' }, 'Live') : h('span', { class: 'tag' }, icon('clock', 'tiny'), fmtTime(t.startsIn))),
    h('div', { class: 't-pool' }, h('span', { class: 'dim' }, 'Prize pool'), money(t.currency, t.pool, 'big')),
    h('div', { class: 't-bar' }, h('span', { style: { width: `${pct}%` } })),
    h('div', { class: 'row between' },
      h('span', { class: 'dim' }, `${fmt.num(t.joined)}/${fmt.num(t.players)} joined`),
      h('span', { class: `btn btn-sm ${t.currency === 'cash' ? 'btn-cash' : 'btn-gold'}` }, t.entry ? ['Join · ', t.currency === 'cash' ? '₹' : '', fmt.num(t.entry)] : 'Free')));
}

export function tournamentDetail(id) {
  const t = TOURNAMENTS.find((x) => x.id === id) ?? TOURNAMENTS[0];
  const payouts = [0.4, 0.2, 0.1, 0.05, 0.05];
  return h('section', { class: 'screen' },
    topbar(t.name, { backTo: 'tournaments' }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('div', { class: 'card center stack', style: { alignItems: 'center' } },
        h('span', { style: { fontSize: '56px' } }, '🏆'),
        money(t.currency, t.pool, 'big'),
        h('span', { class: 'dim' }, `${t.status === 'live' ? 'Live now' : `Starts in ${fmtTime(t.startsIn)}`} · ${t.players} players`)),
      h('div', { class: 'section-title' }, h('h3', {}, 'Prizes')),
      h('div', { class: 'card-flat list', style: { padding: 0 } }, payouts.map((p, i) => h('div', { class: 'list-item' },
        h('b', { style: { width: '60px' } }, ['🥇 1st', '🥈 2nd', '🥉 3rd', '4th', '5th'][i]),
        h('span', { class: 'grow' }),
        money(t.currency, Math.floor(t.pool * p))))),
      h('div', { class: 'section-title' }, h('h3', {}, 'How it works')),
      h('ul', { class: 'rules' },
        h('li', {}, 'Knockout rounds of 4 players. Top 2 of each table go through.'),
        h('li', {}, 'Be online when your round starts or a bot plays for you.'),
        h('li', {}, 'If the tournament is cancelled, your entry is refunded.')),
      h('button', {
        class: `btn btn-block ${t.currency === 'cash' ? 'btn-cash' : 'btn-gold'}`,
        onclick: () => { toast("Registered! We'll remind you before it starts.", 'ok'); go('tournaments'); },
      }, t.entry ? `Register · ${t.currency === 'cash' ? fmt.inr(t.entry) : `${fmt.num(t.entry)} coins`}` : 'Register free')));
}

export function leaderboardScreen() {
  let period = 'week';
  const body = h('div', { class: 'stack' });
  const draw = () => {
    const rows = period === 'friends' ? LEADERS.slice(0, 5) : LEADERS;
    const [a, b, c] = rows;
    body.replaceChildren(
      h('div', { class: 'podium3' }, [b, a, c].map((p, i) => p && h('div', { class: `pd pd-${['2', '1', '3'][i]}` },
        h('span', { class: 'avatar', style: { '--size': i === 1 ? '74px' : '58px' } }, AVATARS[p.avatar]),
        h('b', {}, p.name), h('span', { class: 'gold' }, fmt.num(p.score)),
        h('div', { class: 'pd-block' }, ['2', '1', '3'][i])))),
      h('div', { class: 'card-flat list', style: { padding: 0 } }, rows.slice(3).map((p) => h('div', { class: 'list-item' },
        h('b', { style: { width: '26px', color: 'var(--text-3)' } }, p.rank),
        h('span', { class: 'avatar', style: { '--size': '36px' } }, AVATARS[p.avatar]),
        h('b', { class: 'grow' }, p.name),
        h('span', { class: 'gold' }, fmt.num(p.score))))),
      h('div', { class: 'card-flat row me-rank' },
        h('b', { style: { width: '26px' } }, '48'),
        h('span', { class: 'avatar', style: { '--size': '36px' } }, AVATARS[store.user.avatar]),
        h('b', { class: 'grow' }, 'You'),
        h('span', { class: 'gold' }, '1,120')));
  };
  draw();
  return h('section', { class: 'screen' },
    h('header', { class: 'topbar' }, h('h2', {}, 'Leaderboard'), h('span', { class: 'dim' }, 'Resets Monday')),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      seg([{ value: 'day', label: 'Today' }, { value: 'week', label: 'This week' }, { value: 'friends', label: 'Friends' }], period, (v) => { period = v; draw(); }),
      h('div', { class: 'card-flat row' }, h('span', { style: { fontSize: '26px' } }, '🎁'), h('span', { class: 'dim' }, 'Top 10 every week win coin rewards and a champion frame.')),
      body),
    bottomNav('ranks'));
}

export function friendsScreen() {
  const search = h('input', { placeholder: 'Search by name or player ID' });
  return h('section', { class: 'screen' },
    topbar('Friends', { right: [h('button', { class: 'icon-btn', onclick: () => go('refer') }, icon('plus'))] }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('label', { class: 'field' }, icon('search'), search),
      h('div', { class: 'card-flat row' },
        h('span', { class: 'avatar', style: { '--size': '40px' } }, AVATARS[9]),
        h('div', { class: 'grow' }, h('b', {}, 'Ishita'), h('div', { class: 'dim' }, 'Wants to be friends')),
        h('button', { class: 'btn btn-cash btn-sm', onclick: (e) => { e.currentTarget.closest('.card-flat').remove(); toast('Friend added', 'ok'); } }, 'Accept')),
      h('div', { class: 'section-title' }, h('h3', {}, `Friends (${FRIENDS.length})`)),
      h('div', { class: 'card-flat list', style: { padding: 0 } }, FRIENDS.map((f) => h('div', { class: 'list-item' },
        h('span', { class: `avatar st-${f.status}`, style: { '--size': '42px' } }, AVATARS[f.avatar]),
        h('div', { class: 'grow' }, h('b', {}, f.name), h('div', { class: 'dim' }, f.status === 'offline' ? `Seen ${f.seen}` : f.status === 'playing' ? 'In a game' : 'Online')),
        f.status === 'online'
          ? h('button', { class: 'btn btn-saffron btn-sm', onclick: () => toast(`Invite sent to ${f.name}`, 'ok') }, 'Invite')
          : h('button', { class: 'icon-btn', onclick: () => friendMenu(f) }, icon('menu')))))));
}

function friendMenu(f) {
  sheet((close) => [
    h('h3', { style: { fontSize: '20px', marginBottom: '12px' } }, f.name),
    h('div', { class: 'card-flat list', style: { padding: 0 } },
      h('button', { class: 'list-item', onclick: () => { close(); toast('Challenge sent'); } }, h('span', { class: 'li-ico' }, icon('swords')), 'Challenge'),
      h('button', { class: 'list-item', onclick: () => { close(); toast('Removed'); } }, h('span', { class: 'li-ico' }, icon('trash')), 'Remove friend'),
      h('button', { class: 'list-item', onclick: () => { close(); toast('Blocked'); } }, h('span', { class: 'li-ico', style: { color: 'var(--danger)' } }, icon('ban')), 'Block')),
  ]);
}

export function notificationsScreen() {
  return h('section', { class: 'screen' },
    topbar('Notifications', { backTo: 'home', right: [h('button', { class: 'link-btn', onclick: () => toast('All marked read') }, 'Mark read')] }),
    h('div', { class: 'scroll pad' },
      h('div', { class: 'card-flat list', style: { padding: 0 } }, NOTIFS.map((n) => h('div', { class: `list-item${n.unread ? ' unread' : ''}` },
        h('span', { class: 'li-ico' }, icon(n.icon)),
        h('div', { class: 'grow' }, h('b', {}, n.title), h('div', { class: 'dim' }, n.text)),
        h('span', { class: 'dim' }, n.at))))));
}
