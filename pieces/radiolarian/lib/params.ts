// Strut/node defaults are ~2× the original brief: at the brief's ratios a strut is ~0.35 voxel
// wide at G=160 and only survives meshing because of smin bulk. See README.
export interface GeometryParams {
  seed: number;
  N: number;
  p: number;
  jitter: number;
  dimple: number;
  sigma: number;
  strutRatio: number;
  nodeRatio: number;
  filletRatio: number;
  spineDensity: number;
  spineRatio: number;
  layers: number;
  layerGap: number;
  linkProb: number;
  G: number;
  smooth: boolean;
}

export interface RenderParams {
  view: 'mesh' | 'wireframe' | 'both';
  aoIntensity: number;
  aoRadius: number; // × median strut length
  dofFocus: number; // offset from the front surface, world units
  dofBokeh: number;
  lightAngle: number; // degrees, rotates the key light around the view axis
  lightIntensity: number;
  rimLight: boolean;
}

export const DEFAULT_GEOMETRY: GeometryParams = {
  seed: 1,
  N: 900,
  p: 0.72,
  jitter: 0.15,
  dimple: 0.3,
  sigma: 0.55,
  strutRatio: 0.2,
  nodeRatio: 0.3,
  filletRatio: 0.65,
  spineDensity: 0.6,
  spineRatio: 0.7,
  layers: 2,
  layerGap: 0.12,
  linkProb: 0.35,
  G: 160,
  smooth: true,
};

export const DEFAULT_RENDER: RenderParams = {
  view: 'mesh',
  aoIntensity: 3,
  aoRadius: 1.5,
  dofFocus: 0,
  dofBokeh: 2,
  lightAngle: 0,
  lightIntensity: 2.5,
  rimLight: true,
};

export const GRID_OPTIONS = [96, 160, 224, 288] as const;

// Fixed constants of the pipeline (not exposed as controls)
export const R0 = 1;
export const BOUNDS = 1.3; // field domain is [-BOUNDS, BOUNDS]³
export const MAX_SEGMENT = 0.04 * R0;
