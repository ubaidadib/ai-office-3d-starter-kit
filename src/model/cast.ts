// The four SIMULATED role figures and the seats they use.
// These are visual representations only. Nothing here is driven by records or by any agent.
// Renderer-agnostic: no three.js imports here.
import { SEATS, type Seat } from './layout';
import config from '../../office.config';
import { roleChip, roleTitle } from '../i18n';

export type ActorId = 'coo' | 'marketing' | 'admissions' | 'bizdev';
export const ACTOR_IDS: readonly ActorId[] = ['coo', 'marketing', 'admissions', 'bizdev'];

export interface Actor {
  id: ActorId;
  /** Approved role title with the AI tag (never a human name). */
  display: string;
  /** Short form for the small chip above a walking figure (still tagged AI). */
  chip: string;
  /** Kenney Mini Characters model (CC0). One distinct model per role. */
  model: string;
  /** Department accent (same values as the room thresholds). Never green: green is reserved for LIVE. */
  accent: string;
  homeSeat: string;
  meetingSeat: string;
  homeRoom: string;
}

const actor = (id: ActorId, homeRoom: string): Actor => ({
  id, display: roleTitle(id), chip: roleChip(id), model: config.roles[id].character, accent: config.roles[id].color,
  homeSeat: id, meetingSeat: 'meet.' + id, homeRoom,
});

/** Titles, colours and characters come from office.config.ts. */
export const ACTORS: Record<ActorId, Actor> = {
  coo: actor('coo', 'coo_office'),
  marketing: actor('marketing', 'marketing_office'),
  admissions: actor('admissions', 'admissions_office'),
  bizdev: actor('bizdev', 'bizdev_office'),
};

export const characterUrl = (model: string) => `/vendor/kenney-mini-characters/models/${model}.glb`;

/** Chair model a seat belongs to (seat height and depth are measured per chair model in the scene). */
export type ChairModel = 'chairDesk' | 'chairModernFrameCushion';
export interface CastSeat extends Seat { chair: ChairModel }

const P = Math.PI;
/**
 * Meeting-room seats: existing chairs of the Central Meeting Room (see layout.ts, "Central Meeting Room").
 * `face` points at the table. `approach` is a free standing spot beside the chair.
 */
const MEETING_SEATS: Record<string, CastSeat> = {
  // Head of the table (west end), facing east.
  'meet.coo': { id: 'meet.coo', x: 24.9, z: 20.0, face: P / 2, room: 'meeting_room', chair: 'chairModernFrameCushion', approach: { x: 24.9, z: 18.5 } },
  // North row, facing south.
  'meet.marketing': { id: 'meet.marketing', x: 29.0, z: 18.4, face: 0, room: 'meeting_room', chair: 'chairModernFrameCushion', approach: { x: 27.75, z: 18.15 } },
  'meet.admissions': { id: 'meet.admissions', x: 31.4, z: 18.4, face: 0, room: 'meeting_room', chair: 'chairModernFrameCushion', approach: { x: 32.55, z: 18.15 } },
  // South row, facing north.
  'meet.bizdev': { id: 'meet.bizdev', x: 29.0, z: 21.6, face: P, room: 'meeting_room', chair: 'chairModernFrameCushion', approach: { x: 30.25, z: 21.85 } },
};

/** Every seat a figure can use: the four desk chairs plus the meeting chairs. */
export const CAST_SEATS: Record<string, CastSeat> = {
  ...Object.fromEntries(Object.values(SEATS).map((s) => [s.id, { ...s, chair: 'chairDesk' as ChairModel }])),
  ...MEETING_SEATS,
};

export const castSeat = (id: string): CastSeat => {
  const s = CAST_SEATS[id];
  if (!s) throw new Error('unknown seat ' + id);
  return s;
};
