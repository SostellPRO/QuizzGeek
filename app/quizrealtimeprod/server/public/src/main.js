import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameProvider } from './contexts/GameContext.js';
import App from './App.js';

let lastGlobalUiSoundAt = 0;
let globalUiAudio = null;

document.addEventListener('pointerup', (event) => {
  const button = event.target?.closest?.('.ui-btn');
  if (!button || button.disabled || button.dataset.variant) return;
  try { navigator.vibrate?.(12); } catch {}
  try {
    const now = performance.now();
    if (now - lastGlobalUiSoundAt < 70) return;
    lastGlobalUiSoundAt = now;
    globalUiAudio ||= new Audio('/sounds/04button.mp3');
    globalUiAudio.preload = 'auto';
    const audio = globalUiAudio.cloneNode();
    audio.volume = 0.38;
    audio.play().catch(() => {});
  } catch {}
}, { passive: true });

const root = createRoot(document.getElementById('root'));
root.render(
  React.createElement(GameProvider, null,
    React.createElement(App)
  )
);
