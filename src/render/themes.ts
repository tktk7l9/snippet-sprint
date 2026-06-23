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
  sql: { primary: 0x00758f, secondary: 0xf29111 }, // MySQL teal + amber
  bash: { primary: 0x4eaa25, secondary: 0xa5ff90 }, // terminal green
  css: { primary: 0x2965f1, secondary: 0x56c5ff }, // CSS3 blue
  drill: { primary: 0x5cf2ff, secondary: 0xc77dff }, // neutral neon
};
