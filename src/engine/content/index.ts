// Snippet loader. Each language lives in its own module under ./languages and
// is fetched with a dynamic import() the first time it is needed, so the start
// screen ships only the catalogue (types.ts) and a round waits only for the
// languages the player picked. Loaded languages stay cached for the session.

import { LANGUAGE_ORDER, type Language, type Snippet } from "./types.js";

export * from "./types.js";

type Loader = () => Promise<{ SNIPPETS: Snippet[] }>;

// One entry per language; the Record type makes a new Language fail to compile
// until its module is wired here.
const LOADERS: Record<Language, Loader> = {
  ts: () => import("./languages/ts.js"),
  py: () => import("./languages/py.js"),
  go: () => import("./languages/go.js"),
  rust: () => import("./languages/rust.js"),
  java: () => import("./languages/java.js"),
  cpp: () => import("./languages/cpp.js"),
  c: () => import("./languages/c.js"),
  zig: () => import("./languages/zig.js"),
  csharp: () => import("./languages/csharp.js"),
  swift: () => import("./languages/swift.js"),
  kotlin: () => import("./languages/kotlin.js"),
  dart: () => import("./languages/dart.js"),
  scala: () => import("./languages/scala.js"),
  ruby: () => import("./languages/ruby.js"),
  php: () => import("./languages/php.js"),
  sql: () => import("./languages/sql.js"),
  r: () => import("./languages/r.js"),
  julia: () => import("./languages/julia.js"),
  bash: () => import("./languages/bash.js"),
  perl: () => import("./languages/perl.js"),
  lua: () => import("./languages/lua.js"),
  elixir: () => import("./languages/elixir.js"),
  haskell: () => import("./languages/haskell.js"),
  erlang: () => import("./languages/erlang.js"),
  ocaml: () => import("./languages/ocaml.js"),
  fsharp: () => import("./languages/fsharp.js"),
  html: () => import("./languages/html.js"),
  css: () => import("./languages/css.js"),
  drill: () => import("./languages/drill.js"),
};

const loaded = new Map<Language, Snippet[]>();
const inflight = new Map<Language, Promise<Snippet[]>>();

/** Fetch one language's snippets (cached; concurrent calls share one request). */
export function loadLanguage(language: Language): Promise<Snippet[]> {
  const have = loaded.get(language);
  if (have) return Promise.resolve(have);
  let pending = inflight.get(language);
  if (!pending) {
    pending = LOADERS[language]()
      .then((m) => {
        loaded.set(language, m.SNIPPETS);
        return m.SNIPPETS;
      })
      .finally(() => inflight.delete(language));
    inflight.set(language, pending);
  }
  return pending;
}

/** Fetch several languages and return their combined pool (see `poolFor`). */
export async function loadLanguages(languages: readonly Language[]): Promise<Snippet[]> {
  await Promise.all(languages.map(loadLanguage));
  return poolFor(languages);
}

/** Whether every one of these languages is already in memory. */
export function isLoaded(languages: readonly Language[]): boolean {
  return languages.every((l) => loaded.has(l));
}

/**
 * The snippets of the given languages that are in memory right now, in
 * LANGUAGE_ORDER. Languages not loaded yet contribute nothing; call
 * `loadLanguages` first when the full pool matters.
 */
export function poolFor(languages: readonly Language[]): Snippet[] {
  const out: Snippet[] = [];
  for (const l of LANGUAGE_ORDER) if (languages.includes(l)) out.push(...(loaded.get(l) ?? []));
  return out;
}

/** Every snippet of every language, fetched in parallel (tests and tooling). */
export function loadAll(): Promise<Snippet[]> {
  return loadLanguages(LANGUAGE_ORDER);
}

/** Fetch every language not in memory yet, one at a time (background warm-up). */
export async function warmAll(): Promise<void> {
  for (const l of LANGUAGE_ORDER) await loadLanguage(l);
}
