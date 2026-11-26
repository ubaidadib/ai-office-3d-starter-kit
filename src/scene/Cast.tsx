// The four SIMULATED role figures.
// Each figure is posed every frame from the deterministic show (model/choreography.ts): position,
// facing, clip weights and clip times are all functions of the show clock. Nothing here reads records
// and nothing represents live AI activity. No typing, speech or glowing-screen effects (honesty rules);
// figures only sit, stand, walk, reach and nod.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ACTORS, ACTOR_IDS, castSeat, characterUrl, type ActorId } from '../model/cast';
import { CLIP_S, STRIDE, getSchedule, sample } from '../model/choreography';
import { CHARACTER_SCALE } from '../model/scale';
import { seatCentre, seatedRootPosition } from '../model/sitting';
import { dynamicAnchors, employeeLabelId } from '../labels';
import { useOffice } from '../store';
import { clock } from '../show';
import { DEV } from '../mode';
import { PROBE } from '../probe';
import { chairSeats } from './FurnitureInstances';

/** Clips kept from the Kenney rig (the other 28 are dropped after loading). */
export const CAST_CLIPS = ['idle', 'walk', 'sit', 'interact-right'] as const;

/** Seat-contact point of the posed figure (thigh underside centre), in the figure's local frame. */
function measureContact(root: THREE.Object3D): THREE.Vector3 | null {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const legL = root.getObjectByName('leg-left'), legR = root.getObjectByName('leg-right');
  if (!legL || !legR) return null;
  const hip = legL.getWorldPosition(new THREE.Vector3()).add(legR.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5).applyMatrix4(inv);
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    const pos = sm.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      sm.getVertexPosition(i, v);
      v.applyMatrix4(sm.matrixWorld).applyMatrix4(inv);
      if (v.y < hip.y && v.z > hip.z - 0.25 && v.z < hip.z + 0.45 * CHARACTER_SCALE / 3.8) pts.push(v.clone());
    }
  });
  if (!pts.length) return null;
  const minY = Math.min(...pts.map((p) => p.y));
  const low = pts.filter((p) => p.y < minY + 0.06);
  const c = low.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / low.length);
  return new THREE.Vector3(c.x, minY, c.z);
}

function makeBlobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  grd.addColorStop(0, 'rgba(0,0,0,0.38)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const qLook = new THREE.Quaternion(), eLook = new THREE.Euler(0, 0, 0, 'YXZ'), qLeg = new THREE.Quaternion();
/** How far the legs swing down from the straight sitting pose at a meeting table (0 = straight out, 1 = standing). */
const TABLE_LEG_DROP = 0.5;
const vStand = new THREE.Vector3(), vSeat = new THREE.Vector3(), vProj = new THREE.Vector3();

function Figure({ id, gltf, blobTex, onReady }: { id: ActorId; gltf: GLTF; blobTex: THREE.Texture; onReady: () => void }) {
  const group = useRef<THREE.Group>(null);
  const blob = useRef<THREE.Mesh>(null);
  const { invalidate } = useThree();
  const figuresHidden = useOffice((s) => s.figuresHidden);
  const selected = useOffice((s) => s.selection?.kind === 'figure' && (s.selection.id ?? 'admissions') === id);
  const schedule = useMemo(() => getSchedule(), []);
  const contact = useRef<THREE.Vector3 | null>(null);
  const measuredSeat = useRef<string | null>(null);

  // Lit material (the source is unlit), keep its colour map. No emissive. One mixer, four paused actions:
  // weights and times are set explicitly each frame, so the pose is a pure function of the show clock.
  const rig = useMemo(() => {
    const root = gltf.scene;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshBasicMaterial;
      m.material = new THREE.MeshStandardMaterial({ map: src.map ?? null, color: src.color ?? new THREE.Color('#ffffff'), roughness: 0.8 });
      m.castShadow = false;   // static shadow map; moving figures use a soft blob instead
      m.frustumCulled = false;
    });
    root.scale.setScalar(CHARACTER_SCALE);
    const mixer = new THREE.AnimationMixer(root);
    const action = (name: string) => {
      const src = gltf.animations.find((c) => c.name === name);
      if (!src) throw new Error(`clip ${name} missing in ${ACTORS[id].model}`);
      // The head is posed in code (look direction, nod), so clips must not drive it.
      const clip = src.clone();
      clip.tracks = clip.tracks.filter((t) => !t.name.startsWith('head.'));
      const a = mixer.clipAction(clip);
      a.paused = true; a.setEffectiveWeight(0); a.play();
      return a;
    };
    const head = root.getObjectByName('head') ?? null;
    const legs = ['leg-left', 'leg-right'].map((n) => root.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
    return { root, mixer, idle: action('idle'), walk: action('walk'), sit: action('sit'), reach: action('interact-right'),
      head, headBase: head ? head.quaternion.clone() : new THREE.Quaternion(),
      legs, legRest: legs.map((l) => l.quaternion.clone()), legSit: legs.map((l) => l.quaternion.clone()) };
  }, [gltf, id]);

  const pose = (t: number) => {
    const g = group.current!;
    const s = sample(schedule, id, t);
    // Clip weights.
    rig.sit.weight = s.k;
    rig.walk.weight = s.walk;
    rig.idle.weight = (1 - s.walk) * (1 - 0.45 * s.k);
    rig.reach.weight = s.reach * 1.6;
    // Clip times. Walking is advanced by distance (no foot sliding); idle makes whole cycles per loop (seamless restart).
    rig.sit.time = rig.sit.getClip().duration - 1e-3;
    rig.walk.time = ((s.dist / STRIDE) * CLIP_S.walk) % CLIP_S.walk;
    rig.idle.time = ((s.t / schedule.loop) * Math.round(schedule.loop / CLIP_S.idle) * CLIP_S.idle) % CLIP_S.idle;
    rig.reach.time = s.reachT;
    rig.mixer.update(0);
    // Head: look direction and nod, on top of the bind pose.
    if (rig.head) {
      const nod = s.nod * 0.36 * (0.5 - 0.5 * Math.cos((2 * Math.PI * s.nodT) / CLIP_S.nod));
      eLook.set(nod + 0.07 * s.k * (s.phase === 'desk' ? 1 : 0), s.look, 0);
      rig.head.quaternion.copy(rig.headBase).multiply(qLook.setFromEuler(eLook));
    }
    // Root: on the floor while walking; slides between the standing spot and the calibrated seat position.
    const seat = s.seat ? castSeat(s.seat) : null;
    // At a table the rig's straight-legged sitting pose would put the feet on the table top, so the legs are
    // lowered under it. Set from fixed poses every frame (never from the current value), so it cannot drift.
    if (seat && seat.chair !== 'chairDesk' && s.walk === 0) {
      rig.legs.forEach((leg, i) => leg.quaternion.copy(rig.legRest[i]).slerp(qLeg.copy(rig.legSit[i]).slerp(rig.legRest[i], TABLE_LEG_DROP), s.k));
    }
    const chair = seat ? chairSeats[seat.chair] : null;
    if (seat && s.k > 0 && chair?.ready && contact.current) {
      const r = seatedRootPosition(seat, chair, contact.current);
      vStand.set(seat.approach.x, 0, seat.approach.z);
      g.position.lerpVectors(vStand, vSeat.set(r.x, r.y, r.z), s.k);
    } else g.position.set(s.x, 0, s.z);
    g.rotation.y = s.face;
    return s;
  };

  // Calibrate the sitting pose once (figure at the origin, facing +z), then place the figure.
  useEffect(() => {
    const g = group.current!;
    g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
    rig.sit.weight = 1; rig.walk.weight = 0; rig.idle.weight = 0; rig.reach.weight = 0;
    rig.sit.time = rig.sit.getClip().duration - 1e-3;
    rig.mixer.update(0);
    rig.legs.forEach((leg, i) => rig.legSit[i].copy(leg.quaternion));
    contact.current = measureContact(g);
    pose(clock.show);
    onReady();
    invalidate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ camera, size }) => {
    const g = group.current;
    if (!g) return;
    const hidden = useOffice.getState().figuresHidden;
    const s = pose(clock.show);
    if (blob.current) blob.current.position.set(g.position.x, 0.02, g.position.z);
    // Presentation mode: a figure's own chip shows only while it is on its feet. At its desk the office
    // nameplate names the role; in the meeting the caption does, and faces and gestures stay uncovered.
    dynamicAnchors.set(employeeLabelId(id), { x: g.position.x, y: g.position.y + 3.4, z: g.position.z, visible: !hidden && (DEV || s.k < 1) });
    vProj.copy(g.position).setY(g.position.y + 1.2).project(camera);
    const m2 = window.__m2;
    const phase = s.k === 1 ? 'sit' : s.walk > 0 ? 'walk' : s.seat && s.k > 0 ? 'sitDown' : 'idle';
    const info = { sx: (vProj.x + 1) / 2 * size.width, sy: (1 - vProj.y) / 2 * size.height, phase, stop: s.phase === 'desk' ? 0 : 1, visible: !hidden,
      x: g.position.x, z: g.position.z, show: s.phase, seat: s.seat, k: s.k };
    (m2.cast ??= {})[id] = info;
    if (id === 'admissions') m2.figure = info;
    // Sitting accuracy, measured once per sit (skinning every vertex is too costly to repeat each frame).
    // Developer mode always measures; presentation mode only when a test asks for it (it costs a frame).
    if ((DEV || m2.measureSits) && s.k === 1 && s.seat && measuredSeat.current !== s.seat && s.reach === 0) {
      measuredSeat.current = s.seat;
      const seat = castSeat(s.seat), chair = chairSeats[seat.chair];
      // Measure in the rig's plain sitting pose (no idle overlay, legs not lowered), then restore this frame's pose.
      rig.sit.weight = 1; rig.idle.weight = 0; rig.walk.weight = 0; rig.reach.weight = 0;
      rig.mixer.update(0);
      rig.legs.forEach((leg, i) => leg.quaternion.copy(rig.legSit[i]));
      const c = measureContact(g);
      pose(clock.show);
      if (c && chair?.ready) {
        const centre = seatCentre(seat, chair);
        const wc = c.applyMatrix4(g.matrixWorld);
        const rec = { hipToSeatCm: Math.abs(wc.y - chair.y) * 50, centreCm: Math.hypot(wc.x - centre.x, wc.z - centre.z) * 50, faceErrDeg: 0, seatHeightCm: chair.y * 50 };
        (m2.castSit ??= {})[`${id}@${s.seat}`] = rec;
        if (id === 'admissions' && s.seat === 'admissions') m2.sit = rec;
      }
    }
    if (s.k < 1) measuredSeat.current = null;
  });

  return (
    <>
      <group ref={group} visible={!figuresHidden} name={`simulated-figure:${id}`}>
        <primitive object={rig.root} />
      </group>
      <mesh ref={blob} rotation={[-Math.PI / 2, 0, 0]} visible={!figuresHidden} renderOrder={1}>
        <circleGeometry args={[0.9, 24]} />
        <meshBasicMaterial map={blobTex} transparent depthWrite={false} />
      </mesh>
      {selected && !figuresHidden && <SelectionRing target={group} />}
    </>
  );
}

/** Neutral selection ring (not a provenance colour: green is reserved for LIVE). */
function SelectionRing({ target }: { target: React.RefObject<THREE.Group | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current && target.current) ref.current.position.set(target.current.position.x, 0.04, target.current.position.z); });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.0, 1.18, 40]} />
      <meshBasicMaterial color="#0B1530" />
    </mesh>
  );
}

export function Cast() {
  const gltfs = useLoader(GLTFLoader, ACTOR_IDS.map((id) => characterUrl(ACTORS[id].model)));
  const blobTex = useMemo(makeBlobTexture, []);
  const ready = useRef(0);
  const onReady = () => { if (++ready.current === ACTOR_IDS.length) useOffice.getState().setCharacterReady(); };
  return <>{ACTOR_IDS.map((id, i) => <Figure key={id} id={id} gltf={gltfs[i]} blobTex={blobTex} onReady={onReady} />)}</>;
}

// ---------------------------------------------------------------- developer aid: ?probe=sheet
const ALL_MODELS = ['female-a', 'female-b', 'female-c', 'female-d', 'female-e', 'female-f', 'male-a', 'male-b', 'male-c', 'male-d', 'male-e', 'male-f', 'male-g'].map((m) => 'character-' + m);

/** Every shipped character model, standing in a row in Reception, for choosing the cast (developer mode only). */
export function CharacterSheet() {
  const gltfs = useLoader(GLTFLoader, ALL_MODELS.map(characterUrl));
  useEffect(() => { useOffice.getState().setCharacterReady(); }, []);
  return (
    <>
      {gltfs.map((g, i) => {
        g.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const src = m.material as THREE.MeshBasicMaterial;
          if (!(m.material as THREE.Material & { isMeshStandardMaterial?: boolean }).isMeshStandardMaterial) m.material = new THREE.MeshStandardMaterial({ map: src.map ?? null, roughness: 0.8 });
          m.frustumCulled = false;
        });
        g.scene.scale.setScalar(CHARACTER_SCALE);
        return <primitive key={ALL_MODELS[i]} object={g.scene} position={[23 + (i % 7) * 3, 0, i < 7 ? 39.4 : 42]} />;
      })}
    </>
  );
}
export const SHEET = PROBE === 'sheet';
