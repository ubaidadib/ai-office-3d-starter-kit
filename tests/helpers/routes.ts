// Test helper: walking legs between the office anchors (replaces the old single-figure movement test).
import { buildNavGrid } from '../../src/model/floorplan';
import { ANCHORS, SEATS, type Anchor } from '../../src/model/layout';
import { findPath, smoothPath, toCell } from '../../src/model/pathfinding';

/** Where walking starts or ends for an anchor: seats are entered from their approach spot. */
export function standPoint(a: Anchor): { x: number; z: number } {
  return a.seat ? SEATS[a.seat].approach : { x: a.x, z: a.z };
}

const ROUTE = ['admissions.seat', 'meeting.standA', 'coo.visitor', 'reception.front', 'lounge.coffee'];

export function buildLegs(): { from: string; to: string; points: { x: number; z: number }[] }[] {
  const nav = buildNavGrid();
  return ROUTE.map((from, i) => {
    const to = ROUTE[(i + 1) % ROUTE.length];
    const pa = standPoint(ANCHORS[from]), pb = standPoint(ANCHORS[to]);
    const cells = findPath(nav, toCell(pa.x, pa.z), toCell(pb.x, pb.z));
    if (!cells) throw new Error(`no path ${from} -> ${to}`);
    const pts = cells.map((c) => ({ x: c.x + 0.5, z: c.z + 0.5 }));
    pts[0] = { ...pa }; pts[pts.length - 1] = { ...pb };
    return { from, to, points: smoothPath(nav, pts) };
  });
}
