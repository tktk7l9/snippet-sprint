import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export interface RenderContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  /** Baseline bloom strength that effects decay back toward. */
  baseBloom: number;
  resize(): void;
  render(): void;
}

export const NEON = {
  bg: 0x05060c,
  accent: 0x5cf2ff,
  accent2: 0xc77dff,
  good: 0x7cffb2,
  err: 0xff5d73,
} as const;

export function createRenderContext(
  canvas: HTMLCanvasElement,
  reducedMotion = false,
): RenderContext {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(NEON.bg, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(NEON.bg, 0.026);

  const camera = new THREE.PerspectiveCamera(
    58,
    window.innerWidth / window.innerHeight,
    0.1,
    600,
  );
  camera.position.set(0, 1.4, 16);
  camera.lookAt(0, 0, 0);

  const ambient = new THREE.AmbientLight(0x6e7bb0, 0.6);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(8, 14, 10);
  scene.add(key);

  const rim = new THREE.PointLight(NEON.accent, 2.2, 90, 1.5);
  rim.position.set(-10, 6, -6);
  scene.add(rim);

  const accent = new THREE.PointLight(NEON.accent2, 1.6, 70, 1.6);
  accent.position.set(10, -4, 8);
  scene.add(accent);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const baseBloom = reducedMotion ? 0.3 : 0.85;
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    baseBloom,
    0.7,
    0.12,
  );
  composer.addPass(bloom);

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  }

  function render(): void {
    composer.render();
  }

  return { renderer, scene, camera, composer, bloom, baseBloom, resize, render };
}
