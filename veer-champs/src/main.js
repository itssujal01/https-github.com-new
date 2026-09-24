import '@fontsource/baloo-2/500.css';
import '@fontsource/baloo-2/600.css';
import '@fontsource/baloo-2/700.css';
import '@fontsource/baloo-2/800.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/game.css';
import './styles/admin.css';
import { h, mountRouter, route, render } from './ui/kit.js';
import { store } from './data.js';
import { splashScreen, loginScreen, otpScreen, setupScreen } from './screens/auth.js';
import { homeScreen } from './screens/home.js';
import { lobbyScreen, matchmakingScreen, privateRoomScreen } from './screens/lobby.js';
import { gameScreen } from './screens/game.js';
import {
  resultScreen, walletScreen, transactionsScreen, addCashScreen, withdrawScreen, kycScreen,
} from './screens/wallet.js';
import {
  tournamentsScreen, tournamentDetail, leaderboardScreen, friendsScreen, notificationsScreen,
} from './screens/social.js';
import {
  profileScreen, historyScreen, settingsScreen, shopScreen, rewardsScreen, referScreen, helpScreen, legalScreen,
} from './screens/profile.js';
import { adminScreen } from './admin/admin.js';

const phone = h('div', { class: 'phone' }, h('div', { class: 'screen-host' }), h('div', { class: 'toasts', 'aria-live': 'polite' }));
document.getElementById('root').append(h('div', { class: 'stage' }, phone));
mountRouter(phone);

// Screens that need a logged-in player.
const guard = (fn) => (...args) => (store.loggedIn ? fn(...args) : loginScreen());

route('splash', splashScreen);
route('login', loginScreen);
route('otp', otpScreen);
route('setup', guard(setupScreen));
route('home', guard(homeScreen));
route('lobby', guard((id = 'classic') => lobbyScreen(id === 'ludo' ? 'classic' : id)));
route('matchmaking', guard(matchmakingScreen));
route('private', guard(privateRoomScreen));
route('game', guard(gameScreen));
route('result', guard(resultScreen));
route('wallet', guard(walletScreen));
route('transactions', guard(transactionsScreen));
route('addcash', guard(addCashScreen));
route('withdraw', guard(withdrawScreen));
route('kyc', guard(kycScreen));
route('tournaments', guard(tournamentsScreen));
route('tournament', guard(tournamentDetail));
route('leaderboard', guard(leaderboardScreen));
route('friends', guard(friendsScreen));
route('notifications', guard(notificationsScreen));
route('profile', guard(profileScreen));
route('history', guard(historyScreen));
route('settings', guard(settingsScreen));
route('shop', guard(shopScreen));
route('rewards', guard(rewardsScreen));
route('refer', guard(referScreen));
route('help', guard(helpScreen));
route('legal', legalScreen);
route('admin', adminScreen);

render();
