// Shared UI components
import { html } from '../utils.js';

// ── Button ───────────────────────────────────────────────────
export const Btn = ({ variant = 'primary', size = 'md', pulse, wide, onClick, disabled, children, className = '', style }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-200 cursor-pointer select-none border';
  const sizes = {
    sm: 'px-4 py-2 text-sm min-h-[38px]',
    md: 'px-5 py-3 text-base min-h-[48px]',
    lg: 'px-7 py-4 text-lg min-h-[56px]',
  };
  const variants = {
    primary:   'bg-accent hover:bg-accent-dark border-transparent text-white shadow-accent',
    success:   'bg-emerald-600 hover:bg-emerald-500 border-transparent text-white',
    danger:    'bg-rose-600 hover:bg-rose-500 border-transparent text-white',
    warning:   'bg-amber-500 hover:bg-amber-400 border-transparent text-black font-extrabold',
    secondary: 'bg-bg-card hover:bg-bg-input border-white/10 text-white/90',
    ghost:     'bg-transparent hover:bg-white/5 border-white/10 text-white/70',
    tv:        'bg-gradient-to-r from-violet-700 to-blue-600 border-transparent text-white hover:brightness-110',
    nav:       'bg-bg-card hover:bg-accent/20 border-white/10 text-white/90 hover:border-accent/50',
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

  return html`<button
    className=${cls}
    style=${style}
    onClick=${onClick}
    disabled=${disabled}
  >${children}</button>`;
};

// ── Card ────────────────────────────────────────────────────
export const Card = ({ children, className = '', style, glow }) => html`
  <div className=${'rounded-2xl border bg-bg-card p-5 ' + (glow ? 'border-accent/40 shadow-accent ' : 'border-white/8 ') + className} style=${style}>
    ${children}
  </div>
`;

// ── Badge ───────────────────────────────────────────────────
export const Badge = ({ color = 'violet', children, className = '' }) => {
  const colors = {
    violet: 'bg-accent/15 text-accent border-accent/30',
    green:  'bg-emerald-500/15 text-neon-green border-emerald-500/30',
    orange: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    red:    'bg-rose-500/15 text-rose-400 border-rose-500/30',
    blue:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
    gray:   'bg-white/8 text-white/50 border-white/10',
  };
  return html`<span className=${'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ' + (colors[color] || colors.gray) + ' ' + className}>
    ${children}
  </span>`;
};

// ── Input ───────────────────────────────────────────────────
export const Input = ({ label, value, onInput, onChange, placeholder, type = 'text', className = '', ...rest }) => html`
  <div className=${'flex flex-col gap-1.5 ' + className}>
    ${label && html`<label className="text-sm font-semibold text-white/70">${label}</label>`}
    <input
      type=${type}
      value=${value}
      onInput=${onInput}
      onChange=${onChange}
      placeholder=${placeholder}
      className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:border-accent/60 focus:bg-bg-input outline-none transition-colors min-h-[42px]"
      ...${rest}
    />
  </div>
`;

// ── Textarea ─────────────────────────────────────────────────
export const Textarea = ({ label, value, onInput, onChange, placeholder, rows = 3, className = '' }) => html`
  <div className=${'flex flex-col gap-1.5 ' + className}>
    ${label && html`<label className="text-sm font-semibold text-white/70">${label}</label>`}
    <textarea
      value=${value}
      onInput=${onInput}
      onChange=${onChange}
      placeholder=${placeholder}
      rows=${rows}
      className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:border-accent/60 outline-none transition-colors resize-y"
    />
  </div>
`;

// ── Select ───────────────────────────────────────────────────
export const Select = ({ label, value, onChange, options = [], className = '' }) => html`
  <div className=${'flex flex-col gap-1.5 ' + className}>
    ${label && html`<label className="text-sm font-semibold text-white/70">${label}</label>`}
    <select
      value=${value}
      onChange=${onChange}
      className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-accent/60 outline-none transition-colors min-h-[42px] cursor-pointer"
    >
      ${options.map(opt => html`<option key=${opt.value} value=${opt.value}>${opt.label}</option>`)}
    </select>
  </div>
`;

// ── Section header ───────────────────────────────────────────
export const SectionHeader = ({ icon, title, subtitle, action }) => html`
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-lg font-bold flex items-center gap-2">
        ${icon && html`<span>${icon}</span>`}
        ${title}
      </h2>
      ${subtitle && html`<p className="text-sm text-white/45 mt-0.5">${subtitle}</p>`}
    </div>
    ${action && html`<div>${action}</div>`}
  </div>
`;

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
  <div className="flex items-center justify-between px-4 py-2.5 bg-bg-alt border-b border-white/5 text-sm sticky top-0 z-10">
    <span className="text-white/50">Session : <strong className="text-accent font-mono tracking-widest">${code}</strong></span>
    ${label && html`<span className="text-white/70">${label}</span>`}
    ${right  && html`<span>${right}</span>`}
  </div>
`;

// ── Progress bar ─────────────────────────────────────────────
export const ProgressBar = ({ value = 0, max = 100, color = 'accent' }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = { accent: 'bg-accent', green: 'bg-neon-green', orange: 'bg-neon-orange', red: 'bg-neon-red' };
  return html`
    <div className="w-full bg-white/10 rounded-full overflow-hidden" style=${{ height: '8px' }}>
      <div
        className=${'h-full rounded-full transition-all duration-300 ' + (colors[color] || 'bg-accent')}
        style=${{ width: pct + '%' }}
      />
    </div>
  `;
};

// ── Avatar display ───────────────────────────────────────────
export const Avatar = ({ src, size = 'md' }) => {
  const sizes = { sm: 'text-xl w-8 h-8', md: 'text-2xl w-10 h-10', lg: 'text-3xl w-14 h-14', xl: 'text-5xl w-20 h-20' };
  const s = sizes[size] || sizes.md;
  if (src && src.startsWith('data:')) {
    return html`<img src=${src} className=${'rounded-full object-cover ' + s} alt="avatar" />`;
  }
  return html`<span className=${'flex items-center justify-center rounded-full bg-white/5 ' + s}>${src || '🎮'}</span>`;
};

// ── Score chip ───────────────────────────────────────────────
export const ScoreChip = ({ score, delta }) => html`
  <span className="font-mono font-bold text-neon-green">
    ${score ?? 0}
    ${delta != null && html`<span className=${delta >= 0 ? 'text-emerald-400 text-sm' : 'text-rose-400 text-sm'}> ${delta >= 0 ? '+' : ''}${delta}</span>`}
  </span>
`;

// ── Modal ────────────────────────────────────────────────────
export const Modal = ({ show, onClose, title, children, width = 'max-w-lg' }) => {
  if (!show) return null;
  return html`
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick=${(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className=${'w-full ' + width + ' bg-bg-card border border-white/10 rounded-2xl shadow-2xl animate-fade-in overflow-hidden'}>
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
