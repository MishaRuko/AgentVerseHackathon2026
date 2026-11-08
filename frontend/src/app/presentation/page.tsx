'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight, ArrowRight, Printer, Sparkles, Search, Users, LineChart,
  TrendingDown, ShieldCheck, Plug, Bot, Handshake,
} from 'lucide-react';
import './presentation.css';

const Foot = () => (
  <div className="slide-foot">
    <a className="foot-brand" href="https://byebye.fyi" target="_blank" rel="noopener noreferrer">
      <ArrowUpRight size={17} strokeWidth={2.4} />byebye.fyi
    </a>
  </div>
);

const INK = '#20211f';
const YELLOW = '#fddf6c';
const CORAL = '#ff9074';

/* Problem-slide illustration: ~46% of a licence pool unused (donut). */
const WasteArt = () => {
  // 46% unused as a rounded-cap donut, with a small gap for polish.
  const r = 60;
  const c = 2 * Math.PI * r;
  const gap = 6;
  const used = c * 0.54 - gap;
  const unused = c * 0.46 - gap;
  return (
    <svg viewBox="0 0 240 180" role="img" aria-label="46 percent of licences unused">
      <g transform="translate(120,90) rotate(-90)">
        {/* used portion (quiet track) */}
        <circle
          r={r} fill="none" stroke="#e9e4d2" strokeWidth="22" strokeLinecap="round"
          strokeDasharray={`${used} ${c - used}`}
          transform={`rotate(${(0.46 * 360) + (gap / c) * 360})`}
        />
        {/* unused portion (brand yellow) */}
        <circle
          r={r} fill="none" stroke={YELLOW} strokeWidth="22" strokeLinecap="round"
          strokeDasharray={`${unused} ${c - unused}`}
        />
      </g>
      <g transform="translate(120,90)">
        <text y="-4" textAnchor="middle" fontSize="38" fontWeight="700" letterSpacing="-1.5" fill={INK}>46%</text>
        <text y="20" textAnchor="middle" fontSize="11" letterSpacing="2" fill="#8a8b80" fontFamily="monospace">UNUSED</text>
      </g>
    </svg>
  );
};

/* Scattered data: four disconnected sources (finance, licence, provider, usage)
   floating at different angles, with broken dashed links that do not meet. */
const ScatterArt = () => (
  <svg viewBox="0 0 240 180" role="img" aria-label="Scattered documents, licences, providers and usage">
    {/* broken connective lines (nothing lines up) */}
    <g stroke="#cfcdbe" strokeWidth="1.6" strokeDasharray="3 5" fill="none">
      <path d="M70 70 Q110 55 128 96" />
      <path d="M96 116 Q150 110 170 74" />
    </g>
    <g stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
      {/* finance doc, top-left */}
      <g transform="translate(34,38) rotate(-10)">
        <rect width="50" height="62" rx="6" fill="#fff" />
        <rect x="8" y="11" width="34" height="4.5" rx="2.25" fill="#d9d9cd" stroke="none" />
        <rect x="8" y="23" width="28" height="4.5" rx="2.25" fill="#d9d9cd" stroke="none" />
        <text x="8" y="50" fontSize="8" fontFamily="monospace" fill="#a6a79a" stroke="none">£</text>
      </g>
      {/* licence card, top-right */}
      <g transform="translate(150,34) rotate(8)">
        <rect width="64" height="42" rx="8" fill={YELLOW} />
        <circle cx="16" cy="15" r="6.5" fill="#fff" />
        <rect x="29" y="10" width="28" height="4.5" rx="2.25" fill={INK} stroke="none" />
        <rect x="29" y="20" width="18" height="4.5" rx="2.25" fill={INK} stroke="none" opacity="0.45" />
      </g>
      {/* provider server, bottom-right */}
      <g transform="translate(158,96) rotate(-6)">
        <rect width="56" height="48" rx="7" fill="#fff3ee" />
        <rect x="10" y="11" width="36" height="8" rx="4" fill="#fff" />
        <rect x="10" y="24" width="36" height="8" rx="4" fill="#fff" />
        <circle cx="16" cy="15" r="1.8" fill={CORAL} stroke="none" />
        <circle cx="16" cy="28" r="1.8" fill={CORAL} stroke="none" />
      </g>
      {/* usage mini-chart, bottom-left */}
      <g transform="translate(42,104) rotate(12)">
        <rect width="54" height="46" rx="7" fill="#fff" />
        <rect x="11" y="27" width="6" height="10" rx="1.5" fill="#dfe8cf" stroke="none" />
        <rect x="24" y="19" width="6" height="18" rx="1.5" fill="#cadfa6" stroke="none" />
        <rect x="37" y="23" width="6" height="14" rx="1.5" fill="#dfe8cf" stroke="none" />
      </g>
    </g>
  </svg>
);

/* Optimisation hold-up: a padlock (lock-in) whose face carries a struck-through
   eye (can't see what to cut). Blindness plus lock-in in one mark. */
const WallArt = () => (
  <svg viewBox="0 0 240 180" role="img" aria-label="Locked in and unable to see where to cut">
    <g stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      {/* shackle */}
      <path d="M86 78 V64 a34 34 0 0 1 68 0 V78" fill="none" />
      {/* lock body */}
      <rect x="68" y="78" width="104" height="80" rx="14" fill={YELLOW} />
      {/* eye on the lock face */}
      <path d="M96 118 Q120 100 144 118 Q120 136 96 118 Z" fill="#fff" />
      <circle cx="120" cy="118" r="7.5" fill={INK} stroke="none" />
      {/* strike-through: can't see */}
      <line x1="92" y1="136" x2="148" y2="100" stroke={CORAL} strokeWidth="3.4" />
    </g>
  </svg>
);

/**
 * byebye.fyi pitch deck. Scrollable on screen; prints one slide per
 * landscape page via the browser's "Save as PDF" (window.print()).
 */
export default function Presentation() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slides = () =>
      Array.from(containerRef.current?.querySelectorAll<HTMLElement>('.slide') ?? []);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowRight'
        && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft') return;
      const list = slides();
      const mid = window.innerHeight / 2;
      const current = list.findIndex((s) => s.getBoundingClientRect().bottom > mid);
      const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      const next = Math.max(0, Math.min(list.length - 1, current + (forward ? 1 : -1)));
      list[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="deck" ref={containerRef}>
      <div className="deck-toolbar">
        <span className="toolbar-title"><ArrowUpRight size={18} strokeWidth={2.4} />byebye.fyi pitch deck</span>
        <span className="toolbar-spacer" />
        <button className="button primary small" onClick={() => window.print()}>
          <Printer size={14} />Save as PDF
        </button>
      </div>

      <div className="slides">
        {/* 1: Title */}
        <section className="slide slide-title" aria-label="Title">
          <span className="slide-index">01</span>
          <div className="title-logo">
            <Image src="/logo.png" width={1000} height={333} alt="byebye.fyi" className="title-logo-img" priority />
          </div>
          <h2 className="tagline">Corporate subscription right-sizing.</h2>
          <p className="sub">
            MCP tools that find and cut licence waste.
          </p>
          <span className="title-badge">
            <Sparkles size={15} /><b>The YEEI4 team</b>
          </span>
        </section>

        {/* 2: Problem */}
        <section className="slide" aria-label="Problem">
          <span className="slide-index">02</span>
          <h2 className="h2-wide">Corporates overpay for licences <span className="accent">they don&apos;t use.</span></h2>
          <div className="problem-cards">
            <article className="problem-card">
              <div className="pc-art"><WasteArt /></div>
              <h3>Paying for shelfware</h3>
            </article>
            <article className="problem-card">
              <div className="pc-art"><ScatterArt /></div>
              <h3>Scattered data</h3>
            </article>
            <article className="problem-card">
              <div className="pc-art"><WallArt /></div>
              <h3>Optimisation hold-up</h3>
            </article>
          </div>
          <Foot />
        </section>

        {/* 3: Solution */}
        <section className="slide" aria-label="Solution">
          <span className="slide-index">03</span>
          <h2>A set of <span className="accent">agentic tools.</span></h2>
          <div className="steps-row tools-4">
            <div className="step-card">
              <div className="step-icon"><Search size={20} /></div>
              <h3><code>research_pricing</code></h3>
              <p>Researches subscription tiers and vendor terms.</p>
            </div>
            <div className="step-card">
              <div className="step-icon"><Users size={20} /></div>
              <h3><code>get_usage</code></h3>
              <p>Traces real active-user counts from SSO.</p>
            </div>
            <div className="step-card">
              <div className="step-icon"><LineChart size={20} /></div>
              <h3><code>analyse_subscriptions</code></h3>
              <p>Suggests the optimal tier that still covers the real use.</p>
            </div>
            <div className="step-card">
              <div className="step-icon"><Handshake size={20} /></div>
              <span className="soon-pill">Coming soon</span>
              <h3><code>renegotiate_subscription</code></h3>
              <p>Automatically updates tiers to match the real-time use.</p>
            </div>
          </div>
          <Foot />
        </section>

        {/* 4: Under the hood */}
        <section className="slide" aria-label="Architecture">
          <span className="slide-index">04</span>
          <h2>Under the hood.</h2>
          <div className="flow">
            <div className="flow-card">
              <div className="fc-icon"><Bot size={20} /></div>
              <h3>Any MCP client</h3>
              <p>Claude, Copilot or your own agent calls the tools.</p>
            </div>
            <div className="flow-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
            <div className="flow-card">
              <div className="fc-icon"><Plug size={20} /></div>
              <h3>MCP server</h3>
              <p>Exposes the right-sizing tools over MCP.</p>
            </div>
            <div className="flow-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
            <div className="flow-card">
              <div className="fc-icon"><Sparkles size={20} /></div>
              <h3>Gemini engine</h3>
              <p>Researches and analyses even messy data, securely.</p>
            </div>
          </div>
          <Foot />
        </section>

        {/* 5: Implementation (against judging criteria) */}
        <section className="slide" aria-label="Implementation">
          <span className="slide-index">05</span>
          <h2>How we <span className="accent">deliver.</span></h2>
          <div className="impl-grid">
            <article className="impl-card">
              <h3>Traceable reasoning</h3>
              <p>Every recommendation traces from live SSO activity-log data and real vendor pricing tiers.</p>
            </article>
            <article className="impl-card">
              <h3>Real data</h3>
              <p>Real data is sourced, cached and refreshed to collect repeatable benchmarks to increase negotiation power.</p>
            </article>
            <article className="impl-card">
              <h3>Risk mitigation</h3>
              <p>Call limits enforced, every action logged.</p>
            </article>
            <article className="impl-card">
              <h3>Impact &amp; Quality</h3>
              <p>Immediate saving and information in real time.</p>
            </article>
          </div>
          <Foot />
        </section>

        {/* 6: Closing */}
        <section className="slide slide-close" aria-label="Closing">
          <span className="slide-index">06</span>
          <Image src="/logo.png" width={1000} height={333} alt="byebye.fyi" className="close-logo" priority />
          <h2>Say bye-bye to waste.</h2>
          <div className="value-strip close-strip">
            <span><Plug size={15} /><b>Works with your systems</b></span>
            <span><TrendingDown size={15} /><b>Saves up to 30%</b></span>
            <span><ShieldCheck size={15} /><b>Keeps you informed</b></span>
          </div>
        </section>
      </div>
    </div>
  );
}
