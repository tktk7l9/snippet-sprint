import type { Difficulty } from "./types.js";

export interface Token {
  readonly text: string;
  readonly difficulty: Difficulty;
}

// Short code fragments for the Falling Tokens arcade mode. Language-agnostic
// (mostly C-family) keywords and punctuation that trip up code typing.
export const TOKENS: Token[] = [
  // easy
  { text: "=>", difficulty: "easy" },
  { text: "{}", difficulty: "easy" },
  { text: "[]", difficulty: "easy" },
  { text: "()", difficulty: "easy" },
  { text: "===", difficulty: "easy" },
  { text: "const", difficulty: "easy" },
  { text: "let", difficulty: "easy" },
  { text: "return", difficulty: "easy" },
  { text: "i++", difficulty: "easy" },
  { text: "null", difficulty: "easy" },
  { text: "true", difficulty: "easy" },
  { text: "if", difficulty: "easy" },

  // medium
  { text: ".map(", difficulty: "medium" },
  { text: ".filter(", difficulty: "medium" },
  { text: "async", difficulty: "medium" },
  { text: "await", difficulty: "medium" },
  { text: "() =>", difficulty: "medium" },
  { text: "=> {", difficulty: "medium" },
  { text: "?.", difficulty: "medium" },
  { text: "??", difficulty: "medium" },
  { text: "&&", difficulty: "medium" },
  { text: "||", difficulty: "medium" },
  { text: "...x", difficulty: "medium" },
  { text: "});", difficulty: "medium" },

  // hard
  { text: "useState(", difficulty: "hard" },
  { text: "forEach(", difficulty: "hard" },
  { text: "instanceof", difficulty: "hard" },
  { text: "=> ({", difficulty: "hard" },
  { text: ".reduce(", difficulty: "hard" },
  { text: "throw new", difficulty: "hard" },
  { text: "?.length", difficulty: "hard" },
  { text: "??=", difficulty: "hard" },
  { text: "typeof", difficulty: "hard" },
];

/** Token strings matching a difficulty ("mixed" returns all). */
export function tokenPool(difficulty: Difficulty | "mixed"): string[] {
  return TOKENS.filter(
    (t) => difficulty === "mixed" || t.difficulty === difficulty,
  ).map((t) => t.text);
}
