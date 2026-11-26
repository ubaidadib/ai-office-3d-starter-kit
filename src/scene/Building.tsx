// Building shell: floors, interior walls (solid / glass), outer walls with windows,
// door thresholds, logo wall and the selected-room outline. Instanced throughout.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CORRIDOR_FLOOR, GRID, ROOMS, buildNavGrid, inRoom, outerWalls, roomById, wallGeometry } from '../model/floorplan';
import { LOGO_WALL, WELCOME_MAT } from '../model/layout';
import { azFor, facesCamera } from '../model/cameraMath';
import { useOffice } from '../store';
import { probeOff } from '../probe';
import { FLOOR_ROUGHNESS } from './materials';
import { FurnitureInstances } from './FurnitureInstances';
import config from '../../office.config';

/** Brand colours and logo files come from office.config.ts. */
export const BRAND = { navy: config.brand.primary, gold: config.brand.accent } as const;
const LOGO_URL = config.brand.logo;
const MARK_URL = config.brand.mark;

export const WALL_H = 2.2;        // 1.1 m solid partition
export const GLASS_H = 4.2;       // 2.1 m glass partition
export const LOW_H = 0.35;        // lowered wall (camera side of a focused room)
const WALL_T = 0.14;
const OUTER_T = 0.22;

interface Box { x: number; y: number; z: number; sx: number; sy: number; sz: number; color?: string }

function Boxes({ boxes, material, cast = true, receive = true }: { boxes: Box[]; material: THREE.Material; cast?: boolean; receive?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { gl, invalidate } = useThree();
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useLayoutEffect(() => {
    const im = ref.current!;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    boxes.forEach((b, i) => {
      im.setMatrixAt(i, m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.sx, b.sy, b.sz)));
      if (b.color) im.setColorAt(i, c.set(b.color));
    });
    im.count = boxes.length;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    gl.shadowMap.needsUpdate = true;   // static shadows: re-render once when walls change
    invalidate();
  }, [boxes, gl, invalidate]);
  return <instancedMesh ref={ref} args={[geo, material, Math.max(1, boxes.length)]} castShadow={cast} receiveShadow={receive} />;
}

function segBox(cx: number, cz: number, alongX: boolean, y0: number, h: number, t: number, color?: string): Box {
  return { x: cx, y: y0 + h / 2, z: cz, sx: alongX ? 1 + t : t, sy: h, sz: alongX ? t : 1 + t, color };
}

export function Building() {
  const azIndex = useOffice((s) => s.azIndex);
  const fadedRoom = useOffice((s) => s.fadedRoom);
  const selection = useOffice((s) => s.selection);
  const az = azFor(azIndex);
  const nav = useMemo(() => buildNavGrid(), []);

  const mats = useMemo(() => ({
    floor: {
      wood: new THREE.MeshStandardMaterial({ roughness: FLOOR_ROUGHNESS.wood }),
      carpet: new THREE.MeshStandardMaterial({ roughness: FLOOR_ROUGHNESS.carpet }),
      stone: new THREE.MeshStandardMaterial({ roughness: FLOOR_ROUGHNESS.stone }),
    },
    slab: new THREE.MeshStandardMaterial({ color: CORRIDOR_FLOOR, roughness: 0.7 }),
    wall: new THREE.MeshStandardMaterial({ color: '#f5f3ef', roughness: 0.9 }),
    cap: new THREE.MeshStandardMaterial({ color: '#8b8f96', roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#bfd6e6', transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: '#7d848c', roughness: 0.4, metalness: 0.3 }),
    outer: new THREE.MeshStandardMaterial({ color: '#d9d5ce', roughness: 0.85 }),
    accent: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    logo: new THREE.MeshStandardMaterial({ color: BRAND.navy, roughness: 0.55 }),
    gold: new THREE.MeshStandardMaterial({ color: BRAND.gold, roughness: 0.38, metalness: 0.35 }),
    // Matt carpet: a diffuse-only material, so the low sun does not wash the navy out with a highlight.
    mat: new THREE.MeshLambertMaterial({ color: new THREE.Color(BRAND.navy).lerp(new THREE.Color('#ffffff'), 0.05) }),
    outline: new THREE.MeshStandardMaterial({ color: BRAND.navy, roughness: 0.6 }),
  }), []);

  const floors = useMemo(() => {
    const out: Record<'wood' | 'carpet' | 'stone', Box[]> = { wood: [], carpet: [], stone: [] };
    for (const r of ROOMS) out[r.floor.finish].push({ x: r.x + r.w / 2, y: 0.005, z: r.z + r.d / 2, sx: r.w - 0.04, sy: 0.02, sz: r.d - 0.04, color: r.floor.color });
    return out;
  }, []);

  const thresholds = useMemo(() => ROOMS.flatMap((r) => r.walls === 'none' ? [] : r.doors.map((d) => {
    const g = wallGeometry({ ax: d.x, az: d.z, bx: d.x + (d.side === 'e' ? 1 : d.side === 'w' ? -1 : 0), bz: d.z + (d.side === 's' ? 1 : d.side === 'n' ? -1 : 0) });
    return segBox(g.cx, g.cz, g.alongX, 0.012, 0.02, 0.6, r.accent);
  })), []);

  // Interior walls: solid or glass; the focused room's camera-facing walls are lowered.
  const walls = useMemo(() => {
    const solid: Box[] = [], caps: Box[] = [], glass: Box[] = [], frames: Box[] = [];
    const fr = fadedRoom ? roomById(fadedRoom) : null;
    for (const w of nav.walls) {
      const g = wallGeometry(w);
      let lowered = false;
      if (fr) {
        const aIn = inRoom(fr, w.ax, w.az), bIn = inRoom(fr, w.bx, w.bz);
        if (aIn !== bIn) {
          const n: [number, number] = aIn ? [w.bx - w.ax, w.bz - w.az] : [w.ax - w.bx, w.az - w.bz];
          lowered = facesCamera(n, az);
        }
      }
      if (w.kind === 'glass') {
        const h = lowered ? LOW_H : GLASS_H;
        glass.push(segBox(g.cx, g.cz, g.alongX, 0, h, 0.06));
        frames.push(segBox(g.cx, g.cz, g.alongX, h, 0.08, 0.1));
        if (!lowered) frames.push(segBox(g.cx, g.cz, g.alongX, 0, 0.12, 0.1));
      } else {
        const h = lowered ? LOW_H : WALL_H;
        solid.push(segBox(g.cx, g.cz, g.alongX, 0, h, WALL_T));
        caps.push(segBox(g.cx, g.cz, g.alongX, h, 0.05, WALL_T + 0.02));
      }
    }
    return { solid, caps, glass, frames };
  }, [nav, fadedRoom, az]);

  // Outer walls: the two far sides are full height with a window band; the near sides are a low curb.
  const outer = useMemo(() => {
    const wall: Box[] = [], glass: Box[] = [], frames: Box[] = [];
    for (const w of outerWalls()) {
      if (facesCamera(w.normal, az)) { wall.push(segBox(w.cx, w.cz, w.alongX, 0, 0.6, OUTER_T)); continue; }
      wall.push(segBox(w.cx, w.cz, w.alongX, 0, 1.6, OUTER_T));
      wall.push(segBox(w.cx, w.cz, w.alongX, 4.8, 0.8, OUTER_T));
      glass.push(segBox(w.cx, w.cz, w.alongX, 1.6, 3.2, 0.06));
      const idx = Math.floor(w.alongX ? w.cx : w.cz);
      if (idx % 3 === 0) frames.push({ x: w.alongX ? w.cx - 0.5 : w.cx, y: 3.2, z: w.alongX ? w.cz : w.cz - 0.5, sx: 0.12, sy: 3.2, sz: 0.12 });
    }
    return { wall, glass, frames };
  }, [az]);

  // The reception logo wall carries the logo on both faces (lit like any wall; nothing glows).
  const logoTex = useLoader(THREE.TextureLoader, LOGO_URL);
  const logoMat = useMemo(() => {
    logoTex.colorSpace = THREE.SRGBColorSpace;
    logoTex.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.6, alphaTest: 0.02 });
  }, [logoTex]);
  // Fit the logo inside the wall face whatever its shape (portrait, square or wide).
  const img = logoTex.image as { width?: number; height?: number } | undefined;
  const aspect = img?.width && img?.height ? img.width / img.height : 1;
  const maxW = LOGO_WALL.w * 0.86, maxH = LOGO_WALL.h * 0.84;
  const logoW = Math.min(maxW, maxH * aspect), logoH = logoW / aspect;
  const markTex = useLoader(THREE.TextureLoader, MARK_URL);
  const markMat = useMemo(() => {
    markTex.colorSpace = THREE.SRGBColorSpace;
    markTex.anisotropy = 8;
    return new THREE.MeshLambertMaterial({ map: markTex, transparent: true, alphaTest: 0.02 });
  }, [markTex]);

  const outline = useMemo(() => {
    if (selection?.kind !== 'room') return [] as Box[];
    const r = roomById(selection.id), t = 0.14, y = 0.03, h = 0.03;
    return [
      { x: r.x + r.w / 2, y, z: r.z + t / 2 + 0.05, sx: r.w - 0.1, sy: h, sz: t },
      { x: r.x + r.w / 2, y, z: r.z + r.d - t / 2 - 0.05, sx: r.w - 0.1, sy: h, sz: t },
      { x: r.x + t / 2 + 0.05, y, z: r.z + r.d / 2, sx: t, sy: h, sz: r.d - 0.1 },
      { x: r.x + r.w - t / 2 - 0.05, y, z: r.z + r.d / 2, sx: t, sy: h, sz: r.d - 0.1 },
    ];
  }, [selection]);

  return (
    <group>
      <mesh position={[GRID.w / 2, -0.08, GRID.d / 2]} material={mats.slab} receiveShadow>
        <boxGeometry args={[GRID.w + 0.4, 0.16, GRID.d + 0.4]} />
      </mesh>
      <Boxes boxes={floors.wood} material={mats.floor.wood} cast={false} />
      <Boxes boxes={floors.carpet} material={mats.floor.carpet} cast={false} />
      <Boxes boxes={floors.stone} material={mats.floor.stone} cast={false} />
      <Boxes boxes={thresholds} material={mats.accent} cast={false} />
      <Boxes boxes={walls.solid} material={mats.wall} />
      <Boxes boxes={walls.caps} material={mats.cap} />
      <Boxes boxes={walls.glass} material={mats.glass} cast={false} receive={false} />
      <Boxes boxes={walls.frames} material={mats.frame} />
      <Boxes boxes={outer.wall} material={mats.outer} />
      <Boxes boxes={outer.glass} material={mats.glass} cast={false} receive={false} />
      <Boxes boxes={outer.frames} material={mats.frame} />
      <mesh position={[LOGO_WALL.x, LOGO_WALL.h / 2, LOGO_WALL.z]} material={mats.logo} castShadow receiveShadow>
        <boxGeometry args={[LOGO_WALL.w, LOGO_WALL.h, LOGO_WALL.d]} />
      </mesh>
      {/* Gold cap and base line on the logo wall. */}
      <mesh position={[LOGO_WALL.x, LOGO_WALL.h + 0.04, LOGO_WALL.z]} material={mats.gold}>
        <boxGeometry args={[LOGO_WALL.w + 0.08, 0.08, LOGO_WALL.d + 0.08]} />
      </mesh>
      <mesh position={[LOGO_WALL.x, 0.06, LOGO_WALL.z]} material={mats.gold}>
        <boxGeometry args={[LOGO_WALL.w + 0.04, 0.12, LOGO_WALL.d + 0.04]} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[LOGO_WALL.x, LOGO_WALL.h / 2, LOGO_WALL.z + side * (LOGO_WALL.d / 2 + 0.012)]} rotation={[0, side === 1 ? 0 : Math.PI, 0]} material={logoMat}>
          <planeGeometry args={[logoW, logoH]} />
        </mesh>
      ))}
      {/* Welcome mat (accent border, primary-colour field, the mark lying flat). Thinner than a door threshold. */}
      <mesh position={[WELCOME_MAT.x, 0.02, WELCOME_MAT.z]} material={mats.gold} receiveShadow>
        <boxGeometry args={[WELCOME_MAT.w + 0.24, 0.012, WELCOME_MAT.d + 0.24]} />
      </mesh>
      <mesh position={[WELCOME_MAT.x, 0.026, WELCOME_MAT.z]} material={mats.mat} receiveShadow>
        <boxGeometry args={[WELCOME_MAT.w, 0.014, WELCOME_MAT.d]} />
      </mesh>
      <mesh position={[WELCOME_MAT.x, 0.036, WELCOME_MAT.z]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} material={markMat}>
        <planeGeometry args={[WELCOME_MAT.d * 0.72, WELCOME_MAT.d * 0.72]} />
      </mesh>
      {outline.length > 0 && <Boxes boxes={outline} material={mats.outline} cast={false} />}
      {!probeOff('furniture') && <FurnitureInstances />}
    </group>
  );
}
