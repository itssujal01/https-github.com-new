// Classic flat Ludo board in SVG with glossy pin tokens, built for phones:
// big tap targets, clear safe cells, arrows on start cells and stack badges.
import { h } from '../ui/kit.js';
import { COLORS, START_INDEX, SAFE_CELLS, YARD, HOME, LAST_TRACK, globalCell } from '../../shared/engine.js';
import { TRACK, HOME_COLUMN, YARD_ORIGIN } from '../../shared/board.js';

const S = 40; // cell size in SVG units; board = 600x600
const HEX = { red: '#ef3b4f', green: '#1fbf6a', yellow: '#ffc21a', blue: '#2f8bff' };
const DARK = { red: '#a3162a', green: '#0d7a41', yellow: '#b8860b', blue: '#1256b8' };
const LIGHT = { red: '#ffd6db', green: '#cff5df', yellow: '#fff1c2', blue: '#d6e8ff' };

// Rotation that puts each colour's yard bottom-left.
export const VIEW_ROTATION = { blue: 0, red: -90, green: 180, yellow: 90 };

// Counter-rotate a token against the board and centre the pin's body on its cell.
const upright = (rotation) => `rotate(${-rotation}) translate(0 17)`;

const cx = ([c, r]) => [c * S + S / 2, r * S + S / 2];

function yardSlots(color) {
  const [c, r] = YARD_ORIGIN[color];
  return [[c + 1.75, r + 1.75], [c + 4.25, r + 1.75], [c + 1.75, r + 4.25], [c + 4.25, r + 4.25]].map(([x, y]) => [x * S, y * S]);
}

function homeSpot(color, token) {
  const side = { red: [-1, 0], green: [0, -1], yellow: [1, 0], blue: [0, 1] }[color];
  const spread = (token - 1.5) * 13;
  return [300 + side[0] * 26 + side[1] * spread, 300 + side[1] * 26 + side[0] * spread];
}

export function spotFor(color, token, p) {
  if (p === YARD) return yardSlots(color)[token];
  if (p === HOME) return homeSpot(color, token);
  if (p > LAST_TRACK) return cx(HOME_COLUMN[color][p - LAST_TRACK - 1]);
  return cx(TRACK[globalCell(color, p)]);
}

function keyFor(color, token, p) {
  if (p === YARD) return `y${color}${token}`;
  if (p === HOME) return `h${color}${token}`;
  if (p > LAST_TRACK) return `c${color}${p}`;
  return `t${globalCell(color, p)}`;
}

function star(x, y, r, fill) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * rad).toFixed(1)},${(y + Math.sin(a) * rad).toFixed(1)}`;
  }
  return h('path', { d: `${d}Z`, fill });
}

function arrow(x, y, angle, fill) {
  return h('path', {
    d: 'M-9,-4 L2,-4 L2,-9 L11,0 L2,9 L2,4 L-9,4 Z',
    fill, transform: `translate(${x} ${y}) rotate(${angle})`,
  });
}

function drawBoard() {
  const g = h('g', { class: 'board-art' });
  // Frame.
  g.append(h('rect', { x: -14, y: -14, width: 628, height: 628, rx: 26, fill: 'url(#frame)' }));
  g.append(h('rect', { x: -4, y: -4, width: 608, height: 608, rx: 18, fill: '#fffdf6' }));

  // Track cells.
  const colored = new Map();
  for (const c of COLORS) {
    colored.set(String(TRACK[START_INDEX[c]]), c);
    for (const cell of HOME_COLUMN[c]) colored.set(String(cell), c);
  }
  const cells = new Set([...TRACK.map(String), ...COLORS.flatMap((c) => HOME_COLUMN[c].map(String))]);
  for (const key of cells) {
    const [c, r] = key.split(',').map(Number);
    const color = colored.get(key);
    g.append(h('rect', {
      x: c * S + 1.5, y: r * S + 1.5, width: S - 3, height: S - 3, rx: 6,
      fill: color ? HEX[color] : '#ffffff', stroke: color ? DARK[color] : '#d9d3ea', 'stroke-width': 1.2,
    }));
  }
  // Safe stars and start arrows.
  for (const i of SAFE_CELLS) {
    const [x, y] = cx(TRACK[i]);
    const owner = COLORS.find((c) => START_INDEX[c] === i);
    if (owner) {
      const [nx, ny] = cx(TRACK[(i + 1) % TRACK.length]);
      g.append(arrow(x, y, (Math.atan2(ny - y, nx - x) * 180) / Math.PI, '#ffffff'));
    } else {
      g.append(h('circle', { cx: x, cy: y, r: 15, fill: '#f1ecff' }));
      g.append(star(x, y, 12, '#8b7fc4'));
    }
  }
  // Yards.
  for (const c of COLORS) {
    const [yc, yr] = YARD_ORIGIN[c];
    g.append(h('rect', { x: yc * S + 3, y: yr * S + 3, width: 6 * S - 6, height: 6 * S - 6, rx: 22, fill: HEX[c], stroke: DARK[c], 'stroke-width': 2 }));
    g.append(h('rect', { x: yc * S + 3, y: yr * S + 3, width: 6 * S - 6, height: 6 * S - 6, rx: 22, fill: 'url(#yardShine)' }));
    g.append(h('rect', { x: yc * S + 34, y: yr * S + 34, width: 172, height: 172, rx: 26, fill: '#ffffff', stroke: DARK[c], 'stroke-width': 1.5, 'stroke-opacity': 0.4 }));
    for (const [sx, sy] of yardSlots(c)) {
      g.append(h('circle', { cx: sx, cy: sy + 2, r: 25, fill: DARK[c], opacity: 0.25 }));
      g.append(h('circle', { cx: sx, cy: sy, r: 24, fill: LIGHT[c], stroke: HEX[c], 'stroke-width': 4 }));
    }
  }
  // Centre home: four triangles with a trophy.
  const tri = { red: '240,240 240,360 300,300', green: '240,240 360,240 300,300', yellow: '360,240 360,360 300,300', blue: '240,360 360,360 300,300' };
  for (const c of COLORS) g.append(h('polygon', { points: tri[c], fill: HEX[c], stroke: '#ffffff', 'stroke-width': 2 }));
  g.append(h('circle', { cx: 300, cy: 300, r: 22, fill: '#ffffff', opacity: 0.95 }));
  g.append(h('text', { x: 300, y: 309, 'text-anchor': 'middle', 'font-size': 24, class: 'board-trophy' }, '🏆'));
  return g;
}

function defs() {
  const d = h('defs');
  d.innerHTML = `
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe07a"/><stop offset=".5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/>
    </linearGradient>
    <linearGradient id="yardShine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    ${COLORS.map((c) => `
    <radialGradient id="tok-${c}" cx=".35" cy=".3" r=".8">
      <stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="${HEX[c]}"/><stop offset="1" stop-color="${DARK[c]}"/>
    </radialGradient>`).join('')}
    <filter id="tokShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="#000" flood-opacity=".45"/>
    </filter>`;
  return d;
}

/** Pin-shaped token: teardrop with a white core, like the boards people know. */
function tokenShape(color) {
  const g = h('g', { class: 'tok-shape', filter: 'url(#tokShadow)' });
  g.innerHTML = `
    <ellipse cx="0" cy="2" rx="13" ry="5" fill="#000" opacity=".25"/>
    <path d="M0,0 C-4,-6 -15,-14 -15,-25 A15,15 0 1 1 15,-25 C15,-14 4,-6 0,0 Z" fill="url(#tok-${color})" stroke="#fff" stroke-width="2.5"/>
    <circle cx="0" cy="-25" r="7" fill="#fff"/>
    <circle cx="0" cy="-25" r="4" fill="${HEX[color]}"/>`;
  return g;
}

export class Board2D {
  constructor({ tokensPerColor }) {
    this.tokensPerColor = tokensPerColor; // e.g. 4 (classic) or 2 (quick)
    this.pos = {}; // color -> progress[]
    this.tokens = new Map(); // key -> {g, color, i}
    this.movable = new Set();
    this.onTokenTap = null;
    this.layer = h('g', { class: 'tokens' });
    this.svg = h('svg', { class: 'board2d', viewBox: '-16 -16 632 632', role: 'img', 'aria-label': 'Ludo board' },
      defs(), drawBoard(), this.layer);
    this.el = h('div', { class: 'board-wrap' }, this.svg);
  }

  setView(color) {
    this.rotation = VIEW_ROTATION[color] ?? 0;
    this.svg.style.transform = `rotate(${this.rotation}deg)`;
    // Keep tokens upright when the board is rotated.
    for (const t of this.tokens.values()) t.shape.setAttribute('transform', upright(this.rotation));
    this.svg.querySelector('.board-trophy')?.setAttribute('transform', `rotate(${-this.rotation} 300 300)`);
  }

  setColors(colors) {
    this.layer.replaceChildren();
    this.tokens.clear();
    for (const color of colors) {
      this.pos[color] = Array(4).fill(YARD);
      for (let i = 0; i < 4; i++) {
        if (i >= this.tokensPerColor) continue;
        // Outer group keeps the pin upright; the inner shape carries hop/bob animations.
        const shape = h('g', { class: 'tok-up' }, tokenShape(color));
        shape.setAttribute('transform', upright(this.rotation ?? 0));
        const ring = h('circle', { class: 'tok-ring', r: 19 });
        const g = h('g', { class: 'tok', 'data-color': color },
          ring, shape, h('circle', { r: 24, fill: 'transparent', class: 'tok-hit' }));
        g.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (this.movable.has(`${color}:${i}`)) this.onTokenTap?.(color, i);
        });
        this.layer.append(g);
        this.tokens.set(`${color}:${i}`, { g, shape, color, i, badge: null });
      }
    }
  }

  sync(tokens) {
    for (const [color, list] of Object.entries(tokens)) if (this.pos[color]) this.pos[color] = [...list];
    this.layout();
  }

  layout() {
    const groups = new Map();
    for (const [color, list] of Object.entries(this.pos)) {
      list.forEach((p, i) => {
        if (!this.tokens.has(`${color}:${i}`)) return;
        const k = keyFor(color, i, p);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push([color, i, p]);
      });
    }
    for (const group of groups.values()) {
      group.forEach(([color, i, p], n) => {
        const t = this.tokens.get(`${color}:${i}`);
        if (t.animating) return;
        let [x, y] = spotFor(color, i, p);
        let scale = p === HOME ? 0.62 : 1;
        if (group.length > 1) {
          // Fan out stacked tokens a little and shrink them.
          const offs = [[-7, -4], [7, -4], [-7, 5], [7, 5]][n % 4];
          x += offs[0];
          y += offs[1];
          scale = 0.78;
        }
        this.place(t, x, y, scale);
      });
    }
    // Bring moving/movable tokens to the front.
    for (const key of this.movable) {
      const t = this.tokens.get(key);
      if (t) this.layer.append(t.g);
    }
  }

  place(t, x, y, scale = 1) {
    t.x = x;
    t.y = y;
    t.g.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  setMovable(color, indices) {
    this.movable = new Set(indices.map((i) => `${color}:${i}`));
    for (const [key, t] of this.tokens) t.g.classList.toggle('movable', this.movable.has(key));
    this.layout();
  }

  /** Hop a token along its path. Resolves when it lands. */
  async move(color, i, from, to, onStep) {
    const t = this.tokens.get(`${color}:${i}`);
    if (!t) return;
    t.animating = true;
    this.layer.append(t.g);
    const steps = from === YARD ? [0] : Array.from({ length: to - from }, (_, k) => from + k + 1);
    for (const p of steps) {
      const [x, y] = spotFor(color, i, p);
      t.g.classList.add('hop');
      this.place(t, x, y, 1.12);
      onStep?.(p);
      await wait(from === YARD ? 260 : 150);
      t.g.classList.remove('hop');
    }
    this.pos[color][i] = to;
    t.animating = false;
    this.layout();
  }

  async capture(color, i) {
    const t = this.tokens.get(`${color}:${i}`);
    if (!t) return;
    t.animating = true;
    t.g.classList.add('captured');
    await wait(260);
    const [x, y] = spotFor(color, i, YARD);
    this.place(t, x, y, 1);
    await wait(420);
    t.g.classList.remove('captured');
    this.pos[color][i] = YARD;
    t.animating = false;
    this.layout();
  }
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export { HEX as TOKEN_HEX };
