import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  FACE,
  createEyeArcGeometry,
  createFaceplateGeometry,
  createHeadGeometry,
  createLathe,
  createRadialTexture,
  createSuperEllipsoid,
  createSurfaceTube,
  warpWaist,
} from './geometry';

export const EYE = { x: 0.33, y: -0.07 };
const CROWN_PHI = 0.8;

function createMaterials() {
  return {
    // Pearl-white ceramic armor with a clear lacquer coat.
    shell: new THREE.MeshPhysicalMaterial({
      color: '#f2f3f9',
      roughness: 0.34,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.09,
      sheen: 0.12,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#d9d4ff'),
    }),
    // Glossy black glass faceplate / emblem lens.
    // Ear lenses: black, slightly satin so side lighting doesn't wash them out.
    lens: new THREE.MeshPhysicalMaterial({
      color: '#040508',
      roughness: 0.35,
      metalness: 0.2,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.3,
    }),
    visor: new THREE.MeshPhysicalMaterial({
      color: '#030408',
      roughness: 0.1,
      metalness: 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.3,
    }),
    // Dark gunmetal joints and trim.
    joint: new THREE.MeshPhysicalMaterial({
      color: '#15171f',
      roughness: 0.26,
      metalness: 0.7,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    }),
    // Recessed panel seams.
    seam: new THREE.MeshStandardMaterial({ color: '#8d93a6', roughness: 0.65, metalness: 0.1 }),
    // Emissive violet (eye cores, emblem glyph, ear rings). Not tone mapped so it stays vivid.
    glowCore: new THREE.MeshBasicMaterial({ color: '#f1e4ff', toneMapped: false }),
    glowRing: new THREE.MeshBasicMaterial({ color: '#b26bff', toneMapped: false }),
    glowHalo: new THREE.MeshBasicMaterial({
      color: '#9a4dff',
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    glowSprite: new THREE.MeshBasicMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.55,
    }),
    // Separate instance so the chest glow can pulse independently of the eyes.
    emblemGlow: new THREE.MeshBasicMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.6,
    }),
  };
}

function createGeometries(detail: 'high' | 'low') {
  const hi = detail === 'high';
  const seg = hi ? 64 : 40;

  // Torso: tapered barrel that pinches into a curved waist band and rounded hip block.
  const torso = warpWaist(
    createLathe(
      [
        [0.001, 0.19],
        [0.14, 0.185],
        [0.26, 0.16],
        [0.335, 0.1],
        [0.37, 0.02],
        [0.372, -0.08],
        [0.36, -0.18],
        [0.338, -0.28],
        [0.322, -0.35],
        [0.29, -0.38],
      ],
      seg,
    ),
    -0.38,
    0.05,
  );
  torso.scale(1, 1, 0.74);

  const waist = warpWaist(
    createLathe(
      [
        [0.3, -0.33],
        [0.33, -0.35],
        [0.338, -0.39],
        [0.33, -0.43],
        [0.3, -0.45],
      ],
      seg,
      16,
    ),
    -0.38,
    0.05,
  );
  waist.scale(1, 1, 0.76);

  const pelvis = warpWaist(
    createLathe(
      [
        [0.3, -0.4],
        [0.338, -0.44],
        [0.35, -0.5],
        [0.335, -0.58],
        [0.28, -0.65],
        [0.16, -0.69],
        [0.001, -0.7],
      ],
      seg,
    ),
    -0.38,
    0.05,
  );
  pelvis.scale(1, 1, 0.74);

  const upperArm = createLathe(
    [
      [0.001, 0.035],
      [0.095, 0.026],
      [0.142, -0.02],
      [0.158, -0.1],
      [0.15, -0.18],
      [0.12, -0.25],
      [0.06, -0.275],
      [0.001, -0.28],
    ],
    seg,
    32,
  );
  const forearm = createLathe(
    [
      [0.001, -0.29],
      [0.085, -0.3],
      [0.125, -0.34],
      [0.14, -0.42],
      [0.13, -0.5],
      [0.1, -0.55],
      [0.05, -0.565],
      [0.001, -0.57],
    ],
    seg,
    32,
  );
  const thigh = createLathe(
    [
      [0.001, 0.02],
      [0.11, 0.01],
      [0.155, -0.04],
      [0.165, -0.12],
      [0.15, -0.2],
      [0.11, -0.25],
      [0.001, -0.26],
    ],
    seg,
    32,
  );
  const shin = createLathe(
    [
      [0.001, 0.0],
      [0.12, -0.005],
      [0.155, -0.04],
      [0.165, -0.1],
      [0.17, -0.16],
      [0.001, -0.17],
    ],
    seg,
    24,
  );

  // Ear pod: thick gunmetal bezel around a recessed lens, violet light channel between.
  const earBezel = createLathe(
    [
      [0.248, 0.035],
      [0.256, 0.065],
      [0.272, 0.083],
      [0.3, 0.085],
      [0.322, 0.065],
      [0.335, 0.02],
      [0.335, -0.05],
      [0.315, -0.16],
    ],
    seg,
    32,
  );
  const earLens = createLathe(
    [
      [0.001, 0.062],
      [0.12, 0.06],
      [0.2, 0.052],
      [0.222, 0.04],
      [0.222, -0.02],
    ],
    seg,
    16,
  );

  const faceRim = createSurfaceTube(
    (t) => {
      const a = t * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const bx = Math.sign(c) * Math.pow(Math.abs(c), 2 / FACE.n);
      const by = Math.sign(s) * Math.pow(Math.abs(s), 2 / FACE.n);
      return [bx * 1.018 * FACE.thetaMax, FACE.phi0 + by * 1.03 * FACE.phiMax];
    },
    { radius: 0.006, lift: -0.002, segments: 160, closed: true },
  );

  return {
    head: createHeadGeometry(hi ? 88 : 56, hi ? 66 : 44),
    faceplate: createFaceplateGeometry(hi ? 22 : 14, hi ? 128 : 80),
    faceRim,
    eyeLeft: createEyeArcGeometry(-EYE.x, EYE.y, 0.027),
    eyeRight: createEyeArcGeometry(EYE.x, EYE.y, 0.027),
    eyeHaloLeft: createEyeArcGeometry(-EYE.x, EYE.y, 0.052, 0.012),
    eyeHaloRight: createEyeArcGeometry(EYE.x, EYE.y, 0.052, 0.012),
    crownSeam: createSurfaceTube((t) => [t * Math.PI * 2, CROWN_PHI], {
      radius: 0.0045,
      lift: -0.001,
      segments: 128,
      closed: true,
    }),
    backSeam: createSurfaceTube((t) => [Math.PI, CROWN_PHI - t * 1.75], {
      radius: 0.0045,
      lift: -0.001,
      segments: 64,
    }),
    earBezel,
    earLens,
    torso,
    waist,
    pelvis,
    upperArm,
    forearm,
    thigh,
    shin,
    palm: createSuperEllipsoid(0.085, 0.09, 0.1, 2.6, 28),
    fingers: createSuperEllipsoid(0.06, 0.055, 0.095, 2.8, 24),
    boot: createSuperEllipsoid(0.25, 0.15, 0.4, 3, hi ? 48 : 32),
    bootCuff: createSuperEllipsoid(0.19, 0.1, 0.22, 2.6, 32),
    sole: createSuperEllipsoid(0.262, 0.055, 0.415, 4, 40),
    backVent: createSuperEllipsoid(0.13, 0.055, 0.04, 4, 24),
    sphere: new THREE.SphereGeometry(1, 32, 24),
    antenna: new THREE.CapsuleGeometry(0.021, 0.3, 8, 16),
    thumb: new THREE.CapsuleGeometry(0.03, 0.05, 6, 12),
    glyphI: new THREE.CapsuleGeometry(0.0125, 0.072, 6, 12),
    glyphV: new THREE.CapsuleGeometry(0.0125, 0.07, 6, 12),
    seamDash: new THREE.CapsuleGeometry(0.004, 0.05, 4, 8),
    torus: new THREE.TorusGeometry(1, 0.25, 16, 64),
    thinTorus: new THREE.TorusGeometry(1, 0.07, 12, 96),
    box: new THREE.BoxGeometry(1, 1, 1),
    disc: new THREE.CylinderGeometry(1, 1, 1, 64),
    plane: new THREE.PlaneGeometry(1, 1),
  };
}

export type CoachMaterials = ReturnType<typeof createMaterials>;
export type CoachGeometries = ReturnType<typeof createGeometries>;

/** Builds and owns every geometry/material/texture the coach uses; disposes on unmount. */
export function useCoachAssets(detail: 'high' | 'low') {
  const assets = useMemo(() => {
    const materials = createMaterials();
    const geometries = createGeometries(detail);
    const glowTexture = createRadialTexture('rgba(190,130,255,1)', 'rgba(120,60,255,0)');
    const shadowTexture = createRadialTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
    materials.glowSprite.map = glowTexture;
    materials.emblemGlow.map = glowTexture;
    return { materials, geometries, glowTexture, shadowTexture };
  }, [detail]);

  useEffect(() => {
    return () => {
      Object.values(assets.materials).forEach((m) => m.dispose());
      Object.values(assets.geometries).forEach((g) => g.dispose());
      assets.glowTexture.dispose();
      assets.shadowTexture.dispose();
    };
  }, [assets]);

  return assets;
}
