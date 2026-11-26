// Grid A* over the floor plan (8-neighbour; diagonals only when both orthogonal
// steps are legal, so paths never cut wall or furniture corners), with a binary
// heap open list, plus line-of-sight smoothing for natural walking paths.
import { cellKey, edgeKey, inGrid, type NavGrid } from './floorplan';

export interface Cell { x: number; z: number }

export function canStep(nav: NavGrid, a: Cell, b: Cell): boolean {
  if (!inGrid(b.x, b.z) || nav.blockedCells.has(cellKey(b.x, b.z))) return false;
  const dx = b.x - a.x, dz = b.z - a.z;
  if (Math.abs(dx) + Math.abs(dz) === 1) return !nav.blockedEdges.has(edgeKey(a.x, a.z, b.x, b.z));
  if (Math.abs(dx) === 1 && Math.abs(dz) === 1) {
    const c1 = { x: a.x + dx, z: a.z }, c2 = { x: a.x, z: a.z + dz };
    return canStep(nav, a, c1) && canStep(nav, c1, b) && canStep(nav, a, c2) && canStep(nav, c2, b);
  }
  return dx === 0 && dz === 0;
}

const NEIGH: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Minimal binary min-heap keyed by f. */
class Heap {
  private a: { k: string; f: number }[] = [];
  get size() { return this.a.length; }
  push(k: string, f: number) {
    const a = this.a; a.push({ k, f });
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop(): string {
    const a = this.a; const top = a[0]; const last = a.pop()!;
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top.k;
  }
}

export function findPath(nav: NavGrid, start: Cell, goal: Cell): Cell[] | null {
  if (nav.blockedCells.has(cellKey(goal.x, goal.z)) || nav.blockedCells.has(cellKey(start.x, start.z))) return null;
  if (!inGrid(start.x, start.z) || !inGrid(goal.x, goal.z)) return null;
  const h = (c: Cell) => {
    const dx = Math.abs(c.x - goal.x), dz = Math.abs(c.z - goal.z);
    return dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz);
  };
  const g = new Map<string, number>();
  const from = new Map<string, string>();
  const cells = new Map<string, Cell>();
  const closed = new Set<string>();
  const sk = cellKey(start.x, start.z), gk = cellKey(goal.x, goal.z);
  const open = new Heap();
  open.push(sk, h(start)); g.set(sk, 0); cells.set(sk, start);
  while (open.size) {
    const k = open.pop();
    if (closed.has(k)) continue;
    if (k === gk) {
      const path: Cell[] = [cells.get(k)!];
      let cur = k;
      while (from.has(cur)) { cur = from.get(cur)!; path.push(cells.get(cur)!); }
      return path.reverse();
    }
    closed.add(k);
    const c = cells.get(k)!;
    for (const [dx, dz] of NEIGH) {
      const nb = { x: c.x + dx, z: c.z + dz };
      const nk = cellKey(nb.x, nb.z);
      if (closed.has(nk) || !canStep(nav, c, nb)) continue;
      const t = g.get(k)! + (dx && dz ? Math.SQRT2 : 1);
      if (t < (g.get(nk) ?? Infinity)) { g.set(nk, t); from.set(nk, k); cells.set(nk, nb); open.push(nk, t + h(nb)); }
    }
  }
  return null;
}

export const toCell = (x: number, z: number): Cell => ({ x: Math.floor(x), z: Math.floor(z) });

/** True if a straight walk between two world points only crosses legal cell steps. */
export function lineClear(nav: NavGrid, ax: number, az: number, bx: number, bz: number, step = 0.2): boolean {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / step));
  let prev = toCell(ax, az);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const c = toCell(ax + (bx - ax) * t, az + (bz - az) * t);
    if (c.x !== prev.x || c.z !== prev.z) {
      if (!canStep(nav, prev, c)) return false;
      prev = c;
    }
  }
  return true;
}

/** String-pulling: keep only the turning points of a cell path (world coordinates). */
export function smoothPath(nav: NavGrid, pts: { x: number; z: number }[]): { x: number; z: number }[] {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !lineClear(nav, pts[i].x, pts[i].z, pts[j].x, pts[j].z, 0.1)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}
