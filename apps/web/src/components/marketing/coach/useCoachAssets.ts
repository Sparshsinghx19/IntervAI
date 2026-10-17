import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  FACE,
  createEyeArcGeometry,
  createFaceplateGeometry,
  createHeadGeometry,
  createLathe,
  createLoftGeometry,
  createLoftSampler,
  createLoftSeam,
  createRadialTexture,
  createSuperEllipsoid,
  createSurfaceTube,
  superEllipsoidPoint,
  warpWaist,
} from './geometry';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const EYE = { x: 0.33, y: -0.07 };
const CROWN_PHI = 0.8;

/** Shared body landmarks (units relative to the waist origin). */
export const BODY = { waistY: -0.445 };

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
    // Ear lenses: black, slightly satin so side lighting doesn't wash them out.
    lens: new THREE.MeshPhysicalMaterial({
      color: '#040508',
      roughness: 0.35,
      metalness: 0.2,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      envMapIntensity: 0.3,
    }),
    // Glossy black glass faceplate / emblem lens.
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
    // Pearl-silver trim (emblem bezel, collar lip).
    trim: new THREE.MeshPhysicalMaterial({
      color: '#cfd3dd',
      roughness: 0.22,
      metalness: 0.9,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
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

  // ---- Torso shell: broad rounded chest that tapers into the waist (super-ellipse loft).
  const torsoShape = createLoftSampler([
    { y: 0.215, w: 0, d: 0 },
    { y: 0.212, w: 0.16, d: 0.11 },
    { y: 0.195, w: 0.3, d: 0.2 },
    { y: 0.155, w: 0.385, d: 0.255, z: 0.005 },
    { y: 0.09, w: 0.425, d: 0.28, z: 0.01 },
    { y: 0.0, w: 0.435, d: 0.29, z: 0.014 },
    { y: -0.11, w: 0.415, d: 0.285, z: 0.012 },
    { y: -0.23, w: 0.37, d: 0.265, z: 0.006 },
    { y: -0.33, w: 0.325, d: 0.24 },
    { y: -0.41, w: 0.3, d: 0.22 },
    { y: -0.47, w: 0.285, d: 0.205 },
    { y: -0.5, w: 0.2, d: 0.14 },
    { y: -0.505, w: 0, d: 0 },
  ]);
  const torso = warpWaist(createLoftGeometry(torsoShape, hi ? 64 : 40, hi ? 80 : 56), BODY.waistY, 0.045, 0.1);

  // Black waist band, tucked into the shells above and below.
  const waist = warpWaist(
    createLoftGeometry(
      createLoftSampler([
        { y: -0.38, w: 0.29, d: 0.21 },
        { y: -0.395, w: 0.318, d: 0.232 },
        { y: -0.445, w: 0.33, d: 0.24 },
        { y: -0.495, w: 0.318, d: 0.232 },
        { y: -0.51, w: 0.29, d: 0.21 },
      ]),
      16,
      hi ? 80 : 56,
    ),
    BODY.waistY,
    0.045,
    0.1,
  );

  // Hip armor: rounded block that houses the hip joints.
  const pelvis = warpWaist(
    createLoftGeometry(
      createLoftSampler([
        { y: -0.47, w: 0, d: 0 },
        { y: -0.475, w: 0.22, d: 0.16 },
        { y: -0.5, w: 0.3, d: 0.215 },
        { y: -0.56, w: 0.335, d: 0.235 },
        { y: -0.64, w: 0.33, d: 0.23 },
        { y: -0.71, w: 0.28, d: 0.2 },
        { y: -0.755, w: 0.17, d: 0.13 },
        { y: -0.77, w: 0, d: 0 },
      ]),
      hi ? 40 : 28,
      hi ? 80 : 56,
    ),
    BODY.waistY,
    0.045,
    0.1,
  );

  // Panel seams: front/back shell split down each side, and the lower edge of the chest plate.
  const tTop = torsoShape.tAtY(0.17);
  const tBottom = torsoShape.tAtY(-0.37);
  const sideSeam = (a: number) =>
    createLoftSeam(torsoShape, (u) => [tTop + (tBottom - tTop) * u, a], { segments: 48 });
  const chestSeam = createLoftSeam(
    torsoShape,
    (u) => {
      const a = Math.PI * (0.16 + 0.68 * u);
      return [torsoShape.tAtY(-0.2 - 0.05 * Math.sin(a)), a];
    },
    { segments: 64 },
  );
  const torsoSeams = mergeGeometries([sideSeam(0), sideSeam(Math.PI), chestSeam]);

  // Surface anchors so trim sits on (not in front of) the shell.
  const anchorOn = (y: number, a: number) => {
    const t = torsoShape.tAtY(y);
    const pos = torsoShape.point(t, a);
    const above = torsoShape.point(torsoShape.tAtY(y + 0.01), a);
    const below = torsoShape.point(torsoShape.tAtY(y - 0.01), a);
    const side = torsoShape.point(t, a + 0.01);
    const normal = new THREE.Vector3().crossVectors(side.sub(pos), above.sub(below)).normalize().negate();
    return { pos, normal };
  };
  const anchors = {
    emblem: anchorOn(-0.06, Math.PI / 2),
    vent: anchorOn(-0.05, -Math.PI / 2),
    dash: anchorOn(-0.03, Math.PI / 2 - 0.5),
  };

  // ---- Limbs (lathes, authored top-to-bottom in each part's local space).
  // Upper arm: domed shoulder cap over the joint, full sleeve below.
  const upperArm = createLathe(
    [
      [0.001, 0.092],
      [0.075, 0.084],
      [0.125, 0.058],
      [0.153, 0.012],
      [0.162, -0.05],
      [0.158, -0.13],
      [0.142, -0.195],
      [0.105, -0.232],
      [0.001, -0.244],
    ],
    seg,
    36,
  );
  // Forearm gauntlet, slightly flared toward the wrist.
  const forearm = createLathe(
    [
      [0.001, -0.015],
      [0.092, -0.022],
      [0.138, -0.06],
      [0.156, -0.13],
      [0.152, -0.195],
      [0.128, -0.24],
      [0.088, -0.262],
      [0.001, -0.27],
    ],
    seg,
    36,
  );
  const thigh = createLathe(
    [
      [0.001, 0.0],
      [0.125, -0.006],
      [0.178, -0.045],
      [0.192, -0.11],
      [0.186, -0.175],
      [0.162, -0.225],
      [0.12, -0.252],
      [0.001, -0.26],
    ],
    seg,
    36,
  );
  const shin = createLathe(
    [
      [0.001, 0.0],
      [0.13, -0.006],
      [0.165, -0.04],
      [0.174, -0.1],
      [0.172, -0.16],
      [0.001, -0.17],
    ],
    seg,
    24,
  );

  // Boot: broad rounded shell; a toe-cap seam wraps over the front.
  const BOOT = { rx: 0.235, ry: 0.14, rz: 0.36, p: 3 };
  const toePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * (0.04 + 0.92 * (i / 40));
    toePts.push(
      superEllipsoidPoint(BOOT.rx, BOOT.ry, BOOT.rz, BOOT.p, new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.95, 1.05), 0.001),
    );
  }
  const toeSeam = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(toePts), 40, 0.0045, 8, false);

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

  const geometries = {
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
    torsoSeams,
    waist,
    pelvis,
    upperArm,
    forearm,
    thigh,
    shin,
    handBack: createSuperEllipsoid(0.098, 0.1, 0.11, 2.8, 28),
    fingerCore: createSuperEllipsoid(0.05, 0.052, 0.104, 2.6, 24),
    fingerPad: createSuperEllipsoid(0.034, 0.05, 0.024, 2.6, 20),
    thumbPad: createSuperEllipsoid(0.034, 0.054, 0.032, 2.6, 20),
    boot: createSuperEllipsoid(BOOT.rx, BOOT.ry, BOOT.rz, BOOT.p, hi ? 48 : 32),
    bootCuff: createSuperEllipsoid(0.18, 0.08, 0.2, 2.6, 32),
    sole: createSuperEllipsoid(0.246, 0.046, 0.372, 4, 40),
    toeSeam,
    backVent: createSuperEllipsoid(0.13, 0.055, 0.035, 4, 24),
    sphere: new THREE.SphereGeometry(1, 32, 24),
    antenna: new THREE.CapsuleGeometry(0.021, 0.3, 8, 16),
    glyphI: new THREE.CapsuleGeometry(0.0125, 0.072, 6, 12),
    glyphV: new THREE.CapsuleGeometry(0.0125, 0.07, 6, 12),
    seamDash: new THREE.CapsuleGeometry(0.004, 0.05, 4, 8),
    torus: new THREE.TorusGeometry(1, 0.25, 16, 64),
    thinTorus: new THREE.TorusGeometry(1, 0.07, 12, 96),
    box: new THREE.BoxGeometry(1, 1, 1),
    disc: new THREE.CylinderGeometry(1, 1, 1, 64),
    plane: new THREE.PlaneGeometry(1, 1),
  };
  return { geometries, anchors };
}

export type CoachMaterials = ReturnType<typeof createMaterials>;
export type CoachGeometries = ReturnType<typeof createGeometries>['geometries'];
export type CoachAnchors = ReturnType<typeof createGeometries>['anchors'];

/** Builds and owns every geometry/material/texture the coach uses; disposes on unmount. */
export function useCoachAssets(detail: 'high' | 'low') {
  const assets = useMemo(() => {
    const materials = createMaterials();
    const { geometries, anchors } = createGeometries(detail);
    const glowTexture = createRadialTexture('rgba(190,130,255,1)', 'rgba(120,60,255,0)');
    const shadowTexture = createRadialTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)');
    materials.glowSprite.map = glowTexture;
    materials.emblemGlow.map = glowTexture;
    return { materials, geometries, anchors, glowTexture, shadowTexture };
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
