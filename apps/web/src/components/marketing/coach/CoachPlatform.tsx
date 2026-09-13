import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function CoachPlatform() {
  const innerRingRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (innerRingRef.current) innerRingRef.current.rotation.z -= delta * 0.8;
    if (outerRingRef.current) outerRingRef.current.rotation.z += delta * 0.4;
  });

  return (
    <group position={[0, -2.5, 0]}>
      
      {/* 1. THE VERTICAL ENERGY TETHER (Connecting platform to Coach) */}
      <group position={[0, 1.25, 0]}>
        {/* Inner solid beam */}
        <mesh>
          <cylinderGeometry args={[0.02, 0.02, 2.5, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.2} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* Outer soft glow beam */}
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 2.5, 16]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.1} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>

      {/* 2. HOLOGRAPHIC BASE RINGS */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {/* Inner Glowing Ring */}
        <group ref={innerRingRef}>
          <mesh>
            <ringGeometry args={[1.2, 1.25, 64]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
        
        {/* Outer segmented ring simulation */}
        <group ref={outerRingRef}>
          <mesh>
            <ringGeometry args={[1.8, 1.82, 64, 1, 0, Math.PI * 1.5]} />
            <meshBasicMaterial color="#8b5cf6" transparent opacity={0.4} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh>
            <ringGeometry args={[1.8, 1.82, 64, 1, Math.PI * 1.6, Math.PI * 0.3]} />
            <meshBasicMaterial color="#8b5cf6" transparent opacity={0.6} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>

        {/* Base Glow Plate */}
        <mesh position={[0, 0, -0.05]}>
          <circleGeometry args={[1.8, 64]} />
          <meshBasicMaterial color="#8b5cf6" transparent opacity={0.05} />
        </mesh>

        {/* Up-light emitting from the platform onto the Coach */}
        <pointLight position={[0, 0, 0.5]} intensity={20} color="#22d3ee" distance={10} decay={2} />
      </group>
      
    </group>
  );
}
