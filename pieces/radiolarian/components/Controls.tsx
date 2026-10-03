'use client';
import { button, folder, Leva, useControls } from 'leva';
import { useEffect, useRef, useState } from 'react';
import { exportJSON, exportPNG, importJSON } from '../lib/export';
import { GRID_OPTIONS, type GeometryParams, type RenderParams } from '../lib/params';
import { PRESETS, presetParams } from '../lib/presets';

interface Props {
  initial: { geometry: GeometryParams; render: RenderParams };
  onChange: (geometry: GeometryParams, render: RenderParams) => void;
  onExportGLB: () => void;
}

export default function Controls({ initial, onChange, onExportGLB }: Props) {
  const g0 = initial.geometry, r0 = initial.render;

  const [geo, setGeo] = useControls(() => ({
    Seed: folder({ seed: { value: g0.seed, step: 1 } }),
    Lattice: folder({
      N: { value: g0.N, min: 200, max: 5000, step: 10 },
      p: { value: g0.p, min: 0.5, max: 1, step: 0.01, label: 'p (falloff)' },
      jitter: { value: g0.jitter, min: 0, max: 1, step: 0.01 },
    }),
    Shape: folder({
      dimple: { value: g0.dimple, min: 0, max: 0.6, step: 0.01 },
      sigma: { value: g0.sigma, min: 0.2, max: 1.2, step: 0.01, label: 'sigma (funnel)' },
    }),
    Struts: folder({
      strutRatio: { value: g0.strutRatio, min: 0.04, max: 0.4, step: 0.005 },
      nodeRatio: { value: g0.nodeRatio, min: 0.05, max: 0.6, step: 0.005 },
      filletRatio: { value: g0.filletRatio, min: 0, max: 1.2, step: 0.01 },
    }),
    Spines: folder({
      spineDensity: { value: g0.spineDensity, min: 0, max: 1, step: 0.01 },
      spineRatio: { value: g0.spineRatio, min: 0, max: 2, step: 0.01 },
    }),
    Layers: folder({
      layers: { value: g0.layers, min: 1, max: 3, step: 1 },
      layerGap: { value: g0.layerGap, min: 0.05, max: 0.25, step: 0.005 },
      linkProb: { value: g0.linkProb, min: 0, max: 1, step: 0.01 },
    }),
    Quality: folder({
      G: { value: g0.G, options: [...GRID_OPTIONS], label: 'grid G' },
      smooth: { value: g0.smooth, label: 'taubin' },
    }),
  }));

  const [ren, setRen] = useControls(() => ({
    Render: folder({
      view: { value: r0.view, options: ['mesh', 'wireframe', 'both'] },
      aoIntensity: { value: r0.aoIntensity, min: 0, max: 8, step: 0.1, label: 'AO intensity' },
      aoRadius: { value: r0.aoRadius, min: 0.25, max: 6, step: 0.05, label: 'AO radius ×' },
      dofFocus: { value: r0.dofFocus, min: -0.5, max: 0.8, step: 0.01, label: 'DOF focus' },
      dofBokeh: { value: r0.dofBokeh, min: 0, max: 8, step: 0.1, label: 'DOF bokeh' },
      lightAngle: { value: r0.lightAngle, min: -180, max: 180, step: 1, label: 'light angle' },
      lightIntensity: { value: r0.lightIntensity, min: 0, max: 6, step: 0.05, label: 'light' },
      rimLight: { value: r0.rimLight, label: 'rim light' },
    }),
  }));

  // buttons read the latest values through a ref
  const latest = useRef({ geo: geo as GeometryParams, ren: ren as RenderParams, onExportGLB });
  latest.current = { geo: geo as GeometryParams, ren: ren as RenderParams, onExportGLB };

  useControls(() => ({
    Presets: folder(
      {
        ...Object.fromEntries(
          Object.keys(PRESETS).map((name) => [
            name,
            button(() => setGeo(presetParams(name, latest.current.geo.seed, latest.current.geo.G))),
          ]),
        ),
        'random seed': button(() => setGeo({ seed: Math.floor(Math.random() * 1e6) })),
      },
      { collapsed: false },
    ),
    Export: folder({
      'PNG 2048': button(() => exportPNG(2048, latest.current.geo).catch((e) => alert(e.message))),
      'PNG 4096': button(() => exportPNG(4096, latest.current.geo).catch((e) => alert(e.message))),
      'GLB (100 mm)': button(() => latest.current.onExportGLB()),
      'params JSON': button(() => exportJSON(latest.current.geo, latest.current.ren)),
      'import JSON': button(() =>
        importJSON()
          .then(({ geometry, render }) => { setGeo(geometry); setRen(render); })
          .catch((e) => alert(`Could not read params: ${e.message}`)),
      ),
    }),
  }));

  useEffect(() => {
    onChange(geo as GeometryParams, ren as RenderParams);
  }, [geo, ren, onChange]);

  // On narrow screens (phones, or the frame on frond-studio.com) the open panel
  // covers the specimen, so start it collapsed there.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(window.matchMedia('(max-width: 700px)').matches);
  }, []);

  return (
    <Leva
      collapsed={{ collapsed, onChange: setCollapsed }}
      titleBar={{ title: 'radiolarian' }}
      theme={{ sizes: { rootWidth: '320px', controlWidth: '150px' } }}
    />
  );
}
