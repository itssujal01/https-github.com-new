import * as THREE from 'three';
import { TOKENS_PER_PLAYER, YARD, HOME } from '../../../shared/engine.js';
import { tokenSpot, cellKey } from '../../../shared/board.js';
import { TIMING } from '../../../shared/protocol.js';
import { COLOR_HEX } from '../theme.js';
import { CELL_TOP, YARD_TOP, pyramidHeight } from './boardMesh.js';
import { tween } from './tween.js';

function pawnGeometry() {
  const profile = [
    [0, 0], [0.34, 0], [0.36, 0.03], [0.35, 0.08], [0.3, 0.12], [0.22, 0.16],
    [0.17, 0.3], [0.13, 0.48], [0.2, 0.52], [0.21, 0.56], [0.12, 0.6], [0.1, 0.62], [0, 0.62],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(profile, 32);
}

const BODY = pawnGeometry();
const HEAD = new THREE.SphereGeometry(0.17, 24, 16);
const RING = new THREE.TorusGeometry(0.42, 0.05, 10, 40).rotateX(Math.PI / 2);
const HIT = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12);

function restHeight(progress, x, z) {
  if (progress === YARD) return YARD_TOP;
  if (progress === HOME) return pyramidHeight(x, z) * 0.9;
  return CELL_TOP;
}

export class Tokens {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    world.scene.add(this.group);
    this.pawns = new Map(); // `${color}:${i}` -> pawn
    this.progress = {}; // color -> [progress x4]
    this.movable = new Set();
    world.onTick((dt, now) => this.tick(now));
  }

  setColors(colors) {
    for (const [key, pawn] of this.pawns) {
      if (!colors.includes(pawn.userData.color)) {
        this.group.remove(pawn);
        this.pawns.delete(key);
        delete this.progress[pawn.userData.color];
      }
    }
    for (const color of colors) {
      if (this.progress[color]) continue;
      this.progress[color] = Array(TOKENS_PER_PLAYER).fill(YARD);
      const material = new THREE.MeshPhysicalMaterial({
        color: COLOR_HEX[color], roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.15,
      });
      for (let i = 0; i < TOKENS_PER_PLAYER; i++) {
        const pawn = new THREE.Group();
        const body = new THREE.Mesh(BODY, material);
        const head = new THREE.Mesh(HEAD, material);
        head.position.y = 0.72;
        body.castShadow = head.castShadow = true;
        const hit = new THREE.Mesh(HIT, new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.y = 0.5;
        const ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
        ring.visible = false;
        ring.position.y = 0.03;
        pawn.add(body, head, hit, ring);
        pawn.userData = { color, token: i, ring, animating: false, base: new THREE.Vector3(), scale: 1 };
        this.pawns.set(`${color}:${i}`, pawn);
        this.group.add(pawn);
      }
    }
    this.layout(true);
  }

  /** Jump every pawn to the given server positions without animation. */
  sync(tokens) {
    for (const color of Object.keys(tokens)) {
      if (this.progress[color]) this.progress[color] = [...tokens[color]];
    }
    this.layout(false);
  }

  /** Compute resting spots, spreading out pawns that share a cell. */
  layout(instant) {
    const cells = new Map();
    for (const [color, list] of Object.entries(this.progress)) {
      list.forEach((p, i) => {
        const key = cellKey(color, i, p);
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push([color, i, p]);
      });
    }
    for (const group of cells.values()) {
      group.forEach(([color, i, p], k) => {
        const pawn = this.pawns.get(`${color}:${i}`);
        if (!pawn || pawn.userData.animating) return;
        let [x, z] = tokenSpot(color, i, p);
        let scale = 1;
        if (group.length > 1) {
          const a = (k / group.length) * Math.PI * 2 + Math.PI / 4;
          x += Math.cos(a) * 0.22;
          z += Math.sin(a) * 0.22;
          scale = 0.72;
        }
        pawn.userData.base.set(x, restHeight(p, x, z), z);
        pawn.userData.scale = scale;
        if (instant) {
          pawn.position.copy(pawn.userData.base);
          pawn.scale.setScalar(scale);
        }
      });
    }
  }

  /** Hop a pawn cell by cell from one progress value to another. */
  async move(color, token, from, to) {
    const pawn = this.pawns.get(`${color}:${token}`);
    if (!pawn) return;
    pawn.userData.animating = true;
    const steps = from === YARD ? [0] : Array.from({ length: to - from }, (_, k) => from + k + 1);
    let prev = pawn.position.clone();
    for (const p of steps) {
      const [x, z] = tokenSpot(color, token, p);
      const next = new THREE.Vector3(x, restHeight(p, x, z), z);
      const start = prev.clone();
      const high = from === YARD ? 1.4 : 0.55;
      await tween(this.world, from === YARD ? 380 : TIMING.stepMs, (t) => {
        pawn.position.lerpVectors(start, next, t);
        pawn.position.y += Math.sin(Math.PI * t) * high;
        pawn.scale.setScalar(1 + Math.sin(Math.PI * t) * 0.08);
      });
      this.onStep?.(p);
      prev = next;
    }
    this.progress[color][token] = to;
    pawn.userData.animating = false;
    this.layout(false);
  }

  /** Fly a captured pawn back to its yard. */
  async capture(color, token) {
    const pawn = this.pawns.get(`${color}:${token}`);
    if (!pawn) return;
    pawn.userData.animating = true;
    const start = pawn.position.clone();
    const [x, z] = tokenSpot(color, token, YARD);
    const end = new THREE.Vector3(x, YARD_TOP, z);
    await tween(this.world, TIMING.captureMs - 100, (t) => {
      pawn.position.lerpVectors(start, end, t);
      pawn.position.y += Math.sin(Math.PI * t) * 3;
      pawn.rotation.y = t * Math.PI * 4;
    });
    pawn.rotation.y = 0;
    this.progress[color][token] = YARD;
    pawn.userData.animating = false;
    this.layout(false);
  }

  setMovable(color, indices) {
    this.movable = new Set(indices.map((i) => `${color}:${i}`));
    for (const [key, pawn] of this.pawns) pawn.userData.ring.visible = this.movable.has(key);
  }

  pick(event) {
    const hits = this.world.pick(event, [...this.movable].map((k) => this.pawns.get(k)).filter(Boolean));
    for (const hit of hits) {
      let o = hit.object;
      while (o && o.userData.token === undefined) o = o.parent;
      if (o) return { color: o.userData.color, token: o.userData.token };
    }
    return null;
  }

  tick(now) {
    for (const [key, pawn] of this.pawns) {
      const d = pawn.userData;
      if (d.animating) continue;
      const bob = this.movable.has(key) ? Math.abs(Math.sin(now / 220)) * 0.28 : 0;
      pawn.position.x += (d.base.x - pawn.position.x) * 0.25;
      pawn.position.z += (d.base.z - pawn.position.z) * 0.25;
      pawn.position.y += (d.base.y + bob - pawn.position.y) * 0.3;
      pawn.scale.setScalar(pawn.scale.x + (d.scale - pawn.scale.x) * 0.25);
      if (d.ring.visible) {
        d.ring.material.opacity = 0.5 + Math.sin(now / 160) * 0.4;
        d.ring.position.y = 0.03 - bob;
      }
    }
  }
}
