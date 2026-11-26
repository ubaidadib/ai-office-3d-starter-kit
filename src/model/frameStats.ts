// Frame-interval statistics for the performance evidence (diagnostics only; no effect on rendering).

/** Movement rendering cadence. Camera transitions keep their own 30 fps cadence (CameraController). */
export const MOVEMENT_FPS = 20;
export const CAMERA_TWEEN_FPS = 30;
/** Presentation mode renders every display frame; this is the target, not a measured value. */
export const PRESENT_TARGET_FPS = 60;

export interface FrameStats { frames: number; fps: number; avgMs: number; medianMs: number; p95Ms: number; maxMs: number; over100ms: number }

/** Intervals between consecutive frame timestamps (ms) → summary. Returns null with fewer than 2 frames. */
export function frameStats(times: readonly number[]): FrameStats | null {
  if (times.length < 2) return null;
  const iv: number[] = [];
  for (let i = 1; i < times.length; i++) iv.push(times[i] - times[i - 1]);
  const s = [...iv].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const span = times[times.length - 1] - times[0];
  const r = (x: number) => Math.round(x * 10) / 10;
  return {
    frames: times.length, fps: r((iv.length / span) * 1000), avgMs: r(span / iv.length),
    medianMs: r(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2),
    p95Ms: r(q(0.95)), maxMs: r(s[s.length - 1]), over100ms: iv.filter((x) => x > 100).length,
  };
}

/** Bounded recorder: frame timestamps from a reset point (steady state, after warm-up). */
export class FrameRecorder {
  private t: number[] = [];
  constructor(private readonly cap = 4000) {}
  reset() { this.t = []; }
  push(now: number) { if (this.t.length < this.cap) this.t.push(now); }
  stats() { return frameStats(this.t); }
}
