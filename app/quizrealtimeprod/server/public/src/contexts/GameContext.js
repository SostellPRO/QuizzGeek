import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSounds } from '../hooks/useSounds.js';
import { useMusic } from '../hooks/useMusic.js';
import { resolveMedia } from '../utils.js';

const GameContext = createContext(null);
export const useGame = () => useContext(GameContext);

export function GameProvider({ children }) {
  const [page, setPage]       = useState(() => (window.location.hash.slice(1).split('?')[0]) || 'home');
  const [socket, setSocket]   = useState(null);
  const [gameState, setGs]    = useState(null);
  const [players, setPlayers] = useState([]);
  const [teams, setTeams]     = useState([]);
  const [lbPlayers, setLbP]   = useState([]);
  const [lbTeams, setLbT]     = useState([]);

  // Player session
  const [playerSession, setPlayerSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('quiz_player_session') || 'null'); } catch { return null; }
  });

  // Host session
  const [hostSession, setHostSession] = useState(() => ({
    sessionCode: localStorage.getItem('quiz_host_session_code') || '',
    hostKey:     localStorage.getItem('quiz_host_key') || '',
    connected:   false,
  }));

  // Display session
  const [displaySession, setDisplaySession] = useState({ sessionCode: '', connected: false });

  // Admin state
  const [adminQuizzes, setAdminQuizzes] = useState([]);
  const [editingQuiz,  setEditingQuiz]  = useState(null);

  const { play, startCountdown, stopCountdown } = useSounds();
  const { muted, setUrl: setMusicUrl, toggleMute, ducking, silenceForVideo } = useMusic();

  // Ref to track current page inside event handlers (avoids stale closure)
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);

  // Refs for session state — used inside socket 'connect' handler (avoids stale closures)
  const playerSessionRef  = useRef(playerSession);
  const hostSessionRef    = useRef(hostSession);
  const displaySessionRef = useRef(displaySession);
  useEffect(() => { playerSessionRef.current  = playerSession;  }, [playerSession]);
  useEffect(() => { hostSessionRef.current    = hostSession;    }, [hostSession]);
  useEffect(() => { displaySessionRef.current = displaySession; }, [displaySession]);

  // Refs for change detection
  const lastPhaseRef      = useRef(null);
  const lastTimerActive   = useRef(false);
  const lastPlayerCount   = useRef(0);
  const lastBuzzerFirst   = useRef(null);
  const lastBuzzerResult  = useRef(null);
  const lastVoteReveal    = useRef(null);

  // ── Navigate ────────────────────────────────────────────────
  const navigate = useCallback((p) => {
    setPage(p);
    window.location.hash = p;
  }, []);

  // Hash change → navigate (strip ?params so #display?code=XYZ → page 'display')
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.slice(1).split('?')[0];
      if (h) setPage(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Stop music & sounds when leaving the display screen
  useEffect(() => {
    if (page !== 'display') {
      setMusicUrl('');
      stopCountdown();
    }
  }, [page, setMusicUrl, stopCountdown]);

  // ── Socket init ──────────────────────────────────────────────
  useEffect(() => {
    const s = window.io({
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 300,
      reconnectionDelayMax: 2500,
      timeout: 8000,
      transports: ['websocket', 'polling'],
    });
    setSocket(s);

    // ── Re-registration on every (re)connect ────────────────────
    // Handles phone wake-up, network drops, tab visibility changes.
    // The 'connect' event fires on initial connection AND each reconnection.
    s.on('connect', () => {
      // Re-join as player
      const ps = playerSessionRef.current;
      if (ps?.sessionCode && ps?.reconnectToken) {
        s.emit('player:reconnect', {
          sessionCode:    ps.sessionCode,
          reconnectToken: ps.reconnectToken,
          avatar:         ps.avatar || null,
        }, (res) => {
          if (!res?.ok) return;
          const p = res.player || {};
          const next = {
            ...ps,
            playerId:       p.id            || ps.playerId,
            pseudo:         p.pseudo        || ps.pseudo,
            reconnectToken: p.reconnectToken|| ps.reconnectToken,
            teamId:         p.teamId        || null,
            teamName:       p.teamName      || null,
            avatar:         p.avatar        || ps.avatar || null,
          };
          localStorage.setItem('quiz_player_session', JSON.stringify(next));
          setPlayerSession(next);
        });
      }
      // Re-join as host
      const hs = hostSessionRef.current;
      if (hs?.sessionCode && hs?.hostKey) {
        s.emit('join:host', { sessionCode: hs.sessionCode, hostKey: hs.hostKey }, () => {});
      }
      // Re-join as display
      const ds = displaySessionRef.current;
      if (ds?.sessionCode) {
        s.emit('join:display', { sessionCode: ds.sessionCode }, () => {});
      }
    });

    // ── Visibility change: force reconnect when screen wakes up ─
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !s.connected) {
        s.connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    s.on('game:players_ejected', () => {
      setPlayerSession(null);
      setGs(null);
      setPlayers([]);
      setTeams([]);
      localStorage.removeItem('quiz_player_session');
    });

    s.on('game:state', (payload) => {
      const gs  = payload?.gameState || null;
      const pls = payload?.players || [];
      const tms = payload?.teams   || [];
      setGs(gs);
      setPlayers(pls);
      setTeams(tms);
      setLbP(payload?.leaderboardPlayers || []);
      setLbT(payload?.leaderboardTeams   || []);

      // ── Sound & music : only on the display (TV) screen ────────
      const phase = gs?.status;
      const round = gs?.currentRound;
      const isDisplay = pageRef.current === 'display';

      const getPhaseMusic = () => {
        if (!gs) return '';
        if (phase === 'lobby')  return resolveMedia(gs.quizWelcomeMusicUrl || '');
        if (phase === 'end')    return resolveMedia(gs.ceremonyMusicUrl || '');
        if (phase === 'round_intro') return resolveMedia(round?.introMusicUrl || round?.musicUrl || '');
        if (['question','waiting','manual_scoring','answer_reveal'].includes(phase))
          return resolveMedia(round?.gameMusicUrl || round?.musicUrl || '');
        if (['round_end','results'].includes(phase)) return resolveMedia(round?.endMusicUrl || '');
        return '';
      };
      setMusicUrl(isDisplay ? getPhaseMusic() : '');

      if (isDisplay) {
        // ── Sound effects on phase change ───────────────────────
        if (phase !== lastPhaseRef.current) {
          if (phase === 'round_intro') play('bell');
          else if (phase === 'round_end' || phase === 'results' || phase === 'end') play('fanfare');
          if (phase === 'answer_reveal') {
            const revAudio = gs?.revealedAnswer?.revealAudio;
            if (revAudio) {
              setTimeout(() => {
                const el = document.getElementById('reveal-audio-player');
                if (el) el.play().catch(() => {});
              }, 400);
            }
          }
        }

        // ── Buzzer sound ─────────────────────────────────────────
        const buzzerFirstId = gs?.buzzerState?.firstPlayerId;
        if (buzzerFirstId && buzzerFirstId !== lastBuzzerFirst.current) {
          lastBuzzerFirst.current = buzzerFirstId;
          play('buzzer');
        } else if (!buzzerFirstId) {
          lastBuzzerFirst.current = null;
        }

        // ── Buzzer result sound ──────────────────────────────────
        const blr = gs?.buzzerLastResult;
        if (blr?.at && blr.at !== lastBuzzerResult.current) {
          lastBuzzerResult.current = blr.at;
          play(blr.result === 'correct' ? 'correct' : 'wrong');
        }

        // ── Vote reveal sound ─────────────────────────────────────
        // cashRegister = vraie réponse révélée ; wrong = leurre révélé
        const vrc = gs?.voteState?.revealCursor;
        const am  = gs?.phaseMeta?.answerMode;
        if ((am === 'vote_revealing' || am === 'vote_revealed') &&
            vrc != null && vrc !== lastVoteReveal.current) {
          const prevCursor = lastVoteReveal.current;
          lastVoteReveal.current = vrc;
          if (prevCursor != null) {
            // L'option qui vient d'être révélée est à l'index (vrc - 1)
            const justRevealedOption = gs?.voteState?.options?.[vrc - 1];
            play(justRevealedOption?.isDecoy ? 'wrong' : 'cashRegister');
          }
        } else if (am !== 'vote_revealing' && am !== 'vote_revealed') {
          lastVoteReveal.current = null;
        }

        // ── Countdown timer ──────────────────────────────────────
        const timer   = gs?.phaseMeta?.timer;
        const timerOn = !!(timer?.remainingSec > 0);
        if (timerOn && !lastTimerActive.current) {
          startCountdown(timer.remainingSec);
          ducking(true);
        } else if (!timerOn && lastTimerActive.current) {
          stopCountdown();
          ducking(false);
          play('wrong');
        }
        lastTimerActive.current = timerOn;

        // ── New player in lobby sound ────────────────────────────
        const connCount = pls.filter(p => p.connected).length;
        if (phase === 'lobby' && connCount > lastPlayerCount.current && lastPlayerCount.current > 0) {
          play('answer');
        }
        lastPlayerCount.current = connCount;
      }

      // Always update phase ref (used for next comparison)
      lastPhaseRef.current = phase;
    });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      s.disconnect();
    };
  }, []); // eslint-disable-line

  // ── Host action helper ──────────────────────────────────────
  const hostAction = useCallback((action, extra = {}, cb) => {
    if (!socket) return;
    socket.emit('host:action', {
      sessionCode: hostSession.sessionCode,
      hostKey:     hostSession.hostKey,
      action,
      ...extra,
    }, (res) => {
      if (res && !res.ok) {
        window.dispatchEvent(new CustomEvent('quiz:host-error', {
          detail: { action, message: res.error || 'Action impossible.' },
        }));
      }
      if (cb) cb(res);
    });
  }, [socket, hostSession.sessionCode, hostSession.hostKey]);

  // ── API helper ───────────────────────────────────────────────
  const apiFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    });
    return res.json();
  }, []);

  const value = useMemo(() => ({
    page, navigate,
    socket,
    gameState, players, teams, lbPlayers, lbTeams,
    playerSession, setPlayerSession,
    hostSession,   setHostSession,
    displaySession, setDisplaySession,
    adminQuizzes,  setAdminQuizzes,
    editingQuiz,   setEditingQuiz,
    hostAction, apiFetch,
    soundPlay: play,
    musicMuted: muted, toggleMute, ducking, silenceForVideo,
  }), [
    page, navigate,
    socket,
    gameState, players, teams, lbPlayers, lbTeams,
    playerSession,
    hostSession,
    displaySession,
    adminQuizzes,
    editingQuiz,
    hostAction, apiFetch,
    play,
    muted, toggleMute, ducking, silenceForVideo,
  ]);

  return React.createElement(GameContext.Provider, { value }, children);
}
