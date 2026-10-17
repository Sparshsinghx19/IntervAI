'use client';

import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { facePointAt, headNormalAt, headPoint, headPointAt } from './geometry';
import { EYE, type CoachGeometries, type CoachMaterials } from './useCoachAssets';
import type { CoachPointer } from './types';

interface CoachBodyProps {
  geometries: CoachGeometries;
  materials: CoachMaterials;
  pointer: MutableRefObject<CoachPointer>;
  reducedMotion: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const RING_BASE = new THREE.Color('#b26bff');

// Body layout (units relative to the waist). Derived from the front/side/back sheets.
const HEAD_PIVOT_Y = 0.36;
const HEAD_OFFSET = 0.53;
const SHOULDER_X = 0.56;
const SHOULDER_Y = 0.05;

function quatFromTo(from: THREE.Vector3, to: THREE.Vector3) {
  return new THREE.Quaternion().setFromUnitVectors(from, to.clone().normalize());
}

export function CoachBody({ geometries: g, materials: m, pointer, reducedMotion }: CoachBodyProps) {
  const rootRef = useRef<THREE.Group>(null);
  const upperRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const antennaRef = useRef<THREE.Group>(null);
  const armRefs = useRef<(THREE.Group | null)[]>([]);
  const elbowRefs = useRef<(THREE.Group | null)[]>([]);
  const eyeRefs = useRef<(THREE.Group | null)[]>([]);
  const arcRefs = useRef<(THREE.Group | null)[]>([]);
  const ovalRefs = useRef<(THREE.Group | null)[]>([]);
  const emblemGlowRef = useRef<THREE.Mesh>(null);
  const emblemRingRef = useRef<THREE.Mesh>(null);

  // Mutable animation state — never touches React state.
  const anim = useRef({
    nextBlink: 2.5,
    blinkStart: -10,
    nextExpression: 9,
    curious: false,
    nextGlance: 2,
    glanceX: 0,
    glanceY: 0,
  });

  // Surface-anchored placements, computed once from the helmet math.
  const layout = useMemo(() => {
    const eyes = [-1, 1].map((s) => {
      const theta = s * EYE.x;
      const centre = facePointAt(theta, EYE.y - 0.02, 0.004);
      const normal = headNormalAt(theta, EYE.y);
      return { centre, back: centre.clone().negate(), quat: quatFromTo(FORWARD, normal) };
    });

    const ears = [-1, 1].map((s) => {
      const theta = (s * Math.PI) / 2;
      const phi = -0.1;
      return {
        pos: headPointAt(theta, phi, 0.012),
        quat: quatFromTo(UP, headNormalAt(theta, phi)),
      };
    });

    const antennaBase = headPoint(new THREE.Vector3(0.6, 0.78, -0.1).normalize(), -0.01);
    const antennaDir = new THREE.Vector3(0.24, 1, -0.07).normalize();

    return {
      eyes,
      ears,
      antenna: { base: antennaBase, quat: quatFromTo(UP, antennaDir), rod: antennaDir.clone().multiplyScalar(0.17) },
    };
  }, []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;
    const a = anim.current;
    const motion = reducedMotion ? 0 : 1;
    const damp = THREE.MathUtils.damp;

    // --- Gaze target: pointer when it moved recently, otherwise occasional idle glances.
    const p = pointer.current;
    const pointerActive = !reducedMotion && p.active && performance.now() - p.lastMove < 2600;
    if (!reducedMotion && t > a.nextGlance) {
      const rest = Math.random() < 0.35;
      a.glanceX = rest ? 0 : (Math.random() * 2 - 1) * 0.32;
      a.glanceY = rest ? 0 : (Math.random() * 2 - 1) * 0.1;
      a.nextGlance = t + 2.8 + Math.random() * 3.6;
    }
    const yaw = pointerActive ? p.x * 0.5 : a.glanceX * motion;
    const pitch = pointerActive ? p.y * 0.22 : (a.glanceY + (a.curious ? -0.06 : 0)) * motion;

    // --- Float + posture.
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(t * 1.05) * 0.04 * motion;
    }
    if (upperRef.current) {
      const u = upperRef.current.rotation;
      u.y = damp(u.y, yaw * 0.22, 2.2, dt);
      u.x = damp(u.x, pitch * 0.1 + Math.sin(t * 1.05 + 0.6) * 0.01 * motion, 2.2, dt);
      u.z = damp(u.z, Math.sin(t * 0.55) * 0.014 * motion - yaw * 0.03, 2.2, dt);
    }
    if (headRef.current) {
      const h = headRef.current.rotation;
      h.y = damp(h.y, yaw, 3.4, dt);
      h.x = damp(h.x, pitch + Math.sin(t * 1.05 + 1.2) * 0.012 * motion, 3.4, dt);
      h.z = damp(h.z, -yaw * 0.1 + Math.sin(t * 0.42) * 0.03 * motion + (a.curious ? 0.07 : 0) * motion, 2.4, dt);
    }
    if (antennaRef.current) {
      antennaRef.current.rotation.z = Math.sin(t * 2.2) * 0.025 * motion;
    }

    // --- Restrained arm sway, slightly out of phase with the float.
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const arm = armRefs.current[i];
      const elbow = elbowRefs.current[i];
      if (arm) {
        arm.rotation.x = Math.sin(t * 1.05 + i * 0.9) * 0.04 * motion;
        arm.rotation.z = s * (0.1 + (Math.sin(t * 1.05 + 0.4) * 0.5 + 0.5) * 0.025 * motion);
      }
      if (elbow) {
        elbow.rotation.x = -0.14 - (Math.sin(t * 1.05 + i * 0.9 + 0.5) * 0.5 + 0.5) * 0.06 * motion;
      }
    }

    // --- Eyes: blinks and occasional curious expression.
    if (!reducedMotion) {
      if (t > a.nextExpression) {
        a.curious = !a.curious;
        a.blinkStart = t;
        a.nextExpression = t + (a.curious ? 2.4 : 7 + Math.random() * 5);
        a.nextBlink = t + 2 + Math.random() * 2;
      }
      if (t > a.nextBlink) {
        a.blinkStart = t;
        const double = Math.random() < 0.2;
        a.nextBlink = t + (double ? 0.32 : 2.6 + Math.random() * 3.4);
      }
    }
    const bp = (t - a.blinkStart) / 0.17;
    const blink = bp >= 0 && bp <= 1 ? Math.sin(Math.PI * bp) : 0;
    for (let i = 0; i < 2; i++) {
      const eye = eyeRefs.current[i];
      if (eye) eye.scale.y = 1 - 0.9 * blink;
      const arc = arcRefs.current[i];
      const oval = ovalRefs.current[i];
      if (arc) arc.scale.setScalar(damp(arc.scale.x, a.curious ? 0.001 : 1, 16, dt));
      if (oval) oval.scale.setScalar(damp(oval.scale.x, a.curious ? 1 : 0.001, 16, dt));
    }

    // --- Chest emblem + ear rings breathe together.
    const pulse = 0.5 + 0.5 * Math.sin(t * (reducedMotion ? 0.8 : 1.9));
    const glow = emblemGlowRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (glow) glow.opacity = 0.32 + 0.3 * pulse;
    const ring = emblemRingRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (ring) ring.color.copy(RING_BASE).multiplyScalar(0.85 + 0.35 * pulse);
  });

  return (
    <group ref={rootRef}>
      {/* ============ UPPER BODY (pivots at the waist) ============ */}
      <group position={[0, -0.38, 0]}>
        <group ref={upperRef}>
          <group position={[0, 0.38, 0]}>
            {/* Torso shell */}
            <mesh geometry={g.torso} material={m.shell} />

            {/* Chest seam accents */}
            <mesh geometry={g.seamDash} material={m.seam} position={[0.19, 0.0, 0.252]} rotation={[0, 0.5, Math.PI / 2]} />
            <mesh geometry={g.seamDash} material={m.seam} position={[-0.27, -0.2, 0.2]} rotation={[0, -0.75, 1.25]} />

            {/* IV chest emblem */}
            <group position={[0, -0.03, 0.27]} rotation={[-0.06, 0, 0]}>
              <mesh geometry={g.disc} material={m.joint} rotation={[Math.PI / 2, 0, 0]} scale={[0.128, 0.03, 0.128]} />
              <mesh geometry={g.torus} material={m.joint} position={[0, 0, 0.012]} scale={[0.118, 0.118, 0.06]} />
              <mesh geometry={g.disc} material={m.visor} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]} scale={[0.098, 0.012, 0.098]} />
              <mesh ref={emblemRingRef} geometry={g.thinTorus} material={m.glowRing} position={[0, 0, 0.02]} scale={0.1} />
              <group position={[0, 0, 0.024]}>
                <mesh geometry={g.glyphI} material={m.glowCore} position={[-0.036, 0, 0]} scale={[1, 1, 0.5]} />
                <mesh geometry={g.glyphV} material={m.glowCore} position={[0.0035, 0.002, 0]} rotation={[0, 0, 0.29]} scale={[1, 1, 0.5]} />
                <mesh geometry={g.glyphV} material={m.glowCore} position={[0.0325, 0.002, 0]} rotation={[0, 0, -0.29]} scale={[1, 1, 0.5]} />
              </group>
              <mesh ref={emblemGlowRef} geometry={g.plane} material={m.emblemGlow} position={[0, 0, 0.03]} scale={0.42} />
            </group>

            {/* Back vent panel */}
            <group position={[0, -0.06, -0.262]}>
              <mesh geometry={g.backVent} material={m.shell} />
              <mesh geometry={g.box} material={m.joint} position={[0, 0.014, -0.036]} scale={[0.1, 0.012, 0.012]} />
              <mesh geometry={g.box} material={m.joint} position={[0, -0.014, -0.036]} scale={[0.1, 0.012, 0.012]} />
            </group>

            {/* Neck: collar + ribbed joint */}
            <mesh geometry={g.torus} material={m.joint} position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.17, 0.15, 0.14]} />
            <mesh geometry={g.disc} material={m.joint} position={[0, 0.3, 0]} scale={[0.115, 0.24, 0.115]} />
            {[0.25, 0.315].map((y) => (
              <mesh key={y} geometry={g.torus} material={m.joint} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.13, 0.13, 0.11]} />
            ))}

            {/* Shoulders + arms */}
            {[-1, 1].map((s, i) => (
              <group key={s}>
                {/* Socket ball and collar ring */}
                <mesh geometry={g.sphere} material={m.joint} position={[s * 0.43, SHOULDER_Y - 0.01, 0]} scale={0.09} />
                <mesh geometry={g.disc} material={m.joint} position={[s * 0.5, SHOULDER_Y - 0.01, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.082, 0.07, 0.082]} />

                <group ref={(el) => {
                      armRefs.current[i] = el;
                    }} position={[s * SHOULDER_X, SHOULDER_Y, 0]} rotation={[0, 0, s * 0.1]}>
                  <mesh geometry={g.upperArm} material={m.shell} position={[s * 0.02, 0, 0]} />
                  <mesh geometry={g.torus} material={m.joint} position={[s * 0.02, -0.035, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.122, 0.122, 0.09]} />

                  {/* Elbow */}
                  <group ref={(el) => {
                      elbowRefs.current[i] = el;
                    }} position={[s * 0.02, -0.285, 0]}>
                    <mesh geometry={g.sphere} material={m.joint} scale={0.092} />
                    <mesh geometry={g.torus} material={m.joint} rotation={[Math.PI / 2, 0, 0]} scale={[0.1, 0.1, 0.12]} />
                    <group position={[0, 0.285, 0]}>
                      <mesh geometry={g.forearm} material={m.shell} />
                      {/* Wrist */}
                      <mesh geometry={g.torus} material={m.joint} position={[0, -0.575, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.078, 0.078, 0.1]} />
                      <mesh geometry={g.disc} material={m.joint} position={[0, -0.585, 0]} scale={[0.07, 0.04, 0.07]} />
                      {/* Hand: mitten palm, curled fingers with dark knuckles, thumb */}
                      <group position={[0, -0.6, 0]} scale={1.38}>
                        <mesh geometry={g.palm} material={m.shell} position={[0, -0.075, 0]} />
                        <mesh geometry={g.fingers} material={m.shell} position={[-s * 0.028, -0.15, 0.008]} rotation={[0, 0, s * 0.35]} />
                        {[-0.05, 0, 0.05].map((z) => (
                          <mesh key={z} geometry={g.sphere} material={m.joint} position={[-s * 0.072, -0.17, z]} scale={[0.024, 0.03, 0.022]} />
                        ))}
                        <mesh geometry={g.sphere} material={m.joint} position={[-s * 0.045, -0.04, 0.07]} scale={0.03} />
                        <mesh geometry={g.thumb} material={m.shell} position={[-s * 0.06, -0.075, 0.085]} rotation={[0.55, 0, s * 0.35]} />
                      </group>
                    </group>
                  </group>
                </group>
              </group>
            ))}

            {/* ============ HEAD ============ */}
            <group position={[0, HEAD_PIVOT_Y, 0]}>
              <group ref={headRef}>
                <group position={[0, HEAD_OFFSET, 0]}>
                  <mesh geometry={g.head} material={m.shell} />
                  <mesh geometry={g.crownSeam} material={m.seam} />
                  <mesh geometry={g.backSeam} material={m.seam} />

                  {/* Glass faceplate with a fine dark rim */}
                  <mesh geometry={g.faceplate} material={m.visor} />
                  <mesh geometry={g.faceRim} material={m.joint} />

                  {/* Eyes */}
                  {layout.eyes.map((eye, i) => (
                    // Outer group scales for blinks, inner groups cross-fade expressions — both about the eye centre.
                    <group key={i} ref={(el) => {
                      eyeRefs.current[i] = el;
                    }} position={eye.centre}>
                      <group ref={(el) => {
                      arcRefs.current[i] = el;
                    }}>
                        <group position={eye.back}>
                          <mesh geometry={i === 0 ? g.eyeLeft : g.eyeRight} material={m.glowCore} />
                          <mesh geometry={i === 0 ? g.eyeHaloLeft : g.eyeHaloRight} material={m.glowHalo} />
                        </group>
                      </group>
                      <group ref={(el) => {
                      ovalRefs.current[i] = el;
                    }} quaternion={eye.quat} scale={0.001}>
                        <mesh geometry={g.sphere} material={m.glowCore} scale={[0.042, 0.06, 0.01]} />
                        <mesh geometry={g.sphere} material={m.glowHalo} scale={[0.066, 0.085, 0.008]} position={[0, 0, -0.004]} />
                      </group>
                      <mesh geometry={g.plane} material={m.glowSprite} quaternion={eye.quat} position={[0, 0.01, 0.01]} scale={[0.5, 0.36, 1]} />
                    </group>
                  ))}

                  {/* Ear pods */}
                  {layout.ears.map((ear, i) => (
                    <group key={i} position={ear.pos} quaternion={ear.quat}>
                      <mesh geometry={g.earBezel} material={m.joint} />
                      <mesh geometry={g.earLens} material={m.lens} />
                      <mesh geometry={g.thinTorus} material={m.glowRing} position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.236, 0.236, 0.2]} />
                    </group>
                  ))}

                  {/* Antenna */}
                  <group position={layout.antenna.base}>
                    <group ref={antennaRef}>
                      <mesh geometry={g.sphere} material={m.shell} scale={[0.055, 0.03, 0.055]} quaternion={layout.antenna.quat} />
                      <mesh geometry={g.antenna} material={m.shell} quaternion={layout.antenna.quat} position={layout.antenna.rod} />
                    </group>
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* ============ LOWER BODY ============ */}
      <mesh geometry={g.waist} material={m.joint} />
      <mesh geometry={g.pelvis} material={m.shell} />

      {[-1, 1].map((s) => (
        <group key={s}>
          {/* Hip joint */}
          <mesh geometry={g.sphere} material={m.joint} position={[s * 0.25, -0.56, 0]} scale={0.11} />
          <mesh geometry={g.torus} material={m.joint} position={[s * 0.25, -0.6, 0]} rotation={[Math.PI / 2, 0, s * 0.08]} scale={[0.135, 0.135, 0.12]} />
          {/* Thigh */}
          <mesh geometry={g.thigh} material={m.shell} position={[s * 0.25, -0.6, 0]} rotation={[0, 0, s * 0.08]} />
          {/* Knee */}
          <mesh geometry={g.disc} material={m.joint} position={[s * 0.275, -0.88, 0]} rotation={[0, 0, s * 0.1]} scale={[0.125, 0.07, 0.125]} />
          <mesh geometry={g.torus} material={m.joint} position={[s * 0.275, -0.88, 0]} rotation={[Math.PI / 2, 0, s * 0.1]} scale={[0.13, 0.13, 0.12]} />
          {/* Shin / boot cuff */}
          <mesh geometry={g.shin} material={m.shell} position={[s * 0.3, -0.9, 0]} rotation={[0, 0, s * 0.1]} />
          {/* Ankle ball, set back like the reference */}
          <mesh geometry={g.sphere} material={m.joint} position={[s * 0.34, -1.14, -0.15]} scale={0.135} />
          {/* Boot */}
          <mesh geometry={g.bootCuff} material={m.shell} position={[s * 0.34, -1.1, 0.0]} />
          <mesh geometry={g.boot} material={m.shell} position={[s * 0.36, -1.23, 0.11]} />
          <mesh geometry={g.sole} material={m.joint} position={[s * 0.36, -1.37, 0.11]} />
        </group>
      ))}
    </group>
  );
}
