'use client';
// 3D title screen: a floating comic island with a castle. Toon shading + ink outlines.
// Idle: the island turns slowly and bobs; the camera follows the pointer a little.
// `diving`: the island swings its gate to the camera and the camera flies through the gate.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';

const INK = '#2a1a0b';
const FLAGS = ['#3d8bff', '#ffcf3e', '#e8402a', '#5fd068'];

function useToonGradient() {
  return useMemo(() => {
    const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
    const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return t;
  }, []);
}

function Toon({ color, outline = 0.06, children, ...props }: { color: string; outline?: number; children: React.ReactNode } & Record<string, any>) {
  const g = useToonGradient();
  return (
    <mesh {...props}>
      {children}
      <meshToonMaterial color={color} gradientMap={g} />
      {outline > 0 && <Outlines thickness={outline} color={INK} />}
    </mesh>
  );
}

function Tower({ x, z, h = 3.6, roof = '#e8402a', flag = '#3d8bff' }: { x: number; z: number; h?: number; roof?: string; flag?: string }) {
  const flagRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (flagRef.current) flagRef.current.rotation.y = Math.sin(clock.elapsedTime * 3 + x) * 0.35; });
  return (
    <group position={[x, 0, z]}>
      <Toon color="#d9d4c7" position={[0, h / 2, 0]}><cylinderGeometry args={[0.75, 0.85, h, 10]} /></Toon>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <Toon key={i} color="#d9d4c7" outline={0.02} position={[Math.cos(a) * 0.72, h + 0.18, Math.sin(a) * 0.72]}><boxGeometry args={[0.3, 0.36, 0.3]} /></Toon>;
      })}
      <Toon color={roof} position={[0, h + 1.05, 0]}><coneGeometry args={[0.95, 1.6, 10]} /></Toon>
      <mesh position={[0, h + 2.25, 0]}><cylinderGeometry args={[0.04, 0.04, 0.9, 6]} /><meshBasicMaterial color={INK} /></mesh>
      <Toon ref={flagRef as any} color={flag} outline={0.015} position={[0.32, h + 2.5, 0]}><boxGeometry args={[0.6, 0.36, 0.03]} /></Toon>
      <Toon color="#4a3b2a" outline={0.015} position={[0, h * 0.6, 0.78]}><boxGeometry args={[0.24, 0.4, 0.05]} /></Toon>
    </group>
  );
}

function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0.5, z]} scale={s}>
      <Toon color="#8b5a2b" position={[0, 0.35, 0]}><cylinderGeometry args={[0.13, 0.18, 0.7, 6]} /></Toon>
      <Toon color="#4fbf20" position={[0, 1.05, 0]}><coneGeometry args={[0.7, 1.1, 7]} /></Toon>
      <Toon color="#5fd068" position={[0, 1.6, 0]}><coneGeometry args={[0.52, 0.9, 7]} /></Toon>
    </group>
  );
}

function House({ x, z, r = 0, roof = '#2f95e6' }: { x: number; z: number; r?: number; roof?: string }) {
  return (
    <group position={[x, 0.5, z]} rotation={[0, r, 0]}>
      <Toon color="#f3dfae" position={[0, 0.45, 0]}><boxGeometry args={[1.1, 0.9, 0.9]} /></Toon>
      <Toon color={roof} position={[0, 1.15, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[0.95, 0.7, 4]} /></Toon>
      <Toon color="#6e4120" outline={0.015} position={[0, 0.3, 0.46]}><boxGeometry args={[0.28, 0.5, 0.04]} /></Toon>
    </group>
  );
}

function Cloud({ position, scale = 1, speed = 0.05 }: { position: [number, number, number]; scale?: number; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  const base = position[0];
  useFrame(({ clock }) => { if (ref.current) ref.current.position.x = base + Math.sin(clock.elapsedTime * speed) * 3; });
  return (
    <group ref={ref} position={position} scale={scale}>
      {[[0, 0, 0, 1], [0.9, -0.15, 0.1, 0.75], [-0.9, -0.2, 0, 0.7], [0.4, 0.45, -0.1, 0.65]].map(([x, y, z, r], i) => (
        <Toon key={i} color="#ffffff" outline={0.03} position={[x, y, z]}><sphereGeometry args={[r, 14, 12]} /></Toon>
      ))}
    </group>
  );
}

function Island({ diving }: { diving: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const reduced = typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useFrame(({ clock }, dt) => {
    const g = ref.current; if (!g) return;
    if (diving) {
      // swing the gate (facing +z) toward the camera along the shortest way
      const target = Math.round(g.rotation.y / (Math.PI * 2)) * Math.PI * 2;
      g.rotation.y += (target - g.rotation.y) * Math.min(1, dt * 6);
    } else if (!reduced) {
      g.rotation.y += dt * 0.12;
    }
    g.position.y = reduced ? 0 : Math.sin(clock.elapsedTime * 0.9) * 0.18;
  });
  return (
    <group ref={ref} rotation={[0, -0.5, 0]}>
      {/* ground */}
      <Toon color="#7cd04a" position={[0, 0.25, 0]}><cylinderGeometry args={[6.2, 6.0, 0.5, 11]} /></Toon>
      <Toon color="#9a6a3e" position={[0, -2.2, 0]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[6.0, 4.4, 11]} /></Toon>
      <Toon color="#7b5230" position={[1.2, -3.8, 0.8]} rotation={[Math.PI, 0.4, 0]}><coneGeometry args={[1.4, 2.4, 6]} /></Toon>
      {/* path to the gate */}
      {[2.3, 3.2, 4.1, 5.0].map((z, i) => <Toon key={i} color="#d9d4c7" outline={0.015} position={[i % 2 ? 0.15 : -0.12, 0.52, z]}><boxGeometry args={[0.9, 0.06, 0.6]} /></Toon>)}
      {/* castle keep */}
      <Toon color="#e6e0d2" position={[0, 1.8, 0]}><boxGeometry args={[3.6, 2.6, 2.8]} /></Toon>
      {Array.from({ length: 7 }, (_, i) => <Toon key={`f${i}`} color="#e6e0d2" outline={0.02} position={[-1.55 + i * 0.52, 3.3, 1.25]}><boxGeometry args={[0.3, 0.4, 0.3]} /></Toon>)}
      {Array.from({ length: 7 }, (_, i) => <Toon key={`b${i}`} color="#e6e0d2" outline={0.02} position={[-1.55 + i * 0.52, 3.3, -1.25]}><boxGeometry args={[0.3, 0.4, 0.3]} /></Toon>)}
      <Toon color="#3b2a1a" position={[0, 1.3, 1.41]}><boxGeometry args={[1.1, 1.5, 0.08]} /></Toon>
      <Toon color="#3b2a1a" position={[0, 2.05, 1.41]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.55, 0.55, 0.08, 16, 1, false, 0, Math.PI]} /></Toon>
      <Toon color="#ffcf3e" outline={0.02} position={[0, 2.8, 1.43]}><boxGeometry args={[1.2, 0.5, 0.06]} /></Toon>
      {/* central keep tower */}
      <Toon color="#d9d4c7" position={[0, 4.1, -0.2]}><cylinderGeometry args={[0.9, 1.0, 2.2, 10]} /></Toon>
      <Toon color="#a54ee0" position={[0, 5.9, -0.2]}><coneGeometry args={[1.15, 1.6, 10]} /></Toon>
      <Tower x={-2} z={1.6} roof="#e8402a" flag={FLAGS[0]} />
      <Tower x={2} z={1.6} roof="#e8402a" flag={FLAGS[1]} />
      <Tower x={-2} z={-1.6} h={3} roof="#2f95e6" flag={FLAGS[2]} />
      <Tower x={2} z={-1.6} h={3} roof="#2f95e6" flag={FLAGS[3]} />
      <Tree x={-4.2} z={1.5} /><Tree x={-3.6} z={-2.8} s={1.2} /><Tree x={4.4} z={-1.2} s={0.9} /><Tree x={3.6} z={3.2} s={1.1} /><Tree x={-1.6} z={4.6} s={0.8} /><Tree x={0.8} z={-4.6} />
      <House x={-3.5} z={3.6} r={0.6} roof="#2f95e6" /><House x={4.3} z={1.4} r={-0.9} roof="#e8402a" /><House x={-4.6} z={-0.9} r={1.4} roof="#ffb40a" />
      {[[2.4, 4.5], [-2.8, -4.6], [5, -3]].map(([x, z], i) => <Toon key={`r${i}`} color="#b8bfcc" outline={0.02} position={[x, 0.65, z]}><dodecahedronGeometry args={[0.35]} /></Toon>)}
    </group>
  );
}

function Rig({ diving, onDived }: { diving: boolean; onDived: () => void }) {
  const { camera, pointer } = useThree();
  const t0 = useRef<number | null>(null);
  const done = useRef(false);
  const look = useMemo(() => new THREE.Vector3(0, 2, 0), []);
  useEffect(() => { if (!diving) { t0.current = null; done.current = false; } }, [diving]);
  useFrame(({ clock }, dt) => {
    if (diving) {
      t0.current ??= clock.elapsedTime;
      const k = Math.min(1, (clock.elapsedTime - t0.current) / 1.15);
      const e = k * k * k; // ease-in: accelerate into the gate
      camera.position.lerp(new THREE.Vector3(0, 1.45, 1.6 + (1 - e) * 2), Math.min(1, dt * (2 + e * 10)));
      look.lerp(new THREE.Vector3(0, 1.35, 0), Math.min(1, dt * 5));
      camera.lookAt(look);
      if (k >= 1 && !done.current) { done.current = true; onDived(); }
      return;
    }
    // idle: slight parallax toward the pointer
    const tx = pointer.x * 1.6, ty = 7 + pointer.y * 0.8;
    camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 2);
    camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 2);
    camera.position.z += (17 - camera.position.z) * Math.min(1, dt * 2);
    look.lerp(new THREE.Vector3(0, 2, 0), Math.min(1, dt * 3));
    camera.lookAt(look);
  });
  return null;
}

export default function TitleScene({ diving, onDived, onReady }: { diving: boolean; onDived: () => void; onReady?: () => void }) {
  return (
    <Canvas style={{ position: "absolute", inset: 0 }} dpr={[1, 1.75]} camera={{ position: [0, 7, 17], fov: 40 }} gl={{ antialias: true, alpha: true }}
      onCreated={() => onReady?.()} aria-hidden="true">
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 8]} intensity={1.6} />
      <directionalLight position={[-8, 4, -6]} intensity={0.4} color="#bfe6ff" />
      <Island diving={diving} />
      <Cloud position={[-8, 5, -4]} scale={1.3} speed={0.12} />
      <Cloud position={[8, 7, -6]} scale={1.6} speed={0.08} />
      <Cloud position={[6, 2, 4]} scale={0.9} speed={0.15} />
      <Cloud position={[-7, 1, 5]} scale={1} speed={0.1} />
      <Rig diving={diving} onDived={onDived} />
    </Canvas>
  );
}
