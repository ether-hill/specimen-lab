'use client';
import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  DepthOfField, EffectComposer, HueSaturation, N8AO, Noise, ToneMapping, Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode, type DepthOfFieldEffect, type EffectComposer as Composer } from 'postprocessing';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, PerspectiveCamera, Vector2, Vector3 } from 'three';
import { registerCapture } from '../lib/export';
import type { RenderParams } from '../lib/params';
import type { GeneratorState } from '../lib/useGenerator';

const KEY_LIGHT = new Vector3(-1.2, 1.4, 1.8);

function Specimen({ mesh, wire, view }: { mesh: BufferGeometry | null; wire: Float32Array | null; view: RenderParams['view'] }) {
  const wireGeo = useMemo(() => {
    if (!wire) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(wire, 3));
    return g;
  }, [wire]);
  useEffect(() => () => wireGeo?.dispose(), [wireGeo]);

  return (
    <>
      {mesh && view !== 'wireframe' && (
        <mesh geometry={mesh}>
          <meshStandardMaterial color="#e6e6e6" roughness={0.55} metalness={0} />
        </mesh>
      )}
      {wireGeo && view !== 'mesh' && (
        <lineSegments geometry={wireGeo} renderOrder={1}>
          <lineBasicMaterial
            color="#bdbdbd"
            transparent={view === 'both'}
            opacity={view === 'both' ? 0.35 : 1}
            depthTest={view !== 'both'}
          />
        </lineSegments>
      )}
    </>
  );
}

/** Focus DOF on the point of the shell nearest the camera, wherever the user orbits. */
function FocusTracker({ dof, offset }: { dof: React.RefObject<DepthOfFieldEffect | null>; offset: number }) {
  useFrame(({ camera }) => {
    const t = dof.current?.target;
    if (t) t.copy(camera.position).normalize().multiplyScalar(1 - offset);
  });
  return null;
}

/** Square PNG through the same post chain: resize the drawing buffer, render once, read, restore. */
function CaptureRegistrar({ composer }: { composer: React.RefObject<Composer | null> }) {
  const { gl, camera } = useThree();
  useEffect(() => {
    registerCapture(async (size) => {
      const c = composer.current;
      if (!c) throw new Error('Composer not ready');
      const cam = camera as PerspectiveCamera;
      const max = gl.capabilities.maxTextureSize;
      if (size > max) throw new Error(`GPU max texture size is ${max}px`);
      const prev = gl.getSize(new Vector2()), prevDpr = gl.getPixelRatio(), prevAspect = cam.aspect;
      try {
        gl.setPixelRatio(1);
        gl.setSize(size, size, false);
        c.setSize(size, size, false);
        cam.aspect = 1;
        cam.updateProjectionMatrix();
        c.render(0);
        // toBlob snapshots the drawing buffer synchronously, before the next composite clears it
        return await new Promise<Blob>((res, rej) =>
          gl.domElement.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
        );
      } finally {
        gl.setPixelRatio(prevDpr);
        gl.setSize(prev.x, prev.y, false);
        c.setSize(prev.x, prev.y, false);
        cam.aspect = prevAspect;
        cam.updateProjectionMatrix();
      }
    });
    return () => registerCapture(null);
  }, [gl, camera, composer]);
  return null;
}

export default function Scene({ gen, render, geometry }: { gen: GeneratorState; render: RenderParams; geometry: BufferGeometry | null }) {
  const dof = useRef<DepthOfFieldEffect>(null);
  const composer = useRef<Composer>(null);
  const keyPos = useMemo(
    () => KEY_LIGHT.clone().applyAxisAngle(new Vector3(0, 0, 1), (render.lightAngle * Math.PI) / 180),
    [render.lightAngle],
  );

  return (
    <Canvas
      camera={{ fov: 30, position: [0, 0, 4], near: 0.5, far: 12 }}
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#000000']} />
      {/* in wireframe views, fade the far side so the front parastichies read */}
      {render.view !== 'mesh' && <fog attach="fog" args={['#000000', 3.2, 4.6]} />}
      <ambientLight intensity={0.12} />
      <directionalLight position={keyPos} intensity={render.lightIntensity} />
      {render.rimLight && <directionalLight position={[0.6, -0.4, -2]} intensity={0.4} />}

      <Specimen mesh={geometry} wire={gen.wire} view={render.view} />
      <OrbitControls enableDamping dampingFactor={0.08} minDistance={1.6} maxDistance={9} enablePan={false} />

      <EffectComposer ref={composer} multisampling={4}>
        <N8AO
          aoRadius={render.aoRadius * gen.medianEdge}
          distanceFalloff={1}
          intensity={render.aoIntensity}
          quality="high"
        />
        <DepthOfField ref={dof} target={[0, 0, 1]} worldFocusRange={0.6} bokehScale={render.dofBokeh} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <HueSaturation saturation={-1} />
        <Vignette offset={0.3} darkness={0.7} />
        <Noise opacity={0.04} premultiply={false} />
      </EffectComposer>
      <FocusTracker dof={dof} offset={render.dofFocus} />
      <CaptureRegistrar composer={composer} />
    </Canvas>
  );
}
