import { html } from '../utils.js';
import { useGame } from '../contexts/GameContext.js';
import { GameIcon, UiIcon } from '../components/ui.js';

const ROLES = [
  { id: 'player',  iconType: 'game', iconName: 'profile', labelKey: 'role.player.label',  subKey: 'role.player.sub',  color: 'from-sky-400 to-cyan-500',   glow: 'rgba(14,165,233,.35)',  accent: '#0ea5e9' },
  { id: 'host',    iconType: 'game', iconName: 'host',    labelKey: 'role.host.label',    subKey: 'role.host.sub',    color: 'from-blue-400 to-indigo-500', glow: 'rgba(59,130,246,.30)', accent: '#3b82f6' },
  { id: 'display', iconType: 'game', iconName: 'display', labelKey: 'role.display.label', subKey: 'role.display.sub', color: 'from-cyan-400 to-sky-600',   glow: 'rgba(56,189,248,.28)',  accent: '#38bdf8' },
  { id: 'admin',   iconType: 'ui',   iconName: 'settings',labelKey: 'role.admin.label',   subKey: 'role.admin.sub',   color: 'from-slate-400 to-slate-600',glow: 'rgba(148,163,184,.20)', accent: '#94a3b8' },
];

const Q_COLORS = {
  qcm:            { color: '#0ea5e9', glow: 'rgba(14,165,233,.22)'  },
  true_false:     { color: '#10b981', glow: 'rgba(16,185,129,.22)'  },
  rapidite:       { color: '#f97316', glow: 'rgba(249,115,22,.22)'  },
  vote:           { color: '#3b82f6', glow: 'rgba(59,130,246,.22)'  },
  burger:         { color: '#a855f7', glow: 'rgba(168,85,247,.22)'  },
  video_challenge:{ color: '#ec4899', glow: 'rgba(236,72,153,.22)'  },
  ceremony:       { color: '#f59e0b', glow: 'rgba(245,158,11,.22)'  },
};

const MODES = [
  { iconName: 'category', labelKey: 'qtype.qcm',            ...Q_COLORS.qcm            },
  { iconName: 'correct',  labelKey: 'qtype.true_false',      ...Q_COLORS.true_false     },
  { iconName: 'rapidite', labelKey: 'qtype.rapidite',        ...Q_COLORS.rapidite       },
  { iconName: 'vote',     labelKey: 'qtype.vote',            ...Q_COLORS.vote           },
  { iconName: 'burger',   labelKey: 'qtype.burger',          ...Q_COLORS.burger         },
  { iconName: 'karaoke',  labelKey: 'qtype.video_challenge', ...Q_COLORS.video_challenge},
];

const FEATURES = [
  { iconName: 'category', titleKey: 'feature.qcm.title',      descKey: 'feature.qcm.desc',      ...Q_COLORS.qcm            },
  { iconName: 'buzzer',   titleKey: 'feature.buzzer.title',   descKey: 'feature.buzzer.desc',   ...Q_COLORS.rapidite       },
  { iconName: 'vote',     titleKey: 'feature.vote.title',     descKey: 'feature.vote.desc',     ...Q_COLORS.vote           },
  { iconName: 'burger',   titleKey: 'feature.burger.title',   descKey: 'feature.burger.desc',   ...Q_COLORS.burger         },
  { iconName: 'karaoke',  titleKey: 'feature.video.title',    descKey: 'feature.video.desc',    ...Q_COLORS.video_challenge},
  { iconName: 'scores',   titleKey: 'feature.ceremony.title', descKey: 'feature.ceremony.desc', ...Q_COLORS.ceremony       },
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
    <div className="relative flex flex-col overflow-x-hidden px-5 sm:px-10"
         style=${{ minHeight:'100dvh' }}>

      <div aria-hidden="true" style=${{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style=${{ position:'absolute', top:'-15vw', right:'-10vw', width:'55vw', height:'55vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(14,165,233,.12) 0%, transparent 70%)', filter:'blur(60px)' }} />
        <div style=${{ position:'absolute', bottom:'-10vw', left:'-8vw', width:'45vw', height:'45vw', borderRadius:'50%', background:'radial-gradient(circle, rgba(56,189,248,.08) 0%, transparent 70%)', filter:'blur(50px)' }} />
      </div>

      <!-- Conteneur principal : occupe toute la hauteur, répartit les sections -->
      <div className="relative z-10 w-full max-w-5xl mx-auto animate-fade-in flex flex-col justify-between"
           style=${{ flex:'1', paddingTop:'clamp(20px,4vh,40px)', paddingBottom:'clamp(20px,4vh,40px)' }}>

        <!-- ── HERO ── -->
        <div className="text-center flex flex-col items-center" style=${{ gap:'clamp(8px,1.5vh,14px)' }}>
          <div className="inline-flex items-center gap-2 rounded-full app-chip px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" style=${{ boxShadow:'0 0 8px #38bdf8' }}></span>
            ${t('home.badge')}
          </div>

          <h1 className="font-display font-black leading-none gradient-text"
              style=${{ fontSize:'clamp(3rem,8.5vw,6rem)', margin:'0' }}>
            QuizzGeek
          </h1>

          <p className="font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full"
             style=${{ fontSize:'clamp(.82rem,1.4vw,1rem)', color:'rgba(125,211,252,.65)' }}>
            ${t('home.tagline')}
          </p>

          <div className="flex flex-wrap justify-center" style=${{ gap:'clamp(6px,1vw,10px)' }}>
            ${MODES.map(m => html`
              <span key=${m.labelKey}
                    className="inline-flex items-center gap-2 font-bold text-white"
                    style=${{
                      background: 'linear-gradient(130deg, ' + m.color + '28 0%, ' + m.color + '0d 100%)',
                      borderRadius: '9px',
                      padding: 'clamp(5px,1vh,8px) clamp(10px,1.5vw,16px)',
                      fontSize: 'clamp(.75rem,1.2vw,.88rem)',
                      border: '1px solid ' + m.color + '50',
                      boxShadow: '0 2px 14px ' + m.glow,
                    }}>
                <${GameIcon} name=${m.iconName} className="h-4 w-4" />
                ${t(m.labelKey)}
              </span>
            `)}
          </div>
        </div>

        <!-- ── RÔLES ── -->
        <section className="grid grid-cols-2 lg:grid-cols-4" style=${{ gap:'clamp(10px,1.8vw,20px)' }}>
          ${ROLES.map(r => html`
            <button
              key=${r.id}
              onClick=${() => go(r.id)}
              className=${'group relative overflow-hidden rounded-2xl app-surface text-left transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl active:scale-[.97]'}
              style=${{ padding:'clamp(16px,2.5vw,28px)' }}
            >
              <div className=${'absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r rounded-t-2xl ' + r.color}></div>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                   style=${{ background:'radial-gradient(ellipse at 50% 0%, ' + r.glow + ', transparent 65%)' }}></div>
              <div className="relative z-10 flex flex-col h-full" style=${{ gap:'clamp(10px,1.8vh,18px)' }}>
                <div className="flex items-start justify-between">
                  <span className="flex items-center justify-center rounded-xl app-panel transition-transform duration-300 group-hover:scale-110"
                        style=${{ width:'clamp(48px,7vw,68px)', height:'clamp(48px,7vw,68px)' }}>
                    ${roleIcon(r)}
                  </span>
                  <span className="group-hover:opacity-80 transition-opacity text-base mt-1"
                        style=${{ color:r.accent, opacity:'.30' }}>↗</span>
                </div>
                <div>
                  <div className="font-black text-white" style=${{ fontSize:'clamp(.9rem,1.7vw,1.1rem)' }}>
                    ${t(r.labelKey)}
                  </div>
                  <div className="mt-1 leading-snug" style=${{ fontSize:'clamp(.72rem,1.2vw,.83rem)', color:'rgba(125,211,252,.50)' }}>
                    ${t(r.subKey)}
                  </div>
                </div>
                <div className="mt-auto pt-1">
                  <div className="h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                       style=${{ background:'linear-gradient(to right, ' + r.accent + ', transparent)' }}></div>
                </div>
              </div>
            </button>
          `)}
        </section>

        <!-- ── SÉPARATEUR ── -->
        <div className="flex items-center" style=${{ gap:'clamp(10px,2vw,20px)' }}>
          <div className="flex-1 h-px" style=${{ background:'rgba(56,189,248,.12)' }}></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em]"
                style=${{ color:'rgba(56,189,248,.30)' }}>${t('home.whatCanDo')}</span>
          <div className="flex-1 h-px" style=${{ background:'rgba(56,189,248,.12)' }}></div>
        </div>

        <!-- ── FEATURES ── -->
        <section className="grid grid-cols-2 sm:grid-cols-3" style=${{ gap:'clamp(8px,1.5vw,16px)' }}>
          ${FEATURES.map(f => html`
            <div key=${f.titleKey}
                 className="rounded-xl flex items-center"
                 style=${{
                   gap: 'clamp(10px,1.5vw,16px)',
                   padding: 'clamp(12px,2vh,20px) clamp(14px,2vw,22px)',
                   background: 'linear-gradient(135deg, ' + f.color + '14 0%, rgba(5,14,28,.55) 100%)',
                   border: '1px solid ' + f.color + '28',
                   borderLeft: '3px solid ' + f.color,
                   boxShadow: '0 4px 24px ' + f.glow,
                 }}>
              <span className="flex-shrink-0 flex items-center justify-center rounded-xl"
                    style=${{
                      width: 'clamp(40px,5.5vw,52px)', height: 'clamp(40px,5.5vw,52px)',
                      background: f.color + '1a',
                      border: '1px solid ' + f.color + '40',
                    }}>
                <${GameIcon} name=${f.iconName} className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="font-black text-white leading-tight"
                     style=${{ fontSize:'clamp(.8rem,1.3vw,.95rem)' }}>
                  ${t(f.titleKey)}
                </div>
                <div className="mt-1 leading-snug"
                     style=${{ fontSize:'clamp(.68rem,1.1vw,.78rem)', color:'rgba(125,211,252,.45)' }}>
                  ${t(f.descKey)}
                </div>
              </div>
            </div>
          `)}
        </section>

        <!-- ── CTA ── -->
        <div className="text-center">
          <button
            onClick=${() => go('admin')}
            className="inline-flex items-center gap-3 font-black text-white rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-[.97]"
            style=${{
              fontSize: 'clamp(1rem,1.7vw,1.15rem)',
              padding: 'clamp(13px,2vh,18px) clamp(32px,5vw,56px)',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 55%, #0369a1 100%)',
              boxShadow: '0 8px 36px rgba(14,165,233,.45), inset 0 1px 0 rgba(255,255,255,.20)',
              border: '1px solid rgba(56,189,248,.30)',
            }}
          >
            <${UiIcon} name="settings" className="h-5 w-5" />
            ${t('home.createQuiz')}
            <span style=${{ fontSize:'.9rem', opacity:'.70' }}>→</span>
          </button>
        </div>

      </div>
    </div>
  `;
}
