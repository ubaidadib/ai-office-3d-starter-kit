import { describe, expect, it } from 'vitest';
import { rotateLocal, seatCentre, seatedRootPosition } from '../src/model/sitting';
import { SEATS } from '../src/model/layout';

describe('sitting maths (A9)', () => {
  const chair = { y: 0.887, forward: 0.12 };          // seat 44 cm high, centre slightly forward
  const contact = { x: 0.01, y: -0.35, z: 0.18 };      // thigh-underside centre in figure-local coords
  for (const q of [0, 1, 2, 3]) {
    it(`puts the seat-contact point exactly on the seat centre, facing ${q * 90}°`, () => {
      const seat = { x: 10, z: 5, face: (q * Math.PI) / 2 };
      const root = seatedRootPosition(seat, chair, contact);
      const o = rotateLocal(contact.x, contact.z, seat.face);
      const world = { x: root.x + o.x, y: root.y + contact.y, z: root.z + o.z };
      const c = seatCentre(seat, chair);
      expect(Math.abs(world.y - chair.y) * 50).toBeLessThan(3);                    // hips within 3 cm of seat height
      expect(Math.hypot(world.x - c.x, world.z - c.z) * 50).toBeLessThan(5);       // centred within 5 cm
    });
  }
  it('rotateLocal matches three.js: +z forward turns to +x at 90°', () => {
    const r = rotateLocal(0, 1, Math.PI / 2);
    expect(r.x).toBeCloseTo(1); expect(r.z).toBeCloseTo(0);
  });
  it('every AI seat faces its desk (desk lies in the facing direction)', async () => {
    const { FURNITURE } = await import('../src/model/layout');
    for (const s of Object.values(SEATS)) {
      const desk = FURNITURE.find((f) => f.model === 'desk' && Math.hypot(f.x - s.x, f.z - s.z) < 2)!;
      const dot = Math.sin(s.face) * (desk.x - s.x) + Math.cos(s.face) * (desk.z - s.z);
      expect(dot, s.id).toBeGreaterThan(1.0);
    }
  });
});
