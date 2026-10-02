export type Vec3 = [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / (len(a) || 1));
export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const c = clamp(dot(a, b), -1, 1);
  const w = Math.acos(c);
  if (w < 1e-6) return normalize(add(scale(a, 1 - t), scale(b, t)));
  const s = Math.sin(w);
  return add(scale(a, Math.sin((1 - t) * w) / s), scale(b, Math.sin(t * w) / s));
}
