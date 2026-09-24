// Admin panel prototype. Config changes are saved to the same store the app
// reads, so toggling a mode's currency here changes the app immediately.
import { h, icon, go, toast, toggle, modal, confirmBox, fmt, coinIcon, cashIcon } from '../ui/kit.js';
import { store, GAMES, MODES, AVATARS } from '../data.js';

const NAV = [
  ['dashboard', 'Dashboard', 'grid'],
  ['users', 'Users', 'users'],
  ['games', 'Games & modes', 'dice'],
  ['tournaments', 'Tournaments', 'trophy'],
  ['finance', 'Payments', 'wallet'],
  ['kyc', 'KYC', 'shieldCheck'],
  ['reports', 'Reports & chat', 'flag'],
  ['automation', 'Automation & fraud', 'robot'],
  ['economy', 'Rewards & economy', 'gift'],
  ['content', 'Content & push', 'megaphone'],
  ['staff', 'Staff & roles', 'shield'],
  ['audit', 'Audit log', 'history'],
  ['settings', 'Settings', 'settings'],
];

// ------------------------------------------------------------ mock data
const NAMES = ['Aarav Shah', 'Diya Patel', 'Kabir Singh', 'Ishita Rao', 'Rohan Verma', 'Meera Iyer', 'Vivaan Gupta', 'Anaya Nair', 'Arjun Mehta', 'Sara Khan', 'Reyansh Das', 'Kiara Joshi'];
const users = NAMES.map((name, i) => ({
  id: `VC${10400 + i * 37}`, name, phone: `+91 9${(812345670 + i * 7919) % 1e9}`.slice(0, 14),
  avatar: i % 16, coins: (i * 7919) % 40000, cash: ((i * 131) % 3000) + 0.5 * (i % 2),
  status: i === 3 ? 'banned' : i === 7 ? 'chat-muted' : i === 10 ? 'flagged' : 'active',
  kyc: ['verified', 'pending', 'none'][i % 3], games: 40 + ((i * 53) % 900), winRate: 35 + ((i * 17) % 40),
  joined: `${(i % 28) + 1} Aug 2026`, device: `Android · ${['Redmi Note 12', 'Galaxy M34', 'Vivo Y56', 'iPhone 13'][i % 4]}`,
  ip: `103.${(i * 11) % 255}.${(i * 29) % 255}.${(i * 3) % 255}`,
}));
const withdrawals = [
  { id: 'W-9921', user: users[0], amount: 1250, upi: 'aarav@okicici', at: '2 min ago', risk: 'low' },
  { id: 'W-9918', user: users[4], amount: 480, upi: 'rohanv@ybl', at: '9 min ago', risk: 'low' },
  { id: 'W-9910', user: users[10], amount: 5200, upi: 'rey.d@paytm', at: '31 min ago', risk: 'high', note: 'Same device as 2 other accounts' },
];
const reports = [
  { id: 'R-331', target: users[3], by: users[1], reason: 'Abusive chat', evidence: '"*** *** tu hara" (auto-masked)', count: 7, at: '5 min ago' },
  { id: 'R-329', target: users[10], by: users[5], reason: 'Teaming up', evidence: 'Played 14 tables with VC10744 today, same IP', count: 3, at: '22 min ago' },
  { id: 'R-322', target: users[8], by: users[2], reason: 'Leaving games', evidence: 'Left 5 of last 10 games', count: 2, at: '1 h ago' },
];
const audit = [
  ['Priya (Moderator)', 'Banned VC10511 for 7 days', 'Abusive chat, 7 reports', '10:42'],
  ['System', 'Auto-refunded 4 players', 'Table T-88213 server error', '10:31'],
  ['Sujal (Super admin)', 'Changed Timer mode commission 10% → 12%', '', '09:58'],
  ['Amit (Finance)', 'Approved withdrawal W-9902 ₹2,000', '', '09:40'],
  ['System', 'Auto-muted VC10659 for 10 min', 'Bad-word filter', '09:12'],
];
const automation = [
  { id: 'autoBanReports', name: 'Auto-ban on reports', desc: 'Temporary ban when a player gets many reports in 24h', on: true, value: 5, unit: 'reports → 24h ban' },
  { id: 'autoMute', name: 'Auto-mute bad language', desc: 'Mute chat when the word filter triggers repeatedly', on: true, value: 3, unit: 'hits → 10 min mute' },
  { id: 'multiAccount', name: 'Multi-account detection', desc: 'Flag accounts sharing a device ID or payment method', on: true, value: 2, unit: 'accounts per device' },
  { id: 'sameIp', name: 'Block same-IP tables', desc: 'Never seat players from the same network at one cash table', on: true, value: null },
  { id: 'winRate', name: 'Win-rate anomaly', desc: 'Flag unusual win rates in cash games for review', on: true, value: 85, unit: '% over 50 games' },
  { id: 'autoRefund', name: 'Auto-refund on failure', desc: 'Refund entries when a table crashes or is cancelled', on: true, value: null },
  { id: 'afk', name: 'AFK penalty', desc: 'Pause matchmaking for players who keep leaving', on: true, value: 3, unit: 'leaves → 15 min pause' },
  { id: 'autoApprove', name: 'Auto-approve withdrawals', desc: 'Pay out automatically below a limit for verified, low-risk users', on: true, value: 2000, unit: '₹ limit' },
  { id: 'botFill', name: 'Bot fill', desc: 'Seat a bot if no player is found (practice & coin tables only)', on: true, value: 20, unit: 'seconds wait' },
  { id: 'leaderReset', name: 'Weekly leaderboard reset', desc: 'Reset Monday 00:00 and send rewards to the top 10', on: true, value: null },
  { id: 'loadShed', name: 'Overload protection', desc: 'Stop new matches when server load is too high', on: true, value: 85, unit: '% CPU' },
];

// --------------------------------------------------------------- shell

export function adminScreen(section = 'dashboard') {
  const content = h('main', { class: 'adm-main' });
  const nav = h('nav', { class: 'adm-nav' },
    h('div', { class: 'adm-brand' }, h('span', { class: 'bm-mini' }, 'V'), h('div', {}, h('b', {}, 'Veer Champs'), h('span', { class: 'dim' }, 'Admin'))),
    NAV.map(([id, label, ic]) => h('button', { class: `adm-link${id === section ? ' on' : ''}`, onclick: () => go(`admin/${id}`, { replace: true }) }, icon(ic), h('span', {}, label))),
    h('button', { class: 'adm-link', onclick: () => go('home') }, icon('back'), h('span', {}, 'Back to app')));
  const view = (SECTIONS[section] ?? SECTIONS.dashboard)();
  content.append(view);
  return h('section', { class: 'screen admin' },
    h('header', { class: 'adm-top' },
      h('button', { class: 'icon-btn adm-menu', onclick: () => nav.classList.toggle('open') }, icon('menu')),
      h('h2', {}, NAV.find(([id]) => id === section)?.[1] ?? 'Dashboard'),
      h('label', { class: 'field adm-search' }, icon('search'), h('input', { placeholder: 'Search player ID, phone, table…' })),
      h('span', { class: 'row' }, h('span', { class: 'tag tag-cash' }, 'Super admin'), h('span', { class: 'avatar', style: { '--size': '36px' } }, '🦁'))),
    h('div', { class: 'adm-body' }, nav, content));
}

const kpi = (label, value, delta, ic, color) => h('div', { class: 'kpi' },
  h('span', { class: 'kpi-ico', style: { background: color } }, icon(ic)),
  h('span', { class: 'dim' }, label), h('b', {}, value),
  delta ? h('span', { class: delta.startsWith('-') ? 'kpi-d down' : 'kpi-d' }, delta) : null);

const panel = (title, ...children) => h('section', { class: 'adm-panel' }, title ? h('h3', {}, title) : null, ...children);

function table(cols, rows) {
  return h('div', { class: 'adm-table-wrap' }, h('table', { class: 'adm-table' },
    h('thead', {}, h('tr', {}, cols.map((c) => h('th', {}, c)))),
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c)))))));
}

const statusTag = (s) => h('span', { class: `tag ${s === 'active' ? 'tag-cash' : s === 'banned' ? 'tag-live' : 'tag-coin'}` }, s);

// ------------------------------------------------------------ sections

const SECTIONS = {
  dashboard() {
    const days = [42, 55, 48, 70, 66, 91, 84];
    return h('div', { class: 'adm-stack' },
      h('div', { class: 'kpi-grid' },
        kpi('Online now', '2,481', '+12%', 'users', 'var(--grad-cash)'),
        kpi('Live tables', '612', '+8%', 'dice', 'var(--grad-violet)'),
        kpi('New users today', '1,204', '+5%', 'user', 'var(--grad-saffron)'),
        kpi('Deposits today', '₹1,84,300', '+18%', 'plus', 'var(--grad-cash)'),
        kpi('Withdrawals pending', '3 · ₹6,930', null, 'download', 'var(--grad-gold)'),
        kpi('Commission today', '₹22,760', '+15%', 'trend', 'var(--grad-violet)'),
        kpi('Coins issued', '4.2L', '-3%', 'gift', 'var(--grad-gold)'),
        kpi('Open reports', String(reports.length), null, 'flag', 'linear-gradient(180deg,#ff7a91,#e0304f)')),
      h('div', { class: 'adm-cols' },
        panel('Revenue · last 7 days (₹ thousand)',
          h('div', { class: 'bars' }, days.map((v, i) => h('div', { class: 'bar' }, h('span', { style: { height: `${v}%` } }, h('b', {}, v)), h('small', {}, ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]))))),
        panel('Alerts',
          h('div', { class: 'alerts' },
            alertRow('alert', 'High-risk withdrawal W-9910 needs review', 'finance'),
            alertRow('users', 'VC10770 shares a device with 2 accounts', 'automation'),
            alertRow('flag', 'VC10511 reached 7 reports (auto-banned)', 'reports'),
            alertRow('bolt', 'Server CPU at 62%', 'settings')))),
      panel('Mode popularity (today)',
        table(['Mode', 'Tables', 'Players', 'Cash entries', 'Coin entries', 'Commission'], [
          ['Timer', '248', '1,020', '₹92,400', '3.1L', '₹11,090'],
          ['Classic', '190', '640', '₹61,200', '2.4L', '₹6,120'],
          ['Quick', '132', '520', '₹38,700', '1.2L', '₹4,640'],
          ['2 vs 2', '42', '168', '—', '84K', '—'],
        ])));
  },

  users() {
    let filter = 'all';
    const body = h('div');
    const draw = () => {
      const rows = users.filter((u) => filter === 'all' || u.status === filter || (filter === 'kyc' && u.kyc === 'pending'));
      body.replaceChildren(table(['Player', 'Phone', 'Coins', 'Cash', 'Games', 'KYC', 'Status', ''], rows.map((u) => [
        h('span', { class: 'row' }, h('span', { class: 'avatar', style: { '--size': '30px' } }, AVATARS[u.avatar]), h('span', {}, h('b', {}, u.name), h('div', { class: 'dim' }, u.id))),
        u.phone, fmt.num(u.coins), fmt.inr(u.cash), u.games, u.kyc, statusTag(u.status),
        h('span', { class: 'row', style: { gap: '6px' } },
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => userModal(u, draw) }, 'View'),
          u.status === 'banned'
            ? h('button', { class: 'btn btn-cash btn-sm', onclick: () => { u.status = 'active'; logAudit(`Unbanned ${u.id}`); toast(`${u.name} unbanned`, 'ok'); draw(); } }, 'Unban')
            : h('button', { class: 'btn btn-danger btn-sm', onclick: () => banModal(u, draw) }, 'Ban')),
      ])));
    };
    draw();
    return h('div', { class: 'adm-stack' },
      h('div', { class: 'tabs' }, [['all', 'All'], ['active', 'Active'], ['flagged', 'Flagged'], ['chat-muted', 'Muted'], ['banned', 'Banned'], ['kyc', 'KYC pending']].map(([v, l]) => h('button', {
        class: `tab${v === filter ? ' on' : ''}`,
        onclick: (e) => { filter = v; e.currentTarget.parentElement.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t === e.currentTarget)); draw(); },
      }, l))),
      panel(null, body));
  },

  games() {
    const cfg = store.config;
    const save = (fn, msg) => { store.update((s) => fn(s.config)); logAudit(msg); toast('Saved · live in the app', 'ok'); };
    return h('div', { class: 'adm-stack' },
      panel('Global switches',
        h('div', { class: 'set-list' },
          setRow('Real-money (cash) games', 'Master switch. Off = every table runs on coins only and cash wallet is hidden.', toggle(cfg.realMoney, (v) => save((c) => { c.realMoney = v; }, `Real money ${v ? 'ON' : 'OFF'}`))),
          setRow('Maintenance mode', 'Shows a banner and blocks new cash tables.', toggle(cfg.maintenance, (v) => save((c) => { c.maintenance = v; }, `Maintenance ${v ? 'ON' : 'OFF'}`))),
          setRow('Turn time (seconds)', 'Time per roll or move before auto-play.', numInput(cfg.turnSeconds, 5, 60, (v) => save((c) => { c.turnSeconds = v; }, `Turn time ${v}s`))))),
      panel('Games',
        table(['Game', 'Status', ''], GAMES.map((g) => [
          h('b', {}, g.name),
          h('select', {
            class: 'select', onchange: (e) => save((c) => { c.gameStatus[g.id] = e.target.value; }, `${g.name} → ${e.target.value}`),
          }, ['live', 'soon', 'off'].map((s) => h('option', { value: s, selected: cfg.gameStatus[g.id] === s }, { live: 'Live', soon: 'Coming soon', off: 'Hidden' }[s]))),
          g.id === 'ludo' ? h('span', { class: 'tag tag-cash' }, 'Ready') : h('span', { class: 'dim' }, 'Not built yet'),
        ]))),
      panel('Ludo modes · choose coins, cash or both per mode',
        h('div', { class: 'mode-admin' }, MODES.map((m) => {
          const mc = cfg.modes[m.id];
          return h('div', { class: 'ma-card' },
            h('div', { class: 'row between' }, h('b', { style: { fontSize: '17px' } }, m.name), toggle(mc.enabled, (v) => save((c) => { c.modes[m.id].enabled = v; }, `${m.name} ${v ? 'enabled' : 'disabled'}`))),
            h('div', { class: 'row between' }, h('span', { class: 'row' }, coinIcon(), 'Coin tables'), toggle(mc.coins, (v) => save((c) => { c.modes[m.id].coins = v; }, `${m.name} coins ${v ? 'ON' : 'OFF'}`))),
            h('div', { class: 'row between' }, h('span', { class: 'row' }, cashIcon(), 'Cash tables'), toggle(mc.cash, (v) => save((c) => { c.modes[m.id].cash = v; }, `${m.name} cash ${v ? 'ON' : 'OFF'}`))),
            h('label', { class: 'label' }, 'Coin entries'),
            listInput(mc.coinEntries, (v) => save((c) => { c.modes[m.id].coinEntries = v; }, `${m.name} coin entries → ${v.join(', ')}`)),
            h('label', { class: 'label' }, 'Cash entries (₹)'),
            listInput(mc.cashEntries, (v) => save((c) => { c.modes[m.id].cashEntries = v; }, `${m.name} cash entries → ${v.join(', ')}`)),
            h('div', { class: 'row between' }, h('span', {}, 'Commission %'), numInput(mc.commission, 0, 30, (v) => save((c) => { c.modes[m.id].commission = v; }, `${m.name} commission ${v}%`))));
        }))));
  },

  tournaments() {
    return h('div', { class: 'adm-stack' },
      h('div', { class: 'row' }, h('button', { class: 'btn btn-gold btn-sm', onclick: tournamentForm }, icon('plus'), 'New tournament')),
      panel('Scheduled & live', table(['Name', 'Mode', 'Currency', 'Entry', 'Pool', 'Players', 'Starts', 'Status', ''], [
        ['Weekend Mega', 'Classic', 'Coins', '500', '1,00,000', '388/512', 'Sat 8 PM', statusTag('active'), h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
        ['Timer Rush', 'Timer', 'Cash', '₹20', '₹5,000', '201/256', 'Today 9 PM', statusTag('active'), h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
        ['Quick Knockout', 'Quick', 'Coins', '100', '20,000', '128/128', 'Live', h('span', { class: 'tag tag-live' }, 'Live'), h('button', { class: 'btn btn-ghost btn-sm' }, 'Bracket')],
      ])));
  },

  finance() {
    const q = h('div');
    const draw = () => q.replaceChildren(table(['ID', 'Player', 'Amount', 'UPI', 'Risk', 'Requested', ''], withdrawals.map((w) => [
      w.id, h('span', {}, h('b', {}, w.user.name), h('div', { class: 'dim' }, w.user.id)), h('b', {}, fmt.inr(w.amount)), w.upi,
      h('span', { class: `tag ${w.risk === 'high' ? 'tag-live' : 'tag-cash'}`, title: w.note ?? '' }, w.risk), w.at,
      w.done ? h('span', { class: 'tag' }, w.done) : h('span', { class: 'row', style: { gap: '6px' } },
        h('button', { class: 'btn btn-cash btn-sm', onclick: () => { w.done = 'Paid'; logAudit(`Approved ${w.id}`); toast('Payout sent', 'ok'); draw(); } }, 'Approve'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { w.done = 'Rejected'; logAudit(`Rejected ${w.id}`); toast('Rejected, amount returned to winnings'); draw(); } }, 'Reject')),
    ])));
    draw();
    return h('div', { class: 'adm-stack' },
      h('div', { class: 'kpi-grid' },
        kpi('Deposits today', '₹1,84,300', '+18%', 'plus', 'var(--grad-cash)'),
        kpi('Withdrawn today', '₹71,950', '+4%', 'download', 'var(--grad-gold)'),
        kpi('TDS deducted', '₹9,420', null, 'doc', 'var(--grad-violet)'),
        kpi('Gateway success', '97.8%', null, 'check', 'var(--grad-cash)')),
      panel('Withdrawal queue', q),
      panel('Recent deposits', table(['Txn', 'Player', 'Amount', 'Method', 'Status', 'Time'], [
        ['D-55120', 'Diya Patel', '₹500', 'UPI', statusTag('active'), '1 min ago'],
        ['D-55119', 'Kabir Singh', '₹100', 'UPI', statusTag('active'), '3 min ago'],
        ['D-55117', 'Arjun Mehta', '₹2,000', 'Card', h('span', { class: 'tag tag-coin' }, 'pending'), '6 min ago'],
      ])));
  },

  kyc() {
    const pending = users.filter((u) => u.kyc === 'pending');
    const box = h('div');
    const draw = () => box.replaceChildren(table(['Player', 'PAN', 'Name on PAN', 'DOB', 'Match', ''], pending.map((u, i) => [
      h('b', {}, u.name), `ABCDE${1234 + i}F`, u.name.toUpperCase(), `1${i}/0${(i % 9) + 1}/199${i % 10}`,
      h('span', { class: 'tag tag-cash' }, 'Name ✓ · 18+ ✓'),
      u.kyc !== 'pending' ? h('span', { class: 'tag' }, u.kyc) : h('span', { class: 'row', style: { gap: '6px' } },
        h('button', { class: 'btn btn-cash btn-sm', onclick: () => { u.kyc = 'verified'; logAudit(`KYC approved ${u.id}`); draw(); } }, 'Approve'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { u.kyc = 'rejected'; logAudit(`KYC rejected ${u.id}`); draw(); } }, 'Reject')),
    ])));
    draw();
    return h('div', { class: 'adm-stack' }, panel('Pending verification', box));
  },

  reports() {
    const box = h('div', { class: 'adm-stack' });
    const words = h('textarea', { class: 'field textarea', rows: 3 }, 'gaali1, gaali2, abuse-word, …');
    const draw = () => box.replaceChildren(...reports.map((r) => h('div', { class: 'report' },
      h('div', { class: 'row between' },
        h('span', { class: 'row' }, h('span', { class: 'avatar', style: { '--size': '34px' } }, AVATARS[r.target.avatar]), h('span', {}, h('b', {}, r.target.name), h('div', { class: 'dim' }, `${r.target.id} · ${r.count} reports`))),
        h('span', { class: 'tag tag-live' }, r.reason)),
      h('p', { class: 'evidence' }, r.evidence),
      h('div', { class: 'dim' }, `Latest by ${r.by.name} · ${r.at}`),
      r.done ? h('span', { class: 'tag' }, r.done) : h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => act(r, 'Warned') }, 'Warn'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => act(r, 'Chat muted 24h') }, 'Mute chat'),
        h('button', { class: 'btn btn-danger btn-sm', onclick: () => banModal(r.target, () => act(r, 'Banned')) }, 'Ban'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => act(r, 'Dismissed') }, 'Dismiss')))));
    const act = (r, what) => { r.done = what; logAudit(`${what}: ${r.target.id} (${r.id})`); toast(what, 'ok'); draw(); };
    draw();
    return h('div', { class: 'adm-cols' },
      panel('Open reports', box),
      panel('Chat filter',
        h('p', { class: 'dim' }, 'Blocked words (Hindi, English, Hinglish). Matching messages are masked before anyone sees them.'),
        words,
        h('div', { class: 'set-list' },
          setRow('Text chat', 'Free-text messages in matches', toggle(store.config.chat.text, (v) => store.update((s) => { s.config.chat.text = v; }))),
          setRow('Voice chat', 'Peer-to-peer voice in matches', toggle(store.config.chat.voice, (v) => store.update((s) => { s.config.chat.voice = v; }))),
          setRow('Quick chat', 'Preset phrases and emojis', toggle(store.config.chat.quick, (v) => store.update((s) => { s.config.chat.quick = v; })))),
        h('button', { class: 'btn btn-gold btn-sm', onclick: () => toast('Filter saved', 'ok') }, 'Save filter')));
  },

  automation() {
    return h('div', { class: 'adm-stack' },
      h('p', { class: 'muted' }, 'These rules run on their own. Every automatic action is written to the audit log and can be undone by an admin.'),
      h('div', { class: 'auto-grid' }, automation.map((a) => h('div', { class: 'auto-card' },
        h('div', { class: 'row between' }, h('b', {}, a.name), toggle(a.on, (v) => { a.on = v; logAudit(`${a.name} ${v ? 'ON' : 'OFF'}`); toast('Saved', 'ok'); })),
        h('p', { class: 'dim' }, a.desc),
        a.value !== null ? h('div', { class: 'row' }, numInput(a.value, 0, 100000, (v) => { a.value = v; toast('Saved', 'ok'); }), h('span', { class: 'dim' }, a.unit)) : null))));
  },

  economy() {
    const cfg = store.config;
    const save = (fn) => { store.update((s) => fn(s.config)); toast('Saved', 'ok'); };
    return h('div', { class: 'adm-cols' },
      panel('Bonuses',
        h('div', { class: 'set-list' },
          setRow('Signup bonus (coins)', 'Given once after profile setup', numInput(cfg.signupBonus, 0, 100000, (v) => save((c) => { c.signupBonus = v; }))),
          setRow('Referral bonus (coins)', 'For each friend who plays one game', numInput(cfg.referralBonus, 0, 100000, (v) => save((c) => { c.referralBonus = v; }))),
          setRow('Minimum withdrawal (₹)', 'Smallest payout a player can request', numInput(cfg.minWithdraw, 1, 100000, (v) => save((c) => { c.minWithdraw = v; }))))),
      panel('Daily login bonus (coins)',
        h('div', { class: 'daily-admin' }, cfg.dailyBonus.map((v, i) => h('label', {}, h('span', { class: 'dim' }, `Day ${i + 1}`),
          numInput(v, 0, 100000, (nv) => save((c) => { c.dailyBonus[i] = nv; })))))),
      panel('Coin packs (price in ₹)', table(['Coins', 'Price', 'Tag', ''], [
        ['1,000', '₹19', '—', h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
        ['5,500', '₹99', '—', h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
        ['12,000', '₹199', 'Best value', h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
        ['30,000', '₹449', '—', h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
      ])));
  },

  content() {
    const title = h('input', { placeholder: 'Title', value: 'Timer Rush starts at 9 PM!' });
    const text = h('textarea', { class: 'field textarea', rows: 3 }, 'Entry ₹20 · Prize pool ₹5,000. Register now.');
    return h('div', { class: 'adm-cols' },
      panel('Send push notification',
        h('div', { class: 'stack' },
          h('label', { class: 'field' }, title), text,
          h('select', { class: 'select field' }, ['All players', 'Inactive 7+ days', 'Cash players', 'Level 10+', 'Specific player ID'].map((o) => h('option', {}, o))),
          h('div', { class: 'row' },
            h('button', { class: 'btn btn-gold btn-sm', onclick: () => { logAudit(`Push sent: ${title.value}`); toast('Push queued for 48,210 players', 'ok'); } }, icon('send'), 'Send now'),
            h('button', { class: 'btn btn-ghost btn-sm', onclick: () => toast('Scheduled', 'ok') }, icon('clock'), 'Schedule')))),
      panel('Home banners', table(['Banner', 'Link', 'Active', ''], [
        ['Timer Mode is LIVE', 'lobby/timer', toggle(true), h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
        ['Weekend Mega Tournament', 'tournaments', toggle(true), h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
        ['Invite friends, earn 250', 'refer', toggle(true), h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
      ])),
      panel('App version',
        h('div', { class: 'set-list' },
          setRow('Latest version', '0.1.0', h('span', { class: 'tag tag-cash' }, 'Live')),
          setRow('Force update below', 'Older apps must update to play', h('input', { class: 'field mini', value: '0.1.0' })))));
  },

  staff() {
    const perms = ['Users', 'Ban', 'Payments', 'KYC', 'Games config', 'Push', 'Staff'];
    const roles = [['Super admin', [1, 1, 1, 1, 1, 1, 1]], ['Moderator', [1, 1, 0, 0, 0, 0, 0]], ['Finance', [1, 0, 1, 1, 0, 0, 0]], ['Support', [1, 0, 0, 0, 0, 0, 0]], ['Marketing', [0, 0, 0, 0, 0, 1, 0]]];
    return h('div', { class: 'adm-stack' },
      panel('Team', table(['Name', 'Role', '2-step login', 'Last active', ''], [
        ['Sujal', 'Super admin', h('span', { class: 'tag tag-cash' }, 'On'), 'Now', ''],
        ['Priya', 'Moderator', h('span', { class: 'tag tag-cash' }, 'On'), '5 min ago', h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
        ['Amit', 'Finance', h('span', { class: 'tag tag-cash' }, 'On'), '1 h ago', h('button', { class: 'btn btn-ghost btn-sm' }, 'Edit')],
      ])),
      panel('Role permissions', table(['Role', ...perms], roles.map(([r, p]) => [h('b', {}, r), ...p.map((x) => (x ? h('span', { class: 'gold' }, '✓') : h('span', { class: 'dim' }, '—')))]))));
  },

  audit() {
    return panel('Every admin and system action', table(['Who', 'Action', 'Reason', 'Time'], audit.map((a) => a)));
  },

  settings() {
    return h('div', { class: 'adm-cols' },
      panel('Login methods',
        h('div', { class: 'set-list' },
          setRow('Truecaller', 'Free one-tap mobile verification', toggle(true)),
          setRow('Google', 'Free', toggle(true)),
          setRow('Mobile OTP (SMS)', 'Paid per SMS · MSG91 / Fast2SMS', toggle(true)),
          setRow('Guest play', 'Coins only until verified', toggle(true)))),
      panel('Integrations',
        h('div', { class: 'set-list' },
          setRow('Payment gateway', 'Razorpay / Cashfree keys (server only)', h('span', { class: 'tag' }, 'Not connected')),
          setRow('SMS provider', 'DLT template required in India', h('span', { class: 'tag' }, 'Not connected')),
          setRow('Voice relay (TURN)', 'Optional; improves voice on strict networks', h('span', { class: 'tag' }, 'Off')))),
      panel('Server',
        h('div', { class: 'set-list' },
          setRow('Hosting', 'cPanel · PHP 8.2 · MySQL 8', h('span', { class: 'tag tag-cash' }, 'Healthy')),
          setRow('Players online', 'Shared hosting comfortable up to ~300', h('b', {}, '2,481 (demo)')),
          setRow('Reset demo data', 'Restore the prototype defaults', h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { store.reset(); toast('Demo data reset'); go('admin/dashboard', { replace: true }); } }, 'Reset')))));
  },
};

// ------------------------------------------------------------ helpers

function alertRow(ic, text, to) {
  return h('button', { class: 'alert-row', onclick: () => go(`admin/${to}`, { replace: true }) }, icon(ic), h('span', { class: 'grow' }, text), icon('chevron', 'chev'));
}

function setRow(title, sub, control) {
  return h('div', { class: 'set-row' }, h('div', { class: 'grow' }, h('b', {}, title), h('div', { class: 'dim' }, sub)), control);
}

function numInput(value, min, max, onchange) {
  return h('input', {
    class: 'field mini', type: 'number', value, min, max,
    onchange: (e) => {
      const v = Math.max(min, Math.min(max, Math.floor(Number(e.target.value) || 0)));
      e.target.value = v;
      onchange(v);
    },
  });
}

function listInput(values, onchange) {
  return h('input', {
    class: 'field mini wide', value: values.join(', '),
    onchange: (e) => {
      const list = [...new Set(e.target.value.split(/[,\s]+/).map((x) => Math.floor(Number(x))).filter((x) => x >= 0 && Number.isFinite(x)))].sort((a, b) => a - b).slice(0, 8);
      e.target.value = list.join(', ');
      onchange(list);
    },
  });
}

function logAudit(action) {
  const t = new Date();
  audit.unshift(['Sujal (Super admin)', action, '', `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`]);
}

function banModal(u, done) {
  let kind = '7d';
  const reason = h('textarea', { class: 'field textarea', rows: 2, placeholder: 'Reason (required, shown to the player)' });
  modal((close) => [
    h('h3', { style: { fontSize: '22px', marginBottom: '4px' } }, `Ban ${u.name}`),
    h('p', { class: 'dim', style: { marginBottom: '12px' } }, u.id),
    h('div', { class: 'ban-opts' }, [['chat', 'Chat only'], ['voice', 'Voice only'], ['1d', '1 day'], ['7d', '7 days'], ['30d', '30 days'], ['perm', 'Permanent'], ['device', 'Device ban']].map(([v, l]) => h('button', {
      class: `tab${v === kind ? ' on' : ''}`,
      onclick: (e) => { kind = v; e.currentTarget.parentElement.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t === e.currentTarget)); },
    }, l))),
    reason,
    h('label', { class: 'row', style: { margin: '10px 0', textAlign: 'left' } }, h('input', { type: 'checkbox' }), h('span', { class: 'dim' }, 'Also freeze cash withdrawals')),
    h('button', {
      class: 'btn btn-danger btn-block',
      onclick: () => {
        if (reason.value.trim().length < 4) return toast('Add a reason', 'err');
        u.status = kind === 'chat' || kind === 'voice' ? 'chat-muted' : 'banned';
        logAudit(`Ban (${kind}) ${u.id}: ${reason.value.trim()}`);
        close();
        toast(`${u.name} banned`, 'ok');
        done?.();
      },
    }, 'Confirm ban'),
  ]);
}

function userModal(u, refresh) {
  modal((close) => [
    h('span', { class: 'avatar', style: { '--size': '64px', margin: '0 auto' } }, AVATARS[u.avatar]),
    h('h3', { style: { fontSize: '22px', margin: '8px 0 2px' } }, u.name),
    h('p', { class: 'dim' }, `${u.id} · ${u.phone} · joined ${u.joined}`),
    h('div', { class: 'stat-grid', style: { margin: '14px 0' } },
      h('div', { class: 'stat' }, h('b', {}, fmt.num(u.coins)), h('span', { class: 'dim' }, 'Coins')),
      h('div', { class: 'stat' }, h('b', {}, fmt.inr(u.cash)), h('span', { class: 'dim' }, 'Cash')),
      h('div', { class: 'stat' }, h('b', {}, `${u.winRate}%`), h('span', { class: 'dim' }, 'Win rate'))),
    h('div', { class: 'set-list', style: { textAlign: 'left' } },
      setRow('Device', u.device, h('span')),
      setRow('Last IP', u.ip, h('span')),
      setRow('KYC', u.kyc, h('span')),
      setRow('Status', '', statusTag(u.status))),
    h('div', { class: 'row', style: { marginTop: '12px' } },
      h('button', {
        class: 'btn btn-gold btn-sm grow',
        onclick: async () => {
          if (await confirmBox({ title: 'Give 500 coins?', text: 'Reason: goodwill (logged).', ok: 'Give' })) { u.coins += 500; logAudit(`+500 coins to ${u.id}`); toast('Coins added', 'ok'); close(); refresh(); }
        },
      }, 'Adjust coins'),
      h('button', { class: 'btn btn-danger btn-sm grow', onclick: () => { close(); banModal(u, refresh); } }, 'Ban')),
  ]);
}

function tournamentForm() {
  modal((close) => [
    h('h3', { style: { fontSize: '22px', marginBottom: '12px' } }, 'New tournament'),
    h('div', { class: 'stack', style: { textAlign: 'left' } },
      h('label', { class: 'field' }, h('input', { placeholder: 'Name' })),
      h('select', { class: 'select field' }, MODES.map((m) => h('option', {}, m.name))),
      h('select', { class: 'select field' }, h('option', {}, 'Coins'), store.config.realMoney ? h('option', {}, 'Cash') : null),
      h('div', { class: 'row' }, h('label', { class: 'field grow' }, h('input', { type: 'number', placeholder: 'Entry' })), h('label', { class: 'field grow' }, h('input', { type: 'number', placeholder: 'Max players' }))),
      h('label', { class: 'field' }, h('input', { type: 'datetime-local', 'aria-label': 'Start time' })),
      h('button', { class: 'btn btn-gold btn-block', onclick: () => { close(); logAudit('Created tournament'); toast('Tournament scheduled', 'ok'); } }, 'Create')),
  ]);
}
