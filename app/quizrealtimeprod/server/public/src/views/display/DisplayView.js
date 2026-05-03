import { useState, useEffect } from 'react';
import { html, resolveMedia, mediaKind, ROUND_TYPES } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, Dots } from '../../components/ui.js';

// ── Display Connect Screen ────────────────────────────────────
function DisplayConnect() {
  const { socket, setDisplaySession, navigate } = useGame();
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
      <div className="w-full max-w-lg rounded-lg app-surface p-6 text-center animate-fade-in sm:p-8">
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
function VoteDisplay({ gs, players }) {
  const mode     = gs?.phaseMeta?.answerMode;
  const voteState= gs?.voteState;
  const proposals= voteState?.proposals || [];
  const revealed = voteState?.revealed  || {};
  const cursor   = voteState?.revealCursor ?? -1;

  if (mode === 'vote_input') {
    const conn    = players.filter(p => p.connected && !p.isBot).length;
    const voted   = Object.keys(gs?.answers?.[gs?.currentQuestion?.id] || {}).length;
    return html`
      <div className="flex flex-col items-center gap-8 py-12 animate-fade-in">
        <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🗳️</div>
        <h2 className="gradient-text-fire font-display font-black text-center"
            style=${{ fontSize: 'clamp(2.5rem,7vw,5rem)' }}>
          Répondez maintenant !
        </h2>
        <div className="flex items-center gap-3">
          <span style=${{ fontSize: 'clamp(1.1rem,2.5vw,1.8rem)', color: 'rgba(255,255,255,.6)' }}>${voted}</span>
          <div className="h-2 rounded-full overflow-hidden" style=${{ width: 'clamp(120px,20vw,280px)', background: 'rgba(255,255,255,.1)' }}>
            <div
              className="h-full bg-gradient-to-r from-accent to-neon-green rounded-full transition-all duration-500"
              style=${{ width: conn > 0 ? (voted/conn*100)+'%' : '0%' }}
            />
          </div>
          <span style=${{ fontSize: 'clamp(1.1rem,2.5vw,1.8rem)', color: 'rgba(255,255,255,.6)' }}>${conn}</span>
        </div>
      </div>
    `;
  }

  // Vote voting – display all options for players to vote on
  if (mode === 'vote_voting') {
    const options = voteState?.options || proposals;
    const votes   = voteState?.votes || {};
    const conn    = players.filter(p => p.connected && !p.isBot).length;
    const totalVotes = Object.keys(votes).length;
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

  // Vote revealing / revealed
  const revealedProposals = proposals.slice(0, cursor + 1);
  return html`
    <div className="flex flex-col gap-5 animate-fade-in">
      <h2 className="gradient-text font-display font-black text-center" style=${{ fontSize: 'clamp(1.8rem,4vw,3rem)' }}>
        Les réponses
      </h2>
      <div className="flex flex-col gap-3">
        ${revealedProposals.map((prop, i) => html`
          <div
            key=${i}
            className="flex items-center justify-between rounded-2xl border px-6 py-4 animate-fade-in"
            style=${{
              background: 'rgba(79,172,254,.12)',
              borderColor: 'rgba(79,172,254,.3)',
            }}
          >
            <span style=${{ fontSize: 'clamp(1.2rem,2.5vw,2rem)', fontWeight: '700' }}>${prop.text}</span>
            <span
              className="font-display font-black text-neon-green"
              style=${{ fontSize: 'clamp(1.5rem,3.5vw,2.5rem)' }}
            >
              ${prop.count}
            </span>
          </div>
        `)}
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

  if (blr?.at) {
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
      <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🎉</div>
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

// ── Main Display view ─────────────────────────────────────────
export default function DisplayView() {
  const { socket, displaySession, setDisplaySession, gameState: gs, players, lbPlayers, lbTeams, navigate, musicMuted, toggleMute } = useGame();

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
                <div key=${p.id || p.playerId} className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl bg-white/8 border border-white/10 animate-fade-in">
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

    if (phase === 'get_ready') return html`
      <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-6 animate-bounce-in">
        <div style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>🎯</div>
        <h1 className="font-display font-black gradient-text" style=${{ fontSize: 'clamp(2.5rem,7vw,6rem)' }}>
          Tenez-vous prêts !
        </h1>
        <${Dots} />
      </div>
    `;

    if (phase === 'question' || phase === 'waiting' || phase === 'manual_scoring') {
      return renderQuestion();
    }

    if (phase === 'answer_reveal') return renderReveal();

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
    const isVote  = ansMode === 'vote_input' || ansMode === 'vote_voting' || ansMode === 'vote_revealing' || ansMode === 'vote_revealed';
    const isBurger= gs?.currentRound?.type === 'burger';
    const isVC    = gs?.currentRound?.type === 'video_challenge';
    const conn    = players.filter(p => p.connected && !p.isBot).length;
    const answered= Object.keys(gs?.answers?.[curQ?.id] || {}).length;
    const curRound= gs?.currentRound;

    // Burger
    if (isBurger) {
      const items = gs?.burgerItems || [];
      const selId = gs?.burgerSelectedPlayerId || gs?.burgerSelectedTeamId;
      const who   = selId ? players.find(p => (p.id === selId || p.playerId === selId)) : null;
      return html`
        <div className="flex flex-col items-center justify-center min-h-[100dvh] gap-8 px-8 animate-fade-in">
          <div style=${{ fontSize: 'clamp(3rem,8vw,6rem)' }}>🍔</div>
          <h1 className="font-display font-black gradient-text-fire text-center"
              style=${{ fontSize: 'clamp(2.5rem,7vw,5rem)' }}>
            Burger de la Mort
          </h1>
          ${who && html`
            <p className="text-white/60 text-center" style=${{ fontSize: 'clamp(1.2rem,3vw,2.2rem)' }}>
              C'est le tour de <strong className="text-amber-400">${who.pseudo}</strong> !
            </p>
          `}
          <div className="flex flex-col gap-3 w-full max-w-2xl">
            ${items.map((item, i) => html`
              <div key=${i} className="flex items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-4">
                <span className="font-mono text-amber-400 font-bold" style=${{ fontSize: 'clamp(1rem,2vw,1.5rem)' }}>${i+1}.</span>
                <span className="font-bold" style=${{ fontSize: 'clamp(1.1rem,2.5vw,2rem)' }}>${item?.text || item}</span>
              </div>
            `)}
          </div>
        </div>
      `;
    }

    // Video Challenge
    if (isVC) {
      const vcPhase = gs?.videoState?.phase;
      const selId   = gs?.videoState?.selectedPlayerId;
      const who     = selId ? players.find(p => (p.id===selId||p.playerId===selId)) : null;
      const score   = gs?.videoState?.score;
      const mediaUrl = vcPhase === 'training_playing' ? curQ?.trainingVideoUrl : (curQ?.videoUrl || curQ?.mediaUrl);
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
          <${MediaStage} url=${mediaUrl} maxHeight="46vh" />
          ${score != null && html`
            <div className="font-display font-black text-neon-green"
                 style=${{ fontSize: 'clamp(5rem,18vw,10rem)' }}>
              ${score}
            </div>
          `}
          ${curQ?.content && html`<p className="text-white/50 text-center" style=${{ fontSize: 'clamp(1rem,2vw,1.5rem)', maxWidth:'70vw' }}>${curQ.content}</p>`}
        </div>
      `;
    }

    // Vote
    if (isVote) return html`
      <div className="flex flex-col items-center justify-center min-h-[100dvh] px-8 py-10">
        ${curQ?.content && html`
          <p className="font-bold text-center mb-8" style=${{ fontSize: 'clamp(1.5rem,3.5vw,2.8rem)' }}>${curQ.content}</p>
        `}
        <${VoteDisplay} gs=${gs} players=${players} />
      </div>
    `;

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
      const tfVotes = gs?.trueFalseVotes || {};
      const vraiCount = Array.isArray(tfVotes.yes) ? tfVotes.yes.length : (tfVotes['vrai'] || tfVotes['true'] || 0);
      const fauxCount = Array.isArray(tfVotes.no) ? tfVotes.no.length : (tfVotes['faux'] || tfVotes['false'] || 0);
      const total     = vraiCount + fauxCount;
      return html`
        <div className="flex flex-col min-h-[100dvh] px-[clamp(24px,4vw,64px)] py-[clamp(24px,3vh,48px)]">
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
          <div className="grid grid-cols-2 gap-5 flex-1 max-h-[42vh]">
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-neon-green/40 bg-neon-green/10 p-5" style=${{ minHeight:'18vh' }}>
              <span style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>✅</span>
              <span className="font-display font-black text-neon-green mt-4" style=${{ fontSize: 'clamp(2.5rem,6vw,5rem)' }}>VRAI</span>
              ${total > 0 && html`
                <span className="text-neon-green/60 mt-2" style=${{ fontSize: 'clamp(1rem,2.5vw,1.8rem)' }}>
                  ${vraiCount} vote(s) · ${total > 0 ? Math.round(vraiCount/total*100) : 0}%
                </span>
              `}
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-rose-500/40 bg-rose-500/10 p-5" style=${{ minHeight:'18vh' }}>
              <span style=${{ fontSize: 'clamp(4rem,10vw,7rem)' }}>❌</span>
              <span className="font-display font-black text-rose-400 mt-4" style=${{ fontSize: 'clamp(2.5rem,6vw,5rem)' }}>FAUX</span>
              ${total > 0 && html`
                <span className="text-rose-400/60 mt-2" style=${{ fontSize: 'clamp(1rem,2.5vw,1.8rem)' }}>
                  ${fauxCount} vote(s) · ${total > 0 ? Math.round(fauxCount/total*100) : 0}%
                </span>
              `}
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
            ${timer?.remainingSec > 0 && html`
              <span
                className="font-mono font-black rounded-full w-12 h-12 flex items-center justify-center border-2"
                style=${{
                  fontSize: '1.2rem',
                  borderColor: timer.remainingSec <= 5 ? '#ff4e6a' : '#2dd4bf',
                  color:       timer.remainingSec <= 5 ? '#ff4e6a' : '#2dd4bf',
                  background:  timer.remainingSec <= 5 ? 'rgba(255,78,106,.1)' : 'rgba(56,239,125,.1)',
                }}
              >
                ${timer.remainingSec}
              </span>
            `}
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
          <div className="grid grid-cols-2 gap-6">
            <div className=${'flex flex-col items-center justify-center rounded-3xl border-2 p-8 transition-all duration-500' + (isVrai ? ' border-neon-green/80 bg-neon-green/20 scale-105' : ' border-white/10 bg-white/3 opacity-40')} style=${{ minHeight:'25vh' }}>
              <span style=${{ fontSize: 'clamp(3rem,8vw,6rem)' }}>✅</span>
              <span className=${'font-display font-black mt-3' + (isVrai ? ' text-neon-green' : ' text-white/30')} style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>VRAI</span>
              ${isVrai && html`<span className="text-neon-green text-2xl mt-2">✓</span>`}
            </div>
            <div className=${'flex flex-col items-center justify-center rounded-3xl border-2 p-8 transition-all duration-500' + (!isVrai ? ' border-neon-green/80 bg-neon-green/20 scale-105' : ' border-white/10 bg-white/3 opacity-40')} style=${{ minHeight:'25vh' }}>
              <span style=${{ fontSize: 'clamp(3rem,8vw,6rem)' }}>❌</span>
              <span className=${'font-display font-black mt-3' + (!isVrai ? ' text-neon-green' : ' text-white/30')} style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>FAUX</span>
              ${!isVrai && html`<span className="text-neon-green text-2xl mt-2">✓</span>`}
            </div>
          </div>
        </div>
      `;
    }
    return html`
      <div className="flex flex-col min-h-[100dvh] px-[clamp(24px,4vw,64px)] py-[clamp(24px,3vh,48px)] animate-fade-in">

        <!-- Answer reveal banner -->
        <div className="flex items-center justify-center gap-4 mb-6">
          <span style=${{ fontSize: 'clamp(2rem,5vw,4rem)' }}>📋</span>
          <span className="font-display font-black gradient-text-green"
                style=${{ fontSize: 'clamp(1.8rem,4vw,3.5rem)' }}>
            La réponse !
          </span>
        </div>

        <!-- Correct answer highlight -->
        ${revealed?.answer && html`
          <div className="flex justify-center mb-6">
            <div className="rounded-2xl border-2 border-neon-green/60 bg-neon-green/10 px-8 py-4">
              <span className="font-display font-black text-neon-green"
                    style=${{ fontSize: 'clamp(1.5rem,3.5vw,3rem)' }}>
                ✓ ${revealed.answer}
              </span>
            </div>
          </div>
        `}

        <!-- Question text -->
        ${curQ?.content && html`
          <p className="font-display font-bold text-center mb-5 text-white/70"
             style=${{ fontSize: 'clamp(1.4rem,2.8vw,2.4rem)' }}>
            ${curQ.content}
          </p>
        `}

        <!-- Options with correct highlighted -->
        <${AnswerGrid}
          options=${curQ?.options || []}
          revealed=${true}
          correctIdx=${curQ?.correctOptionIndex ?? revealed?.optionIndex ?? 0}
        />

        <!-- Reveal media -->
        ${revealed?.mediaUrl && html`
          <div className="flex justify-center mt-6">
            <img
              src=${resolveMedia(revealed.mediaUrl)}
              className="max-w-full rounded-2xl object-contain"
              style=${{ maxHeight: '30vh' }}
              alt="reveal media"
            />
          </div>
        `}

        <!-- Reveal audio -->
        ${revealed?.revealAudio && html`<audio id="reveal-audio-player" src=${resolveMedia(revealed.revealAudio)} style=${{display:'none'}} />`}

      </div>
    `;
  };

  return html`
    <div
      className="display-fullscreen bg-bg"
      style=${{
        ...(bgUrl ? { backgroundImage:`url('${bgUrl}')`, backgroundSize:'cover', backgroundPosition:'center' } : {}),
      }}
    >
      ${bgUrl && html`<div className="bg-overlay" />`}

      <!-- Session banner (top LEFT) -->
      <div className="absolute top-3 left-4 z-20 flex items-center gap-2">
        <span className="font-mono text-white/30 text-xs">Session </span>
        <span className="font-mono font-bold text-accent/80 tracking-widest text-sm">${sc}</span>
        <button onClick=${toggleMute} className="ml-2 text-white/30 hover:text-white text-base">${musicMuted ? '🔇' : '🔊'}</button>
      </div>

      <!-- Main content -->
      <div className="relative z-10">
        ${renderContent()}
      </div>

    </div>
  `;
}

