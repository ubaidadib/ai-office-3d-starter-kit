// Projects DOM labels onto the 3D view every rendered frame, applies level of detail by
// zoom, and declutters by priority so no two visible labels overlap.
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { declutter, type LabelBox } from '../model/declutter';
import { PRIORITY, STATIC_LABELS, dynamicAnchors, type LabelDef } from '../labels';
import { labelElements } from '../ui/LabelLayer';
import { useOffice } from '../store';

const v = new THREE.Vector3();
const sizeCache = new Map<string, { w: number; h: number }>();
/** Last values written to each element: DOM writes only happen when something changed. */
const written = new Map<string, { t: string; vis: string }>();
const setVis = (id: string, el: HTMLElement, vis: string, t?: string) => {
  const w = written.get(id) ?? { t: '', vis: '' };
  if (w.vis !== vis) { el.style.visibility = vis; w.vis = vis; }
  if (t !== undefined && w.t !== t) { el.style.transform = t; w.t = t; }
  written.set(id, w);
};

/** The company badge's box in canvas pixels (presentation mode only), with a small margin. */
function badgeBox(canvas: HTMLCanvasElement) {
  const el = document.querySelector('.p-brand');
  if (!el) return null;
  const r = el.getBoundingClientRect(), c = canvas.getBoundingClientRect();
  return { x0: r.left - c.left - 8, x1: r.right - c.left + 8, y0: r.top - c.top - 8, y1: r.bottom - c.top + 8 };
}

export function LabelProjector({ employees }: { employees: LabelDef[] }) {
  useFrame(({ camera, size, gl }) => {
    const cam = camera as THREE.OrthographicCamera;
    const fit = window.__m2.cam?.fit ?? cam.zoom;
    const zf = cam.zoom / fit;
    const { selection: sel, labelsOn, tourId, fadedRoom } = useOffice.getState();
    const badge = badgeBox(gl.domElement);
    const boxes: (LabelBox & { el: HTMLElement; detail: boolean; sx: number; sy: number })[] = [];
    for (const def of [...STATIC_LABELS, ...employees]) {
      const el = labelElements.get(def.id);
      if (!el) continue;
      let pos: [number, number, number] | null = def.at ?? null;
      if (def.dynamic) {
        // Read the hide-figures switch directly (not via the figure's last frame) so the SIMULATED tag can never outlive the figure.
        const d = dynamicAnchors.get(def.id);
        pos = d && d.visible && !useOffice.getState().figuresHidden ? [d.x, d.y, d.z] : null;
      }
      // During a tour the lower-third caption names the room in focus, so its floating label is hidden.
      if (!pos || !labelsOn || (tourId && def.kind === 'room' && def.roomId === fadedRoom)) { setVis(def.id, el, 'hidden'); continue; }
      v.set(pos[0], pos[1], pos[2]).project(cam);
      const sx = (v.x + 1) / 2 * size.width, sy = (1 - v.y) / 2 * size.height;
      const detail = zf >= def.detailAt;
      if (el.dataset.detail !== String(detail)) el.dataset.detail = String(detail);
      const selected = sel?.kind === 'room' ? def.roomId === sel.id : sel?.kind === 'figure' && def.id === 'employee:' + (sel.id ?? 'admissions');
      if (el.dataset.selected !== String(!!selected)) el.dataset.selected = String(!!selected);
      const key = def.id + ':' + detail + ':' + !!selected;
      let s = sizeCache.get(key);
      if (!s || s.w === 0) { s = { w: el.offsetWidth, h: el.offsetHeight }; sizeCache.set(key, s); }
      const x = sx - s.w / 2, y = sy - s.h;   // anchored at bottom-centre
      // Show a label only when it fits wholly inside the frame and clear of the company badge (no half-cut labels).
      const M = 6;
      if (x < M || x + s.w > size.width - M || y < M || y + s.h > size.height - M) { setVis(def.id, el, 'hidden'); continue; }
      if (badge && x < badge.x1 && x + s.w > badge.x0 && y < badge.y1 && y + s.h > badge.y0) { setVis(def.id, el, 'hidden'); continue; }
      const priority = def.priority + (selected ? PRIORITY.selected : 0);
      boxes.push({ id: def.id, x, y, w: s.w, h: s.h, priority, el, detail, sx, sy });
    }
    const keep = declutter(boxes, 4);
    const out: NonNullable<Window['__m2']['labels']> = [];
    for (const b of boxes) {
      const show = keep.has(b.id);
      if (show) {
        setVis(b.id, b.el, 'visible', `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`);
        out.push({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, text: b.el.dataset.text ?? '' });
      } else setVis(b.id, b.el, 'hidden');
    }
    window.__m2.labels = out;
  });
  return null;
}
