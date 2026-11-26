// Read-only diagnostics used by tools/check-browser.mjs. No data, no records.
import { FrameRecorder, MOVEMENT_FPS, type FrameStats } from './model/frameStats';
export interface FigureInfo { sx: number; sy: number; phase: string; stop: number; visible: boolean; x: number; z: number; show?: string; seat?: string | null; k?: number }
export interface M2Diagnostics {
  frames: number;
  calls: number;
  triangles: number;
  startedAt: number;
  readyAt?: number;
  furnitureParts?: number;
  furnitureBatches?: number;
  furnitureMaterials?: number;
  furnitureInstances?: number;
  cam?: { x: number; z: number; zoom: number; fit: number; az: number; azIndex: number; tweening: boolean; fadedRoom: string | null; follow: boolean };
  figure?: FigureInfo;
  /** One entry per role figure, and sitting accuracy per figure and seat. */
  cast?: Record<string, FigureInfo>;
  castSit?: Record<string, { hipToSeatCm: number; centreCm: number; faceErrDeg: number; seatHeightCm: number }>;
  clock?: { show: number; tour: number; tourId: string | null; paused: boolean };
  tour?: { id: string; index: number; shot: string; total: number } | null;
  /** Test hooks (move the clocks; they change no data). */
  seekTour?: (t: number) => void;
  /** Ask presentation mode to record sitting accuracy (developer mode always does). */
  measureSits?: boolean;
  seekShow?: (t: number) => void;
  sit?: { hipToSeatCm: number; centreCm: number; faceErrDeg: number; seatHeightCm: number };
  labels?: { id: string; x: number; y: number; w: number; h: number; text: string }[];
  dpr?: number;
  antialias?: boolean;
  /** Steady-state frame timing: call frameReset() after warm-up, read frameStats() later. */
  frameReset?: () => void;
  frameStats?: () => FrameStats | null;
  movementFps?: number;
  /** Page language and the config in use (read by the browser check). */
  lang?: string;
  config?: unknown;
}

declare global { interface Window { __m2: M2Diagnostics } }

export const frameRecorder = new FrameRecorder();
window.__m2 = { frames: 0, calls: 0, triangles: 0, startedAt: performance.now(), movementFps: MOVEMENT_FPS,
  frameReset: () => frameRecorder.reset(), frameStats: () => frameRecorder.stats() };
