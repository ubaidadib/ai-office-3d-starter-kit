import { create } from 'zustand';
import type { ActorId } from './model/cast';
import { clock } from './show';

/** A figure selection may name one of the four role figures (default: the `admissions` slot). */
export type Selection = { kind: 'room'; id: string } | { kind: 'figure'; id?: ActorId } | null;
export type TourId = 'full' | 'short';
export type CamCommand =
  | { type: 'overview' } | { type: 'room'; id: string } | { type: 'figure'; id?: ActorId }
  | { type: 'rotate'; dir: 1 | -1 } | { type: 'zoom'; factor: number };

interface OfficeState {
  /** Developer mode switch: hide the four staged figures. */
  figuresHidden: boolean;
  movementPaused: boolean;
  /** Camera rotation in quarter turns (0–3). */
  azIndex: number;
  selection: Selection;
  follow: boolean;
  /** Room whose camera-facing walls are lowered (set by the camera when zoomed into a selected room). */
  fadedRoom: string | null;
  camCommand: (CamCommand & { nonce: number }) | null;
  buildingReady: boolean;
  characterReady: boolean;
  /** Guided tour state. The tour clock itself lives in show.ts (it changes every frame). */
  tourId: TourId | null;
  tourPaused: boolean;
  tourShot: number;
  /** Show room labels and nameplates (presentation mode can hide them). */
  labelsOn: boolean;
  startTour: (id: TourId) => void;
  endTour: () => void;
  toggleTourPause: () => void;
  setTourShot: (i: number) => void;
  setLabelsOn: (v: boolean) => void;
  setFiguresHidden: (v: boolean) => void;
  setMovementPaused: (v: boolean) => void;
  setAzIndex: (k: number) => void;
  select: (s: Selection) => void;
  setFollow: (v: boolean) => void;
  setFadedRoom: (id: string | null) => void;
  command: (c: CamCommand) => void;
  setBuildingReady: () => void;
  setCharacterReady: () => void;
}

let nonce = 0;

export const useOffice = create<OfficeState>((set, get) => ({
  figuresHidden: false,
  movementPaused: false,
  azIndex: 0,
  selection: null,
  follow: false,
  fadedRoom: null,
  camCommand: null,
  buildingReady: false,
  characterReady: false,
  tourId: null,
  tourPaused: false,
  tourShot: 0,
  labelsOn: true,
  // A tour always starts from its first frame, with the staged show slaved to it (repeatable takes).
  startTour: (tourId) => { clock.tour = 0; set({ tourId, tourPaused: false, tourShot: 0, follow: false, selection: null, figuresHidden: false, movementPaused: false }); },
  endTour: () => set({ tourId: null, tourPaused: false, fadedRoom: null }),
  toggleTourPause: () => set({ tourPaused: !get().tourPaused }),
  setTourShot: (tourShot) => { if (get().tourShot !== tourShot) set({ tourShot }); },
  setLabelsOn: (labelsOn) => set({ labelsOn }),
  // Hidden figures can no longer be followed or selected.
  setFiguresHidden: (figuresHidden) => set(figuresHidden
    ? { figuresHidden, follow: false, tourId: null, selection: get().selection?.kind === 'figure' ? null : get().selection }
    : { figuresHidden }),
  setMovementPaused: (movementPaused) => set({ movementPaused }),
  setAzIndex: (k) => set({ azIndex: ((k % 4) + 4) % 4 }),
  select: (selection) => set(selection?.kind === 'figure' && get().figuresHidden ? {} : { selection }),
  setFollow: (follow) => set(follow && get().figuresHidden ? {} : { follow }),
  setFadedRoom: (fadedRoom) => { if (get().fadedRoom !== fadedRoom) set({ fadedRoom }); },
  command: (c) => set({ camCommand: { ...c, nonce: ++nonce } as OfficeState['camCommand'] }),
  setBuildingReady: () => set({ buildingReady: true }),
  setCharacterReady: () => set({ characterReady: true }),
}));

/** Movement runs only when the figures are shown and not paused. */
export const movementActive = (s: Pick<OfficeState, 'figuresHidden' | 'movementPaused'>) =>
  !s.figuresHidden && !s.movementPaused;
