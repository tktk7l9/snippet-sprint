import type { Language } from "../engine/content/types.js";

export interface Theme {
  /** Main background hue (stars / rings / fog). */
  readonly primary: number;
  /** Accent hue (the wireframe core). */
  readonly secondary: number;
}

/** Neutral neon, used on the menu and for symbol drills. */
export const DEFAULT_THEME: Theme = { primary: 0x5cf2ff, secondary: 0xc77dff };

/** Per-language palette, loosely matching each language's brand colors. */
export const LANGUAGE_THEME: Record<Language, Theme> = {
  ts: { primary: 0x3178c6, secondary: 0x6fb3ff }, // TypeScript blue
  py: { primary: 0x4b8bbe, secondary: 0xffd43b }, // Python blue + yellow
  go: { primary: 0x00add8, secondary: 0x7fd5ea }, // Go gopher cyan
  rust: { primary: 0xe43717, secondary: 0xf7a07b }, // Rust orange
  java: { primary: 0xe76f00, secondary: 0x5382a1 }, // Java orange + blue
  cpp: { primary: 0x00599c, secondary: 0x659ad2 }, // C++ blue
  c: { primary: 0xa8b9cc, secondary: 0x5c6bc0 }, // C grey-blue
  zig: { primary: 0xf7a41d, secondary: 0xffd27f }, // Zig amber
  csharp: { primary: 0x512bd4, secondary: 0x9d7be8 }, // .NET purple
  swift: { primary: 0xf05138, secondary: 0xfb9c86 }, // Swift orange
  kotlin: { primary: 0x7f52ff, secondary: 0xf88909 }, // Kotlin purple + orange
  dart: { primary: 0x0175c2, secondary: 0x13b9fd }, // Dart blue + Flutter sky
  scala: { primary: 0xdc322f, secondary: 0xff8a80 }, // Scala red
  ruby: { primary: 0xcc342d, secondary: 0xe8857e }, // Ruby red
  php: { primary: 0x777bb4, secondary: 0xb0b3d6 }, // PHP purple
  sql: { primary: 0x00758f, secondary: 0xf29111 }, // MySQL teal + amber
  r: { primary: 0x276dc3, secondary: 0xa9b1bc }, // R blue + grey ring
  julia: { primary: 0x389826, secondary: 0x9558b2 }, // Julia logo dots: green + purple
  bash: { primary: 0x4eaa25, secondary: 0xa5ff90 }, // terminal green
  perl: { primary: 0x4d5ea8, secondary: 0xd4b483 }, // Perl onion blue + camel sand
  lua: { primary: 0x2b3fd0, secondary: 0xb9c2ff }, // Lua navy + moon
  elixir: { primary: 0x6e4a7e, secondary: 0xc9a5e8 }, // Elixir drop violet + lavender
  haskell: { primary: 0x5e5086, secondary: 0x8f4e8b }, // Haskell logo slate + lambda magenta
  erlang: { primary: 0xa90533, secondary: 0xf2a7b8 }, // Erlang logo red + rose
  ocaml: { primary: 0xec6813, secondary: 0xf9c38b }, // OCaml camel orange + sand
  fsharp: { primary: 0x378bba, secondary: 0x30b9db }, // F# logo blues
  html: { primary: 0xe34f26, secondary: 0xf06529 }, // HTML5 orange
  css: { primary: 0x2965f1, secondary: 0x56c5ff }, // CSS3 blue
  drill: { primary: 0x5cf2ff, secondary: 0xc77dff }, // neutral neon
};
