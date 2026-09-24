import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, START_INDEX, SAFE_CELLS } from '../../../shared/engine.js';
import { TRACK, HOME_COLUMN, HOME_SIDE, toWorld, yardCenter, yardSlot } from '../../../shared/board.js';
import { COLOR_HEX } from '../theme.js';

export const CELL_TOP = 0.12;
export const YARD_TOP = 0.36;
const PYRAMID_HEIGHT = 0.9;

/** Height of the finish pyramid surface at a point near the centre. */
export function pyramidHeight(x, z) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  return Math.max(0, PYRAMID_HEIGHT * (1 - d / 1.5));
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, ...opts });
}

function instanced(geometry, material, positions, y) {
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  const m = new THREE.Matrix4();
  positions.forEach(([x, z], i) => mesh.setMatrixAt(i, m.makeTranslation(x, y, z)));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

function starShape(outer, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function arrowShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.28, -0.12); s.lineTo(0.05, -0.12); s.lineTo(0.05, -0.26);
  s.lineTo(0.32, 0); s.lineTo(0.05, 0.26); s.lineTo(0.05, 0.12);
  s.lineTo(-0.28, 0.12); s.closePath();
  return s;
}

export function buildBoard() {
  const group = new THREE.Group();

  // Board slab with a soft glowing edge.
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(16.4, 0.8, 16.4, 4, 0.4),
    mat(0x161b36, { roughness: 0.35, metalness: 0.4 }),
  );
  base.position.y = -0.4;
  base.receiveShadow = true;
  group.add(base);
  const glow = new THREE.Mesh(
    new RoundedBoxGeometry(16.9, 0.3, 16.9, 4, 0.3),
    new THREE.MeshBasicMaterial({ color: 0x6c5cff, transparent: true, opacity: 0.35 }),
  );
  glow.position.y = -0.72;
  group.add(glow);

  const cellGeo = new RoundedBoxGeometry(0.92, 0.12, 0.92, 2, 0.06);
  const colored = new Map(COLORS.map((c) => [c, []]));
  const plain = [];

  TRACK.forEach((cell, i) => {
    const owner = COLORS.find((c) => START_INDEX[c] === i);
    (owner ? colored.get(owner) : plain).push(toWorld(cell));
  });
  for (const c of COLORS) {
    for (const cell of HOME_COLUMN[c]) colored.get(c).push(toWorld(cell));
  }
  group.add(instanced(cellGeo, mat(0xeef1fb, { roughness: 0.55 }), plain, CELL_TOP / 2));
  for (const c of COLORS) {
    group.add(instanced(cellGeo, mat(COLOR_HEX[c], { roughness: 0.35 }), colored.get(c), CELL_TOP / 2));
  }

  // Stars on the safe cells that are not start cells, arrows on start cells.
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.34, 0.15), { depth: 0.04, bevelEnabled: false });
  starGeo.rotateX(-Math.PI / 2);
  const starMat = mat(0x8f95b8, { roughness: 0.4 });
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape(), { depth: 0.04, bevelEnabled: false });
  arrowGeo.rotateX(-Math.PI / 2);
  const arrowMat = mat(0xffffff, { roughness: 0.4 });
  for (const i of SAFE_CELLS) {
    const [x, z] = toWorld(TRACK[i]);
    const isStart = COLORS.some((c) => START_INDEX[c] === i);
    const mesh = new THREE.Mesh(isStart ? arrowGeo : starGeo, isStart ? arrowMat : starMat);
    mesh.position.set(x, CELL_TOP, z);
    if (isStart) {
      const [nx, nz] = toWorld(TRACK[(i + 1) % TRACK.length]);
      mesh.rotation.y = Math.atan2(-(nz - z), nx - x);
    }
    group.add(mesh);
  }

  // Yards.
  const yardGeo = new RoundedBoxGeometry(5.7, 0.26, 5.7, 3, 0.3);
  const innerGeo = new RoundedBoxGeometry(4.1, 0.1, 4.1, 3, 0.2);
  const socketGeo = new THREE.TorusGeometry(0.44, 0.06, 12, 40);
  socketGeo.rotateX(Math.PI / 2);
  const innerMat = mat(0xf4f6ff, { roughness: 0.5 });
  for (const c of COLORS) {
    const [x, z] = yardCenter(c);
    const yard = new THREE.Mesh(yardGeo, mat(COLOR_HEX[c], { roughness: 0.3, metalness: 0.1 }));
    yard.position.set(x, 0.13, z);
    yard.receiveShadow = true;
    yard.castShadow = true;
    group.add(yard);
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(x, 0.31, z);
    inner.receiveShadow = true;
    group.add(inner);
    const socketMat = mat(COLOR_HEX[c], { roughness: 0.3 });
    for (let t = 0; t < 4; t++) {
      const [sx, sz] = yardSlot(c, t);
      const ring = new THREE.Mesh(socketGeo, socketMat);
      ring.position.set(sx, YARD_TOP, sz);
      group.add(ring);
    }
  }

  // Finish pyramid: one coloured face per side.
  for (const c of COLORS) {
    const [dx, dz] = HOME_SIDE[c];
    // Corners of this side of the 3x3 centre square, plus the apex.
    const px = -dz;
    const pz = dx;
    const a = new THREE.Vector3((dx + px) * 1.5, 0.02, (dz + pz) * 1.5);
    const b = new THREE.Vector3((dx - px) * 1.5, 0.02, (dz - pz) * 1.5);
    const apex = new THREE.Vector3(0, PYRAMID_HEIGHT, 0);
    // Wind the triangle so its face points up and outward.
    const n = new THREE.Vector3();
    new THREE.Triangle(a, b, apex).getNormal(n);
    const geo = new THREE.BufferGeometry().setFromPoints(n.y < 0 ? [b, a, apex] : [a, b, apex]);
    geo.computeVertexNormals();
    const face = new THREE.Mesh(geo, mat(COLOR_HEX[c], { roughness: 0.3, flatShading: true }));
    face.receiveShadow = true;
    face.castShadow = true;
    group.add(face);
  }

  return group;
}
