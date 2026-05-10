import { useRef, useCallback } from 'react';

const SND_MAP = {
  button:            { src: '/sounds/04button.mp3',                vol: 0.42 },
  nav:               { src: '/sounds/04button.mp3',                vol: 0.34 },
  answer:            { src: '/sounds/04button.mp3',                vol: 0.46 },
  vote:              { src: '/sounds/04button.mp3',                vol: 0.46 },
  select:            { src: '/sounds/04button.mp3',                vol: 0.42 },
  buzzer:            { src: '/sounds/06error2.mp3',                vol: 0.78 },
  correct:           { src: '/sounds/05confirm%20success.mp3',     vol: 0.76 },
  success:           { src: '/sounds/05confirm%20success.mp3',     vol: 0.68 },
  rightNotification: { src: '/sounds/02right%20notification.mp3',  vol: 0.56 },
  notification:      { src: '/sounds/03notification.mp3',          vol: 0.58 },
  allAnswered:       { src: '/sounds/03notification.mp3',          vol: 0.62 },
  wrong:             { src: '/sounds/01wrong%20answer.mp3',        vol: 0.72 },
  error:             { src: '/sounds/06error2.mp3',                vol: 0.68 },
  deduct:            { src: '/sounds/deduct.mp3',                  vol: 0.68 },
  cashRegister:      { src: '/sounds/cashregister.mp3',            vol: 0.62 },
  fanfare:           { src: '/sounds/fanfare.mp3',                 vol: 0.72 },
  bell:              { src: '/sounds/bell.mp3',                    vol: 0.66 },
  countdown:         { src: '/sounds/countdown.mp3',               vol: 0.55 },
};

function vibrate(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

export function useSounds() {
  const countdownRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const lastPlayedRef = useRef(new Map());

  const getBaseAudio = useCallback((type, src) => {
    const cache = audioCacheRef.current;
    if (!cache.has(type)) {
      cache.set(type, new Audio(src));
    }
    return cache.get(type);
  }, []);

  const play = useCallback((type) => {
    if (type === 'answer' || type === 'button' || type === 'vote') vibrate(18);
    else if (type === 'buzzer')                      vibrate(40);
    else if (type === 'correct' || type === 'success') vibrate([30, 40, 60]);
    else if (type === 'wrong' || type === 'deduct' || type === 'error') vibrate([50, 30, 50]);
    else if (type === 'cashRegister')                vibrate([20, 30, 40]);

    const s = SND_MAP[type];
    if (!s?.src) return;
    const now = performance.now();
    const lastKey = s.src;
    if (now - (lastPlayedRef.current.get(lastKey) || 0) < 95) return;
    lastPlayedRef.current.set(lastKey, now);
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
