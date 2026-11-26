// Hand-planned furniture layout at real scale (1 unit = 0.5 m), plus seats and anchors.
// Footprints come from the measured model bounds in the derived pack manifest.
// Renderer-agnostic: no three.js imports here.
import manifest from '../../public/vendor/derived/office-furniture.manifest.json';
import { FURNITURE_SCALE } from './scale';

/** Quarter turns around Y. q=0: model front faces +z (south); 1: +x (east); 2: −z (north); 3: −x (west). */
export type Q = 0 | 1 | 2 | 3;

export interface Item {
  model: string;
  x: number; z: number;     // footprint centre (world units)
  q: Q;
  y?: number;               // base height (items standing on desks / counters)
  room: string;             // room id the item belongs to
  /** Does the item block walking? Default: true for floor-standing items, false for rugs / tabletop items / desk chairs. */
  blocks?: boolean;
}

export interface Seat {
  id: string;
  x: number; z: number;      // chair centre
  face: number;              // facing (radians, 0 = +z) — towards the desk
  approach: { x: number; z: number };  // standing spot beside the chair
  room: string;
}

export interface Anchor { x: number; z: number; face: number; pose: 'sit' | 'stand'; room: string; seat?: string }

type ModelBounds = { min: number[]; max: number[] };
const MODELS = (manifest as { models: Record<string, ModelBounds> }).models;

export function modelSize(model: string): { w: number; d: number; h: number } {
  const m = MODELS[model];
  if (!m) throw new Error('model not in pack: ' + model);
  return { w: (m.max[0] - m.min[0]) * FURNITURE_SCALE, h: (m.max[1] - m.min[1]) * FURNITURE_SCALE, d: (m.max[2] - m.min[2]) * FURNITURE_SCALE };
}

/** Axis-aligned footprint (world units) of an item after its quarter-turn. */
export function footprint(it: Pick<Item, 'model' | 'x' | 'z' | 'q'>): { x0: number; z0: number; x1: number; z1: number } {
  const s = modelSize(it.model);
  const [w, d] = it.q % 2 === 0 ? [s.w, s.d] : [s.d, s.w];
  return { x0: it.x - w / 2, z0: it.z - d / 2, x1: it.x + w / 2, z1: it.z + d / 2 };
}

const NON_BLOCKING = new Set(['rugRectangle', 'rugRound', 'rugRounded', 'chairDesk']);
export const itemBlocks = (it: Item) => it.blocks ?? (!NON_BLOCKING.has(it.model) && !it.y);

const P = Math.PI;
const U: Record<Q, [number, number]> = { 0: [0, 1], 1: [1, 0], 2: [0, -1], 3: [-1, 0] };
const turn = (q: number) => (((q % 4) + 4) % 4) as Q;
export const qToRad = (q: Q) => (q * P) / 2;

const items: Item[] = [];
const seats: Record<string, Seat> = {};
let ROOM = '';
const inRoomOf = (id: string) => { ROOM = id; };
const put = (model: string, x: number, z: number, q: Q = 0, extra: Partial<Item> = {}) =>
  items.push({ model, x, z, q, room: ROOM, ...extra });

const DESK_H = () => modelSize('desk').h;

/**
 * A workstation: desk, monitor (or laptop), keyboard, mouse and desk chair.
 * `q` is the side the person sits on (0 = south of the desk, 1 = east, 2 = north, 3 = west).
 * Registers a seat (chair) with an approach spot beside the chair, on side `approachSide` (+1 / −1).
 */
function workstation(seatId: string | null, x: number, z: number, q: Q, opts: { laptop?: boolean; approachSide?: 1 | -1 } = {}) {
  const [ux, uz] = U[q];
  const [px, pz] = [uz, -ux]; // perpendicular (to the sitter's left)
  put('desk', x, z, q);
  const h = DESK_H();
  if (opts.laptop) put('laptop', x + ux * 0.05, z + uz * 0.05, q, { y: h });
  else {
    put('computerScreen', x - ux * 0.3, z - uz * 0.3, q, { y: h });
    put('computerKeyboard', x + ux * 0.25, z + uz * 0.25, q, { y: h });
    put('computerMouse', x + ux * 0.25 - px * 0.8, z + uz * 0.25 - pz * 0.8, q, { y: h });
  }
  const cx = x + ux * 1.35, cz = z + uz * 1.35;
  put('chairDesk', cx, cz, turn(q + 2));
  if (seatId) {
    const side = opts.approachSide ?? 1;
    seats[seatId] = { id: seatId, x: cx, z: cz, face: qToRad(turn(q + 2)), room: ROOM,
      approach: { x: cx + px * 1.6 * side + ux * 0.4, z: cz + pz * 1.6 * side + uz * 0.4 } };
  }
}

function plant(x: number, z: number) { put('pottedPlant', x, z); }

// ---------------------------------------------------------------- Founder (human) — executive office
inRoomOf('founder_office');
workstation(null, 5.5, 4.0, 2, { laptop: true });          // empty executive chair: the founder is a person, not an avatar
put('books', 6.6, 4.1, 0, { y: DESK_H() });
put('bookcaseClosedWide', 3.6, 0.5, 0);
put('bookcaseClosedWide', 7.4, 0.5, 0);
put('rugRectangle', 5.5, 6.4, 0);
put('chairModernCushion', 4.6, 6.0, 2);
put('chairModernCushion', 6.4, 6.0, 2);
put('loungeDesignSofa', 1.0, 6.4, 1);
put('tableCoffeeGlassSquare', 2.8, 6.4, 0);
put('sideTableDrawers', 10.5, 3.6, 3);
put('lampRoundTable', 10.5, 3.6, 3, { y: modelSize('sideTableDrawers').h });
put('coatRackStanding', 0.7, 9.3);
plant(10.4, 9.3); plant(10.4, 0.6); plant(0.6, 0.6);

// ---------------------------------------------------------------- COO — leadership & coordination
inRoomOf('coo_office');
workstation('coo', 16.0, 3.8, 2);
put('bookcaseClosedWide', 13.0, 0.5, 0);
put('bookcaseClosedWide', 19.3, 0.5, 0);
put('chairModernCushion', 14.9, 5.9, 2);
put('chairModernCushion', 17.1, 5.9, 2);
put('table', 20.0, 7.0, 1);                                  // coordination table
put('chairModernCushion', 18.7, 6.2, 1); put('chairModernCushion', 18.7, 7.8, 1);
put('chairModernCushion', 21.3, 6.2, 3); put('chairModernCushion', 21.3, 7.8, 3);
put('cabinetTelevision', 11.5, 5.4, 1);                      // coordination board (screen off)
put('televisionModern', 11.5, 5.4, 1, { y: modelSize('cabinetTelevision').h });
plant(11.6, 9.3); plant(21.4, 0.6);

// ---------------------------------------------------------------- Boardroom
inRoomOf('boardroom');
for (const x of [25.8, 29.0, 32.2]) put('table', x, 4.6, 0);
for (const x of [25.4, 27.8, 30.2, 32.6]) { put('chairModernFrameCushion', x, 3.0, 0); put('chairModernFrameCushion', x, 6.2, 2); }
put('chairModernFrameCushion', 23.4, 4.6, 1); put('chairModernFrameCushion', 34.6, 4.6, 3);
put('cabinetTelevision', 29.0, 0.5, 0);
put('televisionModern', 29.0, 0.5, 0, { y: modelSize('cabinetTelevision').h });
plant(22.7, 0.7); plant(35.3, 0.7); plant(22.7, 9.3); plant(35.3, 9.3);

// ---------------------------------------------------------------- Research office (slot "admissions") — research & organisation
inRoomOf('admissions_office');
workstation('admissions', 40.2, 3.8, 3, { approachSide: -1 });
put('bookcaseOpen', 37.2, 0.5, 0); put('bookcaseOpen', 38.8, 0.5, 0);
put('bookcaseClosedWide', 36.5, 7.6, 1);
put('sideTable', 42.3, 0.5, 0);
put('books', 41.9, 0.5, 0, { y: modelSize('sideTable').h });
put('lampRoundTable', 42.9, 0.5, 0, { y: modelSize('sideTable').h });
put('cardboardBoxClosed', 41.4, 9.3); put('cardboardBoxClosed', 40.5, 9.3);
put('rugRectangle', 40.2, 7.0, 0);
put('lampSquareFloor', 36.4, 5.6);
plant(44.4, 0.6);

// ---------------------------------------------------------------- Admissions Research Library
inRoomOf('admissions_library');
for (let i = 0; i < 9; i++) put('bookcaseOpen', 46.0 + i * 1.6, 0.5, 0);
for (const tx of [49.5, 55.5]) {
  put('table', tx, 5.0, 0);
  put('books', tx - 0.4, 5.0, 0, { y: modelSize('table').h });
  for (const dx of [-0.8, 0.8]) { put('chairCushion', tx + dx, 3.6, 0); put('chairCushion', tx + dx, 6.4, 2); }
}
put('lampSquareFloor', 59.5, 4.0); put('lampSquareFloor', 52.5, 4.0);
plant(59.4, 9.3);

// ---------------------------------------------------------------- Marketing Manager — creative & collaborative
inRoomOf('marketing_office');
workstation('marketing', 4.4, 19.0, 3);
put('plantSmall2', 4.4, 18.0, 0, { y: DESK_H() });
put('cabinetTelevision', 4.5, 14.5, 0);                      // mood-board screen (off)
put('televisionModern', 4.5, 14.5, 0, { y: modelSize('cabinetTelevision').h });
put('rugRound', 5.0, 23.2, 0);
put('loungeDesignChair', 6.6, 24.6, 2);
put('bookcaseOpenLow', 1.0, 24.0, 1); put('bookcaseOpenLow', 1.0, 22.4, 1);
put('lampRoundFloor', 8.4, 16.0);
plant(0.6, 14.6); plant(0.6, 25.4);

// ---------------------------------------------------------------- Marketing Studio
inRoomOf('marketing_studio');
for (const x of [13.0, 15.8]) { workstation(null, x, 18.0, 2); workstation(null, x, 19.5, 0); }
put('cabinetTelevision', 9.5, 23.6, 1);
put('televisionModern', 9.5, 23.6, 1, { y: modelSize('cabinetTelevision').h });
put('rugRectangle', 18.0, 23.4, 0);
put('loungeSofa', 18.5, 24.9, 2);
put('tableCoffee', 18.5, 22.9, 0);
plant(20.4, 14.6); plant(9.6, 14.6);

// ---------------------------------------------------------------- Central Meeting Room
inRoomOf('meeting_room');
put('table', 27.4, 20.0, 0); put('table', 30.6, 20.0, 0);
for (const x of [26.6, 29.0, 31.4]) { put('chairModernFrameCushion', x, 18.4, 0); put('chairModernFrameCushion', x, 21.6, 2); }
put('chairModernFrameCushion', 24.9, 20.0, 1); put('chairModernFrameCushion', 33.1, 20.0, 3);
put('cabinetTelevision', 21.5, 20.0, 1);
put('televisionModern', 21.5, 20.0, 1, { y: modelSize('cabinetTelevision').h });
plant(21.6, 14.6); plant(36.4, 14.6); plant(21.6, 25.4); plant(36.4, 25.4);

// ---------------------------------------------------------------- Partnerships Pipeline
inRoomOf('bizdev_pipeline');
put('tableGlass', 42.5, 18.5, 0);
for (const dx of [-0.9, 0.9]) { put('chairModernFrameCushion', 42.5 + dx, 17.1, 0); put('chairModernFrameCushion', 42.5 + dx, 19.9, 2); }
workstation(null, 43.0, 23.0, 0, { laptop: true });
put('cabinetTelevision', 49.5, 16.5, 3);                     // pipeline board (screen off)
put('televisionModern', 49.5, 16.5, 3, { y: modelSize('cabinetTelevision').h });
put('cabinetTelevision', 49.5, 23.6, 3);
put('televisionModern', 49.5, 23.6, 3, { y: modelSize('cabinetTelevision').h });
plant(37.6, 14.6);

// ---------------------------------------------------------------- Business Development Specialist — partnerships
inRoomOf('bizdev_office');
workstation('bizdev', 55.0, 19.5, 1);
put('bookcaseClosedWide', 59.5, 16.0, 3); put('bookcaseClosedWide', 59.5, 23.0, 3);
put('tableCoffeeGlassSquare', 53.1, 23.1, 0);
put('loungeChair', 51.6, 24.9, 2); put('loungeChair', 54.6, 24.9, 2);
put('coatRackStanding', 50.7, 14.7);
plant(59.4, 19.5);

// ---------------------------------------------------------------- Collaboration Lounge (kitchenette + seating)
inRoomOf('lounge');
put('kitchenFridgeLarge', 0.8, 31.5, 1);
put('kitchenCabinet', 0.86, 33.32, 1);
put('kitchenSink', 0.86, 34.96, 1);
put('kitchenCabinet', 0.86, 36.6, 1);
put('kitchenCoffeeMachine', 0.86, 36.6, 1, { y: modelSize('kitchenCabinet').h });
put('kitchenCabinet', 0.86, 38.24, 1);
put('kitchenMicrowave', 0.86, 38.24, 1, { y: modelSize('kitchenCabinet').h });
for (const z of [33.8, 35.44, 37.08]) { put('kitchenBar', 4.5, z, 1); put('stoolBar', 5.8, z, 3); }
put('kitchenBarEnd', 4.5, 38.11, 1);
put('rugRounded', 12.5, 37.5, 0);
put('loungeSofa', 12.5, 35.0, 0); put('loungeSofa', 12.5, 40.0, 2);
put('tableCoffee', 12.5, 37.5, 0);
put('loungeChair', 9.4, 37.5, 1);
put('loungeDesignSofa', 17.8, 37.5, 3);
put('lampRoundFloor', 19.4, 43.4);
put('trashcan', 2.6, 30.6);
plant(19.4, 30.6); plant(0.6, 43.4); plant(8.0, 43.4);

// ---------------------------------------------------------------- Reception
inRoomOf('reception');
workstation(null, 31.1, 35.0, 2); workstation(null, 33.9, 35.0, 2);
put('rugRectangle', 25.0, 38.0, 1); put('rugRectangle', 40.0, 38.0, 1);
put('loungeDesignSofa', 23.0, 38.0, 1); put('tableCoffeeGlassSquare', 25.0, 38.0, 0); put('loungeDesignChair', 26.9, 38.0, 3);
put('loungeDesignSofa', 42.0, 38.0, 3); put('tableCoffeeGlassSquare', 40.0, 38.0, 0); put('loungeDesignChair', 38.1, 38.0, 1);
put('lampSquareFloor', 21.0, 35.5); put('lampSquareFloor', 43.3, 35.5);
put('coatRackStanding', 37.2, 31.0);
plant(29.0, 42.9); plant(36.0, 42.9); plant(20.6, 30.6); plant(43.4, 30.6); plant(20.6, 43.4); plant(43.4, 43.4);

// ---------------------------------------------------------------- Records Archive
inRoomOf('archive');
for (const z of [33.5, 37.0, 40.5]) for (const x of [45.6, 48.7, 54.6, 57.7]) put('bookcaseClosedWide', x, z, 0);
put('sideTableDrawers', 46.0, 30.5, 0);
put('cardboardBoxClosed', 46.0, 30.5, 0, { y: modelSize('sideTableDrawers').h });
put('cardboardBoxClosed', 58.8, 43.3); put('cardboardBoxClosed', 57.9, 43.3);
put('lampSquareFloor', 44.5, 43.4);

export const FURNITURE: readonly Item[] = items;
export const SEATS: Readonly<Record<string, Seat>> = seats;

/** Logo wall behind the reception counter (built in code, not an asset). */
export const LOGO_WALL = { x: 32.5, z: 31.2, w: 8, d: 0.3, h: 4.2 } as const;   // 2.1 m high so the logo reads from the overview

/** Branded welcome mat on the reception floor, between the entrance and the counter (built in code, flat, walkable). */
export const WELCOME_MAT = { x: 32.5, z: 40.9, w: 6.4, d: 3.4 } as const;

export const ANCHORS: Record<string, Anchor> = {
  'admissions.seat': { x: seats.admissions.x, z: seats.admissions.z, face: seats.admissions.face, pose: 'sit', room: 'admissions_office', seat: 'admissions' },
  'meeting.standA': { x: 34.6, z: 17.0, face: -P / 2, pose: 'stand', room: 'meeting_room' },
  'coo.visitor': { x: 16.0, z: 7.0, face: P, pose: 'stand', room: 'coo_office' },
  'reception.front': { x: 32.5, z: 37.6, face: P, pose: 'stand', room: 'reception' },
  'lounge.coffee': { x: 2.8, z: 36.6, face: -P / 2, pose: 'stand', room: 'lounge' },
};

/** Cells blocked by furniture: any cell overlapped by a blocking footprint (inflated slightly). */
export function blockedCellsFor(list: readonly Item[], inflate = 0.12): Set<string> {
  const out = new Set<string>();
  for (const it of list) {
    if (!itemBlocks(it)) continue;
    const f = footprint(it);
    for (let x = Math.floor(f.x0 - inflate); x < Math.ceil(f.x1 + inflate); x++) {
      for (let z = Math.floor(f.z0 - inflate); z < Math.ceil(f.z1 + inflate); z++) {
        const ox = Math.min(x + 1, f.x1 + inflate) - Math.max(x, f.x0 - inflate);
        const oz = Math.min(z + 1, f.z1 + inflate) - Math.max(z, f.z0 - inflate);
        if (ox > 0.15 && oz > 0.15) out.add(`${x},${z}`);
      }
    }
  }
  return out;
}

/** Models referenced by the layout (must equal the pack's model list). */
export const USED_MODELS = [...new Set(items.map((i) => i.model))].sort();
