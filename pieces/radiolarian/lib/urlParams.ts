import { DEFAULT_GEOMETRY, DEFAULT_RENDER, type GeometryParams, type RenderParams } from './params';

type AnyParams = Record<string, number | string | boolean>;

function coerce<T extends object>(defaults: T, src: Record<string, unknown>): T {
  const out: AnyParams = { ...(defaults as AnyParams) };
  for (const [k, def] of Object.entries(defaults as AnyParams)) {
    const v = src[k];
    if (v === undefined || v === null || v === '') continue;
    if (typeof def === 'number') {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    } else if (typeof def === 'boolean') out[k] = v === true || v === 'true' || v === '1';
    else out[k] = String(v);
  }
  return out as unknown as T;
}

export const parseGeometry = (src: Record<string, unknown>) => coerce<GeometryParams>(DEFAULT_GEOMETRY, src);
export const parseRender = (src: Record<string, unknown>) => coerce<RenderParams>(DEFAULT_RENDER, src);

export function readUrl(): { geometry: GeometryParams; render: RenderParams } {
  const q = Object.fromEntries(new URLSearchParams(window.location.search));
  return { geometry: parseGeometry(q), render: parseRender(q) };
}

/** Every param goes in the query string — loading the URL reproduces the exact geometry. */
export function writeUrl(geometry: GeometryParams, render: RenderParams) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...geometry, ...render })) {
    q.set(k, typeof v === 'number' ? String(+v.toFixed(6)) : String(v));
  }
  window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
}

/** Stable key order → stable hash, independent of how the object was built. */
export const canonicalGeometry = (g: GeometryParams) =>
  JSON.stringify(Object.keys(DEFAULT_GEOMETRY).map((k) => [k, g[k as keyof GeometryParams]]));
