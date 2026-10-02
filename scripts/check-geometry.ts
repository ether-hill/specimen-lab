// Phase-1/2 acceptance checks that don't need a browser:
//   npm run test:geo
import { performance } from 'node:perf_hooks';
import { stream } from '../lib/rng';
import { CORNER_EDGE_CHECK } from './mcSelfTest';
import { DEFAULT_GEOMETRY } from '../pieces/radiolarian/lib/params';
import { generate } from '../pieces/radiolarian/lib/pipeline';
import { buildPrimitives } from '../pieces/radiolarian/lib/primitives';
import { seeds } from '../pieces/radiolarian/lib/seeds';
import { sphericalVoronoi } from '../pieces/radiolarian/lib/sphericalVoronoi';

let failed = false;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failed = true;
};

check(CORNER_EDGE_CHECK(), 'marching-cubes edge table matches corner/edge convention');

for (const N of [200, 1400, 5000]) {
  for (const p of [0.5, 0.72, 1.0]) {
    try {
      const t = performance.now();
      const v = sphericalVoronoi(seeds(N, p, 0.15, stream(1, 100)));
      check(true, `Euler N=${N} p=${p}: ${v.vertices.length} verts, ${v.edges.length} edges (${(performance.now() - t).toFixed(0)} ms)`);
    } catch (e) {
      check(false, `Euler N=${N} p=${p}: ${(e as Error).message}`);
    }
  }
}

const a = buildPrimitives(DEFAULT_GEOMETRY), b = buildPrimitives(DEFAULT_GEOMETRY);
check(a.wire.length === b.wire.length && a.wire.every((x, i) => x === b.wire[i]), 'same seed+params → identical edge list');
const c = buildPrimitives({ ...DEFAULT_GEOMETRY, seed: 2 });
check(!(a.wire.length === c.wire.length && a.wire.every((x, i) => x === c.wire[i])), 'different seed → different edge list');

for (const G of [96, 160]) {
  const r = generate({ ...DEFAULT_GEOMETRY, G });
  const { ms, ...rest } = r.stats;
  console.log(`      G=${G}`, rest, Object.fromEntries(Object.entries(ms).map(([k, v]) => [k, Math.round(v)])));
  // winding: face normals should agree with gradient normals
  let agree = 0;
  const P = r.positions, Nn = r.normals, I = r.indices;
  for (let t = 0; t < I.length; t += 3) {
    const [i0, i1, i2] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
    const e1 = [P[i1] - P[i0], P[i1 + 1] - P[i0 + 1], P[i1 + 2] - P[i0 + 2]];
    const e2 = [P[i2] - P[i0], P[i2 + 1] - P[i0 + 1], P[i2 + 2] - P[i0 + 2]];
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (f[0] * Nn[i0] + f[1] * Nn[i0 + 1] + f[2] * Nn[i0 + 2] > 0) agree++;
  }
  check(agree / (I.length / 3) > 0.95, `G=${G} winding CCW-outward for ${((100 * agree) / (I.length / 3)).toFixed(2)}% of faces`);
}

process.exit(failed ? 1 : 0);
