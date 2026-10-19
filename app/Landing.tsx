'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { spring } from '@/lib/client/motion';
import { LeagueBadge, Portrait, Trophies } from '@/components/art';
import { ProfCard } from '@/components/ProfCard';
import { Podium } from '@/components/Podium';
import { useOpenProf } from '@/components/ProfSheet';
import type { Meta, RankedProf } from '@/lib/types';

export function Landing({ meta, top, fighters }: { meta: Meta; top: RankedProf[]; fighters: RankedProf[] }) {
  const { user, profile } = useSession();
  const reduced = useReducedMotion();
  const open = useOpenProf();
  const root = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -120]);
  const heroFade = useTransform(scrollY, [0, 500], [1, 0.2]);
  const anyVotes = top.some((p) => p.wins + p.losses > 0);
  const cta = profile ? '/battle' : user ? '/setup' : '/login?next=setup';

  // scroll reveals + count-up numbers
  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
      const num = e.target.querySelector<HTMLElement>('[data-count]');
      if (num) countUp(num, !!reduced);
    }), { threshold: 0.2 });
    root.current?.querySelectorAll<HTMLElement>('.reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 80}ms`; io.observe(el); });
    return () => io.disconnect();
  }, [reduced]);

  const word = (text: string, delay: number, className = '') => (
    <span className={`row ${className}`}>
      {[...text].map((c, i) => (
        <motion.span key={i} initial={{ y: '110%', rotate: 8 }} animate={{ y: 0, rotate: 0 }}
          transition={{ type: 'spring', bounce: 0.35, visualDuration: 0.6, delay: delay + i * 0.05 }}>{c}</motion.span>
      ))}
    </span>
  );
  const ticker = [...top.slice(0, 20), ...top.slice(0, 20)];

  return (
    <div ref={root}>
      <section className="hero">
        <motion.div className="hero-in" style={{ y: heroY, opacity: heroFade }}>
          <motion.span className="eyebrow" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            ETH Zurich · {meta.stats.profs} professors · {meta.depts.length} clans
          </motion.span>
          <h1 className="hero-title" aria-label="Prof Clash">
            {word('PROF', 0.15)}
            {word('CLASH', 0.4, 'clash')}
          </h1>
          <motion.p className="hero-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            Two professors enter the arena. You decide who taught better. Every vote moves the trophies — in your department and across ETH.
          </motion.p>

          {fighters.length === 2 && (
            <div className="hero-cards" aria-hidden="true">
              {fighters.map((p, i) => (
                <motion.div key={p.id} style={{ order: i ? 3 : 1 }}
                  initial={{ x: i ? 300 : -300, rotate: i ? 20 : -20, opacity: 0 }}
                  animate={{ x: 0, rotate: i ? 6 : -6, opacity: 1 }}
                  transition={{ type: 'spring', bounce: 0.35, visualDuration: 0.7, delay: 1 }}>
                  <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: i * 2 }}>
                    <ProfCard p={p} />
                  </motion.div>
                </motion.div>
              ))}
              <motion.div className="vs" style={{ order: 2 }} initial={{ scale: 3, opacity: 0, rotate: -40 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5, visualDuration: 0.5, delay: 1.45 }}>
                <span className="vs-ring" /><span className="vs-ring b" /><span className="vs-core">VS</span>
              </motion.div>
            </div>
          )}

          <motion.div className="ctas" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring(0.8, 0.5), delay: 1.6 }}>
            <Link className="gbtn xl" href={cta}>⚔ {profile ? 'Continue battle' : 'Enter the arena'}</Link>
            <Link className="gbtn ghost" href="/leaderboard" style={{ alignSelf: 'center' }}>Rankings</Link>
          </motion.div>
          <span className="press-start">Press start</span>
        </motion.div>
      </section>

      {top.length > 0 && (
        <div className="ticker" aria-label="Top professors">
          <div className="ticker-track">
            {ticker.map((p, i) => (
              <button type="button" key={i} className="tick-item" onClick={() => open(p.id)} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }}>
                <span className="rk">#{p.rank}</span><Portrait p={p} /><span>{p.name}</span><Trophies n={p.elo} />
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="section">
        <div className="stats">
          {([['Professors', meta.stats.profs, 'rgba(255,62,165,.35)'], ['Mandatory courses', meta.stats.courses, 'rgba(62,230,255,.3)'],
            ['Battles fought', meta.stats.votes, 'rgba(255,204,77,.3)'], ['Players', meta.stats.voters, 'rgba(139,92,255,.4)']] as const).map(([lbl, n, glow]) => (
            <div key={lbl} className="glass stat reveal" style={{ ['--glow' as any]: glow }}>
              <div className="num grad-text" data-count={n}>0</div><div className="lbl">{lbl}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head reveal"><span className="eyebrow">How it works</span><h2>Three steps to glory</h2></div>
        <div className="steps">
          {[
            ['🛡️', 'Join a clan', 'Log in with your ETH email and pick your department — once. Your votes shape its ladder.'],
            ['🃏', 'Draft your deck', 'We pull who taught each of your semesters from the VVZ of the term you actually took it.'],
            ['⚔️', 'Battle', 'Two cards, one choice. Tap or flick the better teacher. Trophies move with every duel.'],
          ].map(([ico, h, p], i) => (
            <div key={h} className="glass step reveal"><span className="ico">{ico}</span><div className="num">0{i + 1}</div><h3>{h}</h3><p>{p}</p></div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head reveal"><span className="eyebrow">Rarity = league</span><h2>Climb the leagues</h2>
          <p className="muted">Every professor starts at 1200 trophies. Win duels, rise in rarity.</p></div>
        <div className="ladder">
          {meta.leagues.map((l, i) => (
            <div key={l.key} className="rung reveal" style={{ paddingBottom: 14 + i * 8 }}>
              <LeagueBadge league={l.key} /><b>{l.name}</b><small>{l.min ? `${l.min}+` : 'start'}</small>
            </div>
          ))}
        </div>
      </section>

      {anyVotes && (
        <section className="section">
          <div className="section-head reveal"><span className="eyebrow">Hall of fame</span><h2>Current champions</h2></div>
          <Podium top={top} />
          <div style={{ textAlign: 'center', marginTop: 40 }}><Link className="gbtn cyan" href="/leaderboard">Full rankings</Link></div>
        </section>
      )}

      <footer className="footer">
        Course &amp; lecturer data from the ETH Zurich <a href="https://www.vvz.ethz.ch" target="_blank" rel="noopener noreferrer">Vorlesungsverzeichnis</a>. Portraits from public ETH pages.
        <br />Unofficial student project — not affiliated with ETH Zurich. It’s about teaching, not people: play fair.
      </footer>
    </div>
  );
}

function countUp(el: HTMLElement, reduced: boolean) {
  const to = Number(el.dataset.count) || 0;
  if (reduced) { el.textContent = to.toLocaleString(); return; }
  const t0 = performance.now(), dur = 1300;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(to * (1 - (1 - k) ** 3)).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
