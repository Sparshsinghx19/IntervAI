'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { facePointAt, headNormalAt, headPoint, headPointAt } from './geometry';
import { BODY, EYE, type CoachAnchors, type CoachGeometries, type CoachMaterials } from './useCoachAssets';
import type { CoachMood, CoachPointer } from './types';

interface CoachBodyProps {
  geometries: CoachGeometries;
  anchors: CoachAnchors;
  materials: CoachMaterials;
  pointer: MutableRefObject<CoachPointer>;
  reducedMotion: boolean;
  mood?: CoachMood;
}

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const RING_BASE = new THREE.Color('#b26bff');

// Body layout (units relative to the waist). Derived from the front/side/back sheets.
const HEAD_PIVOT_Y = 0.36;
const HEAD_OFFSET = 0.53;
const SHOULDER_X = 0.47;
const SHOULDER_Y = 0.045;
const ARM_OFFSET = 0.145;
const ARM_SPLAY = 0.06;
const HAND_SCALE = 1.24;
const FINGER_Z = [-0.075, -0.025, 0.025, 0.075];
// [y, radius] of the stepped neck rings, narrowing toward the helmet.
const NECK_RINGS: [number, number][] = [
  [0.258, 0.15],
  [0.296, 0.14],
  [0.332, 0.13],
];

function quatFromTo(from: THREE.Vector3, to: THREE.Vector3) {
  return new THREE.Quaternion().setFromUnitVectors(from, to.clone().normalize());
}

export function CoachBody({ geometries: g, anchors, materials: m, pointer, reducedMotion, mood = 'idle' }: CoachBodyProps) {
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
  const eyeHaloRef = useRef<THREE.Mesh>(null);
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

  // Read by the frame loop, so a mood change never re-creates the scene.
  const moodRef = useRef<CoachMood>(mood);
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

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
      emblemQuat: quatFromTo(FORWARD, anchors.emblem.normal),
      ventQuat: quatFromTo(FORWARD, anchors.vent.normal),
      dashQuat: quatFromTo(FORWARD, anchors.dash.normal).multiply(
        new THREE.Quaternion().setFromAxisAngle(FORWARD, Math.PI / 2),
      ),
    };
  }, [anchors]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;
    const a = anim.current;
    const motion = reducedMotion ? 0 : 1;
    const damp = THREE.MathUtils.damp;
    const thinking = moodRef.current === 'thinking';
    const complete = moodRef.current === 'complete';

    // --- Gaze target: pointer when it moved recently, otherwise occasional idle glances.
    const p = pointer.current;
    const pointerActive = !reducedMotion && p.active && performance.now() - p.lastMove < 2600;
    if (!reducedMotion && t > a.nextGlance) {
      const rest = Math.random() < 0.35;
      a.glanceX = rest ? 0 : (Math.random() * 2 - 1) * 0.32;
      a.glanceY = rest ? 0 : (Math.random() * 2 - 1) * 0.1;
      a.nextGlance = t + 2.8 + Math.random() * 3.6;
    }
    // Thinking: a steady, slightly raised gaze to one side instead of wandering glances.
    const yaw = thinking ? 0.2 * motion : pointerActive ? p.x * 0.5 : a.glanceX * motion;
    const pitch = thinking ? -0.11 * motion : pointerActive ? p.y * 0.22 : (a.glanceY + (a.curious ? -0.06 : 0)) * motion;
    const curious = thinking ? true : complete ? false : a.curious;
    const floatSpeed = complete ? 0.7 : 1.05;

    // --- Float + posture.
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(t * floatSpeed) * (complete ? 0.025 : 0.04) * motion;
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
      h.z = damp(h.z, -yaw * 0.1 + Math.sin(t * 0.42) * 0.03 * motion + (curious ? 0.07 : 0) * motion, 2.4, dt);
    }
    if (antennaRef.current) {
      antennaRef.current.rotation.z = Math.sin(t * (thinking ? 5.5 : 2.2)) * (thinking ? 0.05 : 0.025) * motion;
    }

    // --- Restrained arm sway, slightly out of phase with the float.
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const arm = armRefs.current[i];
      const elbow = elbowRefs.current[i];
      if (arm) {
        arm.rotation.x = Math.sin(t * 1.05 + i * 0.9) * 0.04 * motion;
        arm.rotation.z = s * (ARM_SPLAY + (Math.sin(t * 1.05 + 0.4) * 0.5 + 0.5) * 0.025 * motion);
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
      if (arc) arc.scale.setScalar(damp(arc.scale.x, curious ? 0.001 : 1, 16, dt));
      if (oval) oval.scale.setScalar(damp(oval.scale.x, curious ? 1 : 0.001, 16, dt));
    }

    // --- Chest emblem + ear rings breathe together.
    const pulseRate = reducedMotion ? 0.8 : thinking ? 3.4 : complete ? 0.9 : 1.9;
    const pulse = 0.5 + 0.5 * Math.sin(t * pulseRate);
    // Eye halos breathe softly; brighter while thinking.
    const halo = eyeHaloRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (halo) halo.opacity = thinking ? 0.4 + 0.18 * pulse : 0.3 + 0.1 * pulse;
    const glow = emblemGlowRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (glow) glow.opacity = 0.32 + 0.3 * pulse;
    const ring = emblemRingRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (ring) ring.color.copy(RING_BASE).multiplyScalar(0.85 + 0.35 * pulse);
  });

  return (
    <group ref={rootRef}>
      {/* ============ UPPER BODY (pivots at the waist) ============ */}
      <group position={[0, BODY.waistY, 0]}>
        <group ref={upperRef}>
          <group position={[0, -BODY.waistY, 0]}>
            {/* Torso shell with panel seams */}
            <mesh geometry={g.torso} material={m.shell} />
            <mesh geometry={g.torsoSeams} material={m.seam} />
            <mesh geometry={g.seamDash} material={m.seam} position={anchors.dash.pos} quaternion={layout.dashQuat} />

            {/* IV chest emblem, seated into the chest surface */}
            <group position={anchors.emblem.pos} quaternion={layout.emblemQuat}>
              <mesh geometry={g.disc} material={m.joint} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.01]} scale={[0.132, 0.036, 0.132]} />
              <mesh geometry={g.thinTorus} material={m.trim} position={[0, 0, 0.004]} scale={[0.136, 0.136, 0.12]} />
              <mesh geometry={g.disc} material={m.visor} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.006]} scale={[0.104, 0.012, 0.104]} />
              <mesh ref={emblemRingRef} geometry={g.thinTorus} material={m.glowRing} position={[0, 0, 0.013]} scale={0.104} />
              <group position={[0, 0, 0.016]}>
                <mesh geometry={g.glyphI} material={m.glowCore} position={[-0.036, 0, 0]} scale={[1, 1, 0.5]} />
                <mesh geometry={g.glyphV} material={m.glowCore} position={[0.0035, 0.002, 0]} rotation={[0, 0, 0.29]} scale={[1, 1, 0.5]} />
                <mesh geometry={g.glyphV} material={m.glowCore} position={[0.0325, 0.002, 0]} rotation={[0, 0, -0.29]} scale={[1, 1, 0.5]} />
              </group>
              <mesh ref={emblemGlowRef} geometry={g.plane} material={m.emblemGlow} position={[0, 0, 0.024]} scale={0.44} />
            </group>

            {/* Back vent panel */}
            <group position={anchors.vent.pos} quaternion={layout.ventQuat}>
              <mesh geometry={g.backVent} material={m.shell} position={[0, 0, 0.012]} />
              <mesh geometry={g.box} material={m.joint} position={[0, 0.015, 0.046]} scale={[0.1, 0.012, 0.012]} />
              <mesh geometry={g.box} material={m.joint} position={[0, -0.015, 0.046]} scale={[0.1, 0.012, 0.012]} />
            </group>

            {/* Neck: wide collar seated in the shoulders, then stepped rings into the helmet */}
            <mesh geometry={g.torus} material={m.joint} position={[0, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.19, 0.19, 0.17]} />
            <mesh geometry={g.thinTorus} material={m.trim} position={[0, 0.232, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.175, 0.175, 0.3]} />
            <mesh geometry={g.disc} material={m.joint} position={[0, 0.29, 0]} scale={[0.125, 0.2, 0.125]} />
            {NECK_RINGS.map(([y, r]) => (
              <mesh key={y} geometry={g.torus} material={m.joint} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[r, r, r * 0.85]} />
            ))}

            {/* Shoulders + arms */}
            {[-1, 1].map((s, i) => (
              <group key={s}>
                {/* Shoulder ball joint, half-seated in the torso's upper corner */}
                <mesh geometry={g.sphere} material={m.joint} position={[s * SHOULDER_X, SHOULDER_Y, 0]} scale={0.118} />

                <group
                  ref={(el) => {
                    armRefs.current[i] = el;
                  }}
                  position={[s * SHOULDER_X, SHOULDER_Y, 0]}
                  rotation={[0, 0, s * ARM_SPLAY]}
                >
                  {/* Upper arm: domed cap over the ball, dark break line, sleeve */}
                  <group position={[s * ARM_OFFSET, 0, 0]}>
                    <mesh geometry={g.upperArm} material={m.shell} />

                    {/* Elbow hinge */}
                    <group
                      ref={(el) => {
                        elbowRefs.current[i] = el;
                      }}
                      position={[0, -0.265, 0]}
                    >
                      <mesh geometry={g.sphere} material={m.joint} scale={0.095} />
                      <mesh geometry={g.torus} material={m.joint} rotation={[Math.PI / 2, 0, 0]} scale={[0.108, 0.108, 0.12]} />
                      <group position={[0, -0.02, 0]}>
                        <mesh geometry={g.forearm} material={m.shell} />

                        {/* Wrist */}
                        <group position={[0, -0.285, 0]}>
                          <mesh geometry={g.torus} material={m.joint} rotation={[Math.PI / 2, 0, 0]} scale={[0.082, 0.082, 0.1]} />
                          <mesh geometry={g.sphere} material={m.joint} position={[0, -0.02, 0]} scale={[0.075, 0.05, 0.075]} />

                          {/* Fist: rounded back-of-hand shell, padded finger segments over a dark core, thumb */}
                          <group position={[0, -0.02, 0]} scale={HAND_SCALE}>
                            <mesh geometry={g.handBack} material={m.shell} position={[s * 0.012, -0.09, 0]} />
                            <mesh geometry={g.fingerCore} material={m.joint} position={[-s * 0.048, -0.15, 0]} />
                            {FINGER_Z.map((z, k) => (
                              <mesh
                                key={z}
                                geometry={g.fingerPad}
                                material={m.shell}
                                position={[-s * 0.072, -0.152 - Math.abs(k - 1.5) * 0.008, z]}
                                rotation={[0, 0, s * 0.18]}
                              />
                            ))}
                            <mesh geometry={g.sphere} material={m.joint} position={[-s * 0.03, -0.06, 0.095]} scale={0.028} />
                            <mesh geometry={g.thumbPad} material={m.shell} position={[-s * 0.05, -0.1, 0.1]} rotation={[0.2, 0, -s * 0.35]} />
                          </group>
                        </group>
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
                          {/* Both halos share one material, so one ref drives the glow of both eyes. */}
                          <mesh ref={i === 0 ? eyeHaloRef : undefined} geometry={i === 0 ? g.eyeHaloLeft : g.eyeHaloRight} material={m.glowHalo} />
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
          {/* Hip ball joint, housed in the side of the hip armor */}
          <mesh geometry={g.sphere} material={m.joint} position={[s * 0.24, -0.665, 0]} scale={0.118} />
          {/* Thigh shell with a dark ring where it meets the hip */}
          <group position={[s * 0.255, -0.675, 0]} rotation={[0, 0, s * 0.07]}>
            <mesh geometry={g.thigh} material={m.shell} />
            <mesh geometry={g.torus} material={m.joint} position={[0, -0.012, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.15, 0.15, 0.1]} />
          </group>
          {/* Knee: dark band with a rounded joint cap */}
          <group position={[s * 0.285, -0.95, 0]} rotation={[0, 0, s * 0.08]}>
            <mesh geometry={g.disc} material={m.joint} scale={[0.14, 0.07, 0.14]} />
            <mesh geometry={g.torus} material={m.joint} rotation={[Math.PI / 2, 0, 0]} scale={[0.138, 0.138, 0.13]} />
            <mesh geometry={g.sphere} material={m.joint} position={[0, 0, 0.09]} scale={[0.075, 0.065, 0.06]} />
          </group>
          {/* Lower leg flows into the boot */}
          <mesh geometry={g.shin} material={m.shell} position={[s * 0.31, -0.975, 0]} rotation={[0, 0, s * 0.08]} />
          {/* Ankle joint, set back toward the heel like the reference */}
          <mesh geometry={g.sphere} material={m.joint} position={[s * 0.355, -1.18, -0.145]} scale={0.112} />
          {/* Boot shell, toe-cap seam, dark sole */}
          <mesh geometry={g.bootCuff} material={m.shell} position={[s * 0.345, -1.14, 0.0]} />
          <group position={[s * 0.37, -1.27, 0.1]}>
            <mesh geometry={g.boot} material={m.shell} />
            <mesh geometry={g.toeSeam} material={m.seam} />
          </group>
          <mesh geometry={g.sole} material={m.joint} position={[s * 0.37, -1.405, 0.1]} />
        </group>
      ))}
    </group>
  );
}
