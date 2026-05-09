import { useState, useEffect, useRef } from 'react';
import { html, resolveMedia, mediaKind, ROUND_TYPES } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, Dots } from '../../components/ui.js';

// ── Display Connect Screen ────────────────────────────────────
function DisplayConnect() {
  const { socket, setDisplaySession, navigate, musicMuted, toggleMute } = useGame();
  const [code, setCode] = useState('');
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const match = hash.match(/[?&]code=([^&]+)/i);
    if (!match || !socket) return;
    const autoCode = decodeURIComponent(match[1]).toUpperCase();
    setCode(autoCode);
    socket.emit('join:display', { sessionCode: autoCode }, (res) => {
      if (res?.ok) setDisplaySession({ sessionCode: autoCode, connected: true });
      else setAlert({ type: 'error', message: res?.error || 'Connexion automatique echouee.' });
    });
  }, [socket]); // eslint-disable-line

  const connect = () => {
    const sessionCode = code.trim().toUpperCase();
    if (!sessionCode) { setAlert({ type: 'error', message: 'Code requis.' }); return; }
    socket.emit('join:display', { sessionCode }, (res) => {
      if (!res?.ok) { setAlert({ type: 'error', message: res?.error || 'Erreur.' }); return; }
      setDisplaySession({ sessionCode, connected: true });
    });
  };

  return html`
    <div className="flex min-h-[100dvh] items-center justify-center px-6 py-8">
      <button onClick=${() => navigate('home')} className="absolute left-6 top-6 rounded-lg app-chip px-3 py-2 text-sm font-bold text-white/58 transition-colors hover:text-white">← Accueil</button>
      <div className="w-full max-w-lg rounded-lg app-surface p-6 text-center animate-fade-in sm:p-8" style=${{ position: 'relative' }}>
        <button
          onClick=${toggleMute}
          title=${musicMuted ? 'Activer la musique' : 'Couper la musique'}
          style=${{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '1.2rem', lineHeight: '1', color: 'white' }}
        >${musicMuted ? '🔇' : '🔊'}</button>
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-lg app-panel text-5xl">📺</div>
        <h1 className="font-display text-5xl font-black gradient-text">Ecran TV</h1>
        <p className="mt-3 text-sm leading-6 text-white/48">Connectez cet ecran a une session pour diffuser le quiz en grand format.</p>
        ${alert && html`<div className="mt-5"><${Alert} type=${alert.type} message=${alert.message} /></div>`}
        <div className="mt-6 flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-white/42">Code de session</label>
          <div className="flex gap-3">
            <input
              type="text"
              value=${code}
              onInput=${e => setCode(e.target.value.toUpperCase())}
              placeholder="1234"
              maxLength="6"
              className="min-h-[58px] flex-1 rounded-lg border border-white/10 bg-bg-input/90 px-5 py-4 text-center font-mono text-2xl font-black tracking-[0.3em] text-white outline-none transition-colors placeholder-white/20 focus:border-sky-400/70"
              onKeyDown=${e => e.key === 'Enter' && connect()}
            />
            <${Btn} variant="primary" onClick=${connect} size="lg">→<//>
          </div>
        </div>
      </div>
    </div>
  `;
}
// Answer grid for QCM ───────────────────────────────────────
const LABELS  = ['A','B','C','D','E','F'];
const COLORS  = ['#7c5cff','#2dd4bf','#38bdf8','#f59e0b','#fb7185','#a78bfa'];
const BGCOLORS= ['rgba(124,92,255,.15)','rgba(45,212,191,.15)','rgba(56,189,248,.15)','rgba(245,158,11,.15)','rgba(251,113,133,.15)','rgba(167,139,250,.15)'];

function MediaStage({ url, maxHeight = '35vh', autoPlay = true }) {
  if (!url) return null;
  const src = resolveMedia(url);
  const kind = mediaKind(src);
  if (kind === 'video') return html`
    <video
      key=${src}
      src=${src}
      className="max-w-full rounded-lg object-contain border border-white/10 shadow-2xl"
      style=${{ maxHeight }}
      controls
      autoPlay=${autoPlay}
      playsInline
    />
  `;
  if (kind === 'audio') return html`
    <audio key=${src} src=${src} controls autoPlay=${autoPlay} className="w-full max-w-2xl" />
  `;
  return html`
    <img src=${src} className="max-w-full rounded-lg object-contain border border-white/10 shadow-2xl" style=${{ maxHeight }} alt="media" />
  `;
}

function ControlledVideo({ url, control, maxHeight = '46vh' }) {
  const ref = useRef(null);
  const lastControlAt = useRef(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !control?.action || control.at === lastControlAt.current) return;
    lastControlAt.current = control.at;
    if (control.action === 'play') video.play().catch(() => {});
    if (control.action === 'pause') video.pause();
    if (control.action === 'rewind') {
      video.currentTime = 0;
      video.pause();
    }
  }, [control?.action, control?.at]);

  if (!url) return null;
  return html`
    <video
      key=${resolveMedia(url)}
      ref=${ref}
      src=${resolveMedia(url)}
      className="max-w-full rounded-lg object-contain border border-white/10 shadow-2xl"
      style=${{ maxHeight }}
      controls
      playsInline
    />
  `;
}

function AnswerGrid({ options, revealed, correctIdx }) {
  if (!options?.length) return null;
  const isTrueFalse = options.length === 2 && ['vrai','faux','true','false'].includes(options[0]?.text?.toLowerCase());

  return html`
    <div className=${`grid gap-4 mt-6 ${isTrueFalse ? 'grid-cols-2' : 'grid-cols-2'}`}>
      ${options.map((opt, i) => {
        const isCorrect = revealed && i === correctIdx;
        const isWrong   = revealed && i !== correctIdx;
        return html`
          <div
            key=${opt.id || i}
            className="flex items-center gap-4 rounded-lg border-2 transition-all duration-500"
            style=${{
              borderColor: isCorrect ? '#2dd4bf' : isWrong ? 'rgba(255,255,255,.08)' : COLORS[i % COLORS.length],
              background: isCorrect ? 'rgba(45,212,191,.15)' : isWrong ? 'rgba(255,255,255,.03)' : BGCOLORS[i % BGCOLORS.length],
              padding: 'clamp(12px,2vw,24px)',
              opacity: isWrong ? 0.45 : 1,
              transform: isCorrect ? 'scale(1.03)' : 'scale(1)',
            }}
          >
            <span
              className="flex-shrink-0 flex items-center justify-center rounded-xl font-black"
              style=${{
                width:     'clamp(42px,5vw,68px)',
                height:    'clamp(42px,5vw,68px)',
                background:'rgba(255,255,255,.12)',
                color:      isCorrect ? '#2dd4bf' : COLORS[i % COLORS.length],
                fontSize:  'clamp(1.3rem,2.5vw,2rem)',
              }}
            >
              ${isCorrect ? '✓' : LABELS[i]}
            </span>
            <span
              className="font-bold flex-1"
              style=${{ fontSize: 'clamp(1.1rem,2.2vw,1.9rem)', lineHeight: '1.25' }}
            >
              ${opt.text}
              ${opt.mediaUrl && html`
                <span className="block mt-3">
                  <${MediaStage} url=${opt.mediaUrl} maxHeight="18vh" autoPlay=${false} />
                </span>
              `}
            </span>
          </div>
        `;
      })}
    </div>
  `;
}

// ── Vote display ──────────────────────────────────────────────
function VoteDisplay({ gs, players, curQ }) {
  const mode               = gs?.phaseMeta?.answerMode;
  const voteState          = gs?.voteState;
  const proposalRevealState= gs?.proposalRevealState;

  // vote_question : question affichée, joueurs en standby
  if (mode === 'vote_question') {
    return html`
      <div className="flex flex-col items-center gap-8 py-10 animate-fade-in w-full">
        ${curQ?.mediaUrl && html`
          <div className="flex justify-center mb-2">
            <${MediaStage} url=${curQ.mediaUrl} maxHeight="32vh" />
          </div>
        `}
        ${curQ?.content && html`
          <p className="font-display font-bold text-center"
             style=${{ fontSize: 'clamp(1.8rem,3.5vw,3.2rem)', lineHeight: '1.2' }}>
            ${curQ.content}
          </p>
        `}
        <div className="flex flex-col items-center gap-3 mt-4">
          <div style=${{ fontSize: 'clamp(3rem,8vw,5rem)' }}>🗳️</div>
          <p className="text-white/50 font-bold" style=${{ fontSize: 'clamp(1.2rem,2.5vw,2rem)' }}>
            En attente…
          </p>
          <${Dots} />
        </div>
      </div>
    `;
  }

  if (mode === 'vote_input') {
    const conn  = players.filter(p => p.connected && !p.isBot).length;
    const voted = Object.keys(gs?.answers?.[gs?.currentQuestion?.id] || {}).length;
    const locked = gs?.phaseMeta?.playerScreenLocked;

    // Timer expiré → saisie bloquée, l'animateur lance le vote
    if (locked) return html`
      <div className="flex flex-col items-center gap-8 py-12 animate-fade-in">
        <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🔒</div>
        <h2 className="font-display font-black text-center text-amber-400"
            style=${{ fontSize: 'clamp(2.5rem,7vw,5rem)' }}>
          Saisie terminée
        </h2>
        <p className="text-white/50 font-bold text-center" style=${{ fontSize: 'clamp(1.2rem,2.5vw,2rem)' }}>
          ${voted} réponse(s) reçue(s) — l'animateur lance le vote…
        </p>
        <${Dots} />
      </div>
    `;

    return html`
      <div className="flex flex-col items-center gap-8 py-12 animate-fade-in">
        <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🗳️</div>
        <h2 className="gradient-text-fire font-display font-black text-center"
            style=${{ fontSize: 'clamp(2.5rem,7vw,5rem)' }}>
          Répondez maintenant !
        </h2>
        <div className="flex flex-col items-center gap-3">
          <span className="font-display font-black" style=${{ fontSize: 'clamp(1.6rem,4vw,3rem)', color: 'rgba(255,255,255,.8)' }}>
            ${voted} <span style=${{ color: 'rgba(255,255,255,.3)' }}>sur</span> ${conn} <span style=${{ fontSize: '60%', color: 'rgba(255,255,255,.4)', fontWeight: '600' }}>ont répondu</span>
          </span>
          <div className="h-2 rounded-full overflow-hidden" style=${{ width: 'clamp(180px,28vw,380px)', background: 'rgba(255,255,255,.1)' }}>
            <div
              className="h-full bg-gradient-to-r from-accent to-neon-green rounded-full transition-all duration-500"
              style=${{ width: conn > 0 ? (voted/conn*100)+'%' : '0%' }}
            />
          </div>
        </div>
      </div>
    `;
  }

  // Proposal reveal – une seule proposition à la fois avec fondu
  if (mode === 'vote_proposal_reveal') {
    const proposals = proposalRevealState?.proposals || [];
    const cursor    = proposalRevealState?.revealCursor ?? -1;

    if (cursor < 0) {
      return html`
        <div className="flex flex-col items-center gap-8 py-12 animate-fade-in w-full">
          ${curQ?.mediaUrl && html`
            <div className="flex justify-center mb-2">
              <${MediaStage} url=${curQ.mediaUrl} maxHeight="22vh" />
            </div>
          `}
          ${curQ?.content && html`
            <p className="font-display font-bold text-center text-white/60"
               style=${{ fontSize: 'clamp(1.2rem,2.5vw,2rem)', lineHeight: '1.3' }}>
              ${curQ.content}
            </p>
          `}
          <p className="font-display font-black gradient-text text-center"
             style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>
            Préparez-vous…
          </p>
          <${Dots} />
        </div>
      `;
    }

    const currentProp = proposals[cursor];
    // Trouver le joueur qui a soumis cette proposition (si ce n'est pas un leurre)
    const propPlayer = !currentProp?.isDecoy && currentProp?.playerId
      ? players.find(p => p.id === currentProp.playerId || p.playerId === currentProp.playerId)
      : null;
    const propPseudo = propPlayer?.pseudo || currentProp?.pseudo || null;
    const propAvatar = propPlayer?.avatar || null;

    return html`
      <div className="flex flex-col items-center gap-6 w-full animate-fade-in">
        ${curQ?.mediaUrl && html`
          <div className="flex justify-center mb-1">
            <${MediaStage} url=${curQ.mediaUrl} maxHeight="20vh" />
          </div>
        `}
        <div className="text-white/35 font-mono text-sm">${cursor + 1} / ${proposals.length}</div>
        <div
          key=${'prop-' + cursor}
          className="flex flex-col items-center gap-5 rounded-3xl border-2 px-10 py-8 animate-fade-in"
          style=${{
            background: 'rgba(178,75,255,.12)',
            borderColor: 'rgba(178,75,255,.4)',
            minWidth: 'clamp(260px,55vw,700px)',
            maxWidth: '80vw',
          }}
        >
          <span
            className="font-display font-black text-center text-white"
            style=${{ fontSize: 'clamp(2rem,5vw,4.5rem)', lineHeight: '1.2' }}
          >
            ${currentProp?.text || ''}
          </span>
          ${/* Show author only after vote phase so it stays anonymous during voting */
            propPseudo && html`
            <div className="flex items-center gap-3 mt-2 opacity-80">
              ${propAvatar && html`<span style=${{ fontSize: 'clamp(1.2rem,2.5vw,2rem)' }}>${propAvatar}</span>`}
              <span className="font-bold text-accent" style=${{ fontSize: 'clamp(1rem,2vw,1.6rem)' }}>
                ${propPseudo}
              </span>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // Vote voting – display all options for players to vote on
  if (mode === 'vote_voting') {
    const options    = voteState?.options || [];
    const votes      = voteState?.votes   || {};
    const conn       = players.filter(p => p.connected && !p.isBot).length;
    const totalVotes = Object.keys(votes).length;
    const lockedV    = gs?.phaseMeta?.playerScreenLocked;

    // Timer expiré → votes bloqués, l'animateur révèle les résultats
    if (lockedV) return html`
      <div className="flex flex-col items-center gap-8 py-12 animate-fade-in">
        <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🔒</div>
        <h2 className="font-display font-black text-center text-amber-400"
            style=${{ fontSize: 'clamp(2.5rem,7vw,5rem)' }}>
          Vote terminé
        </h2>
        <p className="text-white/50 font-bold text-center" style=${{ fontSize: 'clamp(1.2rem,2.5vw,2rem)' }}>
          ${totalVotes} vote(s) reçu(s) — l'animateur révèle les résultats…
        </p>
        <${Dots} />
      </div>
    `;

    return html`
      <div className="flex flex-col gap-5 animate-fade-in">
        <h2 className="gradient-text font-display font-black text-center" style=${{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>
          🗳️ Votez pour une réponse !
        </h2>
        <div className="flex items-center justify-center gap-3 mb-2">
          <span style=${{ fontSize: 'clamp(1rem,2vw,1.5rem)', color: 'rgba(255,255,255,.5)' }}>${totalVotes} / ${conn} votes</span>
        </div>
        <div className="flex flex-col gap-3">
          ${options.map((opt, i) => html`
            <div
              key=${i}
              className="flex items-center justify-between rounded-2xl border px-6 py-4"
              style=${{ background: 'rgba(178,75,255,.1)', borderColor: 'rgba(178,75,255,.3)' }}
            >
              <div className="flex items-center gap-4">
                <span className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black bg-accent/20 text-accent" style=${{ fontSize: 'clamp(.9rem,1.8vw,1.3rem)' }}>${i+1}</span>
                <span style=${{ fontSize: 'clamp(1.1rem,2.5vw,2rem)', fontWeight: '700' }}>${opt.text || opt}</span>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  // Vote revealing / revealed — options with voteCount from voteState.options
  // cursor=0 → rien révélé; cursor=N → les N premières options sont visibles
  const options = voteState?.options || [];
  const cursor  = voteState?.revealCursor ?? 0;
  const revealedOptions = options.slice(0, cursor);
  return html`
    <div className="flex flex-col gap-5 animate-fade-in">
      <h2 className="gradient-text font-display font-black text-center" style=${{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>
        Les résultats
      </h2>
      <div className="flex flex-col gap-3">
        ${revealedOptions.map((opt, i) => {
          const count = opt.voteCount ?? 0;
          // Score fixe +10 / -10 quel que soit le nombre de votes
          const scoreLabel = count > 0
            ? (opt.isDecoy ? '−10' : '+10')
            : (opt.isDecoy ? '✗' : '—');
          return html`
            <div
              key=${i}
              className="flex items-center justify-between rounded-2xl border px-6 py-4 animate-fade-in"
              style=${{
                background: opt.isDecoy ? 'rgba(251,113,133,.1)' : 'rgba(79,172,254,.12)',
                borderColor: opt.isDecoy ? 'rgba(251,113,133,.3)' : 'rgba(79,172,254,.3)',
              }}
            >
              <div className="flex flex-col gap-1">
                <span style=${{ fontSize: 'clamp(1.2rem,2.5vw,2rem)', fontWeight: '700' }}>${opt.text || opt}</span>
                ${count > 0 && html`<span style=${{ fontSize: 'clamp(.75rem,1.5vw,1rem)', color: 'rgba(255,255,255,.35)' }}>${count} vote(s)</span>`}
              </div>
              <span
                className=${`font-display font-black ${opt.isDecoy ? 'text-rose-400' : 'text-neon-green'}`}
                style=${{ fontSize: 'clamp(1.5rem,3.5vw,2.5rem)', flexShrink: 0, marginLeft: '1rem' }}
              >
                ${scoreLabel}
              </span>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// ── Buzzer display ────────────────────────────────────────────
function BuzzerDisplay({ gs, players }) {
  const buzzerState = gs?.buzzerState;
  const firstId     = buzzerState?.firstPlayerId;
  const firstPlayer = players.find(p => p.id === firstId || p.playerId === firstId);
  const blr         = gs?.buzzerLastResult;

  // Client-side safety: auto-masquer le résultat après 2.5s même si le serveur
  // ne renvoie pas de mise à jour (ex. réseau lent, double marquage rapide).
  const [hiddenAt, setHiddenAt] = useState(null);
  useEffect(() => {
    if (!blr?.at) return;
    const t = setTimeout(() => setHiddenAt(blr.at), 1250);
    return () => clearTimeout(t);
  }, [blr?.at]); // eslint-disable-line

  const showBlr = blr?.at && blr.at !== hiddenAt;

  if (showBlr) {
    const who = players.find(p => p.id === blr.playerId || p.playerId === blr.playerId);
    const isCorrect = blr.result === 'correct';
    return html`
      <div className="flex flex-col items-center gap-6 animate-bounce-in">
        <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>${isCorrect ? '✅' : '❌'}</div>
        <div className="text-center">
          <div style=${{ fontSize: 'clamp(1.2rem,3vw,2.2rem)', fontWeight:'700', color: isCorrect ? '#2dd4bf' : '#ff4e6a' }}>
            ${isCorrect ? 'CORRECT !' : 'FAUX !'}
          </div>
          ${who && html`<div style=${{ fontSize: 'clamp(1rem,2.5vw,1.8rem)', color: 'rgba(255,255,255,.6)', marginTop:'6px' }}>${who.avatar || '🎮'} ${who.pseudo}</div>`}
        </div>
      </div>
    `;
  }

  if (!firstId) {
    return html`
      <div className="flex flex-col items-center gap-5 animate-fade-in">
        <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🔔</div>
        <h2 className="font-display font-black gradient-text text-center"
            style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>
          Buzzers actifs
        </h2>
        <p className="text-white/50 text-center" style=${{ fontSize: 'clamp(1.2rem,2.8vw,2rem)' }}>
          Soyez prêts à répondre !
        </p>
      </div>
    `;
  }

  return html`
    <div className="flex flex-col items-center gap-6 animate-bounce-in">
      <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }} className="animate-bounce">❗</div>
      <div style=${{ fontSize: 'clamp(2.5rem,6vw,4.5rem)' }} className="flex items-center gap-4">
        <span>${firstPlayer?.avatar || '🎮'}</span>
        <span className="font-display font-black text-neon-green">${firstPlayer?.pseudo || '?'}</span>
      </div>
      <p className="text-white/50" style=${{ fontSize: 'clamp(1rem,2vw,1.5rem)' }}>a buzzé en premier !</p>
    </div>
  `;
}

// ── Scoreboard component ──────────────────────────────────────
function TVScoreboard({ leaderboard, title = 'Classement' }) {
  const top10 = leaderboard.slice(0, 10);
  return html`
    <div className="w-full max-w-3xl mx-auto animate-fade-in">
      <h2 className="font-display font-black gradient-text text-center mb-6"
          style=${{ fontSize: 'clamp(2rem,4.5vw,3.5rem)' }}>
        🏆 ${title}
      </h2>
      <div className="flex flex-col gap-3">
        ${top10.map((p, i) => html`
          <div
            key=${p.playerId || p.id || i}
            className=${`flex items-center gap-5 rounded-2xl border px-6 py-4 transition-all ${i === 0 ? 'border-amber-400/50 bg-amber-400/10' : i === 1 ? 'border-white/20 bg-white/5' : i === 2 ? 'border-amber-600/30 bg-amber-600/5' : 'border-white/8 bg-white/3'}`}
          >
            <span
              className="font-display font-black flex-shrink-0 text-center"
              style=${{ fontSize: 'clamp(1.5rem,3vw,2.5rem)', color: i===0?'#fbbf24':i===1?'#e5e7eb':i===2?'#d97706':'rgba(255,255,255,.3)', minWidth:'2.5rem' }}
            >
              ${i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}
            </span>
            <span style=${{ fontSize: 'clamp(1.5rem,3.5vw,2.8rem)' }}>${p.avatar || '🎮'}</span>
            <span className="flex-1 font-bold truncate" style=${{ fontSize: 'clamp(1rem,2.5vw,1.8rem)' }}>${p.pseudo || p.name}</span>
            ${p.teamName && html`<span style=${{ fontSize:'clamp(.8rem,1.5vw,1.1rem)',color:'rgba(255,255,255,.4)' }}>${p.teamName}</span>`}
            <span className="font-display font-black font-mono text-neon-green flex-shrink-0"
                  style=${{ fontSize: 'clamp(1.5rem,3.5vw,2.8rem)' }}>
              ${p.score ?? p.scoreTotal ?? 0}
            </span>
          </div>
        `)}
      </div>
    </div>
  `;
}

// ── TimerOverlay ──────────────────────────────────────────────
const TIMER_CSS = `
@keyframes tp-sm { 0%,100%{transform:scale(1);opacity:1}   50%{transform:scale(1.07);opacity:.92} }
@keyframes tp-md { 0%,100%{transform:scale(1);opacity:1}   50%{transform:scale(1.15);opacity:.84} }
@keyframes tp-lg { 0%,100%{transform:scale(1);opacity:1}   50%{transform:scale(1.28);opacity:.76} }
`;

function TimerOverlay({ timer }) {
  // Local countdown ticks every 200 ms so the ring depletes smoothly
  // even if socket updates arrive late.
  const [localSec, setLocalSec] = useState(() => timer?.remainingSec ?? 0);
  const ivRef      = useRef(null);
  const metaRef    = useRef(null);

  useEffect(() => {
    if (!document.getElementById('timer-style')) {
      const el = document.createElement('style');
      el.id = 'timer-style';
      el.textContent = TIMER_CSS;
      document.head.appendChild(el);
    }
  }, []);

  useEffect(() => {
    if (!timer || timer.totalSec <= 0) {
      setLocalSec(0);
      metaRef.current = null;
      if (ivRef.current) { clearInterval(ivRef.current); ivRef.current = null; }
      return;
    }
    const startMs = timer.startedAt
      ? new Date(timer.startedAt).getTime()
      : Date.now() - (timer.totalSec - timer.remainingSec) * 1000;
    metaRef.current = { startMs, totalSec: timer.totalSec };

    const tick = () => {
      const meta = metaRef.current;
      if (!meta) return;
      const rem = Math.max(0, meta.totalSec - (Date.now() - meta.startMs) / 1000);
      setLocalSec(rem);
      if (rem <= 0 && ivRef.current) { clearInterval(ivRef.current); ivRef.current = null; }
    };
    tick();
    if (ivRef.current) clearInterval(ivRef.current);
    ivRef.current = setInterval(tick, 200);
    return () => { if (ivRef.current) { clearInterval(ivRef.current); ivRef.current = null; } };
  }, [timer?.startedAt, timer?.totalSec]); // eslint-disable-line

  // Visibilité : le timer du serveur fait foi (localSec peut être 0 brièvement
  // au premier render avant que l'effet ait tourné)
  if (!timer || timer.remainingSec <= 0) return null;
  // Valeur d'affichage : local (200 ms) ou fallback serveur
  const sec   = localSec > 0 ? localSec : timer.remainingSec;
  const total = timer.totalSec || 30;
  const ratio = sec / total;

  // ── 4 couleurs selon le temps restant ────────────────────────
  const urgent = sec <= 5;
  const orange = !urgent && ratio <= 0.25;
  const yellow = !urgent && !orange && ratio <= 0.5;
  const color  = urgent ? '#ff4e6a'
    : orange ? '#f97316'
    : yellow ? '#fbbf24'
    : '#2dd4bf';

  // ── Pulse + taille du conteneur croissants ───────────────────
  const anim = urgent ? 'tp-lg .4s ease-in-out infinite'
    : orange ? 'tp-md .7s ease-in-out infinite'
    : yellow ? 'tp-sm 1.2s ease-in-out infinite'
    : 'none';
  const size = urgent ? 'clamp(110px,16vw,180px)'
    : orange ? 'clamp(96px,14vw,158px)'
    : yellow ? 'clamp(86px,13vw,148px)'
    : 'clamp(80px,12vw,140px)';
  const numFontSize = urgent ? 'clamp(2.8rem,7vw,5rem)'
    : orange ? 'clamp(2.3rem,6vw,4.2rem)'
    : yellow ? 'clamp(2rem,5.5vw,3.7rem)'
    : 'clamp(1.8rem,4.5vw,3.2rem)';

  const pct  = Math.max(0, sec / total);
  const R    = 54;
  const circ = 2 * Math.PI * R;
  const dash = circ * (1 - pct);

  return html`
    <div style=${{
      position: 'fixed',
      bottom: 'clamp(24px,4vh,48px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 80,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      pointerEvents: 'none',
    }}>
      <div style=${{
        position: 'relative',
        width: size,
        height: size,
        animation: anim,
        transition: 'width .3s, height .3s',
      }}>
        <!-- Ring SVG -->
        <svg
          viewBox="0 0 120 120"
          style=${{ position:'absolute', inset:0, width:'100%', height:'100%', transform:'rotate(-90deg)' }}
        >
          <circle cx="60" cy="60" r=${R} fill="none" stroke="rgba(255,255,255,.1)" stroke-width="8" />
          <circle
            cx="60" cy="60" r=${R}
            fill="none"
            stroke=${color}
            stroke-width="8"
            stroke-linecap="round"
            stroke-dasharray=${circ}
            stroke-dashoffset=${dash}
            style=${{ transition: 'stroke-dashoffset 0.85s linear, stroke 0.3s' }}
          />
        </svg>
        <!-- Number -->
        <div style=${{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display, monospace)',
          fontWeight: '900',
          fontSize: numFontSize,
          color,
          textShadow: (urgent || orange) ? `0 0 ${urgent?30:18}px ${color}` : 'none',
          background: 'rgba(0,0,0,.6)',
          borderRadius: '50%',
          transition: 'font-size .3s, color .3s',
        }}>
          ${Math.ceil(sec)}
        </div>
      </div>
    </div>
  `;
}

// ── AllAnsweredBurst ──────────────────────────────────────────
const BURST_CSS = '@keyframes burst-scale{0%{transform:scale(1);opacity:0}20%{transform:scale(1.2);opacity:1}70%{transform:scale(1.5);opacity:1}100%{transform:scale(2);opacity:0}}';
function AllAnsweredBurst({ show }) {
  useEffect(() => {
    if (!show) return;
    // Injecter les keyframes une seule fois
    if (!document.getElementById('burst-style')) {
      const el = document.createElement('style');
      el.id = 'burst-style';
      el.textContent = BURST_CSS;
      document.head.appendChild(el);
    }
  }, [show]);
  if (!show) return null;
  return html`
    <div style=${{
      position: 'fixed', inset: 0, zIndex: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style=${{
        animation: 'burst-scale 1.5s ease-out forwards',
        fontSize: 'clamp(2rem,6vw,4rem)',
        fontWeight: '900',
        color: '#2dd4bf',
        textShadow: '0 0 30px rgba(45,212,191,0.8)',
        whiteSpace: 'nowrap',
      }}>
        ✅ Tous ont répondu !
      </div>
    </div>
  `;
}

// ── Main Display view ─────────────────────────────────────────
export default function DisplayView() {
  const { socket, displaySession, setDisplaySession, gameState: gs, players, lbPlayers, lbTeams, navigate, musicMuted, toggleMute, ducking, silenceForVideo, soundPlay } = useGame();

  // Couper totalement la musique quand une vidéo (challenge ou entraînement) joue
  useEffect(() => {
    if (!silenceForVideo) return;
    const videoCtrl    = gs?.videoState?.videoControl;
    const trainingCtrl = gs?.videoState?.trainingVideoControl;
    const isPlaying = videoCtrl?.action === 'play' || trainingCtrl?.action === 'play';
    silenceForVideo(isPlaying);
  }, [ // eslint-disable-line
    gs?.videoState?.videoControl?.action,
    gs?.videoState?.videoControl?.at,
    gs?.videoState?.trainingVideoControl?.action,
    gs?.videoState?.trainingVideoControl?.at,
  ]);

  // ── "Tous ont répondu" burst + son de cloche ──────────────
  const [showBurst, setShowBurst] = useState(false);
  const prevAllAnswered = useRef(false);
  useEffect(() => {
    const curQ   = gs?.currentQuestion;
    const phase2 = gs?.status || 'lobby';
    const ansMode = gs?.phaseMeta?.answerMode;
    const conn2  = (players || []).filter(p => p.connected && !p.isBot).length;
    const answered2 = Object.keys(gs?.answers?.[curQ?.id] || {}).length;
    const isCountable = (phase2 === 'question' || phase2 === 'waiting') &&
      ansMode !== 'vote_input' && ansMode !== 'vote_voting' &&
      conn2 > 0 && answered2 >= conn2;
    if (isCountable && !prevAllAnswered.current) {
      prevAllAnswered.current = true;
      if (typeof soundPlay === 'function') soundPlay('bell');
      setShowBurst(true);
      setTimeout(() => setShowBurst(false), 1600);
    } else if (!isCountable) {
      prevAllAnswered.current = false;
    }
  }, [gs?.answers, gs?.status, gs?.currentQuestion?.id, players]); // eslint-disable-line

  if (!displaySession?.connected) return html`<${DisplayConnect} />`;

  const phase     = gs?.status || 'lobby';
  const sc        = displaySession.sessionCode;
  const isPaused  = gs?.phaseMeta?.paused === true;
  const roundBg   = gs?.currentRound?.backgroundUrl ? resolveMedia(gs.currentRound.backgroundUrl) : '';
  const ceremony  = phase === 'end';
  const bgUrl     = ceremony && gs?.ceremonyBackgroundUrl
    ? resolveMedia(gs.ceremonyBackgroundUrl) : roundBg;

  // ── Phase content ─────────────────────────────────────────
  const renderContent = () => {
    if (isPaused) return html`
      <div className="flex flex-col items-center justify-center flex-1 gap-5">
        <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>⏸️</div>
        <h1 className="font-display font-black" style=${{ fontSize: 'clamp(3rem,7vw,6rem)' }}>Pause</h1>
        <${Dots} />
      </div>
    `;

    if (phase === 'lobby') {
      const connP = players.filter(p => p.connected);
      const welcomeImg = gs?.quizWelcomeImageUrl ? resolveMedia(gs.quizWelcomeImageUrl) : '';
      return html`
        <div className="relative flex flex-col min-h-[100dvh]"
             style=${welcomeImg ? { backgroundImage:`url('${welcomeImg}')`, backgroundSize:'cover', backgroundPosition:'center' } : {}}>
          ${welcomeImg && html`<div className="bg-overlay" />`}
          <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-6 px-8 py-12">
            <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🎮</div>
            <h1 className="font-display font-black gradient-text text-center"
                style=${{ fontSize: 'clamp(2.5rem,7vw,6rem)' }}>
              ${gs?.quizTitle || 'Quiz Live'}
            </h1>
            <div className="flex flex-col items-center gap-2">
              <p className="text-white/50 text-center" style=${{ fontSize: 'clamp(1rem,2vw,1.5rem)' }}>Code de session</p>
              <div className="font-mono font-black tracking-[.4em] text-accent"
                   style=${{ fontSize: 'clamp(3rem,8vw,7rem)' }}>
                ${sc}
              </div>
            </div>
          </div>
          <div className="relative z-10 pb-8 px-8">
            <p className="text-white/30 text-center mb-4"
               style=${{ fontSize: 'clamp(.9rem,1.5vw,1.2rem)' }}>
              ${connP.length} joueur(s) connecté(s)
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              ${connP.map(p => html`
                <div key=${p.id || p.playerId} className="flex flex-col-reverse items-center gap-1 px-4 py-3 rounded-2xl bg-white/8 border border-white/10 animate-fade-in">
                  <span style=${{ fontSize: 'clamp(1.5rem,3.5vw,2.8rem)' }}>${p.avatar || '🎮'}</span>
                  <span className="font-bold text-white/80" style=${{ fontSize: 'clamp(.7rem,1.3vw,1rem)' }}>${p.pseudo || '?'}</span>
                </div>
              `)}
            </div>
          </div>
        </div>
      `;
    }

    if (phase === 'round_intro') {
      const round   = gs?.currentRound;
      const rt      = ROUND_TYPES[round?.type];
      const hasBg   = !!round?.backgroundUrl;
      const rBgStyle= hasBg ? { backgroundImage:`url('${resolveMedia(round.backgroundUrl)}')`, backgroundSize:'cover', backgroundPosition:'center' } : {};
      return html`
        <div className="relative flex flex-col items-center justify-center min-h-[100dvh] p-8 text-center" style=${rBgStyle}>
          ${hasBg && html`<div className="bg-overlay" />`}
          <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in">
            ${rt && html`
              <div className="inline-flex items-center gap-3 rounded-full border font-black tracking-wide"
                   style=${{
                     background: `${rt.color}22`,
                     borderColor: `${rt.color}60`,
                     color: rt.color,
                     fontSize: 'clamp(1.3rem, 2.8vw, 2.4rem)',
                     padding: 'clamp(10px, 1.4vw, 22px) clamp(24px, 3.5vw, 52px)',
                     letterSpacing: '0.06em',
                   }}>
                <span style=${{ fontSize: 'clamp(1.5rem, 3vw, 2.6rem)' }}>${rt.icon}</span>
                ${rt.label}
              </div>
            `}
            <div style=${{ fontSize: 'clamp(4rem,12vw,9rem)', marginTop: '0.5rem' }}>${rt?.icon || '🎯'}</div>
            <h1 className="font-display font-black" style=${{ fontSize: 'clamp(2.5rem,6vw,5.5rem)' }}>
              ${round?.title || 'Nouvelle manche'}
            </h1>
            ${round?.shortRules && html`
              <p className="text-white/50" style=${{ fontSize: 'clamp(1rem,2vw,1.6rem)', maxWidth:'60vw' }}>
                ${round.shortRules}
              </p>
            `}
          </div>
        </div>
      `;
    }

    if (phase === 'training_video') return html`
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-6 animate-fade-in px-8">
        <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🏋️</div>
        <h1 className="font-display font-black text-amber-400" style=${{ fontSize: 'clamp(2.5rem,6vw,5rem)' }}>
          Vidéo d'entraînement
        </h1>
        <${MediaStage} url=${gs?.currentRound?.trainingVideoUrl} maxHeight="58vh" />
        <${Dots} />
      </div>
    `;

    if (phase === 'question' || phase === 'waiting' || phase === 'manual_scoring') {
      return renderQuestion();
    }

    if (phase === 'answer_reveal') {
      const _am = gs?.phaseMeta?.answerMode;
      // Vote reveal: delegate to renderQuestion which handles VoteDisplay
      if (_am === 'vote_revealing' || _am === 'vote_revealed') return renderQuestion();
      return renderReveal();
    }

    if (phase === 'round_end') {
      const lb = lbPlayers.length ? lbPlayers : (gs?.leaderboardPlayers || []);
      return html`
        <div className="flex flex-col items-center justify-center min-h-[100dvh] px-8 py-10">
          <h1 className="font-display font-black mb-8 gradient-text" style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>
            🏁 Fin de la manche
          </h1>
          <${TVScoreboard} leaderboard=${lb} title="Classement" />
        </div>
      `;
    }

    if (phase === 'results' || phase === 'end') {
      const ceremonyView = gs?.phaseMeta?.ceremonyView || 'players';
      const finalCeremony = gs?.phaseMeta?.finalCeremony || null;
      // End phase without ceremony → waiting screen
      if (phase === 'end' && !finalCeremony) {
        return html`
          <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-8 px-8 animate-fade-in">
            <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🏆</div>
            <h1 className="font-display font-black gradient-text text-center"
                style=${{ fontSize: 'clamp(2.5rem,6vw,5rem)' }}>
              Quiz terminé !
            </h1>
            <p className="text-white/40 text-center" style=${{ fontSize: 'clamp(1rem,2vw,1.6rem)' }}>
              La cérémonie de remise des prix commence dans un instant…
            </p>
            <${Dots} />
          </div>
        `;
      }

      if (phase === 'end' && finalCeremony) {
        const revealOrder = ceremonyView === 'teams'
          ? (finalCeremony.teamsRevealOrder || [])
          : (finalCeremony.revealOrder || []);
        const visible = revealOrder.filter(x => x.revealed);
        const pending = revealOrder.length - visible.length;
        // Afficher du plus récemment révélé (rang le plus élevé) vers le bas (rang le plus faible)
        // revealOrder va du dernier au premier, donc les derniers révélés = rangs les plus hauts
        const lb = [...visible].reverse().map(x => ({
          ...x,
          pseudo: x.pseudo || x.name,
          scoreTotal: x.scoreTotal || 0,
        }));
        // Show podium when top-3 are all revealed (rank 1-3 visible)
        const top3Visible = lb.filter(x => x.rank <= 3);
        const allTop3Revealed = top3Visible.length >= Math.min(3, revealOrder.filter(x => x.rank <= 3).length);
        const MEDAL = ['🥇','🥈','🥉'];
        if (allTop3Revealed && pending === 0 && top3Visible.length > 0) {
          // Trier par rang : rank1=centre(plus haut), rank2=gauche(milieu), rank3=droite(plus bas)
          const podiumByRank = Object.fromEntries(lb.filter(x => x.rank <= 3).map(x => [x.rank, x]));
          const rest         = lb.filter(x => x.rank > 3);
          // Ordre visuel podium : gauche=rank2, centre=rank1, droite=rank3
          const podiumVisual = [podiumByRank[2], podiumByRank[1], podiumByRank[3]].filter(Boolean);
          const podiumHeights = { 1: '22vh', 2: '16vh', 3: '12vh' };
          const podiumBg      = { 1: 'rgba(255,215,0,.22)', 2: 'rgba(192,192,192,.18)', 3: 'rgba(205,127,50,.18)' };
          const podiumBorder  = { 1: 'rgba(255,215,0,.55)', 2: 'rgba(192,192,192,.45)', 3: 'rgba(205,127,50,.45)' };
          return html`
            <div className="flex flex-col items-center min-h-[100dvh] px-8 py-10 gap-6 animate-fade-in">
              <h1 className="font-display font-black gradient-text" style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>
                ${ceremonyView === 'teams' ? '🏆 Classement par équipes' : '🏆 Classement Final'}
              </h1>
              <!-- Podium top 3 : rank2 gauche, rank1 centre (plus haut), rank3 droite -->
              <div className="flex items-end justify-center gap-6" style=${{ minHeight:'26vh' }}>
                ${podiumVisual.map((p, idx) => {
                  if (!p) return null;
                  const delay = p.rank === 1 ? '0ms' : p.rank === 2 ? '200ms' : '400ms';
                  return html`
                    <div key=${p.rank} className="flex flex-col items-center gap-2 animate-bounce-in"
                         style=${{ animationDelay: delay }}>
                      <span style=${{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>${p.avatar || '🎮'}</span>
                      <span style=${{ fontSize: 'clamp(2rem,4.5vw,3.5rem)' }}>${MEDAL[p.rank - 1]}</span>
                      <span className="font-display font-black text-center" style=${{ fontSize: 'clamp(1rem,2vw,1.8rem)', maxWidth:'18vw' }}>${p.pseudo || p.name}</span>
                      <span className="font-mono font-black text-neon-green" style=${{ fontSize: 'clamp(.9rem,1.8vw,1.4rem)' }}>${p.scoreTotal} pts</span>
                      <div className="rounded-t-2xl w-full flex items-center justify-center" style=${{
                        height: podiumHeights[p.rank] || '12vh',
                        minWidth: 'clamp(90px,14vw,170px)',
                        background: podiumBg[p.rank] || 'rgba(255,255,255,.1)',
                        border: `2px solid ${podiumBorder[p.rank] || 'rgba(255,255,255,.2)'}`,
                        fontSize: 'clamp(2rem,5vw,4rem)',
                        opacity: '.45',
                      }}>${p.rank}</div>
                    </div>
                  `;
                })}
              </div>
              <!-- Non top-3 avec avatar + rankComment -->
              ${rest.length > 0 && html`
                <div className="flex flex-col gap-2 w-full max-w-2xl">
                  ${rest.map(p => html`
                    <div key=${p.playerId || p.teamId} className="flex items-center gap-3 rounded-xl bg-white/5 px-5 py-2.5 animate-fade-in">
                      <span className="font-mono text-white/30 w-8 text-sm">${p.rank}.</span>
                      <span style=${{ fontSize: 'clamp(1.2rem,2.5vw,1.8rem)' }}>${p.avatar || '🎮'}</span>
                      <span className="flex-1 font-semibold truncate">${p.pseudo || p.name}</span>
                      ${p.rankComment && html`<span className="text-white/38 text-xs italic hidden sm:block">${p.rankComment}</span>`}
                      <span className="font-mono font-bold text-neon-green">${p.scoreTotal} pts</span>
                    </div>
                  `)}
                </div>
              `}
            </div>
          `;
        }

        // Joueurs révélés (avant que le podium soit complet) — liste avec avatar + rankComment
        if (visible.length > 0) {
          return html`
            <div className="flex flex-col items-center justify-center min-h-[100dvh] px-8 py-10 gap-4">
              <h1 className="font-display font-black gradient-text mb-2" style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>
                ${ceremonyView === 'teams' ? '🏆 Classement par équipes' : '🏆 Classement Final'}
              </h1>
              <div className="flex flex-col gap-2 w-full max-w-2xl">
                ${lb.map(p => html`
                  <div key=${p.playerId || p.teamId} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/8 px-5 py-3 animate-fade-in">
                    <span className="font-mono text-white/30 w-8 text-sm">${p.rank}.</span>
                    <span style=${{ fontSize: 'clamp(1.2rem,2.5vw,1.8rem)' }}>${p.avatar || '🎮'}</span>
                    <span className="flex-1 font-semibold truncate">${p.pseudo || p.name}</span>
                    ${p.rankComment && html`<span className="text-white/38 text-xs italic hidden sm:block">${p.rankComment}</span>`}
                    <span className="font-mono font-bold text-neon-green">${p.scoreTotal} pts</span>
                  </div>
                `)}
              </div>
              ${pending > 0 && html`
                <p className="mt-4 text-white/38 font-bold tracking-[0.18em] uppercase">${pending} résultat(s) masqué(s)</p>
              `}
            </div>
          `;
        }

        // Aucun joueur révélé encore
        return html`
          <div className="flex flex-col items-center justify-center min-h-[100dvh] px-8 py-10 gap-8 animate-fade-in">
            <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🏆</div>
            <h1 className="font-display font-black gradient-text text-center" style=${{ fontSize: 'clamp(2.5rem,6vw,5rem)' }}>
              ${ceremonyView === 'teams' ? 'Classement par équipes' : 'Classement Final'}
            </h1>
            <p className="text-white/40 text-center" style=${{ fontSize: 'clamp(1rem,2vw,1.6rem)' }}>
              Les révélations vont commencer…
            </p>
            <${Dots} />
          </div>
        `;
      }
      const lb = ceremonyView === 'teams'
        ? (lbTeams.length ? lbTeams : (gs?.leaderboardTeams || []))
        : (lbPlayers.length ? lbPlayers : (gs?.leaderboardPlayers || []));
      const title = phase === 'end'
        ? (ceremonyView === 'teams' ? '🏆 Classement par équipes' : '🏆 Classement Final')
        : '📊 Résultats';
      return html`
        <div className="flex flex-col items-center justify-center min-h-[100dvh] px-8 py-10">
          <${TVScoreboard} leaderboard=${lb} title=${title} />
          ${phase === 'end' && html`<audio id="reveal-audio-player" src="" style=${{display:'none'}} />`}
        </div>
      `;
    }

    return html`<div className="flex items-center justify-center min-h-[100dvh]"><${Dots} /></div>`;
  };

  const renderQuestion = () => {
    const curQ    = gs?.currentQuestion;
    const ansMode = gs?.phaseMeta?.answerMode;
    const timer   = gs?.phaseMeta?.timer;
    const isBuzzer= ansMode === 'buzzer';
    const isVote  = ansMode === 'vote_question' || ansMode === 'vote_input' || ansMode === 'vote_proposal_reveal' || ansMode === 'vote_voting' || ansMode === 'vote_revealing' || ansMode === 'vote_revealed';
    const isBurger= gs?.currentRound?.type === 'burger';
    const isVC    = gs?.currentRound?.type === 'video_challenge';
    const conn    = players.filter(p => p.connected && !p.isBot).length;
    const answered= Object.keys(gs?.answers?.[curQ?.id] || {}).length;
    const curRound= gs?.currentRound;

    // Burger
    if (isBurger) {
      const allItems = curQ?.items || [];
      const currentIdx = gs?.burgerState?.currentItemIndex ?? -1;
      const currentItem = currentIdx >= 0 ? allItems[currentIdx] : null;
      const totalItems = allItems.length;
      const selectedId     = gs?.burgerSelectedPlayerId;
      const selectedPseudo = gs?.burgerSelectedPseudo || '';
      const selectedPlayer = selectedId ? players.find(p => p.id === selectedId || p.playerId === selectedId) : null;
      const selAvatar      = selectedPlayer?.avatar || '🎮';
      const answering = phase === 'manual_scoring' || gs?.burgerState?.answering;
      const bfs = gs?.burgerFinalScore;

      // Score attribué → affichage flash du score
      if (bfs?.scored) {
        return html`
          <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-8 px-8 animate-bounce-in">
            <div style=${{ fontSize: 'clamp(3rem,8vw,6rem)' }}>🍔</div>
            <p className="font-display font-black text-amber-400 text-center"
               style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>
              ${bfs.pseudo || selectedPseudo}
            </p>
            <div
              className="font-display font-black gradient-text-green"
              style=${{ fontSize: 'clamp(6rem,20vw,12rem)', lineHeight: '1' }}
            >
              ${bfs.score}
            </div>
            <p className="text-white/40 font-bold uppercase tracking-widest"
               style=${{ fontSize: 'clamp(1rem,2.5vw,1.8rem)' }}>
              points
            </p>
          </div>
        `;
      }

      // ── Player spotlight card (shown whenever a player is selected) ──
      const PlayerSpotlight = selectedPseudo ? html`
        <div
          className="flex flex-col items-center gap-3 animate-bounce-in"
          style=${{
            background: 'rgba(245,158,11,.12)',
            border: '3px solid rgba(245,158,11,.5)',
            borderRadius: '2rem',
            padding: 'clamp(16px,2.5vh,32px) clamp(32px,5vw,64px)',
            boxShadow: '0 0 48px rgba(245,158,11,.3)',
          }}
        >
          <span style=${{ fontSize: 'clamp(3rem,8vw,6rem)' }}>${selAvatar}</span>
          <span className="font-display font-black text-amber-400 text-center"
                style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>
            ${selectedPseudo}
          </span>
          ${answering && html`
            <span className="text-white/80 font-bold uppercase tracking-widest"
                  style=${{ fontSize: 'clamp(.9rem,1.8vw,1.4rem)' }}>
              🎤 répond maintenant
            </span>
          `}
          ${!answering && !currentItem && html`
            <span className="text-white/55 font-bold uppercase tracking-widest"
                  style=${{ fontSize: 'clamp(.9rem,1.8vw,1.4rem)' }}>
              Préparez-vous…
            </span>
          `}
        </div>
      ` : null;

      return html`
        <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-8 px-8 animate-fade-in">
          <div style=${{ fontSize: 'clamp(3rem,8vw,6rem)' }}>🍔</div>
          <h1 className="font-display font-black gradient-text-fire text-center"
              style=${{ fontSize: 'clamp(2.5rem,7vw,5rem)' }}>
            Burger de la Mort
          </h1>
          ${!selectedPseudo && html`
            <p className="text-white/50 text-center" style=${{ fontSize: 'clamp(1.2rem,3vw,2.2rem)' }}>
              Le maître de jeu choisit un candidat.
            </p>
          `}
          ${PlayerSpotlight}
          ${currentItem && !answering && html`
            <div className="text-center mb-2">
              <span className="font-mono text-amber-400/50 text-sm">${currentIdx + 1} / ${totalItems}</span>
            </div>
            <div key=${currentIdx} className="flex items-center justify-center gap-5 rounded-3xl border-2 border-amber-500/40 bg-amber-500/12 px-10 py-8 animate-fade-in" style=${{ maxWidth:'70vw' }}>
              <span className="font-mono text-amber-400 font-black" style=${{ fontSize: 'clamp(1.5rem,3.5vw,3rem)' }}>${currentIdx + 1}.</span>
              <span className="font-display font-black text-white" style=${{ fontSize: 'clamp(1.8rem,4.5vw,4rem)', textAlign:'center' }}>${currentItem?.text || currentItem}</span>
            </div>
          `}
        </div>
      `;
    }

    // Video Challenge
    if (isVC) {
      const vcPhase = gs?.videoState?.phase;
      const selId   = gs?.videoState?.selectedPlayerId;
      const selTeam = gs?.videoState?.selectedTeamId;
      const who     = selId ? players.find(p => (p.id===selId||p.playerId===selId)) : null;
      const selectedName = who?.pseudo || gs?.videoState?.selectedPseudo || '';
      const score   = gs?.videoState?.score;
      const isTraining = vcPhase === 'training_ready' || vcPhase === 'training_playing';
      const mediaUrl = isTraining ? curQ?.trainingVideoUrl : (curQ?.videoUrl || curQ?.mediaUrl);
      const control = vcPhase === 'training_playing' ? gs?.videoState?.trainingVideoControl : gs?.videoState?.videoControl;
      // training_playing et playing partagent la même mise en page : vidéo en grand, candidat en dessous
      if (vcPhase === 'training_playing' || vcPhase === 'playing' || vcPhase === 'eval' || vcPhase === 'scored') {
        return html`
          <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-6 px-8 animate-fade-in">
            <div className="text-xs font-bold uppercase tracking-widest opacity-40">
              ${vcPhase === 'training_playing' ? '🏋️ Entraînement' : '🎬 Challenge Vidéo'}
            </div>
            <${ControlledVideo} url=${mediaUrl} control=${control} maxHeight="56vh" />
            ${who && html`
              <p className="text-white/70 text-center font-display font-black" style=${{ fontSize: 'clamp(1.4rem,3vw,2.5rem)' }}>
                ${who.avatar || '🎮'} <span className="text-white">${who.pseudo}</span>
              </p>
            `}
            ${score != null && html`
              <div className="font-display font-black text-neon-green"
                   style=${{ fontSize: 'clamp(5rem,18vw,10rem)' }}>
                ${score}
              </div>
            `}
          </div>
        `;
      }
      return html`
        <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-8 px-8 animate-fade-in">
          <div style=${{ fontSize: 'clamp(3rem,8vw,6rem)' }}>🎬</div>
          <h1 className="font-display font-black gradient-text-fire text-center"
              style=${{ fontSize: 'clamp(2.5rem,7vw,5rem)' }}>
            Challenge Vidéo
          </h1>
          ${who && html`
            <p className="text-white/60 text-center" style=${{ fontSize: 'clamp(1.2rem,3vw,2.2rem)', fontWeight:'600' }}>
              ${who.avatar || '🎮'} <strong className="text-white">${who.pseudo}</strong> passe à l'action !
            </p>
          `}
          ${vcPhase === 'select' && html`
            <p className="text-white/45 text-center" style=${{ fontSize: 'clamp(1.1rem,2.5vw,1.8rem)' }}>Le maitre de jeu choisit un candidat.</p>
          `}
          ${vcPhase === 'ready' && html`
            <p className="text-rose-300 text-center font-display font-black" style=${{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>Preparez-vous.</p>
          `}
          ${vcPhase === 'training_ready' && curQ?.trainingVideoUrl && html`
            <${ControlledVideo} url=${curQ.trainingVideoUrl} control=${gs?.videoState?.trainingVideoControl} maxHeight="46vh" />
          `}
          ${curQ?.content && html`<p className="text-white/50 text-center" style=${{ fontSize: 'clamp(1rem,2vw,1.5rem)', maxWidth:'70vw' }}>${curQ.content}</p>`}
        </div>
      `;
    }

    // Vote
    if (isVote) {
      const showContentHeader = ansMode === 'vote_input' || ansMode === 'vote_voting' || ansMode === 'vote_revealing' || ansMode === 'vote_revealed';
      return html`
        <div className="flex flex-col items-center justify-center min-h-[100dvh] px-8 py-10">
          ${showContentHeader && curQ?.content && html`
            <p className="font-bold text-center mb-8" style=${{ fontSize: 'clamp(1.5rem,3.5vw,2.8rem)' }}>${curQ.content}</p>
          `}
          <${VoteDisplay} gs=${gs} players=${players} curQ=${curQ} />
        </div>
      `;
    }

    // Buzzer
    if (isBuzzer) return html`
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-8 py-10">
        ${curQ?.content && html`
          <p className="font-bold text-center mb-8 max-w-4xl" style=${{ fontSize: 'clamp(1.5rem,3.5vw,2.8rem)' }}>
            ${curQ.content}
          </p>
        `}
        <${BuzzerDisplay} gs=${gs} players=${players} />
      </div>
    `;

    // True / False – dedicated big-button display
      const isTrueFalse = ansMode === 'true_false' || curRound?.type === 'true_false';
      if (isTrueFalse) {
      return html`
        <div className="flex flex-col min-h-[100dvh] px-[clamp(24px,4vw,64px)] py-[clamp(24px,3vh,48px)]">
          <div className="flex justify-end mb-2">
            <span className="text-white/40 text-sm font-mono">${answered}/${conn} réponses</span>
          </div>
          ${curQ?.mediaUrl && html`
            <div className="flex justify-center mb-5">
              <${MediaStage} url=${curQ.mediaUrl} maxHeight="24vh" />
            </div>
          `}
          ${curQ?.content && html`
            <p className="font-display font-bold text-center mb-8"
               style=${{ fontSize: 'clamp(1.8rem,3.5vw,3.2rem)', lineHeight: '1.2' }}>
              ${curQ.content}
            </p>
          `}
          <div className="flex justify-center gap-8 mt-4">
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-neon-green/40 bg-neon-green/10 px-12 py-8">
              <span style=${{ fontSize: 'clamp(3rem,7vw,5rem)' }}>✅</span>
              <span className="font-display font-black text-neon-green mt-3" style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>VRAI</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-rose-500/40 bg-rose-500/10 px-12 py-8">
              <span style=${{ fontSize: 'clamp(3rem,7vw,5rem)' }}>❌</span>
              <span className="font-display font-black text-rose-400 mt-3" style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>FAUX</span>
            </div>
          </div>
        </div>
      `;
    }

    // Standard QCM / True-False
    return html`
      <div className="flex flex-col min-h-[100dvh] px-[clamp(24px,4vw,64px)] py-[clamp(24px,3vh,48px)]">

        <!-- Question counter + timer -->
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="text-white/30 font-mono text-sm">
            ${curRound?.title ? html`<span>${curRound.title}</span>` : ''}
            ${curQ ? html`<span> · Q${(gs?.currentQuestionIndex ?? 0)+1}</span>` : ''}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/40 text-sm">${answered}/${conn} réponses</span>
          </div>
        </div>

        <!-- Media -->
        ${curQ?.mediaUrl && html`
          <div className="flex justify-center mb-5">
            <${MediaStage} url=${curQ.mediaUrl} maxHeight="35vh" />
          </div>
        `}

        <!-- Question text -->
        ${curQ?.content && html`
          <p className="font-display font-bold text-center mb-6"
             style=${{ fontSize: 'clamp(1.8rem,3.5vw,3.2rem)', lineHeight: '1.2' }}>
            ${curQ.content}
          </p>
        `}

        <!-- Answer grid -->
        <${AnswerGrid}
          options=${curQ?.options || []}
          revealed=${false}
          correctIdx=${curQ?.correctOptionIndex ?? 0}
        />
      </div>
    `;
  };

  const renderReveal = () => {
    const curQ    = gs?.currentQuestion;
    const revealed= gs?.revealedAnswer;
    const ansMode = gs?.phaseMeta?.answerMode;
    const isTrueFalse = ansMode === 'true_false' || gs?.currentRound?.type === 'true_false';

    if (isTrueFalse) {
      const correct = (revealed?.answer || '').toLowerCase();
      const isVrai  = correct === 'vrai' || correct === 'true';
      return html`
        <div className="flex flex-col min-h-[100dvh] px-[clamp(24px,4vw,64px)] py-[clamp(24px,3vh,48px)] animate-fade-in">
          <div className="flex items-center justify-center gap-4 mb-6">
            <span style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>📋</span>
            <span className="font-display font-black gradient-text-green" style=${{ fontSize: 'clamp(1.8rem,4vw,3.5rem)' }}>La réponse !</span>
          </div>
          ${curQ?.content && html`
            <p className="font-display font-bold text-center mb-6 text-white/70" style=${{ fontSize: 'clamp(1.4rem,2.8vw,2.4rem)' }}>
              ${curQ.content}
            </p>
          `}
          <div className="flex justify-center mt-4">
            <div className=${`flex flex-col items-center justify-center rounded-2xl border-2 p-8 ${isVrai ? 'border-neon-green/60 bg-neon-green/15' : 'border-rose-500/60 bg-rose-500/15'}`}
                 style=${{ minWidth: 'clamp(200px,40vw,500px)' }}>
              <span style=${{ fontSize: 'clamp(5rem,15vw,10rem)' }}>${isVrai ? '✅' : '❌'}</span>
              <span className=${`font-display font-black mt-4 ${isVrai ? 'text-neon-green' : 'text-rose-400'}`}
                    style=${{ fontSize: 'clamp(3rem,8vw,6rem)' }}>
                ${isVrai ? 'VRAI' : 'FAUX'}
              </span>
            </div>
          </div>
          ${curQ?.correctAnswerMediaUrl && html`
            <div className="flex justify-center mt-6">
              <${MediaStage} url=${curQ.correctAnswerMediaUrl} maxHeight="30vh" />
            </div>
          `}
          ${curQ?.correctAnswer && html`
            <p className="text-center mt-4 text-neon-green font-bold"
               style=${{ fontSize: 'clamp(1.1rem,2.5vw,2rem)' }}>
              ${curQ.correctAnswer}
            </p>
          `}
        </div>
      `;
    }

    // Standard QCM / rapidite reveal
    return html`
      <div className="flex flex-col min-h-[100dvh] px-[clamp(24px,4vw,64px)] py-[clamp(24px,3vh,48px)] animate-fade-in">
        <div className="flex items-center justify-center gap-4 mb-6">
          <span style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>📋</span>
          <span className="font-display font-black gradient-text-green" style=${{ fontSize: 'clamp(1.8rem,4vw,3.5rem)' }}>La réponse !</span>
        </div>
        ${curQ?.content && html`
          <p className="font-display font-bold text-center mb-6 text-white/70"
             style=${{ fontSize: 'clamp(1.4rem,2.8vw,2.4rem)', lineHeight: '1.2' }}>
            ${curQ.content}
          </p>
        `}
        ${curQ?.options?.length > 0 && html`
          <${AnswerGrid}
            options=${curQ.options}
            revealed=${true}
            correctIdx=${curQ.correctOptionIndex ?? -1}
          />
        `}
        ${curQ?.correctAnswerMediaUrl && html`
          <div className="flex justify-center mt-6">
            <${MediaStage} url=${curQ.correctAnswerMediaUrl} maxHeight="30vh" />
          </div>
        `}
        ${curQ?.correctAnswer && html`
          <div className="mt-5 text-center rounded-2xl border border-neon-green/40 bg-neon-green/10 px-6 py-4">
            <p className="font-display font-black text-neon-green"
               style=${{ fontSize: 'clamp(1.5rem,4vw,3rem)' }}>
              ${curQ.correctAnswer}
            </p>
          </div>
        `}
      </div>
    `;
  };

  // ── Main return ──────────────────────────────────────────────
  return html`
    <div className="display-fullscreen bg-bg"
         style=${bgUrl ? { backgroundImage:'url(' + bgUrl + ')', backgroundSize:'cover', backgroundPosition:'center' } : {}}>
      ${bgUrl && html`<div className="bg-overlay" />`}
      ${gs?.phaseMeta?.broadcast && html`
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-6 py-3"
             style=${{ background: 'rgba(124,92,255,0.92)', backdropFilter: 'blur(8px)' }}>
          <span className="font-bold text-white text-center" style=${{ fontSize: 'clamp(1rem,2.5vw,1.6rem)' }}>
            📢 ${gs.phaseMeta.broadcast}
          </span>
        </div>
      `}
      <div className="relative z-10 flex flex-col min-h-[100dvh]">
        ${renderContent()}
      </div>
      ${['question','waiting'].includes(phase) &&
        !['burger','video_challenge'].includes(gs?.currentRound?.type) && html`
        <${TimerOverlay} timer=${gs?.phaseMeta?.timer} />
      `}
      <${AllAnsweredBurst} show=${showBurst} />
      <button className="music-mute-btn" onClick=${toggleMute} title=${musicMuted ? 'Activer la musique' : 'Couper la musique'}>
        ${musicMuted ? '🔇' : '🔊'}
      </button>
    </div>
  `;
}