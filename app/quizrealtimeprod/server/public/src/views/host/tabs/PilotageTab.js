import { useState } from 'react';
import { html } from '../../../utils.js';
import { useGame } from '../../../contexts/GameContext.js';
import { Btn, Badge } from '../../../components/ui.js';

const PHASE_BADGE = {
  lobby:          'blue',
  round_intro:    'orange',
  training_video: 'orange',
  question:       'orange',
  waiting:        'orange',
  answer_reveal:  'green',
  manual_scoring: 'orange',
  round_end:      'green',
  results:        'blue',
  end:            'green',
};

export default function PilotageTab() {
  const { gameState: gs, players, teams, hostAction, hostSession, navigate, setHostSession } = useGame();
  const [videoScore,  setVideoScore]  = useState(0);
  const [burgerScore, setBurgerScore] = useState(0);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [peekScores, setPeekScores]       = useState(false);
  const [timerSeconds, setTimerSeconds]   = useState(30);
  const [confirmEndGame, setConfirmEndGame] = useState(false);

  const phase   = gs?.status || 'lobby';
  const isPaused= gs?.phaseMeta?.paused === true;
  const curRound= gs?.currentRound;
  const curQ    = gs?.currentQuestion;
  const curRIdx = gs?.currentRoundIndex ?? -1;
  const curQIdx = gs?.currentQuestionIndex ?? -1;
  const totalRounds = gs?.totalRoundsCount || 0;
  const isLastRound = totalRounds > 0 && curRIdx >= totalRounds - 1;
  const isBurger= (curRound?.type === 'burger' || curQ?.type === 'burger') && !['end', 'results', 'round_end'].includes(phase);
  const isBuzzer= gs?.phaseMeta?.answerMode === 'buzzer';
  const isVC    = curRound?.type === 'video_challenge' && !['end', 'results', 'round_end'].includes(phase);
  const videoPhase = gs?.videoState?.phase || '';
  const answerMode = gs?.phaseMeta?.answerMode;
  const endPhases = ['end', 'results', 'round_end'];
  const isVoteQuestion = answerMode === 'vote_question' && !endPhases.includes(phase);
  const isVoteInput = answerMode === 'vote_input' && !endPhases.includes(phase);
  const isVoteProposal = answerMode === 'vote_proposal_reveal' && !endPhases.includes(phase);
  const isVoteVoting = answerMode === 'vote_voting' && !endPhases.includes(phase);
  const isVote  = isVoteQuestion || isVoteInput || isVoteVoting || isVoteProposal;
  const voteRevealing = (answerMode === 'vote_revealing' || answerMode === 'vote_revealed') && !endPhases.includes(phase);
  const answerablePlayers = players.filter(p => p.connected && !p.isBot);
  const conn    = answerablePlayers.length;
  const answered= Object.keys(gs?.answers?.[curQ?.id] || {}).length;
  // Pour vote_voting, les votes sont dans voteState.votes, pas dans gs.answers
  const voteCount = Object.keys(gs?.voteState?.votes || {}).length;
  const allAnswered = conn > 0 && ['question','waiting'].includes(phase) && !isBuzzer && !isBurger && !isVC && (
    isVoteVoting ? voteCount >= conn : answered >= conn
  );

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
    ha('broadcast_message', { text: msg, type: 'info' });
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
        <div className="rounded-xl app-surface p-4">
          <div className="text-xs text-white/30 uppercase tracking-wider mb-1.5">
            Manche ${curRIdx+1} · Q${curQIdx+1} · ${(curRound.type||'').toUpperCase()}
          </div>
          <p className="text-sm font-semibold text-white/90 mb-1">${curQ.content || '—'}</p>
          ${curQ.correctAnswer && html`<p className="text-xs text-neon-green">✓ ${curQ.correctAnswer}</p>`}
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-xs text-white/35">Réponses reçues</span>
            <span className=${`font-mono font-bold text-sm px-2 py-1 rounded-lg transition-all ${allAnswered ? 'text-neon-green bg-neon-green/15 scale-110 ring-pulse' : 'text-amber-400'}`}>
              ${answered}/${conn}
            </span>
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
            <div className="rounded-xl app-surface p-3 flex flex-col gap-1.5">
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


      ${['question','waiting','answer_reveal','manual_scoring'].includes(phase) && html`
        <div className="rounded-xl app-surface p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">⚡ Contrôles</div>
          <div className="grid grid-cols-2 gap-2">
            ${isPaused
              ? html`<${Btn} variant="success" wide onClick=${() => ha('resume_game')}>▶ Reprendre<//>`
              : html`<${Btn} variant="secondary" onClick=${() => ha('pause_game')}>⏸ Pause<//>` }
            ${!isBurger && !isVC && !isVote && !['answer_reveal'].includes(phase) && html`
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
        <div className="rounded-xl app-surface p-4">
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
      ${(isVote || voteRevealing) && html`
        <div className="rounded-xl bg-blue-500/8 border border-blue-500/25 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs text-white/40 uppercase tracking-widest">🗳️ Vote</span>
            <span className="text-xs text-blue-300/60 font-mono">
              ${isVoteQuestion ? 'Étape 1/5 – Question' :
                isVoteInput ? 'Étape 2/5 – Saisie des réponses' :
                isVoteProposal ? 'Étape 3/5 – Révélation propositions' :
                isVoteVoting ? 'Étape 4/5 – Vote' :
                'Étape 5/5 – Révélation résultats'}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            ${isVoteQuestion && html`
              <${Btn} variant="primary" wide onClick=${() => ha('vote_start_input')}>
                ✍️ C'est à vous
              <//>
            `}
            ${isVoteInput && html`
              <div className="text-xs text-white/35 mb-1">${answered}/${conn} réponse(s) reçue(s)</div>
              <${Btn} variant="primary" wide pulse=${allAnswered} onClick=${() => ha('vote_close')}>
                🗳️ Lancer les votes
              <//>
            `}
            ${isVoteProposal && (() => {
              const prs = gs?.proposalRevealState;
              const cursor = prs?.revealCursor ?? -1;
              const total = prs?.proposals?.length ?? 0;
              const allShown = total > 0 && cursor >= total - 1;
              return html`
                <div className="text-xs text-white/35 mb-1">${cursor + 1} / ${total} propositions affichées</div>
                ${!allShown && html`
                  <${Btn} variant="secondary" wide onClick=${() => ha('vote_proposal_reveal_next')}>
                    ▶ Proposition suivante
                  <//>
                `}
                ${allShown && html`
                  <${Btn} variant="primary" wide pulse onClick=${() => ha('vote_start_voting')}>
                    🗳️ Ouvrir le vote
                  <//>
                `}
              `;
            })()}
            ${isVoteVoting && html`
              <div className="text-xs text-white/35 mb-1">${voteCount}/${conn} vote(s) reçu(s)</div>
              <${Btn} variant="primary" wide pulse=${voteCount >= conn && conn > 0} onClick=${() => ha('vote_reveal')}>
                🔍 Révéler les résultats
              <//>
            `}
            ${voteRevealing && (() => {
              const isRevealed = answerMode === 'vote_revealed';
              return html`
                <div className="flex gap-2">
                  ${!isRevealed && html`
                    <${Btn} variant="secondary" wide pulse onClick=${() => ha('vote_reveal_next')}>▶ Révéler suivant<//>
                  `}
                  ${isRevealed && html`
                    <${Btn} variant="success" wide onClick=${() => ha('vote_end')}>✓ Terminer<//>
                  `}
                </div>
              `;
            })()}
          </div>
        </div>
      `}

      <!-- Video challenge controls -->
      ${isVC && html`
        <div className="rounded-xl bg-rose-500/8 border border-rose-500/25 p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">🎬 Challenge vidéo</div>
          <div className="flex flex-col gap-4">

            <!-- Candidat -->
            <div>
              <div className="text-xs text-white/30 mb-1.5">Candidat</div>
              <div className="flex flex-wrap gap-1.5">
                ${answerablePlayers.map(p => html`
                  <${Btn}
                    key=${p.id || p.playerId}
                    variant=${gs?.videoState?.selectedPlayerId === (p.id || p.playerId) ? 'primary' : 'ghost'}
                    size="sm"
                    onClick=${() => ha('video_select_player', { playerId: p.id || p.playerId })}
                  >
                    ${p.avatar || '🎮'} ${p.pseudo}
                  <//>
                `)}
                ${teams?.length > 0 && teams.map(t => html`
                  <${Btn}
                    key=${t.id}
                    variant=${gs?.videoState?.selectedTeamId === t.id ? 'primary' : 'ghost'}
                    size="sm"
                    onClick=${() => ha('video_select_team', { teamId: t.id })}
                  >
                    👥 ${t.name}
                  <//>
                `)}
              </div>
            </div>

            <!-- Entraînement (optionnel) -->
            ${curQ?.trainingVideoUrl && html`
              <div className="rounded-lg app-panel p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-amber-400/80 uppercase tracking-wider">🏋️ Vidéo d'entraînement</span>
                  <span className="text-xs text-white/25 italic">— optionnelle</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <${Btn} variant="ghost" size="sm"
                    onClick=${() => ha('video_training_mark_ready')}>
                    ✋ Prêt
                  <//>
                  <${Btn} variant="ghost" size="sm"
                    disabled=${videoPhase !== 'training_ready'}
                    onClick=${() => ha('video_start_training_playing')}>
                    ▶ Lancer
                  <//>
                  <${Btn} variant="ghost" size="sm"
                    disabled=${videoPhase !== 'training_playing'}
                    onClick=${() => ha('video_training_control', { ctrl: 'pause' })}>
                    ⏸ Pause
                  <//>
                  <${Btn} variant="ghost" size="sm"
                    disabled=${videoPhase !== 'training_playing'}
                    onClick=${() => ha('video_training_control', { ctrl: 'play' })}>
                    ▶ Reprendre
                  <//>
                  <${Btn} variant="ghost" size="sm"
                    onClick=${() => ha('video_training_control', { ctrl: 'rewind' })}>
                    ⏮ Début
                  <//>
                </div>
              </div>
            `}

            <!-- Challenge (principal) -->
            <div className="rounded-lg border border-rose-500/25 bg-rose-500/5 p-3">
              <div className="text-xs font-bold text-rose-300/80 uppercase tracking-wider mb-2">🎯 Vidéo du challenge</div>

              <!-- Lancement -->
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <${Btn} variant="primary" size="sm"
                  pulse=${(!!gs?.videoState?.selectedPlayerId || !!gs?.videoState?.selectedTeamId) && videoPhase !== 'ready'}
                  onClick=${() => ha('video_mark_ready')}>
                  ✋ Prêt
                <//>
                <${Btn} variant="primary" size="sm"
                  pulse=${videoPhase === 'ready'}
                  disabled=${!gs?.videoState?.selectedPlayerId && !gs?.videoState?.selectedTeamId}
                  onClick=${() => ha('video_start_playing')}>
                  ▶ Lancer
                <//>
                <${Btn} variant="ghost" size="sm"
                  disabled=${videoPhase !== 'playing'}
                  onClick=${() => ha('video_control', { ctrl: 'pause' })}>
                  ⏸ Pause
                <//>
                <${Btn} variant="ghost" size="sm"
                  disabled=${videoPhase !== 'playing'}
                  onClick=${() => ha('video_control', { ctrl: 'play' })}>
                  ▶ Reprendre
                <//>
                <${Btn} variant="ghost" size="sm"
                  onClick=${() => ha('video_control', { ctrl: 'rewind' })}>
                  ⏮ Début
                <//>
              </div>

              <!-- Score -->
              <div className="flex items-center gap-2 pt-2 border-t border-white/14">
                <${Btn} variant="secondary" size="sm"
                  disabled=${videoPhase !== 'playing'}
                  onClick=${() => ha('video_start_eval')}>
                  Évaluer
                <//>
                <input
                  type="number"
                  value=${videoScore}
                  onInput=${e => setVideoScore(parseInt(e.target.value) || 0)}
                  step="10"
                  min="0"
                  max="100"
                  className="w-20 bg-bg-input border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono text-center focus:border-accent/60 outline-none"
                />
                <${Btn} variant="success" size="sm"
                  onClick=${() => ha('video_set_score', { score: videoScore })}>
                  ✅ Valider
                <//>
              </div>
            </div>

          </div>
        </div>
      `}

      <!-- Burger controls -->
      ${isBurger && html`
        <div className="rounded-xl bg-amber-500/8 border border-amber-500/25 p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">Burger</div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              ${answerablePlayers.map(p => html`
                <${Btn}
                  key=${p.id || p.playerId}
                  variant=${gs?.burgerSelectedPlayerId === (p.id || p.playerId) ? 'warning' : 'ghost'}
                  size="sm"
                  onClick=${() => ha('burger_select_player', { playerId: p.id || p.playerId })}
                >
                  ${p.avatar || '🎮'} ${p.pseudo}
                <//>
              `)}
            </div>
            ${teams?.length > 0 && html`
              <div className="grid grid-cols-2 gap-2">
                ${teams.map(t => html`
                  <${Btn}
                    key=${t.id}
                    variant=${gs?.burgerSelectedTeamId === t.id ? 'warning' : 'ghost'}
                    size="sm"
                    onClick=${() => ha('burger_select_team', { teamId: t.id })}
                  >
                    👥 ${t.name}
                  <//>
                `)}
              </div>
            `}
            <div className="flex items-center gap-2">
              <div className="text-xs text-white/35 flex-1">
                Item ${(gs?.burgerState?.currentItemIndex ?? -1) + 1} / ${curQ?.items?.length || '?'}
              </div>
              <${Btn} variant="secondary" size="sm" onClick=${() => ha('burger_prev_item')}>◀ Préc.<//>
              <${Btn} variant="primary" size="sm" pulse onClick=${() => ha('burger_next_item')}>
                ${(gs?.burgerState?.currentItemIndex ?? -1) >= ((curQ?.items?.length || 0) - 1) ? '🎤 Candidat répond' : 'Suivant ▶'}
              <//>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value=${burgerScore}
                onInput=${e => setBurgerScore(parseInt(e.target.value) || 0)}
                step="10"
                min="0"
                max="100"
                className="w-24 bg-bg-input border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono text-center focus:border-accent/60 outline-none"
              />
              <${Btn} variant="success" onClick=${() => ha('burger_set_score', { score: burgerScore })}>
                Score ${burgerScore}
              <//>
            </div>
          </div>
        </div>
      `}
      <!-- Timer controls -->
      ${['question','waiting','answer_reveal','manual_scoring'].includes(phase) && html`
        <div className="rounded-xl app-surface p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">⏱ Chronomètre</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="5"
              max="600"
              value=${timerSeconds}
              onInput=${e => setTimerSeconds(Math.max(5, parseInt(e.target.value) || 30))}
              className="w-24 bg-bg-input border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono text-center focus:border-accent/60 outline-none"
            />
            <span className="text-xs text-white/40">sec</span>
            ${gs?.phaseMeta?.timer
              ? html`
                <${Btn} variant="danger" onClick=${() => ha('stop_timer')}>⏹ Stopper<//>
              `
              : html`
                <${Btn} variant="primary" pulse onClick=${() => ha('start_timer', { seconds: timerSeconds })}>▶ Lancer<//>
              `
            }
          </div>
          ${gs?.phaseMeta?.timer && html`
            <div className="mt-2 text-xs text-neon-green font-mono">
              ⏱ Chrono en cours — visible sur la TV
            </div>
          `}
        </div>
      `}

      <!-- Navigation -->
      <div className="rounded-xl app-surface p-4">
        <div className="text-xs text-white/40 uppercase tracking-widest mb-3">🧭 Navigation</div>
        ${phase !== 'round_end' && phase !== 'end' && phase !== 'results' && html`
          <div className="grid grid-cols-2 gap-2 mb-2">
            <${Btn} variant="nav" onClick=${() => ha('prev_question')}>◀ Question</${Btn}>
            <${Btn} variant="nav" pulse=${nextPulse} onClick=${() => ha('next_question')}>Question ▶</${Btn}>
          </div>
        `}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <${Btn} variant="ghost" size="sm" onClick=${() => ha('prev_round')}>◀◀ Manche</${Btn}>
          <${Btn} variant="ghost" size="sm" onClick=${() => ha('next_round')}>Manche ▶▶</${Btn}>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <${Btn} variant="ghost" size="sm" onClick=${() => ha('show_results')}>📊 Résultats</${Btn}>
          ${confirmEndGame
            ? html`
              <div className="col-span-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex flex-col gap-2">
                <p className="text-sm font-bold text-rose-300 text-center">Terminer et quitter la partie ?</p>
                <div className="grid grid-cols-2 gap-2">
                  <${Btn} variant="ghost" size="sm" onClick=${() => setConfirmEndGame(false)}>Annuler</${Btn}>
                  <${Btn} variant="danger" size="sm" onClick=${() => {
                    ha('end_game');
                    localStorage.removeItem('quiz_host_session_code');
                    localStorage.removeItem('quiz_host_key');
                    setHostSession({ sessionCode: '', hostKey: '', connected: false });
                    navigate('home');
                  }}>✅ Confirmer</${Btn}>
                </div>
              </div>
            `
            : html`<${Btn} variant="danger" size="sm" onClick=${() => setConfirmEndGame(true)}>🏁 Fin de partie</${Btn}>`
          }
        </div>
      </div>

      <!-- Cérémonie finale — uniquement à la fin de la dernière manche -->
      ${(phase === 'end' || ((phase === 'results' || phase === 'round_end') && isLastRound)) && html`
        <div className="rounded-xl bg-yellow-500/8 border border-yellow-500/25 p-4">
          <div className="text-xs text-white/40 uppercase tracking-widest mb-3">🏆 Cérémonie finale</div>

          ${!gs?.phaseMeta?.finalCeremony && html`
            <div className="flex flex-col gap-3">
              <!-- Choix du mode : toujours affiché, Équipes désactivé si pas d'équipes -->
              <p className="text-xs text-white/40 mb-1">Mode de classement :</p>
              <div className="flex gap-2">
                <${Btn}
                  variant=${gs?.phaseMeta?.ceremonyView !== 'teams' ? 'primary' : 'ghost'}
                  size="sm" wide
                  onClick=${() => ha('ceremony_set_view', { view: 'players' })}
                >👤 Individuel<//>
                <${Btn}
                  variant=${gs?.phaseMeta?.ceremonyView === 'teams' ? 'primary' : 'ghost'}
                  size="sm" wide
                  disabled=${!teams?.length}
                  onClick=${() => teams?.length && ha('ceremony_set_view', { view: 'teams' })}
                  style=${{ opacity: teams?.length ? 1 : 0.35 }}
                >👥 Équipes<//>
              </div>
              ${!teams?.length && html`
                <p className="text-[11px] text-white/25 -mt-1">Aucune équipe dans cette session</p>
              `}
              <${Btn} variant="success" wide pulse size="lg"
                onClick=${() => ha('final_ceremony_init')}
              >
                🎬 Lancer la cérémonie
              <//>
            </div>
          `}

          ${gs?.phaseMeta?.finalCeremony && (() => {
              const fc = gs.phaseMeta.finalCeremony;
              const view = gs.phaseMeta.ceremonyView || 'players';
              const isTeams = view === 'teams';
              const order = isTeams ? (fc.teamsRevealOrder || []) : (fc.revealOrder || []);
              const cursor = isTeams ? (fc.teamsRevealCursor || 0) : (fc.revealCursor || 0);
              const remaining = order.length - cursor;
              const hasTeams = (fc.teamsRevealOrder?.length || 0) > 0 || teams?.length > 0;
              return html`
                <div className="flex flex-col gap-2">
                  <!-- Switcher vue individuel / équipes -->
                  <div className="flex gap-2 mb-1">
                    <${Btn}
                      variant=${!isTeams ? 'primary' : 'ghost'}
                      size="sm"
                      onClick=${() => ha('ceremony_set_view', { view: 'players' })}
                    >👤 Individuel</${Btn}>
                    <${Btn}
                      variant=${isTeams ? 'primary' : 'ghost'}
                      size="sm"
                      disabled=${!hasTeams}
                      style=${{ opacity: hasTeams ? 1 : 0.35 }}
                      onClick=${() => hasTeams && ha('ceremony_set_view', { view: 'teams' })}
                    >👥 Équipes</${Btn}>
                  </div>
                  <div className="text-xs text-white/35 mb-1">
                    ${remaining > 0
                      ? html`<span className="text-amber-400 font-bold">${remaining}</span> encore masqué(s)`
                      : html`<span className="text-neon-green">✅ Tous révélés</span>`}
                  </div>
                  <${Btn}
                    variant="secondary" wide pulse=${remaining > 0}
                    onClick=${() => ha(isTeams ? 'final_ceremony_reveal_next_team' : 'final_ceremony_reveal_next')}
                    disabled=${remaining === 0}
                  >
                    ${remaining > 0 ? '▶ Révéler suivant' : '✅ Tous révélés'}
                  <//>
                  <${Btn} variant="ghost" size="sm"
                    onClick=${() => ha('final_ceremony_reset')}
                  >↺ Recommencer<//>
                </div>
              `;
            })()}
        </div>
      `}

    </div>
  `;
}
