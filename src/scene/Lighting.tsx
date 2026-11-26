// Three-light rig with ONE static shadow map (rendered on demand, not every frame).
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GRID } from '../model/floorplan';
import { PRESENT } from '../mode';

export function Lighting() {
  const { gl, scene } = useThree();
  const target = useMemo(() => { const o = new THREE.Object3D(); o.position.set(GRID.w / 2, 0, GRID.d / 2); return o; }, []);
  useEffect(() => {
    scene.add(target);
    gl.shadowMap.autoUpdate = false;       // furniture never moves: shadows are rendered once per layout change
    gl.shadowMap.needsUpdate = true;
    return () => { scene.remove(target); };
  }, [gl, scene, target]);
  const half = Math.max(GRID.w, GRID.d) * 0.62;
  return (
    <>
      {/* Presentation mode: slightly warmer key and softer shadow edge; still one static shadow map. */}
      <hemisphereLight args={PRESENT ? ['#f7f9ff', '#b9ae9c', 1.32] : ['#f4f7fb', '#b8b0a3', 1.25]} />
      <directionalLight castShadow position={[GRID.w / 2 - 22, 46, GRID.d / 2 - 26]} target={target}
        intensity={PRESENT ? 2.45 : 2.3} color={PRESENT ? '#ffefd6' : '#fff2df'}
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={PRESENT ? 5 : 3}
        shadow-camera-left={-half} shadow-camera-right={half} shadow-camera-top={half} shadow-camera-bottom={-half}
        shadow-camera-near={1} shadow-camera-far={140} />
      <directionalLight position={[GRID.w / 2 + 30, 24, GRID.d / 2 + 22]} target={target} intensity={0.45} color="#dbe6ff" />
    </>
  );
}
