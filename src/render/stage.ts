import * as THREE from "three";
import { NEON } from "./renderer.js";

export interface StageSignals {
  /** 0..1 completion of the current snippet. */
  progress: number;
  /** Current combo count. */
  combo: number;
  /** 0..1 accuracy. */
  accuracy: number;
  /** Whether a run is currently in progress. */
  active: boolean;
}

const STAR_COUNT = 1100;
const RING_COUNT = 18;
const TUNNEL_DEPTH = 90;
const TUNNEL_NEAR = 18;

// Reactive 3D backdrop: a drifting starfield, a receding neon tunnel that
// accelerates with combo, and a slowly rotating wireframe core whose hue tracks
// accuracy. Everything sits behind the (blurred) code panel.
export class Stage {
  readonly group = new THREE.Group();

  private readonly stars: THREE.Points;
  private readonly rings: THREE.Mesh[] = [];
  private readonly core: THREE.LineSegments;
  private readonly coreMat: THREE.LineBasicMaterial;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly accentColor = new THREE.Color(NEON.accent);
  private readonly errColor = new THREE.Color(NEON.err);
  private readonly goodColor = new THREE.Color(NEON.good);
  private readonly tmpColor = new THREE.Color();

  private speed = 0.6; // smoothed tunnel speed
  private spin = 0;

  constructor() {
    // --- starfield ---
    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = -Math.random() * TUNNEL_DEPTH + 10;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: NEON.accent,
      size: 0.13,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, starMat);
    this.group.add(this.stars);

    // --- tunnel rings ---
    this.ringMat = new THREE.MeshBasicMaterial({
      color: NEON.accent,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringGeo = new THREE.TorusGeometry(11, 0.05, 8, 80);
    for (let i = 0; i < RING_COUNT; i++) {
      const ring = new THREE.Mesh(ringGeo, this.ringMat);
      ring.position.z = -((i / RING_COUNT) * TUNNEL_DEPTH);
      ring.rotation.z = Math.random() * Math.PI;
      this.rings.push(ring);
      this.group.add(ring);
    }

    // --- wireframe core ---
    const coreGeo = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(3.4, 1));
    this.coreMat = new THREE.LineBasicMaterial({
      color: NEON.accent2,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.core = new THREE.LineSegments(coreGeo, this.coreMat);
    this.core.position.z = -10;
    this.group.add(this.core);
  }

  update(dt: number, s: StageSignals): void {
    // tunnel speed accelerates with combo
    const targetSpeed = s.active ? 3 + Math.min(s.combo, 60) * 0.12 : 0.6;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 2);

    for (const ring of this.rings) {
      ring.position.z += this.speed * dt;
      ring.rotation.z += dt * 0.25;
      if (ring.position.z > TUNNEL_NEAR) ring.position.z -= TUNNEL_DEPTH;
    }

    // starfield drifts forward + parallax rotation
    this.stars.rotation.z += dt * 0.02;
    this.stars.position.z = (this.stars.position.z + this.speed * dt * 0.25) % 8;

    // core grows + spins with progress / combo
    this.spin += dt * (0.2 + Math.min(s.combo, 40) * 0.02);
    this.core.rotation.set(this.spin * 0.6, this.spin, 0);
    const scale = 1 + s.progress * 0.6;
    this.core.scale.setScalar(scale);
    this.coreMat.opacity = 0.28 + s.progress * 0.4;

    // hue tracks accuracy: cyan -> red as accuracy falls; green flash on high combo
    if (s.combo >= 20) {
      this.tmpColor.copy(this.accentColor).lerp(this.goodColor, 0.6);
    } else {
      this.tmpColor.copy(this.errColor).lerp(this.accentColor, Math.max(0, Math.min(1, s.accuracy)));
    }
    this.ringMat.color.copy(this.tmpColor);
    (this.stars.material as THREE.PointsMaterial).color.copy(this.tmpColor);
  }
}
