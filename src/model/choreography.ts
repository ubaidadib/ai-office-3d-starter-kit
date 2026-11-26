// Deterministic, time-based choreography for the four SIMULATED role figures.
//
// Everything a figure does is a pure function of the show clock: sample(schedule, actor, t).
// There is no per-frame state, so the show can be paused, restarted and replayed identically
// for recording, and it can be unit-tested without a browser.
//
// One loop of the show:  desks → walk to the Central Meeting Room → sit → meeting gestures →
// walk back → desks. It is staged movement. It is not driven by records and represents no AI activity.
// Renderer-agnostic: no three.js imports here.
import { buildNavGrid, type NavGrid } from './floorplan';
import { findPath, lineClear, smoothPath, toCell } from './pathfinding';
import { ACTORS, ACTOR_IDS, castSeat, type ActorId } from './cast';

export interface Pt { x: number; z: number }

export const WALK_SPEED = 2.9;          // units/s = 1.45 m/s (brisk office walk)
const RAMP = 0.35;                      // s to reach walking speed, and to stop
const TURN_S = 0.4;                     // turn to face the chair
export const SIT_S = 0.85;              // sit down / stand up
const HEADING_WINDOW = 0.5;             // units looked behind/ahead when computing the walking direction
const MIN_GAP = 1.25;                   // closest two walking figures may come (units = 0.63 m)

/** Clip lengths in the Kenney rig (seconds), used for deterministic clip phase. */
export const CLIP_S = { idle: 4 / 3, walk: 2 / 3, nod: 2 / 3, reach: 2 / 3 } as const;
/** Distance covered by one walk-cycle. The walk clip is advanced by distance, so feet do not slide. */
export const STRIDE = 1.95;

const DESK_PHASE = 8;                   // s at the desks before the first figure leaves
const ARRIVAL_GAP = 1.1;                // s between figures sitting down in the meeting
const MEETING_HOLD = 9;                 // s everyone is seated together
const LEAVE_GAP = 0.9;
const TAIL = 24;                        // s back at the desks before the loop restarts

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const smooth = (u: number) => { const c = clamp01(u); return c * c * (3 - 2 * c); };
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const lerpAngle = (a: number, b: number, u: number) => a + angleDelta(a, b) * u;

// ---------------------------------------------------------------- paths

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.z - a.z);

/** Replace sharp turning points by short quadratic curves, wherever the curve stays on legal cells. */
export function roundCorners(nav: NavGrid, pts: Pt[], radius = 0.9): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
    const la = dist(a, b), lc = dist(b, c);
    const r1 = Math.min(radius, la / 2), r2 = Math.min(radius, lc / 2);
    if (r1 < 0.15 || r2 < 0.15) { out.push(b); continue; }
    const p1 = { x: b.x + ((a.x - b.x) / la) * r1, z: b.z + ((a.z - b.z) / la) * r1 };
    const p2 = { x: b.x + ((c.x - b.x) / lc) * r2, z: b.z + ((c.z - b.z) / lc) * r2 };
    const curve: Pt[] = [p1];
    for (const u of [0.25, 0.5, 0.75]) {
      const w = 1 - u;
      curve.push({ x: w * w * p1.x + 2 * w * u * b.x + u * u * p2.x, z: w * w * p1.z + 2 * w * u * b.z + u * u * p2.z });
    }
    curve.push(p2);
    const chain = [a, ...curve];
    const ok = chain.every((p, k) => k === 0 || lineClear(nav, chain[k - 1].x, chain[k - 1].z, p.x, p.z, 0.1));
    if (ok) out.push(...curve); else out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** A walkable, smoothed path between two free world points. Throws if there is none. */
export function planPath(nav: NavGrid, from: Pt, to: Pt): Pt[] {
  const cells = findPath(nav, toCell(from.x, from.z), toCell(to.x, to.z));
  if (!cells) throw new Error(`no path (${from.x},${from.z}) -> (${to.x},${to.z})`);
  if (cells.length === 1) return [{ ...from }, { ...to }];
  const pts = cells.map((c) => ({ x: c.x + 0.5, z: c.z + 0.5 }));
  pts[0] = { ...from };
  pts[pts.length - 1] = { ...to };
  return roundCorners(nav, smoothPath(nav, pts));
}

interface Walk { pts: Pt[]; cum: number[]; len: number }
function makeWalk(pts: Pt[]): Walk {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { pts, cum, len: cum[cum.length - 1] };
}
function pointAt(w: Walk, s: number): Pt {
  const d = Math.min(w.len, Math.max(0, s));
  let i = 1;
  while (i < w.cum.length - 1 && w.cum[i] < d) i++;
  const seg = w.cum[i] - w.cum[i - 1] || 1e-6;
  const u = (d - w.cum[i - 1]) / seg;
  return { x: lerp(w.pts[i - 1].x, w.pts[i].x, u), z: lerp(w.pts[i - 1].z, w.pts[i].z, u) };
}
function headingAt(w: Walk, s: number): number {
  const a = pointAt(w, s - HEADING_WINDOW), b = pointAt(w, s + HEADING_WINDOW);
  return Math.atan2(b.x - a.x, b.z - a.z);
}
export const walkDuration = (len: number) => (len <= WALK_SPEED * RAMP ? Math.max(0.5, (2 * len) / WALK_SPEED) : len / WALK_SPEED + RAMP);
/** Distance covered `tau` seconds into a walk of `len` units: ease in, constant speed, ease out. */
export function distanceAt(len: number, tau: number): number {
  const dur = walkDuration(len);
  if (len <= WALK_SPEED * RAMP) return len * smooth(tau / dur);
  const acc = WALK_SPEED / RAMP;
  if (tau <= 0) return 0;
  if (tau >= dur) return len;
  if (tau < RAMP) return 0.5 * acc * tau * tau;
  if (tau > dur - RAMP) { const r = dur - tau; return len - 0.5 * acc * r * r; }
  return 0.5 * WALK_SPEED * RAMP + WALK_SPEED * (tau - RAMP);
}

// ---------------------------------------------------------------- timeline

export type Phase = 'desk' | 'to-meeting' | 'meeting' | 'returning';
type Seg =
  | { kind: 'seated'; t0: number; t1: number; seat: string; phase: Phase }
  | { kind: 'standUp'; t0: number; t1: number; seat: string; phase: Phase }
  | { kind: 'walk'; t0: number; t1: number; walk: Walk; faceFrom: number; phase: Phase }
  | { kind: 'turn'; t0: number; t1: number; at: Pt; from: number; to: number; seat: string; phase: Phase }
  | { kind: 'sitDown'; t0: number; t1: number; seat: string; phase: Phase };

export interface GestureCue { t: number; kind: 'nod' | 'reach'; reps: number }
export interface LookCue { t: number; yaw: number }

export interface ActorTrack { segs: Seg[]; gestures: GestureCue[]; looks: LookCue[]; outPath: Pt[]; backPath: Pt[] }
export interface Schedule {
  loop: number;
  cues: { firstDeparture: number; lastSeated: number; meetingEnd: number; lastHome: number; departures: Record<ActorId, number>; seatedAt: Record<ActorId, number> };
  tracks: Record<ActorId, ActorTrack>;
}

/** Segments for: seated at `from` → stand → walk → turn → sit at `to`, leaving at `depart`. Returns the time seated. */
function leg(fromSeat: string, toSeat: string, path: Pt[], depart: number, phase: Phase): { segs: Seg[]; seatedAt: number } {
  const to = castSeat(toSeat);
  const walk = makeWalk(path);
  const tStand = depart + SIT_S;
  const tWalk = tStand + walkDuration(walk.len);
  const tTurn = tWalk + TURN_S;
  const tSit = tTurn + SIT_S;
  const endHeading = headingAt(walk, walk.len);
  return {
    segs: [
      { kind: 'standUp', t0: depart, t1: tStand, seat: fromSeat, phase },
      { kind: 'walk', t0: tStand, t1: tWalk, walk, faceFrom: castSeat(fromSeat).face, phase },
      { kind: 'turn', t0: tWalk, t1: tTurn, at: path[path.length - 1], from: endHeading, to: to.face, seat: toSeat, phase },
      { kind: 'sitDown', t0: tTurn, t1: tSit, seat: toSeat, phase },
    ],
    seatedAt: tSit,
  };
}
const legDuration = (path: Pt[]) => SIT_S + walkDuration(makeWalk(path).len) + TURN_S + SIT_S;

interface Pose { x: number; z: number; face: number; k: number; seat: string | null; walk: number; dist: number; phase: Phase }

function poseInSeg(s: Seg, t: number): Pose {
  if (s.kind === 'seated') { const c = castSeat(s.seat); return { x: c.x, z: c.z, face: c.face, k: 1, seat: s.seat, walk: 0, dist: 0, phase: s.phase }; }
  if (s.kind === 'standUp' || s.kind === 'sitDown') {
    const c = castSeat(s.seat);
    const u = smooth((t - s.t0) / (s.t1 - s.t0));
    const k = s.kind === 'standUp' ? 1 - u : u;
    return { x: lerp(c.approach.x, c.x, k), z: lerp(c.approach.z, c.z, k), face: c.face, k, seat: s.seat, walk: 0, dist: 0, phase: s.phase };
  }
  if (s.kind === 'turn') {
    return { x: s.at.x, z: s.at.z, face: lerpAngle(s.from, s.to, smooth((t - s.t0) / (s.t1 - s.t0))), k: 0, seat: s.seat, walk: 0, dist: 0, phase: s.phase };
  }
  const tau = t - s.t0, dur = s.t1 - s.t0;
  const d = distanceAt(s.walk.len, tau);
  const p = pointAt(s.walk, d);
  const face = lerpAngle(s.faceFrom, headingAt(s.walk, d), smooth(tau / 0.45));
  const walk = Math.min(smooth(tau / 0.3), smooth((dur - tau) / 0.3));
  return { x: p.x, z: p.z, face, k: 0, seat: null, walk, dist: d, phase: s.phase };
}

function poseAt(segs: Seg[], t: number): Pose {
  // Segments are contiguous and sorted; a binary search keeps sampling cheap (4 figures × 60 fps).
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (t < segs[mid].t1) hi = mid; else lo = mid + 1; }
  return poseInSeg(segs[lo], t);
}

/** True if two partial tracks ever bring two figures too close while either is on its feet. */
function conflicts(a: Seg[], b: Seg[]): boolean {
  const t0 = Math.max(a[0].t0, b[0].t0), t1 = Math.min(a[a.length - 1].t1, b[b.length - 1].t1);
  for (let t = t0; t <= t1; t += 0.1) {
    const p = poseAt(a, t), q = poseAt(b, t);
    if (p.k >= 1 && q.k >= 1) continue;
    if (Math.hypot(p.x - q.x, p.z - q.z) < MIN_GAP) return true;
  }
  return false;
}

/** Hold a seat before and after a leg so that conflict checks see the figure sitting there. */
const padded = (segs: Seg[], fromSeat: string, toSeat: string, phase: Phase): Seg[] => [
  { kind: 'seated', t0: segs[0].t0 - 60, t1: segs[0].t0, seat: fromSeat, phase },
  ...segs,
  { kind: 'seated', t0: segs[segs.length - 1].t1, t1: segs[segs.length - 1].t1 + 60, seat: toSeat, phase },
];

/** Order in which the figures sit down in the meeting, and stand up afterwards. */
const ARRIVAL_ORDER: readonly ActorId[] = ['coo', 'admissions', 'marketing', 'bizdev'];
const LEAVE_ORDER: readonly ActorId[] = ['bizdev', 'admissions', 'marketing', 'coo'];

export function buildSchedule(nav: NavGrid = buildNavGrid()): Schedule {
  const out = {} as Record<ActorId, Pt[]>;
  for (const id of ACTOR_IDS) {
    const a = ACTORS[id];
    out[id] = planPath(nav, castSeat(a.homeSeat).approach, castSeat(a.meetingSeat).approach);
  }
  const back = Object.fromEntries(ACTOR_IDS.map((id) => [id, [...out[id]].reverse()])) as Record<ActorId, Pt[]>;

  // 1. Departures are timed backwards from staggered arrival times, then delayed until nobody collides.
  const rawDepart = {} as Record<ActorId, number>;
  ARRIVAL_ORDER.forEach((id, i) => { rawDepart[id] = i * ARRIVAL_GAP - legDuration(out[id]); });
  const shift = DESK_PHASE - Math.min(...ACTOR_IDS.map((id) => rawDepart[id]));
  const outLegs = {} as Record<ActorId, { segs: Seg[]; seatedAt: number }>;
  const departures = {} as Record<ActorId, number>;
  const accepted: Seg[][] = [];
  for (const id of ARRIVAL_ORDER) {
    const a = ACTORS[id];
    for (let delay = 0; ; delay += 0.3) {
      if (delay > 12) throw new Error('could not schedule ' + id + ' without a collision');
      const l = leg(a.homeSeat, a.meetingSeat, out[id], rawDepart[id] + shift + delay, 'to-meeting');
      const p = padded(l.segs, a.homeSeat, a.meetingSeat, 'to-meeting');
      if (accepted.some((o) => conflicts(p, o))) continue;
      outLegs[id] = l; departures[id] = l.segs[0].t0; accepted.push(p);
      break;
    }
  }
  const lastSeated = Math.max(...ACTOR_IDS.map((id) => outLegs[id].seatedAt));
  const meetingEnd = lastSeated + MEETING_HOLD;

  // 2. The same on the way back.
  const backLegs = {} as Record<ActorId, { segs: Seg[]; seatedAt: number }>;
  const acceptedBack: Seg[][] = [];
  LEAVE_ORDER.forEach((id, i) => {
    const a = ACTORS[id];
    for (let delay = 0; ; delay += 0.3) {
      if (delay > 12) throw new Error('could not schedule the return of ' + id + ' without a collision');
      const l = leg(a.meetingSeat, a.homeSeat, back[id], meetingEnd + i * LEAVE_GAP + delay, 'returning');
      const p = padded(l.segs, a.meetingSeat, a.homeSeat, 'returning');
      if (acceptedBack.some((o) => conflicts(p, o))) continue;
      backLegs[id] = l; acceptedBack.push(p);
      break;
    }
  });
  const lastHome = Math.max(...ACTOR_IDS.map((id) => backLegs[id].seatedAt));
  const loop = Math.ceil(lastHome + TAIL);

  // 3. Meeting gestures: a simple round where one figure gestures and the others turn their heads to it.
  const speakers: { id: ActorId; at: number }[] = [
    { id: 'coo', at: lastSeated + 0.5 }, { id: 'marketing', at: lastSeated + 2.3 },
    { id: 'bizdev', at: lastSeated + 4.1 }, { id: 'admissions', at: lastSeated + 5.9 },
  ];
  const yawTo = (from: ActorId, to: ActorId) => {
    const a = castSeat(ACTORS[from].meetingSeat), b = castSeat(ACTORS[to].meetingSeat);
    return Math.max(-1.05, Math.min(1.05, angleDelta(a.face, Math.atan2(b.x - a.x, b.z - a.z))));
  };

  const tracks = {} as Record<ActorId, ActorTrack>;
  ACTOR_IDS.forEach((id, n) => {
    const a = ACTORS[id];
    const o = outLegs[id], b = backLegs[id];
    const segs: Seg[] = [
      { kind: 'seated', t0: 0, t1: o.segs[0].t0, seat: a.homeSeat, phase: 'desk' },
      ...o.segs,
      { kind: 'seated', t0: o.seatedAt, t1: b.segs[0].t0, seat: a.meetingSeat, phase: 'meeting' },
      ...b.segs,
      { kind: 'seated', t0: b.seatedAt, t1: loop, seat: a.homeSeat, phase: 'desk' },
    ];
    const gestures: GestureCue[] = [];
    const looks: LookCue[] = [{ t: 0, yaw: 0 }];
    // At the desk: an occasional reach towards the desk, at a different moment for each figure.
    for (let t = 2.2 + n * 1.7; t < o.segs[0].t0 - 1.2; t += 6.5) gestures.push({ t, kind: 'reach', reps: 1 });
    for (let t = b.seatedAt + 2.5 + n * 1.3; t < loop - 1.5; t += 7.5) gestures.push({ t, kind: 'reach', reps: 1 });
    // In the meeting: gesture on the figure's own turn, nod near the end, look at whoever gestures.
    for (const s of speakers) {
      if (s.id === id) { gestures.push({ t: s.at, kind: 'reach', reps: 2 }); looks.push({ t: s.at - 0.2, yaw: 0 }); }
      else if (s.at > o.seatedAt) looks.push({ t: s.at, yaw: yawTo(id, s.id) });
    }
    gestures.push({ t: Math.min(meetingEnd - 1.6, lastSeated + 7.3 + (n % 2) * 0.2), kind: 'nod', reps: 2 });
    looks.push({ t: b.segs[0].t0 - 0.5, yaw: 0 });
    looks.sort((p, q) => p.t - q.t);
    gestures.sort((p, q) => p.t - q.t);
    tracks[id] = { segs, gestures, looks, outPath: out[id], backPath: back[id] };
  });

  const seatedAt = Object.fromEntries(ACTOR_IDS.map((id) => [id, outLegs[id].seatedAt])) as Record<ActorId, number>;
  return { loop, cues: { firstDeparture: Math.min(...ACTOR_IDS.map((id) => departures[id])), lastSeated, meetingEnd, lastHome, departures, seatedAt }, tracks };
}

// ---------------------------------------------------------------- sampling

export interface Sample extends Pose {
  /** Overlay gesture weights (0–1) and the local clip time to show. */
  nod: number; nodT: number; reach: number; reachT: number;
  /** Extra head turn (radians, + = to the figure's left). */
  look: number;
  /** Time inside the loop that was sampled. */
  t: number;
}

const wrap = (t: number, loop: number) => ((t % loop) + loop) % loop;

function gestureAt(cues: GestureCue[], t: number, kind: 'nod' | 'reach'): { w: number; tau: number } {
  for (const c of cues) {
    if (c.kind !== kind) continue;
    const len = CLIP_S[kind] * c.reps;
    if (t < c.t || t > c.t + len) continue;
    const tau = t - c.t;
    return { w: Math.min(smooth(tau / 0.18), smooth((len - tau) / 0.22)), tau: tau % CLIP_S[kind] };
  }
  return { w: 0, tau: 0 };
}

function lookAt(cues: LookCue[], t: number, seed: number, loop: number): number {
  let i = 0;
  while (i < cues.length - 1 && cues[i + 1].t <= t) i++;
  const cur = cues[i], prev = cues[Math.max(0, i - 1)];
  const yaw = lerp(i === 0 ? cur.yaw : prev.yaw, cur.yaw, smooth((t - cur.t) / 0.55));
  // A slow, small sway so a seated figure is never perfectly still. Whole cycles per loop: no jump when the show restarts.
  const w = (2 * Math.PI) / loop;
  return yaw + 0.07 * Math.sin(t * w * Math.round(0.7 / w) + seed * 1.9) + 0.04 * Math.sin(t * w * Math.round(1.9 / w) + seed);
}

/** Where a figure is and what it is doing at show time `t` (any real number; the show loops). */
export function sample(schedule: Schedule, id: ActorId, t: number): Sample {
  const tt = wrap(t, schedule.loop);
  const tr = schedule.tracks[id];
  const pose = poseAt(tr.segs, tt);
  const seated = pose.k;   // gestures and head turns only while (mostly) seated
  const n = ACTOR_IDS.indexOf(id);
  const nod = gestureAt(tr.gestures, tt, 'nod'), reach = gestureAt(tr.gestures, tt, 'reach');
  return { ...pose, nod: nod.w * seated, nodT: nod.tau, reach: reach.w * seated, reachT: reach.tau, look: lookAt(tr.looks, tt, n, schedule.loop) * seated, t: tt };
}

/** The show is built once; it is fully determined by the floor plan and the furniture layout. */
let cached: Schedule | null = null;
export const getSchedule = (): Schedule => (cached ??= buildSchedule());
