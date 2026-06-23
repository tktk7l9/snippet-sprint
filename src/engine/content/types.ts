// Content model for the typing snippets. Pure data + type definitions.

export type Language =
  | "ts"
  | "py"
  | "go"
  | "rust"
  | "java"
  | "cpp"
  | "sql"
  | "bash"
  | "css"
  | "drill";

export type Difficulty = "easy" | "medium" | "hard";

export type Category = "basics" | "functions" | "flow" | "async" | "algo" | "drill";

export interface Snippet {
  /** Stable id, used as the key for best-record persistence. */
  readonly id: string;
  readonly language: Language;
  readonly category: Category;
  readonly difficulty: Difficulty;
  /** Short human label shown in the HUD. */
  readonly label: string;
  /** One-line explanation of what the code does (shown under the snippet). */
  readonly description: string;
  /** The exact text to type. Normalized to `\n` line endings, no trailing newline. */
  readonly code: string;
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  ts: "TS/JS",
  py: "Python",
  go: "Go",
  rust: "Rust",
  java: "Java",
  cpp: "C++",
  sql: "SQL",
  bash: "Bash",
  css: "CSS",
  drill: "記号",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  basics: "Basics",
  functions: "Functions",
  flow: "Flow",
  async: "Async",
  algo: "Algorithms",
  drill: "Drill",
};

/** Languages offered on the start screen, in display order. */
export const LANGUAGE_ORDER: readonly Language[] = [
  "ts",
  "py",
  "go",
  "rust",
  "java",
  "cpp",
  "sql",
  "bash",
  "css",
  "drill",
];

/** Difficulty choices offered on the start screen (plus "mixed"). */
export const DIFFICULTY_ORDER: readonly Difficulty[] = ["easy", "medium", "hard"];

/** Category choices offered on the start screen (plus "all"). */
export const CATEGORY_ORDER: readonly Category[] = ["basics", "functions", "flow", "async", "algo"];
