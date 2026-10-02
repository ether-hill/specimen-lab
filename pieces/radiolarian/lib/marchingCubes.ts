import { EDGE_TABLE, TRI_TABLE } from './mcTables';

export interface MeshBuffers {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

class Growable<T extends Float32Array | Uint32Array> {
  len = 0;
  constructor(public buf: T) {}
  ensure(extra: number) {
    if (this.len + extra <= this.buf.length) return;
    const next = new (this.buf.constructor as { new (n: number): T })(Math.max(this.buf.length * 2, this.len + extra));
    next.set(this.buf);
    this.buf = next;
  }
  done(): T {
    return this.buf.slice(0, this.len) as T;
  }
}

// Bourke cube: corner c → (dx, dy, dz); edge e → corners
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
// edge e → [axis (0 x, 1 y, 2 z), dx, dy, dz] of the grid edge's lower endpoint relative to the cell
const EDGE = [
  [0, 0, 0, 0], [1, 1, 0, 0], [0, 0, 1, 0], [1, 0, 0, 0],
  [0, 0, 0, 1], [1, 1, 0, 1], [0, 0, 1, 1], [1, 0, 0, 1],
  [2, 0, 0, 0], [2, 1, 0, 0], [2, 1, 1, 0], [2, 0, 1, 0],
];

/**
 * Iso-surface at `iso` of a G³ field over [-bounds, bounds]³ (negative = inside).
 * Vertices are shared between cells (welded by grid edge); normals come from the
 * field gradient (central differences), linearly interpolated along each edge.
 */
export function marchingCubes(field: Float32Array, G: number, bounds: number, iso = 0, onSlice?: (z: number) => void): MeshBuffers {
  const step = (2 * bounds) / (G - 1);
  const GG = G * G;
  const pos = new Growable(new Float32Array(1 << 18));
  const nrm = new Growable(new Float32Array(1 << 18));
  const idx = new Growable(new Uint32Array(1 << 19));

  // vertex ids on grid edges for z-layers k (0) and k+1 (1); z-edges between them
  const xE = [new Int32Array(GG), new Int32Array(GG)];
  const yE = [new Int32Array(GG), new Int32Array(GG)];
  const zE = new Int32Array(GG);
  xE[0].fill(-1); yE[0].fill(-1);

  const at = (x: number, y: number, z: number) => field[(z * G + y) * G + x];
  const grad = (x: number, y: number, z: number, out: number[], o: number) => {
    out[o] = at(Math.min(G - 1, x + 1), y, z) - at(Math.max(0, x - 1), y, z);
    out[o + 1] = at(x, Math.min(G - 1, y + 1), z) - at(x, Math.max(0, y - 1), z);
    out[o + 2] = at(x, y, Math.min(G - 1, z + 1)) - at(x, y, Math.max(0, z - 1));
  };
  const g = [0, 0, 0, 0, 0, 0];

  const vertexOn = (axis: number, x: number, y: number, z: number): number => {
    const x2 = x + (axis === 0 ? 1 : 0), y2 = y + (axis === 1 ? 1 : 0), z2 = z + (axis === 2 ? 1 : 0);
    const v1 = at(x, y, z), v2 = at(x2, y2, z2);
    const t = Math.abs(v2 - v1) < 1e-12 ? 0.5 : (iso - v1) / (v2 - v1);
    pos.ensure(3); nrm.ensure(3);
    const p = pos.len;
    pos.buf[p] = -bounds + (x + (x2 - x) * t) * step;
    pos.buf[p + 1] = -bounds + (y + (y2 - y) * t) * step;
    pos.buf[p + 2] = -bounds + (z + (z2 - z) * t) * step;
    grad(x, y, z, g, 0);
    grad(x2, y2, z2, g, 3);
    const nx = g[0] + (g[3] - g[0]) * t, ny = g[1] + (g[4] - g[1]) * t, nz = g[2] + (g[5] - g[2]) * t;
    const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
    nrm.buf[p] = nx * inv; nrm.buf[p + 1] = ny * inv; nrm.buf[p + 2] = nz * inv;
    pos.len += 3; nrm.len += 3;
    return p / 3;
  };

  const ids = new Int32Array(12);
  for (let z = 0; z < G - 1; z++) {
    xE[1].fill(-1); yE[1].fill(-1); zE.fill(-1);
    for (let y = 0; y < G - 1; y++) {
      for (let x = 0; x < G - 1; x++) {
        let cube = 0;
        for (let c = 0; c < 8; c++) {
          const k = CORNER[c];
          if (at(x + k[0], y + k[1], z + k[2]) < iso) cube |= 1 << c;
        }
        const bits = EDGE_TABLE[cube];
        if (bits === 0) continue;
        for (let e = 0; e < 12; e++) {
          if (!(bits & (1 << e))) continue;
          const [axis, dx, dy, dz] = EDGE[e];
          const ex = x + dx, ey = y + dy, slot = ey * G + ex;
          const store = axis === 0 ? xE[dz] : axis === 1 ? yE[dz] : zE;
          let id = store[slot];
          if (id < 0) store[slot] = id = vertexOn(axis, ex, ey, z + dz);
          ids[e] = id;
        }
        const o = cube << 4;
        for (let i = 0; TRI_TABLE[o + i] !== -1; i += 3) {
          idx.ensure(3);
          // Bourke's winding is clockwise seen from outside; flip to three.js' CCW
          idx.buf[idx.len++] = ids[TRI_TABLE[o + i]];
          idx.buf[idx.len++] = ids[TRI_TABLE[o + i + 2]];
          idx.buf[idx.len++] = ids[TRI_TABLE[o + i + 1]];
        }
      }
    }
    // layer k+1 becomes layer k
    [xE[0], xE[1]] = [xE[1], xE[0]];
    [yE[0], yE[1]] = [yE[1], yE[0]];
    onSlice?.(z);
  }
  return { positions: pos.done(), normals: nrm.done(), indices: idx.done() };
}

/** Taubin λ|μ smoothing (shrink-free). Uniform umbrella weights from triangle edges. */
export function taubinSmooth(positions: Float32Array, indices: Uint32Array, passes = 2, lambda = 0.5, mu = -0.53) {
  const n = positions.length / 3;
  const sum = new Float32Array(n * 3);
  const cnt = new Uint16Array(n);
  const step = (f: number) => {
    sum.fill(0); cnt.fill(0);
    for (let t = 0; t < indices.length; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = indices[t + e] * 3, b = indices[t + ((e + 1) % 3)] * 3;
        sum[a] += positions[b]; sum[a + 1] += positions[b + 1]; sum[a + 2] += positions[b + 2];
        sum[b] += positions[a]; sum[b + 1] += positions[a + 1]; sum[b + 2] += positions[a + 2];
        cnt[a / 3]++; cnt[b / 3]++;
      }
    }
    for (let v = 0; v < n; v++) {
      if (!cnt[v]) continue;
      const i = v * 3, c = 1 / cnt[v];
      positions[i] += f * (sum[i] * c - positions[i]);
      positions[i + 1] += f * (sum[i + 1] * c - positions[i + 1]);
      positions[i + 2] += f * (sum[i + 2] * c - positions[i + 2]);
    }
  };
  for (let p = 0; p < passes; p++) { step(lambda); step(mu); }
}
