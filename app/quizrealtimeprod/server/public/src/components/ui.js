// Shared UI components
import { html } from '../utils.js';

let uiAudioCtx = null;
let lastUiSoundAt = 0;

function playUiFeedback(variant = 'primary') {
  try {
    navigator.vibrate?.(variant === 'danger' ? [18, 24, 18] : 14);
  } catch {}

  try {
    const now = performance.now();
    if (now - lastUiSoundAt < 70) return;
    lastUiSoundAt = now;

    uiAudioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const ctx = uiAudioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const base = {
      primary: 640,
      success: 760,
      danger: 180,
      warning: 420,
      secondary: 520,
      ghost: 460,
      tv: 690,
      nav: 500,
    }[variant] || 520;

    osc.type = variant === 'danger' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(base * 1.18, ctx.currentTime + 0.045);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch {}
}

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
    pulse ? 'ring-pulse' : '',
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
