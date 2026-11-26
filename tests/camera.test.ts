import { describe, expect, it } from 'vitest';
import { BASE_AZ, ZOOM_MAX_FACTOR, ZOOM_MIN_FACTOR, azFor, camDir, clampTarget, clampZoom, easeInOutCubic, facesCamera, fitZoom,
  lerpAngle, screenAxes, wheelIntent } from '../src/model/cameraMath';
import { GRID } from '../src/model/floorplan';

describe('camera maths (A11)', () => {
  it('rotates in exact 90° steps and wraps', () => {
    expect(azFor(0)).toBeCloseTo(BASE_AZ);
    expect(azFor(1) - azFor(0)).toBeCloseTo(Math.PI / 2);
    expect(azFor(4)).toBeCloseTo(azFor(0));
    expect(azFor(-1)).toBeCloseTo(azFor(3));
  });
  it('keeps the camera above the floor and pointing at the target', () => {
    for (let k = 0; k < 4; k++) { const d = camDir(azFor(k)); expect(d[1]).toBeGreaterThan(0.5); expect(Math.hypot(...d)).toBeCloseTo(1); }
  });
  it('screen axes are perpendicular unit ground vectors for every rotation', () => {
    for (let k = 0; k < 4; k++) {
      const { right, up } = screenAxes(azFor(k));
      expect(right[0] * up[0] + right[1] * up[1]).toBeCloseTo(0);
      expect(Math.hypot(...right)).toBeCloseTo(1);
    }
  });
  it('clamps the target so the building cannot be lost', () => {
    expect(clampTarget(-500, 900)).toEqual([-3, GRID.d + 3]);
    expect(clampTarget(10, 10)).toEqual([10, 10]);
  });
  it('clamps zoom to sensible limits relative to the overview', () => {
    expect(clampZoom(1, 10)).toBe(10 * ZOOM_MIN_FACTOR);
    expect(clampZoom(1e6, 10)).toBe(10 * ZOOM_MAX_FACTOR);
  });
  it('fits the whole building into the viewport at every rotation', () => {
    for (let k = 0; k < 4; k++) {
      const z = fitZoom(GRID.w, GRID.d, azFor(k), 1440, 900);
      expect(z).toBeGreaterThan(5);
      const az = azFor(k);
      expect((Math.abs(GRID.w * Math.cos(az)) + Math.abs(GRID.d * Math.sin(az))) * z).toBeLessThanOrEqual(1440);
    }
    expect(fitZoom(8, 8, azFor(0), 1440, 900)).toBeGreaterThan(fitZoom(GRID.w, GRID.d, azFor(0), 1440, 900));
  });
  it('wall fading: a wall faces the camera only when its normal points towards it', () => {
    const az = azFor(0); // camera south-east
    expect(facesCamera([0, 1], az)).toBe(true);   // south-facing wall
    expect(facesCamera([0, -1], az)).toBe(false);
    expect(facesCamera([1, 0], azFor(2))).toBe(false);
  });
  it('easing and angle interpolation behave', () => {
    expect(easeInOutCubic(0)).toBe(0); expect(easeInOutCubic(1)).toBe(1); expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);   // shortest way round
  });
  it('trackpad vs mouse vs pinch intent', () => {
    expect(wheelIntent({ deltaX: 0, deltaY: -3, deltaMode: 0, ctrlKey: true })).toBe('pinch');
    expect(wheelIntent({ deltaX: 4, deltaY: 2, deltaMode: 0, ctrlKey: false })).toBe('pan');
    expect(wheelIntent({ deltaX: 0, deltaY: 12, deltaMode: 0, ctrlKey: false })).toBe('pan');
    expect(wheelIntent({ deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false })).toBe('zoom');
    expect(wheelIntent({ deltaX: 0, deltaY: 3, deltaMode: 1, ctrlKey: false })).toBe('zoom');
  });
});
