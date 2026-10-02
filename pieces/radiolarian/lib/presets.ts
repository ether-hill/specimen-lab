import { DEFAULT_GEOMETRY, type GeometryParams } from './params';

export const PRESETS: Record<string, Partial<GeometryParams>> = {
  Radiolarian: { ...DEFAULT_GEOMETRY },
  'Pollen grain': { p: 0.5, dimple: 0, nodeRatio: 0.45, spineDensity: 1, spineRatio: 0.9 },
  'Coral funnel': { p: 0.85, dimple: 0.55, sigma: 0.8, layers: 3 },
  'Bone lattice': { strutRatio: 0.13, filletRatio: 1.0, spineDensity: 0 },
};

/** Presets are applied on top of the defaults so they're fully reproducible. */
export const presetParams = (name: string, seed: number, G: number): GeometryParams => ({
  ...DEFAULT_GEOMETRY,
  ...PRESETS[name],
  seed,
  G,
});
