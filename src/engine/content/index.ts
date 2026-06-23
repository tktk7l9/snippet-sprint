import { CODE_SNIPPETS } from "./snippets.js";
import { ALGORITHMS } from "./algorithms.js";
import { DRILLS } from "./drills.js";

export * from "./types.js";
export { CODE_SNIPPETS } from "./snippets.js";
export { ALGORITHMS } from "./algorithms.js";
export { DRILLS } from "./drills.js";

/** All playable snippets: language samples, algorithms, and symbol drills. */
export const SNIPPETS = [...CODE_SNIPPETS, ...ALGORITHMS, ...DRILLS];
