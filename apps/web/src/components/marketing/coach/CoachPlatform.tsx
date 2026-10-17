import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CoachPlatformProps {
  shadowTexture: THREE.Texture;
  reducedMotion: boolean;
}

/** Restrained holographic base: two slow counter-rotating rings, a soft glow and a contact shadow. */
export function CoachPlatform({ shadowTexture, reducedMotion }: CoachPlatformProps) {
  const innerRingRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (reducedMotion) return;
    const dt = Math.min(delta, 0.1);
    if (innerRingRef.current) innerRingRef.current.rotation.z -= dt * 0.35;
    if (outerRingRef.current) outerRingRef.current.rotation.z += dt * 0.18;
  });

  return (
    <group position={[0, -1.5, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {/* Contact shadow under the boots */}
        <mesh position={[0, 0, 0.002]} scale={[1.7, 1.15, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={shadowTexture} transparent opacity={0.75} depthWrite={false} />
        </mesh>

        <group ref={innerRingRef}>
          <mesh>
            <ringGeometry args={[1.0, 1.025, 96]} />
            <meshBasicMaterial color="#06b6d4" transparent opacity={0.55} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>

        <group ref={outerRingRef}>
          <mesh>
            <ringGeometry args={[1.32, 1.345, 96, 1, 0, Math.PI * 1.5]} />
            <meshBasicMaterial color="#8b5cf6" transparent opacity={0.4} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh>
            <ringGeometry args={[1.32, 1.345, 64, 1, Math.PI * 1.6, Math.PI * 0.3]} />
            <meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>

        <mesh position={[0, 0, -0.01]}>
          <circleGeometry args={[1.32, 64]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.05} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
