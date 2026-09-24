import * as THREE from 'three';

// Camera azimuth per viewing colour, chosen so that colour's yard sits bottom-left.
const AZIMUTH = { blue: 0, red: -Math.PI / 2, green: Math.PI, yellow: Math.PI / 2 };

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

    this.scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x1a1030, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-6, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -11;
    sun.shadow.camera.right = 11;
    sun.shadow.camera.top = 11;
    sun.shadow.camera.bottom = -11;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8a7dff, 0.6);
    rim.position.set(8, 6, -10);
    this.scene.add(rim);

    this.azimuth = 0;
    this.targetAzimuth = 0;
    this.idleSpin = true;
    this.tickers = new Set();
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.raycaster = new THREE.Raycaster();

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait screens get a more top-down view to use the extra height.
    this.tilt = this.camera.aspect < 0.8 ? 1.12 : 0.95;
    this.camera.updateProjectionMatrix();
    this.distance = this.fitDistance();
    this.placeCamera();
  }

  /** Smallest camera distance that keeps every board corner on screen. */
  fitDistance() {
    const corners = [];
    for (const x of [-8.3, 8.3]) for (const z of [-8.3, 8.3]) for (const y of [-0.8, 0.8]) corners.push(new THREE.Vector3(x, y, z));
    const fits = (d) => {
      this.distance = d;
      this.azimuth = 0;
      this.placeCamera();
      this.camera.updateMatrixWorld();
      return corners.every((c) => {
        const p = c.clone().project(this.camera);
        return Math.abs(p.x) < 0.94 && p.y < 0.8 && p.y > -0.86;
      });
    };
    const saved = this.azimuth;
    let lo = 10;
    let hi = 80;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid; else lo = mid;
    }
    this.azimuth = saved;
    return hi;
  }

  /** Point the camera so the viewing colour's yard is bottom-left; null spins slowly. */
  viewAs(color) {
    this.idleSpin = !color;
    if (!color) return;
    let target = AZIMUTH[color];
    // Rotate the short way round.
    while (target - this.azimuth > Math.PI) target -= Math.PI * 2;
    while (target - this.azimuth < -Math.PI) target += Math.PI * 2;
    this.targetAzimuth = target;
  }

  placeCamera() {
    const a = this.azimuth;
    const d = this.distance;
    this.camera.position.set(
      Math.sin(a) * Math.cos(this.tilt) * d,
      Math.sin(this.tilt) * d,
      Math.cos(a) * Math.cos(this.tilt) * d,
    );
    this.camera.lookAt(0, -0.4, 0);
  }

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const now = performance.now();
    if (this.idleSpin) {
      this.azimuth += dt * 0.12;
      this.targetAzimuth = this.azimuth;
    } else {
      this.azimuth += (this.targetAzimuth - this.azimuth) * Math.min(1, dt * 4);
    }
    this.placeCamera();
    for (const t of this.tickers) t(dt, now);
    this.renderer.render(this.scene, this.camera);
  }

  onTick(fn) {
    this.tickers.add(fn);
    return () => this.tickers.delete(fn);
  }

  /** Objects under a pointer event, nearest first. */
  pick(event, objects) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }
}
