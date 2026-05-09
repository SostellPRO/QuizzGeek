import { useState, useCallback, useEffect, useRef } from 'react';
import { html, resolveMedia } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, Dots, SessionBanner } from '../../components/ui.js';

const ROUND_ICONS = { qcm:'🔘', rapidite:'⚡', speed:'⚡', true_false:'✅', burger:'🍔', vote:'🗳️', video_challenge:'🎬' };
const ROUND_LABELS= { qcm:'QCM', rapidite:'Rapidité', speed:'Rapidité', true_false:'Vrai / Faux', burger:'Burger', vote:'Vote', video_challenge:'Challenge Vidéo' };
const OPTION_LABELS = ['A','B','C','D','E','F'];

// Color palette matching the TV display screen
const OPT_COLORS   = ['#b24bff','#38ef7d','#4facfe','#f7971e','#ff4e6a','#a78bfa'];
const OPT_BGCOLORS = [
  'rgba(178,75,255,.15)',
  'rgba(56,239,125,.15)',
  'rgba(79,172,254,.15)',
  'rgba(247,151,30,.15)',
  'rgba(255,78,106,.15)',
  'rgba(167,139,250,.15)',
];

export default function PlayerGame() {
  const { socket, gameState: gs, players, playerSession: s, setPlayerSession, navigate } = useGame();
  const [alert, setAlert]       = useState(null);
  const [locked, setLocked]     = useState(false);
  const [voteText, setVoteText] = useState('');
  const [buzzerCountdown, setBuzzerCountdown] = useState(0);
  const cdTimerRef = useRef(null);

  // ── Local timer countdown ────────────────────────────────────
  // Client-side ticking so the gradient updates even if socket is slow.
  // startedAt + totalSec from the server = source of truth;
  // local setInterval ticks every 200 ms for smooth display.
  const [localTimerSec, setLocalTimerSec] = useState(0);
  const localTimerRef = useRef(null);   // interval handle
  const timerMetaRef  = useRef(null);   // { startedAt:ms, totalSec }

  useEffect(() => {
    const t = gs?.phaseMeta?.timer;
    if (!t || t.totalSec <= 0) {
      setLocalTimerSec(0);
      timerMetaRef.current = null;
      if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
      return;
    }
    // Parse server's startedAt to ms; fall back to "now − (total−remaining)" if missing.
    const startMs = t.startedAt
      ? new Date(t.startedAt).getTime()
      : Date.now() - (t.totalSec - t.remainingSec) * 1000;
    timerMetaRef.current = { startMs, totalSec: t.totalSec };

    const tick = () => {
      const meta = timerMetaRef.current;
      if (!meta) return;
      const elapsed = (Date.now() - meta.startMs) / 1000;
      const rem = Math.max(0, meta.totalSec - elapsed);
      setLocalTimerSec(rem);
      if (rem <= 0 && localTimerRef.current) {
        clearInterval(localTimerRef.current);
        localTimerRef.current = null;
      }
    };

    tick(); // immediate first tick
    if (localTimerRef.current) clearInterval(localTimerRef.current);
    localTimerRef.current = setInterval(tick, 200);
    return () => {
      if (localTimerRef.current) { clearInterval(localTimerRef.current); localTimerRef.current = null; }
    };
  }, [gs?.phaseMeta?.timer?.startedAt, gs?.phaseMeta?.timer?.totalSec]); // eslint-disable-line

  const myPlayer = players.find(p => p.id === s?.playerId || p.playerId === s?.playerId);

  // Reset answer state on each new question (two guards in case one misses)
  useEffect(() => {
    setLocked(false);
    setVoteText('');
  }, [gs?.currentQuestion?.id]); // eslint-disable-line

  // Backup: also reset when the phase enters a new question cycle
  useEffect(() => {
    const s = gs?.status;
    if (s === 'question' || s === 'round_intro') {
      setLocked(false);
      setVoteText('');
    }
  }, [gs?.status]); // eslint-disable-line

  // ── Buzzer cooldown countdown ─────────────────────────────────
  const cooldownExpiry = gs?.buzzerCooldowns?.[s?.playerId] || 0;
  useEffect(() => {
    if (cdTimerRef.current) { clearInterval(cdTimerRef.current); cdTimerRef.current = null; }
    if (cooldownExpiry <= Date.now()) { setBuzzerCountdown(0); return; }
    const tick = () => {
      const rem = Math.ceil((cooldownExpiry - Date.now()) / 1000);
      if (rem <= 0) {
        setBuzzerCountdown(0);
        if (cdTimerRef.current) { clearInterval(cdTimerRef.current); cdTimerRef.current = null; }
      } else {
        setBuzzerCountdown(rem);
      }
    };
    tick();
    cdTimerRef.current = setInterval(tick, 300);
    return () => { if (cdTimerRef.current) clearInterval(cdTimerRef.current); };
  }, [cooldownExpiry]); // eslint-disable-line

  // ── Haptic feedback helper (no-op on desktop/unsupported) ────
  const vibrate = (pattern = 50) => navigator.vibrate?.(pattern);

  const phase    = gs?.status || 'lobby';
  const roundType= gs?.currentRound?.type || 'qcm';
  const rtIcon   = ROUND_ICONS[roundType] || '🎯';

  const sendAnswer = useCallback((answer) => {
    if (!socket || !s) return;
    vibrate(50);
    setLocked(true);
    socket.emit('player:answer', { sessionCode: s.sessionCode, playerId: s.playerId, answer }, (res) => {
      if (!res?.ok) {
        setAlert({ type: 'error', message: res?.error || 'Erreur.' });
        setLocked(false);
      }
    });
  }, [socket, s]); // eslint-disable-line

  const sendBuzzer = useCallback(() => {
    if (!socket || !s) return;
    vibrate([30, 50, 80]); // triple pulse pour le buzz
    socket.emit('player:buzzer', { sessionCode: s.sessionCode, playerId: s.playerId }, (res) => {
      if (!res?.ok) setAlert({ type: 'error', message: res?.error || 'Buzzer refusé.' });
    });
  }, [socket, s]); // eslint-disable-line

  // vote_input: player submits free-text answer via player:answer
  const sendVoteText = useCallback(() => {
    const txt = voteText.trim();
    if (!txt || !socket || !s) return;
    vibrate(50);
    setLocked(true);
    socket.emit('player:answer', { sessionCode: s.sessionCode, playerId: s.playerId, answer: txt }, (res) => {
      if (res?.ok) { setVoteText(''); }
      else { setAlert({ type: 'error', message: res?.error || 'Erreur.' }); setLocked(false); }
    });
  }, [socket, s, voteText]); // eslint-disable-line

  // vote_voting: player chooses from displayed options by index via player:vote
  const sendVoteChoice = useCallback((index) => {
    if (!socket || !s || locked) return;
    vibrate(50);
    setLocked(true);
    socket.emit('player:vote', { sessionCode: s.sessionCode, playerId: s.playerId, index }, (res) => {
      if (!res?.ok) { setAlert({ type: 'error', message: res?.error || 'Erreur.' }); setLocked(false); }
    });
  }, [socket, s, locked]); // eslint-disable-line

  const disconnect = () => {
    setPlayerSession(null);
    localStorage.removeItem('quiz_player_session');
    navigate('home');
  };

  // ── Phase rendering ──────────────────────────────────────────
  const isPaused = gs?.phaseMeta?.paused === true;

  const renderPhase = () => {
    if (isPaused) return html`
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-6xl">⏸️</div>
        <h2 className="text-2xl font-bold">Pause</h2>
        <p className="text-white/40 text-center">Le maître de jeu a mis la partie en pause…</p>
        <${Dots} />
      </div>
    `;

    if (phase === 'lobby') {
      const connPlayers = players.filter(p => p.connected);
      return html`
        <div className="rounded-2xl bg-bg-card border border-white/8 p-6 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-xl font-bold mb-2">Salle d'attente</h2>
          <p className="text-white/45 text-sm mb-5">En attente du maître de jeu…</p>
          <div className="text-xs text-white/30 uppercase tracking-widest font-semibold mb-3">
            ${connPlayers.length} joueur(s) connecté(s)
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            ${connPlayers.map(p => html`
              <div key=${p.id || p.playerId} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/5 border border-white/8 min-w-[60px]">
                <span className="text-2xl">${p.avatar || '🎮'}</span>
                <span className="text-xs font-bold text-white/80 max-w-[64px] truncate">${p.pseudo || '?'}</span>
              </div>
            `)}
          </div>
        </div>
      `;
    }

    if (phase === 'training_video') return html`
      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-8 text-center">
        <div className="text-5xl mb-4">🏋️</div>
        <h2 className="text-2xl font-bold text-amber-400">Vidéo d'entraînement</h2>
        <p className="text-white/45 mt-3">Regardez l'écran TV !</p>
        <${Dots} />
      </div>
    `;

    if (phase === 'round_intro') {
      const round = gs?.currentRound;
      return html`
        <div className="flex flex-col items-center gap-5 py-8 text-center animate-fade-in">
          <div className="text-6xl">${rtIcon}</div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/15 border border-accent/30 text-sm font-semibold text-accent">
            ${rtIcon} ${ROUND_LABELS[round?.type] || round?.type}
          </div>
          <h2 className="text-2xl font-bold">${round?.title || 'Nouvelle manche'}</h2>
          ${round?.shortRules && html`<p className="text-white/45 text-sm">${round.shortRules}</p>`}
          <${Dots} />
        </div>
      `;
    }

    if (phase === 'question' || phase === 'waiting') {
      return renderQuestion();
    }

    if (phase === 'answer_reveal') return renderReveal();
    if (phase === 'manual_scoring') {
      // For buzzer rounds, keep showing buzzer state so players know who buzzed
      const am = gs?.phaseMeta?.answerMode;
      if (am === 'buzzer' || roundType === 'rapidite' || roundType === 'speed') return renderQuestion();
      return renderManualScoring();
    }
    if (phase === 'round_end' || phase === 'results') return renderRoundEnd();
    if (phase === 'end') return renderEnd();

    return html`<div className="text-center py-10 text-white/40"><${Dots} /></div>`;
  };

  const renderQuestion = () => {
    const currentQ    = gs?.currentQuestion;
    const answerMode  = gs?.phaseMeta?.answerMode;
    const timer       = gs?.phaseMeta?.timer;

    // Detect question type — use answerMode first, fall back to round/question type
    const isBuzzer    = answerMode === 'buzzer' || roundType === 'rapidite' || roundType === 'speed';
    const isTrueFalse = answerMode === 'true_false' || roundType === 'true_false';
    const isBurger    = answerMode === 'burger' || gs?.currentRound?.type === 'burger';
    const isVoteQuestion = answerMode === 'vote_question';
    const isVoteInput = answerMode === 'vote_input';
    const isVoteVoting= answerMode === 'vote_voting';
    const isVoteReveal= ['vote_proposal_reveal','vote_revealed','vote_revealing'].includes(answerMode);
    const isVC        = gs?.currentRound?.type === 'video_challenge';

    const myAnswers       = gs?.answers?.[currentQ?.id] || {};
    const alreadyAnswered = !!myAnswers[s?.playerId];

    // ── Video Challenge ──────────────────────────────────────────
    if (isVC) {
      const selId = gs?.videoState?.selectedPlayerId;
      const selTeam = gs?.videoState?.selectedTeamId;
      const selectedName = gs?.videoState?.selectedPseudo || '';
      const isMe  = selId === s?.playerId || (selTeam && s?.teamId === selTeam);

      if (!selId && !selTeam) return html`
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/25 p-6 text-center">
          <div className="text-4xl mb-3">🎬</div>
          <h2 className="text-xl font-bold text-rose-400">Challenge Vidéo</h2>
          <p className="text-white/50 text-sm mt-2">Le maître de jeu choisit un joueur…</p>
          <${Dots} />
        </div>
      `;

      if (isMe) return html`
        <div className="flex flex-col items-center gap-4 py-8 text-center animate-bounce-in">
          <div className="text-6xl animate-float">⭐</div>
          <h2 className="text-2xl font-display font-black text-neon-green">C'est votre défi !</h2>
          <p className="text-white/50 text-sm">Regardez l'écran TV et réalisez le défi !</p>
        </div>
      `;

      const who = players.find(p => p.id === selId || p.playerId === selId);
      return html`
        <div className="rounded-2xl bg-bg-card border border-white/8 p-6 text-center">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-white/60 mb-1"><strong className="text-white">${who?.pseudo || selectedName || 'Un candidat'}</strong> est interroge.</p>
          <p className="text-white/40 text-sm">Regardez l'écran TV !</p>
          <${Dots} />
        </div>
      `;
    }

    // ── Burger de la Mort ────────────────────────────────────────
    if (isBurger) {
      const sel     = gs?.burgerSelectedPlayerId;
      const selTeam = gs?.burgerSelectedTeamId;
      const isMe    = sel === s?.playerId || (selTeam && s?.teamId === selTeam);

      if (!sel && !selTeam) return html`
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-6 text-center">
          <div className="text-4xl mb-3">🍔</div>
          <h2 className="text-xl font-bold text-amber-400">Burger de la Mort</h2>
          <p className="text-white/50 text-sm mt-2">Le maître de jeu choisit le joueur…</p>
          <${Dots} />
        </div>
      `;

      if (!isMe) {
        const selPlayer = players.find(p => p.id === sel || p.playerId === sel);
        return html`
          <div className="rounded-2xl bg-bg-card border border-white/8 p-6 text-center">
            <div className="text-4xl mb-3">🍔</div>
            <p className="text-white/50"><strong className="text-amber-400">${selPlayer?.pseudo || gs?.burgerSelectedPseudo || 'Un candidat'}</strong> est interroge.</p>
            <p className="text-white/30 text-sm mt-2">Regardez l'écran TV !</p>
            <${Dots} />
          </div>
        `;
      }

      if (isMe) return html`
        <div className="flex flex-col items-center gap-4 py-8 text-center animate-bounce-in">
          <div className="text-6xl">🍔</div>
          <h2 className="text-2xl font-display font-black text-amber-400">L'admin vous interroge !</h2>
          <p className="text-white/50 text-sm">Regardez l'ecran TV et repondez oralement quand il vous le demande.</p>
        </div>
      `;

      const items = currentQ?.items || gs?.burgerItems || [];
      return html`
        <div className="flex flex-col gap-4">
          <div className="text-center">
            <div className="text-4xl mb-2">🍔</div>
            <h2 className="text-xl font-bold text-amber-400">C'est votre tour !</h2>
            <p className="text-white/40 text-sm mt-1">Mémorisez les ingrédients dans l'ordre !</p>
          </div>
          <div className="flex flex-col gap-2">
            ${items.map((item, i) => html`
              <div key=${i} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="font-mono text-amber-400 font-bold text-sm w-6">${i+1}.</span>
                <span className="text-white font-semibold">${item?.text || item}</span>
              </div>
            `)}
          </div>
        </div>
      `;
    }

    // ── Buzzer ───────────────────────────────────────────────────
    if (isBuzzer) {
      const buzzerState = gs?.buzzerState;
      const firstId     = buzzerState?.firstPlayerId;
      const iFirst      = firstId === s?.playerId;
      const isCooldown  = cooldownExpiry > Date.now();
      const buzzerLocked= gs?.phaseMeta?.playerScreenLocked;

      if (iFirst) return html`
        <div className="flex flex-col items-center gap-4 py-6 text-center animate-bounce-in">
          <div className="text-6xl animate-bounce">❗</div>
          <h2 className="text-2xl font-display font-black text-neon-green">Vous avez buzzé en premier !</h2>
          <p className="text-white/50 text-sm">Le maître de jeu va valider…</p>
        </div>
      `;

      if (firstId && !iFirst) {
        const who = players.find(p => p.id === firstId || p.playerId === firstId);
        return html`
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/25 p-6 text-center">
            <div className="text-4xl mb-3">❌</div>
            <p className="text-white/60"><strong className="text-rose-400">${who?.pseudo || 'Quelqu\'un'}</strong> a buzzé en premier.</p>
            <p className="text-white/30 text-sm mt-1">Attendez la prochaine opportunité…</p>
          </div>
        `;
      }

      // Cooldown après mauvaise réponse — afficher le décompte
      if (isCooldown) return html`
        <div className="flex flex-col items-center gap-6 py-8 animate-fade-in">
          <div className="text-5xl">❌</div>
          <h2 className="text-xl font-display font-black text-rose-400">Mauvaise réponse !</h2>
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-28 h-28 rounded-full border-4 border-rose-500/50 bg-rose-500/10 flex items-center justify-center font-display font-black text-rose-300"
              style=${{ fontSize: '3rem' }}
            >
              ${buzzerCountdown}
            </div>
            <p className="text-white/40 text-sm">secondes avant de rebuzzer</p>
          </div>
        </div>
      `;

      // Gradient dynamique selon le temps restant (via compteur local côté client)
      const tmr      = gs?.phaseMeta?.timer;
      const totalSec = tmr?.totalSec || 0;
      // localTimerSec ticks at 200 ms regardless of socket latency
      const remSec   = totalSec > 0 ? localTimerSec : 0;
      const ratio    = totalSec > 0 ? remSec / totalSec : 1;
      const urgent5  = remSec > 0 && remSec <= 5;

      const bzGrad = !totalSec || ratio > 0.5
        ? 'linear-gradient(135deg, #10b981, #059669)'   // vert  (>50 %)
        : ratio > 0.25
        ? 'linear-gradient(135deg, #fbbf24, #d97706)'   // jaune (25–50 %)
        : remSec > 5
        ? 'linear-gradient(135deg, #f97316, #dc2626)'   // orange (6–25 %)
        : 'linear-gradient(135deg, #ef4444, #991b1b)';  // rouge (≤5 s)

      const bzBorder = !totalSec || ratio > 0.5 ? '#10b981'
        : ratio > 0.25 ? '#f59e0b'
        : remSec > 5 ? '#f97316'
        : '#ef4444';

      return html`
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="text-white/60 text-sm uppercase tracking-widest font-semibold">Buzzer</div>
          ${currentQ?.content && html`<p className="text-center text-base font-medium text-white/80 px-2">${currentQ.content}</p>`}
          <button
            onClick=${sendBuzzer}
            disabled=${!!buzzerLocked}
            className=${`w-48 h-48 rounded-full font-display font-black text-2xl text-white border-4 active:scale-90 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center ${urgent5 ? 'animate-pulse' : 'ring-pulse'}`}
            style=${{
              background: bzGrad,
              borderColor: bzBorder,
              boxShadow: `0 0 32px ${bzBorder}55, 0 0 8px ${bzBorder}33`,
            }}
          >
            🔔 BUZZ !
          </button>
          ${totalSec > 0 && remSec > 0 && html`
            <div className="text-xs font-mono font-bold" style=${{ color: bzBorder }}>
              ${Math.ceil(remSec)}s
            </div>
          `}
        </div>
      `;
    }

    // ── Vrai / Faux ──────────────────────────────────────────────
    if (isTrueFalse) {
      if (locked || alreadyAnswered) return html`
        <div className="text-center py-6">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-neon-green">Réponse envoyée !</h2>
          <p className="text-white/40 text-sm mt-2">En attente des autres joueurs…</p>
          <${Dots} />
        </div>
      `;
      return html`
        <div className="flex flex-col gap-4">
          ${currentQ?.content && html`
            <div className="rounded-xl bg-bg-input border border-white/8 p-4 text-center">
              <p className="text-base font-semibold">${currentQ.content}</p>
            </div>
          `}
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick=${() => sendAnswer('vrai')}
              className="flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 border-neon-green/40 bg-neon-green/8 font-display font-black text-xl text-neon-green active:scale-95 transition-all hover:bg-neon-green/15"
            >
              <span className="text-4xl">✅</span>
              VRAI
            </button>
            <button
              onClick=${() => sendAnswer('faux')}
              className="flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 border-rose-500/40 bg-rose-500/8 font-display font-black text-xl text-rose-400 active:scale-95 transition-all hover:bg-rose-500/15"
            >
              <span className="text-4xl">❌</span>
              FAUX
            </button>
          </div>
        </div>
      `;
    }

    // ── Vote : question affichée, joueurs en standby ────────────
    if (isVoteQuestion) return html`
      <div className="rounded-2xl bg-blue-500/10 border border-blue-500/25 p-6 text-center">
        <div className="text-5xl mb-4">🗳️</div>
        <h2 className="text-xl font-bold text-blue-400">Use Your Words</h2>
        <p className="text-white/50 text-sm mt-2">Regardez l'écran TV…</p>
        <${Dots} />
      </div>
    `;

    // ── Vote : saisie libre ──────────────────────────────────────
    if (isVoteInput) {
      if (locked) return html`
        <div className="text-center py-6">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-neon-green">Réponse envoyée !</h2>
          <p className="text-white/40 text-sm mt-2">En attente du vote…</p>
          <${Dots} />
        </div>
      `;
      return html`
        <div className="flex flex-col gap-4">
          ${currentQ?.content && html`<p className="text-center text-base font-bold">${currentQ.content}</p>`}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white/60">Votre réponse</label>
            <textarea
              value=${voteText}
              onInput=${e => setVoteText(e.target.value)}
              placeholder="Écrivez votre réponse…"
              rows="3"
              className="bg-bg-input border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-white/30 focus:border-accent/60 outline-none transition-colors resize-none"
            />
          </div>
          <${Btn} variant="primary" wide onClick=${sendVoteText} disabled=${!voteText.trim()}>
            📤 Envoyer ma réponse
          <//>
        </div>
      `;
    }

    // ── Vote : choix parmi les propositions ──────────────────────
    if (isVoteVoting) {
      const options = gs?.voteState?.options || [];
      if (locked) return html`
        <div className="text-center py-6">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-neon-green">Vote envoyé !</h2>
          <${Dots} />
        </div>
      `;
      return html`
        <div className="flex flex-col gap-3">
          ${currentQ?.content && html`<p className="text-center font-bold text-base">${currentQ.content}</p>`}
          <p className="text-xs text-white/50 text-center uppercase tracking-wider mb-1">Votez pour une réponse</p>
          <div className="flex flex-col gap-2">
            ${options.map((opt, i) => {
              const isOwn   = opt.playerId && opt.playerId === s?.playerId;
              const color   = isOwn ? 'rgba(255,255,255,.2)' : OPT_COLORS[i % OPT_COLORS.length];
              const bgColor = isOwn ? 'rgba(255,255,255,.04)' : OPT_BGCOLORS[i % OPT_BGCOLORS.length];
              return html`
                <button
                  key=${i}
                  onClick=${() => !isOwn && sendVoteChoice(i)}
                  disabled=${isOwn}
                  style=${{ borderColor: color, background: bgColor, opacity: isOwn ? 0.4 : 1, cursor: isOwn ? 'not-allowed' : 'pointer' }}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 font-semibold text-left transition-all ${isOwn ? '' : 'active:scale-95 hover:brightness-125'}"
                  title=${isOwn ? 'Votre réponse — vous ne pouvez pas voter pour vous-même' : ''}
                >
                  <span
                    style=${{ color, borderColor: color, background: `${color}22` }}
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-black text-sm border-2"
                  >
                    ${isOwn ? '✍' : i+1}
                  </span>
                  <span className=${isOwn ? 'text-white/40' : 'text-white'}>${opt.text || opt}</span>
                  ${isOwn && html`<span className="ml-auto text-xs text-white/30 italic">votre réponse</span>`}
                </button>
              `;
            })}
          </div>
        </div>
      `;
    }

    // ── Vote révélation / résultats – juste attendre ─────────────
    if (isVoteReveal) return html`
      <div className="rounded-2xl bg-blue-500/10 border border-blue-500/25 p-6 text-center">
        <div className="text-4xl mb-3">🗳️</div>
        <h2 className="text-xl font-bold text-blue-400">Révélation des votes</h2>
        <p className="text-white/40 text-sm mt-2">Regardez l'écran TV !</p>
        <${Dots} />
      </div>
    `;

    // ── QCM options ──────────────────────────────────────────────
    if (currentQ?.options?.length) {
      if (locked || alreadyAnswered) return html`
        <div className="text-center py-6">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-neon-green">Réponse envoyée !</h2>
          <p className="text-white/40 text-sm mt-2">En attente des autres joueurs…</p>
          <${Dots} />
        </div>
      `;

      return html`
        <div className="flex flex-col gap-3">
          ${currentQ?.content && html`
            <div className="rounded-xl bg-bg-input border border-white/8 p-4 text-center">
              <p className="text-base font-semibold">${currentQ.content}</p>
            </div>
          `}
          ${localTimerSec > 0 && gs?.phaseMeta?.timer?.totalSec > 0 && (() => {
            const tTotal  = gs.phaseMeta.timer.totalSec;
            const tRatio  = localTimerSec / tTotal;
            const tColor  = localTimerSec <= 5 ? 'text-rose-400'
              : tRatio <= 0.25 ? 'text-orange-400'
              : tRatio <= 0.5  ? 'text-yellow-400'
              : 'text-neon-green';
            return html`
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-white/40">Temps restant</span>
                <span className=${`font-mono font-bold ${tColor}`}>
                  ${Math.ceil(localTimerSec)}s
                </span>
              </div>
            `;
          })()}
          <div className="grid grid-cols-1 gap-3">
            ${currentQ.options.map((opt, i) => {
              const color   = OPT_COLORS[i % OPT_COLORS.length];
              const bgColor = OPT_BGCOLORS[i % OPT_BGCOLORS.length];
              return html`
                <button
                  key=${opt.id || i}
                  onClick=${() => sendAnswer(opt.text)}
                  disabled=${locked}
                  style=${{ borderColor: color, background: bgColor }}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 font-semibold text-left transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-125"
                >
                  <span
                    style=${{ color, borderColor: color, background: `${color}22` }}
                    className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-black text-lg border-2"
                  >
                    ${OPTION_LABELS[i]}
                  </span>
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-white text-base">${opt.text}</span>
                    ${opt.mediaUrl && html`<img src=${resolveMedia(opt.mediaUrl)} alt="" className="max-h-20 rounded-lg object-contain mt-1" />`}
                  </div>
                </button>
              `;
            })}
          </div>
        </div>
      `;
    }

    // ── Réponse libre ────────────────────────────────────────────
    return html`
      <div className="flex flex-col gap-3">
        ${currentQ?.content && html`<p className="text-center font-bold text-lg">${currentQ.content}</p>`}
        <input
          type="text"
          value=${voteText}
          onInput=${e => setVoteText(e.target.value)}
          placeholder="Votre réponse…"
          className="bg-bg-input border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-white/30 focus:border-accent/60 outline-none transition-colors min-h-[48px]"
          onKeyDown=${e => e.key === 'Enter' && !locked && sendAnswer(voteText.trim())}
          disabled=${locked}
        />
        <${Btn} variant="primary" wide onClick=${() => sendAnswer(voteText.trim())} disabled=${!voteText.trim() || locked}>
          Envoyer
        <//>
      </div>
    `;
  };

  const renderReveal = () => {
    const answerMode = gs?.phaseMeta?.answerMode;
    const isTFReveal = answerMode === 'true_false' || roundType === 'true_false';

    // Vrai / Faux : afficher la réponse correcte en couleur
    if (isTFReveal) {
      const revealed = gs?.revealedAnswer;
      const correct  = (revealed?.answer || '').toLowerCase();
      const isVrai   = correct === 'vrai' || correct === 'true';
      return html`
        <div className="flex flex-col items-center gap-5 py-6 text-center animate-fade-in">
          <div className="text-5xl">${isVrai ? '✅' : '❌'}</div>
          <div
            className=${`rounded-2xl border-2 px-10 py-6 font-display font-black ${isVrai ? 'border-neon-green/50 bg-neon-green/10 text-neon-green' : 'border-rose-500/50 bg-rose-500/10 text-rose-400'}`}
            style=${{ fontSize: 'clamp(2.5rem,8vw,3.5rem)' }}
          >
            ${isVrai ? 'VRAI' : 'FAUX'}
          </div>
          <p className="text-white/35 text-sm">Regardez l'écran TV !</p>
          <${Dots} />
        </div>
      `;
    }

    // Toutes les autres manches : ne pas afficher la réponse — économie de bande passante
    return html`
      <div className="flex flex-col items-center gap-4 py-8 text-center animate-fade-in">
        <div className="text-5xl">📋</div>
        <h2 className="text-xl font-bold">Réponse révélée</h2>
        <p className="text-white/45 text-sm">Regardez l'écran TV pour voir la correction !</p>
        <${Dots} />
      </div>
    `;
  };

  const renderManualScoring = () => html`
    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-6 text-center">
      <div className="text-4xl mb-3">⚖️</div>
      <h2 className="text-xl font-bold text-amber-400">Arbitrage en cours</h2>
      <p className="text-white/45 text-sm mt-2">Le maître de jeu évalue les réponses…</p>
      <${Dots} />
    </div>
  `;

  const renderRoundEnd = () => {
    const roundScore = myPlayer?.scoreRound ?? myPlayer?.scoreTotal ?? 0;
    return html`
      <div className="flex flex-col items-center gap-4 py-6 text-center animate-bounce-in">
        <div className="text-5xl">🏁</div>
        <h2 className="text-2xl font-display font-black">Fin de la manche</h2>
        <div className="rounded-2xl bg-accent/10 border border-accent/30 px-8 py-4">
          <div className="text-4xl font-display font-black gradient-text">${roundScore}</div>
          <div className="text-xs text-white/40 mt-1 uppercase tracking-widest">points</div>
        </div>
        <${Dots} />
      </div>
    `;
  };

  const renderEnd = () => {
    const total = myPlayer?.scoreTotal ?? 0;
    const lb = gs?.leaderboardPlayers || [];
    const myRank = (() => {
      const pos = lb.findIndex(p => p.playerId === s?.playerId || p.id === s?.playerId);
      return pos >= 0 ? pos + 1 : '?';
    })();
    return html`
      <div className="flex flex-col items-center gap-5 py-6 text-center animate-bounce-in">
        <div className="text-6xl animate-float">🏆</div>
        <h2 className="text-3xl font-display font-black gradient-text">Fin du quiz !</h2>
        <div className="rounded-2xl bg-accent/10 border border-accent/30 px-8 py-5">
          <div className="text-5xl font-display font-black gradient-text-green">${total}</div>
          <div className="text-sm text-white/40 mt-1 uppercase tracking-widest">points au total</div>
          ${myRank !== '?' && html`<div className="text-lg font-bold text-white/60 mt-2">${myRank === 1 ? '🏆' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`} sur ${lb.length}</div>`}
        </div>
        <p className="text-white/40 text-sm">Regardez le classement sur l'écran TV !</p>
        <${Btn} variant="secondary" onClick=${disconnect}>← Quitter<//>
      </div>
    `;
  };

  // ── Main render ──────────────────────────────────────────────
  return html`
    <div className="flex flex-col min-h-[100dvh] bg-bg">

      <!-- Banner -->
      <${SessionBanner}
        code=${s?.sessionCode}
        label=${html`<span className="flex items-center gap-1.5">${s?.avatar || '🎮'} <strong>${s?.pseudo}</strong>${s?.teamName ? html` · <span className="text-white/40">${s.teamName}</span>` : ''}</span>`}
        right=${html`<span className="text-neon-green font-bold font-mono">${myPlayer?.scoreTotal ?? 0} pts</span>`}
      />

      <!-- Page content -->
      <div className="flex-1 px-4 py-4">
        ${renderPhase()}
      </div>

      <!-- Quitter -->
      <div className="px-4 pb-4 text-center">
        <button
          onClick=${disconnect}
          className="text-xs text-white/22 hover:text-white/50 transition-colors underline underline-offset-2"
        >
          Quitter la partie
        </button>
      </div>
    </div>
  `;
}
