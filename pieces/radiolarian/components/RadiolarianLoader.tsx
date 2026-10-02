'use client';
import dynamic from 'next/dynamic';

// WebGL, workers and URL state are browser-only
const RadiolarianApp = dynamic(() => import('./RadiolarianApp'), {
  ssr: false,
  loading: () => <main className="stage" />,
});

export default function RadiolarianLoader() {
  return <RadiolarianApp />;
}
