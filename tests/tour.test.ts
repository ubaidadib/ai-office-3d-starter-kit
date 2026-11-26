// Guided tours must be repeatable, smooth, correctly timed against the staged show, and honest in their captions.
import { describe, expect, it } from 'vitest';
import { ROOMS } from '../src/model/floorplan';
import { ACTORS, ACTOR_IDS } from '../src/model/cast';
import { buildSchedule, sample } from '../src/model/choreography';
import { getTours, resolveShot, shotStart, tourFrame } from '../src/model/tour';
import { DISCLOSURE } from '../src/mode';
import config from '../office.config';

const S = buildSchedule();
const T = getTours(S);
const VIEWS: [string, number, number][] = [['landscape 1920×1080', 1920, 1080], ['vertical 1080×1920', 1080, 1920], ['square 1080×1080', 1080, 1080]];
const DT = 1 / 60;

describe('guided tours', () => {
  it('there is a full tour of about a minute and a short cut of 25–40 s', () => {
    expect(T.full.total).toBeGreaterThanOrEqual(50); expect(T.full.total).toBeLessThanOrEqual(65);
    expect(T.short.total).toBeGreaterThanOrEqual(25); expect(T.short.total).toBeLessThanOrEqual(40);
  });
  it('the full tour visits the ten stops in order: overview, reception, founder, four role offices, meeting, boardroom, overview', () => {
    expect(T.full.shots.map((s) => s.id)).toEqual(['overview', 'reception', 'founder', 'coo', 'marketing', 'admissions', 'bizdev', 'gather', 'meeting', 'boardroom', 'finale']);
    for (const s of T.full.shots) if (s.room) expect(ROOMS.some((r) => r.id === s.room), s.id).toBe(true);
    expect(T.full.shots[0].cam.kind).toBe('overview');
    expect(T.full.shots[T.full.shots.length - 1].cam.kind).toBe('overview');
  });
  it('is deterministic: the same time gives the same camera', () => {
    for (const tour of [T.full, T.short]) for (const t of [0, 3.3, 11.1, 27.7, tour.total - 0.5]) {
      expect(tourFrame(tour, t, 1920, 1080, S).cam).toEqual(tourFrame(tour, t, 1920, 1080, S).cam);
    }
  });
  it('the camera never jumps: position, zoom and angle change smoothly in every frame format', () => {
    for (const [name, vw, vh] of VIEWS) for (const tour of [T.full, T.short]) {
      let prev = tourFrame(tour, 0, vw, vh, S).cam;
      for (let t = DT; t <= tour.total; t += DT) {
        const c = tourFrame(tour, t, vw, vh, S).cam;
        expect(Number.isFinite(c.zoom) && c.zoom > 0, `${name} ${tour.id} zoom at ${t.toFixed(2)}`).toBe(true);
        // At most 1.6 m of camera travel and 9 % of zoom change per frame, even in the fastest move.
        expect(Math.hypot(c.x - prev.x, c.z - prev.z), `${name} ${tour.id} move at ${t.toFixed(2)}`).toBeLessThan(1.6);
        expect(Math.abs(Math.log(c.zoom / prev.zoom)), `${name} ${tour.id} zoom step at ${t.toFixed(2)}`).toBeLessThan(0.09);
        expect(c.az).toBe(prev.az);
        prev = c;
      }
    }
  });
  it('moves ease in and out (the first and last frame of a move are much slower than its middle)', () => {
    const tour = T.full;
    const i = tour.shots.findIndex((s) => s.id === 'reception'), t0 = shotStart(tour, i), tr = tour.shots[i].trans;
    const speed = (t: number) => { const a = tourFrame(tour, t, 1920, 1080, S).cam, b = tourFrame(tour, t + DT, 1920, 1080, S).cam; return Math.hypot(b.x - a.x, b.z - a.z); };
    expect(speed(t0 + DT)).toBeLessThan(speed(t0 + tr / 2) * 0.2);
    expect(speed(t0 + tr - 2 * DT)).toBeLessThan(speed(t0 + tr / 2) * 0.2);
  });
  it('each role figure is at its own desk while the camera visits its office', () => {
    const tour = T.full;
    for (const id of ACTOR_IDS) {
      const i = tour.shots.findIndex((s) => s.id === id), t0 = shotStart(tour, i);
      expect(tour.shots[i].room).toBe(ACTORS[id].homeRoom);
      for (const t of [t0 + tour.shots[i].trans, t0 + tour.shots[i].dur * 0.6]) {
        const p = sample(S, id, tour.showOffset + t);
        expect(p.seat, `${id} at ${t.toFixed(1)}`).toBe(ACTORS[id].homeSeat);
      }
    }
  });
  it('in both tours all four figures are seated together before the meeting-room shot ends, with time to gesture', () => {
    for (const tour of [T.full, T.short]) {
      const i = tour.shots.findIndex((s) => s.id === 'meeting'), end = shotStart(tour, i) + tour.shots[i].dur;
      const seatedAtTour = S.cues.lastSeated - tour.showOffset;
      expect(seatedAtTour, tour.id).toBeGreaterThan(shotStart(tour, i));     // the audience sees people arrive and sit
      expect(end - seatedAtTour, tour.id).toBeGreaterThanOrEqual(5);         // then at least five seconds of the meeting
      for (const id of ACTOR_IDS) expect(sample(S, id, tour.showOffset + end - 0.5).phase, `${tour.id} ${id}`).toBe('meeting');
    }
  });
  it('the figures are still at their desks when a tour starts (the show loops, so the offset may be negative)', () => {
    for (const tour of [T.full, T.short]) for (const id of ACTOR_IDS) expect(sample(S, id, tour.showOffset).phase, `${tour.id} ${id}`).toBe('desk');
  });
  it('frames the same subject in landscape and vertical formats (a vertical frame only zooms out)', () => {
    const shot = T.full.shots.find((s) => s.id === 'meeting')!;
    const a = resolveShot(shot, 0, 0, 1920, 1080, S), b = resolveShot(shot, 0, 0, 1080, 1920, S);
    expect(b.x).toBe(a.x); expect(b.z).toBe(a.z);
    expect(b.zoom).toBeLessThan(a.zoom);
  });
});

describe('honesty of the presentation text', () => {
  const texts = [T.full, T.short].flatMap((t) => t.shots.flatMap((s) => [s.title, s.sub ?? '']));
  it('no caption claims live, real or working AI activity', () => {
    for (const t of texts) expect(t, t).not.toMatch(/\b(live|real[- ]time|working|at work|running|online|operational|autonomous)\b/i);
  });
  it('the staged scenes say that they are staged', () => {
    for (const tour of [T.full, T.short]) for (const id of ['gather', 'meeting']) {
      const s = tour.shots.find((x) => x.id === id)!;
      expect(`${s.title} ${s.sub}`, 'the meeting captions must say the scene is staged (office.config.ts → captions)').toMatch(/staged|scripted|illustrative|simulated/i);
    }
  });
  it('role captions use the approved role titles and call them AI roles', () => {
    for (const id of ACTOR_IDS) {
      const s = T.full.shots.find((x) => x.id === id)!;
      expect(s.sub).toBe(ACTORS[id].display.replace(/ · AI$/, '') + ' · AI role');
    }
  });
  it('the disclosure line shown on screen is the one in office.config.ts', () => {
    expect(DISCLOSURE).toBe(config.disclosure.en);
  });
});
