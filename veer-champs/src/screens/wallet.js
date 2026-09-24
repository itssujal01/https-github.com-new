import { h, icon, go, toast, topbar, seg, money, coinIcon, cashIcon, fmt, sheet } from '../ui/kit.js';
import { store, AVATARS, TXNS, cashTotal } from '../data.js';
import { bottomNav } from './home.js';

export function resultScreen() {
  const r = JSON.parse(sessionStorage.getItem('vc:result') || 'null');
  if (!r) { go('home', { replace: true }); return h('section', { class: 'screen' }); }
  const confetti = r.won ? h('div', { class: 'confetti' }, Array.from({ length: 40 }, (_, i) => h('i', {
    style: { left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.12}s`, background: ['#ffc83d', '#ef3b4f', '#1fbf6a', '#2f8bff', '#fff'][i % 5] },
  }))) : null;
  return h('section', { class: `screen result ${r.won ? 'won' : 'lost'}` },
    confetti,
    h('div', { class: 'scroll pad stack center', style: { alignItems: 'center', paddingTop: 'calc(30px + var(--safe-top))' } },
      h('div', { class: 'result-badge' }, r.won ? '🏆' : '🎲'),
      h('h1', { class: 'result-title' }, r.won ? 'YOU WON!' : r.timeUp ? "TIME'S UP" : 'GOOD GAME'),
      h('p', { class: 'muted' }, `${r.mode} · ${r.nPlayers} players${r.timeUp ? ' · highest score wins' : ''}`),
      r.currency !== 'practice' && r.won ? h('div', { class: 'win-amt shine' }, money(r.currency, r.prize)) : null,
      h('div', { class: 'card', style: { width: '100%' } },
        h('ol', { class: 'podium' }, r.ranking.map((p, i) => h('li', { class: p.isMe ? 'me' : '' },
          h('span', { class: 'medal' }, ['🥇', '🥈', '🥉', '4️⃣'][i]),
          h('span', { class: 'avatar', style: { '--size': '38px' } }, AVATARS[p.avatar]),
          h('b', { class: 'grow' }, p.name),
          p.score !== null ? h('span', { class: 'gold' }, `⭐ ${p.score}`) : null)))),
      h('div', { class: 'row', style: { width: '100%' } },
        h('button', { class: 'btn btn-ghost grow', onclick: () => toast('Result shared', 'ok') }, icon('share'), 'Share'),
        h('button', { class: 'btn btn-saffron grow', onclick: () => go('lobby/' + ({ Classic: 'classic', Quick: 'quick', Timer: 'timer', '2 vs 2': 'team' }[r.mode] ?? 'classic'), { replace: true }) }, icon('refresh'), 'Play again')),
      h('button', { class: 'link-btn', onclick: () => go('home', { replace: true }) }, 'Back to home')));
}

export function walletScreen() {
  const u = store.user;
  const real = store.config.realMoney;
  let tab = 'all';
  const list = h('div', { class: 'card-flat list', style: { padding: 0 } });
  const draw = () => {
    const rows = TXNS.filter((t) => tab === 'all' || t.currency === tab);
    list.replaceChildren(...rows.map(txnRow));
  };
  draw();
  return h('section', { class: 'screen' },
    h('header', { class: 'topbar' }, h('h2', {}, 'Wallet'), h('button', { class: 'icon-btn', onclick: () => go('transactions') }, icon('history'))),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      real ? h('div', { class: 'wallet-card cash-card' },
        h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Cash balance'), cashIcon()),
        h('div', { class: 'wc-amt' }, fmt.inr(cashTotal())),
        h('div', { class: 'wc-split' },
          split('Deposit', u.cash.deposit, 'Use to play'),
          split('Winnings', u.cash.winnings, 'Withdrawable'),
          split('Bonus', u.cash.bonus, '10% per entry')),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-white grow', onclick: () => go('addcash') }, icon('plus'), 'Add cash'),
          h('button', { class: 'btn btn-ghost grow', onclick: () => go('withdraw') }, icon('download'), 'Withdraw'))) : null,
      h('div', { class: 'wallet-card coin-card' },
        h('div', { class: 'row between' }, h('span', { class: 'muted' }, 'Coins'), coinIcon()),
        h('div', { class: 'wc-amt' }, fmt.num(u.coins)),
        h('p', { class: 'dim' }, 'Coins are for fun games and tournaments. They cannot be withdrawn.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-gold grow', onclick: () => go('shop/coins') }, icon('cart'), 'Get coins'),
          h('button', { class: 'btn btn-ghost grow', onclick: () => go('rewards') }, icon('gift'), 'Free coins'))),
      real && u.kyc !== 'verified' ? h('button', { class: 'card-flat row', onclick: () => go('kyc'), style: { borderColor: 'rgba(255,200,61,.5)', textAlign: 'left' } },
        h('span', { class: 'li-ico', style: { color: 'var(--gold)' } }, icon('shieldCheck')),
        h('div', { class: 'grow' }, h('b', {}, u.kyc === 'pending' ? 'Verification in review' : 'Verify to withdraw'), h('div', { class: 'dim' }, 'One-time age & ID check (18+)')),
        icon('chevron', 'chev')) : null,
      h('div', { class: 'section-title' }, h('h3', {}, 'Recent activity'), h('button', { onclick: () => go('transactions') }, 'See all')),
      real ? seg([{ value: 'all', label: 'All' }, { value: 'cash', label: 'Cash' }, { value: 'coins', label: 'Coins' }], tab, (v) => { tab = v; draw(); }) : null,
      list),
    bottomNav('wallet'));
}

function split(label, amount, hint) {
  return h('div', {}, h('span', { class: 'dim' }, label), h('b', {}, fmt.inr(amount)), h('small', {}, hint));
}

export function txnRow(t) {
  const icons = { win: 'trophy', entry: 'dice', bonus: 'gift', deposit: 'plus', withdraw: 'download', shop: 'cart', refund: 'refresh' };
  const pos = t.amount > 0;
  return h('div', { class: 'list-item' },
    h('span', { class: 'li-ico', style: { color: pos ? 'var(--cash)' : 'var(--text-2)' } }, icon(icons[t.type] ?? 'info')),
    h('div', { class: 'grow' }, h('b', {}, t.title), h('div', { class: 'dim' }, t.at, t.status ? ` · ${t.status}` : '')),
    h('b', { class: pos ? 'cash' : '' }, `${pos ? '+' : '−'}${t.currency === 'cash' ? fmt.inr(Math.abs(t.amount)) : fmt.num(Math.abs(t.amount))}`),
    t.currency === 'cash' ? cashIcon('cash-ico sm') : coinIcon('coin-ico sm'));
}

export function transactionsScreen() {
  return h('section', { class: 'screen' },
    topbar('Transactions', { backTo: 'wallet' }),
    h('div', { class: 'scroll pad' }, h('div', { class: 'card-flat list', style: { padding: 0 } }, [...TXNS, ...TXNS].map(txnRow))));
}

export function addCashScreen() {
  let amount = 100;
  const input = h('input', { type: 'number', inputmode: 'numeric', value: amount, min: 10, max: 10000 });
  const bonusNote = h('p', { class: 'dim' });
  const upd = () => {
    amount = Math.max(0, Math.floor(Number(input.value) || 0));
    bonusNote.textContent = amount >= 100 ? `You get ${fmt.inr(Math.floor(amount * 0.1))} bonus cash (10%)` : 'Add ₹100 or more for 10% bonus';
  };
  input.addEventListener('input', upd);
  upd();
  const chips = h('div', { class: 'tabs' }, [50, 100, 250, 500, 1000, 2000].map((v) => h('button', { class: 'tab', onclick: () => { input.value = v; upd(); } }, `₹${v}`)));
  return h('section', { class: 'screen' },
    topbar('Add cash', { backTo: 'wallet' }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('div', { class: 'card stack' },
        h('div', { class: 'label' }, 'Amount'),
        h('label', { class: 'field big-amt' }, h('span', {}, '₹'), input),
        chips,
        bonusNote),
      h('div', { class: 'label' }, 'Pay with'),
      h('div', { class: 'card-flat list', style: { padding: 0 } },
        payRow('UPI (GPay, PhonePe, Paytm)', 'Instant · no fee', true),
        payRow('Debit / Credit card', 'Visa, Mastercard, RuPay'),
        payRow('Net banking', 'All major banks')),
      h('div', { class: 'card-flat row' }, icon('shield'), h('span', { class: 'dim' }, 'Payments run through a licensed gateway. We never see your UPI PIN or card details.')),
      h('button', {
        class: 'btn btn-cash btn-block',
        onclick: () => {
          if (amount < 10) return toast('Minimum ₹10', 'err');
          if (amount > 10000) return toast('Maximum ₹10,000 per day', 'err');
          store.update((s) => { s.user.cash.deposit += amount; s.user.cash.bonus += amount >= 100 ? Math.floor(amount * 0.1) : 0; });
          toast(`${fmt.inr(amount)} added`, 'ok');
          go('wallet', { replace: true });
        },
      }, 'Add money securely'),
      h('p', { class: 'dim center' }, 'Daily limit ₹10,000 · Set your own limits in Settings › Responsible gaming')));
}

function payRow(title, sub, on = false) {
  return h('label', { class: 'list-item' },
    h('input', { type: 'radio', name: 'pay', checked: on }),
    h('div', { class: 'grow' }, h('b', {}, title), h('div', { class: 'dim' }, sub)));
}

export function withdrawScreen() {
  const u = store.user;
  const input = h('input', { type: 'number', inputmode: 'numeric', value: Math.min(u.cash.winnings, 500) });
  const upi = h('input', { placeholder: 'yourname@upi', value: 'sujal@okaxis' });
  return h('section', { class: 'screen' },
    topbar('Withdraw', { backTo: 'wallet' }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('div', { class: 'card center' }, h('span', { class: 'dim' }, 'Withdrawable winnings'), h('div', { class: 'wc-amt cash' }, fmt.inr(u.cash.winnings)),
        h('p', { class: 'dim' }, 'Deposits and bonus cash can be used to play, not withdrawn.')),
      u.kyc !== 'verified' ? h('div', { class: 'card-flat row', style: { borderColor: 'rgba(255,200,61,.5)' } }, icon('alert'), h('span', {}, 'Complete verification to withdraw. ', h('a', { href: '#/kyc' }, 'Verify now'))) : null,
      h('div', { class: 'label' }, 'Amount'),
      h('label', { class: 'field big-amt' }, h('span', {}, '₹'), input),
      h('div', { class: 'label' }, 'UPI ID'),
      h('label', { class: 'field' }, icon('bank'), upi),
      h('div', { class: 'card-flat stack', style: { gap: '6px' } },
        h('div', { class: 'row between' }, h('span', { class: 'dim' }, 'Amount'), h('span', {}, fmt.inr(Number(input.value) || 0))),
        h('div', { class: 'row between' }, h('span', { class: 'dim' }, 'TDS (30% on net winnings, as per law)'), h('span', {}, 'Shown at payout')),
        h('div', { class: 'row between' }, h('span', { class: 'dim' }, 'Time'), h('span', {}, 'Usually within 1 hour'))),
      h('button', {
        class: 'btn btn-cash btn-block',
        onclick: () => {
          const amt = Math.floor(Number(input.value) || 0);
          if (u.kyc !== 'verified') { toast('Please verify first', 'err'); return go('kyc'); }
          if (amt < store.config.minWithdraw) return toast(`Minimum withdrawal is ₹${store.config.minWithdraw}`, 'err');
          if (amt > u.cash.winnings) return toast('Amount is more than your winnings', 'err');
          store.update((s) => { s.user.cash.winnings -= amt; });
          toast('Withdrawal requested', 'ok');
          go('wallet', { replace: true });
        },
      }, 'Withdraw to UPI')));
}

export function kycScreen() {
  const u = store.user;
  const steps = [
    ['Mobile number', 'Verified with OTP', true],
    ['PAN card', 'Name & date of birth (18+)', u.kyc !== 'none'],
    ['Bank / UPI', 'Name must match PAN', u.kyc === 'verified'],
  ];
  return h('section', { class: 'screen' },
    topbar('Verification', { backTo: 'wallet' }),
    h('div', { class: 'scroll pad stack', style: { paddingTop: 0 } },
      h('div', { class: 'card center stack', style: { alignItems: 'center' } },
        h('span', { style: { fontSize: '48px' } }, u.kyc === 'verified' ? '✅' : u.kyc === 'pending' ? '⏳' : '🪪'),
        h('h3', { style: { fontSize: '22px' } }, u.kyc === 'verified' ? 'You are verified' : u.kyc === 'pending' ? 'Under review' : 'Verify your identity'),
        h('p', { class: 'muted' }, 'Required once for cash games and withdrawals. Keeps the platform safe and legal.')),
      h('div', { class: 'card-flat list', style: { padding: 0 } }, steps.map(([t, s, done]) => h('div', { class: 'list-item' },
        h('span', { class: 'li-ico', style: { color: done ? 'var(--cash)' : 'var(--text-3)' } }, icon(done ? 'check' : 'doc')),
        h('div', { class: 'grow' }, h('b', {}, t), h('div', { class: 'dim' }, s)),
        done ? h('span', { class: 'tag tag-cash' }, 'Done') : h('span', { class: 'tag' }, 'Pending')))),
      u.kyc === 'none' ? h('button', {
        class: 'btn btn-gold btn-block',
        onclick: () => sheet((close) => [
          h('h3', { style: { fontSize: '20px', marginBottom: '12px' } }, 'PAN details'),
          h('div', { class: 'stack' },
            h('label', { class: 'field' }, h('input', { placeholder: 'PAN number (ABCDE1234F)', maxlength: 10 })),
            h('label', { class: 'field' }, h('input', { placeholder: 'Name as on PAN' })),
            h('label', { class: 'field' }, h('input', { type: 'date', 'aria-label': 'Date of birth' })),
            h('button', { class: 'btn btn-gold btn-block', onclick: () => { store.update((s) => { s.user.kyc = 'pending'; }); close(); toast('Submitted for review', 'ok'); go('wallet', { replace: true }); } }, 'Submit')),
        ]),
      }, 'Start verification') : null,
      u.kyc === 'pending' ? h('button', { class: 'btn btn-ghost btn-block', onclick: () => { store.update((s) => { s.user.kyc = 'verified'; }); toast('Approved (demo)', 'ok'); go('wallet', { replace: true }); } }, 'Simulate approval (demo)') : null));
}
