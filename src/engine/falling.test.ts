import { describe, expect, it } from "vitest";
import { FallingGame, FLOOR_Y } from "./falling.js";

// Deterministic rng that cycles through the given values.
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("FallingGame", () => {
  it("applies defaults and guards an empty token pool", () => {
    const g = new FallingGame({ tokens: [] });
    expect(g.lives).toBe(3);
    expect(g.locked).toBeNull();
    const t = g.spawn();
    expect(t.text).toBe("x"); // fell back to ["x"]
  });

  it("honors a custom life count", () => {
    expect(new FallingGame({ tokens: ["a"], lives: 1 }).lives).toBe(1);
  });

  it("ignores keys that match no token", () => {
    const g = new FallingGame({ tokens: ["ab"], rng: seqRng([0, 0.5]) });
    g.spawn();
    const out = g.input("z");
    expect(out).toEqual({ correct: false, expected: "", destroyed: null });
  });

  it("locks onto a token and clears it, scoring + leveling", () => {
    const g = new FallingGame({ tokens: ["ab"], rng: seqRng([0, 0.5]) });
    g.score = 290; // near a level boundary
    g.spawn();

    const a = g.input("a");
    expect(a.correct).toBe(true);
    expect(a.destroyed).toBeNull();
    expect(g.locked?.text).toBe("ab");

    const b = g.input("b");
    expect(b.correct).toBe(true);
    expect(b.destroyed?.text).toBe("ab");
    expect(g.score).toBe(310); // 290 + 10 + 2*5
    expect(g.level).toBe(2);
    expect(g.tokens).toHaveLength(0);
    expect(g.locked).toBeNull();
  });

  it("counts a wrong key while locked as a mistake but keeps the lock", () => {
    const g = new FallingGame({ tokens: ["ab"], rng: seqRng([0, 0.5]) });
    g.spawn();
    g.input("a");
    const wrong = g.input("x");
    expect(wrong).toEqual({ correct: false, expected: "b", destroyed: null });
    expect(g.locked?.text).toBe("ab");
    expect(g.locked?.progress).toBe(1);
  });

  it("targets the lowest matching token", () => {
    const g = new FallingGame({
      tokens: ["a1", "a2", "a3"],
      rng: seqRng([0, 0, 0.4, 0, 0.7, 0]),
    });
    g.spawn();
    g.spawn();
    g.spawn();
    g.tokens[0].y = 5;
    g.tokens[1].y = 2; // lowest
    g.tokens[2].y = 8;
    g.input("a");
    expect(g.locked?.text).toBe("a2");
  });

  it("guards token selection when rng returns 1", () => {
    const g = new FallingGame({ tokens: ["only"], rng: seqRng([1, 0.5]) });
    expect(g.spawn().text).toBe("only");
  });

  it("spawns, drops, and ends the game when tokens reach the floor", () => {
    const g = new FallingGame({ tokens: ["ab"], rng: seqRng([0, 0.5]), lives: 1 });

    const first = g.tick(0.1); // spawnTimer starts at 0 -> spawns
    expect(first.spawned).toHaveLength(1);
    expect(first.landed).toHaveLength(0);

    const token = g.tokens[0];
    g.input("a"); // lock it
    expect(g.locked).not.toBeNull();
    token.y = FLOOR_Y + 0.001; // about to land

    const second = g.tick(0.1); // timer now > 0 -> no spawn; token lands
    expect(second.spawned).toHaveLength(0);
    expect(second.landed).toHaveLength(1);
    expect(g.lives).toBe(0);
    expect(g.gameOver).toBe(true);
    expect(g.locked).toBeNull();
  });

  it("loses a life without ending while lives remain", () => {
    const g = new FallingGame({ tokens: ["ab"], rng: seqRng([0, 0.5]) }); // lives 3
    g.tick(0.1); // spawn
    g.tokens[0].y = FLOOR_Y - 1;
    g.tick(0.1); // lands
    expect(g.lives).toBe(2);
    expect(g.gameOver).toBe(false);
  });

  it("stops responding once the game is over", () => {
    const g = new FallingGame({ tokens: ["ab"], rng: seqRng([0, 0.5]), lives: 1 });
    g.tick(0.1);
    g.tokens[0].y = FLOOR_Y - 1;
    g.tick(0.1); // lands -> game over
    expect(g.gameOver).toBe(true);

    expect(g.input("a")).toEqual({ correct: false, expected: "", destroyed: null });
    const after = g.tick(1);
    expect(after).toEqual({ spawned: [], landed: [] });
  });
});
