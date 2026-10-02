export interface Piece {
  slug: string;
  number: string;
  title: string;
  blurb: string;
  date: string; // YYYY-MM
  thumb?: string;
}

// Newest first. Each piece lives in pieces/<slug> with its route in app/<slug>.
export const PIECES: Piece[] = [
  {
    slug: 'radiolarian',
    number: '001',
    title: 'Radiolarian sphere',
    blurb: 'Golden-angle Voronoi lattice, smooth-min struts, bead-tipped spines.',
    date: '2026-10',
    thumb: '/thumbs/radiolarian.png',
  },
];
