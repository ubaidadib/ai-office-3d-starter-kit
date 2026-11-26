// Isometric orthographic camera: overview, fly-to-room, follow, drag / trackpad / wheel / pinch,
// keyboard, 90° rotation (Q/E), bounds, and wall fading. Renders only while something changes.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID, ROOMS, roomAt, roomById } from '../model/floorplan';
import { azFor, camDir, clampTarget, clampZoom, easeInOutCubic, fitZoom, lerpAngle, screenAxes, wheelIntent, ELEV } from '../model/cameraMath';
import { useOffice } from '../store';
import { CAMERA_TWEEN_FPS } from '../model/frameStats';
import { getTours, shotStart, tourFrame } from '../model/tour';
import { ACTOR_IDS, type ActorId } from '../model/cast';
import { clock } from '../show';

const DIST = 120;
const FLY_S = 0.6;

interface CamState { x: number; z: number; zoom: number; az: number }
interface Tween { from: CamState; to: CamState; t: number }

export function CameraController() {
  const { camera, gl, size, invalidate } = useThree();
  const cam = camera as THREE.OrthographicCamera;
  const st = useRef<CamState>({ x: GRID.w / 2, z: GRID.d / 2, zoom: 10, az: azFor(0) });
  const fit = useRef(10);
  const tween = useRef<Tween | null>(null);
  /** Room whose walls the running tour shot lowers (null outside a tour). */
  const tourRoom = useRef<string | null>(null);
  const figureOf = (id?: ActorId) => window.__m2.cast?.[id ?? 'admissions'] ?? window.__m2.figure;
  const azIndex = useOffice((s) => s.azIndex);
  const cmd = useOffice((s) => s.camCommand);

  const apply = () => {
    const s = st.current;
    const [cx, cz] = clampTarget(s.x, s.z);
    s.x = cx; s.z = cz;
    s.zoom = clampZoom(s.zoom, fit.current);
    const d = camDir(s.az);
    cam.position.set(s.x + d[0] * DIST, d[1] * DIST, s.z + d[2] * DIST);
    cam.up.set(0, 1, 0);
    cam.lookAt(s.x, 0, s.z);
    cam.zoom = s.zoom;
    cam.updateProjectionMatrix();
    // Lower the camera-facing walls of the selected room once we are zoomed in on it.
    const sel = useOffice.getState().selection;
    useOffice.getState().setFadedRoom(useOffice.getState().tourId ? tourRoom.current : sel?.kind === 'room' && s.zoom > fit.current * 1.6 ? sel.id : null);
    window.__m2.cam = { x: s.x, z: s.z, zoom: s.zoom, fit: fit.current, az: s.az, azIndex: useOffice.getState().azIndex, tweening: !!tween.current,
      fadedRoom: useOffice.getState().fadedRoom, follow: useOffice.getState().follow };
    invalidate();
  };

  const flyTo = (to: Partial<CamState>) => {
    const from = { ...st.current };
    tween.current = { from, to: { ...from, ...to }, t: 0 };
    invalidate();
  };

  const overview = () => {
    const az = azFor(useOffice.getState().azIndex);
    flyTo({ x: GRID.w / 2, z: GRID.d / 2, zoom: fitZoom(GRID.w, GRID.d, az, size.width, size.height), az });
  };

  const frameRoom = (id: string) => {
    const r = roomById(id);
    const az = st.current.az;
    flyTo({ x: r.x + r.w / 2, z: r.z + r.d / 2, zoom: clampZoom(fitZoom(r.w, r.d, az, size.width, size.height, 0.62), fit.current) });
  };

  // Viewport: compute the overview zoom; first time, start at the overview.
  const first = useRef(true);
  useEffect(() => {
    fit.current = fitZoom(GRID.w, GRID.d, st.current.az, size.width, size.height);
    if (first.current) { st.current.zoom = fit.current; first.current = false; }
    apply();
  }, [size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rotation in 90° steps (keeps target and zoom).
  useEffect(() => { flyTo({ az: azFor(azIndex) }); }, [azIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Commands from the navigation panel / labels.
  useEffect(() => {
    if (!cmd) return;
    const s = useOffice.getState();
    if (cmd.type === 'overview') { s.select(null); s.setFollow(false); overview(); }
    else if (cmd.type === 'room') { s.setFollow(false); s.select({ kind: 'room', id: cmd.id }); frameRoom(cmd.id); }
    else if (cmd.type === 'figure') {
      if (s.figuresHidden) return;
      s.select({ kind: 'figure', id: cmd.id }); s.setFollow(true);
      const f = figureOf(cmd.id);
      if (f) flyTo({ x: f.x, z: f.z, zoom: Math.max(st.current.zoom, fit.current * 3) });
    } else if (cmd.type === 'rotate') s.setAzIndex(s.azIndex + cmd.dir);
    else if (cmd.type === 'zoom') flyTo({ zoom: clampZoom(st.current.zoom * cmd.factor, fit.current) });
  }, [cmd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer, wheel, trackpad and keyboard input.
  useEffect(() => {
    const el = gl.domElement;
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ray = new THREE.Raycaster();
    const groundAt = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), cam);
      return ray.ray.intersectPlane(ground, new THREE.Vector3());
    };
    // Taking the camera by hand ends follow mode and any running tour.
    const stopAuto = () => { tween.current = null; const o = useOffice.getState(); o.setFollow(false); if (o.tourId) o.endTour(); };
    const panPixels = (dx: number, dy: number) => {
      const { right, up } = screenAxes(st.current.az);
      const z = st.current.zoom;
      st.current.x += -right[0] * dx / z + up[0] * dy / (z * Math.sin(ELEV));
      st.current.z += -right[1] * dx / z + up[1] * dy / (z * Math.sin(ELEV));
      apply();
    };
    const zoomAt = (factor: number, cx: number, cy: number) => {
      const before = groundAt(cx, cy);
      st.current.zoom = clampZoom(st.current.zoom * factor, fit.current);
      cam.zoom = st.current.zoom; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      const after = groundAt(cx, cy);
      if (before && after) { st.current.x += before.x - after.x; st.current.z += before.z - after.z; }
      apply();
    };
    let drag: { x: number; y: number; moved: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.moved > 4) { stopAuto(); panPixels(dx, dy); }
    };
    const up = (e: PointerEvent) => {
      if (drag && drag.moved <= 4) {           // a click: select the figure or a room
        const p = groundAt(e.clientX, e.clientY);
        const s = useOffice.getState();
        const hit = p && ACTOR_IDS.find((id) => { const f = window.__m2.cast?.[id]; return f && f.visible && Math.hypot(p.x - f.x, p.z - f.z) < 1.4; });
        if (s.tourId) { /* clicks do nothing during a tour */ }
        else if (hit) s.command({ type: 'figure', id: hit });
        else if (p) { const r = roomAt(p.x, p.z); if (r) s.command({ type: 'room', id: r.id }); }
      }
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      // Ignore wheels over HUD panels (legend, navigation); scene labels do NOT block zoom or pan.
      if ((e.target as HTMLElement | null)?.closest?.('.panel')) return;
      e.preventDefault();
      stopAuto();
      const intent = wheelIntent(e);
      if (intent === 'pinch') zoomAt(Math.exp(-e.deltaY * 0.012), e.clientX, e.clientY);
      else if (intent === 'zoom') zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY);
      else panPixels(-e.deltaX, -e.deltaY);
    };
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'SELECT' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const s = useOffice.getState();
      const k = e.key.toLowerCase();
      const step = 60;
      // Tour and presentation keys.
      if (k === 'f' && e.shiftKey) { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen(); e.preventDefault(); return; }
      if (s.tourId) {
        const tour = getTours()[s.tourId];
        if (k === ' ') s.toggleTourPause();
        else if (k === 'r') { clock.tour = 0; if (s.tourPaused) s.toggleTourPause(); }
        else if (k === 'escape') s.endTour();
        else if (k === 'arrowright') clock.tour = shotStart(tour, Math.min(tour.shots.length - 1, s.tourShot + 1));
        else if (k === 'arrowleft') clock.tour = shotStart(tour, Math.max(0, s.tourShot - (clock.tour - shotStart(tour, s.tourShot) < 1 ? 1 : 0)));
        else return;
        e.preventDefault();
        return;
      }
      if (k === 't') { s.startTour(e.shiftKey ? 'short' : 'full'); e.preventDefault(); return; }
      if (k === 'l') { s.setLabelsOn(!s.labelsOn); invalidate(); e.preventDefault(); return; }
      if (k === ' ' || k === 'p') { s.setMovementPaused(!s.movementPaused); e.preventDefault(); return; }
      if (k === 'arrowleft' || k === 'a') { stopAuto(); panPixels(step, 0); }
      else if (k === 'arrowright' || k === 'd') { stopAuto(); panPixels(-step, 0); }
      else if (k === 'arrowup' || k === 'w') { stopAuto(); panPixels(0, step); }
      else if (k === 'arrowdown' || k === 's') { stopAuto(); panPixels(0, -step); }
      else if (k === '+' || k === '=') s.command({ type: 'zoom', factor: 1.25 });
      else if (k === '-' || k === '_') s.command({ type: 'zoom', factor: 0.8 });
      else if (k === 'q') s.command({ type: 'rotate', dir: -1 });
      else if (k === 'e') s.command({ type: 'rotate', dir: 1 });
      else if (k === 'home' || k === 'h' || k === '0') s.command({ type: 'overview' });
      else if (k === 'f') s.command({ type: 'figure' });
      else if (k === 'escape') { s.setFollow(false); s.select(null); }
      else return;
      e.preventDefault();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    // Wheel / pinch on the whole view (canvas + label layer), so labels under the pointer never swallow zoom.
    const view = (el.closest('.app') as HTMLElement | null) ?? el;
    view.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      view.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', key);
    };
  }, [cam, gl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tweens and follow mode (frames are requested only while they run).
  useFrame((_, delta) => {
    // A running tour owns the camera. Its state is a pure function of the tour clock.
    const tourId = useOffice.getState().tourId;
    if (tourId) {
      const tour = getTours()[tourId];
      const f = tourFrame(tour, clock.tour, size.width, size.height);
      tween.current = null;
      tourRoom.current = f.shot.room ?? null;
      st.current = { ...f.cam };
      if (useOffice.getState().azIndex !== 0) useOffice.getState().setAzIndex(0);
      useOffice.getState().setTourShot(f.index);
      window.__m2.tour = { id: tourId, index: f.index, shot: f.shot.id, total: tour.total };
      apply();
      return;
    }
    if (window.__m2.tour) window.__m2.tour = null;
    const tw = tween.current;
    if (tw) {
      tw.t = Math.min(1, tw.t + delta / FLY_S);
      const k = easeInOutCubic(tw.t);
      st.current = { x: tw.from.x + (tw.to.x - tw.from.x) * k, z: tw.from.z + (tw.to.z - tw.from.z) * k,
        zoom: tw.from.zoom + (tw.to.zoom - tw.from.zoom) * k, az: lerpAngle(tw.from.az, tw.to.az, k) };
      if (tw.t >= 1) tween.current = null;
      apply();
      if (tween.current) setTimeout(invalidate, 1000 / CAMERA_TWEEN_FPS);
    }
    const s = useOffice.getState();
    const f = figureOf(s.selection?.kind === 'figure' ? s.selection.id : undefined);
    if (s.follow && f && f.visible && !tween.current) {
      // Time-based easing, so follow feels the same at 20 fps (developer mode) and 60 fps (presentation mode).
      const ease = 1 - Math.exp(-Math.min(delta, 0.1) * 6);
      st.current.x += (f.x - st.current.x) * ease;
      st.current.z += (f.z - st.current.z) * ease;
      apply();
    }
  });

  // Keep "rooms" referenced for the navigation list ordering (no runtime cost).
  void ROOMS;
  return null;
}
