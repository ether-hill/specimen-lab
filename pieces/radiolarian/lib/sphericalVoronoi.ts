import quickhull from 'quickhull3d';
import { add, cross, dot, normalize, scale, sub, type Vec3 } from './vec';

export interface SphericalVoronoi {
  /** unit directions of the Voronoi vertices (one per Delaunay triangle) */
  vertices: Vec3[];
  /** Voronoi edges as vertex index pairs, one per Delaunay edge */
  edges: [number, number][];
}

// Seeds on the unit sphere → convex hull (= spherical Delaunay) → dual Voronoi graph.
export function sphericalVoronoi(seeds: Vec3[]): SphericalVoronoi {
  const N = seeds.length;
  const tris = quickhull(seeds) as number[][];

  const vertices: Vec3[] = tris.map(([a, b, c]) => {
    const A = seeds[a], B = seeds[b], C = seeds[c];
    let v = normalize(cross(sub(B, A), sub(C, A)));
    if (dot(v, add(add(A, B), C)) < 0) v = scale(v, -1);
    return v;
  });

  // hull edge (i,j) → the two triangles sharing it
  const firstFace = new Map<number, number>();
  const edges: [number, number][] = [];
  for (let f = 0; f < tris.length; f++) {
    const t = tris[f];
    if (t.length !== 3) throw new Error(`Hull face ${f} is not a triangle (${t.length} verts)`);
    for (let e = 0; e < 3; e++) {
      const i = t[e], j = t[(e + 1) % 3];
      const key = Math.min(i, j) * N + Math.max(i, j);
      const other = firstFace.get(key);
      if (other === undefined) firstFace.set(key, f);
      else {
        edges.push([other, f]);
        firstFace.delete(key);
      }
    }
  }

  // Euler: V − E + F = 2 on the sphere
  const expectTri = 2 * N - 4, expectEdge = 3 * N - 6;
  if (tris.length !== expectTri || edges.length !== expectEdge || firstFace.size !== 0) {
    throw new Error(
      `Spherical Voronoi failed Euler check (N=${N}): triangles ${tris.length}/${expectTri}, ` +
        `edges ${edges.length}/${expectEdge}, unpaired ${firstFace.size}`,
    );
  }
  return { vertices, edges };
}
