// HQ floor plan at real scale (1 cell = 0.5 m): 60 × 44 cells = 30 × 22 m.
// x grows east, z grows south. Renderer-agnostic: no three.js imports here.
import { FURNITURE, blockedCellsFor } from './layout';
import config, { type RoleSlot, type RoomId } from '../../office.config';
import { roleTitle, t } from '../i18n';

export type Side = 'n' | 's' | 'e' | 'w';
export interface Door { x: number; z: number; side: Side }

export type RoomKind =
  | 'private_office' | 'founder_office' | 'boardroom' | 'meeting' | 'archive'
  | 'department' | 'lounge' | 'reception';

export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  x: number; z: number; w: number; d: number;
  walls: 'solid' | 'glass' | 'none';
  doors: Door[];
  /** Floor finish and colour (no textures). */
  floor: { color: string; finish: 'wood' | 'carpet' | 'stone' };
  accent: string;
  /** Private offices: role id, or 'founder'. */
  occupant?: string;
  nameplate?: string;
}

export const GRID = { w: 60, d: 44 } as const;

/** A door `n` cells wide on one side of a room, starting at (x, z). */
function door(side: Side, x: number, z: number, n = 3): Door[] {
  return Array.from({ length: n }, (_, i) => (side === 'n' || side === 's' ? { x: x + i, z, side } : { x, z: z + i, side }));
}

// Role colours come from office.config.ts. Green is avoided on purpose (traditionally reserved for "live").
const ACCENT = { founder: '#b8902f', coo: config.roles.coo.color, marketing: config.roles.marketing.color,
  admissions: config.roles.admissions.color, bizdev: config.roles.bizdev.color, neutral: '#6b7280' };

type PlanRoom = Omit<Room, 'name' | 'nameplate'> & { id: RoomId };

const PLAN: PlanRoom[] = [
  // North band (z 0–10, 5 m deep). Doors open to the north corridor (z 10–14).
  { id: 'founder_office', kind: 'founder_office', x: 0, z: 0, w: 11, d: 10, walls: 'solid',
    doors: door('s', 4, 9), floor: { color: '#d8c3a5', finish: 'wood' }, accent: ACCENT.founder, occupant: 'founder' },
  { id: 'coo_office', kind: 'private_office', x: 11, z: 0, w: 11, d: 10, walls: 'solid',
    doors: door('s', 15, 9), floor: { color: '#d3c6b3', finish: 'wood' }, accent: ACCENT.coo, occupant: 'coo' },
  { id: 'boardroom', kind: 'boardroom', x: 22, z: 0, w: 14, d: 10, walls: 'glass',
    doors: door('s', 28, 9), floor: { color: '#c9ccd1', finish: 'carpet' }, accent: ACCENT.neutral },
  { id: 'admissions_office', kind: 'private_office', x: 36, z: 0, w: 9, d: 10,
    walls: 'solid', doors: door('e', 44, 6), floor: { color: '#c6d9d4', finish: 'carpet' }, accent: ACCENT.admissions,
    occupant: 'admissions' },
  { id: 'admissions_library', kind: 'department', x: 45, z: 0, w: 15, d: 10,
    walls: 'none', doors: [], floor: { color: '#d7e5e1', finish: 'carpet' }, accent: ACCENT.admissions },
  // Middle band (z 14–26, 6 m deep).
  { id: 'marketing_office', kind: 'private_office', x: 0, z: 14, w: 9, d: 12,
    walls: 'solid', doors: door('e', 8, 19), floor: { color: '#e6d3cb', finish: 'carpet' }, accent: ACCENT.marketing,
    occupant: 'marketing' },
  { id: 'marketing_studio', kind: 'department', x: 9, z: 14, w: 12, d: 12, walls: 'none',
    doors: [], floor: { color: '#eee0da', finish: 'carpet' }, accent: ACCENT.marketing },
  { id: 'meeting_room', kind: 'meeting', x: 21, z: 14, w: 16, d: 12, walls: 'glass',
    doors: [...door('n', 28, 14), ...door('s', 28, 25)], floor: { color: '#d0d9e2', finish: 'carpet' }, accent: ACCENT.neutral },
  { id: 'bizdev_pipeline', kind: 'department', x: 37, z: 14, w: 13, d: 12, walls: 'none',
    doors: [], floor: { color: '#e1ddee', finish: 'carpet' }, accent: ACCENT.bizdev },
  { id: 'bizdev_office', kind: 'private_office', x: 50, z: 14, w: 10, d: 12,
    walls: 'solid', doors: door('w', 50, 19), floor: { color: '#d8d1e7', finish: 'carpet' }, accent: ACCENT.bizdev,
    occupant: 'bizdev' },
  // South band (z 30–44, 7 m deep).
  { id: 'lounge', kind: 'lounge', x: 0, z: 30, w: 20, d: 14, walls: 'none', doors: [],
    floor: { color: '#dde5d5', finish: 'stone' }, accent: ACCENT.neutral },
  { id: 'reception', kind: 'reception', x: 20, z: 30, w: 24, d: 14, walls: 'none', doors: [],
    floor: { color: '#ebe5da', finish: 'stone' }, accent: ACCENT.neutral },
  { id: 'archive', kind: 'archive', x: 44, z: 30, w: 16, d: 14, walls: 'solid',
    doors: door('n', 50, 30), floor: { color: '#e2dbcd', finish: 'carpet' }, accent: ACCENT.neutral },
];

/** Room names and nameplates come from office.config.ts, in the page language. */
export const ROOMS: Room[] = PLAN.map((r) => ({
  ...r,
  name: t(config.rooms[r.id]),
  nameplate: r.occupant === 'founder' ? t(config.founder.nameplate) : r.occupant ? roleTitle(r.occupant as RoleSlot) : undefined,
}));

export const CORRIDOR_FLOOR = '#e7e5e0';

/** Main entrance: a 3 m gap in the south outer wall, at Reception. */
export const ENTRANCE: Door[] = door('s', 30, GRID.d - 1, 6);

// ---------------------------------------------------------------- walk grid

export const cellKey = (x: number, z: number) => `${x},${z}`;
export const edgeKey = (ax: number, az: number, bx: number, bz: number) =>
  ax < bx || (ax === bx && az < bz) ? `${ax},${az}|${bx},${bz}` : `${bx},${bz}|${ax},${az}`;

export const SIDE_DIR: Record<Side, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

export const inRoom = (r: Room, x: number, z: number) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.d;
export const inGrid = (x: number, z: number) => x >= 0 && x < GRID.w && z >= 0 && z < GRID.d;

/** One wall edge between an inside cell (a) and an outside cell (b). */
export interface WallSegment { ax: number; az: number; bx: number; bz: number; kind: 'solid' | 'glass'; room: string }

export interface NavGrid {
  blockedCells: Set<string>;
  blockedEdges: Set<string>;
  walls: WallSegment[];
}

export function buildNavGrid(rooms: Room[] = ROOMS, blocked: Set<string> = blockedCellsFor(FURNITURE)): NavGrid {
  const blockedEdges = new Set<string>();
  const walls: WallSegment[] = [];
  for (const r of rooms) {
    if (r.walls === 'none') continue;
    for (let x = r.x; x < r.x + r.w; x++) {
      for (let z = r.z; z < r.z + r.d; z++) {
        for (const side of ['n', 's', 'e', 'w'] as Side[]) {
          const [dx, dz] = SIDE_DIR[side];
          const nx = x + dx, nz = z + dz;
          if (inRoom(r, nx, nz) || !inGrid(nx, nz)) continue;
          if (r.doors.some((d) => d.x === x && d.z === z && d.side === side)) continue;
          const k = edgeKey(x, z, nx, nz);
          if (!blockedEdges.has(k)) {
            blockedEdges.add(k);
            walls.push({ ax: x, az: z, bx: nx, bz: nz, kind: r.walls, room: r.id });
          }
        }
      }
    }
  }
  return { blockedCells: blocked, blockedEdges, walls };
}

/** Centre and orientation of a wall edge, for rendering. */
export function wallGeometry(w: { ax: number; az: number; bx: number; bz: number }): { cx: number; cz: number; alongX: boolean } {
  if (w.ax === w.bx) return { cx: w.ax + 0.5, cz: Math.max(w.az, w.bz), alongX: true };
  return { cx: Math.max(w.ax, w.bx), cz: w.az + 0.5, alongX: false };
}

export interface OuterWall { cx: number; cz: number; alongX: boolean; normal: [number, number] }

/** Building perimeter, one unit segment each, excluding the entrance. */
export function outerWalls(): OuterWall[] {
  const out: OuterWall[] = [];
  for (let x = 0; x < GRID.w; x++) {
    out.push({ cx: x + 0.5, cz: 0, alongX: true, normal: [0, -1] });
    if (!ENTRANCE.some((d) => d.x === x)) out.push({ cx: x + 0.5, cz: GRID.d, alongX: true, normal: [0, 1] });
  }
  for (let z = 0; z < GRID.d; z++) {
    out.push({ cx: 0, cz: z + 0.5, alongX: false, normal: [-1, 0] });
    out.push({ cx: GRID.w, cz: z + 0.5, alongX: false, normal: [1, 0] });
  }
  return out;
}

export function roomAt(x: number, z: number): Room | undefined {
  return ROOMS.find((r) => inRoom(r, Math.floor(x), Math.floor(z)));
}

export const roomById = (id: string): Room => {
  const r = ROOMS.find((q) => q.id === id);
  if (!r) throw new Error('unknown room ' + id);
  return r;
};
