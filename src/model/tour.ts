// Guided camera tours. Pure maths (unit-tested; no three.js).
//
// A tour is a list of shots. The camera state at tour time t is a pure function of
// (tour, t, viewport), so a tour is repeatable frame for frame, can be paused and restarted,
// and frames itself correctly in landscape and in vertical capture frames.
// While a tour runs, the staged show is slaved to it:  show time = tour.showOffset + t.
import { GRID, roomById } from './floorplan';
import { BASE_AZ, easeInOutCubic, fitZoom } from './cameraMath';
import { ACTOR_IDS, type ActorId } from './cast';
import { getSchedule, sample, type Schedule } from './choreography';
import config from '../../office.config';
import { t, ui } from '../i18n';

// Caption text comes from office.config.ts, in the page language.
const room = (id: keyof typeof config.rooms) => t(config.rooms[id]);
const C = config.captions;
const role = (id: ActorId) => `${t(config.roles[id].title)} · ${t(C.aiRole)}`;
const opening = () => `${t(config.company.name)} · ${t(config.company.headquarters)}`;

export interface CamState { x: number; z: number; zoom: number; az: number }

export type CamSpec =
  | { kind: 'overview'; margin?: number }
  | { kind: 'room'; id: string; margin?: number }
  | { kind: 'region'; x0: number; z0: number; x1: number; z1: number; margin?: number }
  /** Frames all four figures, tightening as they come together. */
  | { kind: 'group'; pad: number; minW: number; minD: number; margin?: number }
  | { kind: 'actor'; id: ActorId; w: number; d: number; margin?: number };

export interface Shot {
  id: string;
  /** Lower-third caption. Static UI text only: never record text, never a claim of live activity. */
  title: string;
  sub?: string;
  /** Seconds, including the move into the shot. */
  dur: number;
  /** Seconds of camera move from the previous shot. */
  trans: number;
  cam: CamSpec;
  /** Room whose camera-side walls are lowered during the shot. */
  room?: string;
  /** Slow push-in over the shot (1 = none). */
  push?: number;
  /** Slow sideways drift over the shot, in world units along the screen's horizontal axis. */
  drift?: number;
}

export interface Tour {
  id: 'full' | 'short';
  name: string;
  /** Show time at tour time 0 (may be negative: the show loops). */
  showOffset: number;
  shots: Shot[];
  total: number;
  /** Seconds the opening card covers the view, and seconds before the end at which the closing card appears. */
  intro: number;
  outro: number;
}

const WALL_H = 3;
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Camera that frames a shot at local time `tau`, for a viewport of vw × vh pixels. */
export function resolveShot(shot: Shot, tau: number, showT: number, vw: number, vh: number, schedule: Schedule = getSchedule()): CamState {
  const az = BASE_AZ;
  const c = shot.cam;
  let x: number, z: number, w: number, d: number, margin: number;
  if (c.kind === 'overview') { x = GRID.w / 2; z = GRID.d / 2; w = GRID.w; d = GRID.d; margin = c.margin ?? 0.84; }
  else if (c.kind === 'room') { const r = roomById(c.id); x = r.x + r.w / 2; z = r.z + r.d / 2; w = r.w; d = r.d; margin = c.margin ?? 0.8; }
  else if (c.kind === 'region') { x = (c.x0 + c.x1) / 2; z = (c.z0 + c.z1) / 2; w = c.x1 - c.x0; d = c.z1 - c.z0; margin = c.margin ?? 0.8; }
  else if (c.kind === 'actor') { const p = sample(schedule, c.id, showT); x = p.x; z = p.z; w = c.w; d = c.d; margin = c.margin ?? 0.8; }
  else {
    const ps = ACTOR_IDS.map((id) => sample(schedule, id, showT));
    const x0 = Math.min(...ps.map((p) => p.x)), x1 = Math.max(...ps.map((p) => p.x));
    const z0 = Math.min(...ps.map((p) => p.z)), z1 = Math.max(...ps.map((p) => p.z));
    x = (x0 + x1) / 2; z = (z0 + z1) / 2;
    w = Math.max(c.minW, x1 - x0 + 2 * c.pad); d = Math.max(c.minD, z1 - z0 + 2 * c.pad); margin = c.margin ?? 0.86;
  }
  const u = shot.dur > 0 ? tau / shot.dur : 0;
  const zoom = fitZoom(w, d, az, vw, vh, margin, WALL_H) * lerp(1, shot.push ?? 1.05, u);
  const drift = (shot.drift ?? 0) * (u - 0.5);
  // Screen-right on the ground plane for this azimuth (see cameraMath.screenAxes).
  return { x: x + Math.cos(az) * drift, z: z - Math.sin(az) * drift, zoom, az };
}

export interface TourFrame { cam: CamState; index: number; shot: Shot; tau: number; showT: number; done: boolean }

/** Everything the scene needs at tour time `t`. */
export function tourFrame(tour: Tour, t: number, vw: number, vh: number, schedule: Schedule = getSchedule()): TourFrame {
  const tt = Math.min(Math.max(0, t), tour.total);
  let i = 0, start = 0;
  while (i < tour.shots.length - 1 && tt >= start + tour.shots[i].dur) { start += tour.shots[i].dur; i++; }
  const shot = tour.shots[i];
  const tau = tt - start;
  const showT = tour.showOffset + tt;
  let cam = resolveShot(shot, tau, showT, vw, vh, schedule);
  if (i > 0 && tau < shot.trans) {
    // Keep the previous shot's slow move going while we leave it, so there is no velocity jump at the cut.
    const prev = tour.shots[i - 1];
    const from = resolveShot(prev, prev.dur + tau, showT, vw, vh, schedule);
    const e = easeInOutCubic(tau / shot.trans);
    cam = { x: lerp(from.x, cam.x, e), z: lerp(from.z, cam.z, e), zoom: Math.exp(lerp(Math.log(from.zoom), Math.log(cam.zoom), e)), az: lerp(from.az, cam.az, e) };
  }
  return { cam, index: i, shot, tau, showT, done: t >= tour.total };
}

export const shotStart = (tour: Tour, index: number) => tour.shots.slice(0, index).reduce((s, x) => s + x.dur, 0);

const total = (shots: Shot[]) => shots.reduce((s, x) => s + x.dur, 0);
const startOf = (shots: Shot[], id: string) => { let t = 0; for (const s of shots) { if (s.id === id) return t; t += s.dur; } throw new Error('no shot ' + id); };

function fullTour(S: Schedule): Tour {
  const shots: Shot[] = [
    { id: 'overview', title: opening(), sub: t(C.floor), dur: 5.5, trans: 0, cam: { kind: 'overview' }, push: 1.06 },
    { id: 'reception', title: room('reception'), sub: t(C.reception), dur: 4, trans: 1.5, cam: { kind: 'room', id: 'reception', margin: 0.74 }, room: 'reception', drift: 1.6 },
    { id: 'founder', title: room('founder_office'), sub: t(config.founder.caption), dur: 4, trans: 1.5, cam: { kind: 'room', id: 'founder_office' }, room: 'founder_office' },
    { id: 'coo', title: room('coo_office'), sub: role('coo'), dur: 3.5, trans: 1.3, cam: { kind: 'room', id: 'coo_office' }, room: 'coo_office' },
    { id: 'marketing', title: room('marketing_office'), sub: role('marketing'), dur: 3.5, trans: 1.4, cam: { kind: 'room', id: 'marketing_office' }, room: 'marketing_office' },
    { id: 'admissions', title: room('admissions_office'), sub: role('admissions'), dur: 3.5, trans: 1.5, cam: { kind: 'room', id: 'admissions_office' }, room: 'admissions_office' },
    { id: 'bizdev', title: room('bizdev_office'), sub: role('bizdev'), dur: 3.5, trans: 1.4, cam: { kind: 'room', id: 'bizdev_office' }, room: 'bizdev_office' },
    { id: 'gather', title: t(C.teamMeeting), sub: t(C.teamMeetingSub), dur: 6.5, trans: 1.6, cam: { kind: 'group', pad: 5, minW: 20, minD: 15 }, push: 1 },
    { id: 'meeting', title: room('meeting_room'), sub: t(C.meetingSub), dur: 13.5, trans: 1.6, cam: { kind: 'room', id: 'meeting_room', margin: 0.84 }, room: 'meeting_room', push: 1.1 },
    { id: 'boardroom', title: room('boardroom'), dur: 3.5, trans: 1.4, cam: { kind: 'room', id: 'boardroom', margin: 0.7 }, room: 'boardroom' },
    { id: 'finale', title: '', dur: 7, trans: 1.8, cam: { kind: 'overview', margin: 0.8 }, push: 1.05 },
  ];
  // The last figure to leave its desk stands up about a second before the camera leaves its office.
  const lastDeparture = Math.max(...ACTOR_IDS.map((id) => S.cues.departures[id]));
  const showOffset = lastDeparture - (startOf(shots, 'gather') - 1.1);
  return { id: 'full', name: ui('fullTour'), showOffset, shots, total: total(shots), intro: 2.6, outro: 3.4 };
}

function shortTour(S: Schedule): Tour {
  const shots: Shot[] = [
    { id: 'overview', title: opening(), sub: t(C.floor), dur: 4.5, trans: 0, cam: { kind: 'overview' }, push: 1.06 },
    { id: 'reception', title: room('reception'), sub: t(C.reception), dur: 3.5, trans: 1.4, cam: { kind: 'room', id: 'reception', margin: 0.74 }, room: 'reception', drift: 1.6 },
    { id: 'gather', title: t(C.teamMeeting), sub: t(C.teamMeetingSub), dur: 6.5, trans: 1.5, cam: { kind: 'group', pad: 5, minW: 20, minD: 15 }, push: 1 },
    { id: 'meeting', title: room('meeting_room'), sub: t(C.meetingSub), dur: 10.5, trans: 1.6, cam: { kind: 'room', id: 'meeting_room', margin: 0.84 }, room: 'meeting_room', push: 1.1 },
    { id: 'finale', title: '', dur: 6, trans: 1.8, cam: { kind: 'overview', margin: 0.8 }, push: 1.05 },
  ];
  // Everyone is seated four seconds into the meeting-room shot.
  const showOffset = S.cues.lastSeated - (startOf(shots, 'meeting') + 4);
  return { id: 'short', name: ui('shortTour'), showOffset, shots, total: total(shots), intro: 2.2, outro: 3.2 };
}

let cache: Record<'full' | 'short', Tour> | null = null;
export function getTours(S: Schedule = getSchedule()): Record<'full' | 'short', Tour> {
  return (cache ??= { full: fullTour(S), short: shortTour(S) });
}
