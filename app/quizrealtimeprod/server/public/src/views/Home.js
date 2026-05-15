import { html } from '../utils.js';
import { useGame } from '../contexts/GameContext.js';
import { GameIcon, UiIcon } from '../components/ui.js';

const ROLES = [
  { id: 'player',  iconType: 'game', iconName: 'profile', labelKey: 'role.player.label',  subKey: 'role.player.sub',  color: 'from-sky-500 to-violet-600',  glow: 'rgba(124,92,255,.35)',  accent: '#7c5cff' },
  { id: 'host',    iconType: 'game', iconName: 'host',    labelKey: 'role.host.label',    subKey: 'role.host.sub',    color: 'from-violet-500 to-purple-600', glow: 'rgba(139,92,246,.30)', accent: '#8b5cf6' },
  { id: 'display', iconType: 'game', iconName: 'display', labelKey: 'role.display.label', subKey: 'role.display.sub', color: 'from-indigo-400 to-blue-600',  glow: 'rgba(99,102,241,.30)',  accent: '#6366f1' },
  { id: 'admin',   iconType: 'ui',   iconName: 'settings',labelKey: 'role.admin.label',   subKey: 'role.admin.sub',   color: 'from-slate-400 to-slate-600',  glow: 'rgba(148,163,184,.20)', accent: '#94a3b8' },
];

const MODES = [
  { iconName: 'category', labelKey: 'qtype.qcm',            color: '#7c3aed' },
  { iconName: 'correct',  labelKey: 'qtype.true_false',      color: '#4f46e5' },
  { iconName: 'rapidite', labelKey: 'qtype.rapidite',        color: '#6d28d9' },
  { iconName: 'vote',     labelKey: 'qtype.vote',            color: '#3730a3' },
  { iconName: 'burger',   labelKey: 'qtype.burger',          color: '#5b21b6' },
  { iconName: 'karaoke',  labelKey: 'qtype.video_challenge', color: '#4338ca' },
];

const FEATURES = [
  { iconName: 'category', titleKey: 'feature.qcm.title',      descKey: 'feature.qcm.desc',      color: '#7c3aed' },
  { iconName: 'buzzer',   titleKey: 'feature.buzzer.title',   descKey: 'feature.buzzer.desc',   color: '#6d28d9' },
  { iconName: 'vote',     titleKey: 'feature.vote.title',     descKey: 'feature.vote.desc',     color: '#3730a3' },
  { iconName: 'burger',   titleKey: 'feature.burger.title',   descKey: 'feature.burger.desc',   color: '#5b21b6' },
  { iconName: 'karaoke',  titleKey: 'feature.video.title',    descKey: 'feature.video.desc',    color: '#4338ca' },
  { iconName: 'scores',   titleKey: 'feature.ceremony.title', descKey: 'feature.ceremony.desc', color: '#4f46e5' },
];

const roleIcon = (r) => (
  r.iconType === 'ui'
    ? html`<${UiIcon} name=${r.iconName} className="h-full w-full" />`
    : html`<${GameIcon} name=${r.iconName} className="h-full w-full" />`
);

export default function Home() {
  const { navigate, t } = useGame();

  const go = (id) => {
    if (id === 'display' || id === 'player') {
      window.open(window.location.origin + '/#' + id, '_blank', 'noopener');
    } else {
      navigate(id);
    }
  };

  return html`
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-start overflow-x-hidden px-4 py-10 sm:px-8 gap-10">

      <!-- Ambient blobs -->
      <div aria-hidden="true" style=${{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style=${{ position:'absolute', top:'-18vw', left:'-12vw', width:'60vw', height:'60vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(124,92,255,.15) 0%, transparent 70%)', filter:'blur(50px)' }} />
        <div style=${{ position:'absolute', bottom:'-12vw', right:'-10vw', width:'50vw', height:'50vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(67,56,202,.18) 0%, transparent 70%)', filter:'blur(50px)' }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl animate-fade-in flex flex-col gap-10">

        <!-- ── HERO ─────────────────────────────────────────── -->
        <div className="text-center flex flex-col items-center gap-4">

          <!-- Live badge -->
          <div className="inline-flex items-center gap-2 rounded-full app-chip px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-200">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-300 animate-pulse" style=${{ boxShadow:'0 0 8px #2dd4bf' }}></span>
            ${t('home.badge')}
          </div>

          <!-- Title -->
          <h1 className="font-display font-black leading-none gradient-text" style=${{ fontSize:'clamp(4rem,11vw,7rem)', margin:'0' }}>
            QuizzGeek
          </h1>

          <!-- Subtitle — une seule ligne, taille adaptée -->
          <p className="text-white/50 font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full" style=${{ fontSize:'clamp(.85rem,1.5vw,1.05rem)' }}>
            ${t('home.tagline')}
          </p>

          <!-- Modes pills — plus grands -->
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            ${MODES.map(m => html`
              <span key=${m.labelKey}
                className="inline-flex items-center gap-2 font-bold text-white"
                style=${{
                  background: 'linear-gradient(130deg, ' + m.color + ' 0%, #1e1b4b 100%)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontSize: '.88rem',
                  boxShadow: '0 3px 14px ' + m.color + '55',
                }}>
                <${GameIcon} name=${m.iconName} className="h-5 w-5" />
                ${t(m.labelKey)}
              </span>
            `)}
          </div>
        </div>

        <!-- ── RÔLES ────────────────────────────────────────── -->
        <section className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          ${ROLES.map(r => html`
            <button
              key=${r.id}
              onClick=${() => go(r.id)}
              className=${'group relative overflow-hidden rounded-2xl app-surface text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl active:scale-[.97]'}
              style=${{ boxShadow:'0 0 0 1px rgba(255,255,255,.08)', padding:'clamp(18px,3vw,28px)' }}
            >
              <!-- Top gradient bar -->
              <div className=${'absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r rounded-t-2xl ' + r.color}></div>
              <!-- Hover glow -->
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                   style=${{ background: 'radial-gradient(ellipse at 50% 0%, ' + r.glow + ', transparent 65%)' }}></div>

              <div className="relative z-10 flex flex-col gap-4 h-full">
                <!-- Icon -->
                <div className="flex items-start justify-between">
                  <span className="flex items-center justify-center rounded-xl app-panel transition-transform duration-300 group-hover:scale-110"
                        style=${{ width:'clamp(52px,8vw,68px)', height:'clamp(52px,8vw,68px)' }}>
                    ${roleIcon(r)}
                  </span>
                  <span className="text-white/25 group-hover:text-white/60 transition-colors text-lg mt-1">↗</span>
                </div>
                <!-- Label -->
                <div>
                  <div className="font-black text-white" style=${{ fontSize:'clamp(1rem,2vw,1.15rem)' }}>
                    ${t(r.labelKey)}
                  </div>
                  <div className="mt-1 text-white/45 leading-5" style=${{ fontSize:'clamp(.78rem,1.4vw,.88rem)' }}>
                    ${t(r.subKey)}
                  </div>
                </div>
                <!-- Bottom accent -->
                <div className="mt-auto">
                  <div className="h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                       style=${{ background: 'linear-gradient(to right, ' + r.accent + ', transparent)' }}></div>
                </div>
              </div>
            </button>
          `)}
        </section>

        <!-- ── SÉPARATEUR ──────────────────────────────────── -->
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/6"></div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/22">${t('home.whatCanDo')}</span>
          <div className="flex-1 h-px bg-white/6"></div>
        </div>

        <!-- ── FEATURES ────────────────────────────────────── -->
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${FEATURES.map(f => html`
            <div key=${f.titleKey}
                 className="rounded-xl app-panel flex items-start gap-4"
                 style=${{ padding:'clamp(16px,2.5vw,22px)' }}>
              <!-- Icon box -->
              <span className="flex-shrink-0 flex items-center justify-center rounded-xl"
                    style=${{
                      width: '48px', height: '48px',
                      background: f.color + '20',
                      border: '1px solid ' + f.color + '40',
                    }}>
                <${GameIcon} name=${f.iconName} className="h-8 w-8" />
              </span>
              <div className="min-w-0">
                <div className="font-black text-white" style=${{ fontSize:'1rem' }}>${t(f.titleKey)}</div>
                <div className="mt-1 leading-5 text-white/45" style=${{ fontSize:'.83rem' }}>${t(f.descKey)}</div>
              </div>
            </div>
          `)}
        </section>

        <!-- ── CTA ADMIN ───────────────────────────────────── -->
        <div className="text-center pb-4">
          <button
            onClick=${() => go('admin')}
            className="ui-btn ui-btn-secondary inline-flex items-center gap-2.5 rounded-xl font-bold text-white/75 transition-all hover:text-white app-surface"
            style=${{ fontSize:'.95rem', padding:'12px 24px', border:'1px solid rgba(255,255,255,.08)' }}
          >
            <${UiIcon} name="settings" className="h-5 w-5" />
            ${t('home.createQuiz')}
          </button>
        </div>

      </div>
    </div>
  `;
}
