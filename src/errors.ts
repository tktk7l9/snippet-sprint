// Errors the bootstrap tells apart to explain a failed START. Kept free of
// imports so main.ts can check for them without pulling in the game chunk.

/** The browser could not create a WebGL context, so the 3D stage cannot run. */
export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("WebGL context could not be created", { cause });
    this.name = "WebGLUnavailableError";
  }
}
