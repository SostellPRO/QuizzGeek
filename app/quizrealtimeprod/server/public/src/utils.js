import React from 'react';
import htm from 'htm';

export const html = htm.bind(React.createElement);

export const uid = (pre = 'id') =>
  `${pre}_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

export const randCode = () =>
  Math.floor(1000 + Math.random() * 9000).toString();

export const resolveMedia = (url) => {
  if (!url) return '';
  const raw = String(url).trim();
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  const cleaned = raw
    .replace(/\\/g, '/')
    .replace(/^public\//i, '')
    .replace(/^server\/public\//i, '');
  return cleaned.startsWith('/') ? cleaned : '/' + cleaned;
};

export const mediaKind = (url = '') => {
  const clean = String(url).split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov|ogv)$/.test(clean)) return 'video';
  if (/\.(mp3|wav|ogg|webm)$/.test(clean)) return 'audio';
  return 'image';
};

export const cloneData = (value) => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
};

export const OPTION_LABELS = ['A','B','C','D','E','F'];

// Empty quiz template
export const emptyQuiz = () => ({
  id: uid('quiz_q'),
  title: 'Nouveau quiz',
  welcomeImageUrl: '',
  welcomeMusicUrl: '',
  ceremonyBackgroundUrl: '',
  ceremonyMusicUrl: '',
  closingCeremony: {
    backgroundUrl: '',
    musicUrl: '',
    rankComments: {
      '1':  '🏆 Champion(ne) absolu(e) !',
      '2':  '🥈 Vice-champion(ne)',
      '3':  '🥉 Sur le podium !',
      '4':  '4ème… si près du podium !',
      '5':  '5ème place — bien joué !',
      '6':  '6ème — bonne tentative',
      '7':  '7ème — dans la moyenne',
      '8':  '8ème — il y a du progrès',
      '9':  '9ème — la prochaine fois !',
      '10': '10ème — tu as participé, c\'est déjà ça',
    },
  },
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
  introMusicUrl: '',
  gameMusicUrl: '',
  endMusicUrl: '',
  trainingVideoUrl: '',
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
  items: type === 'burger' ? Array.from({ length: 10 }, (_, i) => ({ id: uid('item'), text: `Elément ${i + 1}`, mediaUrl: '' })) : [],
  trainingVideoUrl: '',
  videoUrl: '',
  points: 100,
  timer: 30,
});

// Round type labels/icons
export const ROUND_TYPES = {
  qcm:             { label: 'QCM',             icon: '🔘', iconName: 'category', color: '#b24bff' },
  rapidite:        { label: 'Rapidité',        icon: '⚡', iconName: 'rapidite', color: '#f7971e' },
  true_false:      { label: 'Vrai / Faux',     icon: '✅', iconName: 'correct', color: '#38ef7d' },
  burger:          { label: 'Burger de la mort', icon: '🍔', iconName: 'burger', color: '#f7971e' },
  vote:            { label: 'Vote',            icon: '🗳️', iconName: 'vote', color: '#4facfe' },
  video_challenge: { label: 'Challenge Vidéo', icon: '🎬', iconName: 'karaoke', color: '#ff4e6a' },
};
