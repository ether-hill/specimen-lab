/// <reference lib="webworker" />
import type { GeometryParams } from '../lib/params';
import { buildLattice, meshField } from '../lib/pipeline';
import { bakeField } from '../lib/sdf';
import type { SpatialHash } from '../lib/spatialHash';

// One worker script, three jobs. The main thread runs `lattice` once, fans `bake` out over a
// pool by z-slab, then sends the assembled field back for `mesh`. Cancellation = terminate().
export type WorkerIn =
  | { type: 'lattice'; params: GeometryParams }
  | { type: 'bake'; data: Float32Array; hash: SpatialHash; G: number; z0: number; z1: number }
  | { type: 'mesh'; field: Float32Array; params: GeometryParams };

export type WorkerOut =
  | { type: 'lattice'; data: Float32Array; count: number; hash: SpatialHash; wire: Float32Array; medianEdge: number; minRadius: number; ms: number }
  | { type: 'slice' }
  | { type: 'bake'; z0: number; field: Float32Array }
  | { type: 'meshProgress'; t: number }
  | { type: 'mesh'; positions: Float32Array; normals: Float32Array; indices: Uint32Array; meshMs: number; smoothMs: number }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: WorkerOut, transfer: Transferable[] = []) => ctx.postMessage(msg, transfer);

ctx.onmessage = (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  try {
    if (m.type === 'lattice') {
      const t = performance.now();
      const { prims, hash } = buildLattice(m.params);
      post(
        { type: 'lattice', data: prims.data, count: prims.count, hash, wire: prims.wire, medianEdge: prims.medianEdge, minRadius: prims.minRadius, ms: performance.now() - t },
        [prims.wire.buffer],
      );
    } else if (m.type === 'bake') {
      const field = bakeField(m.data, m.hash, m.G, m.z0, m.z1, () => post({ type: 'slice' }));
      post({ type: 'bake', z0: m.z0, field }, [field.buffer]);
    } else if (m.type === 'mesh') {
      const t = performance.now();
      let last = 0;
      const G = m.params.G;
      const { mesh, smoothMs } = meshField(m.field, m.params, (z) => {
        const now = performance.now();
        if (now - last > 50) { last = now; post({ type: 'meshProgress', t: (z + 1) / (G - 1) }); }
      });
      post(
        { type: 'mesh', ...mesh, meshMs: performance.now() - t - smoothMs, smoothMs },
        [mesh.positions.buffer, mesh.normals.buffer, mesh.indices.buffer],
      );
    }
  } catch (err) {
    post({ type: 'error', message: (err as Error).message });
  }
};
