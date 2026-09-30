// Fits the app frame to the visual viewport so a soft keyboard never covers
// the snippet or the progress bar (SHIG 30, 85, 82). Pure so it is testable.

export interface VisualViewportLike {
  readonly height: number;
  readonly offsetTop: number;
  readonly scale: number;
}

export interface Frame {
  readonly height: number;
  readonly top: number;
}

/** Scale above which the user is pinch-zooming and the layout must not follow. */
const ZOOM_EPSILON = 0.01;

/** The frame to apply, or null when the layout should stay at full size. */
export function fitFrame(vv: VisualViewportLike): Frame | null {
  if (Math.abs(vv.scale - 1) > ZOOM_EPSILON) return null;
  return { height: Math.round(vv.height), top: Math.round(vv.offsetTop) };
}
