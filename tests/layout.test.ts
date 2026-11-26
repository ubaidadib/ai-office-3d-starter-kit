// Layout quality rules and honesty rules for visuals.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { ROOMS, SIDE_DIR, buildNavGrid, cellKey, roomById } from '../src/model/floorplan';
import { ANCHORS, FURNITURE, SEATS, footprint, itemBlocks, modelSize } from '../src/model/layout';
import { lineClear, smoothPath, toCell, findPath } from '../src/model/pathfinding';
import { buildLegs, standPoint } from './helpers/routes';

const nav = buildNavGrid();
const area = (a: ReturnType<typeof footprint>, b: ReturnType<typeof footprint>) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

describe('layout (A8)', () => {
  it('every item lies inside its own room', () => {
    for (const it of FURNITURE) {
      const r = roomById(it.room), f = footprint(it);
      expect(f.x0 >= r.x - 0.01 && f.z0 >= r.z - 0.01 && f.x1 <= r.x + r.w + 0.01 && f.z1 <= r.z + r.d + 0.01,
        `${it.model} in ${it.room}`).toBe(true);
    }
  });

  it('no two floor-standing items intersect', () => {
    const bl = FURNITURE.filter(itemBlocks);
    for (let i = 0; i < bl.length; i++) for (let j = i + 1; j < bl.length; j++) {
      expect(area(footprint(bl[i]), footprint(bl[j])), `${bl[i].model}@${bl[i].x},${bl[i].z} × ${bl[j].model}@${bl[j].x},${bl[j].z}`).toBeLessThan(0.0005);
    }
  });

  it('doorways are at least 1 m wide and kept clear of furniture (1 m in front of each door)', () => {
    for (const r of ROOMS) {
      if (r.walls === 'none') continue;
      expect(r.doors.length, r.id).toBeGreaterThanOrEqual(2);   // ≥ 2 cells = 1 m
      for (const d of r.doors) {
        const [dx, dz] = SIDE_DIR[d.side];
        for (let k = 0; k <= 1; k++) {          // the door cell and the next cell inwards
          expect(nav.blockedCells.has(cellKey(d.x - dx * k, d.z - dz * k)), `${r.id} door ${d.x},${d.z}`).toBe(false);
        }
      }
    }
  });

  it('corridors (2 m) are free of furniture', () => {
    for (const z of [10, 11, 12, 13, 26, 27, 28, 29]) for (let x = 0; x < 60; x++) expect(nav.blockedCells.has(cellKey(x, z))).toBe(false);
  });

  it('each AI employee and the founder has a desk, a computer and a chair in their private office', () => {
    for (const r of ROOMS.filter((q) => q.occupant)) {
      const inside = FURNITURE.filter((f) => f.room === r.id).map((f) => f.model);
      expect(inside, r.id).toContain('desk');
      expect(inside, r.id).toContain('chairDesk');
      expect(inside.includes('computerScreen') || inside.includes('laptop'), r.id).toBe(true);
    }
  });

  it('every AI employee has a registered seat; the founder (a person) has none', () => {
    expect(Object.keys(SEATS).sort()).toEqual(['admissions', 'bizdev', 'coo', 'marketing']);
  });

  it('monitors face their desk chair', () => {
    for (const s of Object.values(SEATS)) {
      const screen = FURNITURE.find((f) => f.model === 'computerScreen' && Math.hypot(f.x - s.x, f.z - s.z) < 2.2)!;
      expect(screen, s.id).toBeDefined();
      const dir = [Math.sin((screen.q * Math.PI) / 2), Math.cos((screen.q * Math.PI) / 2)];
      const toChair = [s.x - screen.x, s.z - screen.z];
      expect(dir[0] * toChair[0] + dir[1] * toChair[1], s.id).toBeGreaterThan(0);
    }
  });

  it('furniture uses real proportions (desk 1.4 × 0.75 × 0.73 m)', () => {
    const d = modelSize('desk');
    expect(d.w * 0.5).toBeCloseTo(1.4, 1);
    expect(d.d * 0.5).toBeCloseTo(0.75, 1);
    expect(d.h * 0.5).toBeCloseTo(0.73, 1);
  });

  it('only quarter-turn rotations are used (footprints stay exact)', () => {
    for (const f of FURNITURE) expect([0, 1, 2, 3]).toContain(f.q);
  });
});

describe('movement (A9 / A8)', () => {
  it('every seat has a walkable approach spot', () => {
    for (const s of Object.values(SEATS)) {
      const c = toCell(s.approach.x, s.approach.z);
      expect(nav.blockedCells.has(cellKey(c.x, c.z)), s.id).toBe(false);
    }
  });

  it('smoothed walking paths stay clear of walls and furniture', () => {
    for (const leg of buildLegs()) {
      for (let i = 1; i < leg.points.length; i++) {
        const a = leg.points[i - 1], b = leg.points[i];
        expect(lineClear(nav, a.x, a.z, b.x, b.z, 0.1), `${leg.from}->${leg.to} seg ${i}`).toBe(true);
      }
    }
  });

  it('smoothing never adds points and keeps the endpoints', () => {
    const a = standPoint(ANCHORS['admissions.seat']), b = standPoint(ANCHORS['lounge.coffee']);
    const cells = findPath(nav, toCell(a.x, a.z), toCell(b.x, b.z))!;
    const pts = cells.map((c) => ({ x: c.x + 0.5, z: c.z + 0.5 }));
    const s = smoothPath(nav, pts);
    expect(s.length).toBeLessThanOrEqual(pts.length);
    expect(s[0]).toEqual(pts[0]);
    expect(s[s.length - 1]).toEqual(pts[pts.length - 1]);
  });
});

describe('honesty in visuals (A12)', () => {
  const src = (dir: string) => readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.tsx') || String(f).endsWith('.ts'))
    .map((f) => readFileSync(`${dir}/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')).join('\n');  // code only, comments stripped
  const scene = src('src/scene');

  it('no emissive / glowing materials anywhere in the scene code', () => {
    expect(scene).not.toMatch(/emissive(Intensity)?\s*[:=]\s*(?!0\b)/);
  });

  it('no typing, speaking or "busy" effects are implemented', () => {
    expect(scene.toLowerCase()).not.toMatch(/typing|speech|bubble|busy|working-effect|screen-on/);
  });

  it('the LIVE colour (green #15803d) is not used in the 3D scene', () => {
    expect(scene.toLowerCase()).not.toContain('#15803d');
  });
});
