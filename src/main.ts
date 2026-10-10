// Light bootstrap. Only the start screen ships in the initial bundle; the
// Three.js-heavy game runtime is loaded on demand (and warmed during idle).

import "./styles.css";
import { availableCategories, availableDifficulties } from "./engine/availability.js";
import { isLoaded, loadLanguages, poolFor, warmAll } from "./engine/content/index.js";
import { Screens } from "./ui/screens.js";
import type { GameController } from "./game.js";
import type { PlayConfig } from "./modes/types.js";

// Cloudflare Web Analytics — production only. The site token is a public
// identifier embedded in every page, not a secret.
if (import.meta.env.PROD) {
  const beacon = document.createElement("script");
  beacon.type = "module";
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = '{"token": "cd156fbf0fd24da0a12e58fdb4e63828"}';
  document.head.appendChild(beacon);
}

let game: GameController | null = null;
let loading: Promise<GameController> | null = null;
let warmed = false;

const screens = new Screens({
  onStart: (cfg) => void boot(cfg),
  onRetry: () => game?.retry(),
  onNext: () => game?.next(),
  onMenu: () => game?.menu(),
});
screens.showStart();

function ensureGame(): Promise<GameController> {
  loading ??= import("./game.js")
    .then((m) => (game = m.createGame(screens)))
    .catch((e: unknown) => {
      loading = null; // a failed fetch (offline) must not poison every later START
      throw e;
    });
  return loading;
}

/**
 * Fetch the rest of the languages one at a time once the player is busy with a
 * round, so offline play keeps working for every language after one session
 * (the service worker caches each chunk). Skipped under Save-Data.
 */
function warmRest(): void {
  if (warmed) return;
  warmed = true;
  if ((navigator as { connection?: { saveData?: boolean } }).connection?.saveData) return;
  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000));
  idle(() => void warmAll().catch(() => (warmed = false)));
}

async function boot(cfg: PlayConfig): Promise<void> {
  try {
    // The round waits only for the chosen languages; the Three.js chunk loads alongside.
    const [g] = await Promise.all([ensureGame(), loadLanguages(cfg.languages)]);
    g.start(cfg);
  } catch {
    screens.showStartError("読み込めませんでした。接続を確認して、もう一度 START を押してください。");
    return;
  }
  warmRest();
}

// Warm the game chunk on the first user interaction so START is instant — but
// not during an idle cold load, which keeps the initial bundle light for
// Lighthouse (the Three.js chunk only loads once the user actually engages).
const warm = (): void => {
  void ensureGame().catch(() => {});
  // Filter feasibility needs the snippet data, which loads per language on
  // demand (Screens asks `ensure` for the selection and re-syncs when it lands).
  screens.setAvailability({
    categories: (langs) => (isLoaded(langs) ? availableCategories(langs, poolFor(langs)) : null),
    // Only asked once `categories` answered, i.e. the same languages are loaded.
    difficulties: (langs, cat) => availableDifficulties(langs, cat, poolFor(langs)),
    ensure: (langs) =>
      loadLanguages(langs).then(
        () => true,
        () => false, // offline before this language was cached: filters simply stay open
      ),
  });
};
window.addEventListener("pointerdown", warm, { once: true });
window.addEventListener("keydown", warm, { once: true });

// Register the service worker for offline play (production only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
