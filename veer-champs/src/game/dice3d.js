// A real 3D dice cube in CSS: light enough for low-end phones, no WebGL needed.
import { h } from '../ui/kit.js';

// Pip positions on a 3x3 grid (1..9, row by row).
const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
// Face placement and the cube rotation that brings each value to the front.
const FACES = [
  { v: 1, t: 'rotateY(0deg)' }, { v: 6, t: 'rotateY(180deg)' },
  { v: 3, t: 'rotateY(90deg)' }, { v: 4, t: 'rotateY(-90deg)' },
  { v: 2, t: 'rotateX(90deg)' }, { v: 5, t: 'rotateX(-90deg)' },
];
const SHOW = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

export class Dice3D {
  constructor({ size = 56, skin = 'classic' } = {}) {
    this.cube = h('div', { class: 'd3-cube' }, FACES.map(({ v, t }) => h('div', {
      class: `d3-face${v === 1 ? ' one' : ''}`, style: { transform: `${t} translateZ(calc(var(--d) / 2))` },
    }, Array.from({ length: 9 }, (_, i) => h('span', { class: PIPS[v].includes(i + 1) ? 'pip' : '' })))));
    this.el = h('div', { class: `d3 skin-${skin}`, style: { '--d': `${size}px` } },
      h('div', { class: 'd3-shadow' }),
      h('div', { class: 'd3-tilt' }, this.cube));
    this.rx = 0;
    this.ry = 0;
    this.show(6, true);
  }

  show(value, instant = false) {
    const [tx, ty] = SHOW[value];
    this.cube.style.transition = instant ? 'none' : '';
    this.rx = tx;
    this.ry = ty;
    this.cube.style.transform = `rotateX(${tx}deg) rotateY(${ty}deg)`;
  }

  /** Tumble for ~900ms and land on `value`. */
  roll(value) {
    const [tx, ty] = SHOW[value];
    const spinX = 360 * (2 + Math.floor(Math.random() * 2));
    const spinY = 360 * (1 + Math.floor(Math.random() * 2));
    // Always add whole turns so the cube keeps spinning forward.
    this.rx = this.rx - (this.rx % 360) + spinX + tx;
    this.ry = this.ry - (this.ry % 360) + spinY + ty;
    this.el.classList.remove('rolling');
    void this.el.offsetWidth;
    this.el.classList.add('rolling');
    this.cube.style.transition = '';
    this.cube.style.transform = `rotateX(${this.rx}deg) rotateY(${this.ry}deg)`;
    return new Promise((resolve) => setTimeout(() => {
      this.el.classList.remove('rolling');
      resolve();
    }, 950));
  }
}
