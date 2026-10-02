import { marchingCubes, taubinSmooth, type MeshBuffers } from './marchingCubes';
import { BOUNDS, type GeometryParams } from './params';
import { buildPrimitives, type PrimitiveSet } from './primitives';
import { bakeField } from './sdf';
import { buildSpatialHash, type SpatialHash } from './spatialHash';

export type Stage = 'lattice' | 'field' | 'mesh' | 'smooth';
export const HASH_CELLS = 40;

export interface Lattice {
  prims: PrimitiveSet;
  hash: SpatialHash;
}

export interface MeshStats {
  primitives: number;
  triangles: number;
  vertices: number;
  medianEdge: number;
  minRadiusVoxels: number;
  ms: Record<Stage, number>;
}

/** Steps 1–4: seeds → Voronoi → primitives, plus the spatial hash used by the field bake. */
export function buildLattice(g: GeometryParams): Lattice {
  const prims = buildPrimitives(g);
  const voxel = (2 * BOUNDS) / (g.G - 1);
  // pad AABBs by two voxels so gradient normals near the surface see real distances
  const hash = buildSpatialHash(prims.data, prims.count, BOUNDS, HASH_CELLS, 2 * voxel);
  return { prims, hash };
}

/** Step 6: marching cubes + optional Taubin smoothing. */
export function meshField(field: Float32Array, g: GeometryParams, onSlice?: (z: number) => void) {
  const mesh = marchingCubes(field, g.G, BOUNDS, 0, onSlice);
  const t0 = performance.now();
  if (g.smooth) taubinSmooth(mesh.positions, mesh.indices, 2);
  return { mesh, smoothMs: performance.now() - t0 };
}

export function meshStats(lattice: Lattice, mesh: MeshBuffers, g: GeometryParams, ms: Record<Stage, number>): MeshStats {
  return {
    primitives: lattice.prims.count,
    triangles: mesh.indices.length / 3,
    vertices: mesh.positions.length / 3,
    medianEdge: lattice.prims.medianEdge,
    minRadiusVoxels: lattice.prims.minRadius / ((2 * BOUNDS) / (g.G - 1)),
    ms,
  };
}

/** Whole pipeline on one thread (used by scripts/check-geometry.ts; the app splits the bake across workers). */
export function generate(g: GeometryParams): MeshBuffers & { wire: Float32Array; stats: MeshStats } {
  const now = () => performance.now();
  let t = now();
  const lattice = buildLattice(g);
  const lat = now() - t;
  t = now();
  const field = bakeField(lattice.prims.data, lattice.hash, g.G);
  const fld = now() - t;
  t = now();
  const { mesh, smoothMs } = meshField(field, g);
  const msh = now() - t - smoothMs;
  return {
    ...mesh,
    wire: lattice.prims.wire,
    stats: meshStats(lattice, mesh, g, { lattice: lat, field: fld, mesh: msh, smooth: smoothMs }),
  };
}
