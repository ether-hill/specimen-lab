import { clamp, dist, len, normalize, scale, slerp, type Vec3 } from './vec';

export interface ShapeParams {
  R0: number;
  dimple: number; // 0 = clean sphere, 0.35 = deep funnel
  sigma: number; // funnel width (rad)
}

/** Radius of the surface along unit direction d. */
export const R = (d: Vec3, { R0, dimple, sigma }: ShapeParams) => {
  const phi = Math.acos(clamp(d[2], -1, 1));
  return R0 * (1 - dimple * Math.exp(-((phi / sigma) ** 2)));
};

export const onSurface = (d: Vec3, shape: ShapeParams, layerScale = 1): Vec3 =>
  scale(d, layerScale * R(d, shape));

/** Outward normal of the surface |x| = R(x/|x|), from a finite-difference gradient. */
export function surfaceNormal(d: Vec3, shape: ShapeParams): Vec3 {
  const f = (p: Vec3) => len(p) - R(normalize(p), shape);
  const p = onSurface(d, shape);
  const e = 1e-4;
  return normalize([
    f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]),
    f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]),
    f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e]),
  ]);
}

/**
 * Points along the great arc from d1 to d2, lifted onto the surface, with no
 * segment longer than maxSegment — so wide rim cells don't cut chords through the interior.
 */
export function arcPoints(d1: Vec3, d2: Vec3, shape: ShapeParams, layerScale: number, maxSegment: number): Vec3[] {
  const a = onSurface(d1, shape, layerScale), b = onSurface(d2, shape, layerScale);
  // chord underestimates arc length, so measure on a coarse arc first
  let approx = 0, prev = a;
  for (let i = 1; i <= 4; i++) {
    const q = onSurface(slerp(d1, d2, i / 4), shape, layerScale);
    approx += dist(prev, q);
    prev = q;
  }
  const n = Math.max(1, Math.ceil(approx / maxSegment));
  const out: Vec3[] = [a];
  for (let i = 1; i < n; i++) out.push(onSurface(slerp(d1, d2, i / n), shape, layerScale));
  out.push(b);
  return out;
}
