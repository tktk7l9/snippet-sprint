import * as THREE from "three";
import { NEON, type RenderContext } from "./renderer.js";

interface RingFx {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  life: number;
  maxLife: number;
  from: number;
  to: number;
}

const POOL = 28;

// Transient juice: expanding rings for correct keystrokes and combo milestones,
// a bloom flare, and a camera-shake impulse on mistakes.
export class EffectsLayer {
  readonly group = new THREE.Group();
  private readonly rings: RingFx[] = [];
  private readonly basePos = new THREE.Vector3(0, 1.4, 16);
  private shake = 0;
  private flare = 0;

  constructor(private readonly reduced = false) {
    const geo = new THREE.TorusGeometry(1, 0.045, 6, 40);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: NEON.accent,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, active: false, life: 0, maxLife: 1, from: 0, to: 1 });
    }
  }

  /** A small spark near the code, for a correct keystroke. */
  spark(): void {
    const fx = this.rings.find((r) => !r.active);
    if (!this.reduced) this.flare = Math.min(0.6, this.flare + 0.05);
    if (!fx) return;
    fx.active = true;
    fx.life = fx.maxLife = 0.45;
    fx.from = 0.15;
    fx.to = 1.1;
    fx.mat.color.set(NEON.accent);
    fx.mesh.position.set(
      (Math.random() - 0.5) * 13,
      (Math.random() - 0.5) * 7,
      5.5 + Math.random(),
    );
    fx.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    fx.mesh.visible = true;
  }

  /** A large shockwave + bloom flare for a combo milestone. */
  shockwave(): void {
    if (this.reduced) return;
    this.flare = Math.min(1.4, this.flare + 0.7);
    const fx = this.rings.find((r) => !r.active);
    if (!fx) return;
    fx.active = true;
    fx.life = fx.maxLife = 0.8;
    fx.from = 0.6;
    fx.to = 13;
    fx.mat.color.set(NEON.accent2);
    fx.mesh.position.set(0, 0, 0);
    fx.mesh.rotation.set(0, 0, 0);
    fx.mesh.visible = true;
  }

  /** Kick the camera on a mistake. */
  shakeImpulse(amount = 0.5): void {
    if (this.reduced) return;
    this.shake = Math.min(1.3, this.shake + amount);
  }

  update(dt: number, ctx: RenderContext): void {
    for (const fx of this.rings) {
      if (!fx.active) continue;
      fx.life -= dt;
      if (fx.life <= 0) {
        fx.active = false;
        fx.mesh.visible = false;
        fx.mat.opacity = 0;
        continue;
      }
      const t = 1 - fx.life / fx.maxLife;
      const scale = fx.from + (fx.to - fx.from) * t;
      fx.mesh.scale.setScalar(scale);
      fx.mat.opacity = (1 - t) * 0.8;
    }

    // bloom flare decays back to baseline
    this.flare = Math.max(0, this.flare - dt * 1.8);
    ctx.bloom.strength = ctx.baseBloom + this.flare;

    // camera shake
    if (this.shake > 0.002) {
      ctx.camera.position.set(
        this.basePos.x + (Math.random() - 0.5) * this.shake,
        this.basePos.y + (Math.random() - 0.5) * this.shake,
        this.basePos.z + (Math.random() - 0.5) * this.shake * 0.5,
      );
      this.shake *= Math.pow(0.0001, dt); // fast exponential decay
    } else {
      this.shake = 0;
      ctx.camera.position.copy(this.basePos);
    }
  }
}
