import React from 'react';
import htm from 'htm';

export const html = htm.bind(React.createElement);

export const uid = (pre = 'id') =>
  `${pre}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

export const randCode = () =>
  Math.floor(1000 + Math.random() * 9000).toString();

export const resolveMedia = (url) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : url.startsWith('/') ? url : '/' + url;
};

export const cn = (...classes) => classes.filter(Boolean).join(' ');

// Format a score with + or - sign
export const fmtScore = (n) => (n > 0 ? `+${n}` : String(n));

// Truncate text
export const trunc = (s, len = 60) =>
  typeof s === 'string' && s.length > len ? s.slice(0, len) + '…' : (s || '');

// Empty quiz template
export const emptyQuiz = () => ({
  id: uid('quiz_q'),
  title: 'Nouveau quiz',
  welcomeImageUrl: '',
  welcomeMusicUrl: '',
  ceremonyBackgroundUrl: '',
  ceremonyMusicUrl: '',
  rounds: [],
});

// Empty round template
export const emptyRound = () => ({
  id: uid('round'),
  title: 'Manche 1',
  type: 'qcm',
  scoringMode: 'auto',
  scoringTarget: 'individual',
  shortRules: 'qcm',
  backgroundUrl: '',
  musicUrl: '',
  questions: [],
});

// Empty question template
export const emptyQuestion = (type = 'qcm') => ({
  id: uid('q'),
  content: '',
  mediaUrl: '',
  type,
  options: type === 'qcm' || type === 'true_false' ? [
    { id: uid('opt'), text: '', mediaUrl: '' },
    { id: uid('opt'), text: '', mediaUrl: '' },
    { id: uid('opt'), text: '', mediaUrl: '' },
    { id: uid('opt'), text: '', mediaUrl: '' },
  ] : [],
  correctOptionIndex: 0,
  correctAnswer: '',
  points: 100,
  timer: 30,
});

// Round type labels/icons
export const ROUND_TYPES = {
  qcm:             { label: 'QCM',             icon: '🔘', color: '#b24bff' },
  rapidite:        { label: 'Rapidité',        icon: '⚡', color: '#f7971e' },
  true_false:      { label: 'Vrai / Faux',     icon: '✅', color: '#38ef7d' },
  burger:          { label: 'Burger de la mort', icon: '🍔', color: '#f7971e' },
  vote:            { label: 'Vote',            icon: '🗳️', color: '#4facfe' },
  video_challenge: { label: 'Challenge Vidéo', icon: '🎬', color: '#ff4e6a' },
};

export const PHASE_LABELS = {
  lobby:          { label: 'Lobby',            badge: 'blue' },
  round_intro:    { label: 'Présentation',     badge: 'orange' },
  training_video: { label: 'Vidéo entraîn.', badge: 'orange' },
  get_ready:      { label: 'Prêts',            badge: 'green' },
  question:       { label: 'Question',         badge: 'orange' },
  waiting:        { label: 'Attente',          badge: 'orange' },
  answer_reveal:  { label: 'Révélation',       badge: 'green' },
  manual_scoring: { label: 'Arbitrage',        badge: 'orange' },
  round_end:      { label: 'Fin manche',       badge: 'green' },
  results:        { label: 'Résultats',        badge: 'blue' },
  end:            { label: 'Fin du quiz',      badge: 'green' },
};
