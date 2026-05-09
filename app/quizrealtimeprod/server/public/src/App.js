import { html } from './utils.js';
import { useGame } from './contexts/GameContext.js';
import { THEMES } from './i18n.js';
import Home from './views/Home.js';
import PlayerView from './views/player/PlayerView.js';
import HostView from './views/host/HostView.js';
import DisplayView from './views/display/DisplayView.js';
import AdminView from './views/admin/AdminView.js';

const NAV_LINKS = [
  { id: 'player', icon: '📱', labelKey: 'nav.play' },
  { id: 'host', icon: '🎮', labelKey: 'nav.host' },
  { id: 'admin', icon: '⚙️', labelKey: 'nav.studio' },
];
const THEME_ORDER = ['business', 'party', 'tvshow'];

function NavBar() {
  const { page, navigate, lang, setLang, theme, setTheme, t } = useGame();
  const go = (p) => { navigate(p); };
  const openDisplay = () => {
    window.open(window.location.origin + window.location.pathname + '#display', '_blank');
  };
  const toggleLang = () => setLang(lang === 'en' ? 'fr' : 'en');
  const cycleTheme = () => {
    const idx = THEME_ORDER.indexOf(theme);
    setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length] || 'business');
  };

  return html`
    <nav className="sticky top-0 z-30 border-b border-white/8 bg-bg-alt/78 px-3 py-2.5 backdrop-blur-xl sm:px-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <button
          onClick=${() => go('home')}
          className="ui-btn ui-btn-ghost inline-flex min-h-[40px] items-center gap-2 rounded-lg app-chip px-3 font-display text-lg font-black hover:border-sky-300/45 hover:text-white"
        >
          <span className="text-sky-300">⚡</span>
          <span className="gradient-text">QuizzGeek</span>
        </button>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="hidden min-w-0 gap-1 overflow-x-auto rounded-lg app-panel p-1 sm:flex">
            ${NAV_LINKS.map(l => html`
              <button
                key=${l.id}
                onClick=${() => go(l.id)}
                className=${`ui-btn flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-extrabold ${
                  page === l.id
                    ? 'bg-sky-400/16 text-sky-100 shadow-neon-blue'
                    : 'text-white/48 hover:bg-white/8 hover:text-white'
                }`}
              >
                <span>${l.icon}</span>
                <span>${t(l.labelKey)}</span>
              </button>
            `)}
            <button
              onClick=${openDisplay}
              className="ui-btn ui-btn-ghost flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-extrabold text-white/48 hover:bg-white/8 hover:text-white"
              title=${t('nav.openScreen')}
            >
              <span>📺</span>
              <span>${t('nav.screen')}</span>
              <span className="text-[10px] text-white/30">↗</span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-lg app-panel p-1">
            <!-- Slider langue : knob à droite = FR (défaut), knob à gauche = EN -->
            <button
              onClick=${toggleLang}
              className=${`nav-lang-switch ${lang === 'en' ? 'is-en' : 'is-fr'}`}
              title=${t('home.language')}
            >
              <span className="nav-lang-face nav-lang-fr">🇫🇷 FR</span>
              <span className="nav-lang-face nav-lang-en">🇬🇧 EN</span>
              <span className="nav-lang-knob">${lang === 'en' ? '🇬🇧' : '🇫🇷'}</span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-lg app-panel p-1">
            <button
              onClick=${cycleTheme}
              className="ui-btn ui-btn-ghost flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-extrabold text-white/48 hover:bg-white/8 hover:text-white"
              title=${t('home.theme')}
            >
              <span>${THEMES[theme]?.icon || '🎨'}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  `;
}

export default function App() {
  const { page } = useGame();

  // Ecran TV — pas de NavBar
  if (page === 'display') return html`<${DisplayView} />`;

  return html`
    <div className="flex min-h-[100dvh] flex-col">
      <${NavBar} />
      <div className="flex-1">
        ${page === 'home'   && html`<${Home} />`}
        ${page === 'player' && html`<${PlayerView} />`}
        ${page === 'host'   && html`<${HostView} />`}
        ${page === 'admin'  && html`<${AdminView} />`}
      </div>
    </div>
  `;
}
