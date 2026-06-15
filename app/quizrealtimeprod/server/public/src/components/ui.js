// Shared UI components
import { html } from '../utils.js';

let lastUiSoundAt = 0;
const uiAudioCache = new Map();

const UI_SOUND_BY_VARIANT = {
  primary: '/sounds/04button.mp3',
  secondary: '/sounds/04button.mp3',
  ghost: '/sounds/04button.mp3',
  nav: '/sounds/04button.mp3',
  tv: '/sounds/04button.mp3',
  warning: '/sounds/03notification.mp3',
  success: '/sounds/05confirm%20success.mp3',
  danger: '/sounds/06error2.mp3',
};

function playUiAudio(src, volume = 0.42) {
  let base = uiAudioCache.get(src);
  if (!base) {
    base = new Audio(src);
    base.preload = 'auto';
    uiAudioCache.set(src, base);
  }
  const audio = base.cloneNode();
  audio.volume = volume;
  audio.play().catch(() => {});
}

function playUiFeedback(variant = 'primary') {
  try {
    navigator.vibrate?.(variant === 'danger' ? [18, 24, 18] : 14);
  } catch {}

  try {
    const now = performance.now();
    if (now - lastUiSoundAt < 70) return;
    lastUiSoundAt = now;
    playUiAudio(UI_SOUND_BY_VARIANT[variant] || UI_SOUND_BY_VARIANT.primary, variant === 'danger' ? 0.62 : 0.42);
  } catch {}
}

const SYSTEM_ICON_PATHS = {
  settings: '<path d="M9.4 3.1 10 1h4l.6 2.1 1.8.8 1.9-1 2.8 2.8-1 1.9.8 1.8L23 10v4l-2.1.6-.8 1.8 1 1.9-2.8 2.8-1.9-1-1.8.8L14 23h-4l-.6-2.1-1.8-.8-1.9 1-2.8-2.8 1-1.9-.8-1.8L1 14v-4l2.1-.6.8-1.8-1-1.9 2.8-2.8 1.9 1 1.8-.8Z"/><circle cx="12" cy="12" r="3.2"/>',
  back: '<path d="M14 5 7 12l7 7"/><path d="M8 12h13"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.1-6 8-6s6.5 2 8 6"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9.2a4 4 0 0 1 0 5.6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M19 9l-5 6"/><path d="M14 9l5 6"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  close: '<path d="M6 6 18 18"/><path d="M18 6 6 18"/>',
  play: '<path d="M8 5v14l11-7Z"/>',
  screen: '<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M9 21h6"/><path d="M12 16v5"/>',
};

const GAME_ICON_PATHS = {

  // ── Rôle : Jouer (smartphone — bleu ciel)
  profile:
    '<rect x="21" y="7" width="22" height="40" rx="5" fill="#0c2d48"/>' +
    '<rect x="24" y="11" width="16" height="26" rx="3" fill="#0369a1"/>' +
    '<rect x="28" y="40.5" width="8" height="2.5" rx="1.2" fill="#075985"/>' +
    '<path d="M28 18v14l12-7Z" fill="#fff"/>' +
    '<circle cx="46" cy="13" r="7" fill="#0ea5e9"/>' +
    '<path d="M43 13l2.5 2.5 4.5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  // ── Rôle : Animateur (micro — indigo)
  host:
    '<rect x="25" y="7" width="14" height="24" rx="7" fill="#1e3a8a"/>' +
    '<rect x="28" y="10" width="8" height="18" rx="4" fill="#3b82f6"/>' +
    '<rect x="28" y="14" width="8" height="1.5" rx=".7" fill="#bfdbfe" opacity=".6"/>' +
    '<rect x="28" y="18" width="8" height="1.5" rx=".7" fill="#bfdbfe" opacity=".6"/>' +
    '<rect x="28" y="22" width="8" height="1.5" rx=".7" fill="#bfdbfe" opacity=".6"/>' +
    '<path d="M17 28c0 9.5 6.7 15.5 15 16.5v5h-5v3h10v-3h-5v-5C39.3 43.5 47 37.5 47 28" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M22 53h20" stroke="#1e3a8a" stroke-width="2.5" stroke-linecap="round"/>',

  // ── Rôle : Écran TV (moniteur — cyan)
  display:
    '<rect x="6" y="10" width="52" height="34" rx="5" fill="#083344"/>' +
    '<rect x="10" y="14" width="44" height="26" rx="3" fill="#0e7490"/>' +
    '<rect x="15" y="19" width="34" height="3" rx="1.5" fill="#a5f3fc"/>' +
    '<rect x="15" y="26" width="22" height="3" rx="1.5" fill="#a5f3fc" opacity=".5"/>' +
    '<rect x="15" y="33" width="14" height="3" rx="1.5" fill="#a5f3fc" opacity=".28"/>' +
    '<circle cx="45" cy="20.5" r="3.5" fill="#22d3ee"/>' +
    '<rect x="29" y="44" width="6" height="5" rx="1" fill="#083344"/>' +
    '<rect x="22" y="49" width="20" height="3.5" rx="1.7" fill="#083344"/>',

  // ── QCM : 4 cases — SKY BLUE
  category:
    '<rect x="7" y="9" width="22" height="20" rx="5" fill="#075985"/>' +
    '<rect x="35" y="9" width="22" height="20" rx="5" fill="#0ea5e9"/>' +
    '<rect x="7" y="35" width="22" height="20" rx="5" fill="#075985"/>' +
    '<rect x="35" y="35" width="22" height="20" rx="5" fill="#0284c7"/>' +
    '<path d="M40 20l4 4 8-8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="12" y="17" width="12" height="2.5" rx="1.2" fill="#7dd3fc" opacity=".8"/>' +
    '<rect x="12" y="43" width="12" height="2.5" rx="1.2" fill="#7dd3fc" opacity=".8"/>' +
    '<rect x="40" y="43" width="12" height="2.5" rx="1.2" fill="#7dd3fc" opacity=".8"/>',

  // ── Vrai / Faux : panneau bicolore (vert/rouge)
  correct:
    '<rect x="6" y="9" width="24" height="46" rx="6" fill="#059669"/>' +
    '<rect x="34" y="9" width="24" height="46" rx="6" fill="#dc2626"/>' +
    '<path d="M12 33l6 6 10-12" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M40 27l10 14M50 27 40 41" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',

  // ── Rapidité : éclair — ORANGE
  rapidite:
    '<path d="M37 6 15 36h13l-5 22 27-33H37l2-19Z" fill="#f97316"/>' +
    '<path d="M37 6 15 36h13l-5 22 27-33H37l2-19Z" fill="#fed7aa" opacity=".35"/>' +
    '<path d="M11 19H5M9 29H2M55 42h7" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round"/>',

  // ── Vote : bulles de dialogue — BLUE
  vote:
    '<rect x="5" y="5" width="38" height="27" rx="7" fill="#1e3a8a"/>' +
    '<path d="M5 26l-6 10 14-4" fill="#1e3a8a"/>' +
    '<rect x="11" y="12" width="12" height="2.5" rx="1.2" fill="#93c5fd"/>' +
    '<rect x="11" y="19" width="22" height="2.5" rx="1.2" fill="#93c5fd" opacity=".55"/>' +
    '<rect x="21" y="32" width="38" height="25" rx="7" fill="#3b82f6"/>' +
    '<path d="M59 50l6 9-14-4" fill="#3b82f6"/>' +
    '<rect x="27" y="39" width="22" height="2.5" rx="1.2" fill="#fff" opacity=".85"/>' +
    '<rect x="27" y="46" width="14" height="2.5" rx="1.2" fill="#fff" opacity=".45"/>',

  // ── Défi Memory : liste ordonnée — VIOLET
  burger:
    '<rect x="4" y="6" width="56" height="15" rx="5" fill="#3b0764"/>' +
    '<rect x="4" y="25" width="56" height="15" rx="5" fill="#6b21a8"/>' +
    '<rect x="4" y="44" width="56" height="15" rx="5" fill="#7e22ce"/>' +
    '<circle cx="15" cy="13.5" r="6.5" fill="#a855f7"/>' +
    '<circle cx="15" cy="32.5" r="6.5" fill="#9333ea"/>' +
    '<circle cx="15" cy="51.5" r="6.5" fill="#7c3aed"/>' +
    '<text x="15" y="17" text-anchor="middle" font-size="8" font-weight="900" fill="#fff" font-family="sans-serif">1</text>' +
    '<text x="15" y="36" text-anchor="middle" font-size="8" font-weight="900" fill="#fff" font-family="sans-serif">2</text>' +
    '<text x="15" y="55" text-anchor="middle" font-size="8" font-weight="900" fill="#fff" font-family="sans-serif">3</text>' +
    '<rect x="26" y="11" width="22" height="3" rx="1.5" fill="#e9d5ff"/>' +
    '<rect x="26" y="30" width="18" height="3" rx="1.5" fill="#e9d5ff" opacity=".65"/>' +
    '<rect x="26" y="49" width="14" height="3" rx="1.5" fill="#e9d5ff" opacity=".45"/>',

  // ── Challenge Vidéo : clap cinéma — ROSE/PINK
  karaoke:
    '<rect x="6" y="7" width="52" height="14" rx="4" fill="#500724"/>' +
    '<path d="M16 7l-5 14h7l5-14h-7zM29 7l-5 14h7l5-14h-7zM42 7l-5 14h7l5-14h-7z" fill="#ec4899"/>' +
    '<rect x="4" y="20" width="56" height="3" rx="1.5" fill="#3d0617"/>' +
    '<rect x="6" y="22" width="52" height="36" rx="5" fill="#be185d"/>' +
    '<rect x="10" y="26" width="44" height="28" rx="3" fill="#500724"/>' +
    '<rect x="14" y="31" width="30" height="2.5" rx="1.2" fill="#fbcfe8"/>' +
    '<rect x="14" y="38" width="22" height="2.5" rx="1.2" fill="#fbcfe8" opacity=".6"/>' +
    '<rect x="14" y="45" width="16" height="2.5" rx="1.2" fill="#fbcfe8" opacity=".35"/>',

  // ── Buzzer : bouton d'alarme — ORANGE
  buzzer:
    '<circle cx="32" cy="36" r="23" fill="#431407"/>' +
    '<circle cx="32" cy="36" r="18" fill="#c2410c"/>' +
    '<circle cx="32" cy="34" r="13" fill="#f97316"/>' +
    '<ellipse cx="32" cy="29" rx="7.5" ry="4" fill="#fed7aa" opacity=".45"/>' +
    '<path d="M32 8v5" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M15 17l3.5 3.5M49 17l-3.5 3.5" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M7 34h4M53 34h4" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>',

  // ── Scores : coupe — GOLD/AMBER
  scores:
    '<path d="M20 8h24v21c0 9-5.5 14-12 15-6.5-1-12-6-12-15V8Z" fill="#78350f"/>' +
    '<path d="M22 10h20v19c0 8-4.5 12-10 13-5.5-1-10-5-10-13V10Z" fill="#d97706"/>' +
    '<path d="M9 12h11v11c0 3-5 4-6 1.5L9 12Z" fill="#92400e"/>' +
    '<path d="M55 12H44v11c0 3 5 4 6 1.5L55 12Z" fill="#92400e"/>' +
    '<rect x="30" y="43" width="4" height="8" rx="2" fill="#78350f"/>' +
    '<rect x="22" y="51" width="20" height="5" rx="2.5" fill="#92400e"/>' +
    '<path d="M32 18l2 5 5.5.8-4 3.8.9 5.2-4.4-2.4-4.4 2.4.9-5.2-4-3.8 5.5-.8Z" fill="#fde68a"/>',

  // ── Bonus : étoile violet/indigo
  bonus:
    '<path d="M32 5 38.5 20l17 2.5-13 11 4 17L32 42l-14.5 8.5 4-17-13-11 17-2.5Z" fill="#7c3aed"/>' +
    '<path d="M32 5 38.5 20l17 2.5-13 11 4 17L32 42l-14.5 8.5 4-17-13-11 17-2.5Z" fill="#a5b4fc" opacity=".3"/>' +
    '<circle cx="32" cy="30" r="9" fill="#1e1b4b"/>' +
    '<path d="M28 30h8M32 26v8" stroke="#a5b4fc" stroke-width="2.5" stroke-linecap="round"/>',

  // ── Wrong : croix (rouge fonctionnel conservé)
  wrong:
    '<circle cx="32" cy="32" r="26" fill="#dc2626"/>' +
    '<circle cx="32" cy="32" r="22" fill="#ef4444"/>' +
    '<path d="M22 22 42 42M42 22 22 42" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',

  // ── Music : note violet/indigo
  music:
    '<path d="M24 15v29a7 7 0 1 1-4-6V13l26-5v28a7 7 0 1 1-4-6V18l-18 4Z" fill="#7c3aed"/>',

  // ── Manche : drapeau bleu sur mât blanc
  round:
    '<rect x="16" y="10" width="4" height="46" rx="2" fill="#e2e8f0"/>' +
    '<rect x="10" y="53" width="18" height="4" rx="2" fill="#f1f5f9"/>' +
    '<path d="M20 12c10-7 18 7 28 0v22c-10 7-18-7-28 0V12Z" fill="#7c3aed"/>',

  // ── Gamepad : manette indigo/violet
  gamepad:
    '<path d="M18 22h28c7 0 12 7 10 14l-3 10c-1 4-7 5-10 2l-5-5H26l-5 5c-3 3-9 2-10-2L8 36c-2-7 3-14 10-14Z" fill="#3730a3"/>' +
    '<path d="M21 34h10M26 29v10" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>' +
    '<circle cx="43" cy="32" r="3" fill="#a5b4fc"/>' +
    '<circle cx="49" cy="38" r="3" fill="#60a5fa"/>',
};

export const UiIcon = ({ name = 'settings', className = '', title = '' }) => html`
  <span className=${'inline-flex items-center justify-center leading-none align-[-0.16em] ' + className} title=${title} aria-hidden=${title ? undefined : 'true'}>
    <svg viewBox="0 0 24 24" className="block h-full w-full overflow-visible" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML=${{ __html: SYSTEM_ICON_PATHS[name] || SYSTEM_ICON_PATHS.settings }} />
  </span>
`;

export const GameIcon = ({ name = 'category', className = '', title = '' }) => html`
  <span className=${'game-icon-mono-wrap inline-flex items-center justify-center leading-none align-[-0.16em] text-sky-200 ' + className} title=${title} aria-hidden=${title ? undefined : 'true'}>
    <svg viewBox="0 0 64 64" className="game-icon-mono block h-full w-full overflow-visible" dangerouslySetInnerHTML=${{ __html: GAME_ICON_PATHS[name] || GAME_ICON_PATHS.category }} />
  </span>
`;

// ── Button ───────────────────────────────────────────────────
export const Btn = ({ variant = 'primary', size = 'md', pulse, wide, onClick, disabled, children, className = '', style, feedback = true }) => {
  const base = 'ui-btn inline-flex items-center justify-center gap-2 font-bold rounded-lg cursor-pointer select-none border shadow-sm';
  const sizes = {
    sm: 'px-4 py-2 text-sm min-h-[40px]',
    md: 'px-5 py-3 text-base min-h-[50px]',
    lg: 'px-7 py-4 text-lg min-h-[58px]',
  };
  const variants = {
    primary:   'ui-btn-primary border-white/10 text-white shadow-accent',
    success:   'ui-btn-success border-white/10 text-slate-950',
    danger:    'ui-btn-danger border-white/10 text-white',
    warning:   'ui-btn-warning border-white/10 text-slate-950 font-extrabold',
    secondary: 'ui-btn-secondary border-white/10 text-white/90',
    ghost:     'ui-btn-ghost border-white/10 text-white/72 hover:text-white',
    tv:        'ui-btn-tv border-white/10 text-slate-950',
    nav:       'ui-btn-nav border-white/10 text-white/90',
  };
  const cls = [
    base,
    sizes[size] || sizes.md,
    variants[variant] || variants.primary,
    wide ? 'w-full' : '',
    pulse ? 'ring-pulse is-next-action' : '',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
    className,
  ].filter(Boolean).join(' ');
  const handleClick = (event) => {
    if (disabled) return;
    if (feedback) playUiFeedback(variant);
    onClick?.(event);
  };

  return html`<button
    className=${cls}
    data-variant=${variant}
    style=${style}
    onClick=${handleClick}
    disabled=${disabled}
  >${children}</button>`;
};

// ── Card ────────────────────────────────────────────────────
export const Card = ({ children, className = '', style, glow }) => html`
  <div className=${'animate-soft-slide-up rounded-lg app-surface p-5 ' + (glow ? 'border-sky-400/40 shadow-accent ' : '') + className} style=${style}>
    ${children}
  </div>
`;

// ── Badge ───────────────────────────────────────────────────
export const Badge = ({ color = 'violet', children, className = '' }) => {
  const colors = {
    violet: 'bg-accent/15 text-violet-200 border-accent/30',
    green:  'bg-teal-500/15 text-teal-200 border-teal-500/30',
    orange: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    red:    'bg-rose-500/15 text-rose-400 border-rose-500/30',
    blue:   'bg-sky-500/15 text-sky-200 border-sky-500/30',
    gray:   'bg-white/8 text-white/50 border-white/10',
  };
  return html`<span className=${'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm ' + (colors[color] || colors.gray) + ' ' + className}>
    ${children}
  </span>`;
};


// ── Waiting dots ─────────────────────────────────────────────
export const Dots = () => html`
  <div className="dot-bounce mt-4 justify-center">
    <span></span><span></span><span></span>
  </div>
`;

// ── Alert ────────────────────────────────────────────────────
export const Alert = ({ type = 'info', message }) => {
  if (!message) return null;
  const styles = {
    info:    'bg-blue-500/15 border-blue-500/30 text-blue-300',
    error:   'bg-rose-500/15 border-rose-500/30 text-rose-300',
    success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  };
  return html`
    <div className=${'rounded-xl border px-4 py-3 text-sm font-medium ' + (styles[type] || styles.info)}>
      ${message}
    </div>
  `;
};

// ── Session banner ───────────────────────────────────────────
export const SessionBanner = ({ code, label, right }) => html`
  <div className="flex items-center justify-between px-4 py-2.5 bg-bg-alt/86 backdrop-blur-xl border-b border-white/8 text-sm sticky top-0 z-10">
    <span className="text-white/50">Session : <strong className="text-sky-300 font-mono tracking-widest">${code}</strong></span>
    ${label && html`<span className="text-white/70">${label}</span>`}
    ${right  && html`<span>${right}</span>`}
  </div>
`;

// ── Modal ────────────────────────────────────────────────────
export const Modal = ({ show, onClose, title, children, width = 'max-w-lg' }) => {
  if (!show) return null;
  return html`
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick=${(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className=${'w-full ' + width + ' app-surface rounded-lg shadow-2xl animate-soft-slide-up overflow-hidden'}>
        ${title && html`
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
            <h3 className="text-lg font-bold">${title}</h3>
            <button onClick=${onClose} className="text-white/40 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5">✕</button>
          </div>
        `}
        <div className="p-6">${children}</div>
      </div>
    </div>
  `;
};
