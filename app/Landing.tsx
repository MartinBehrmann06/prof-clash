'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useSession } from '@/lib/client/session';
import { LeagueBadge, Portrait, TrophyIcon, Trophies } from '@/components/art';
import { Podium } from '@/components/Podium';
import type { Meta, RankedProf } from '@/lib/types';

export function Landing({ meta, top, fighters }: { meta: Meta; top: RankedProf[]; fighters: RankedProf[] }) {
  const { user, profile } = useSession();
  const root = useRef<HTMLDivElement>(null);
  const anyVotes = top.some((p) => p.wins + p.losses > 0);
  const cta = profile ? '/battle' : user ? '/setup' : '/login?next=setup';

  // scroll reveals + count-up numbers
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
      const num = e.target.querySelector<HTMLElement>('.num');
      if (num) countUp(num, reduced);
    }), { threshold: 0.2 });
    root.current?.querySelectorAll<HTMLElement>('.reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });
    return () => io.disconnect();
  }, []);

  const letters = (s: string, d0: number) => [...s].map((c, i) => <span key={i} className="ch" style={{ animationDelay: `${d0 + i * 0.06}s` }}>{c}</span>);
  const sparks = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2, r = 90 + (i % 3) * 30;
    return <i key={i} style={{ ['--x' as any]: `${Math.cos(a) * r}px`, ['--y' as any]: `${Math.sin(a) * r}px`, animationDelay: `${(i % 4) * 0.02}s` }} />;
  });

  return (
    <div className="view-enter" ref={root}>
      <section className="hero">
        <div className="hero-inner">
          <span className="kicker">🎓 ETH Zurich · Bachelor mandatory courses · {meta.stats.profs} professors</span>
          <h1 className="title" aria-label="Prof Clash"><span className="line">{letters('PROF', 0.1)}</span><span className="line l2">{letters('CLASH', 0.4)}</span></h1>
          <p className="tagline">Two professors enter. One leaves with the trophies. Vote 1v1 on who taught you better — and watch the Elo ladder decide who rules the lecture hall.</p>
          <div className="arena-preview" aria-hidden="true">
            {fighters.map((p, i) => (
              <div key={p.id} className={`fighter ${i ? 'right' : 'left'}`}>
                <div className="mini-card"><Portrait p={p} /><div className="nm">{p.name}</div><Trophies n={p.elo} /></div>
              </div>
            ))}
            <div className="vs-emblem"><div className="burst" /><div className="vs">VS</div></div>
            <div className="sparks">{sparks}</div>
          </div>
          <div className="hero-ctas">
            <Link className="btn huge pulse" href={cta}>⚔️ {profile ? 'Continue battle' : 'Start battle'}</Link>
            <Link className="btn gold" href="/leaderboard" style={{ alignSelf: 'center' }}>🏆 Leaderboard</Link>
          </div>
        </div>
        <div className="scroll-hint">▼ scroll</div>
      </section>

      <div className="ground">
        <section className="section">
          <div className="stats">
            {[['🧙', meta.stats.profs, 'Professors'], ['📚', meta.stats.courses, 'Mandatory courses'], ['⚔️', meta.stats.votes, 'Battles fought'], ['🛡️', meta.stats.voters, 'Students in clans']].map(([ico, n, lbl]) => (
              <div key={lbl as string} className="panel wood stat reveal nails"><div className="ico">{ico}</div><div className="num" data-count={n}>0</div><div className="lbl">{lbl}</div></div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="reveal">How the clash works</h2>
          <div className="steps">
            {[
              ['🛡️', 'Join your clan', 'Log in with your ETH email and pick your department — once. Your votes shape your department’s ladder.'],
              ['🧑‍🏫', 'Pick your roster', 'We look up who taught your mandatory courses in the semester you actually took them — even if the lecturer has changed since.'],
              ['🏆', 'Battle!', 'Two cards, one choice. Tap or flick the better teacher. Trophies move per department and globally.'],
            ].map(([art, h, p], i) => (
              <div key={h} className="panel step reveal"><div className="badge-num">{i + 1}</div><div className="art">{art}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="reveal">Climb the leagues</h2>
          <div className="leagues">
            {meta.leagues.map((l) => (
              <div key={l.key} className="league-tile reveal"><LeagueBadge league={l.key} /><div className="lname">{l.name}</div>
                <div className="lmin"><TrophyIcon size={16} /> {l.min ? `${l.min}+` : 'start'}</div></div>
            ))}
          </div>
        </section>

        {anyVotes && (
          <section className="section">
            <h2 className="reveal">Current champions</h2>
            <Podium top={top} />
            <div style={{ textAlign: 'center', marginTop: 40 }}><Link className="btn blue" href="/leaderboard">See the full ladder →</Link></div>
          </section>
        )}

        <footer className="footer">
          Course &amp; lecturer data from the ETH Zurich <a href="https://www.vvz.ethz.ch" target="_blank" rel="noopener noreferrer">Vorlesungsverzeichnis</a> (HS 2023 – HS 2026).
          Portraits from public ETH pages.<br />Unofficial student project — not affiliated with ETH Zurich. Be kind: it’s about teaching, not people.
        </footer>
      </div>
    </div>
  );
}

function countUp(el: HTMLElement, reduced: boolean) {
  const to = Number(el.dataset.count) || 0;
  if (reduced) { el.textContent = to.toLocaleString(); return; }
  const t0 = performance.now(), dur = 1200;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(to * (1 - (1 - k) ** 3)).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
