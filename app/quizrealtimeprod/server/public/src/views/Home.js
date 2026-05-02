import { html } from '../utils.js';
import { useGame } from '../contexts/GameContext.js';

const ROLES = [
  { id: 'player',  icon: '🎮', label: 'Jouer',         sub: 'Rejoindre une partie',        color: 'from-violet-600 to-indigo-700' },
  { id: 'host',    icon: '🎬', label: 'Maître de jeu',  sub: 'Animer et piloter',           color: 'from-emerald-600 to-teal-700' },
  { id: 'display', icon: '🖥️', label: 'Écran TV',       sub: 'Affichage grand écran',       color: 'from-blue-600 to-cyan-700' },
  { id: 'admin',   icon: '🛠️', label: 'Admin',          sub: 'Créer et gérer les quiz',     color: 'from-rose-600 to-pink-700' },
];

const ROUND_TYPES = [
  { icon: '🧠', label: 'QCM' },
  { icon: '⚡', label: 'Rapidité' },
  { icon: '✅', label: 'Vrai / Faux' },
  { icon: '🍔', label: 'Burger' },
  { icon: '🗳️', label: 'Vote' },
  { icon: '🎬', label: 'Vidéo' },
];

export default function Home() {
  const { navigate, soundPlay } = useGame();

  const go = (id) => {
    soundPlay('answer');
    navigate(id);
  };

  return html`
    <div className="flex flex-col items-center min-h-[100dvh] bg-bg px-4 py-8">

      <!-- Hero -->
      <div className="text-center mb-12 mt-6 animate-fade-in">
        <div className="text-7xl mb-4 animate-float">⚡</div>
        <h1 className="font-display text-5xl font-black gradient-text mb-2">QuizzGeek</h1>
        <p className="text-white/50 text-lg">Quiz live · Buzzers · Votes · Podium</p>
      </div>

      <!-- Role cards -->
      <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-10">
        ${ROLES.map(r => html`
          <button
            key=${r.id}
            onClick=${() => go(r.id)}
            className=${'relative flex flex-col items-center gap-2 p-6 rounded-2xl border border-white/8 bg-bg-card hover:border-white/20 hover:scale-105 active:scale-95 transition-all duration-200 group overflow-hidden text-center'}
          >
            <div className=${'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br ' + r.color + ' opacity-10'} />
            <span className="text-4xl">${r.icon}</span>
            <div className="text-center">
              <div className="font-bold text-white text-base">${r.label}</div>
              <div className="text-xs text-white/45 mt-0.5">${r.sub}</div>
            </div>
          </button>
        `)}
      </div>

      <!-- Round type chips -->
      <div className="flex flex-wrap gap-2 justify-center max-w-sm">
        ${ROUND_TYPES.map(rt => html`
          <div key=${rt.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-card border border-white/8 text-sm text-white/60 font-medium">
            <span>${rt.icon}</span>
            <span>${rt.label}</span>
          </div>
        `)}
      </div>

    </div>
  `;
}
