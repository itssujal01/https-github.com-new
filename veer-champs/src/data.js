// Prototype data store. In production these come from the PHP + MySQL API;
// here they live in localStorage so admin changes show up in the app.

const KEY = 'vc:proto:v1';

export const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐸', '🐙', '🦄', '🐲', '🦉', '🐺', '🦖', '🐵', '🦅', '🐻', '🐨', '🐧'];

export const GAMES = [
  { id: 'ludo', name: 'Ludo', tagline: 'Classic · Quick · Timer · 2v2', color: '#ef3b4f', art: 'ludo' },
  { id: 'snakes', name: 'Snakes & Ladders', tagline: 'Roll, climb, win', color: '#1fbf6a', art: 'snakes' },
  { id: 'cricket', name: 'Hand Cricket', tagline: 'Odd-even showdown', color: '#2f8bff', art: 'cricket' },
  { id: 'cards', name: 'Color Cards', tagline: 'Match colours & numbers', color: '#ffc21a', art: 'cards' },
  { id: 'carrom', name: 'Carrom', tagline: 'Flick & pocket', color: '#b45309', art: 'carrom' },
  { id: 'tictactoe', name: 'Tic Tac Toe', tagline: 'Quick 1v1', color: '#8b5cf6', art: 'ttt' },
  { id: 'connect4', name: 'Connect 4', tagline: 'Four in a row', color: '#ff7a1a', art: 'c4' },
  { id: 'quiz', name: 'Quiz Battle', tagline: 'Fastest brain wins', color: '#14b8a6', art: 'quiz' },
];

export const MODES = [
  {
    id: 'classic', name: 'Classic', icon: 'crown', tokens: 4, minutes: null, players: [2, 4],
    desc: 'All 4 tokens home to win. The original game.', time: '15–25 min',
  },
  {
    id: 'quick', name: 'Quick', icon: 'zap', tokens: 2, minutes: null, players: [2, 4],
    desc: 'Only 2 tokens each. First to bring both home wins.', time: '6–10 min',
  },
  {
    id: 'timer', name: 'Timer', icon: 'clock', tokens: 4, minutes: 10, players: [2, 4], hot: true,
    desc: 'Fixed 10 minutes. Score points for every step, +20 for a capture. Highest score wins.', time: '10 min',
  },
  {
    id: 'team', name: '2 vs 2', icon: 'users', tokens: 4, minutes: null, players: [4],
    desc: 'Partners sit opposite. First team with all 8 tokens home wins.', time: '20–30 min',
  },
];

const defaultConfig = () => ({
  realMoney: true, // master switch for everything paid in cash
  maintenance: false,
  signupBonus: 500,
  referralBonus: 250,
  dailyBonus: [50, 75, 100, 150, 200, 300, 500],
  minWithdraw: 100,
  gameStatus: { ludo: 'live', snakes: 'soon', cricket: 'soon', cards: 'soon', carrom: 'soon', tictactoe: 'soon', connect4: 'soon', quiz: 'soon' },
  // Per mode: which currencies it runs in, entry amounts and platform commission.
  modes: {
    classic: { enabled: true, coins: true, cash: true, coinEntries: [100, 500, 1000, 5000], cashEntries: [5, 10, 25, 50, 100], commission: 10 },
    quick: { enabled: true, coins: true, cash: true, coinEntries: [50, 200, 1000], cashEntries: [2, 5, 10, 25], commission: 12 },
    timer: { enabled: true, coins: true, cash: true, coinEntries: [100, 500, 2000], cashEntries: [5, 10, 20, 50], commission: 12 },
    team: { enabled: true, coins: true, cash: false, coinEntries: [200, 1000], cashEntries: [10, 50], commission: 10 },
  },
  botFill: true,
  botFillSeconds: 20,
  turnSeconds: 15,
  chat: { text: true, voice: true, quick: true },
});

const defaultUser = () => ({
  id: 'VC10482',
  name: 'Sujal',
  phone: '+91 98•••• 4521',
  avatar: 0,
  level: 7,
  xp: 640,
  xpNext: 1000,
  coins: 12450,
  cash: { deposit: 250, winnings: 480, bonus: 50 },
  kyc: 'pending', // none | pending | verified
  streakDay: 3,
  claimedToday: false,
  stats: { played: 148, won: 71, streak: 4, captures: 392, bestRank: 12 },
  settings: { sound: true, music: true, vibration: true, lang: 'en', board: 'royal', dice: 'classic' },
});

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw?.config && raw?.user) {
      return { config: { ...defaultConfig(), ...raw.config }, user: { ...defaultUser(), ...raw.user }, loggedIn: raw.loggedIn };
    }
  } catch { /* fresh start */ }
  return { config: defaultConfig(), user: defaultUser(), loggedIn: false };
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export const store = {
  get config() { return state.config; },
  get user() { return state.user; },
  get loggedIn() { return state.loggedIn; },
  set loggedIn(v) { state.loggedIn = v; save(); },
  update(fn) { fn(state); save(); },
  reset() { state = { config: defaultConfig(), user: defaultUser(), loggedIn: false }; save(); },
};

export const cashTotal = (u = state.user) => u.cash.deposit + u.cash.winnings + u.cash.bonus;

/** Currencies a mode is currently offered in, after the global switch. */
export function modeCurrencies(modeId) {
  const m = state.config.modes[modeId];
  if (!m?.enabled) return [];
  const list = [];
  if (m.coins) list.push('coins');
  if (m.cash && state.config.realMoney) list.push('cash');
  return list;
}

export function tablesFor(modeId, currency) {
  const m = state.config.modes[modeId];
  const entries = currency === 'cash' ? m.cashEntries : m.coinEntries;
  const mode = MODES.find((x) => x.id === modeId);
  const seats = mode.players;
  const out = [];
  for (const entry of entries) {
    for (const players of seats) {
      const pool = entry * players;
      const prize = Math.floor(pool * (1 - m.commission / 100));
      out.push({
        id: `${modeId}-${currency}-${entry}-${players}`,
        mode: modeId, currency, entry, players, prize,
        online: Math.floor(40 + ((entry * 7 + players * 13) % 90) * (currency === 'cash' ? 3 : 5)),
      });
    }
  }
  return out;
}

// ----------------------------------------------------------- sample data

export const BANNERS = [
  { title: 'Timer Mode is LIVE', text: '10 minutes. Highest score wins.', cta: 'Play now', to: 'lobby/timer', grad: 'linear-gradient(120deg,#ff7a1a,#ef3b4f)' },
  { title: 'Weekend Mega Tournament', text: 'Prize pool 1,00,000 coins', cta: 'Register', to: 'tournaments', grad: 'linear-gradient(120deg,#8b5cf6,#2f8bff)' },
  { title: 'Invite friends, earn 250', text: 'Every friend who plays one game', cta: 'Invite', to: 'refer', grad: 'linear-gradient(120deg,#1fbf6a,#14b8a6)' },
];

export const TOURNAMENTS = [
  { id: 't1', name: 'Weekend Mega', mode: 'classic', currency: 'coins', entry: 500, pool: 100000, players: 512, joined: 388, startsIn: 3 * 3600, status: 'open' },
  { id: 't2', name: 'Timer Rush', mode: 'timer', currency: 'cash', entry: 20, pool: 5000, players: 256, joined: 201, startsIn: 45 * 60, status: 'open' },
  { id: 't3', name: 'Quick Knockout', mode: 'quick', currency: 'coins', entry: 100, pool: 20000, players: 128, joined: 128, startsIn: 0, status: 'live' },
  { id: 't4', name: 'Daily Freeroll', mode: 'classic', currency: 'coins', entry: 0, pool: 5000, players: 64, joined: 12, startsIn: 7 * 3600, status: 'open' },
];

export const LEADERS = [
  ['Aarav', 9, 2840], ['Diya', 3, 2710], ['Kabir', 12, 2655], ['Ishita', 6, 2400], ['Rohan', 1, 2290],
  ['Meera', 4, 2105], ['Vivaan', 10, 1980], ['Anaya', 2, 1870], ['Arjun', 7, 1760], ['Sara', 13, 1690],
  ['Reyansh', 5, 1605], ['Kiara', 8, 1550],
].map(([name, avatar, score], i) => ({ rank: i + 1, name, avatar, score }));

export const TXNS = [
  { id: 1, type: 'win', title: 'Won Classic 2P', currency: 'cash', amount: 18, at: 'Today, 7:42 PM' },
  { id: 2, type: 'entry', title: 'Entry · Classic 2P', currency: 'cash', amount: -10, at: 'Today, 7:21 PM' },
  { id: 3, type: 'bonus', title: 'Daily bonus · Day 3', currency: 'coins', amount: 100, at: 'Today, 9:03 AM' },
  { id: 4, type: 'deposit', title: 'Added via UPI', currency: 'cash', amount: 200, at: 'Yesterday' },
  { id: 5, type: 'win', title: 'Won Timer 4P', currency: 'coins', amount: 1760, at: 'Yesterday' },
  { id: 6, type: 'withdraw', title: 'Withdrawal to UPI', currency: 'cash', amount: -300, at: '2 days ago', status: 'Completed' },
  { id: 7, type: 'shop', title: 'Golden Dice skin', currency: 'coins', amount: -2500, at: '3 days ago' },
];

export const NOTIFS = [
  { icon: 'trophy', title: 'You won ₹18!', text: 'Classic 2P against Rohan', at: '2h', unread: true },
  { icon: 'gift', title: 'Daily bonus ready', text: 'Day 4 reward: 150 coins', at: '5h', unread: true },
  { icon: 'users', title: 'Diya sent a friend request', text: 'Tap to accept', at: '1d', unread: false },
  { icon: 'megaphone', title: 'Timer mode is live', text: 'Try the new 10-minute mode', at: '2d', unread: false },
];

export const FRIENDS = [
  { name: 'Rohan', avatar: 1, status: 'online', level: 9 },
  { name: 'Diya', avatar: 3, status: 'playing', level: 14 },
  { name: 'Kabir', avatar: 12, status: 'online', level: 6 },
  { name: 'Meera', avatar: 4, status: 'offline', level: 21, seen: '2h ago' },
  { name: 'Arjun', avatar: 7, status: 'offline', level: 3, seen: 'yesterday' },
];

export const SHOP = [
  { id: 'dice-gold', kind: 'Dice', name: 'Golden Dice', price: 2500, owned: true, preview: 'gold' },
  { id: 'dice-ruby', kind: 'Dice', name: 'Ruby Dice', price: 1800, preview: 'ruby' },
  { id: 'dice-ice', kind: 'Dice', name: 'Frost Dice', price: 1500, preview: 'ice' },
  { id: 'board-royal', kind: 'Board', name: 'Royal Board', price: 0, owned: true, preview: 'royal' },
  { id: 'board-wood', kind: 'Board', name: 'Classic Wood', price: 3000, preview: 'wood' },
  { id: 'board-neon', kind: 'Board', name: 'Neon Night', price: 4500, preview: 'neon' },
  { id: 'token-gem', kind: 'Tokens', name: 'Gem Tokens', price: 3500, preview: 'gem' },
  { id: 'frame-fire', kind: 'Frames', name: 'Fire Frame', price: 1200, preview: 'fire' },
];

export const HISTORY = [
  { mode: 'Classic', players: 2, result: 'Won', currency: 'cash', amount: 18, at: 'Today 7:42 PM', rank: 1 },
  { mode: 'Timer', players: 4, result: '2nd', currency: 'coins', amount: 0, at: 'Today 6:10 PM', rank: 2 },
  { mode: 'Quick', players: 2, result: 'Lost', currency: 'coins', amount: -200, at: 'Yesterday', rank: 2 },
  { mode: 'Timer', players: 4, result: 'Won', currency: 'coins', amount: 1760, at: 'Yesterday', rank: 1 },
];
