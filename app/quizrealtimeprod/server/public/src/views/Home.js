import { html } from '../utils.js';
import { useGame } from '../contexts/GameContext.js';

const ROLES = [
  { id: 'player', icon: '🎮', label: 'Jouer', sub: 'Rejoindre une partie', color: 'from-sky-500 to-violet-500' },
  { id: 'host', icon: '🎬', label: 'Maitre de jeu', sub: 'Animer la session', color: 'from-teal-400 to-emerald-500' },
  { id: 'display', icon: '📺', label: 'Ecran TV', sub: 'Diffuser le quiz', color: 'from-cyan-400 to-blue-500' },
  { id: 'admin', icon: '⚙️', label: 'Studio', sub: 'Creer et gerer', color: 'from-amber-400 to-rose-500' },
];

const ROUND_TYPES = [
  { icon: '🧠', label: 'QCM' },
  { icon: '⚡', label: 'Rapidite' },
  { icon: '✓', label: 'Vrai / Faux' },
  { icon: '☰', label: 'Burger' },
  { icon: '▣', label: 'Vote' },
  { icon: '▶', label: 'Video' },
];

const SIGNALS = [
  { value: 'Multi-ecrans', label: 'TV, desktop, tablette et mobile' },
  { value: 'Temps reel', label: 'Reponses, scores et transitions live' },
  { value: 'Media', label: 'Images, sons et videos par phase' },
];

export default function Home() {
  const { navigate } = useGame();

  const go = (id) => { navigate(id); };

  return html`
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full max-w-6xl animate-fade-in">
        <header className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full app-chip px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
              <span className="h-2 w-2 rounded-full bg-teal-300 shadow-neon-green"></span>
              Live quiz suite
            </div>
            <h1 className="font-display text-5xl font-black leading-none gradient-text sm:text-6xl lg:text-7xl">
              QuizzGeek
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
              Pilotez des quiz live avec buzzers, votes, videos, musiques, podiums et interfaces adaptees a chaque ecran.
            </p>
          </div>

          <div className="app-surface rounded-lg p-4">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/38">Regie</div>
                <div className="mt-1 text-lg font-black text-white">Pret pour le live</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-400/14 text-2xl text-sky-100">⚡</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              ${SIGNALS.map(item => html`
                <div key=${item.value} className="rounded-lg app-panel p-3">
                  <div className="text-sm font-extrabold text-white">${item.value}</div>
                  <div className="mt-1 text-[11px] leading-4 text-white/42">${item.label}</div>
                </div>
              `)}
            </div>
          </div>
        </header>

        <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${ROLES.map(r => html`
            <button
              key=${r.id}
              onClick=${() => go(r.id)}
              className="group relative min-h-[156px] overflow-hidden rounded-lg app-surface p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-sky-300/35 hover:shadow-accent active:translate-y-0"
            >
              <div className=${'absolute inset-x-0 top-0 h-1 bg-gradient-to-r ' + r.color}></div>
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg app-panel text-2xl transition-transform duration-300 group-hover:scale-110">${r.icon}</span>
                  <span className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">Ouvrir</span>
                </div>
                <div>
                  <div className="text-xl font-black text-white">${r.label}</div>
                  <div className="mt-1 text-sm text-white/50">${r.sub}</div>
                </div>
              </div>
            </button>
          `)}
        </section>

        <section className="mt-4 flex flex-col gap-3 rounded-lg app-panel p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            ${ROUND_TYPES.map(rt => html`
              <div key=${rt.label} className="inline-flex items-center gap-2 rounded-full app-chip px-3 py-2 text-sm font-bold text-white/68">
                <span className="text-sky-200">${rt.icon}</span>
                <span>${rt.label}</span>
              </div>
            `)}
          </div>
          <button
            onClick=${() => go('admin')}
            className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-white/8 px-4 py-2 text-sm font-extrabold text-white transition-colors hover:bg-white/12"
          >
            Creer un quiz
          </button>
        </section>
      </div>
    </div>
  `;
}
