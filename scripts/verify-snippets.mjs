#!/usr/bin/env node
// Plays snippets in a real headless Chrome against `vite preview` of ./dist:
// checks that the code panel stays clear of the HUD and that a snippet can be
// cleared by typing it. No dependencies; talks CDP over Node's WebSocket.
//
//   npm run build
//   node scripts/verify-snippets.mjs                  # added/changed vs origin/main
//   node scripts/verify-snippets.mjs --all            # every snippet
//   node scripts/verify-snippets.mjs --ids a,b --viewports phone
//   node scripts/verify-snippets.mjs --measure-only   # layout only, no typing
//   node scripts/verify-snippets.mjs --out result.json --shots dir --self-test
//
// Snippets are reached the way a returning player reaches them: the start
// screen selection is seeded through the saved prefs before load (never by
// clicking pills, which toggle whatever the prefs restored), then START is
// pressed with Math.random held so selectSnippet lands on the wanted entry.
// The exit code is non-zero if any snippet fails.

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = resolve(import.meta.dirname, "..");
const LANG_DIR = "src/engine/content/languages";
const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PREFS_KEY = "snippet-sprint:prefs:v1";
const BESTS_KEY = "snippet-sprint:bests:v1";

const VIEWPORTS = {
  // Touch emulation: pointer:coarse is on, so text goes through the hidden input
  // (beforeinput), which is the path a phone's soft keyboard uses.
  phone: { width: 375, height: 667, mobile: true, deviceScaleFactor: 2 },
  desktop: { width: 1280, height: 800, mobile: false, deviceScaleFactor: 1 },
};

function parseArgs(argv) {
  const opts = { base: "origin/main", all: false, measureOnly: false, selfTest: false, viewports: Object.keys(VIEWPORTS) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") opts.all = true;
    else if (a === "--measure-only") opts.measureOnly = true;
    else if (a === "--self-test") opts.selfTest = true;
    else if (a === "--base") opts.base = argv[++i];
    else if (a === "--ids") opts.ids = argv[++i].split(",");
    else if (a === "--viewports") opts.viewports = argv[++i].split(",");
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--shots") opts.shots = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

// ---- snippet list ----

/** Evaluate a language module's source. Its only imports are type-only, so stripping types is enough. */
async function evalModule(source) {
  const js = stripTypeScriptTypes(source, { mode: "strip" });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
  return mod.SNIPPETS;
}

async function readSnippets(base) {
  const current = new Map();
  const previous = new Map();
  for (const file of readdirSync(join(ROOT, LANG_DIR)).filter((f) => f.endsWith(".ts"))) {
    const path = `${LANG_DIR}/${file}`;
    const snippets = await evalModule(readFileSync(join(ROOT, path), "utf8"));
    snippets.forEach((s, poolIndex) => current.set(s.id, { ...s, poolIndex }));
    if (!base) continue;
    const old = execFileSync("git", ["show", `${base}:${path}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
    for (const s of await evalModule(old)) previous.set(s.id, s);
  }
  return { current, previous };
}

/** Which snippets selectSnippet considers for this snippet's filters, in pool order. */
function candidatesFor(snippet, all) {
  return [...all.values()]
    .filter((s) => s.language === snippet.language && s.difficulty === snippet.difficulty && s.category === snippet.category)
    .sort((a, b) => a.poolIndex - b.poolIndex);
}

// ---- processes ----

function freePort() {
  return new Promise((ok, fail) => {
    const srv = createServer();
    srv.on("error", fail);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => ok(port));
    });
  });
}

async function waitFor(check, what, timeoutMs = 20000, stepMs = 25) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await sleep(stepMs);
  }
}

async function startPreview() {
  const port = await freePort();
  const proc = spawn(join(ROOT, "node_modules/.bin/vite"), ["preview", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}/`;
  await waitFor(() => fetch(url).then((r) => r.ok, () => false), "vite preview");
  return { url, stop: () => proc.kill() };
}

async function startChrome() {
  const profile = mkdtempSync(join(tmpdir(), "snippet-sprint-verify-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const portFile = join(profile, "DevToolsActivePort");
  await waitFor(() => existsSync(portFile) && readFileSync(portFile, "utf8").includes("\n"), "Chrome debugging port");
  const port = readFileSync(portFile, "utf8").split("\n")[0];
  return {
    port,
    stop: async () => {
      proc.kill();
      await sleep(300);
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

class Cdp {
  #id = 0;
  #pending = new Map();
  #handlers = new Map();
  constructor(ws) {
    this.ws = ws;
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.#pending.get(msg.id);
        this.#pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else {
        for (const h of this.#handlers.get(msg.method) ?? []) h(msg.params);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((ok, fail) => {
      ws.addEventListener("open", ok, { once: true });
      ws.addEventListener("error", fail, { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    this.#handlers.set(method, [...(this.#handlers.get(method) ?? []), handler]);
  }
  /** Evaluate in the page. A throw here is a harness problem and says which expression failed. */
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error(`harness expression failed: ${d.exception?.description ?? d.text}\n  in: ${expression.slice(0, 160)}`);
    }
    return r.result.value;
  }
}

// ---- page helpers ----

// Held only while START is pending; a constant makes selectSnippet deterministic.
const RANDOM_HOOK = `(() => {
  const real = Math.random;
  Math.random = () => (window.__heldRandom !== undefined ? window.__heldRandom : real());
})();`;

const MEASURE = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };
  const de = document.documentElement;
  return {
    vw: de.clientWidth,
    vh: de.clientHeight,
    code: box("#code"),
    desc: box("#code-desc"),
    stats: box("#panel-stats"),
    meta: box("#panel-meta"),
    controls: box("#play-controls"),
    status: box("#status-bar button"),
    progress: box("#progress"),
  };
})()`;

const intersects = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function assess(m) {
  const hud = ["stats", "meta", "controls", "status", "progress"];
  const overlaps = [];
  for (const part of ["code", "desc"]) {
    for (const other of hud) if (intersects(m[part], m[other])) overlaps.push(`${part}×${other}`);
  }
  const clipped =
    m.code.top < 0 || m.code.left < 0 || m.code.right > m.vw || m.code.bottom > m.vh || m.desc.bottom > m.vh;
  return { overlaps, clipped, statsOverlap: intersects(m.code, m.stats), gapToStats: m.code.top - m.stats.bottom };
}

async function press(cdp, viewport, selector) {
  const point = await cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { x, y, hit: el.contains(document.elementFromPoint(x, y)) };
  })()`);
  if (!point.hit) throw new Error(`${selector} is covered, cannot press it`);
  if (viewport.mobile) {
    await cdp.send("Input.synthesizeTapGesture", { x: point.x, y: point.y });
    return;
  }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function typeEnter(cdp) {
  const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", text: "\r", unmodifiedText: "\r", ...key });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
}

async function typeChar(cdp, viewport, ch) {
  if (ch === "\n") return typeEnter(cdp);
  // Soft keyboards deliver text with no usable keydown: only beforeinput on the sink.
  if (viewport.mobile) return cdp.send("Input.insertText", { text: ch });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: ch, text: ch, unmodifiedText: ch });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: ch });
}

/** Characters the player actually types: indentation after a newline is skipped by the game. */
function keystrokes(code) {
  return code.replace(/\n[ \t]+/g, "\n");
}

const shownCode = `[...document.querySelectorAll("#code span")].map((s) => s.textContent).join("").replaceAll("↵\\n", "\\n")`;

/** Load the page with a clean slate and this snippet's filters, and start the round on it. */
async function startRound(cdp, viewport, url, snippet, snippets) {
  const candidates = candidatesFor(snippet, snippets);
  const index = candidates.findIndex((s) => s.id === snippet.id);
  const prefs = { languages: [snippet.language], category: snippet.category, difficulty: snippet.difficulty };
  await cdp.eval(`localStorage.clear(); localStorage.setItem(${JSON.stringify(PREFS_KEY)}, ${JSON.stringify(JSON.stringify(prefs))}); 0`);
  await cdp.send("Page.navigate", { url });
  await waitFor(() => cdp.eval(`document.readyState === "complete" && !!document.querySelector("#start-screen.show")`), "start screen");

  // The saved prefs must have reached the pills, or the selection below is meaningless.
  const pressed = await cdp.eval(`[...document.querySelectorAll("#lang-pills .pill.active")].map((b) => b.dataset.id)`);
  if (pressed.join() !== snippet.language) throw new Error(`prefs not restored: ${pressed.join()}`);

  // The first press warms the game runtime; START waits for it anyway, but random
  // must not be held while Three.js builds its particle field.
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 2, y: 2, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 2, y: 2, button: "left", clickCount: 1 });
  await waitFor(() => cdp.eval(`!!document.querySelector("#status-bar button")`), "game runtime");

  await cdp.eval(`window.__heldRandom = ${(index + 0.5) / candidates.length}; 0`);
  await press(cdp, viewport, "#start-btn");
  await waitFor(() => cdp.eval(`!!document.querySelector("#sprint-view.show")`), "round start");
  await cdp.eval(`delete window.__heldRandom; 0`);

  const shown = await cdp.eval(shownCode);
  if (shown !== snippet.code) throw new Error(`wrong snippet on screen: ${JSON.stringify(shown.slice(0, 60))}`);
}

async function clearByTyping(cdp, viewport, snippet) {
  if (viewport.mobile) {
    const focus = await cdp.eval(`document.activeElement?.id ?? ""`);
    if (focus !== "key-sink") throw new Error(`soft keyboard sink is not focused: "${focus}"`);
  }
  const chars = [...keystrokes(snippet.code)];
  for (const ch of chars.slice(0, -1)) await typeChar(cdp, viewport, ch);

  // The stats have their widest values here, right before the round ends.
  const late = await cdp.eval(MEASURE);
  const state = await cdp.eval(`({
    paused: !!document.querySelector("#pause-overlay.show"),
    misses: document.querySelectorAll("#code .ch.error").length,
    acc: document.querySelector("#stat-acc").textContent,
  })`);
  if (state.paused) throw new Error("game paused itself mid-round");
  await typeChar(cdp, viewport, chars.at(-1));

  await waitFor(() => cdp.eval(`!!document.querySelector("#results.show")`), `results screen (accuracy so far ${state.acc})`, 5000);
  const result = await cdp.eval(`({
    acc: document.querySelector("#result-acc").textContent,
    combo: document.querySelector("#result-combo").textContent,
    meta: document.querySelector("#result-meta").textContent,
    hudHidden: !document.querySelector("#play-hud.show"),
    stored: JSON.parse(localStorage.getItem(${JSON.stringify(BESTS_KEY)}) ?? "{}"),
  })`);
  const cleared =
    result.acc === "100%" &&
    result.hudHidden &&
    result.meta.includes(snippet.label) &&
    !!result.stored[`sprint:${snippet.id}`] &&
    Number(result.combo) === chars.length;
  return { cleared, keys: chars.length, acc: result.acc, combo: Number(result.combo), late };
}

/** A checker that cannot fail proves nothing: confirm a wrong key and a forced overlap are both caught. */
async function selfTest(cdp, viewport, url, snippet, snippets) {
  await startRound(cdp, viewport, url, snippet, snippets);
  const expected = keystrokes(snippet.code)[0];
  await typeChar(cdp, viewport, expected === "~" ? "!" : "~");
  const flagged = await cdp.eval(`document.querySelectorAll("#code .ch.error").length`);
  if (flagged !== 1) throw new Error("self-test: a wrong key was not flagged");
  const acc = await cdp.eval(`document.querySelector("#stat-acc").textContent`);
  if (acc === "100%") throw new Error("self-test: a wrong key did not lower accuracy");
  await cdp.eval(`document.querySelector("#code-wrap").style.cssText = "top:40px;left:0;transform:none"; 0`);
  const forced = assess(await cdp.eval(MEASURE));
  if (!forced.statsOverlap) throw new Error("self-test: a forced overlap was not detected");
  console.log(`self-test ${viewport.width}x${viewport.height}: wrong key flagged, forced overlap detected`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!existsSync(join(ROOT, "dist/index.html"))) throw new Error("dist/ is missing: run `npm run build` first");

  const { current, previous } = await readSnippets(opts.all ? null : opts.base);
  const added = [...current.values()].filter((s) => !previous.has(s.id));
  // Any visible field counts: a longer description takes layout height too.
  const isSame = (a, b) => ["code", "description", "label", "difficulty", "category"].every((k) => a[k] === b[k]);
  const changed = [...current.values()].filter((s) => previous.has(s.id) && !isSame(previous.get(s.id), s));
  const targets = opts.ids
    ? opts.ids.map((id) => current.get(id))
    : opts.all
      ? [...current.values()]
      : [...added, ...changed];
  if (targets.some((t) => !t)) throw new Error("unknown id in --ids");
  console.log(`${current.size} snippets; checking ${targets.length}` + (opts.all ? "" : ` (added ${added.length}, changed ${changed.length} vs ${opts.base})`));

  const preview = await startPreview();
  const chrome = await startChrome();
  const results = [];
  try {
    const res = await fetch(`http://127.0.0.1:${chrome.port}/json/new?about:blank`, { method: "PUT" });
    const cdp = await Cdp.connect((await res.json()).webSocketDebuggerUrl);

    let problems = [];
    cdp.on("Runtime.exceptionThrown", ({ exceptionDetails: d }) =>
      problems.push(`exception: ${d.exception?.description ?? d.text} @ ${d.url ?? ""}:${d.lineNumber}:${d.columnNumber}`),
    );
    cdp.on("Runtime.consoleAPICalled", (e) => {
      if (e.type === "error") problems.push(`console.error: ${e.args.map((a) => a.description ?? a.value).join(" ")}`);
    });
    cdp.on("Log.entryAdded", ({ entry }) => {
      if (entry.level === "error") problems.push(`log: ${entry.text} ${entry.url ?? ""}`);
    });

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Network.enable");
    // Stale service worker caches must not stand in for this build, and local
    // runs must not send analytics beacons to production.
    await cdp.send("Network.setBypassServiceWorker", { bypass: true });
    await cdp.send("Network.setBlockedURLs", { urls: ["*cloudflareinsights.com*"] });
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: RANDOM_HOOK });
    // Headless tabs may report as unfocused, and the game auto-pauses on blur.
    await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await cdp.send("Page.navigate", { url: preview.url });
    await waitFor(() => cdp.eval(`document.readyState === "complete"`), "first load");

    for (const name of opts.viewports) {
      const viewport = VIEWPORTS[name];
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor,
        mobile: viewport.mobile,
      });
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile, maxTouchPoints: 5 });
      await cdp.send("Emulation.setEmulatedMedia", {
        features: [{ name: "pointer", value: viewport.mobile ? "coarse" : "fine" }, { name: "hover", value: viewport.mobile ? "none" : "hover" }],
      });
      if (opts.selfTest) await selfTest(cdp, viewport, preview.url, targets[0], current);

      for (const snippet of targets) {
        problems = [];
        const row = { id: snippet.id, viewport: name, lines: snippet.code.split("\n").length, chars: snippet.code.length };
        const t0 = Date.now();
        try {
          await startRound(cdp, viewport, preview.url, snippet, current);
          const m = await cdp.eval(MEASURE);
          if (m.vw !== viewport.width || m.vh !== viewport.height) throw new Error(`viewport is ${m.vw}x${m.vh}`);
          Object.assign(row, assess(m), { codeTop: m.code.top, codeBottom: m.code.bottom, statsBottom: m.stats.bottom, descBottom: m.desc.bottom });
          if (opts.shots) {
            mkdirSync(opts.shots, { recursive: true });
            const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
            writeFileSync(join(opts.shots, `${name}-${snippet.id}.png`), Buffer.from(shot.data, "base64"));
          }
          if (!opts.measureOnly) {
            const typed = await clearByTyping(cdp, viewport, snippet);
            const late = assess(typed.late);
            Object.assign(row, { cleared: typed.cleared, keys: typed.keys, acc: typed.acc, combo: typed.combo });
            row.statsOverlap ||= late.statsOverlap;
            row.overlaps = [...new Set([...row.overlaps, ...late.overlaps])];
          }
        } catch (e) {
          row.error = e.message;
        }
        row.problems = problems;
        row.ms = Date.now() - t0;
        row.ok = !row.error && !row.statsOverlap && problems.length === 0 && (opts.measureOnly || row.cleared === true);
        results.push(row);
        if (!row.ok) console.log(`FAIL ${name} ${snippet.id}: ${JSON.stringify({ ...row, ms: undefined })}`);
      }
    }
    cdp.ws.close();
  } finally {
    await chrome.stop();
    preview.stop();
  }

  if (opts.out) writeFileSync(opts.out, JSON.stringify(results, null, 1));
  for (const name of opts.viewports) {
    const rows = results.filter((r) => r.viewport === name);
    const count = (f) => rows.filter(f).length;
    console.log(
      `${name}: ${count((r) => r.ok)}/${rows.length} ok; stats overlap ${count((r) => r.statsOverlap)}; ` +
        `other HUD overlap ${count((r) => r.overlaps?.some((o) => o !== "code×stats"))}; ` +
        `clipped ${count((r) => r.clipped)}; cleared ${count((r) => r.cleared)}; errors ${count((r) => r.error)}; ` +
        `min gap to stats ${Math.min(...rows.map((r) => r.gapToStats ?? Infinity)).toFixed(1)}px`,
    );
  }
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}

await main();
