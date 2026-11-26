import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMERA_TWEEN_FPS, FrameRecorder, MOVEMENT_FPS, frameStats } from '../src/model/frameStats';

describe('frame cadence', () => {
  it('movement renders at 20 fps; camera transitions keep 30 fps', () => {
    expect(MOVEMENT_FPS).toBe(20);
    expect(CAMERA_TWEEN_FPS).toBe(30);
  });
  it('the frame driver and camera tween use those constants (no stray hard-coded rates)', () => {
    const scene = readFileSync('src/scene/OfficeScene.tsx', 'utf8');
    const cam = readFileSync('src/scene/CameraController.tsx', 'utf8');
    expect(scene).toMatch(/1000 \/ MOVEMENT_FPS/);
    expect(cam).toMatch(/1000 \/ CAMERA_TWEEN_FPS/);
    expect(scene + cam).not.toMatch(/1000 \/ \d+/);
  });
});

describe('frameStats', () => {
  it('summarises steady 50 ms intervals', () => {
    const t = Array.from({ length: 21 }, (_, i) => 1000 + i * 50);
    expect(frameStats(t)).toEqual({ frames: 21, fps: 20, avgMs: 50, medianMs: 50, p95Ms: 50, maxMs: 50, over100ms: 0 });
  });
  it('separates an occasional delay (max) from the sustained rate (median)', () => {
    const t = [0, 50, 100, 150, 330, 380, 430];
    const s = frameStats(t)!;
    expect(s.medianMs).toBe(50);
    expect(s.maxMs).toBe(180);
    expect(s.over100ms).toBe(1);
  });
  it('returns null with fewer than two frames; recorder resets', () => {
    expect(frameStats([5])).toBeNull();
    const r = new FrameRecorder(3);
    [0, 50, 100, 150].forEach((x) => r.push(x));
    expect(r.stats()!.frames).toBe(3);
    r.reset();
    expect(r.stats()).toBeNull();
  });
});
