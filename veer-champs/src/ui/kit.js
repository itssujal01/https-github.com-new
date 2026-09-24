// Tiny UI toolkit: DOM builder, icons, router, toasts, sheets and modals.
// All text goes through text nodes (never innerHTML) so user content is safe.

export function h(tag, props = {}, ...children) {
  const svgTags = new Set(['svg', 'path', 'circle', 'rect', 'g', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'ellipse', 'text', 'clipPath', 'use']);
  const el = svgTags.has(tag)
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) el.style.setProperty(p.startsWith('--') ? p : p.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`), val);
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' && 'value' in el) el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ---------------------------------------------------------------- icons

const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14.5h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4.5-6.5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 18l6-6-6-6',
  down: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M18 6 6 18M6 6l12 12',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H8a2.5 2.5 0 1 1 0-5c3 0 4 5 4 5zM12 7h4a2.5 2.5 0 1 0 0-5c-3 0-4 5-4 5z',
  chat: 'M21 12a8 8 0 0 1-11.7 7.1L3 21l1.9-6.3A8 8 0 1 1 21 12z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3',
  micOff: 'M3 3l18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.9-.8M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 10.9 5.8M12 18v3',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  play: 'M7 4v16l13-8z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  shield: 'M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z',
  shieldCheck: 'M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10zM9 12l2 2 4-4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6',
  cart: 'M3 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L22 7H6M9 21h.01M18 21h.01',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  crown: 'M3 7l4 4 5-7 5 7 4-4-2 12H5z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  check: 'M20 6 9 17l-5-5',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  volume: 'M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  volumeOff: 'M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  trend: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  bank: 'M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M2 10l10-7 10 7z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l5 5V5L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  robot: 'M12 8V4M8 4h8M5 8h14v12H5zM9 13h.01M15 13h.01M9 17h6',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
  swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 6.5 14 2h3v3l-4.5 4.5M5 14l-2 2 3 3 2-2',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  card: 'M2 5h20v14H2zM2 10h20M6 15h4',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  menu: 'M3 6h18M3 12h18M3 18h18',
  palette: 'M12 22a10 10 0 1 1 10-10c0 3-2.5 4-4.5 4H16a2 2 0 0 0-1.5 3.3A1.7 1.7 0 0 1 12 22zM7.5 11.5h.01M10.5 7.5h.01M15 8h.01',
  tv: 'M2 7h20v13H2zM17 2l-5 5-5-5',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
  tools: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
};

export function icon(name, cls = '') {
  const svg = h('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: cls, 'aria-hidden': 'true',
  });
  svg.append(h('path', { d: P[name] ?? P.info }));
  return svg;
}

/** Gold coin with a V mark. */
export function coinIcon(cls = 'coin-ico') {
  return h('svg', { viewBox: '0 0 32 32', class: cls, 'aria-hidden': 'true' },
    h('defs', {}, h('linearGradient', { id: 'cg', x1: '0', y1: '0', x2: '0', y2: '1' },
      h('stop', { offset: '0', 'stop-color': '#ffe68a' }), h('stop', { offset: '1', 'stop-color': '#f59e0b' }))),
    h('circle', { cx: '16', cy: '16', r: '15', fill: '#b45309' }),
    h('circle', { cx: '16', cy: '15', r: '14', fill: 'url(#cg)' }),
    h('circle', { cx: '16', cy: '15', r: '10.5', fill: 'none', stroke: '#fff6c9', 'stroke-width': '1.5', opacity: '0.7' }),
    h('path', { d: 'M11 10l5 11 5-11', fill: 'none', stroke: '#92400e', 'stroke-width': '3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

/** Green cash note with rupee sign. */
export function cashIcon(cls = 'cash-ico') {
  return h('svg', { viewBox: '0 0 32 32', class: cls, 'aria-hidden': 'true' },
    h('rect', { x: '2', y: '7', width: '28', height: '19', rx: '4', fill: '#0f8a57' }),
    h('rect', { x: '2', y: '6', width: '28', height: '18', rx: '4', fill: '#22d38a' }),
    h('circle', { cx: '16', cy: '15', r: '6', fill: '#0f8a57', opacity: '0.35' }),
    h('path', { d: 'M13 11.5h6M13 14h6M13 11.5c3.5 0 3.5 5 0 5l5 3.5', fill: 'none', stroke: '#053b24', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

export function googleIcon() {
  return h('svg', { viewBox: '0 0 48 48', width: '22', height: '22', 'aria-hidden': 'true' },
    h('path', { fill: '#FFC107', d: 'M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z' }),
    h('path', { fill: '#FF3D00', d: 'M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z' }),
    h('path', { fill: '#4CAF50', d: 'M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z' }),
    h('path', { fill: '#1976D2', d: 'M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z' }));
}

// ---------------------------------------------------------------- format

export const fmt = {
  num: (n) => Number(n).toLocaleString('en-IN'),
  inr: (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`,
  short: (n) => (n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)),
};

/** Amount with the right currency mark. */
export function money(currency, amount, cls = '') {
  return h('span', { class: `row ${cls}`, style: { gap: '4px', display: 'inline-flex' } },
    currency === 'cash' ? cashIcon('cash-ico') : coinIcon('coin-ico'),
    h('b', {}, currency === 'cash' ? fmt.inr(amount) : fmt.num(amount)));
}

// ---------------------------------------------------------------- router

const routes = new Map();
let current = null;
let history = [];
let phoneEl = null;

export function mountRouter(el) {
  phoneEl = el;
  window.addEventListener('hashchange', () => render());
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') phoneEl.querySelector('.backdrop:last-of-type')?.remove();
  });
}

export function route(name, fn) {
  routes.set(name, fn);
}

export function go(path, { replace = false } = {}) {
  if (replace) {
    history.pop();
    if (location.hash === `#/${path}`) render(); // same route: refresh in place
    else location.replace(`#/${path}`);
  } else {
    location.hash = `#/${path}`;
  }
}

export function back(fallback = 'home') {
  if (history.length > 1) window.history.back();
  else go(fallback, { replace: true });
}

export function render() {
  window.scrollTo(0, 0);
  const path = (location.hash.replace(/^#\/?/, '') || 'splash');
  const [name, ...params] = path.split('/');
  const fn = routes.get(name) ?? routes.get('home');
  const isBack = history.length > 1 && history[history.length - 2] === path;
  if (isBack) history.pop(); else history.push(path);
  if (history.length > 30) history = history.slice(-30);
  current?.cleanup?.();
  const view = fn(...params);
  current = view;
  const node = view.el ?? view;
  if (isBack) node.classList.add('back-in');
  phoneEl.classList.toggle('wide', name === 'admin');
  phoneEl.querySelectorAll('.backdrop').forEach((b) => b.remove()); // sheets never outlive their screen
  phoneEl.querySelector('.screen-host').replaceChildren(node);
}

// ------------------------------------------------------- overlays/toasts

export function toast(msg, kind = '') {
  const box = phoneEl.querySelector('.toasts');
  const el = h('div', { class: `toast ${kind}` }, msg);
  box.append(el);
  setTimeout(() => el.classList.add('out'), 2300);
  setTimeout(() => el.remove(), 2700);
}

function overlay(content, cls) {
  const bd = h('div', { class: `backdrop ${cls}` }, content);
  const close = () => bd.remove();
  bd.addEventListener('click', (e) => { if (e.target === bd) close(); });
  phoneEl.append(bd);
  return close;
}

/** Bottom sheet. build(close) returns the sheet body. */
export function sheet(build) {
  let close;
  const el = h('div', { class: 'sheet' });
  close = overlay(el, '');
  el.append(...[build(close)].flat());
  return close;
}

export function modal(build) {
  let close;
  const el = h('div', { class: 'modal' });
  close = overlay(el, 'center');
  el.append(h('button', { class: 'icon-btn close', 'aria-label': 'Close', onclick: () => close() }, icon('close')), ...[build(close)].flat());
  return close;
}

export function confirmBox({ title, text, ok = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const close = modal((c) => [
      h('h3', { style: { fontSize: '22px', margin: '6px 0 8px' } }, title),
      h('p', { class: 'muted', style: { marginBottom: '18px' } }, text),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-ghost grow', onclick: () => { c(); resolve(false); } }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-gold'} grow`, onclick: () => { c(); resolve(true); } }, ok)),
    ]);
    void close;
  });
}

// ------------------------------------------------------------ shared bits

export function topbar(title, { backTo, right = [] } = {}) {
  return h('header', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => back(backTo) }, icon('back')),
    h('h2', {}, title),
    ...right);
}

export function toggle(checked, onchange) {
  return h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', checked, onchange: (e) => onchange?.(e.target.checked) }),
    h('span'));
}

export function seg(options, value, onchange) {
  const el = h('div', { class: 'seg', role: 'tablist' });
  const draw = () => {
    el.replaceChildren(...options.map((o) => h('button', {
      class: o.value === value ? 'on' : '', role: 'tab',
      onclick: () => { value = o.value; draw(); onchange(o.value); },
    }, o.icon ?? null, o.label)));
  };
  draw();
  return el;
}
