import { html } from '../utils.js';
import { useGame } from '../contexts/GameContext.js';

const ROLES = [
  { id: 'player',  icon: '🎮', label: 'Jouer',        sub: 'Rejoindre une partie',  color: 'from-sky-500 to-violet-500',    glow: 'rgba(124,92,255,.25)' },
  { id: 'host',    icon: '🎬', label: 'Maitre de jeu', sub: 'Animer la session',      color: 'from-teal-400 to-emerald-500',  glow: 'rgba(45,212,130,.20)' },
  { id: 'display', icon: '📺', label: 'Ecran TV',      sub: 'Diffuser le quiz',       color: 'from-cyan-400 to-blue-500',     glow: 'rgba(56,189,248,.20)' },
  { id: 'admin',   icon: '⚙️', label: 'Studio',        sub: 'Creer et gerer',         color: 'from-amber-400 to-rose-500',    glow: 'rgba(245,158,11,.20)' },
];

const FEATURES = [
  { icon: '🧠', title: 'QCM & Vrai/Faux', desc: 'Questions classiques avec compte à rebours et scores instantanés' },
  { icon: '⚡', title: 'Rapidité & Buzzer', desc: 'Buzze le premier, réponds le mieux — adrénaline garantie' },
  { icon: '🗳️', title: 'Use Your Words',   desc: 'Les joueurs inventent les réponses, les autres votent' },
  { icon: '🍔', title: 'Burger de la Mort', desc: 'Un candidat mémorise une liste d'éléments dans l'ordre' },
  { icon: '🎬', title: 'Challenge Vidéo',  desc: 'Défi filmé en direct avec entraînement et scoring admin' },
  { icon: '🏆', title: 'Cérémonie finale', desc: 'Podium, médailles et révélation progressive des gagnants' },
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
    <div className="flex min-h-[100dvh] flex-col items-center justify-start px-4 py-8 sm:px-6 lg:px-8 gap-10">
      <div className="w-full max-w-5xl animate-fade-in">

        <!-- Hero -->
        <div className="text-center mb-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full app-chip px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-200">
            <span className="h-2 w-2 rounded-full bg-teal-300 shadow-neon-green animate-pulse"></span>
            Live quiz engine
          </div>
          <h1 className="font-display text-6xl font-black leading-none gradient-text sm:text-7xl lg:text-8xl mb-4">
            QuizzGeek
          </h1>
          <p className="max-w-xl mx-auto text-base leading-7 text-white/55 sm:text-lg">
            Buzzers, votes, musiques, vidéos et podiums — pour des quiz live inoubliables.
          </p>
        </div>

        <!-- Role cards -->
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-8">
          ${ROLES.map(r => html`
            <button
              key=${r.id}
              onClick=${() => go(r.id)}
              className="group relative overflow-hidden rounded-2xl app-surface p-5 text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl active:translate-y-0"
              style=${{ boxShadow: '0 0 0 1px rgba(255,255,255,.06)' }}
            >
              <div className=${'absolute inset-x-0 top-0 h-1 bg-gradient-to-r rounded-t-2xl ' + r.color}></div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                   style=${{ background: `radial-gradient(ellipse at top, ${r.glow}, transparent 70%)` }}></div>
              <div className="relative z-10 flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl app-panel text-3xl transition-transform duration-300 group-hover:scale-110">
                    ${r.icon}
                  </span>
                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 group-hover:text-white/60 transition-colors">
                    Ouvrir →
                  </span>
                </div>
                <div>
                  <div className="text-lg font-black text-white">${r.label}</div>
                  <div className="mt-0.5 text-sm text-white/45">${r.sub}</div>
                </div>
              </div>
            </button>
          `)}
        </section>

        <!-- Feature grid -->
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          ${FEATURES.map(f => html`
            <div key=${f.title} className="rounded-xl app-panel px-4 py-3 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0 mt-0.5">${f.icon}</span>
              <div>
                <div className="text-sm font-black text-white">${f.title}</div>
                <div className="mt-0.5 text-xs leading-4 text-white/40">${f.desc}</div>
              </div>
            </div>
          `)}
        </section>

        <!-- Footer -->
        <div className="mt-6 text-center">
          <button
            onClick=${() => go('admin')}
            className="inline-flex items-center gap-2 rounded-xl app-surface px-5 py-2.5 text-sm font-bold text-white/60 hover:text-white transition-colors hover:bg-white/8"
          >
            ⚙️ Créer un nouveau quiz
          </button>
        </div>

      </div>
    </div>
  `;
}
