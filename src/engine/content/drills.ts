import type { Snippet } from "./types.js";

// Symbol / operator drills: single-line repetition of the punctuation that
// trips up code typing. Language is "drill", category "drill".
export const DRILLS: Snippet[] = [
  {
    id: "drill-arrows",
    language: "drill",
    category: "drill",
    difficulty: "easy",
    label: "Arrows",
    description: "アロー演算子 => -> の反復練習",
    code: "=> -> => -> => -> => -> => ->",
  },
  {
    id: "drill-compare",
    language: "drill",
    category: "drill",
    difficulty: "easy",
    label: "Comparison",
    description: "比較演算子の反復練習",
    code: "=== !== == != <= >= === !== <= >=",
  },
  {
    id: "drill-logic",
    language: "drill",
    category: "drill",
    difficulty: "medium",
    label: "Logic / optional",
    description: "論理・オプショナル演算子の反復練習",
    code: "&& || ?? ?. && || ?? ?. && ||",
  },
  {
    id: "drill-brackets",
    language: "drill",
    category: "drill",
    difficulty: "medium",
    label: "Brackets",
    description: "各種カッコの組み合わせ練習",
    code: "{} [] () <> {[()]} <[]> ({[]}) []",
  },
  {
    id: "drill-assign",
    language: "drill",
    category: "drill",
    difficulty: "medium",
    label: "Compound assign",
    description: "複合代入演算子の反復練習",
    code: "+= -= *= /= %= **= ||= &&= ??=",
  },
  {
    id: "drill-symbols",
    language: "drill",
    category: "drill",
    difficulty: "hard",
    label: "Punctuation",
    description: "記号キーの反復練習",
    code: "~ ! @ # $ % ^ & * - _ + = | : ;",
  },
  {
    id: "drill-pipes",
    language: "drill",
    category: "drill",
    difficulty: "hard",
    label: "Pipes / paths",
    description: "パイプ・パス系記号の反復練習",
    code: "|> >> << :: -> => |> >> :: ->",
  },
];
