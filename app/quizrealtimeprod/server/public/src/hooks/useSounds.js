import { useRef, useCallback } from 'react';

const SND_MAP = {
  answer:       { src: '/sounds/answer.mp3',      vol: 0.65 },
  buzzer:       { src: '/sounds/spacebar.mp3',     vol: 0.85 },
  correct:      { src: '/sounds/correct.mp3',      vol: 0.70 },
  wrong:        { src: '/sounds/wrong.mp3',        vol: 0.70 },
  deduct:       { src: '/sounds/deduct.mp3',       vol: 0.65 },
  cashRegister: { src: '/sounds/cashregister.mp3', vol: 0.65 },
  fanfare:      { src: '/sounds/fanfare.mp3',      vol: 0.75 },
  bell:         { src: '/sounds/bell.mp3',         vol: 0.70 },
  countdown:    { src: '/sounds/countdown.mp3',    vol: 0.55 },
};

function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

export function useSounds() {
  const countdownRef = useRef(null);
  const audioCacheRef = useRef(new Map());

  const getBaseAudio = useCallback((type, src) => {
    const cache = audioCacheRef.current;
    if (!cache.has(type)) {
      cache.set(type, new Audio(src));
    }
    return cache.get(type);
  }, []);

  const play = useCallback((type) => {
    if (type === 'answer')                           vibrate(25);
    else if (type === 'buzzer')                      vibrate(40);
    else if (type === 'correct')                     vibrate([30, 40, 60]);
    else if (type === 'wrong' || type === 'deduct')  vibrate([50, 30, 50]);
    else if (type === 'cashRegister')                vibrate([20, 30, 40]);

    const s = SND_MAP[type];
    if (!s?.src) return;
    try {
      const a = getBaseAudio(type, s.src).cloneNode();
      a.volume = s.vol;
      a.play().catch(() => {});
    } catch {}
  }, [getBaseAudio]);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      try { countdownRef.current.pause(); countdownRef.current.src = ''; } catch {}
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback((remainingSec) => {
    stopCountdown();
    const a = new Audio('/sounds/countdown.mp3');
    a.volume = 0.55;
    const seekSec = Math.max(0, 63 - (remainingSec + 1));
    a.currentTime = seekSec;
    a.play().catch(() => {});
    countdownRef.current = a;
  }, [stopCountdown]);

  return { play, startCountdown, stopCountdown };
}
