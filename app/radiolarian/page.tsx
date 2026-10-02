import type { Metadata } from 'next';
import RadiolarianLoader from '@/pieces/radiolarian/components/RadiolarianLoader';

export const metadata: Metadata = {
  title: 'Radiolarian sphere · specimen lab',
  description: 'Procedural lattice spheres after Haeckel — phyllotaxis, spherical Voronoi, smooth-min SDF.',
};

export default function Page() {
  return <RadiolarianLoader />;
}
