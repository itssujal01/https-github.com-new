import { h, icon, go, toast, googleIcon } from '../ui/kit.js';
import { store, AVATARS } from '../data.js';

export function brandMark(size = 84) {
  // Placeholder mark; swap for the registered Veer Champs logo (assets/logo.png).
  return h('div', { class: 'brand-mark', style: { '--s': `${size}px` } },
    h('span', { class: 'bm-crown' }, '👑'),
    h('span', { class: 'bm-v' }, 'V'));
}

export function wordmark() {
  return h('div', { class: 'wordmark' }, h('span', {}, 'VEER'), h('b', {}, 'CHAMPS'));
}

export function splashScreen() {
  const el = h('section', { class: 'screen splash' },
    h('div', { class: 'splash-rays' }),
    h('div', { class: 'splash-center' }, brandMark(110), wordmark(), h('p', { class: 'muted' }, 'Khelo. Jeeto. Champion bano.')),
    h('div', { class: 'splash-bar' }, h('span')),
    h('p', { class: 'dim splash-foot' }, 'Only for players 18+ · Play responsibly'));
  const t = setTimeout(() => go(store.loggedIn ? 'home' : 'login', { replace: true }), 1800);
  return { el, cleanup: () => clearTimeout(t) };
}

export function loginScreen() {
  const phone = h('input', { type: 'tel', inputmode: 'numeric', maxlength: 10, placeholder: 'Mobile number', autocomplete: 'tel-national' });
  phone.addEventListener('input', () => { phone.value = phone.value.replace(/\D/g, '').slice(0, 10); });
  const agree = h('input', { type: 'checkbox', checked: true, id: 'agree' });

  const needAgree = () => {
    if (!agree.checked) { toast('Please accept the terms first', 'err'); return false; }
    return true;
  };
  const sendOtp = () => {
    if (!needAgree()) return;
    if (!/^[6-9]\d{9}$/.test(phone.value)) { toast('Enter a valid 10-digit mobile number', 'err'); phone.focus(); return; }
    sessionStorage.setItem('vc:phone', phone.value);
    go('otp');
  };
  const social = (name) => {
    if (!needAgree()) return;
    toast(`${name} login connected`, 'ok');
    finishLogin();
  };

  return h('section', { class: 'screen login' },
    h('div', { class: 'scroll pad' },
      h('div', { class: 'login-hero' }, brandMark(80), wordmark(), h('p', { class: 'muted' }, 'India ka apna gaming arena')),
      h('div', { class: 'stack', style: { marginTop: '8px' } },
        h('button', { class: 'btn btn-block tc-btn', onclick: () => social('Truecaller') }, icon('phone'), 'Continue with Truecaller'),
        h('button', { class: 'btn btn-white btn-block', onclick: () => social('Google') }, googleIcon(), 'Continue with Google'),
        h('div', { class: 'or' }, h('span', {}, 'or use mobile number')),
        h('label', { class: 'field' }, h('span', { class: 'cc' }, '🇮🇳 +91'), phone),
        h('button', { class: 'btn btn-saffron btn-block', onclick: sendOtp }, 'Get OTP'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: () => { if (needAgree()) { toast('Playing as guest'); finishLogin(); } } }, 'Play as Guest'),
        h('label', { class: 'agree', for: 'agree' }, agree,
          h('span', {}, 'I am 18+ and agree to the ', h('a', { href: '#/legal/terms' }, 'Terms'), ', ', h('a', { href: '#/legal/privacy' }, 'Privacy Policy'), ' and ', h('a', { href: '#/legal/fairplay' }, 'Fair Play'), ' rules.')))));
}

export function otpScreen() {
  const phone = sessionStorage.getItem('vc:phone') || '';
  const boxes = Array.from({ length: 6 }, (_, i) => h('input', {
    class: 'otp-box', inputmode: 'numeric', maxlength: 1, 'aria-label': `Digit ${i + 1}`, autocomplete: i === 0 ? 'one-time-code' : 'off',
  }));
  boxes.forEach((b, i) => {
    b.addEventListener('input', () => {
      const digits = b.value.replace(/\D/g, '');
      if (digits.length > 1) {
        // Pasted or auto-filled code.
        [...digits.slice(0, 6)].forEach((d, k) => { if (boxes[k]) boxes[k].value = d; });
        boxes[Math.min(5, digits.length - 1)].focus();
      } else {
        b.value = digits;
        if (digits && boxes[i + 1]) boxes[i + 1].focus();
      }
      if (boxes.every((x) => x.value)) verify();
    });
    b.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
  });
  let left = 30;
  const resend = h('button', { class: 'link-btn', disabled: true, onclick: () => { left = 30; toast('OTP sent again'); tickFn(); } }, '');
  const tickFn = () => {
    resend.disabled = left > 0;
    resend.textContent = left > 0 ? `Resend OTP in 0:${String(left).padStart(2, '0')}` : 'Resend OTP';
  };
  tickFn();
  const t = setInterval(() => { if (left > 0) left--; tickFn(); }, 1000);
  function verify() {
    toast('Verified!', 'ok');
    finishLogin();
  }
  setTimeout(() => boxes[0].focus(), 300);
  const el = h('section', { class: 'screen' },
    h('header', { class: 'topbar' }, h('button', { class: 'icon-btn', onclick: () => go('login') }, icon('back'))),
    h('div', { class: 'pad stack' },
      h('h1', { style: { fontSize: '30px' } }, 'Enter OTP'),
      h('p', { class: 'muted' }, `We sent a 6-digit code to +91 ${phone.slice(0, 2)}•••• ${phone.slice(-4)}`),
      h('div', { class: 'otp-row' }, boxes),
      resend,
      h('button', { class: 'btn btn-saffron btn-block', onclick: verify }, 'Verify & continue'),
      h('p', { class: 'dim center' }, 'Prototype: any 6 digits work.')));
  return { el, cleanup: () => clearInterval(t) };
}

function finishLogin() {
  const isNew = !store.loggedIn && !localStorage.getItem('vc:setup');
  store.loggedIn = true;
  go(isNew ? 'setup' : 'home', { replace: true });
}

export function setupScreen() {
  let avatar = store.user.avatar;
  const name = h('input', { maxlength: 16, placeholder: 'Your player name', value: store.user.name });
  const grid = h('div', { class: 'avatar-grid' });
  const draw = () => grid.replaceChildren(...AVATARS.map((a, i) => h('button', {
    class: `avatar-opt${i === avatar ? ' on' : ''}`, onclick: () => { avatar = i; draw(); },
  }, a)));
  draw();
  const refer = h('input', { maxlength: 10, placeholder: 'Referral code (optional)' });
  return h('section', { class: 'screen' },
    h('div', { class: 'scroll pad stack' },
      h('h1', { style: { fontSize: '28px', marginTop: 'calc(20px + var(--safe-top))' } }, 'Create your champion'),
      h('p', { class: 'muted' }, 'Pick a name and avatar. You can change them later.'),
      h('label', { class: 'field' }, icon('user'), name),
      h('div', { class: 'label' }, 'Avatar'),
      grid,
      h('label', { class: 'field' }, icon('gift'), refer),
      h('div', { class: 'card-flat row' },
        h('span', { style: { fontSize: '32px' } }, '🎁'),
        h('div', {}, h('b', {}, `Welcome bonus: ${store.config.signupBonus} coins`), h('div', { class: 'dim' }, 'Added to your wallet right away'))),
      h('button', {
        class: 'btn btn-gold btn-block',
        onclick: () => {
          const n = name.value.trim().replace(/[<>&"'`]/g, '');
          if (n.length < 3) return toast('Name needs at least 3 letters', 'err');
          store.update((s) => { s.user.name = n; s.user.avatar = avatar; });
          localStorage.setItem('vc:setup', '1');
          go('home', { replace: true });
          setTimeout(() => toast(`+${store.config.signupBonus} coins welcome bonus!`, 'ok'), 400);
        },
      }, "Let's play")));
}
