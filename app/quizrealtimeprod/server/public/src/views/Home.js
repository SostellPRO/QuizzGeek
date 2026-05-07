import { html } from '../utils.js';
import { useGame } from '../contexts/GameContext.js';

const ROLES = [
  { id: 'player',  icon: '🎮', label: 'Jouer',         sub: 'Rejoindre une partie', color: 'from-sky-500 to-violet-600',   glow: 'rgba(124,92,255,.30)', accent: '#7c5cff' },
  { id: 'host',    icon: '🎬', label: 'Maître de jeu',  sub: 'Animer la session',    color: 'from-teal-400 to-emerald-500', glow: 'rgba(45,212,130,.25)', accent: '#2dd4bf' },
  { id: 'display', icon: '📺', label: 'Écran TV',       sub: 'Diffuser le quiz',     color: 'from-cyan-400 to-blue-500',   glow: 'rgba(56,189,248,.25)', accent: '#38bdf8' },
  { id: 'admin',   icon: '⚙️', label: 'Studio',         sub: 'Créer et gérer',       color: 'from-amber-400 to-rose-500',  glow: 'rgba(245,158,11,.25)', accent: '#f59e0b' },
];

const MODES = [
  { icon: '🧠', label: 'QCM',          color: '#7c5cff' },
  { icon: '✅', label: 'Vrai / Faux',  color: '#2dd4bf' },
  { icon: '⚡', label: 'Buzzer',       color: '#f59e0b' },
  { icon: '🗳️', label: 'Vote',         color: '#38bdf8' },
  { icon: '🍔', label: 'Burger',       color: '#fb923c' },
  { icon: '🎬', label: 'Vidéo',        color: '#fb7185' },
];

export default function Home() {
  const { navigate } = useGame();

  const go = (id) => {
    if (id === 'display' || id === 'player') {
      window.open(`${window.location.origin}/#${id}`, '_blank', 'noopener');
    } else {
      navigate(id);
    }
  };

  return html`
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-start overflow-hidden px-4 py-10 sm:px-6 gap-8">

      <!-- Ambient blobs -->
      <div aria-hidden="true" style=${{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden',
      }}>
        <div style=${{ position:'absolute', top:'-15vw', left:'-10vw', width:'55vw', height:'55vw', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(124,92,255,.13) 0%, transparent 70%)', filter:'blur(40px)' }} />
        <div style=${{ position:'absolute', bottom:'-10vw', right:'-8vw', width:'45vw', height:'45vw', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(45,212,191,.10) 0%, transparent 70%)', filter:'blur(40px)' }} />
      </div>

      <div className="relative z-10 w-full max-w-4xl animate-fade-in flex flex-col gap-8">

        <!-- ── Hero ── -->
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full app-chip px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-200">
            <span className="h-2 w-2 rounded-full bg-teal-300 animate-pulse" style=${{ boxShadow:'0 0 6px #2dd4bf' }}></span>
            Live quiz engine
          </div>
          <h1 className="font-display font-black leading-none gradient-text"
              style=${{ fontSize:'clamp(3.5rem,10vw,6rem)', marginBottom:'0.5rem' }}>
            QuizzGeek
          </h1>
          <p style=${{ fontSize:'clamp(.9rem,1.8vw,1.1rem)', color:'rgba(255,255,255,.45)', maxWidth:'38rem', margin:'0 auto' }}>
            Buzzers, votes, vidéos et podiums — des quiz live qui marquent les esprits.
          </p>
        </div>

        <!-- ── Modes pills ── -->
        <div className="flex flex-wrap justify-center gap-2">
          ${MODES.map(m => html`
            <span
              key=${m.label}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
              style=${{ background: m.color + '18', border: '1px solid ' + m.color + '40', color: m.color }}
            >
              ${m.icon} ${m.label}
            </span>
          `)}
        </div>

        <!-- ── Role cards ── -->
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          ${ROLES.map(r => html`
            <button
              key=${r.id}
              onClick=${() => go(r.id)}
              className="group relative overflow-hidden rounded-2xl app-surface text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl active:translate-y-0 active:scale-[.98]"
              style=${{ boxShadow:'0 0 0 1px rgba(255,255,255,.07)', padding:'clamp(14px,2.5vw,22px)' }}
            >
              <!-- gradient bar top -->
              <div className=${'absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r rounded-t-2xl ' + r.color}></div>
              <!-- glow on hover -->
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 rounded-2xl"
                   style=${{ background: `radial-gradient(ellipse at 50% 0%, ${r.glow}, transparent 65%)` }}></div>
              <div className="relative z-10 flex flex-col gap-3 h-full">
                <!-- icon -->
                <div className="flex items-start justify-between">
                  <span
                    className="flex items-center justify-center rounded-xl app-panel transition-transform duration-300 group-hover:scale-110"
                    style=${{ width:'clamp(44px,7vw,56px)', height:'clamp(44px,7vw,56px)', fontSize:'clamp(1.4rem,3vw,1.8rem)' }}
                  >
                    ${r.icon}
                  </span>
                  <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white/35 group-hover:text-white/55 transition-colors mt-1">
                    ↗
                  </span>
                </div>
                <!-- label -->
                <div>
                  <div className="font-black text-white" style=${{ fontSize:'clamp(.95rem,1.8vw,1.05rem)' }}>${r.label}</div>
                  <div className="mt-0.5 text-white/40" style=${{ fontSize:'clamp(.72rem,1.3vw,.8rem)' }}>${r.sub}</div>
                </div>
                <!-- colored dot line -->
                <div className="mt-auto pt-2">
                  <div className="h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                       style=${{ background: `linear-gradient(to right, ${r.accent}, transparent)` }}></div>
                </div>
              </div>
            </button>
          `)}
        </section>

        <!-- ── Divider ── -->
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/6"></div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/20">Ce que tu peux faire</span>
          <div className="flex-1 h-px bg-white/6"></div>
        </div>

        <!-- ── Feature cards ── -->
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${[
            { icon:'🧠', title:'QCM & Vrai/Faux',    desc:'Réponses multiples ou binaires, chrono et scores en temps réel.',        color:'#7c5cff' },
            { icon:'⚡', title:'Buzzer & Rapidité',   desc:'Premier à buzzer, meilleure réponse — adrénaline garantie.',             color:'#f59e0b' },
            { icon:'🗳️', title:'Use Your Words',      desc:'Chacun propose une réponse, tout le monde vote, les points s\'envolent.', color:'#38bdf8' },
            { icon:'🍔', title:'Burger de la Mort',   desc:'Un candidat mémorise une liste dans l\'ordre sous la pression.',         color:'#fb923c' },
            { icon:'🎬', title:'Challenge Vidéo',     desc:'Défi filmé en direct, entraînement optionnel, scoring par l\'admin.',    color:'#fb7185' },
            { icon:'🏆', title:'Cérémonie finale',    desc:'Podium animé, médailles, révélation progressive du dernier au premier.', color:'#2dd4bf' },
          ].map(f => html`
            <div key=${f.title}
                 className="rounded-xl app-panel flex items-start gap-3"
                 style=${{ padding:'clamp(12px,2vw,16px)' }}>
              <span
                className="flex-shrink-0 flex items-center justify-center rounded-lg mt-0.5"
                style=${{ width:'36px', height:'36px', fontSize:'1.25rem', background: f.color + '18', border:'1px solid '+f.color+'30' }}
              >${f.icon}</span>
              <div>
                <div className="font-black text-white" style=${{ fontSize:'.88rem' }}>${f.title}</div>
                <div className="mt-0.5 leading-4 text-white/38" style=${{ fontSize:'.75rem' }}>${f.desc}</div>
              </div>
            </div>
          `)}
        </section>

        <!-- ── Footer CTA ── -->
        <div className="text-center pb-2">
          <button
            onClick=${() => go('admin')}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold text-white/55 transition-all hover:text-white hover:bg-white/6 app-surface"
            style=${{ fontSize:'.85rem', border:'1px solid rgba(255,255,255,.06)' }}
          >
            ⚙️ Créer un nouveau quiz
          </button>
        </div>

      </div>
    </div>
  `;
}
