import { h, icon, go, toast, topbar, seg, toggle, sheet, confirmBox, money, coinIcon, fmt } from '../ui/kit.js';
import { store, AVATARS, SHOP, HISTORY } from '../data.js';

export function profileScreen() {
  const u = store.user;
  const s = u.stats;
  const winRate = Math.round((s.won / Math.max(1, s.played)) * 100);
  const link = (ic, label, to, extra) => h('button', { class: 'list-item', onclick: () => go(to) },
    h('span', { class: 'li-ico' }, icon(ic)), h('span', { class: 'grow' }, label), extra ?? null, icon('chevron', 'chev'));
  return h('section', { class: 'screen' },
    topbar('Profile', { backTo: 'home', right: [h('button', { class: 'icon-btn', onclick: () => go('settings') }, icon('settings'))] }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('div', { class: 'card profile-card' },
        h('button', { class: 'avatar', style: { '--size': '86px' }, onclick: () => go('setup') }, AVATARS[u.avatar], h('span', { class: 'lvl' }, `Lv ${u.level}`)),
        h('h2', { style: { fontSize: '26px', marginTop: '10px' } }, u.name),
        h('span', { class: 'dim' }, `ID ${u.id} · ${u.phone}`),
        h('div', { class: 'xp' }, h('span', { style: { width: `${(u.xp / u.xpNext) * 100}%` } })),
        h('span', { class: 'dim' }, `${u.xp}/${u.xpNext} XP to level ${u.level + 1}`)),
      h('div', { class: 'stat-grid' },
        stat('Played', s.played), stat('Won', s.won), stat('Win rate', `${winRate}%`),
        stat('Streak', `🔥 ${s.streak}`), stat('Captures', s.captures), stat('Best rank', `#${s.bestRank}`)),
      h('div', { class: 'section-title' }, h('h3', {}, 'Recent matches'), h('button', { onclick: () => go('history') }, 'See all')),
      h('div', { class: 'card-flat list', style: { padding: 0 } }, HISTORY.slice(0, 3).map(historyRow)),
      h('div', { class: 'card-flat list', style: { padding: 0 } },
        link('users', 'Friends', 'friends'),
        link('gift', 'Rewards & spin', 'rewards'),
        link('share', 'Refer & earn', 'refer'),
        link('cart', 'Shop', 'shop'),
        link('shieldCheck', 'Verification (KYC)', 'kyc', h('span', { class: `tag ${u.kyc === 'verified' ? 'tag-cash' : ''}` }, u.kyc)),
        link('help', 'Help & support', 'help'),
        link('doc', 'Terms & policies', 'legal/terms'),
        h('button', { class: 'list-item', onclick: () => go('admin') }, h('span', { class: 'li-ico', style: { color: 'var(--gold)' } }, icon('sliders')), h('span', { class: 'grow' }, 'Admin panel (demo)'), icon('chevron', 'chev'))),
      h('button', {
        class: 'btn btn-ghost btn-block', style: { color: 'var(--danger)' },
        onclick: async () => {
          if (await confirmBox({ title: 'Log out?', text: 'You can log back in anytime.', ok: 'Log out', danger: true })) {
            store.loggedIn = false;
            go('login', { replace: true });
          }
        },
      }, icon('logout'), 'Log out')));
}

const stat = (label, value) => h('div', { class: 'stat' }, h('b', {}, value), h('span', { class: 'dim' }, label));

export function historyRow(m) {
  const win = m.rank === 1;
  return h('div', { class: 'list-item' },
    h('span', { class: 'li-ico', style: { color: win ? 'var(--gold)' : 'var(--text-3)' } }, icon(win ? 'trophy' : 'dice')),
    h('div', { class: 'grow' }, h('b', {}, `${m.mode} · ${m.players}P`), h('div', { class: 'dim' }, m.at)),
    h('span', { class: `tag ${win ? 'tag-cash' : ''}` }, m.result),
    m.amount ? h('b', { class: m.amount > 0 ? 'cash' : '' }, m.amount > 0 ? '+' : '−', m.currency === 'cash' ? fmt.inr(Math.abs(m.amount)) : fmt.num(Math.abs(m.amount))) : null);
}

export function historyScreen() {
  return h('section', { class: 'screen' },
    topbar('Match history', { backTo: 'profile' }),
    h('div', { class: 'scroll pad' }, h('div', { class: 'card-flat list', style: { padding: 0 } }, [...HISTORY, ...HISTORY].map(historyRow))));
}

export function settingsScreen() {
  const st = store.user.settings;
  const set = (k) => (v) => store.update((s) => { s.user.settings[k] = v; });
  const row = (ic, label, control, sub) => h('div', { class: 'list-item' },
    h('span', { class: 'li-ico' }, icon(ic)),
    h('div', { class: 'grow' }, h('b', {}, label), sub ? h('div', { class: 'dim' }, sub) : null),
    control);
  return h('section', { class: 'screen' },
    topbar('Settings', { backTo: 'profile' }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('div', { class: 'label' }, 'Game'),
      h('div', { class: 'card-flat list', style: { padding: 0 } },
        row('volume', 'Sound effects', toggle(st.sound, set('sound'))),
        row('play', 'Music', toggle(st.music, set('music'))),
        row('phone', 'Vibration', toggle(st.vibration, set('vibration'))),
        row('globe', 'Language', h('select', { class: 'select', onchange: (e) => set('lang')(e.target.value) },
          h('option', { value: 'en', selected: st.lang === 'en' }, 'English'),
          h('option', { value: 'hi', selected: st.lang === 'hi' }, 'हिन्दी'),
          h('option', { value: 'hinglish', selected: st.lang === 'hinglish' }, 'Hinglish')))),
      h('div', { class: 'label' }, 'Chat & voice'),
      h('div', { class: 'card-flat list', style: { padding: 0 } },
        row('chat', 'Allow chat', toggle(true), 'Quick chat and messages from players'),
        row('mic', 'Voice chat', toggle(true), 'Hear other players in matches'),
        row('users', 'Friend requests', toggle(true))),
      h('div', { class: 'label' }, 'Responsible gaming'),
      h('div', { class: 'card-flat list', style: { padding: 0 } },
        h('button', { class: 'list-item', onclick: limitsSheet }, h('span', { class: 'li-ico' }, icon('shield')), h('div', { class: 'grow' }, h('b', {}, 'Deposit limits'), h('div', { class: 'dim' }, 'Daily ₹10,000 · Monthly ₹50,000')), icon('chevron', 'chev')),
        h('button', { class: 'list-item', onclick: () => confirmBox({ title: 'Take a break?', text: 'You will not be able to play cash games for the period you choose.', ok: 'Pause 7 days' }).then((ok) => ok && toast('Break started: 7 days')) },
          h('span', { class: 'li-ico' }, icon('clock')), h('div', { class: 'grow' }, h('b', {}, 'Take a break'), h('div', { class: 'dim' }, 'Pause cash games for 1 day to 6 months')), icon('chevron', 'chev'))),
      h('div', { class: 'label' }, 'Account'),
      h('div', { class: 'card-flat list', style: { padding: 0 } },
        h('button', { class: 'list-item', onclick: () => go('setup') }, h('span', { class: 'li-ico' }, icon('edit')), h('span', { class: 'grow' }, 'Edit name & avatar'), icon('chevron', 'chev')),
        h('button', { class: 'list-item', onclick: () => toast('Google account linked', 'ok') }, h('span', { class: 'li-ico' }, icon('link')), h('span', { class: 'grow' }, 'Linked accounts'), icon('chevron', 'chev')),
        h('button', {
          class: 'list-item',
          onclick: async () => {
            if (await confirmBox({ title: 'Delete account?', text: 'Your data is erased after 30 days. Withdraw your winnings first.', ok: 'Delete', danger: true })) toast('Deletion requested');
          },
        }, h('span', { class: 'li-ico', style: { color: 'var(--danger)' } }, icon('trash')), h('span', { class: 'grow', style: { color: 'var(--danger)' } }, 'Delete account'))),
      h('p', { class: 'dim center' }, 'Veer Champs v0.1.0 (prototype)')));
}

function limitsSheet() {
  sheet((close) => [
    h('h3', { style: { fontSize: '20px', marginBottom: '6px' } }, 'Deposit limits'),
    h('p', { class: 'dim', style: { marginBottom: '12px' } }, 'Lowering takes effect now. Raising takes effect after 24 hours.'),
    h('div', { class: 'stack' },
      h('div', { class: 'label' }, 'Daily'), h('label', { class: 'field' }, h('span', {}, '₹'), h('input', { type: 'number', value: 10000 })),
      h('div', { class: 'label' }, 'Monthly'), h('label', { class: 'field' }, h('span', {}, '₹'), h('input', { type: 'number', value: 50000 })),
      h('button', { class: 'btn btn-gold btn-block', onclick: () => { close(); toast('Limits saved', 'ok'); } }, 'Save')),
  ]);
}

export function shopScreen() {
  let kind = 'All';
  const grid = h('div', { class: 'shop-grid' });
  const draw = () => grid.replaceChildren(...SHOP.filter((i) => kind === 'All' || i.kind === kind).map((i) => h('div', { class: 'shop-item' },
    h('div', { class: `si-prev prev-${i.preview}` }, i.kind === 'Dice' ? '🎲' : i.kind === 'Board' ? '▦' : i.kind === 'Tokens' ? '📍' : '🖼️'),
    h('b', {}, i.name),
    h('span', { class: 'dim' }, i.kind),
    i.owned ? h('span', { class: 'btn btn-ghost btn-sm' }, 'Owned') : h('button', {
      class: 'btn btn-gold btn-sm',
      onclick: async () => {
        if (store.user.coins < i.price) return toast('Not enough coins', 'err');
        if (await confirmBox({ title: `Buy ${i.name}?`, text: `${fmt.num(i.price)} coins`, ok: 'Buy' })) {
          store.update((s) => { s.user.coins -= i.price; });
          i.owned = true;
          draw();
          toast('Purchased!', 'ok');
        }
      },
    }, coinIcon('coin-ico sm'), fmt.num(i.price)))));
  draw();
  const packs = [[1000, 19], [5500, 99], [12000, 199], [30000, 449]];
  return h('section', { class: 'screen' },
    topbar('Shop', { right: [h('span', { class: 'chip-cur' }, coinIcon(), fmt.short(store.user.coins))] }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('div', { class: 'section-title' }, h('h3', {}, 'Coin packs')),
      h('div', { class: 'pack-grid' }, packs.map(([coins, price], i) => h('button', {
        class: `pack${i === 2 ? ' best' : ''}`,
        onclick: () => { store.update((s) => { s.user.coins += coins; }); toast(`+${fmt.num(coins)} coins`, 'ok'); go('shop/coins', { replace: true }); },
      },
      i === 2 ? h('span', { class: 'tag tag-hot' }, 'Best value') : null,
      h('span', { style: { fontSize: '34px' } }, ['🪙', '💰', '👑', '💎'][i]),
      h('b', {}, fmt.num(coins)),
      h('span', { class: 'btn btn-cash btn-sm' }, `₹${price}`)))),
      h('button', { class: 'card-flat row', onclick: () => { store.update((s) => { s.user.coins += 100; }); toast('+100 coins for watching', 'ok'); } },
        h('span', { style: { fontSize: '28px' } }, '📺'), h('div', { class: 'grow', style: { textAlign: 'left' } }, h('b', {}, 'Watch an ad'), h('div', { class: 'dim' }, '+100 free coins · 5 left today')), icon('chevron', 'chev')),
      h('div', { class: 'section-title' }, h('h3', {}, 'Skins')),
      h('div', { class: 'tabs' }, ['All', 'Dice', 'Board', 'Tokens', 'Frames'].map((k) => h('button', { class: `tab${k === kind ? ' on' : ''}`, onclick: (e) => { kind = k; e.currentTarget.parentElement.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t === e.currentTarget)); draw(); } }, k))),
      grid));
}

export function rewardsScreen() {
  const prizes = [50, 100, 25, 500, 75, 200, 10, 1000];
  const wheel = h('div', { class: 'wheel' }, prizes.map((p, i) => h('span', { style: { '--i': i } }, h('b', {}, fmt.short(p)))));
  let spinning = false;
  let angle = 0;
  const spinBtn = h('button', {
    class: 'btn btn-saffron',
    onclick: () => {
      if (spinning) return;
      spinning = true;
      const idx = Math.floor(Math.random() * prizes.length);
      angle += 360 * 5 + (360 - idx * 45) - (angle % 360);
      wheel.style.transform = `rotate(${angle}deg)`;
      setTimeout(() => {
        store.update((s) => { s.user.coins += prizes[idx]; });
        toast(`You won ${prizes[idx]} coins!`, 'ok');
        spinBtn.disabled = true;
        spinBtn.textContent = 'Next free spin in 23:59';
      }, 4200);
    },
  }, 'SPIN FREE');
  return h('section', { class: 'screen' },
    topbar('Rewards', { backTo: 'home' }),
    h('div', { class: 'scroll pad stack center', style: { paddingTop: 0, alignItems: 'center' } },
      h('div', { class: 'wheel-wrap' }, wheel, h('span', { class: 'wheel-pin' }), h('span', { class: 'wheel-hub' }, '👑')),
      spinBtn,
      h('div', { class: 'card-flat list', style: { padding: 0, width: '100%', textAlign: 'left' } },
        task('🎮', 'Play 3 games today', '2/3', 150),
        task('⚔️', 'Capture 5 tokens', '5/5', 100, true),
        task('🏆', 'Win a Timer match', '0/1', 250),
        task('👥', 'Invite a friend', '0/1', store.config.referralBonus))));
}

function task(emoji, title, progress, reward, ready = false) {
  return h('div', { class: 'list-item' },
    h('span', { style: { fontSize: '26px' } }, emoji),
    h('div', { class: 'grow' }, h('b', {}, title), h('div', { class: 'dim' }, progress)),
    ready ? h('button', { class: 'btn btn-gold btn-sm', onclick: (e) => { e.currentTarget.replaceWith(h('span', { class: 'tag tag-cash' }, 'Claimed')); toast(`+${reward} coins`, 'ok'); } }, `+${reward}`) : money('coins', reward));
}

export function referScreen() {
  const code = `VEER${store.user.id.slice(-4)}`;
  return h('section', { class: 'screen' },
    topbar('Refer & earn', { backTo: 'home' }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('div', { class: 'card center stack refer-hero', style: { alignItems: 'center' } },
        h('span', { style: { fontSize: '56px' } }, '🤝'),
        h('h2', { style: { fontSize: '24px' } }, `Get ${store.config.referralBonus} coins per friend`),
        h('p', { class: 'muted' }, 'Your friend gets a bonus too, after their first game.'),
        h('div', { class: 'room-code' }, [...code].map((c) => h('span', {}, c))),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { navigator.clipboard?.writeText(code); toast('Code copied', 'ok'); } }, icon('copy'), 'Copy'),
          h('button', { class: 'btn btn-cash btn-sm', onclick: () => toast('Opening WhatsApp…') }, icon('share'), 'Share on WhatsApp'))),
      h('div', { class: 'stat-grid' }, stat('Invited', 6), stat('Joined', 4), stat('Earned', fmt.num(1000))),
      h('ul', { class: 'rules' },
        h('li', {}, 'Share your code or link.'),
        h('li', {}, 'Your friend signs up with it and plays one game.'),
        h('li', {}, 'You both get the bonus. Fake or duplicate accounts are not counted.'))));
}

export function helpScreen() {
  const faqs = [
    ['How do I withdraw my winnings?', 'Verify once (PAN + bank/UPI), then go to Wallet › Withdraw. Most withdrawals reach you within an hour.'],
    ['My game disconnected. Did I lose?', 'No. You have 60 seconds to come back; the game plays safe moves for you meanwhile. If our server fails, your entry is refunded automatically.'],
    ['Can coins be converted to cash?', 'No. Coins are only for fun games, tournaments and skins.'],
    ['Is the dice fair?', 'Every roll is generated on our server with a certified random number generator. Nobody, including us, can choose a number.'],
    ['Someone is abusing in chat.', 'Tap their avatar › Report. Mute them right away from the same menu.'],
  ];
  return h('section', { class: 'screen' },
    topbar('Help & support', { backTo: 'profile' }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('div', { class: 'row' },
        h('button', { class: 'side-card', onclick: () => ticketSheet() }, h('span', { class: 'sc-ico', style: { background: 'var(--grad-violet)' } }, icon('chat')), h('b', {}, 'Raise a ticket'), h('span', { class: 'dim' }, 'Reply in 2 hours')),
        h('button', { class: 'side-card', onclick: () => toast('Opening WhatsApp support…') }, h('span', { class: 'sc-ico', style: { background: 'var(--grad-cash)' } }, icon('phone')), h('b', {}, 'WhatsApp'), h('span', { class: 'dim' }, '10 AM – 10 PM'))),
      h('div', { class: 'section-title' }, h('h3', {}, 'FAQs')),
      h('div', { class: 'card-flat', style: { padding: '4px 14px' } }, faqs.map(([q, a]) => h('details', { class: 'faq' }, h('summary', {}, q), h('p', { class: 'muted' }, a))))));
}

function ticketSheet() {
  sheet((close) => [
    h('h3', { style: { fontSize: '20px', marginBottom: '12px' } }, 'Raise a ticket'),
    h('div', { class: 'stack' },
      h('select', { class: 'select field' }, ['Payment / deposit', 'Withdrawal', 'Game issue', 'Report a player', 'Account', 'Other'].map((o) => h('option', {}, o))),
      h('textarea', { class: 'field textarea', rows: 4, placeholder: 'Describe the problem…', maxlength: 500 }),
      h('button', { class: 'btn btn-gold btn-block', onclick: () => { close(); toast('Ticket #48213 created', 'ok'); } }, 'Submit')),
  ]);
}

export function legalScreen(page = 'terms') {
  const pages = {
    terms: ['Terms of Service', ['Veer Champs is for users 18 years and older.', 'One account per person. Multiple accounts, collusion or bots lead to a permanent ban and forfeited balance.', 'Cash games are available only where the law allows them. Check your local laws before playing.', 'Coins have no cash value and cannot be withdrawn.']],
    privacy: ['Privacy Policy', ['We store your mobile number, profile, game history and transactions to run the service.', 'Voice chat is peer-to-peer and not recorded. Text chat is stored for 30 days for safety reviews.', 'You can download or delete your data from Settings › Account.']],
    fairplay: ['Fair Play Policy', ['Dice rolls are generated on the server with a secure random generator.', 'We detect multiple accounts, teaming up, and unusual win patterns automatically.', 'Leaving games on purpose may pause your matchmaking.']],
  };
  const [title, items] = pages[page] ?? pages.terms;
  return h('section', { class: 'screen' },
    topbar(title),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      seg([{ value: 'terms', label: 'Terms' }, { value: 'privacy', label: 'Privacy' }, { value: 'fairplay', label: 'Fair Play' }], page, (v) => go(`legal/${v}`, { replace: true })),
      h('p', { class: 'dim' }, 'Placeholder text. Have a lawyer write the final version.'),
      h('ul', { class: 'rules' }, items.map((t) => h('li', {}, t)))));
}
