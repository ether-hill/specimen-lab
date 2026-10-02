// One-off: writes the Lorensen/Bourke marching-cubes tables (as shipped in three.js) to a TS module.
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';
import { writeFileSync } from 'node:fs';
const rows = [];
for (let i = 0; i < 256; i++) rows.push('  ' + Array.from(triTable.slice(i * 16, i * 16 + 16)).join(', ') + ',');
const src = `// Marching-cubes tables after Paul Bourke, "Polygonising a scalar field"
// https://paulbourke.net/geometry/polygonise/  (corner/edge numbering as in that article)

export const EDGE_TABLE = new Int32Array([
${Array.from(edgeTable).map((v) => '0x' + v.toString(16)).join(', ').replace(/(([^,]*,){16})/g, '$1\n ')}
]);

// 256 cases x 16 entries, -1 terminated
export const TRI_TABLE = new Int8Array([
${rows.join('\n')}
]);
`;
writeFileSync(new URL('../pieces/radiolarian/lib/mcTables.ts', import.meta.url), src);
console.log('ok');
