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

  // ── Rôle : Jouer (smartphone + badge)
  profile:
    '<rect x="21" y="7" width="22" height="40" rx="5" fill="#0c2a4a"/>' +
    '<rect x="24" y="11" width="16" height="26" rx="3" fill="#4facfe"/>' +
    '<rect x="28" y="40.5" width="8" height="2.5" rx="1.2" fill="#2a5f8a"/>' +
    '<path d="M28 18v14l12-7Z" fill="#fff"/>' +
    '<circle cx="46" cy="13" r="7" fill="#7c5cff"/>' +
    '<path d="M43 13l2.5 2.5 4.5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',

  // ── Rôle : Animateur (micro)
  host:
    '<rect x="25" y="7" width="14" height="24" rx="7" fill="#6b21a8"/>' +
    '<rect x="28" y="10" width="8" height="18" rx="4" fill="#e879f9"/>' +
    '<rect x="28" y="14" width="8" height="1.5" rx=".7" fill="#c026d3" opacity=".6"/>' +
    '<rect x="28" y="18" width="8" height="1.5" rx=".7" fill="#c026d3" opacity=".6"/>' +
    '<rect x="28" y="22" width="8" height="1.5" rx=".7" fill="#c026d3" opacity=".6"/>' +
    '<path d="M17 28c0 9.5 6.7 15.5 15 16.5v5h-5v3h10v-3h-5v-5C39.3 43.5 47 37.5 47 28" fill="none" stroke="#e879f9" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M22 53h20" stroke="#a21caf" stroke-width="2.5" stroke-linecap="round"/>',

  // ── Rôle : Écran TV (moniteur)
  display:
    '<rect x="6" y="10" width="52" height="34" rx="5" fill="#0a1f3d"/>' +
    '<rect x="10" y="14" width="44" height="26" rx="3" fill="#1e3a5f"/>' +
    '<rect x="15" y="19" width="34" height="3" rx="1.5" fill="#4facfe"/>' +
    '<rect x="15" y="26" width="22" height="3" rx="1.5" fill="#4facfe" opacity=".5"/>' +
    '<rect x="15" y="33" width="14" height="3" rx="1.5" fill="#4facfe" opacity=".25"/>' +
    '<circle cx="45" cy="20.5" r="3.5" fill="#38ef7d"/>' +
    '<rect x="29" y="44" width="6" height="5" rx="1" fill="#1e3a5f"/>' +
    '<rect x="22" y="49" width="20" height="3.5" rx="1.7" fill="#0a1f3d"/>',

  // ── QCM : 4 cases avec une sélectionnée
  category:
    '<rect x="7" y="9" width="22" height="20" rx="5" fill="#2e1065"/>' +
    '<rect x="35" y="9" width="22" height="20" rx="5" fill="#7c5cff"/>' +
    '<rect x="7" y="35" width="22" height="20" rx="5" fill="#2e1065"/>' +
    '<rect x="35" y="35" width="22" height="20" rx="5" fill="#2e1065"/>' +
    '<path d="M40 20l4 4 8-8" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="12" y="17" width="12" height="2.5" rx="1.2" fill="#4c1d95"/>' +
    '<rect x="12" y="43" width="12" height="2.5" rx="1.2" fill="#4c1d95"/>' +
    '<rect x="40" y="43" width="12" height="2.5" rx="1.2" fill="#4c1d95"/>',

  // ── Vrai / Faux : panneau bicolore
  correct:
    '<rect x="6" y="9" width="24" height="46" rx="6" fill="#052e16"/>' +
    '<rect x="34" y="9" width="24" height="46" rx="6" fill="#450a0a"/>' +
    '<path d="M12 33l6 6 10-12" stroke="#38ef7d" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M40 27l10 14M50 27 40 41" stroke="#ff6b7a" stroke-width="2.5" stroke-linecap="round"/>',

  // ── Rapidité : éclair
  rapidite:
    '<path d="M37 6 15 36h13l-5 22 27-33H37l2-19Z" fill="#fbbf24"/>' +
    '<path d="M37 6 15 36h13l-5 22 27-33H37l2-19Z" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M11 19H5M9 29H2M55 42h7" stroke="rgba(255,255,255,.45)" stroke-width="2" stroke-linecap="round"/>',

  // ── Vote / Use Your Words : bulles de dialogue
  vote:
    '<rect x="5" y="5" width="38" height="27" rx="7" fill="#1e3a5f"/>' +
    '<path d="M5 26l-6 10 14-4" fill="#1e3a5f"/>' +
    '<rect x="11" y="12" width="12" height="2.5" rx="1.2" fill="#38bdf8"/>' +
    '<rect x="11" y="19" width="22" height="2.5" rx="1.2" fill="#38bdf8" opacity=".55"/>' +
    '<rect x="21" y="32" width="38" height="25" rx="7" fill="#1a0533"/>' +
    '<path d="M59 50l6 9-14-4" fill="#1a0533"/>' +
    '<rect x="27" y="39" width="22" height="2.5" rx="1.2" fill="#a78bfa"/>' +
    '<rect x="27" y="46" width="14" height="2.5" rx="1.2" fill="#a78bfa" opacity=".55"/>',

  // ── Burger / Liste ordonnée : classement de réponses
  burger:
    '<rect x="4" y="6" width="56" height="15" rx="5" fill="#1a0c00"/>' +
    '<rect x="4" y="25" width="56" height="15" rx="5" fill="#1a0c00"/>' +
    '<rect x="4" y="44" width="56" height="15" rx="5" fill="#1a0c00"/>' +
    '<circle cx="15" cy="13.5" r="6.5" fill="#fb923c"/>' +
    '<circle cx="15" cy="32.5" r="6.5" fill="#c2410c"/>' +
    '<circle cx="15" cy="51.5" r="6.5" fill="#7c2d12"/>' +
    '<text x="15" y="17" text-anchor="middle" font-size="8" font-weight="900" fill="#fff" font-family="sans-serif">1</text>' +
    '<text x="15" y="36" text-anchor="middle" font-size="8" font-weight="900" fill="#fff" font-family="sans-serif">2</text>' +
    '<text x="15" y="55" text-anchor="middle" font-size="8" font-weight="900" fill="#fff" font-family="sans-serif">3</text>' +
    '<rect x="26" y="11" width="22" height="3" rx="1.5" fill="#fb923c" opacity=".7"/>' +
    '<rect x="26" y="30" width="18" height="3" rx="1.5" fill="#fb923c" opacity=".45"/>' +
    '<rect x="26" y="49" width="14" height="3" rx="1.5" fill="#fb923c" opacity=".3"/>' +
    '<rect x="51" y="11" width="4" height="1.5" rx=".7" fill="#fb923c" opacity=".35"/>' +
    '<rect x="51" y="13.5" width="4" height="1.5" rx=".7" fill="#fb923c" opacity=".35"/>' +
    '<rect x="51" y="30" width="4" height="1.5" rx=".7" fill="#fb923c" opacity=".2"/>' +
    '<rect x="51" y="32.5" width="4" height="1.5" rx=".7" fill="#fb923c" opacity=".2"/>',

  // ── Challenge Vidéo : clap + caméra
  karaoke:
    '<rect x="7" y="22" width="42" height="32" rx="6" fill="#1c0a1a"/>' +
    '<rect x="10" y="26" width="36" height="24" rx="4" fill="#f5576c"/>' +
    '<circle cx="29" cy="38" r="8" fill="#1c0a1a"/>' +
    '<circle cx="29" cy="38" r="5" fill="#2a0a2a"/>' +
    '<circle cx="29" cy="38" r="2.5" fill="#f5576c"/>' +
    '<circle cx="31" cy="36" r="1.2" fill="#fff" opacity=".4"/>' +
    '<circle cx="44" cy="30" r="2.5" fill="#ff2d55"/>' +
    '<path d="M49 30l12-6v22l-12-6V30Z" fill="#9d174d"/>' +
    '<rect x="7" y="13" width="42" height="9" rx="4" fill="#2d0a2a"/>' +
    '<path d="M15 13l4 9M25 13l4 9M35 13l4 9" stroke="#f5576c" stroke-width="2" stroke-linecap="round"/>',

  // ── Buzzer (Feature) : bouton d'alarme
  buzzer:
    '<circle cx="32" cy="36" r="23" fill="#1a0808"/>' +
    '<circle cx="32" cy="36" r="18" fill="#7f1d1d"/>' +
    '<circle cx="32" cy="34" r="13" fill="#ef4444"/>' +
    '<ellipse cx="32" cy="29" rx="7.5" ry="4" fill="#fca5a5" opacity=".6"/>' +
    '<path d="M32 8v5" stroke="#fcd34d" stroke-width="2.5" stroke-linecap="round"/>' +
    '<path d="M15 17l3.5 3.5M49 17l-3.5 3.5" stroke="#fcd34d" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M7 34h4M53 34h4" stroke="#fcd34d" stroke-width="2" stroke-linecap="round"/>',

  // ── Cérémonie finale : coupe
  scores:
    '<path d="M20 8h24v21c0 9-5.5 14-12 15-6.5-1-12-6-12-15V8Z" fill="#78350f"/>' +
    '<path d="M22 10h20v19c0 8-4.5 12-10 13-5.5-1-10-5-10-13V10Z" fill="#fbbf24"/>' +
    '<path d="M9 12h11v11c0 3-5 4-6 1.5L9 12Z" fill="#92400e"/>' +
    '<path d="M55 12H44v11c0 3 5 4 6 1.5L55 12Z" fill="#92400e"/>' +
    '<rect x="30" y="43" width="4" height="8" rx="2" fill="#78350f"/>' +
    '<rect x="22" y="51" width="20" height="5" rx="2.5" fill="#92400e"/>' +
    '<path d="M32 18l2 5 5.5.8-4 3.8.9 5.2-4.4-2.4-4.4 2.4.9-5.2-4-3.8 5.5-.8Z" fill="#fff8e1"/>',

  // ── Bonus
  bonus:
    '<path d="M32 5 38.5 20l17 2.5-13 11 4 17L32 42l-14.5 8.5 4-17-13-11 17-2.5Z" fill="#ffd166"/>' +
    '<circle cx="32" cy="30" r="9" fill="#241027"/>' +
    '<path d="M28 30h8M32 26v8" stroke="#ffd166" stroke-width="2.5" stroke-linecap="round"/>',

  // ── Wrong
  wrong:
    '<circle cx="32" cy="32" r="26" fill="#4a1018"/>' +
    '<path d="M22 22 42 42M42 22 22 42" stroke="#ff6b7a" stroke-width="5" stroke-linecap="round"/>',

  // ── Music
  music:
    '<path d="M24 15v29a7 7 0 1 1-4-6V13l26-5v28a7 7 0 1 1-4-6V18l-18 4Z" fill="#38ef7d"/>',

  // ── Manche (drapeau)
  round:
    '<rect x="16" y="10" width="4" height="46" rx="2" fill="#d7e2ff"/>' +
    '<rect x="10" y="53" width="18" height="4" rx="2" fill="#f8fafc"/>' +
    '<path d="M20 12c10-7 18 7 28 0v22c-10 7-18-7-28 0V12Z" fill="#4facfe"/>',

  // ── Gamepad
  gamepad:
    '<path d="M18 22h28c7 0 12 7 10 14l-3 10c-1 4-7 5-10 2l-5-5H26l-5 5c-3 3-9 2-10-2L8 36c-2-7 3-14 10-14Z" fill="#f5576c"/>' +
    '<path d="M21 34h10M26 29v10" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' +
    '<circle cx="43" cy="32" r="3" fill="#fff"/>' +
    '<circle cx="49" cy="38" r="3" fill="#fff"/>',
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
