import { STRIDE } from './primitives';

/** Uniform grid over [-bounds, bounds]³ listing, per cell, the primitives whose padded AABB overlaps it (CSR layout). */
export interface SpatialHash {
  cells: number; // per axis
  cellSize: number;
  bounds: number;
  start: Int32Array; // cells³ + 1 offsets into items
  items: Int32Array;
}

export function buildSpatialHash(data: Float32Array, count: number, bounds: number, cells: number, margin: number): SpatialHash {
  const cellSize = (2 * bounds) / cells;
  const toCell = (x: number) => Math.min(cells - 1, Math.max(0, Math.floor((x + bounds) / cellSize)));
  const ranges = new Int32Array(count * 6);

  const counts = new Int32Array(cells * cells * cells + 1);
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const pad = data[o + 7] + data[o + 8] + margin;
    for (let ax = 0; ax < 3; ax++) {
      const a = data[o + ax], b = a + data[o + 3 + ax];
      ranges[i * 6 + ax] = toCell(Math.min(a, b) - pad);
      ranges[i * 6 + 3 + ax] = toCell(Math.max(a, b) + pad);
    }
    const r = ranges.subarray(i * 6, i * 6 + 6);
    for (let z = r[2]; z <= r[5]; z++)
      for (let y = r[1]; y <= r[4]; y++)
        for (let x = r[0]; x <= r[3]; x++) counts[(z * cells + y) * cells + x]++;
  }

  const start = new Int32Array(cells * cells * cells + 1);
  for (let c = 0; c < cells * cells * cells; c++) start[c + 1] = start[c] + counts[c];
  const fill = start.slice(0, -1);
  const items = new Int32Array(start[start.length - 1]);
  for (let i = 0; i < count; i++) {
    const r = ranges.subarray(i * 6, i * 6 + 6);
    for (let z = r[2]; z <= r[5]; z++)
      for (let y = r[1]; y <= r[4]; y++)
        for (let x = r[0]; x <= r[3]; x++) items[fill[(z * cells + y) * cells + x]++] = i;
  }
  return { cells, cellSize, bounds, start, items };
}
