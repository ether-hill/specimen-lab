import { STRIDE } from './primitives';
import type { SpatialHash } from './spatialHash';
import { clamp, dot, len, scale, sub, type Vec3 } from './vec';

// Reference implementations (https://iquilezles.org/articles/distfunctions/).
// bakeField below inlines the same math over the packed primitive buffer.
export function sdCapsule(p: Vec3, a: Vec3, b: Vec3, r: number) {
  const pa = sub(p, a), ba = sub(b, a);
  const h = clamp(dot(pa, ba) / dot(ba, ba), 0, 1);
  return len(sub(pa, scale(ba, h))) - r;
}
export const sdSphere = (p: Vec3, c: Vec3, r: number) => len(sub(p, c)) - r;

// polynomial smooth min (iq): https://iquilezles.org/articles/smin/
export function smin(a: number, b: number, k: number) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function sminInline(a: number, b: number, k: number) {
  const diff = a - b;
  const m = diff > 0 ? b : a;
  if (k <= 0) return m;
  const h = k - (diff < 0 ? -diff : diff);
  return h > 0 ? m - (h * h) / (4 * k) : m;
}

/**
 * Samples the smooth union of all primitives on a G³ lattice spanning [-bounds, bounds]³,
 * for z-slices [z0, z1) (so slabs can be baked in parallel workers).
 * Index within the slab = ((z - z0) * G + y) * G + x. Voxels in empty hash cells are +1 (outside).
 * Within a group (one strut's arc segments) distances are hard-min'd; groups are then
 * folded with smin. Order-dependent smin is fine here: neighbouring primitives have similar k.
 */
export function bakeField(
  data: Float32Array,
  hash: SpatialHash,
  G: number,
  z0 = 0,
  z1 = G,
  onSlice?: (z: number) => void,
): Float32Array {
  const { bounds, cellSize, cells, start, items } = hash;
  const field = new Float32Array((z1 - z0) * G * G);
  const step = (2 * bounds) / (G - 1);
  const cellOf = new Int32Array(G);
  for (let i = 0; i < G; i++) cellOf[i] = Math.min(cells - 1, Math.floor((i * step) / cellSize));

  for (let z = z0; z < z1; z++) {
    const pz = -bounds + z * step;
    const cz = cellOf[z] * cells;
    for (let y = 0; y < G; y++) {
      const py = -bounds + y * step;
      const cyz = (cz + cellOf[y]) * cells;
      let idx = ((z - z0) * G + y) * G;
      for (let x = 0; x < G; x++, idx++) {
        const c = cyz + cellOf[x];
        const s0 = start[c], s1 = start[c + 1];
        if (s0 === s1) { field[idx] = 1; continue; }
        const px = -bounds + x * step;
        let d = 1e9, gmin = 1e9, gk = 0, gid = -1;
        for (let s = s0; s < s1; s++) {
          const o = items[s] * STRIDE;
          const grp = data[o + 9];
          if (grp !== gid) {
            if (gid >= 0) d = sminInline(d, gmin, gk);
            gid = grp; gmin = 1e9; gk = data[o + 8];
          }
          const pax = px - data[o], pay = py - data[o + 1], paz = pz - data[o + 2];
          const bax = data[o + 3], bay = data[o + 4], baz = data[o + 5];
          let h = (pax * bax + pay * bay + paz * baz) * data[o + 6];
          h = h < 0 ? 0 : h > 1 ? 1 : h;
          const qx = pax - bax * h, qy = pay - bay * h, qz = paz - baz * h;
          const di = Math.sqrt(qx * qx + qy * qy + qz * qz) - data[o + 7];
          if (di < gmin) gmin = di;
        }
        d = sminInline(d, gmin, gk);
        field[idx] = d;
      }
    }
    onSlice?.(z);
  }
  return field;
}
