import { Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { movementActive, useOffice } from '../store';
import { PROBE, probeOff } from '../probe';
import { Building } from './Building';
import { Cast, CharacterSheet, SHEET } from './Cast';
import { Lighting } from './Lighting';
import { CameraController } from './CameraController';
import { LabelProjector } from './LabelProjector';
import { EMPLOYEE_LABELS } from '../ui/LabelLayer';
import { MOVEMENT_FPS } from '../model/frameStats';
import { frameRecorder } from '../diagnostics';
import { AA_OVERRIDE, DPR_OVERRIDE, PRESENT } from '../mode';
import { clock } from '../show';
import { getTours } from '../model/tour';

/**
 * Developer mode keeps the M2 Retina policy: render at most 1.5× and skip multisampling at ≥1.5×.
 * Presentation mode renders for capture: up to 2× with multisampling (overridable with ?dpr= and ?aa=).
 */
export const DPR = PRESENT ? (DPR_OVERRIDE ?? Math.min(window.devicePixelRatio || 1, 2)) : Math.min(window.devicePixelRatio || 1, 1.5);
export const ANTIALIAS = PRESENT ? (AA_OVERRIDE ?? true) : DPR < 1.5 && !probeOff('aa');

/**
 * Developer mode: drives ≤MOVEMENT_FPS (20) only while the simulated figures move; otherwise nothing renders (idle ≈ 0 % CPU).
 * Presentation mode renders every display frame (frameloop "always"), so this only records diagnostics.
 */
function FrameDriver() {
  const { invalidate, gl } = useThree();
  const active = useOffice((s) => !PRESENT && (movementActive(s) || !!s.tourId) && (s.characterReady || PROBE === 'floor'));
  useEffect(() => {
    invalidate();
    if (!active) return;
    const id = window.setInterval(() => { if (!document.hidden) invalidate(); }, 1000 / MOVEMENT_FPS);
    return () => window.clearInterval(id);
  }, [active, invalidate]);
  useFrame(() => {
    const m = window.__m2;
    m.frames += 1;
    frameRecorder.push(performance.now());
    m.calls = gl.info.render.calls;        // previous frame's draw calls
    m.triangles = gl.info.render.triangles;
  });
  return null;
}

/**
 * Advances the two clocks once per rendered frame, before anything reads them.
 * During a guided tour the staged show is slaved to the tour clock, so every take is identical.
 */
function Director() {
  useEffect(() => {
    window.__m2.seekTour = (t) => { clock.tour = t; };
    window.__m2.seekShow = (t) => { clock.show = t; };
  }, []);
  useFrame((_, rawDelta) => {
    if (document.hidden) return;
    // Real time, so a recording stays in sync even if a frame is slow; only a long stall (a hidden tab) is clipped.
    const delta = Math.min(rawDelta, 0.25);
    const s = useOffice.getState();
    if (!s.characterReady) return;
    if (s.tourId) {
      const tour = getTours()[s.tourId];
      if (!s.tourPaused) clock.tour += delta;
      clock.show = tour.showOffset + Math.min(clock.tour, tour.total);
      if (clock.tour >= tour.total + 1.2) s.endTour();   // hold the closing card briefly, then hand back control
    } else if (movementActive(s)) clock.show += delta;
    window.__m2.clock = { show: clock.show, tour: clock.tour, tourId: s.tourId, paused: s.tourPaused };
  });
  return null;
}

/** Staged loading: the figures load only after the building; then shaders are compiled once. */
function Stage() {
  const buildingReady = useOffice((s) => s.buildingReady);
  const characterReady = useOffice((s) => s.characterReady);
  const { gl, scene, camera, invalidate } = useThree();
  useEffect(() => {
    if (!characterReady && !(buildingReady && probeOff('character'))) return;
    gl.compile(scene, camera);
    gl.shadowMap.needsUpdate = true;
    window.__m2.readyAt = performance.now();
    invalidate();
  }, [buildingReady, characterReady, gl, scene, camera, invalidate]);
  return buildingReady && !probeOff('character') ? <Suspense fallback={null}>{SHEET ? <CharacterSheet /> : <Cast />}</Suspense> : null;
}

export function OfficeScene() {
  if (probeOff('scene')) return null;
  window.__m2.dpr = DPR;
  window.__m2.antialias = ANTIALIAS;
  return (
    <Canvas orthographic frameloop={PRESENT ? 'always' : 'demand'} dpr={DPR}
      shadows={probeOff('shadow') ? false : { type: PRESENT ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap }} camera={{ near: 0.1, far: 400, zoom: 10 }}
      gl={{ antialias: ANTIALIAS, alpha: PRESENT, powerPreference: PRESENT ? 'high-performance' : 'low-power' }}
      onCreated={({ gl }) => {
        // Presentation mode draws the building over the page's navy backdrop (transparent canvas).
        if (PRESENT) gl.setClearColor('#0B1530', 0); else gl.setClearColor('#cdd6e1');
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.shadowMap.autoUpdate = false;
      }}>
      <Lighting />
      <Director />
      <CameraController />
      <FrameDriver />
      {!probeOff('labels') && <LabelProjector employees={EMPLOYEE_LABELS} />}
      {!probeOff('building') && <Suspense fallback={null}>
        <Building />
      </Suspense>}
      <Stage />
    </Canvas>
  );
}
