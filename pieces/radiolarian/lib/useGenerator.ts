'use client';
import { useEffect, useRef, useState } from 'react';
import { BOUNDS, type GeometryParams } from './params';
import type { MeshStats } from './pipeline';
import type { WorkerIn, WorkerOut } from '../workers/generate.worker';

export interface GeneratedMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  stats: MeshStats;
  params: GeometryParams;
}

export interface GeneratorState {
  wire: Float32Array | null;
  medianEdge: number;
  mesh: GeneratedMesh | null;
  busy: boolean;
  stage: string;
  t: number;
  error: string | null;
}

const POOL = typeof navigator !== 'undefined' ? Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1)) : 4;

const spawn = () => new Worker(new URL('../workers/generate.worker.ts', import.meta.url), { type: 'module' });

function call(w: Worker, msg: WorkerIn, transfer: Transferable[], onMsg?: (m: WorkerOut) => void): Promise<WorkerOut> {
  return new Promise((resolve, reject) => {
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === 'error') reject(new Error(m.message));
      else if (m.type === 'slice' || m.type === 'meshProgress') onMsg?.(m);
      else resolve(m);
    };
    w.onerror = (e) => reject(new Error(e.message || 'Worker failed'));
    w.postMessage(msg, transfer);
  });
}

/**
 * Runs the geometry pipeline off the main thread: lattice in one worker, the SDF bake split
 * by z-slab across a pool, marching cubes back in one worker. A changed parameter terminates
 * every in-flight worker and starts over. The previous mesh stays up until the new one lands.
 */
export function useGenerator(params: GeometryParams, debounceMs = 120): GeneratorState {
  const [state, setState] = useState<GeneratorState>({
    wire: null, medianEdge: 0.06, mesh: null, busy: true, stage: 'lattice', t: 0, error: null,
  });
  const pool = useRef<Worker[]>([]);
  const key = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const workers = Array.from({ length: POOL }, spawn);
      pool.current = workers;
      const g: GeometryParams = JSON.parse(key);
      const G = g.G;
      const update = (s: Partial<GeneratorState>) => { if (!cancelled) setState((prev) => ({ ...prev, ...s })); };
      update({ busy: true, stage: 'lattice', t: 0, error: null });

      try {
        const lat = (await call(workers[0], { type: 'lattice', params: g }, [])) as Extract<WorkerOut, { type: 'lattice' }>;
        update({ wire: lat.wire, medianEdge: lat.medianEdge, stage: 'field', t: 0 });

        let t = performance.now();
        const field = new Float32Array(G * G * G);
        let slices = 0;
        const slab = Math.ceil(G / (workers.length * 2)); // a few slabs per worker smooths out uneven load
        const jobs: [number, number][] = [];
        for (let z0 = 0; z0 < G; z0 += slab) jobs.push([z0, Math.min(G, z0 + slab)]);
        let next = 0;
        await Promise.all(
          workers.map(async (w) => {
            while (next < jobs.length) {
              const [z0, z1] = jobs[next++];
              const r = (await call(w, { type: 'bake', data: lat.data, hash: lat.hash, G, z0, z1 }, [], () => {
                slices++;
                if (slices % 4 === 0) update({ t: slices / G });
              })) as Extract<WorkerOut, { type: 'bake' }>;
              field.set(r.field, r.z0 * G * G);
            }
          }),
        );
        const fieldMs = performance.now() - t;

        update({ stage: 'mesh', t: 0 });
        workers.slice(1).forEach((w) => w.terminate());
        t = performance.now();
        const m = (await call(workers[0], { type: 'mesh', field, params: g }, [field.buffer], (p) => {
          if (p.type === 'meshProgress') update({ t: p.t });
        })) as Extract<WorkerOut, { type: 'mesh' }>;
        workers[0].terminate();

        if (cancelled) return;
        const stats: MeshStats = {
          primitives: lat.count,
          triangles: m.indices.length / 3,
          vertices: m.positions.length / 3,
          medianEdge: lat.medianEdge,
          minRadiusVoxels: lat.minRadius / ((2 * BOUNDS) / (G - 1)),
          ms: { lattice: lat.ms, field: fieldMs, mesh: m.meshMs, smooth: m.smoothMs },
        };
        update({
          mesh: { positions: m.positions, normals: m.normals, indices: m.indices, stats, params: g },
          busy: false, stage: 'done', t: 1,
        });
      } catch (err) {
        if (!cancelled) update({ busy: false, error: (err as Error).message });
      }
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      pool.current.forEach((w) => w.terminate());
      pool.current = [];
    };
  }, [key, debounceMs]);

  useEffect(() => () => pool.current.forEach((w) => w.terminate()), []);
  return state;
}
