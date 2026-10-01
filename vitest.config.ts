import { defineConfig } from "vitest/config";

// UI-layer sources: DOM screens/HUD, input capture, mode logic, audio, and the
// game/bootstrap state machines. Tested in jsdom (each test file opts in with
// `// @vitest-environment jsdom`). src/render/** is Three.js/WebGL and cannot
// run in jsdom, so it stays out of coverage.
const UI_GLOBS = [
  "src/ui/**/*.ts",
  "src/input/**/*.ts",
  "src/modes/**/*.ts",
  "src/audio/**/*.ts",
  "src/game.ts",
  "src/main.ts",
  "src/storage.ts",
];

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/engine/**/*.ts", ...UI_GLOBS],
      exclude: ["src/**/*.test.ts", "src/test/**"],
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        // Keep the pure logic layer at 100% (following the existing apps' lib-100% policy)
        "src/engine/**/*.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        // UI layer: set two points under the measured value so it guards
        // regressions without flaking on defensive branches.
        ...Object.fromEntries(
          UI_GLOBS.map((glob) => [glob, { statements: 96, branches: 90, functions: 98, lines: 98 }]),
        ),
      },
    },
  },
});
