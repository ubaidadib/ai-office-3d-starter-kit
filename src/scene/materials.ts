// Shared, lit materials. The Kenney files ship unlit materials; we keep their
// colours but use one MeshStandardMaterial per material name so furniture is lit,
// shadowed and shared across every instance. No emissive materials anywhere:
// nothing in the office "glows" or looks switched on (see the honesty rules).
import * as THREE from 'three';

const FINISH: Record<string, { roughness: number; metalness: number; opacity?: number }> = {
  wood: { roughness: 0.72, metalness: 0 },
  woodDark: { roughness: 0.68, metalness: 0 },
  metal: { roughness: 0.45, metalness: 0.25 },
  metalDark: { roughness: 0.5, metalness: 0.2 },
  metalMedium: { roughness: 0.48, metalness: 0.25 },
  metalLight: { roughness: 0.42, metalness: 0.25 },
  glass: { roughness: 0.08, metalness: 0, opacity: 0.45 },
  carpet: { roughness: 0.95, metalness: 0 },
  carpetBlue: { roughness: 0.95, metalness: 0 },
  carpetDarker: { roughness: 0.95, metalness: 0 },
  carpetWhite: { roughness: 0.95, metalness: 0 },
  plant: { roughness: 0.8, metalness: 0 },
  lamp: { roughness: 0.6, metalness: 0 },
  _defaultMat: { roughness: 0.8, metalness: 0 },
};

/** Calibrated palette overrides. Kenney's bright red "carpet" (rugs, some cushions) becomes a warm
 * neutral so departments are identified by their accent colours, not by saturated fabrics. */
const COLOR_OVERRIDE: Record<string, string> = { carpet: '#b3a596', carpetDarker: '#8f8478' };

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** One shared lit material per source material name (colour taken from the source). */
export function litMaterial(src: THREE.Material): THREE.MeshStandardMaterial {
  const name = src.name || '_defaultMat';
  const hit = cache.get(name);
  if (hit) return hit;
  const f = FINISH[name] ?? FINISH._defaultMat;
  const color = COLOR_OVERRIDE[name] ? new THREE.Color(COLOR_OVERRIDE[name]) : (src as THREE.MeshBasicMaterial).color?.clone() ?? new THREE.Color('#cccccc');
  const m = new THREE.MeshStandardMaterial({ name, color, roughness: f.roughness, metalness: f.metalness,
    transparent: f.opacity !== undefined, opacity: f.opacity ?? 1, depthWrite: f.opacity === undefined });
  cache.set(name, m);
  return m;
}

export const sharedMaterialCount = () => cache.size;

export const FLOOR_ROUGHNESS = { wood: 0.62, carpet: 0.96, stone: 0.5 } as const;
