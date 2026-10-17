import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural geometry for the IntervAI coach.
 *
 * Everything is generated once per mount from a handful of analytic shapes so the
 * robot stays a real, light-weight 3D model (no external assets). The head is a
 * tapered super-ellipsoid; the faceplate, eyes and seams are projected onto that
 * same surface so they wrap the helmet correctly from every viewing angle.
 */

// Head proportions (head-local units, origin at head centre).
export const HEAD = { rx: 0.72, ry: 0.56, rz: 0.64, p: 2.5 };

// Faceplate footprint in head-surface angles (theta = yaw, phi = pitch).
export const FACE = {
  thetaMax: 1.02,
  phiMax: 0.46,
  phi0: -0.17,
  n: 4.2,
  edge: 0.012,
  bulge: 0.028,
};

const tmpDir = new THREE.Vector3();

export function dirFromAngles(theta: number, phi: number, out = new THREE.Vector3()) {
  const c = Math.cos(phi);
  return out.set(c * Math.sin(theta), Math.sin(phi), c * Math.cos(theta));
}

/** Maps a unit direction to the helmet surface, optionally pushed out by `offset`. */
export function headPoint(dir: THREE.Vector3, offset = 0, out = new THREE.Vector3()) {
  const { rx, ry, rz, p } = HEAD;
  const k = Math.pow(
    Math.pow(Math.abs(dir.x), p) + Math.pow(Math.abs(dir.y), p) + Math.pow(Math.abs(dir.z), p),
    -1 / p,
  );
  const x = dir.x * k;
  const y = dir.y * k;
  const z = dir.z * k;
  // Slightly fuller crown, softer chin.
  const taper = y < 0 ? 1 - 0.1 * y * y : 1 - 0.05 * y * y;
  out.set(x * rx * taper, y * ry, z * rz * taper);
  if (offset !== 0) {
    const len = out.length();
    out.multiplyScalar((len + offset) / len);
  }
  return out;
}

export function headPointAt(theta: number, phi: number, offset = 0, out = new THREE.Vector3()) {
  return headPoint(dirFromAngles(theta, phi, tmpDir), offset, out);
}

/** Outward unit normal of the helmet surface (numerical, good enough for placement). */
export function headNormalAt(theta: number, phi: number, out = new THREE.Vector3()) {
  const e = 0.002;
  const a = headPointAt(theta - e, phi);
  const b = headPointAt(theta + e, phi);
  const c = headPointAt(theta, phi - e);
  const d = headPointAt(theta, phi + e);
  const t1 = b.sub(a);
  const t2 = d.sub(c);
  return out.crossVectors(t1, t2).normalize();
}

function superellipseNorm(u: number, v: number, n: number) {
  return Math.pow(Math.pow(Math.abs(u), n) + Math.pow(Math.abs(v), n), 1 / n);
}

/** Height of the faceplate glass above the helmet shell at a given surface angle. */
export function faceOffset(theta: number, phi: number) {
  const r = superellipseNorm(theta / FACE.thetaMax, (phi - FACE.phi0) / FACE.phiMax, FACE.n);
  return FACE.edge + FACE.bulge * Math.max(0, 1 - r * r);
}

/** Point on (or just above) the faceplate glass. */
export function facePointAt(theta: number, phi: number, lift = 0, out = new THREE.Vector3()) {
  return headPointAt(theta, phi, faceOffset(theta, phi) + lift, out);
}

/** Tapered, slightly boxy helmet shell. */
export function createHeadGeometry(widthSegments = 72, heightSegments = 56) {
  const base = new THREE.SphereGeometry(1, widthSegments, heightSegments);
  const pos = base.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    headPoint(v, 0, v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const merged = mergeVertices(base, 1e-5);
  base.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Wrap-around glass faceplate: a rounded-rectangle (super-ellipse) patch projected on
 * the helmet, domed in the middle, with a lip that tucks back into the shell so it
 * reads as an inset part rather than a decal.
 */
export function createFaceplateGeometry(radial = 22, around = 112) {
  const positions: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();

  // Centre vertex
  facePointAt(0, FACE.phi0, 0, v);
  positions.push(v.x, v.y, v.z);

  const rings: { r: number; lift: number }[] = [];
  for (let i = 1; i <= radial; i++) rings.push({ r: i / radial, lift: 0 });
  // Lip: roll the edge back under the shell.
  rings.push({ r: 1.012, lift: -0.012 });
  rings.push({ r: 1.02, lift: -0.035 });

  for (const ring of rings) {
    for (let j = 0; j < around; j++) {
      const a = (j / around) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const bx = Math.sign(c) * Math.pow(Math.abs(c), 2 / FACE.n);
      const by = Math.sign(s) * Math.pow(Math.abs(s), 2 / FACE.n);
      const theta = bx * ring.r * FACE.thetaMax;
      const phi = FACE.phi0 + by * ring.r * FACE.phiMax;
      const rr = Math.min(ring.r, 1);
      const off = FACE.edge + FACE.bulge * Math.max(0, 1 - rr * rr) + ring.lift;
      headPointAt(theta, phi, off, v);
      positions.push(v.x, v.y, v.z);
    }
  }

  // Fan around centre
  for (let j = 0; j < around; j++) {
    const a = 1 + j;
    const b = 1 + ((j + 1) % around);
    indices.push(0, a, b);
  }
  // Ring strips
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = 1 + i * around;
    const r1 = 1 + (i + 1) * around;
    for (let j = 0; j < around; j++) {
      const jn = (j + 1) % around;
      indices.push(r0 + j, r1 + j, r1 + jn);
      indices.push(r0 + j, r1 + jn, r0 + jn);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Closed or open tube following a path defined in helmet-surface angles. */
export function createSurfaceTube(
  sample: (t: number) => [number, number],
  { radius, lift, segments = 96, closed = false, onFace = false }: {
    radius: number;
    lift: number;
    segments?: number;
    closed?: boolean;
    onFace?: boolean;
  },
) {
  const pts: THREE.Vector3[] = [];
  const count = closed ? segments : segments + 1;
  for (let i = 0; i < count; i++) {
    const t = i / segments;
    const [theta, phi] = sample(t);
    pts.push(onFace ? facePointAt(theta, phi, lift) : headPointAt(theta, phi, lift));
  }
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
  return new THREE.TubeGeometry(curve, segments, radius, 10, closed);
}

/** Happy "^" eye arc on the faceplate, with rounded end caps. */
export function createEyeArcGeometry(cx: number, cy: number, radius: number, lift = 0.004) {
  const halfW = 0.165;
  const height = 0.19;
  const start = 0.1 * Math.PI;
  const end = 0.9 * Math.PI;
  const sample = (t: number): [number, number] => {
    const a = start + (end - start) * t;
    return [cx + Math.cos(a) * halfW, cy + (Math.sin(a) - 0.62) * height];
  };
  const tube = createSurfaceTube(sample, { radius, lift, segments: 48, onFace: true });
  const caps = [0, 1].map((t) => {
    const [th, ph] = sample(t);
    const p = facePointAt(th, ph, lift);
    const cap = new THREE.SphereGeometry(radius, 16, 12);
    cap.translate(p.x, p.y, p.z);
    return cap;
  });
  const merged = mergeGeometries([tube, ...caps]);
  tube.dispose();
  caps.forEach((c) => c.dispose());
  return merged;
}

/** Super-ellipsoid ("squircle" volume) used for armor panels, boots and hands. */
export function createSuperEllipsoid(rx: number, ry: number, rz: number, p = 3, seg = 40) {
  const base = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  const pos = base.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const k = Math.pow(
      Math.pow(Math.abs(v.x), p) + Math.pow(Math.abs(v.y), p) + Math.pow(Math.abs(v.z), p),
      -1 / p,
    );
    pos.setXYZ(i, v.x * k * rx, v.y * k * ry, v.z * k * rz);
  }
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const merged = mergeVertices(base, 1e-5);
  base.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Smooth lathe from (radius, height) control points. */
export function createLathe(profile: [number, number][], segments = 64, divisions = 48) {
  // Profiles are authored top-to-bottom; LatheGeometry faces outward when walked bottom-to-top.
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)).reverse());
  const pts = curve.getPoints(divisions).map((p) => new THREE.Vector2(Math.max(p.x, 0.0001), p.y));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const merged = mergeVertices(geo, 1e-5);
  geo.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Curves the waist line into a gentle "smile" at the front and back (as in the
 * reference) by dipping vertices near the waist according to how frontal they are.
 */
export function warpWaist(geo: THREE.BufferGeometry, waistY: number, depth: number, width = 0.12) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const zn = z / r;
    const w = Math.exp(-Math.pow((y - waistY) / width, 2));
    pos.setY(i, y - depth * w * zn * zn);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Soft radial falloff used for glows and the contact shadow. */
export function createRadialTexture(inner: string, outer: string, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const sgnPow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

export interface LoftSection {
  y: number;
  /** Half-width (x) and half-depth (z) of the cross-section. */
  w: number;
  d: number;
  /** Forward shift of the cross-section centre (chest fullness). */
  z?: number;
}

/**
 * Smooth body shell swept through rounded-rectangle (super-ellipse) cross-sections.
 * Gives armor a broad front, real side depth and soft corners, which round lathes can't.
 * `point(t, a)` samples the same surface so trims and seams sit exactly on it.
 */
export function createLoftSampler(sections: LoftSection[], n = 2.4) {
  const shape = new THREE.CatmullRomCurve3(
    sections.map((s) => new THREE.Vector3(s.w, s.y, s.d)),
    false,
    'catmullrom',
    0.5,
  );
  const shift = new THREE.CatmullRomCurve3(
    sections.map((s) => new THREE.Vector3(s.z ?? 0, s.y, 0)),
    false,
    'catmullrom',
    0.5,
  );
  const tmp = new THREE.Vector3();
  const tmpShift = new THREE.Vector3();

  const point = (t: number, a: number, lift = 0, out = new THREE.Vector3()) => {
    shape.getPoint(t, tmp);
    shift.getPoint(t, tmpShift);
    const w = Math.max(tmp.x, 0) + lift;
    const d = Math.max(tmp.z, 0) + lift;
    return out.set(w * sgnPow(Math.cos(a), 2 / n), tmp.y, d * sgnPow(Math.sin(a), 2 / n) + tmpShift.x);
  };

  /** Parameter t at which the shell reaches height y (sections run top to bottom). */
  const tAtY = (y: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (shape.getPoint(mid, tmp).y > y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  return { point, tAtY };
}

export type LoftSampler = ReturnType<typeof createLoftSampler>;

export function createLoftGeometry(sampler: LoftSampler, rings = 56, around = 72) {
  const positions: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= rings; i++) {
    for (let j = 0; j < around; j++) {
      sampler.point(i / rings, (j / around) * Math.PI * 2, 0, v);
      positions.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < around; j++) {
      const a = i * around + j;
      const b = (i + 1) * around + j;
      const c = (i + 1) * around + ((j + 1) % around);
      const d = i * around + ((j + 1) % around);
      indices.push(a, c, b, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  // Collapse the closed ends into proper poles before smoothing normals.
  const merged = mergeVertices(geo, 1e-5);
  geo.dispose();
  merged.computeVertexNormals();
  return merged;
}

/** Thin seam tube following (t, a) pairs on a loft surface. */
export function createLoftSeam(
  sampler: LoftSampler,
  sample: (u: number) => [number, number],
  { radius = 0.0045, lift = 0.001, segments = 64 } = {},
) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const [t, a] = sample(i / segments);
    pts.push(sampler.point(t, a, lift));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segments, radius, 8, false);
}

/** Point on a super-ellipsoid surface along a direction (matches createSuperEllipsoid). */
export function superEllipsoidPoint(
  rx: number,
  ry: number,
  rz: number,
  p: number,
  dir: THREE.Vector3,
  lift = 0,
  out = new THREE.Vector3(),
) {
  const d = dir.clone().normalize();
  const k = Math.pow(
    Math.pow(Math.abs(d.x), p) + Math.pow(Math.abs(d.y), p) + Math.pow(Math.abs(d.z), p),
    -1 / p,
  );
  out.set(d.x * k * rx, d.y * k * ry, d.z * k * rz);
  if (lift) out.multiplyScalar((out.length() + lift) / out.length());
  return out;
}
