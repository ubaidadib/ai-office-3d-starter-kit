// All furniture from ONE derived GLB, drawn as one BatchedMesh per shared material.
// After the instances are built, the loader's copy is released (staged loading step 1).
import { useEffect, useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FURNITURE, qToRad } from '../model/layout';
import { FURNITURE_SCALE } from '../model/scale';
import { useOffice } from '../store';
import { litMaterial } from './materials';

export const PACK_URL = '/vendor/derived/office-furniture.glb';

/** Chair seat calibration (chair-local, world units): seat surface height and centre along the chair's facing axis. */
export const chairSeat = { y: 0, forward: 0, ready: false };
/** The same calibration for every chair model a figure sits on (desk chair and meeting chair). */
export const chairSeats: Record<string, { y: number; forward: number; ready: boolean }> = { chairDesk: chairSeat };
const SEAT_MODELS = ['chairDesk', 'chairModernFrameCushion'];

interface Built { meshes: THREE.BatchedMesh[]; parts: number }

/** Normalise a part so every geometry in a batch has the same attributes (position + normal, indexed). */
function normalise(g: THREE.BufferGeometry) {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  return g;
}

/**
 * One BatchedMesh per shared material: every furniture part using that material, in every placement,
 * is drawn in a single call (≈14 draw calls for all furniture instead of one per part).
 */
function buildInstances(scene: THREE.Group): Built {
  scene.updateMatrixWorld(true);
  const byModel = new Map<string, typeof FURNITURE[number][]>();
  for (const it of FURNITURE) (byModel.get(it.model) ?? byModel.set(it.model, []).get(it.model)!).push(it);
  const byMat = new Map<THREE.Material, { geom: THREE.BufferGeometry; placements: typeof FURNITURE[number][]; model: string }[]>();
  let parts = 0;
  for (const wrapper of scene.children) {
    const placements = byModel.get(wrapper.name);
    if (!placements) continue;
    const box = new THREE.Box3().setFromObject(wrapper);
    const c = box.getCenter(new THREE.Vector3());
    const inv = new THREE.Matrix4().copy(wrapper.matrixWorld).invert();
    const geoms: THREE.BufferGeometry[] = [];
    wrapper.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
      g.translate(-c.x, -box.min.y, -c.z);
      g.scale(FURNITURE_SCALE, FURNITURE_SCALE, FURNITURE_SCALE);
      normalise(g);
      geoms.push(g);
      const mat = litMaterial(mesh.material as THREE.Material);
      (byMat.get(mat) ?? byMat.set(mat, []).get(mat)!).push({ geom: g, placements, model: wrapper.name });
      parts++;
    });
    if (SEAT_MODELS.includes(wrapper.name)) calibrateSeat(geoms, (chairSeats[wrapper.name] ??= { y: 0, forward: 0, ready: false }));
  }
  const meshes: THREE.BatchedMesh[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  for (const [mat, list] of byMat) {
    const inst = list.reduce((s, l) => s + l.placements.length, 0);
    const verts = list.reduce((s, l) => s + l.geom.attributes.position.count, 0);
    const idx = list.reduce((s, l) => s + l.geom.index!.count, 0);
    const bm = new THREE.BatchedMesh(inst, verts, idx, mat);
    for (const l of list) {
      const gid = bm.addGeometry(l.geom);
      for (const p of l.placements) {
        const id = bm.addInstance(gid);
        q.setFromAxisAngle(up, qToRad(p.q));
        bm.setMatrixAt(id, m4.compose(new THREE.Vector3(p.x, p.y ?? 0, p.z), q, one));
      }
      l.geom.dispose();
    }
    // Static furniture: no per-instance culling or sorting each frame (CPU), except transparent glass.
    bm.perObjectFrustumCulled = false;
    bm.sortObjects = mat.transparent;
    bm.castShadow = !list.every((l) => l.model.startsWith('rug'));
    bm.receiveShadow = true;
    bm.name = 'furniture:' + mat.name;
    meshes.push(bm);
  }
  return { meshes, parts };
}

/** Find the chair's seat surface by casting rays straight down along its front/back axis. */
function calibrateSeat(geoms: THREE.BufferGeometry[], out: { y: number; forward: number; ready: boolean }) {
  const objs = geoms.map((g) => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const ray = new THREE.Raycaster();
  let height = 0;
  for (const g of geoms) { g.computeBoundingBox(); height = Math.max(height, g.boundingBox!.max.y); }
  const hits: { y: number; z: number }[] = [];
  for (let z = -0.6; z <= 0.6; z += 0.05) {
    ray.set(new THREE.Vector3(0, 10, z), new THREE.Vector3(0, -1, 0));
    const h = ray.intersectObjects(objs, false)[0];
    if (h && h.point.y > height * 0.25 && h.point.y < height * 0.6) hits.push({ y: h.point.y, z });
  }
  if (hits.length) {
    const ys = hits.map((h) => h.y).sort((a, b) => a - b);
    out.y = ys[Math.floor(ys.length / 2)];
    out.forward = hits.reduce((s, h) => s + h.z, 0) / hits.length;
    out.ready = true;
  }
}

export function FurnitureInstances() {
  const gltf = useLoader(GLTFLoader, PACK_URL);
  const built = useMemo(() => buildInstances(gltf.scene), [gltf]);
  const { gl, invalidate } = useThree();
  useEffect(() => {
    // Release the loader's copy: parser, buffers and source geometries are no longer needed.
    useLoader.clear(GLTFLoader, PACK_URL);
    gltf.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    window.__m2.furnitureParts = built.parts;
    window.__m2.furnitureBatches = built.meshes.length;
    window.__m2.furnitureMaterials = new Set(built.meshes.map((m) => (m.material as THREE.Material).uuid)).size;
    window.__m2.furnitureInstances = built.meshes.reduce((n, m) => n + m.instanceCount, 0);
    gl.shadowMap.needsUpdate = true;
    useOffice.getState().setBuildingReady();
    invalidate();
  }, [built, gltf, gl, invalidate]);
  return <group>{built.meshes.map((m) => <primitive key={m.uuid} object={m} />)}</group>;
}
