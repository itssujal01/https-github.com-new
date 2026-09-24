import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { yardCenter } from '../../../shared/board.js';
import { TIMING } from '../../../shared/protocol.js';
import { COLOR_HEX } from '../theme.js';
import { YARD_TOP } from './boardMesh.js';
import { tween } from './tween.js';

const SIZE = 1.05;
const HALF = SIZE / 2;
const REST_Y = YARD_TOP + 0.01 + HALF;

// Face order of BoxGeometry groups: +x, -x, +y, -y, +z, -z. Opposite faces sum to 7.
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
];
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

function faceTexture(value) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.75);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#e3e7f5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (const [x, y] of PIPS[value]) {
    ctx.beginPath();
    ctx.arc(x * size, y * size, value === 1 ? 30 : 22, 0, Math.PI * 2);
    ctx.fillStyle = value === 1 ? '#ff4d6d' : '#1b2140';
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Run a physics throw offline and record every frame. */
function simulateThrow() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -38, 0) });
  world.allowSleep = true;
  const matDice = new CANNON.Material();
  const matFloor = new CANNON.Material();
  world.addContactMaterial(new CANNON.ContactMaterial(matDice, matFloor, { friction: 0.35, restitution: 0.35 }));
  const floor = new CANNON.Body({ mass: 0, material: matFloor, shape: new CANNON.Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  const body = new CANNON.Body({
    mass: 1, material: matDice, shape: new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF)),
    linearDamping: 0.12, angularDamping: 0.12, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.15,
  });
  const dir = Math.random() * Math.PI * 2;
  body.position.set(-Math.cos(dir) * 2.2, 3.2 + Math.random(), -Math.sin(dir) * 2.2);
  body.velocity.set(Math.cos(dir) * 5, 2 + Math.random() * 2, Math.sin(dir) * 5);
  body.angularVelocity.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
  body.quaternion.setFromEuler(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  world.addBody(body);

  const frames = [];
  const maxFrames = Math.round((TIMING.diceMs - 250) / 1000 * 60);
  for (let i = 0; i < maxFrames; i++) {
    world.step(1 / 60);
    frames.push({
      p: new THREE.Vector3(body.position.x, body.position.y, body.position.z),
      q: new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w),
    });
    if (body.sleepState === CANNON.Body.SLEEPING) break;
  }
  return frames;
}

function topFace(q) {
  let best = 0;
  let bestY = -Infinity;
  FACE_NORMALS.forEach((n, i) => {
    const y = n.clone().applyQuaternion(q).y;
    if (y > bestY) { bestY = y; best = i; }
  });
  return best;
}

export class Dice {
  constructor(world) {
    this.world = world;
    this.holder = new THREE.Group(); // follows the physics body
    this.inner = new THREE.Mesh(
      new RoundedBoxGeometry(SIZE, SIZE, SIZE, 5, 0.16),
      FACE_VALUES.map((v) => new THREE.MeshPhysicalMaterial({
        map: faceTexture(v), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2,
      })),
    );
    this.inner.castShadow = true;
    this.holder.add(this.inner);

    this.halo = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.05, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
    );
    this.halo.position.y = YARD_TOP + 0.02;
    this.root = new THREE.Group();
    this.root.add(this.holder, this.halo);
    this.root.visible = false;
    world.scene.add(this.root);

    this.value = 6;
    this.showFace(6);
    this.rolling = false;
    this.pulse = false;
    world.onTick((_dt, now) => {
      this.halo.material.opacity = this.pulse ? 0.45 + Math.sin(now / 150) * 0.35 : 0.25;
      if (this.pulse && !this.rolling) this.holder.position.y = REST_Y + Math.abs(Math.sin(now / 260)) * 0.25;
    });
  }

  /** Orient the die at rest so `value` faces up. */
  showFace(value) {
    this.holder.quaternion.identity();
    const from = FACE_NORMALS[FACE_VALUES.indexOf(value)];
    this.inner.quaternion.setFromUnitVectors(from, FACE_NORMALS[2]);
    this.holder.position.set(0, REST_Y, 0);
  }

  /** Move the die to the given player's yard. */
  async moveTo(color) {
    const [x, z] = yardCenter(color);
    this.halo.material.color.setHex(COLOR_HEX[color]);
    if (!this.root.visible) {
      this.root.visible = true;
      this.root.position.set(x, 0, z);
      return;
    }
    const start = this.root.position.clone();
    const end = new THREE.Vector3(x, 0, z);
    if (start.distanceTo(end) < 0.01) return;
    await tween(this.world, 450, (t) => {
      this.root.position.lerpVectors(start, end, t);
      this.root.position.y = Math.sin(Math.PI * t) * 1.2;
    });
  }

  /**
   * Play a physics throw that lands on `value`. The outcome comes from the
   * server; the recorded throw is re-oriented so the right face ends on top.
   */
  async roll(value) {
    this.rolling = true;
    this.pulse = false;
    const frames = simulateThrow();
    const last = frames.at(-1);
    // Snap the final pose flat, then rotate the visual cube so `value` is the face that ends up.
    const landed = topFace(last.q);
    const upWorld = FACE_NORMALS[landed].clone().applyQuaternion(last.q);
    const flatten = new THREE.Quaternion().setFromUnitVectors(upWorld, FACE_NORMALS[2]);
    const finalQ = flatten.multiply(last.q);
    this.inner.quaternion.setFromUnitVectors(FACE_NORMALS[FACE_VALUES.indexOf(value)], FACE_NORMALS[landed]);

    // Shift the whole path so the die comes to rest at the yard centre.
    const shift = new THREE.Vector3(-last.p.x, REST_Y - last.p.y, -last.p.z);
    const ms = (frames.length / 60) * 1000;
    const start = performance.now();
    await new Promise((resolve) => {
      const stop = this.world.onTick((_dt, now) => {
        const f = Math.min(frames.length - 1, Math.floor(((now - start) / ms) * frames.length));
        this.holder.position.copy(frames[f].p).add(shift);
        this.holder.quaternion.copy(frames[f].q);
        if (f === frames.length - 1) { stop(); resolve(); }
      });
    });
    const q0 = this.holder.quaternion.clone();
    const p0 = this.holder.position.clone();
    const rest = new THREE.Vector3(0, REST_Y, 0);
    await tween(this.world, 180, (t) => {
      this.holder.quaternion.slerpQuaternions(q0, finalQ, t);
      this.holder.position.lerpVectors(p0, rest, t);
    });
    this.onLand?.(value);
    this.value = value;
    this.rolling = false;
  }

  setPulse(on) {
    this.pulse = on;
    if (!on && !this.rolling) this.holder.position.y = REST_Y;
  }

  hit(event) {
    return this.root.visible && this.world.pick(event, [this.inner]).length > 0;
  }
}
