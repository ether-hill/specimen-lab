import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'specimen lab',
  description: 'An ongoing prototyping gallery for generative visuals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
