import * as THREE from "three";
import type { Language } from "../engine/content/types.js";
import { NEON, type RenderContext } from "./renderer.js";
import { DEFAULT_THEME, LANGUAGE_THEME } from "./themes.js";

export interface StageSignals {
  /** 0..1 completion of the current snippet. */
  progress: number;
  /** Current combo count. */
  combo: number;
  /** 0..1 accuracy. */
  accuracy: number;
  /** Whether a run is currently in progress. */
  active: boolean;
  /** Language of the current snippet, for per-language theming. */
  language?: Language;
}

const STAR_COUNT = 1100;
const RING_COUNT = 18;
const TUNNEL_DEPTH = 90;
const TUNNEL_NEAR = 18;

// Reactive 3D backdrop: a drifting starfield, a receding neon tunnel that
// accelerates with combo, and a slowly rotating wireframe core. Its palette
// tracks the current language (smooth transition); combo/accuracy nudge the hue.
export class Stage {
  readonly group = new THREE.Group();

  private readonly stars: THREE.Points;
  private readonly rings: THREE.Mesh[] = [];
  private readonly core: THREE.LineSegments;
  private readonly coreMat: THREE.LineBasicMaterial;
  private readonly ringMat: THREE.MeshBasicMaterial;

  private readonly errColor = new THREE.Color(NEON.err);
  private readonly goodColor = new THREE.Color(NEON.good);
  private readonly currentPrimary = new THREE.Color(DEFAULT_THEME.primary);
  private readonly currentSecondary = new THREE.Color(DEFAULT_THEME.secondary);
  private readonly targetPrimary = new THREE.Color(DEFAULT_THEME.primary);
  private readonly targetSecondary = new THREE.Color(DEFAULT_THEME.secondary);
  private readonly tmpColor = new THREE.Color();

  private speed = 0.6; // smoothed tunnel speed
  private spin = 0;

  constructor(private readonly ctx: RenderContext) {
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
      color: DEFAULT_THEME.primary,
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
      color: DEFAULT_THEME.primary,
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
      color: DEFAULT_THEME.secondary,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.core = new THREE.LineSegments(coreGeo, this.coreMat);
    this.core.position.z = -10;
    this.group.add(this.core);

    ctx.scene.add(this.group);
  }

  update(dt: number, s: StageSignals): void {
    // --- per-language palette (smooth transition) ---
    const theme = s.language ? LANGUAGE_THEME[s.language] : DEFAULT_THEME;
    this.targetPrimary.setHex(theme.primary);
    this.targetSecondary.setHex(theme.secondary);
    const k = Math.min(1, dt * 2.5);
    this.currentPrimary.lerp(this.targetPrimary, k);
    this.currentSecondary.lerp(this.targetSecondary, k);

    // --- motion ---
    const targetSpeed = s.active ? 3 + Math.min(s.combo, 60) * 0.12 : 0.6;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 2);

    for (const ring of this.rings) {
      ring.position.z += this.speed * dt;
      ring.rotation.z += dt * 0.25;
      if (ring.position.z > TUNNEL_NEAR) ring.position.z -= TUNNEL_DEPTH;
    }

    this.stars.rotation.z += dt * 0.02;
    this.stars.position.z = (this.stars.position.z + this.speed * dt * 0.25) % 8;

    this.spin += dt * (0.2 + Math.min(s.combo, 40) * 0.02);
    this.core.rotation.set(this.spin * 0.6, this.spin, 0);
    this.core.scale.setScalar(1 + s.progress * 0.6);
    this.coreMat.opacity = 0.28 + s.progress * 0.4;

    // --- color: language primary, nudged by combo (green) / accuracy (red) ---
    this.tmpColor.copy(this.currentPrimary);
    if (s.combo >= 20) this.tmpColor.lerp(this.goodColor, 0.22);
    const acc = Math.max(0, Math.min(1, s.accuracy));
    this.tmpColor.lerp(this.errColor, (1 - acc) * 0.3);

    this.ringMat.color.copy(this.tmpColor);
    (this.stars.material as THREE.PointsMaterial).color.copy(this.tmpColor);
    this.coreMat.color.copy(this.currentSecondary);
    this.ctx.fog.color.copy(this.currentPrimary).multiplyScalar(0.09);

    // --- CSS body glow follows the theme ---
    const root = document.documentElement.style;
    root.setProperty("--glow-a", cssRgba(this.currentPrimary, 0.18));
    root.setProperty("--glow-b", cssRgba(this.currentSecondary, 0.13));
  }
}

function cssRgba(color: THREE.Color, alpha: number): string {
  const hex = color.getHexString(); // sRGB
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
