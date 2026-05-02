import { useState } from 'react';
import { html, PHASE_LABELS } from '../../../utils.js';
import { useGame } from '../../../contexts/GameContext.js';
import { Btn, Badge, Card } from '../../../components/ui.js';

const PHASE_BADGE = {
  lobby:          'blue',
  round_intro:    'orange',
  training_video: 'orange',
  get_ready:      'green',
  question:       'orange',
  waiting:        'orange',
  answer_reveal:  'green',
  manual_scoring: 'orange',
  round_end:      'green',
  results:        'blue',
  end:            'green',
};

export default function PilotageTab() {
  const { gameState: gs, players, hostAction, hostSession } = useGame();
  const [videoScore,  setVideoScore]  = useState(0);
  const [burgerScore, setBurgerScore] = useState(0);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [peekScores, setPeekScores]       = useState(false);

  const phase   = gs?.status || 'lobby';
  const isPaused= gs?.phaseMeta?.paused === true;
  const curRound= gs?.currentRound;
  const curQ    = gs?.currentQuestion;
  const curRIdx = gs?.currentRoundIndex ?? -1;
  const curQIdx = gs?.currentQuestionIndex ?? -1;
  const isBurger= curRound?.type === 'burger' || curQ?.type === 'burger';
  const isBuzzer= gs?.phaseMeta?.answerMode === 'buzzer';
  const isVC    = curRound?.type === 'video_challenge';
  const isVote  = gs?.phaseMeta?.answerMode === 'vote_input' || gs?.phaseMeta?.answerMode === 'vote_voting';
  const voteRevealing = gs?.phaseMeta?.answerMode === 'vote_revealing' || gs?.phaseMeta?.answerMode === 'vote_revealed';
  const conn    = players.filter(p => p.connected).length;
  const answered= Object.keys(gs?.answers?.[curQ?.id] || {}).length;

  const ha = (action, extra = {}) => hostAction(action, extra);

  // Next question pulse when it makes sense
  const nextPulse = [
    'round_intro','training_video','answer_reveal'
  ].includes(phase) ||
    (phase === 'manual_scoring' && !!gs?.burgerFinalScore) ||
    voteRevealing ||
    (isVC && gs?.videoState?.phase === 'scored');

  const openTV = () => {
    const sc = hostSession?.sessionCode;
    window.open(`${window.location.origin}/#display?code=${sc}`, '_blank', 'noopener');
  };

  const sendBroadcast = () => {
    const msg = broadcastMsg.trim();
    if (!msg) return;
    ha('broadcast_message', { message: msg, type: 'info' });
    setBroadcastMsg('');
    setShowBroadcast(false);
  };

  // Scoreboard peek
  const lb = gs?.leaderboardPlayers || [];
  const topPlayers = lb.slice(0, 5);

  return html`
    <div className="flex flex-col gap-4">

      <!-- Status bar -->
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <${Badge} color=${PHASE_BADGE[phase] || 'gray'}>
            ${phase === 'lobby' ? '🎪 Lobby' :
              phase === 'round_intro' ? '📢 Présentation' :
              phase === 'get_ready' ? '🎯 Prêts' :
              phase === 'question' ? (isPaused ? '⏸️ Pause' : '❓ Question') :
              phase === 'answer_reveal' ? '📋 Révélation' :
              phase === 'manual_scoring' ? '⚖️ Arbitrage' :
              phase === 'round_end' ? '🏁 Fin manche' :
              phase === 'results' ? '📊 Résultats' :
              phase === 'end' ? '🎉 Fin' :
              phase}
          <//>
          ${gs?.phaseMeta?.playerScreenLocked
            ? html`<${Badge} color="red">🔒 Verrouillé<//>`
            : html`<${Badge} color="green">🔓 Ouvert<//>` }
        </div>
        <div className="flex gap-2">
          <${Btn} variant="ghost" size="sm" onClick=${() => setShowBroadcast(!showBroadcast)}>💬</${Btn}>
          <${Btn} variant="tv" size="sm" onClick=${openTV}>📺 TV ↗</${Btn}>
        </div>
      </div>

      <!-- Broadcast input -->
      ${showBroadcast && html`
        <div className="flex gap-2">
          <input
            type="text"
            value=${broadcastMsg}
            onInput=${e => setBroadcastMsg(e.target.value)}
            placeholder="Message pour tous les joueurs…"
            className="flex-1 bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
            onKeyDown=${e => e.key === 'Enter' && sendBroadcast()}
          />
          <${Btn} variant="primary" size="sm" onClick=${sendBroadcast}>Envoyer<//>
        </div>
      `}

      <!-- Current question info -->
      ${curRound && curQ && html`
        <div className="rounded-xl bg-bg-card border border-white/8 p-4">
          <div className="text-xs text-white/30 uppercase tracking-wider mb-1.5">
            Manche ${curRIdx+1} · Q${curQIdx+1} · ${(curRound.type||'').toUpperCase()}
          </div>
          <p className="text-sm font-semibold text-white/90 mb-1">${curQ.content || '—'}</p>
          ${curQ.correctAnswer && html`<p className="text-xs text-neon-green">✓ ${curQ.correctAnswer}</p>`}
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-xs text-white/35">Réponses reçues</span>
            <span className="font-mono font-bold text-amber-400 text-sm">${answered}/${conn}</span>
          </div>
        </div>
      `}

      <!-- Scores peek -->
      ${lb.length > 0 && html`
        <div>
          <button
            onClick=${() => setPeekScores(!peekScores)}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors mb-2"
          >
            ${peekScores ? '▼' : '▶'} Classement actuel
          </button>
          ${peekScores && html`
            <div className="rounded-xl bg-bg-card border border-white/8 p-3 flex flex-col gap-1.5">
              ${topPlayers.map((p, i) => html`
                <div key=${p.playerId || p.id} className="flex items-center gap-2 text-sm">
                  <span className="text-white/30 font-mono w-5">${i+1}.</span>
                  <span className="text-lg">${p.avatar || '🎮'}</span>
                  <span className="flex-1 font-semibold truncate">${p.pseudo}</span>
                  <span className="font-mono font-bold text-neon-green">${p.score ?? p.scoreTotal ?? 0}</span>
                </div>
              `)}
            </div>
          `}
        </div>
      `}

      <!-- Phase controls -->
      ${phase === 'lobby' && html`
        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/25 p-5 text-center">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-2">Quiz : ${gs?.quizTitle || '—'}</div>
          <p className="text-white/60 text-sm mb-4">${conn} joueur(s) connecté(s)</p>
          <${Btn} variant="success" wide pulse size="lg" onClick=${() => ha('start_quiz')}>
            ▶️ Lancer la partie
          <//>
        </div>
      `}

      ${phase === 'get_ready' && html`
        <div className="rounded-xl bg-neon-green/8 border border-neon-green/25 p-5 text-center">
          <p className="text-white/60 text-sm mb-4">
            Q${curQIdx+1}${curRound?.questions?.length ? `/${curRound.questions.length}` : ''} —
            ${curQ?.content ? html`<em className="text-white/40 text-xs"> "${curQ.content.substring(0,50)}…"</em>` : ''}
          </p>
          <${Btn} variant="success" wide pulse size="lg" onClick=${() => ha('start_question')}>
            ▶ Lancer la question
          <//>
        </div>
      `}

      ${['question','waiting','answer_reveal','manual_scoring'].includes(phase) && html`
        <div className="rounded-xl bg-bg-card border border-white/8 p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">⚡ Contrôles</div>
          <div className="grid grid-cols-2 gap-2">
            ${isPaused
              ? html`<${Btn} variant="success" wide onClick=${() => ha('resume_game')}>▶ Reprendre<//>`
              : html`<${Btn} variant="secondary" onClick=${() => ha('pause_game')}>⏸ Pause<//>` }
            ${!isBurger && !isBuzzer && !isVC && !isVote && !['answer_reveal'].includes(phase) && html`
              <${Btn} variant="secondary" pulse onClick=${() => ha('reveal_answer')}>📋 Solution<//>
            `}
            ${!isVote && !['answer_reveal'].includes(phase) && html`
              <${Btn} variant="ghost" size="sm" onClick=${() => ha('refresh_question')}>🔁 Reset Q<//>
            `}
            ${phase === 'answer_reveal' && html`
              <${Btn} variant="secondary" onClick=${() => ha('return_to_question')}>↩ Retour Q<//>
            `}
          </div>
        </div>
      `}

      <!-- Buzzer controls -->
      ${isBuzzer && phase === 'manual_scoring' && html`
        <div className="rounded-xl bg-bg-card border border-white/8 p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">🎯 Buzzer</div>
          ${gs?.buzzerState?.firstPlayerId ? html`
            <div className="text-sm text-center mb-3 font-semibold">
              ${(() => {
                const who = players.find(p => p.id === gs.buzzerState.firstPlayerId || p.playerId === gs.buzzerState.firstPlayerId);
                return html`${who?.avatar || '🎮'} <span className="text-white">${who?.pseudo || '?'}</span> a buzzé`;
              })()}
            </div>
            <div className="flex gap-2">
              <${Btn} variant="success" wide onClick=${() => ha('buzzer_mark_correct')}>✅ Correct<//>
              <${Btn} variant="danger" wide onClick=${() => ha('buzzer_mark_wrong')}>❌ Faux<//>
            </div>
          ` : html`
            <p className="text-white/40 text-sm text-center">En attente d'un buzzer…</p>
          `}
        </div>
      `}

      <!-- Vote controls -->
      ${isVote && html`
        <div className="rounded-xl bg-blue-500/8 border border-blue-500/25 p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">🗳️ Vote</div>
          <div className="flex gap-2">
            <${Btn} variant="primary" wide onClick=${() => ha('vote_close')}>Fermer le vote<//>
          </div>
        </div>
      `}
      ${gs?.phaseMeta?.answerMode === 'vote_voting' && html`
        <div className="rounded-xl bg-blue-500/8 border border-blue-500/25 p-4">
          <${Btn} variant="primary" wide onClick=${() => ha('vote_reveal_next')}>Révéler suivant ▶<//>
        </div>
      `}
      ${voteRevealing && html`
        <div className="flex gap-2">
          <${Btn} variant="secondary" onClick=${() => ha('vote_reveal_next')}>Suivant ▶<//>
          <${Btn} variant="ghost" size="sm" onClick=${() => ha('vote_end')}>Terminer<//>
        </div>
      `}

      <!-- Video challenge controls -->
      ${isVC && html`
        <div className="rounded-xl bg-rose-500/8 border border-rose-500/25 p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">🎬 Challenge Vidéo</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value=${videoScore}
              onInput=${e => setVideoScore(parseInt(e.target.value) || 0)}
              className="w-24 bg-bg-input border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono text-center focus:border-accent/60 outline-none"
            />
            <${Btn} variant="success" onClick=${() => ha('video_set_score', { score: videoScore })}>
              Valider ${videoScore} pts
            <//>
          </div>
        </div>
      `}

      <!-- Burger controls -->
      ${isBurger && html`
        <div className="rounded-xl bg-amber-500/8 border border-amber-500/25 p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">🍔 Burger</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value=${burgerScore}
              onInput=${e => setBurgerScore(parseInt(e.target.value) || 0)}
              className="w-24 bg-bg-input border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono text-center focus:border-accent/60 outline-none"
            />
            <${Btn} variant="success" onClick=${() => ha('burger_set_score', { score: burgerScore })}>
              Score ${burgerScore}
            <//>
          </div>
        </div>
      `}

      <!-- Navigation -->
      <div className="rounded-xl bg-bg-card border border-white/8 p-4">
        <div className="text-xs text-white/40 uppercase tracking-widest mb-3">🧭 Navigation</div>
        ${phase !== 'round_end' && phase !== 'end' && phase !== 'results' && html`
          <div className="grid grid-cols-2 gap-2 mb-2">
            <${Btn} variant="nav" onClick=${() => ha('prev_question')}>◀ Question</${Btn}>
            <${Btn} variant="nav" pulse=${nextPulse} onClick=${() => ha('next_question')}>Question ▶</${Btn}>
          </div>
        `}
        <div className="grid grid-cols-2 gap-2">
          <${Btn} variant="nav" size="sm" onClick=${() => ha('prev_round')}>◀ Manche</${Btn}>
          <${Btn} variant="nav" size="sm" pulse=${['round_end','results'].includes(phase)} onClick=${() => ha('next_round')}>Manche ▶</${Btn}>
        </div>
      </div>

      <!-- Cérémonie finale : basculer joueurs / équipes -->
      ${phase === 'end' && html`
        <div className="rounded-xl bg-accent/8 border border-accent/25 p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">🏆 Cérémonie finale</div>
          <div className="grid grid-cols-2 gap-2">
            <${Btn}
              variant=${!gs?.phaseMeta?.ceremonyView || gs?.phaseMeta?.ceremonyView === 'players' ? 'primary' : 'ghost'}
              onClick=${() => ha('ceremony_view', { view: 'players' })}
            >
              👤 Joueurs
            <//>
            <${Btn}
              variant=${gs?.phaseMeta?.ceremonyView === 'teams' ? 'primary' : 'ghost'}
              onClick=${() => ha('ceremony_view', { view: 'teams' })}
            >
              👥 Équipes
            <//>
          </div>
        </div>
      `}

      <!-- End game -->
      ${['question','waiting','round_end','results','answer_reveal','manual_scoring'].includes(phase) && html`
        <div className="text-center mt-2">
          <button
            onClick=${() => confirm('Terminer le quiz ?') && ha('end_game')}
            className="text-xs text-white/20 hover:text-rose-400 transition-colors"
          >
            ⏹ Terminer le quiz
          </button>
        </div>
      `}

    </div>
  `;
}
