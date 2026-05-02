import { html } from './utils.js';
import { useGame } from './contexts/GameContext.js';
import Home        from './views/Home.js';
import PlayerView  from './views/player/PlayerView.js';
import HostView    from './views/host/HostView.js';
import DisplayView from './views/display/DisplayView.js';
import AdminView   from './views/admin/AdminView.js';

// Top navigation bar (only shown on non-display, non-player pages)
function NavBar() {
  const { page, navigate } = useGame();

  const go = (p) => { navigate(p); };

  const LINKS = [
    { id: 'player',  icon: '📱', label: 'Jouer' },
    { id: 'host',    icon: '🎮', label: 'Host' },
    { id: 'display', icon: '📺', label: 'Écran' },
    { id: 'admin',   icon: '⚙️', label: 'Admin' },
  ];

  return html`
    <nav className="flex items-center justify-between px-4 py-2.5 bg-bg-alt border-b border-white/5 sticky top-0 z-30">
      <button
        onClick=${() => go('home')}
        className="font-display font-black text-lg gradient-text hover:opacity-80 transition-opacity"
      >
        ⚡ QuizzGeek
      </button>
      <div className="flex gap-1">
        ${LINKS.map(l => html`
          <button
            key=${l.id}
            onClick=${() => go(l.id)}
            className=${`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              page === l.id
                ? 'bg-accent/20 text-accent'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="hidden sm:inline">${l.icon}</span>
            <span>${l.label}</span>
          </button>
        `)}
      </div>
    </nav>
  `;
}

// Page registry
const PAGES = { home: Home, player: PlayerView, host: HostView, display: DisplayView, admin: AdminView };

// Pages that get the full viewport (no navbar)
const FULL_PAGES = new Set(['display', 'player']);

export default function App() {
  const { page } = useGame();

  const PageComponent = PAGES[page] || Home;
  const showNav = !FULL_PAGES.has(page);

  return html`
    <div className="flex flex-col min-h-[100dvh]">
      ${showNav && html`<${NavBar} />`}
      <main className="flex-1 flex flex-col">
        <${PageComponent} />
      </main>
    </div>
  `;
}
