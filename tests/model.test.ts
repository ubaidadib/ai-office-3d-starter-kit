// Floor plan and pathfinding rules.
import { describe, expect, it } from 'vitest';
import { GRID, ROOMS, SIDE_DIR, buildNavGrid, cellKey, edgeKey, inRoom, roomAt } from '../src/model/floorplan';
import { ANCHORS, FURNITURE, footprint, itemBlocks } from '../src/model/layout';
import { canStep, findPath, toCell } from '../src/model/pathfinding';
import { buildLegs, standPoint } from './helpers/routes';
import { ACTORS } from '../src/model/cast';

const nav = buildNavGrid();

describe('floor plan', () => {
  it('gives every AI employee and the founder a private office with a door and nameplate', () => {
    for (const who of ['coo', 'marketing', 'admissions', 'bizdev', 'founder']) {
      const r = ROOMS.find((q) => q.occupant === who);
      expect(r, who).toBeDefined();
      expect(r!.walls).not.toBe('none');
      expect(r!.doors.length).toBeGreaterThan(0);
      expect(r!.nameplate).toBeTruthy();
    }
  });

  it('labels AI roles as AI and the founder as human', () => {
    for (const id of ['coo', 'marketing', 'admissions', 'bizdev'] as const) expect(ACTORS[id].display).toMatch(/ · AI$/);
    expect(ROOMS.find((r) => r.occupant === 'founder')!.nameplate).toContain('Human');
    for (const who of ['coo', 'marketing', 'admissions', 'bizdev']) expect(ROOMS.find((r) => r.occupant === who)!.nameplate).toContain('· AI');
  });

  it('has all shared spaces and all 13 named rooms', () => {
    const kinds = new Set(ROOMS.map((r) => r.kind));
    for (const k of ['reception', 'meeting', 'boardroom', 'lounge', 'archive', 'department']) expect(kinds.has(k as never)).toBe(true);
    expect(ROOMS).toHaveLength(13);
    const names = ROOMS.map((r) => r.name);
    for (const n of names) expect(n.trim().length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(13);
  });

  it('is 30 × 22 m at 0.5 m per cell', () => {
    expect(GRID.w * 0.5).toBe(30);
    expect(GRID.d * 0.5).toBe(22);
  });

  it('rooms do not overlap and stay inside the building', () => {
    for (let x = 0; x < GRID.w; x++) for (let z = 0; z < GRID.d; z++) {
      expect(ROOMS.filter((r) => inRoom(r, x, z)).length).toBeLessThanOrEqual(1);
    }
    for (const r of ROOMS) {
      expect(r.x + r.w).toBeLessThanOrEqual(GRID.w);
      expect(r.z + r.d).toBeLessThanOrEqual(GRID.d);
    }
  });

  it('every door is on its room perimeter and not walled', () => {
    for (const r of ROOMS) for (const d of r.doors) {
      expect(inRoom(r, d.x, d.z)).toBe(true);
      const [dx, dz] = SIDE_DIR[d.side];
      expect(inRoom(r, d.x + dx, d.z + dz)).toBe(false);
      expect(nav.blockedEdges.has(edgeKey(d.x, d.z, d.x + dx, d.z + dz))).toBe(false);
    }
  });

  it('furniture stays inside the building', () => {
    for (const f of FURNITURE) {
      const b = footprint(f);
      expect(b.x0).toBeGreaterThanOrEqual(-0.01);
      expect(b.z0).toBeGreaterThanOrEqual(-0.01);
      expect(b.x1).toBeLessThanOrEqual(GRID.w + 0.01);
      expect(b.z1).toBeLessThanOrEqual(GRID.d + 0.01);
    }
    expect(FURNITURE.some(itemBlocks)).toBe(true);
  });

  it('every anchor (stand point) is on a walkable cell inside a room', () => {
    for (const [id, a] of Object.entries(ANCHORS)) {
      const p = standPoint(a);
      const c = toCell(p.x, p.z);
      expect(nav.blockedCells.has(cellKey(c.x, c.z)), id).toBe(false);
      expect(roomAt(a.x, a.z), id).toBeDefined();
    }
  });
});

describe('pathfinding', () => {
  it('connects every anchor to every other anchor', () => {
    const ids = Object.keys(ANCHORS);
    for (const a of ids) for (const b of ids) {
      if (a === b) continue;
      const pa = standPoint(ANCHORS[a]), pb = standPoint(ANCHORS[b]);
      expect(findPath(nav, toCell(pa.x, pa.z), toCell(pb.x, pb.z)), `${a}->${b}`).not.toBeNull();
    }
  });

  it('never crosses a wall or a blocked cell (cell path)', () => {
    for (const leg of buildLegs()) {
      const a = leg.points[0], b = leg.points[leg.points.length - 1];
      const cells = findPath(nav, toCell(a.x, a.z), toCell(b.x, b.z))!;
      for (let i = 1; i < cells.length; i++) expect(canStep(nav, cells[i - 1], cells[i])).toBe(true);
    }
  });

  it('enters private offices only through their door', () => {
    // Admissions office (x 36–45, z 0–10): east wall at x = 45, door cells z 6–8.
    expect(canStep(nav, { x: 44, z: 3 }, { x: 45, z: 3 })).toBe(false);
    expect(canStep(nav, { x: 44, z: 7 }, { x: 45, z: 7 })).toBe(true);
    // COO office: south wall at z = 10, door cells x 15–17.
    expect(canStep(nav, { x: 12, z: 9 }, { x: 12, z: 10 })).toBe(false);
    expect(canStep(nav, { x: 16, z: 9 }, { x: 16, z: 10 })).toBe(true);
  });

  it('returns null for a blocked goal', () => {
    const blocked = [...nav.blockedCells][0].split(',').map(Number);
    expect(findPath(nav, { x: 30, z: 12 }, { x: blocked[0], z: blocked[1] })).toBeNull();
  });
});
