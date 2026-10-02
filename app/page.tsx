import Link from 'next/link';
import { PIECES } from '@/pieces/registry';

export default function Gallery() {
  return (
    <main className="gallery">
      <header className="gallery-head">
        <h1>specimen lab</h1>
        <p>An ongoing notebook of generative visuals. Every specimen is reproducible from a seed.</p>
      </header>
      <ul className="grid">
        {PIECES.map((p) => (
          <li key={p.slug}>
            <Link href={`/${p.slug}`} className="card">
              <div className="thumb">{p.thumb && <img src={p.thumb} alt="" />}</div>
              <div className="meta">
                <span className="num">{p.number}</span>
                <span className="title">{p.title}</span>
                <span className="date">{p.date}</span>
              </div>
              <p className="blurb">{p.blurb}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
