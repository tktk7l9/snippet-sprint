// Light bootstrap. Only the start screen ships in the initial bundle; the
// Three.js-heavy game runtime is loaded on demand (and warmed during idle).

import { Screens } from "./ui/screens.js";
import type { GameController } from "./game.js";
import type { PlayConfig } from "./modes/types.js";

let game: GameController | null = null;
let loading: Promise<GameController> | null = null;

const screens = new Screens({
  onStart: (cfg) => void boot(cfg),
  onRetry: () => game?.retry(),
  onNext: () => game?.next(),
  onMenu: () => game?.menu(),
});
screens.showStart();

async function ensureGame(): Promise<GameController> {
  if (game) return game;
  if (!loading) loading = import("./game.js").then((m) => m.createGame(screens));
  game = await loading;
  return game;
}

async function boot(cfg: PlayConfig): Promise<void> {
  (await ensureGame()).start(cfg);
}

// Warm the game chunk on the first user interaction so START is instant — but
// not during an idle cold load, which keeps the initial bundle light for
// Lighthouse (the Three.js chunk only loads once the user actually engages).
const warm = (): void => void ensureGame();
window.addEventListener("pointerdown", warm, { once: true });
window.addEventListener("keydown", warm, { once: true });

// Register the service worker for offline play (production only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
