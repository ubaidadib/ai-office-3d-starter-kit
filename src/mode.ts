// Run mode, chosen once at page load from the address.
//   ?lang=en|ar      language (default: office.config.ts → language.default)
//   (default)        presentation mode: clean frame, 60 fps target, anti-aliasing, guided tour controls
//   ?dev=1           developer mode: navigation panels, hide-figures switch and low-power cadence
//   ?probe=…         developer diagnostics (always developer mode)
//   ?frame=9x16|1x1|16x9   letterbox the stage to a fixed aspect for capture
//   ?autoplay=full|short   start a guided tour as soon as the scene is ready
//   ?clean=1         hide the control dock and the cursor (recording)
import config from '../office.config';
import { t } from './i18n';

const q = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

export const DEV = q.get('dev') === '1' || !!q.get('probe');
export const PRESENT = !DEV;
export const CLEAN = q.get('clean') === '1';
export const AUTOPLAY = (q.get('autoplay') ?? '') as '' | 'full' | 'short';

const FRAMES: Record<string, number> = { '9x16': 9 / 16, '1x1': 1, '4x5': 4 / 5, '16x9': 16 / 9 };
/** Width ÷ height of the capture frame, or null to fill the window. */
export const FRAME_ASPECT: number | null = FRAMES[q.get('frame') ?? ''] ?? null;

/** Quality override for measurements: ?dpr=1|1.5|2 and ?aa=0|1 (presentation mode only). */
export const DPR_OVERRIDE = q.get('dpr') ? Number(q.get('dpr')) : null;
export const AA_OVERRIDE = q.get('aa') === null ? null : q.get('aa') === '1';

/** The only disclosure wording used in presentation mode. Always on screen (text: office.config.ts). */
export const DISCLOSURE = t(config.disclosure);
