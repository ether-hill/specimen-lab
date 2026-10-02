import type { Vec3 } from './vec';

export const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.508°

// Vogel phyllotaxis on the sphere. Polar angle φ (from +z) follows a power law:
// p = 0.5 → near-uniform cells, p > 0.5 → tiny cells at the front pole growing to the rim.
export function seeds(N: number, p: number, jitter: number, rng: () => number, rotate = 0): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    const phi = Math.PI * Math.pow(t, p) + ((rng() - 0.5) * jitter) / Math.sqrt(N);
    const theta = i * GOLDEN + rotate + (rng() - 0.5) * jitter * GOLDEN * 0.1;
    const s = Math.sin(phi);
    out.push([s * Math.cos(theta), s * Math.sin(theta), Math.cos(phi)]);
  }
  return out;
}
