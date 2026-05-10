import { useState } from 'react';
import { html } from './utils.js';
import { useGame } from './contexts/GameContext.js';
import { THEMES } from './i18n.js';
import Home from './views/Home.js';
import PlayerView from './views/player/PlayerView.js';
import HostView from './views/host/HostView.js';
import DisplayView from './views/display/DisplayView.js';
import AdminView from './views/admin/AdminView.js';
import { GameIcon, UiIcon } from './components/ui.js';

const NAV_LINKS = [
  { id: 'player', iconType: 'ui', iconName: 'profile', labelKey: 'nav.play' },
  { id: 'host', iconType: 'game', iconName: 'host', labelKey: 'nav.host' },
  { id: 'admin', iconType: 'ui', iconName: 'settings', labelKey: 'nav.studio' },
];
const THEME_ORDER = ['business', 'party', 'tvshow'];

const navIcon = (item, className = 'h-4 w-4') => (
  item.iconType === 'game'
    ? html`<${GameIcon} name=${item.iconName} className=${className} />`
    : html`<${UiIcon} name=${item.iconName} className=${className} />`
);

function NavBar() {
  const { page, navigate, lang, setLang, theme, setTheme, t } = useGame();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  const go = (p) => { navigate(p); };
  const openDisplay = () => {
    window.open(window.location.origin + window.location.pathname + '#display', '_blank');
  };
  const toggleLang = () => setLang(lang === 'en' ? 'fr' : 'en');
  const chooseTheme = (nextTheme) => {
    setTheme(nextTheme);
    setThemeMenuOpen(false);
  };

  return html`
    <nav className="sticky top-0 z-30 border-b border-white/8 bg-bg-alt/78 px-3 py-2.5 backdrop-blur-xl sm:px-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <button
          onClick=${() => go('home')}
          className="ui-btn ui-btn-ghost inline-flex min-h-[40px] items-center gap-2 rounded-lg app-chip px-3 font-display text-lg font-black hover:border-sky-300/45 hover:text-white"
        >
          <${GameIcon} name="gamepad" className="h-6 w-6" />
          <span className="gradient-text">QuizzGeek</span>
        </button>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          <div className="hidden min-w-0 gap-1 overflow-visible rounded-lg app-panel p-1 sm:flex items-center">
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
                ${navIcon(l)}
                <span>${t(l.labelKey)}</span>
              </button>
            `)}
            <button
              onClick=${openDisplay}
              className="ui-btn ui-btn-ghost flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-extrabold text-white/48 hover:bg-white/8 hover:text-white"
              title=${t('nav.openScreen')}
            >
              <${GameIcon} name="display" className="h-4 w-4" />
              <span>${t('nav.screen')}</span>
              <span className="text-[10px] text-white/30">↗</span>
            </button>
            <div className="relative shrink-0">
              <button
                onClick=${() => setThemeMenuOpen(open => !open)}
                className=${`ui-btn ui-btn-ghost flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-extrabold ${
                  themeMenuOpen ? 'bg-sky-400/16 text-sky-100 shadow-neon-blue' : 'text-white/48 hover:bg-white/8 hover:text-white'
                }`}
                title=${t('home.theme')}
                aria-expanded=${themeMenuOpen}
              >
                <span>${THEMES[theme]?.icon || '🎨'}</span>
                <span>${t('home.theme')}</span>
                <span className="text-[10px] text-white/30">${themeMenuOpen ? '▲' : '▼'}</span>
              </button>
              ${themeMenuOpen && html`
                <div className="theme-menu absolute right-0 top-[calc(100%+8px)] z-50 min-w-[190px] rounded-xl app-surface p-1.5">
                  ${THEME_ORDER.map(id => {
                    const meta = THEMES[id];
                    const active = theme === id;
                    return html`
                      <button
                        key=${id}
                        onClick=${() => chooseTheme(id)}
                        className=${`theme-menu-item ui-btn flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-extrabold ${
                          active ? 'is-active text-sky-100' : 'text-white/58 hover:text-white'
                        }`}
                      >
                        <span className="text-base">${meta?.icon || '🎨'}</span>
                        <span className="flex-1">${t(meta?.labelKey || 'home.theme')}</span>
                        ${active && html`<span className="text-xs text-sky-200">✓</span>`}
                      </button>
                    `;
                  })}
                </div>
              `}
            </div>

          </div>

          <!-- Slider langue : tout à droite, hors du panneau nav -->
          <button
            onClick=${toggleLang}
            className=${`nav-lang-switch ${lang === 'en' ? 'is-en' : 'is-fr'}`}
            title=${lang === 'en' ? 'Passer en Français' : 'Switch to English'}
          >
            <span className="nav-lang-face nav-lang-fr"></span>
            <span className="nav-lang-face nav-lang-en"></span>
            <span className="nav-lang-knob">${lang === 'en' ? 'EN' : 'FR'}</span>
          </button>
        </div>
      </div>
    </nav>
  `;
}

export default function App() {
  const { page } = useGame();

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
