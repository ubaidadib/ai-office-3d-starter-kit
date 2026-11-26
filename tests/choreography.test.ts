// The staged show must be deterministic, collision-free and seamless when it loops.
import { describe, expect, it } from 'vitest';
import { buildNavGrid, cellKey, roomAt } from '../src/model/floorplan';
import { lineClear, toCell } from '../src/model/pathfinding';
import { ACTORS, ACTOR_IDS, CAST_SEATS, castSeat } from '../src/model/cast';
import { WALK_SPEED, angleDelta, buildSchedule, distanceAt, sample, walkDuration } from '../src/model/choreography';

const nav = buildNavGrid();
const S = buildSchedule(nav);
const DT = 1 / 60;

describe('cast', () => {
  it('has exactly four AI role titles, each tagged AI, each with its own model', () => {
    expect(ACTOR_IDS).toEqual(['coo', 'marketing', 'admissions', 'bizdev']);
    for (const id of ACTOR_IDS) expect(ACTORS[id].display, id).toMatch(/^.+ · AI$/);
    expect(new Set(ACTOR_IDS.map((id) => ACTORS[id].model)).size).toBe(4);
  });
  it('gives nobody the founder\'s seat: the founder is a person and has no figure', () => {
    expect(Object.values(CAST_SEATS).some((s) => s.room === 'founder_office')).toBe(false);
  });
  it('never uses the reserved LIVE green as a figure accent', () => {
    for (const id of ACTOR_IDS) expect(ACTORS[id].accent.toLowerCase()).not.toBe('#15803d');
  });
  it('every seat has a walkable approach spot in the same room', () => {
    for (const s of Object.values(CAST_SEATS)) {
      const c = toCell(s.approach.x, s.approach.z);
      expect(nav.blockedCells.has(cellKey(c.x, c.z)), s.id).toBe(false);
      expect(roomAt(s.approach.x, s.approach.z)?.id, s.id).toBe(s.room);
    }
  });
  it('each figure has its own meeting chair', () => {
    expect(new Set(ACTOR_IDS.map((id) => ACTORS[id].meetingSeat)).size).toBe(4);
    for (const id of ACTOR_IDS) expect(castSeat(ACTORS[id].meetingSeat).room).toBe('meeting_room');
  });
});

describe('choreography', () => {
  it('is deterministic: building it twice gives the same show', () => {
    const again = buildSchedule(buildNavGrid());
    expect(again.loop).toBe(S.loop);
    expect(again.cues).toEqual(S.cues);
    for (const id of ACTOR_IDS) for (const t of [0, 7.3, 15.1, 22.2, 31.9, 40.4, 55.5]) expect(sample(again, id, t)).toEqual(sample(S, id, t));
  });
  it('walking paths stay on legal cells (no wall, door frame or furniture is crossed)', () => {
    for (const id of ACTOR_IDS) for (const path of [S.tracks[id].outPath, S.tracks[id].backPath]) {
      expect(path.length).toBeGreaterThan(1);
      for (let i = 1; i < path.length; i++) expect(lineClear(nav, path[i - 1].x, path[i - 1].z, path[i].x, path[i].z, 0.05), `${id} leg ${i}`).toBe(true);
    }
  });
  it('figures on their feet are always on a free cell', () => {
    for (const id of ACTOR_IDS) for (let t = 0; t < S.loop; t += 0.05) {
      const p = sample(S, id, t);
      if (p.k > 0) continue;   // sliding between the approach spot and the chair
      const c = toCell(p.x, p.z);
      expect(nav.blockedCells.has(cellKey(c.x, c.z)), `${id} at ${t.toFixed(2)} (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).toBe(false);
    }
  });
  it('no two figures ever come closer than 0.6 m unless both are seated', () => {
    let closest = Infinity;
    for (let t = 0; t < S.loop; t += 0.05) {
      const ps = ACTOR_IDS.map((id) => sample(S, id, t));
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        if (ps[i].k >= 1 && ps[j].k >= 1) continue;
        closest = Math.min(closest, Math.hypot(ps[i].x - ps[j].x, ps[i].z - ps[j].z));
      }
    }
    expect(closest).toBeGreaterThanOrEqual(1.2);
  });
  it('movement is continuous: no teleporting and no snap turns, including where the loop restarts', () => {
    for (const id of ACTOR_IDS) {
      let prev = sample(S, id, -DT);
      for (let t = 0; t <= S.loop + DT; t += DT) {
        const p = sample(S, id, t);
        expect(Math.hypot(p.x - prev.x, p.z - prev.z), `${id} position at ${t.toFixed(3)}`).toBeLessThanOrEqual(WALK_SPEED * DT * 1.6 + 1e-6);
        expect(Math.abs(angleDelta(prev.face, p.face)), `${id} heading at ${t.toFixed(3)}`).toBeLessThan(0.3);
        expect(Math.abs(p.look - prev.look), `${id} head at ${t.toFixed(3)}`).toBeLessThan(0.12);
        prev = p;
      }
    }
  });
  it('the loop is seamless: every figure starts and ends seated at its own desk', () => {
    for (const id of ACTOR_IDS) for (const t of [0, S.loop - 0.01, S.loop, -3]) {
      const p = sample(S, id, t);
      expect(p.seat).toBe(ACTORS[id].homeSeat);
      expect(p.k).toBe(1);
      expect(p.phase).toBe('desk');
    }
  });
  it('all four sit together in the Central Meeting Room, then all return', () => {
    const mid = (S.cues.lastSeated + S.cues.meetingEnd) / 2;
    for (const id of ACTOR_IDS) {
      const p = sample(S, id, mid);
      expect(p.seat).toBe(ACTORS[id].meetingSeat);
      expect(p.k).toBe(1);
      expect(p.phase).toBe('meeting');
      expect(sample(S, id, S.cues.lastHome + 0.5).seat).toBe(ACTORS[id].homeSeat);
    }
    expect(S.cues.meetingEnd - S.cues.lastSeated).toBeGreaterThanOrEqual(8);
  });
  it('gestures happen only while seated, and each figure gestures during the meeting', () => {
    for (const id of ACTOR_IDS) {
      let inMeeting = 0;
      for (let t = 0; t < S.loop; t += 0.05) {
        const p = sample(S, id, t);
        if (p.k < 0.5) { expect(p.nod + p.reach, `${id} at ${t}`).toBeLessThan(0.51); }
        if (p.k === 0) expect(p.nod + p.reach + Math.abs(p.look)).toBe(0);
        if (p.phase === 'meeting' && p.reach + p.nod > 0.9) inMeeting++;
      }
      expect(inMeeting, id).toBeGreaterThan(5);
    }
  });
  it('walks ease in and out and cover the whole distance', () => {
    for (const len of [0.4, 2, 12, 45]) {
      const d = walkDuration(len);
      expect(distanceAt(len, 0)).toBe(0);
      expect(distanceAt(len, d)).toBeCloseTo(len, 6);
      for (let t = DT; t <= d; t += DT) expect(distanceAt(len, t) - distanceAt(len, t - DT)).toBeLessThanOrEqual(WALK_SPEED * DT * 1.6);
    }
  });
});
