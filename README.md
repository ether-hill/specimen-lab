# specimen lab

An ongoing prototyping gallery for generative visuals. Each piece is a route (`app/<slug>`) backed by a
self-contained folder (`pieces/<slug>`), listed in `pieces/registry.ts`. Static export only; no server code.

```
npm run dev        # http://localhost:3000
npm run test:geo   # Euler / determinism / winding checks, no browser needed
npm run build
```

## 001 · Radiolarian sphere (`/radiolarian`)

Golden-angle phyllotaxis seeds → spherical Voronoi (quickhull) → capsule/sphere primitives →
smooth-min SDF baked on a grid → marching cubes → Taubin smoothing → R3F with N8AO, DOF,
ACES, desaturate, vignette, grain. Every param lives in the URL, so a link reproduces the geometry exactly.

```
pieces/radiolarian/
  lib/seeds.ts, sphericalVoronoi.ts, surface.ts, primitives.ts   lattice (steps 1–4)
  lib/spatialHash.ts, sdf.ts                                      field bake (step 5)
  lib/marchingCubes.ts, mcTables.ts                               meshing (step 6)
  lib/pipeline.ts      shared by the worker and scripts/check-geometry.ts
  lib/useGenerator.ts  worker pool orchestration + cancellation
  workers/generate.worker.ts
  components/Scene.tsx, Controls.tsx, RadiolarianApp.tsx
```

### Deviations from the original brief

- **Struts are hard-unioned within an arc.** All capsule segments of one subdivided Voronoi edge are
  `min`'d together, then smooth-blended as one unit. With per-segment `smin`, every segment joint
  bulged by up to k/4, struts swelled mid-span, and at fillet 1.0 the cells closed up.
- **Thicker default struts and fewer cells.** The brief's defaults (N 1400, strut 0.10·s) give a strut
  radius of about 0.35 voxels at G=160, so the lattice only held together through smin bulk, and
  fillet 0 turned to dust. The defaults are now N 900, strut 0.20, node 0.30, and fillet 0.65. Slider
  ranges for strut and node are widened, and the presets are scaled to match.
- **Fillet is scaled.** The blend radius is `k = 0.6 · filletRatio · s`, so 1.0 gives webbed, bony
  joints that still leave the cells open.
- **The bake is parallel.** One worker builds the lattice, a pool bakes z-slabs, and one worker runs
  marching cubes. Measured times: G=160 in about 1.5 s, G=288 in about 4.5 s, on a 6-core i7.
- The wireframe view adds depth fog so the front parastichies read.
