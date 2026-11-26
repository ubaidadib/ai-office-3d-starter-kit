// Pure camera maths for the isometric orthographic view (unit-tested; no three.js).
import { GRID } from './floorplan';

/** Camera elevation above the floor plane (≈39°). */
export const ELEV = Math.atan2(1.15, Math.SQRT2);
/** Azimuth of quarter-turn 0: camera to the south-east of the building, as in M1. */
export const BASE_AZ = Math.PI / 4;
export const azFor = (k: number) => BASE_AZ + (((k % 4) + 4) % 4) * (Math.PI / 2);

/** Unit vector from the look-at target towards the camera. */
export function camDir(az: number): [number, number, number] {
  return [Math.sin(az) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(az) * Math.cos(ELEV)];
}

/** Ground-plane directions that move right / up on screen. */
export function screenAxes(az: number): { right: [number, number]; up: [number, number] } {
  return { right: [Math.cos(az), -Math.sin(az)], up: [-Math.sin(az), -Math.cos(az)] };
}

/** Zoom (pixels per world unit) that fits a w × d rectangle (plus wall height h) into the viewport. */
export function fitZoom(w: number, d: number, az: number, vw: number, vh: number, margin = 0.82, h = 3): number {
  const pw = Math.abs(w * Math.cos(az)) + Math.abs(d * Math.sin(az));
  const ph = (Math.abs(w * Math.sin(az)) + Math.abs(d * Math.cos(az))) * Math.sin(ELEV) + h * Math.cos(ELEV);
  return Math.min((vw * margin) / pw, (vh * margin) / ph);
}

export const ZOOM_MIN_FACTOR = 0.6;
export const ZOOM_MAX_FACTOR = 7;

/** Keep the look-at target over (or just around) the building. */
export function clampTarget(x: number, z: number, margin = 3): [number, number] {
  return [Math.min(GRID.w + margin, Math.max(-margin, x)), Math.min(GRID.d + margin, Math.max(-margin, z))];
}

export const clampZoom = (zoom: number, fit: number) =>
  Math.min(fit * ZOOM_MAX_FACTOR, Math.max(fit * ZOOM_MIN_FACTOR, zoom));

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function lerpAngle(a: number, b: number, t: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

/** A wall with outward normal n faces the camera (would hide what is behind it from view). */
export const facesCamera = (n: [number, number], az: number) => n[0] * Math.sin(az) + n[1] * Math.cos(az) > 0.01;

/**
 * Trackpad vs mouse-wheel heuristic. Trackpads send small pixel deltas and often a
 * horizontal component; a mouse wheel sends large vertical steps. Pinch arrives with ctrlKey.
 */
export function wheelIntent(e: { deltaX: number; deltaY: number; deltaMode: number; ctrlKey: boolean }): 'pinch' | 'pan' | 'zoom' {
  if (e.ctrlKey) return 'pinch';
  if (e.deltaMode !== 0) return 'zoom';
  if (Math.abs(e.deltaX) > 0.5) return 'pan';
  return Math.abs(e.deltaY) >= 50 ? 'zoom' : 'pan';
}
