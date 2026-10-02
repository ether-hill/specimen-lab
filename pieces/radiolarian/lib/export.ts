import { BufferGeometry, Mesh, MeshStandardMaterial } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { shortHash } from '@/lib/rng';
import type { GeometryParams, RenderParams } from './params';
import { canonicalGeometry, parseGeometry, parseRender } from './urlParams';

export const fileBase = (g: GeometryParams) => `radiolarian_s${g.seed}_${shortHash(canonicalGeometry(g))}`;

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- PNG: Scene registers a capture function that re-renders the post chain offscreen-size
type CaptureFn = (size: number) => Promise<Blob>;
let captureFn: CaptureFn | null = null;
export const registerCapture = (fn: CaptureFn | null) => { captureFn = fn; };

export async function exportPNG(size: number, g: GeometryParams) {
  if (!captureFn) throw new Error('Renderer not ready');
  const blob = await captureFn(size);
  download(blob, `${fileBase(g)}_${size}.png`);
}

// --- GLB: scaled so the object's largest extent is 100 mm (glTF units are metres)
export async function exportGLB(geometry: BufferGeometry, g: GeometryParams) {
  const geo = geometry.clone();
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const extent = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
  geo.scale(0.1 / extent, 0.1 / extent, 0.1 / extent);
  const mesh = new Mesh(geo, new MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.55, metalness: 0 }));
  mesh.name = fileBase(g);
  const result = await new GLTFExporter().parseAsync(mesh, { binary: true });
  download(new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' }), `${fileBase(g)}_100mm.glb`);
  geo.dispose();
}

// --- params JSON
export function exportJSON(geometry: GeometryParams, render: RenderParams) {
  const doc = { piece: 'radiolarian', version: 1, geometry, render };
  download(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${fileBase(geometry)}.json`);
}

export function importJSON(): Promise<{ geometry: GeometryParams; render: RenderParams }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      try {
        const doc = JSON.parse(await input.files![0].text());
        // accept both {geometry, render} and a flat params object
        resolve({ geometry: parseGeometry(doc.geometry ?? doc), render: parseRender(doc.render ?? doc) });
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
