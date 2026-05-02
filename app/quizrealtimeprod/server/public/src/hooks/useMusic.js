import { useRef, useState, useCallback, useEffect } from 'react';

let _audioEl = null;
let _currentUrl = null;

function getOrCreateAudio() {
  if (!_audioEl) {
    _audioEl = document.createElement('audio');
    _audioEl.id = 'bg-round-music';
    _audioEl.loop = true;
    _audioEl.style.display = 'none';
    document.body.appendChild(_audioEl);
  }
  return _audioEl;
}

export function useMusic() {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  const setUrl = useCallback((url) => {
    if (!url) {
      if (_audioEl) { _audioEl.pause(); _audioEl.src = ''; }
      _currentUrl = null;
      return;
    }
    if (url === _currentUrl) {
      if (_audioEl && !mutedRef.current && _audioEl.paused && _audioEl.src) {
        _audioEl.play().catch(() => {});
      }
      return;
    }
    _currentUrl = url;
    const el = getOrCreateAudio();
    el.src = url;
    if (!mutedRef.current) {
      el.play().catch(() => {});
    }
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !mutedRef.current;
    mutedRef.current = newMuted;
    setMuted(newMuted);
    if (_audioEl) {
      if (newMuted) _audioEl.pause();
      else _audioEl.play().catch(() => {});
    }
  }, []);

  const ducking = useCallback((duck) => {
    if (!_audioEl) return;
    if (duck) {
      _audioEl.volume = 0.15;
    } else {
      if (!mutedRef.current) {
        _audioEl.volume = 1.0;
        _audioEl.play().catch(() => {});
      }
    }
  }, []);

  return { muted, setUrl, toggleMute, ducking };
}
