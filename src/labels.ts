// Label registry shared by the DOM layer (outside the canvas) and the projector (inside it).
// Labels are static UI text (room names, nameplates, the SIMULATED tag) — never record text.
import { LOGO_WALL } from './model/layout';
import { ROOMS } from './model/floorplan';
import { DEV } from './mode';
import config from '../office.config';
import { t } from './i18n';

export type LabelKind = 'room' | 'office' | 'employee' | 'sign';

export interface LabelDef {
  id: string;
  kind: LabelKind;
  text: string;
  /** Extra line shown only when zoomed in (level of detail). */
  sub?: string;
  /** A small pill that is ALWAYS shown (e.g. SIMULATED). */
  pill?: string;
  priority: number;
  accent?: string;
  /** Zoom factor (relative to the overview fit) from which `sub` is shown. */
  detailAt: number;
  roomId?: string;
  /** Static world anchor; dynamic labels supply `dynamic` instead. */
  at?: [number, number, number];
  dynamic?: boolean;
}

export const PRIORITY = { employee: 200, selected: 80, office: 50, sign: 40, room: 30 } as const;

// Presentation mode: an office nameplate floats over the back corner of its room, so it never covers
// the figure at the desk; the reception wall carries the real logo, so the floating sign is not needed.
const officeAnchor = (r: (typeof ROOMS)[number]): [number, number, number] =>
  DEV ? [r.x + r.w / 2, 0.6, r.z + r.d / 2] : [r.x + r.w * 0.22, 2.6, r.z + r.d * 0.22];

export const STATIC_LABELS: LabelDef[] = [
  ...ROOMS.map((r): LabelDef => r.occupant
    ? { id: 'room:' + r.id, kind: 'office', text: r.nameplate ?? r.name, sub: DEV ? r.name : undefined, priority: PRIORITY.office,
        accent: r.accent, detailAt: 1.5, roomId: r.id, at: officeAnchor(r) }
    : { id: 'room:' + r.id, kind: 'room', text: r.name, priority: PRIORITY.room, detailAt: 99, roomId: r.id,
        at: DEV ? [r.x + r.w / 2, 0.6, r.z + r.d / 2] : [r.x + r.w * 0.24, r.walls === 'none' ? 0.6 : 2.6, r.z + r.d * 0.24] }),
  ...(DEV ? [{ id: 'sign:logo', kind: 'sign' as const, text: t(config.company.name), sub: `${t(config.company.headquarters)} · ${t(config.disclosure)}`, priority: PRIORITY.sign,
    detailAt: 1.3, at: [LOGO_WALL.x, LOGO_WALL.h + 0.6, LOGO_WALL.z] as [number, number, number] }] : []),
];

export const EMPLOYEE_LABEL_ID = 'employee:admissions';
/** One dynamic label per role figure. */
export const employeeLabelId = (id: string) => 'employee:' + id;

/** Live world position for dynamic labels (written by the scene each frame). */
export const dynamicAnchors = new Map<string, { x: number; y: number; z: number; visible: boolean }>();
