import { EDGE_TABLE } from '../pieces/radiolarian/lib/mcTables';

const EDGE_CORNERS = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

/** An edge is cut iff its two corners differ in inside/outside — verify the table agrees for all 256 cases. */
export function CORNER_EDGE_CHECK() {
  for (let cube = 0; cube < 256; cube++) {
    let bits = 0;
    EDGE_CORNERS.forEach(([a, b], e) => {
      if (((cube >> a) & 1) !== ((cube >> b) & 1)) bits |= 1 << e;
    });
    if (bits !== EDGE_TABLE[cube]) return false;
  }
  return true;
}
