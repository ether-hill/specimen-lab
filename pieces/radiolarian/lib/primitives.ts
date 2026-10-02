import { stream } from '@/lib/rng';
import { MAX_SEGMENT, R0, type GeometryParams } from './params';
import { GOLDEN, seeds } from './seeds';
import { sphericalVoronoi } from './sphericalVoronoi';
import { arcPoints, onSurface, surfaceNormal, type ShapeParams } from './surface';
import { add, dist, dot, scale, type Vec3 } from './vec';

/**
 * Packed primitive list. Every primitive is a capsule a→b (a sphere is a capsule with b = a):
 *   [ax, ay, az, bax, bay, baz, 1/dot(ba,ba) (0 for spheres), radius, k, group]
 * Primitives in one group (the segments of one subdivided arc) are hard-unioned first and
 * then smooth-blended as a unit, so fillets form only where distinct struts meet.
 * Groups are contiguous in index order.
 */
export const STRIDE = 10;

/** Blend radius k = FILLET_SCALE · filletRatio · s, so filletRatio 1 webs the joints without closing the cells. */
export const FILLET_SCALE = 0.6;

export interface PrimitiveSet {
  data: Float32Array;
  count: number;
  /** line-segment pairs of every strut, for the wireframe view */
  wire: Float32Array;
  medianEdge: number;
  minRadius: number;
}

interface Layer {
  pos: Vec3[];
  dir: Vec3[];
  s: number[]; // local scale per Voronoi vertex
  arcs: { a: number; b: number; pts: Vec3[] }[];
  edgeLen: number[];
}

function buildLayer(L: number, g: GeometryParams, shape: ShapeParams): Layer {
  const layerScale = 1 - L * g.layerGap;
  const NL = L === 0 ? g.N : Math.max(8, Math.round(g.N * layerScale * layerScale));
  const pts = seeds(NL, g.p, g.jitter, stream(g.seed, 100 + L), (L * GOLDEN) / 2);
  const vor = sphericalVoronoi(pts);

  const dir = vor.vertices;
  const pos = dir.map((d) => onSurface(d, shape, layerScale));
  const sum = new Float64Array(dir.length), deg = new Uint8Array(dir.length);
  const arcs: Layer['arcs'] = [];
  const edgeLen: number[] = [];
  for (const [a, b] of vor.edges) {
    const pts = arcPoints(dir[a], dir[b], shape, layerScale, MAX_SEGMENT);
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
    arcs.push({ a, b, pts });
    edgeLen.push(l);
    sum[a] += l; sum[b] += l;
    deg[a]++; deg[b]++;
  }
  const s = Array.from(sum, (v, i) => v / Math.max(1, deg[i]));
  return { pos, dir, s, arcs, edgeLen };
}

export function buildPrimitives(g: GeometryParams): PrimitiveSet {
  const shape: ShapeParams = { R0, dimple: g.dimple, sigma: g.sigma };
  const out: number[] = [];
  const wire: number[] = [];
  let minRadius = Infinity;
  let group = -1;

  /** Add a capsule; pass sameGroup to hard-union it with the previous primitive. */
  const push = (a: Vec3, b: Vec3, r: number, k: number, sameGroup = false) => {
    if (!sameGroup) group++;
    const ba: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const bb = dot(ba, ba);
    out.push(a[0], a[1], a[2], ba[0], ba[1], ba[2], bb > 1e-14 ? 1 / bb : 0, r, Math.max(0, k), group);
    if (r < minRadius) minRadius = r;
  };
  const strut = (a: Vec3, b: Vec3, s: number, k: number, sameGroup = false) => {
    push(a, b, g.strutRatio * s, k, sameGroup);
    wire.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  };

  const layers: Layer[] = [];
  for (let L = 0; L < g.layers; L++) {
    const layer = buildLayer(L, g, shape);
    layers.push(layer);

    // struts: one capsule per arc segment, scale interpolated between the end vertices
    for (const { a, b, pts } of layer.arcs) {
      const n = pts.length - 1;
      const k = FILLET_SCALE * g.filletRatio * 0.5 * (layer.s[a] + layer.s[b]);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        strut(pts[i], pts[i + 1], layer.s[a] * (1 - t) + layer.s[b] * t, k, i > 0);
      }
    }
    // nodes
    for (let v = 0; v < layer.pos.length; v++) {
      push(layer.pos[v], layer.pos[v], g.nodeRatio * layer.s[v], FILLET_SCALE * g.filletRatio * layer.s[v]);
    }

    if (L === 0) {
      // spines — one rng draw per vertex so density changes add/remove spines monotonically
      const rng = stream(g.seed, 200);
      for (let v = 0; v < layer.pos.length; v++) {
        if (rng() >= g.spineDensity || g.spineRatio <= 0) continue;
        const s = layer.s[v];
        const n = surfaceNormal(layer.dir[v], shape);
        const tip = add(layer.pos[v], scale(n, g.spineRatio * s));
        const shaftR = 0.4 * g.strutRatio * s;
        const k = 0.3 * FILLET_SCALE * g.filletRatio * s;
        push(layer.pos[v], tip, shaftR, k);
        push(tip, tip, 1.7 * shaftR, k);
        wire.push(...layer.pos[v], ...tip);
      }
    } else {
      // radial links to the nearest vertex of the layer above
      const rng = stream(g.seed, 300 + L);
      const above = layers[L - 1];
      for (let v = 0; v < layer.pos.length; v++) {
        if (rng() >= g.linkProb) continue;
        const d = layer.dir[v];
        let best = 0, bestDot = -Infinity;
        for (let u = 0; u < above.dir.length; u++) {
          const c = dot(d, above.dir[u]);
          if (c > bestDot) { bestDot = c; best = u; }
        }
        const s = 0.5 * (layer.s[v] + above.s[best]);
        strut(layer.pos[v], above.pos[best], s, FILLET_SCALE * g.filletRatio * s);
      }
    }
  }

  const sorted = [...layers[0].edgeLen].sort((x, y) => x - y);
  return {
    data: new Float32Array(out),
    count: out.length / STRIDE,
    wire: new Float32Array(wire),
    medianEdge: sorted[sorted.length >> 1],
    minRadius,
  };
}
