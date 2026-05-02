import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
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
  const { muted, setUrl: setMusicUrl, toggleMute, ducking } = useMusic();

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

  // ── Socket init ──────────────────────────────────────────────
  useEffect(() => {
    const s = window.io();
    setSocket(s);

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

      // ── Phase music ─────────────────────────────────────────
      const phase = gs?.status;
      const round = gs?.currentRound;
      const getPhaseMusic = () => {
        if (!gs) return '';
        if (phase === 'lobby')  return resolveMedia(gs.quizWelcomeMusicUrl || '');
        if (phase === 'end')    return resolveMedia(gs.ceremonyMusicUrl || '');
        if (phase === 'round_intro') return resolveMedia(round?.introMusicUrl || round?.musicUrl || '');
        if (['get_ready','question','waiting','manual_scoring','answer_reveal'].includes(phase))
          return resolveMedia(round?.gameMusicUrl || round?.musicUrl || '');
        if (['round_end','results'].includes(phase)) return resolveMedia(round?.endMusicUrl || '');
        return '';
      };
      setMusicUrl(getPhaseMusic());

      // ── Sound effects on phase change ───────────────────────
      if (phase !== lastPhaseRef.current) {
        if (phase === 'round_intro') play('bell');
        else if (phase === 'get_ready') play('answer');
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
        lastPhaseRef.current = phase;
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

      // ── Vote reveal sound ────────────────────────────────────
      const vrc = gs?.voteState?.revealCursor;
      const am  = gs?.phaseMeta?.answerMode;
      if ((am === 'vote_revealing' || am === 'vote_revealed') &&
          vrc != null && vrc !== lastVoteReveal.current) {
        const justRevealed = lastVoteReveal.current != null;
        lastVoteReveal.current = vrc;
        if (justRevealed) play('cashRegister');
      } else if (am !== 'vote_revealing' && am !== 'vote_revealed') {
        lastVoteReveal.current = null;
      }

      // ── Countdown timer ──────────────────────────────────────
      const timer      = gs?.phaseMeta?.timer;
      const timerOn    = !!(timer?.remainingSec > 0);
      const wasTimerOn = lastTimerActive.current;
      if (timerOn && !wasTimerOn) {
        startCountdown(timer.remainingSec);
        ducking(true);
      } else if (!timerOn && wasTimerOn) {
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
    });

    return () => s.disconnect();
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
      if (cb) cb(res);
    });
  }, [socket, hostSession]);

  // ── API helper ───────────────────────────────────────────────
  const apiFetch = useCallback(async (path, opts = {}) => {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...opts.headers },
      ...opts,
    });
    return res.json();
  }, []);

  const value = {
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
    musicMuted: muted, toggleMute,
  };

  return React.createElement(GameContext.Provider, { value }, children);
}
