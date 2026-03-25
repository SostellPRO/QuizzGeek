/* ============================================================
   Quiz Live – Application principale (vanilla JS + Socket.IO)
   ============================================================ */

'use strict';

// ── Configuration ────────────────────────────────────────────
const API = '';  // URLs relatives – le serveur sert à la fois l'API et le front

// ── État global ──────────────────────────────────────────────
const state = {
  socket: null,
  currentPage: 'home',

  // Données temps réel (mises à jour par game:state)
  gameState: null,
  players: [],
  teams: [],
  leaderboardPlayers: [],
  leaderboardTeams: [],

  // Page Player
  playerSession: null,   // { playerId, pseudo, sessionCode, reconnectToken, teamId, teamName }

  // Page Host
  host: { sessionCode: '', hostKey: '', connected: false },

  // Page Display
  display: { sessionCode: '', connected: false },

  // Admin: quiz en cours d'édition
  admin: { quizzes: [], editingQuiz: null, activeRoundIndex: 0, ceremonyView: 'players' },
};

// ── Utilitaires DOM ──────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function el(tag, cls, html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function html(id, content) {
  const node = document.getElementById(id);
  if (node) node.innerHTML = content;
}

function show(id) { const n = document.getElementById(id); if (n) n.style.display = ''; }
function hide(id) { const n = document.getElementById(id); if (n) n.style.display = 'none'; }

function alert$(containerId, msg, type = 'info') {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = msg ? `<div class="alert alert-${type}">${msg}</div>` : '';
}

function resolveMedia(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : (url.startsWith('/') ? url : '/' + url);
}

function uid(pre = 'id') { return `${pre}_${Math.random().toString(36).slice(2,9)}_${Date.now()}`; }

function randCode() { return Math.floor(1000 + Math.random() * 9000).toString(); }

// ── Tracking état local ───────────────────────────────────────
let _lastBuzzerResultAt   = null;
let _lastBuzzerFirstId    = null;  // pour détecter le premier buzzer d'une question
let _currentMusicUrl      = null;
let _buzzerCooldownTimer  = null;  // setInterval pour le compte à rebours du cooldown
let _lastVoteRevealCursor = null;  // pour détecter un nouveau reveal de vote
let _displayQuestionId    = null;  // pour éviter le clignotement de la question card au tick timer
let _displayAnswerCount   = -1;   // pour détecter une nouvelle réponse et animer le compteur TV
let _showAllTeams         = false; // afficher toutes les équipes dans le formulaire de connexion
let _getReadyTimer        = null;  // timer du compte à rebours "tenez-vous prêts"
let _dragSrcRoundIdx      = null;  // index de la manche en cours de drag
let _dragSrcQIdx          = null;  // index de la question en cours de drag
let _dragSrcQRoundId      = null;  // roundId de la question en cours de drag
let _countdownAudio       = null;  // élément audio pour le son countdown pendant le timer
let _lastTimerActive      = false; // état précédent du timer (actif ou non)
let _lastPhase            = null;  // phase précédente pour détecter les transitions
let _lastPlayerCount      = 0;     // nombre de joueurs précédent pour détecter les nouveaux

// ── P6 : Sons d'interaction (fichiers MP3) ────────────────────
// ── Vibration haptique (mobile) — couplée à playSound ──────────
function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch { /* noop si non supporté */ }
}

// Table des fichiers MP3 et leurs volumes (0–1)
const _SND = {
  answer:       { src: '/sounds/answer.mp3',       vol: 0.65 },
  buzzer:       { src: '/sounds/spacebar.mp3',      vol: 0.85 },
  correct:      { src: '/sounds/correct.mp3',       vol: 0.70 },
  wrong:        { src: '/sounds/wrong.mp3',         vol: 0.70 },
  deduct:       { src: '/sounds/deduct.mp3',        vol: 0.65 },
  cashRegister: { src: '/sounds/cashregister.mp3',  vol: 0.65 },
  nav:          { src: null,                        vol: 0    },
};

function playSound(type) {
  // Vibration haptique adaptée au type de son
  if (type === 'answer')                          vibrate(25);
  else if (type === 'buzzer')                     vibrate(40);
  else if (type === 'correct')                    vibrate([30, 40, 60]);
  else if (type === 'wrong' || type === 'deduct') vibrate([50, 30, 50]);
  else if (type === 'cashRegister')               vibrate([20, 30, 40]);
  else if (type === 'nav')                        vibrate(15);

  const s = _SND[type];
  if (!s?.src) return;
  try {
    const a = new Audio(s.src);
    a.volume = s.vol;
    a.play().catch(() => {});
  } catch { /* noop */ }
}

// ── Arrêt du son countdown ─────────────────────────────────────────────────────
function _stopCountdownAudio() {
  if (_countdownAudio) {
    try { _countdownAudio.pause(); _countdownAudio.src = ''; } catch { }
    _countdownAudio = null;
  }
}

// ── Son joyeux buzzer correct (fanfare MP3) ───────────────────────────────────
let _lastBuzzerWinnerId = null;
function playBuzzerCorrectSound() {
  try {
    const a = new Audio('/sounds/fanfare.mp3');
    a.volume = 0.75;
    a.play().catch(() => {});
  } catch { /* noop */ }
}

// ── Musique de fond (gestion persistante – ne redémarre pas au re-render) ──
let _musicMuted = false;

function updateRoundMusic(url) {
  let el = document.getElementById('bg-round-music');
  if (!url) {
    if (el) { el.pause(); el.src = ''; }
    _currentMusicUrl = null;
    _ensureMuteButton();
    return;
  }
  if (url === _currentMusicUrl) {
    // Même URL : vérifier si la musique est en pause (ex: après mute + unmute)
    if (el && !_musicMuted && el.paused && el.src) {
      el.play().catch(() => {});
    }
    return;
  }
  _currentMusicUrl = url;
  if (!el) {
    el = document.createElement('audio');
    el.id   = 'bg-round-music';
    el.loop = true;
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  el.src = resolveMedia(url);
  if (!_musicMuted) {
    el.play().catch(() => {/* autoplay bloqué – l'utilisateur doit interagir d'abord */});
  }
  _ensureMuteButton();
}

function _ensureMuteButton() {
  if (state.currentPage !== 'display') return;
  let btn = document.getElementById('music-mute-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'music-mute-btn';
    btn.className = 'music-mute-btn' + (_musicMuted ? ' muted' : '');
    btn.title = 'Couper/activer la musique';
    btn.innerHTML = _musicMuted ? '🔇' : '🔊';
    btn.onclick = toggleMusicMute;
    document.body.appendChild(btn);
  } else {
    btn.className = 'music-mute-btn' + (_musicMuted ? ' muted' : '');
    btn.innerHTML = _musicMuted ? '🔇' : '🔊';
  }
}

function toggleMusicMute() {
  _musicMuted = !_musicMuted;
  const el = document.getElementById('bg-round-music');
  if (el) {
    if (_musicMuted) { el.pause(); }
    else { el.play().catch(() => {}); }
  }
  _ensureMuteButton();
}
window.toggleMusicMute = toggleMusicMute;

function closeModal(id) { const m = document.getElementById(id); if (m) m.remove(); }

// ── Socket.IO ────────────────────────────────────────────────
function initSocket() {
  state.socket = io();

  state.socket.on('connect', () => {
    console.log('[socket] connecté', state.socket.id);
  });

  state.socket.on('disconnect', () => {
    console.log('[socket] déconnecté');
  });

  state.socket.on('player:message', (bm) => {
    // Message ciblé direct (vers un joueur ou une équipe spécifique)
    showPlayerDirectMessage(bm);
  });

  // Éjection de tous les joueurs vers l'écran de connexion
  state.socket.on('game:players_ejected', () => {
    // Si le joueur est en partie, le renvoyer vers l'écran de rejoindre
    if (state.currentPage === 'player') {
      state.playerSession = null;
      state.gameState = null;
      state.players = [];
      state.teams = [];
      localStorage.removeItem('quiz_player_session');
      navigate('player');  // l'écran player affiche le formulaire de connexion si playerSession = null
    }
  });

  state.socket.on('game:state', (payload) => {
    state.gameState      = payload?.gameState      || null;
    state.players        = payload?.players        || [];
    state.teams          = payload?.teams          || [];
    state.leaderboardPlayers = payload?.leaderboardPlayers || [];
    state.leaderboardTeams   = payload?.leaderboardTeams   || [];

    // Fermer le récap joueur si nouvelle question
    checkAndCloseRecapOnNewQuestion();

    // Synchroniser la vue cérémonie depuis le serveur
    const serverCeremonyView = state.gameState?.phaseMeta?.ceremonyView;
    if (serverCeremonyView && serverCeremonyView !== state.admin.ceremonyView) {
      state.admin.ceremonyView = serverCeremonyView;
    }

    // Détecter qu'un joueur vient de buzzer (côté display TV)
    const buzzerFirstId = state.gameState?.buzzerState?.firstPlayerId;
    if (buzzerFirstId && buzzerFirstId !== _lastBuzzerFirstId) {
      _lastBuzzerFirstId = buzzerFirstId;
      if (state.currentPage === 'display') {
        playSound('buzzer');
      }
    } else if (!buzzerFirstId) {
      _lastBuzzerFirstId = null; // réinitialiser entre les rounds
    }

    // Détecter changement de résultat buzzer pour jouer un son (côté display)
    const blr = state.gameState?.buzzerLastResult;
    if (blr && blr.at && blr.at !== _lastBuzzerResultAt) {
      _lastBuzzerResultAt = blr.at;
      if (state.currentPage === 'display' || state.currentPage === 'player') {
        playSound(blr.result === 'correct' ? 'correct' : 'wrong');
      }
    }

    // Détecter une nouvelle révélation de vote (cursor avancé)
    const voteRevealCursor = state.gameState?.voteState?.revealCursor;
    const answerModeNow = state.gameState?.phaseMeta?.answerMode;
    if ((answerModeNow === 'vote_revealing' || answerModeNow === 'vote_revealed') &&
        voteRevealCursor != null && voteRevealCursor !== _lastVoteRevealCursor) {
      const justRevealed = _lastVoteRevealCursor != null; // pas la première fois
      _lastVoteRevealCursor = voteRevealCursor;
      if (justRevealed && (state.currentPage === 'display' || state.currentPage === 'host')) {
        // Jouer le son de caisse enregistreuse
        playSound('cashRegister');
        // Déclencher l'animation floating score sur le display
        if (state.currentPage === 'display') {
          triggerVoteRevealAnimation(state.gameState);
        }
      }
    } else if (answerModeNow !== 'vote_revealing' && answerModeNow !== 'vote_revealed') {
      _lastVoteRevealCursor = null; // réinitialiser entre les questions
    }

    // ── Détection transitions de phase (sons + countdown) ──────────────────────
    const _nowPhase = state.gameState?.status;
    const _nowTimer = state.gameState?.phaseMeta?.timer;
    const _timerActive = !!(_nowTimer?.remainingSec > 0);
    const _nowPlayerCount = state.players.filter(p => p.connected).length;

    // Son quand une nouvelle phase démarre
    if (_nowPhase !== _lastPhase) {
      if (_nowPhase === 'round_intro') {
        // Annonce d'une nouvelle manche → cloche
        playBellSound();
      } else if (_nowPhase === 'get_ready') {
        // Écran d'attente → petit son de préparation
        playSound('answer');
      } else if (_nowPhase === 'answer_reveal') {
        // Révélation de la réponse → auto-play de la musique de révélation si définie
        const _revAudio = state.gameState?.revealedAnswer?.revealAudio;
        if (_revAudio) {
          setTimeout(() => {
            const _player = document.getElementById('reveal-audio-player');
            if (_player) _player.play().catch(() => {});
          }, 400);
        }
      } else if (_nowPhase === 'round_end') {
        // Fin de manche → fanfare
        playBuzzerCorrectSound();
      } else if (_nowPhase === 'results' || _nowPhase === 'end') {
        // Résultats finaux → grande fanfare
        playBuzzerCorrectSound();
      }
      _lastPhase = _nowPhase;
    }

    // Nouveau joueur dans le lobby → son de notification
    if (_nowPhase === 'lobby' && _nowPlayerCount > _lastPlayerCount && _lastPlayerCount > 0) {
      playSound('answer');
    }
    _lastPlayerCount = _nowPlayerCount;

    // Gestion du son countdown pendant le timer
    if (_timerActive && !_lastTimerActive) {
      // Timer démarre → lancer countdown.mp3
      _stopCountdownAudio();
      _countdownAudio = new Audio('/sounds/countdown.mp3');
      _countdownAudio.volume = 0.55;
      // Positionner dans la piste selon le temps restant (la piste dure ~63s)
      const _seekSec = Math.max(0, 63 - (_nowTimer.remainingSec + 1));
      _countdownAudio.currentTime = _seekSec;
      // Mettre en pause la musique de fond temporairement
      const _bgMusic = document.getElementById('bg-round-music');
      if (_bgMusic && !_bgMusic.paused) { _bgMusic.volume = 0.15; }
      _countdownAudio.play().catch(() => {});
    } else if (!_timerActive && _lastTimerActive) {
      // Timer s'arrête → arrêter countdown, restaurer musique
      _stopCountdownAudio();
      const _bgMusic = document.getElementById('bg-round-music');
      if (_bgMusic && !_musicMuted) { _bgMusic.volume = 1.0; _bgMusic.play().catch(() => {}); }
      // Son de fin de timer
      playSound('wrong');
    }
    _lastTimerActive = _timerActive;

    // Mettre à jour la page courante si elle est active
    if (state.currentPage === 'player') {
      // BUG FIX: Préserver le brouillon de la textarea (vote/saisie texte)
      // pour éviter que la soumission d'un autre joueur efface le texte en cours
      const _draftAnswer = document.getElementById('text-answer')?.value || '';
      renderPlayerGame();
      if (_draftAnswer) {
        const _ta = document.getElementById('text-answer');
        if (_ta) _ta.value = _draftAnswer;
      }
    }
    if (state.currentPage === 'host')    renderHostGame();
    if (state.currentPage === 'display') renderDisplay();
  });
}

// ── Routeur ──────────────────────────────────────────────────
const pageInits = {};

function navigate(page) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('nav button[data-page]').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (!pageEl) { navigate('home'); return; }
  pageEl.classList.add('active');

  const navBtn = $(`nav button[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  state.currentPage = page;
  window.location.hash = page;

  pageInits[page]?.();
}

// ── API helpers ──────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  return res.json();
}

// ── Page : HOME ──────────────────────────────────────────────
pageInits.home = function() {
  html('page-home', `
    <div class="home-hero">
      <div class="home-hero-logo">🎮</div>
      <h1 class="home-hero-title">QuizzGeek</h1>
      <p class="home-hero-sub">Quiz en temps réel · Buzzers · Votes · Podium</p>
    </div>
    <div class="home-roles">
      <button class="home-role-btn home-role-player" onclick="navigate('player');playSound('nav')">
        <span class="home-role-icon">📱</span>
        <span class="home-role-label">Jouer</span>
        <span class="home-role-sub">Rejoindre une partie</span>
      </button>
      <button class="home-role-btn home-role-host" onclick="navigate('host');playSound('nav')">
        <span class="home-role-icon">🎤</span>
        <span class="home-role-label">Maître de jeu</span>
        <span class="home-role-sub">Animer et piloter</span>
      </button>
      <button class="home-role-btn home-role-display" onclick="navigate('display');playSound('nav')">
        <span class="home-role-icon">📺</span>
        <span class="home-role-label">Écran TV</span>
        <span class="home-role-sub">Affichage grand écran</span>
      </button>
      <button class="home-role-btn home-role-admin" onclick="navigate('admin');playSound('nav')">
        <span class="home-role-icon">⚙️</span>
        <span class="home-role-label">Admin</span>
        <span class="home-role-sub">Créer les quiz</span>
      </button>
    </div>
    <div class="home-round-types">
      <div class="home-rt home-rt-qcm">🔘 QCM</div>
      <div class="home-rt home-rt-rapide">⚡ Rapidité</div>
      <div class="home-rt home-rt-tf">✅ Vrai/Faux</div>
      <div class="home-rt home-rt-burger">🍔 Burger</div>
      <div class="home-rt home-rt-vote">🗳️ Vote</div>
    </div>
  `);
};

// ── P8 : Galerie d'avatars ────────────────────────────────────
const AVATARS = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
  '🦁','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🦇',
  '🐺','🐗','🦝','🦄','🦋','🐙','🦑','🐬','🦈','🐊',
  '🎮','🚀','⚡','🔥','🎸','🎯','🏆','💎','🌟','🍕',
];
const AVATARS_DEFAULT_VISIBLE = 12;
let _selectedAvatar = AVATARS[0];
let _showAllAvatars = false;

function selectAvatar(emoji) {
  _selectedAvatar = emoji;
  // Rafraîchir uniquement la grille pour éviter de perdre le focus
  const grid = document.getElementById('avatar-grid-container');
  if (grid) {
    grid.innerHTML = buildAvatarGridInner();
  }
}

function toggleAvatarExpand() {
  _showAllAvatars = !_showAllAvatars;
  const grid = document.getElementById('avatar-grid-container');
  if (grid) grid.innerHTML = buildAvatarGridInner();
}

function handleCustomAvatarUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo
  if (file.size > MAX_SIZE) {
    alert('Image trop volumineuse (max 5 Mo). Veuillez choisir une image plus petite.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // Redimensionner à max 128x128 pour l'avatar
      const MAX_DIM = 128;
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
        else { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      _selectedAvatar = canvas.toDataURL('image/jpeg', 0.85);
      const grid = document.getElementById('avatar-grid-container');
      if (grid) grid.innerHTML = buildAvatarGridInner();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function buildAvatarGridInner() {
  const visibleAvatars = _showAllAvatars ? AVATARS : AVATARS.slice(0, AVATARS_DEFAULT_VISIBLE);
  const isCustom = _selectedAvatar && _selectedAvatar.startsWith('data:');
  const avatarBtns = visibleAvatars.map(e => `<button type="button" class="avatar-opt ${e===_selectedAvatar?'active':''}" data-emoji="${e}" onclick="selectAvatar('${e}')">${e}</button>`).join('');
  const moreBtn = !_showAllAvatars
    ? `<button type="button" class="avatar-opt" onclick="toggleAvatarExpand()" title="Voir plus" style="font-size:.85rem;color:rgba(255,255,255,.6);">…</button>`
    : `<button type="button" class="avatar-opt" onclick="toggleAvatarExpand()" title="Réduire" style="font-size:.75rem;color:rgba(255,255,255,.5);">▲</button>`;
  const uploadBtn = `<label class="avatar-opt ${isCustom ? 'active' : ''}" title="Image personnalisée (max 5 Mo)" style="cursor:pointer;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;">
    ${isCustom ? `<img src="${_selectedAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">` : '<span style="font-size:1.4rem;">📷</span>'}
    <input type="file" accept="image/*" style="position:absolute;opacity:0;inset:0;cursor:pointer;" onchange="handleCustomAvatarUpload(this)">
  </label>`;
  return avatarBtns + moreBtn + uploadBtn;
}

function buildAvatarGrid() {
  return `<div>
    <label>Avatar <span class="muted" style="font-size:.78rem;">(optionnel)</span></label>
    <div id="avatar-grid-container" class="avatar-grid">
      ${buildAvatarGridInner()}
    </div>
  </div>`;
}

const TEAMS_DEFAULT_VISIBLE = 12;

function toggleTeamsExpand() {
  _showAllTeams = !_showAllTeams;
  const container = document.getElementById('teams-grid-container');
  if (container) container.innerHTML = buildTeamsGridInner(state.teams);
}

function buildTeamsGridInner(teams) {
  const visible = _showAllTeams ? teams : teams.slice(0, TEAMS_DEFAULT_VISIBLE);
  const rows = visible.map(t => `
    <label style="display:flex;align-items:center;gap:6px;padding:10px;border-radius:10px;
      border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);cursor:pointer;">
      <input type="radio" name="team-pick" value="${t.id}" style="accent-color:#79b8ff;">
      <span style="font-size:.9rem;">${t.name}</span>
    </label>`).join('');
  const noTeam = `
    <label style="display:flex;align-items:center;gap:6px;padding:10px;border-radius:10px;
      border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);cursor:pointer;">
      <input type="radio" name="team-pick" value="" checked style="accent-color:#79b8ff;">
      <span style="font-size:.9rem;color:rgba(255,255,255,.5);">Sans équipe</span>
    </label>`;
  const moreBtn = teams.length > TEAMS_DEFAULT_VISIBLE
    ? `<button type="button" onclick="toggleTeamsExpand()" style="grid-column:1/-1;padding:8px;border-radius:10px;
        border:1px dashed rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.5);
        cursor:pointer;font-size:.85rem;">
        ${_showAllTeams ? '▲ Réduire' : `… Voir les ${teams.length - TEAMS_DEFAULT_VISIBLE} autres équipes`}
      </button>`
    : '';
  return rows + noTeam + moreBtn;
}

// ── Page : PLAYER ────────────────────────────────────────────
pageInits.player = function() {
  // Restaurer session depuis localStorage
  if (!state.playerSession) {
    try {
      const raw = localStorage.getItem('quiz_player_session');
      if (raw) state.playerSession = JSON.parse(raw);
    } catch {}
  }

  // Lire code depuis URL ?join=CODE
  const urlCode = new URLSearchParams(window.location.search).get('join')?.toUpperCase() || '';

  if (state.playerSession) {
    // Tenter reconnexion auto
    reconnectPlayer();
  } else {
    renderPlayerJoin(urlCode);
  }
};

function renderPlayerJoin(suggestedCode = '') {
  _showAllTeams = false; // réinitialiser à chaque affichage

  // Cartes d'équipes si disponibles (12 par défaut, "voir plus" si besoin)
  const teamCards = state.teams.length
    ? `<div>
        <label>Choisir votre équipe</label>
        <div id="teams-grid-container" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-top:8px;">
          ${buildTeamsGridInner(state.teams)}
        </div>
      </div>`
    : '';

  html('page-player', `
    <div class="card" style="text-align:center;background:linear-gradient(135deg,rgba(240,147,251,.1),rgba(245,87,108,.1));">
      <h1>📱 Quiz Live</h1>
      <p class="muted">Rejoins une partie et joue avec tes amis !</p>
    </div>
    <div id="player-alert"></div>
    <div class="card">
      <h2>Rejoindre la partie</h2>
      <div style="display:grid;gap:14px;margin-top:12px;">
        <div>
          <label>Code de session</label>
          <input id="in-session-code" placeholder="ex: 1234" value="${suggestedCode}"
            style="font-size:1.4rem;letter-spacing:4px;text-align:center;text-transform:uppercase;"
            oninput="this.value=this.value.toUpperCase();loadTeamsForCode(this.value)">
        </div>
        <div>
          <label>Pseudo</label>
          <input id="in-pseudo" placeholder="Votre nom de joueur" maxlength="32">
        </div>
        ${buildAvatarGrid()}
        ${teamCards}
        <button class="btn-primary" onclick="submitJoinPlayer()" style="margin-top:4px;">
          🚀 Rejoindre la partie
        </button>
      </div>
    </div>
  `);

  if (suggestedCode) loadTeamsForCode(suggestedCode);
}

function loadTeamsForCode(code) {
  if (!code || code.length < 4) return;
  fetch(`${API}/api/sessions/${code}`)
    .then(r => r.json())
    .then(d => {
      // Les équipes arriveront via game:state quand le socket rejoindra la session
    })
    .catch(() => {});
}

function submitJoinPlayer() {
  const sessionCode = ($('#in-session-code')?.value || '').trim().toUpperCase();
  const pseudo = ($('#in-pseudo')?.value || '').trim();
  const teamRadio = document.querySelector('input[name="team-pick"]:checked');
  const teamId = teamRadio?.value || null;

  if (!sessionCode) { alert$('player-alert', 'Code de session requis', 'error'); return; }
  if (!pseudo) { alert$('player-alert', 'Pseudo requis', 'error'); return; }

  state.socket.emit('join:player', { sessionCode, pseudo, teamId: teamId || null, avatar: _selectedAvatar || null }, (res) => {
    if (!res?.ok) {
      alert$('player-alert', res?.error || 'Impossible de rejoindre', 'error');
      return;
    }
    const session = {
      playerId: res.player.id,
      pseudo: res.player.pseudo,
      sessionCode,
      reconnectToken: res.player.reconnectToken,
      teamId: res.player.teamId || null,
      teamName: res.player.teamName || null,
      avatar: _selectedAvatar || '🎮',
    };
    state.playerSession = session;
    localStorage.setItem('quiz_player_session', JSON.stringify(session));
    renderPlayerGame();
  });
}

function reconnectPlayer() {
  const s = state.playerSession;
  if (!s?.sessionCode || !s?.reconnectToken) { renderPlayerJoin(); return; }

  state.socket.emit('player:reconnect', { sessionCode: s.sessionCode, reconnectToken: s.reconnectToken, avatar: s.avatar || null }, (res) => {
    if (!res?.ok) {
      state.playerSession = null;
      localStorage.removeItem('quiz_player_session');
      renderPlayerJoin();
      return;
    }
    const updated = {
      ...s,
      playerId: res.player.id,
      pseudo: res.player.pseudo,
      reconnectToken: res.player.reconnectToken,
      teamId: res.player.teamId || null,
      teamName: res.player.teamName || null,
    };
    state.playerSession = updated;
    localStorage.setItem('quiz_player_session', JSON.stringify(updated));
    renderPlayerGame();
  });
}

function renderPlayerGame() {
  const gs = state.gameState;
  const s  = state.playerSession;
  if (!s) { renderPlayerJoin(); return; }

  const myPlayer = state.players.find(p => p.id === s.playerId || p.playerId === s.playerId);
  const phase = gs?.status || 'lobby';

  const roundType = gs?.currentRound?.type || gs?.currentQuestion?.type || 'qcm';
  const roundTypeIcons = { qcm:'🔘', rapidite:'⚡', speed:'⚡', true_false:'✅', burger:'🍔', vote:'🗳️', video_challenge:'🎬' };
  const rtIcon = roundTypeIcons[roundType] || '🎯';

  let content = `
    <div class="session-banner">
      <span>Session : <strong class="session-code">${s.sessionCode}</strong></span>
      <span>${s.avatar || '🎮'} <strong>${s.pseudo}</strong>${s.teamName ? ` · ${s.teamName}` : ''}</span>
      <span style="margin-left:auto;color:#38ef7d;font-weight:700;">Score : ${myPlayer?.scoreTotal ?? 0}</span>
    </div>
    <div class="player-game-wrap" data-round-type="${roundType}">
    <div id="player-alert"></div>
  `;

  // Contenu selon la phase
  const isPaused = gs?.phaseMeta?.paused === true;

  if (isPaused) {
    content += `
      <div class="pause-screen">
        <div class="pause-icon">⏸️</div>
        <h2>Pause</h2>
        <p class="muted" style="margin-top:8px;">Le maître de jeu a mis la partie en pause…</p>
        <div class="waiting-dots" style="margin-top:20px;"><span></span><span></span><span></span></div>
      </div>`;
  } else if (phase === 'lobby') {
    const _lobbyConnected = state.players.filter(p => p.connected);
    const _lobbyChips = _lobbyConnected.map(p => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 12px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);min-width:64px;">
        <span style="font-size:1.6rem;line-height:1;">${p.avatar || '🎮'}</span>
        <span style="font-size:0.7rem;font-weight:700;color:rgba(255,255,255,0.85);white-space:nowrap;max-width:72px;overflow:hidden;text-overflow:ellipsis;">${p.pseudo || '?'}</span>
      </div>`).join('');
    content += `
      <div class="card" style="text-align:center;padding:28px 20px;">
        <div style="font-size:2.8rem;margin-bottom:12px;">⏳</div>
        <h2 style="margin-bottom:6px;">Salle d'attente</h2>
        <p class="muted" style="margin-bottom:18px;">En attente du maître de jeu…</p>
        <div style="font-size:.78rem;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.1em;font-weight:600;margin-bottom:12px;">${_lobbyConnected.length} joueur(s) connecté(s)</div>
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;">
          ${_lobbyChips || '<span style="color:rgba(255,255,255,.3);font-style:italic;">En attente…</span>'}
        </div>
      </div>`;
  } else if (phase === 'training_video') {
    content += `
      <div class="card" style="text-align:center;padding:50px 20px;background:rgba(255,215,0,.05);border-color:rgba(255,215,0,.2);">
        <div style="font-size:4rem;margin-bottom:16px;">🏋️</div>
        <h2 style="color:#ffd700;">Vidéo d'entraînement</h2>
        <p class="muted" style="margin-top:14px;">Regardez l'écran TV !</p>
        <div class="waiting-dots" style="margin-top:20px;"><span></span><span></span><span></span></div>
      </div>`;
  } else if (phase === 'round_intro') {
    const round = gs.currentRound;
    const rtLabels = { qcm:'QCM', rapidite:'Rapidité', speed:'Rapidité', true_false:'Vrai / Faux', burger:'Burger', vote:'Vote' };
    const rtLabel = rtLabels[round?.type] || round?.type || 'Quiz';
    content += `
      <div class="player-round-intro">
        <div class="round-intro-icon">${rtIcon}</div>
        <div class="round-intro-type-badge">${rtIcon} ${rtLabel}</div>
        <h2 class="round-intro-title">${round?.title || 'Nouvelle manche'}</h2>
        <p class="muted round-intro-rules">${round?.shortRules || 'Préparez-vous !'}</p>
        <div class="waiting-dots" style="margin-top:24px;"><span></span><span></span><span></span></div>
      </div>`;
  } else if (phase === 'get_ready') {
    const _rtIconsP = { qcm:'🔘', rapidite:'⚡', speed:'⚡', true_false:'✅', vote:'🗳️' };
    const _rtP = gs?.currentRound?.type || 'qcm';
    content += `
      <div class="player-get-ready">
        <div class="player-gr-icon">${_rtIconsP[_rtP] || '🎯'}</div>
        <h2 class="player-gr-title">Tenez-vous prêts !</h2>
        <p class="muted" style="margin-top:12px;font-size:.88rem;">Le maître de jeu va lancer la question…</p>
        <div class="waiting-dots" style="margin-top:20px;"><span></span><span></span><span></span></div>
      </div>`;
  } else if (phase === 'question' || phase === 'waiting') {
    // Burger : seul le joueur/équipe sélectionné joue, les autres attendent
    const burgerSelectedId   = gs?.burgerSelectedPlayerId;
    const burgerSelectedTeam = gs?.burgerSelectedTeamId;
    const isBurgerRound      = gs?.currentRound?.type === 'burger' || gs?.currentQuestion?.type === 'burger';
    const isMyTeamSelected   = burgerSelectedTeam && s.teamId === burgerSelectedTeam;
    const iAmSelected        = burgerSelectedId === s.playerId || isMyTeamSelected;
    if (isBurgerRound && (burgerSelectedId || burgerSelectedTeam)) {
      if (iAmSelected) {
        // Le joueur/équipe sélectionné(e) : écran "c'est ton tour"
        const isTeam = !!burgerSelectedTeam;
        content += `
          <div class="card" style="text-align:center;padding:50px 20px;background:rgba(247,151,30,.1);border-color:rgba(247,151,30,.5);">
            <div style="font-size:4rem;margin-bottom:16px;animation:end-bounce 1s ease-in-out infinite;">🍔</div>
            <h2 style="color:#f7971e;">${isTeam ? 'C\'est le tour de votre équipe !' : 'C\'est ton tour !'}</h2>
            <p style="margin-top:12px;font-size:1.1rem;">Regardez l'écran principal et mémorisez les éléments.</p>
            <p class="muted" style="margin-top:8px;">Quand c'est fini, récitez-les tous dans l'ordre !</p>
          </div>`;
      } else {
        // Les autres joueurs attendent
        const burgerPseudo = gs?.burgerSelectedPseudo || 'Un joueur';
        const isTeamMode   = !!burgerSelectedTeam;
        content += `
          <div class="card" style="text-align:center;padding:40px;">
            <div style="font-size:3rem;margin-bottom:14px;">🍔</div>
            <h2>Épreuve Burger</h2>
            <p class="muted" style="margin-top:8px;font-size:1rem;">${isTeamMode ? 'L\'équipe' : ''} <strong style="color:#fff;">${burgerPseudo}</strong> passe l'épreuve</p>
            <p class="muted" style="margin-top:10px;">Regardez l'écran principal !</p>
            <div class="waiting-dots" style="margin-top:16px;"><span></span><span></span><span></span></div>
          </div>`;
      }
    } else {
      content += renderPlayerQuestionContent(gs, s.playerId, gs.phaseMeta?.playerScreenLocked);
    }
  } else if (phase === 'answer_reveal') {
    const _revAM = gs?.phaseMeta?.answerMode;
    if (_revAM === 'true_false' && gs?.revealedAnswer) {
      // Révélation Vrai/Faux : montrer si le joueur avait bon ou faux
      const _revData    = gs.revealedAnswer;
      const _qId        = gs?.currentQuestion?.id;
      const _myAnswer   = gs?.answers?.[_qId]?.[s?.playerId]?.answer || null;
      const _correct    = (_revData.correctAnswer || '').trim().toLowerCase();
      const _isCorrect  = _myAnswer && _myAnswer.toLowerCase() === _correct;
      const _hasAnswered = !!_myAnswer;
      const _showExpl   = !!gs?.phaseMeta?.showTFExplanation;
      const _expl       = _revData.explanation || '';

      content += `
        <div class="card" style="text-align:center;padding:28px 20px;">
          <div class="tf-reveal-tiles tf-reveal-tiles-player">
            <div class="tf-reveal-tile tf-tile-vrai ${_correct==='vrai'?'tf-tile-correct':'tf-tile-wrong'} ${_myAnswer?.toLowerCase()==='vrai'?'tf-tile-mine':''}">
              <div class="tf-tile-icon">${_correct==='vrai'?'✅':'✗'}</div>
              <div class="tf-tile-label" style="font-size:1.3rem;">VRAI</div>
            </div>
            <div class="tf-reveal-tile tf-tile-faux ${_correct==='faux'?'tf-tile-correct':'tf-tile-wrong'} ${_myAnswer?.toLowerCase()==='faux'?'tf-tile-mine':''}">
              <div class="tf-tile-icon">${_correct==='faux'?'✅':'✗'}</div>
              <div class="tf-tile-label" style="font-size:1.3rem;">FAUX</div>
            </div>
          </div>
          ${_hasAnswered ? `
            <div style="margin-top:16px;padding:10px 18px;border-radius:12px;font-weight:700;font-size:1rem;
              background:${_isCorrect?'rgba(56,239,125,.15)':'rgba(235,51,73,.15)'};
              border:2px solid ${_isCorrect?'#38ef7d':'#eb3349'};
              color:${_isCorrect?'#38ef7d':'#eb3349'};">
              ${_isCorrect ? '✅ Bonne réponse !' : '❌ Mauvaise réponse'}
            </div>` : `<p class="muted" style="margin-top:12px;">Vous n'avez pas répondu</p>`}
          ${_showExpl && _expl ? `
            <div style="margin-top:14px;padding:10px 14px;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.25);border-radius:10px;text-align:left;">
              <p style="font-size:.75rem;color:rgba(255,255,255,.4);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em;">💡 Explication</p>
              <p style="font-size:.9rem;line-height:1.4;">${_expl}</p>
            </div>` : ''}
          ${(_revData.revealImage || _revData.revealText || _revData.revealAudio) ? `
            <div style="margin-top:14px;">${renderRevealMedia(_revData, 'player')}</div>` : ''}
          <button class="btn-recap-mini" style="margin-top:14px;" onclick="showPlayerRecap()">📊 Voir mes scores</button>
        </div>`;
    } else {
      // Mode par défaut : écran d'attente + éventuels médias de révélation
      content += renderPlayerWaitingScreen(gs, s, myPlayer);
      const _defRevealed = gs?.revealedAnswer;
      if (_defRevealed && (_defRevealed.revealImage || _defRevealed.revealText || _defRevealed.revealAudio)) {
        content += `<div style="padding:0 16px 16px;">${renderRevealMedia(_defRevealed, 'player')}</div>`;
      }
    }
  } else if (phase === 'manual_scoring') {
    if (gs?.buzzerState?.firstPseudo) {
      content += `
        <div class="card" style="text-align:center;padding:40px;">
          <div style="font-size:3rem;">🔔</div>
          <h2>${gs.buzzerState.firstPseudo} a buzzé !</h2>
          <p class="muted" style="margin-top:10px;">Le maître de jeu interroge oralement…</p>
          <div class="waiting-dots" style="margin-top:20px;"><span></span><span></span><span></span></div>
        </div>`;
    } else {
      content += `
        <div class="card" style="text-align:center;padding:40px;">
          <div style="font-size:3rem;">⚖️</div>
          <h2>Notation en cours…</h2>
          <p class="muted">Le maître de jeu évalue les réponses</p>
          <div class="waiting-dots" style="margin-top:16px;"><span></span><span></span><span></span></div>
        </div>`;
    }
  } else if (phase === 'round_end') {
    const round = gs?.currentRound;
    content += `
      <div class="player-round-end">
        <div class="round-end-icon">🏁</div>
        <h2 class="round-end-title">Manche terminée !</h2>
        ${round?.title ? `<p class="muted" style="font-size:1.05rem;margin-top:8px;font-weight:600;padding:8px 18px;border:1px solid rgba(56,239,125,0.25);border-radius:50px;background:rgba(56,239,125,0.06);display:inline-block;">${round.title}</p>` : ''}
        <div class="waiting-dots" style="margin-top:28px;"><span></span><span></span><span></span></div>
        <p class="muted" style="margin-top:18px;font-size:.9rem;">En attente du maître de jeu…</p>
      </div>`;
  } else if (phase === 'results') {
    content += renderScoreboard(state.leaderboardPlayers, '📊 Classement');
  } else if (phase === 'end') {
    content += renderFinalCeremony(gs, state.leaderboardPlayers);
  } else {
    content += `<div class="card" style="text-align:center;padding:40px;"><div style="font-size:3rem;">🎯</div><h2>Phase : ${phase}</h2></div>`;
  }

  content += `
    <div style="text-align:center;margin-top:20px;padding-bottom:16px;">
      <button class="btn-outline-danger btn-sm" onclick="logoutPlayer()">Quitter la partie</button>
    </div>
    </div>`;

  html('page-player', content);

  // Démarrer le compte à rebours live du cooldown buzzer si nécessaire
  if (state.playerSession) {
    const gs2 = state.gameState;
    const expiry = gs2?.buzzerCooldowns?.[state.playerSession.playerId] || 0;
    if (expiry > Date.now()) {
      startBuzzerCooldownTick(expiry);
    } else {
      stopBuzzerCooldownTick();
    }
  }
}

function stopBuzzerCooldownTick() {
  if (_buzzerCooldownTimer) {
    clearInterval(_buzzerCooldownTimer);
    _buzzerCooldownTimer = null;
  }
}

function startBuzzerCooldownTick(expiryTimestamp) {
  stopBuzzerCooldownTick();
  // BUG FIX: ne pas démarrer si déjà expiré (évite boucle "1s interminable")
  if (expiryTimestamp <= Date.now()) return;
  _buzzerCooldownTimer = setInterval(() => {
    const remaining = expiryTimestamp - Date.now();
    if (remaining <= 0) {
      stopBuzzerCooldownTick();
      // BUG FIX: ne pas appeler renderPlayerPage() ici — cela provoquait une boucle
      // où le serveur n'avait pas encore supprimé le cooldown, réaffichant "1s" indéfiniment.
      // On met à jour directement les éléments DOM ; le prochain game:state du serveur
      // (qui arrive ~100ms après) fera le vrai re-rendu avec le buzzer actif.
      const secsEl = document.getElementById('buzzer-cd-secs');
      const textEl = document.getElementById('buzzer-cd-text');
      if (secsEl) secsEl.textContent = '0s';
      if (textEl) textEl.innerHTML = `⏳ Buzzer disponible…`;
      return;
    }
    const secs = Math.ceil(remaining / 1000);
    const secsEl = document.getElementById('buzzer-cd-secs');
    const textEl = document.getElementById('buzzer-cd-text');
    if (secsEl) secsEl.textContent = secs + 's';
    if (textEl) textEl.innerHTML = `⏳ Mauvaise réponse — patientez <strong>${secs}s</strong>`;
  }, 250);
}

function renderPlayerQuestionContent(gs, playerId, locked) {
  const q = gs?.currentQuestion;
  const pm = gs?.phaseMeta || {};
  const answerMode = pm.answerMode || 'none';
  const answered = !!(gs?.answers?.[q?.id]?.[playerId]);

  if (!q) return `<div class="card" style="text-align:center;padding:30px;"><p class="muted">En attente de la question…</p></div>`;

  let media = '';
  if (q.mediaUrl) {
    const url = resolveMedia(q.mediaUrl);
    if (/\.(mp3|wav|ogg)$/i.test(url)) media = `<div class="media-block"><audio controls autoplay src="${url}"></audio></div>`;
    else if (/\.(mp4|webm|mov)$/i.test(url)) media = `<div class="media-block"><video controls autoplay src="${url}" style="max-height:45vh;"></video></div>`;
    else media = `<div class="media-block"><img src="${url}" alt="media"></div>`;
  }

  // Timer
  let timer = '';
  if (pm.timer?.remainingSec != null) {
    const pct = pm.timer.totalSec > 0 ? Math.max(0, (pm.timer.remainingSec / pm.timer.totalSec) * 100) : 0;
    timer = `
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <span>⏱️ Temps restant</span>
          <strong style="color:#ff9a56;font-size:1.3rem;">${pm.timer.remainingSec}s</strong>
        </div>
        <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  // Buzzer gris initial: afficher le buzzer désactivé (gris) quand verrouillé
  if (locked && answerMode === 'buzzer') {
    return `
      ${timer}
      <div class="player-question-bubble">
        <p class="player-question-text">${q.content || ''}</p>
      </div>
      <div class="buzzer-wrap">
        <button class="buzzer-btn buzzer-disabled" disabled>
          BUZZER
        </button>
        <p class="muted" style="margin-top:10px;font-size:.88rem;">En attente du signal du maître de jeu…</p>
      </div>`;
  }

  // Phase de révélation des propositions : afficher un écran "en attente" élaboré
  if (answerMode === 'vote_proposal_reveal') {
    return `
      ${timer}
      <div class="player-waiting-screen">
        <div class="waiting-host-text">🗳️</div>
        <div class="waiting-host-label">RÉVÉLATION DES<br>PROPOSITIONS</div>
        <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
        <p class="muted" style="font-size:.9rem;">Regardez l'écran TV…</p>
      </div>`;
  }

  // Challenge vidéo : écrans dédiés
  if (answerMode === 'video_select') {
    const vs = gs?.videoState;
    const isMe = vs?.selectedPlayerId === playerId;
    const myTeamId = state.players.find(p => p.id === playerId)?.teamId;
    const isMyTeam = myTeamId && vs?.selectedTeamId === myTeamId;
    return `
      ${timer}
      <div class="player-waiting-screen">
        <div class="waiting-host-text">🎬</div>
        <div class="waiting-host-label">CHALLENGE<br>VIDÉO</div>
        <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
        <p class="muted" style="font-size:.9rem;">Le maître de jeu choisit un participant…</p>
      </div>`;
  }
  if (answerMode === 'video_training_ready') {
    const vs = gs?.videoState;
    const isMe = vs?.selectedPlayerId === playerId;
    const myPlayer = state.players.find(p => p.id === playerId);
    const myTeamId = myPlayer?.teamId;
    const isMyTeam = myTeamId && vs?.selectedTeamId === myTeamId;
    const isSelected = isMe || isMyTeam;
    return `
      ${timer}
      <div class="player-waiting-screen" style="background:${isSelected ? 'rgba(255,215,0,.07)' : 'transparent'};">
        <div class="waiting-host-text">🏋️</div>
        <div class="waiting-host-label">${isSelected ? 'ATTENTION' : 'REGARDEZ L\'ÉCRAN'}</div>
        ${isSelected ? `<p style="margin-top:14px;font-size:1rem;color:#ffd700;">La vidéo d'entraînement va démarrer !</p>` : '<p class="muted" style="margin-top:14px;font-size:.9rem;">Entraînement en cours…</p>'}
        <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
      </div>`;
  }
  if (answerMode === 'video_training_playing') {
    return `
      ${timer}
      <div class="player-waiting-screen">
        <div class="waiting-host-text">🏋️</div>
        <div class="waiting-host-label">ENTRAÎNEMENT</div>
        <p class="muted" style="margin-top:14px;font-size:.9rem;">Regardez l'écran TV</p>
        <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
      </div>`;
  }
  if (answerMode === 'video_ready') {
    const vs = gs?.videoState;
    const isMe = vs?.selectedPlayerId === playerId;
    const myPlayer = state.players.find(p => p.id === playerId);
    const myTeamId = myPlayer?.teamId;
    const isMyTeam = myTeamId && vs?.selectedTeamId === myTeamId;
    const isSelected = isMe || isMyTeam;
    return `
      ${timer}
      <div class="player-waiting-screen" style="background:${isSelected ? 'rgba(255,215,0,.07)' : 'transparent'};">
        <div class="waiting-host-text">${isSelected ? '🎬' : '👀'}</div>
        <div class="waiting-host-label">${isSelected ? 'TENEZ-VOUS PRÊT !' : 'REGARDEZ L\'ÉCRAN'}</div>
        ${isSelected ? `<p style="margin-top:14px;font-size:1rem;color:#ffd700;">La vidéo va démarrer !</p>` : '<p class="muted" style="margin-top:14px;font-size:.9rem;">Un participant passe le challenge…</p>'}
        <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
      </div>`;
  }
  if (answerMode === 'video_playing') {
    return `
      ${timer}
      <div class="player-waiting-screen">
        <div class="waiting-host-text">🎥</div>
        <div class="waiting-host-label">VIDÉO EN COURS</div>
        <p class="muted" style="margin-top:14px;font-size:.9rem;">Regardez l'écran TV</p>
        <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
      </div>`;
  }
  if (answerMode === 'video_eval' || answerMode === 'video_scored') {
    const vs = gs?.videoState;
    return `
      ${timer}
      <div class="player-waiting-screen">
        <div class="waiting-host-text">${answerMode === 'video_scored' ? '🏆' : '⚖️'}</div>
        <div class="waiting-host-label">${answerMode === 'video_scored' ? `${vs?.score ?? '?'}/10` : 'ÉVALUATION EN COURS'}</div>
        ${answerMode === 'video_scored' && vs?.selectedPseudo ? `<p style="margin-top:10px;color:#f7971e;font-size:1rem;">Score de <strong>${vs.selectedPseudo}</strong></p>` : ''}
        <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
        <button class="btn-recap-mini" onclick="showPlayerRecap()">📊 Voir mes scores</button>
      </div>`;
  }

  // En phase de vote (vote_voting), ne pas bloquer avec l'écran d'attente
  // même si le joueur a déjà soumis sa proposition lors de vote_input
  if ((locked || answered) && answerMode !== 'vote_voting') {
    return `
      ${timer}
      <div class="player-waiting-screen">
        <div class="waiting-host-text">⏳</div>
        <div class="waiting-host-label">EN ATTENTE DU<br>MAÎTRE DE JEU</div>
        <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
        ${answered ? '<p class="muted" style="font-size:.9rem;margin-bottom:16px;">Votre réponse a été envoyée ✅</p>' : ''}
        <button class="btn-recap-mini" onclick="showPlayerRecap()">📊 Voir mes scores</button>
      </div>`;
  }

  // Buzzer queue info
  const myInQueue = Array.isArray(gs.buzzerQueue) && gs.buzzerQueue.includes(playerId);
  const connectedCount = state.players.filter(p => p.connected).length;
  const queueCount = Array.isArray(gs.buzzerQueue) ? gs.buzzerQueue.length : 0;
  const allBuzzed = queueCount >= connectedCount && connectedCount > 0;

  // Cooldown (rapidité : pénalité 5s après mauvaise réponse)
  const cooldownExpiry = gs?.buzzerCooldowns?.[playerId] || 0;
  const isCooldown = cooldownExpiry > Date.now();
  const cooldownSec = isCooldown ? Math.ceil((cooldownExpiry - Date.now()) / 1000) : 0;

  let answerUI = '';
  if (answerMode === 'buzzer') {
    if (isCooldown) {
      // Joueur en pénalité — buzzer bloqué avec compte à rebours (mis à jour toutes les secondes)
      answerUI = `
        <div class="buzzer-wrap">
          <button class="buzzer-btn buzzer-cooldown" disabled>
            ❌<br>BLOQUÉ<br><span id="buzzer-cd-secs" style="font-size:1.4rem;font-weight:900;">${cooldownSec}s</span>
          </button>
          <p id="buzzer-cd-text" class="muted" style="margin-top:12px;color:#eb3349;font-size:.9rem;">⏳ Mauvaise réponse — patientez <strong>${cooldownSec}s</strong></p>
        </div>`;
    } else if (myInQueue && !allBuzzed) {
      answerUI = `
        <div class="player-question-bubble" style="text-align:center;">
          <div style="font-size:2.2rem;">⏳</div>
          <p style="margin-top:10px;font-weight:600;">Vous avez déjà participé.</p>
          <p class="muted" style="margin-top:6px;">En attente des autres joueurs…</p>
          <p class="muted" style="margin-top:4px;font-size:.8rem;">${queueCount}/${connectedCount} ont participé</p>
        </div>`;
    } else {
      answerUI = `
        <div class="buzzer-wrap">
          <button class="buzzer-btn" id="buzzer-btn" onclick="sendBuzzer('${gs.sessionCode || ''}')">
            BUZZER
          </button>
          ${allBuzzed ? '<p class="muted" style="margin-top:12px;">Tour suivant !</p>' : ''}
        </div>`;
    }
  } else if (answerMode === 'true_false') {
    answerUI = `
      <div class="answer-tiles answer-tiles-tf">
        <button class="answer-tile answer-tile-true" onclick="playSound('answer');sendAnswer('${gs.sessionCode || ''}','${playerId}','vrai')">
          <span class="answer-tile-icon">✅</span>
          <span class="answer-tile-label" style="color:#22c55e;font-weight:900;">VRAI</span>
        </button>
        <button class="answer-tile answer-tile-false" onclick="playSound('answer');sendAnswer('${gs.sessionCode || ''}','${playerId}','faux')">
          <span class="answer-tile-icon">❌</span>
          <span class="answer-tile-label" style="color:#ef4444;font-weight:900;">FAUX</span>
        </button>
      </div>`;
  } else if (answerMode === 'mcq' && Array.isArray(q.options) && q.options.length) {
    const tileColors = [
      { bg: 'rgba(74,222,128,.15)', border: '#4ade80', label: '#4ade80' },
      { bg: 'rgba(96,165,250,.15)', border: '#60a5fa', label: '#60a5fa' },
      { bg: 'rgba(245,158,11,.15)', border: '#f59e0b', label: '#f59e0b' },
      { bg: 'rgba(248,113,113,.15)', border: '#f87171', label: '#f87171' },
    ];
    const labels = ['A','B','C','D'];
    const opts = q.options.map((opt, i) => {
      const label = typeof opt === 'object' ? (opt.text || '') : String(opt || '');
      const optMedia = typeof opt === 'object' && opt.mediaUrl ? resolveMedia(opt.mediaUrl) : '';
      const isImg = optMedia && /\.(jpg|jpeg|png|gif|webp)$/i.test(optMedia);
      const isAudio = optMedia && /\.(mp3|wav|ogg)$/i.test(optMedia);
      const mediaEl = isImg ? `<img src="${optMedia}" style="max-height:70px;border-radius:8px;margin-bottom:8px;">` :
                      isAudio ? `<audio controls src="${optMedia}" style="height:28px;margin-bottom:6px;"></audio>` : '';
      const c = tileColors[i] || tileColors[0];
      return `<button class="answer-tile answer-tile-mcq" style="background:${c.bg};border-color:${c.border};"
        onclick="playSound('answer');sendAnswerByIndex(${i})">
        ${mediaEl}
        <span class="answer-tile-letter" style="color:${c.label};">${labels[i]}</span>
        <span class="answer-tile-text">${label}</span>
      </button>`;
    }).join('');
    const cols = q.options.length <= 2 ? 'answer-tiles-2' : 'answer-tiles-mcq-grid';
    answerUI = `<div class="answer-tiles ${cols}">${opts}</div>`;
  } else if (answerMode === 'burger') {
    answerUI = `
      <div class="player-question-bubble" style="text-align:center;">
        <div style="font-size:3rem;margin-bottom:10px;">🍔</div>
        <h3>Observez bien les éléments…</h3>
        <p class="muted" style="margin-top:8px;">Le maître de jeu vous interrogera à la fin</p>
      </div>`;
  } else if (answerMode === 'vote_input') {
    // Phase 1 du vote : saisie de sa proposition
    const alreadyAnswered = !!(gs?.answers?.[q?.id]?.[playerId]);
    if (alreadyAnswered) {
      const myAnswer = gs?.answers?.[q?.id]?.[playerId]?.answer || '';
      answerUI = `
        <div class="player-waiting-screen">
          <div class="waiting-host-text">✍️</div>
          <div class="waiting-host-label">RÉPONSE ENVOYÉE !</div>
          <p class="muted" style="margin-top:12px;font-size:1rem;font-style:italic;">"${myAnswer}"</p>
          <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
          <p class="muted" style="font-size:.85rem;">En attente des autres joueurs…</p>
        </div>`;
    } else {
      answerUI = `
        <div class="text-answer-block">
          <p class="muted" style="margin-bottom:10px;font-size:.9rem;">🗳️ Proposez votre réponse (elle sera affichée anonymement)</p>
          <textarea id="text-answer" class="text-answer-area" placeholder="Votre proposition…"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendTextAnswer('${gs.sessionCode || ''}','${playerId}')}"></textarea>
          <button class="btn-primary btn-full text-answer-send" onclick="sendTextAnswer('${gs.sessionCode || ''}','${playerId}')">
            ✅ Soumettre ma proposition
          </button>
        </div>`;
    }
  } else if (answerMode === 'vote_voting') {
    // Phase 2 du vote : voter pour une réponse parmi les options
    const vs = gs?.voteState;
    const myVote = vs?.votes?.[playerId];
    const hasVoted = myVote !== undefined && myVote !== null;

    if (!vs || !vs.options) {
      answerUI = `<div class="card" style="text-align:center;padding:30px;"><p class="muted">Chargement des votes…</p></div>`;
    } else if (hasVoted) {
      const votedOption = vs.options[myVote];
      answerUI = `
        <div class="player-waiting-screen">
          <div class="waiting-host-text">🗳️</div>
          <div class="waiting-host-label">VOTE ENVOYÉ !</div>
          <p class="muted" style="margin-top:12px;font-size:1rem;font-style:italic;">"${votedOption?.text || '—'}"</p>
          <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
          <p class="muted" style="font-size:.85rem;">En attente des autres votes…</p>
        </div>`;
    } else {
      const voteButtons = vs.options.map((opt, idx) => {
        // Ne pas permettre de voter pour sa propre réponse
        const isMyAnswer = opt.playerId === playerId;
        if (isMyAnswer) return `
          <div style="padding:12px 16px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.3);text-align:center;font-style:italic;">
            "${opt.text}" <span style="font-size:.75rem;">(votre réponse)</span>
          </div>`;
        return `
          <button class="answer-tile answer-tile-vote" onclick="playSound('answer');sendVote(${idx})">
            <span class="vote-tile-idx">${String.fromCharCode(65 + idx)}</span>
            <span class="answer-tile-text">${opt.text}</span>
          </button>`;
      }).join('');
      answerUI = `
        <div style="margin-top:8px;">
          <p class="muted" style="margin-bottom:12px;font-size:.9rem;">🗳️ Votez pour la réponse qui vous semble la plus juste !</p>
          <div class="answer-tiles" style="grid-template-columns:1fr;">
            ${voteButtons}
          </div>
        </div>`;
    }
  } else {
    // Réponse texte libre – zone de saisie grande
    answerUI = `
      <div class="text-answer-block">
        <textarea id="text-answer" class="text-answer-area" placeholder="Tapez votre réponse…"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendTextAnswer('${gs.sessionCode || ''}','${playerId}')}"></textarea>
        <button class="btn-primary btn-full text-answer-send" onclick="sendTextAnswer('${gs.sessionCode || ''}','${playerId}')">
          ✅ Envoyer ma réponse
        </button>
      </div>`;
  }

  return `
    ${media}
    ${timer}
    ${answerUI}`;
}

function renderPlayerRevealContent(gs, playerId) {
  // Deprecated: use renderPlayerWaitingScreen instead for player side
  return renderPlayerWaitingScreen(gs, state.playerSession, state.players.find(p => p.id === playerId));
}

// Écran d'attente joueur (affiché après réponse ou pendant la révélation)
function renderPlayerWaitingScreen(gs, playerSession, myPlayer) {
  return `
    <div class="player-waiting-screen">
      <div class="waiting-host-text">⏳</div>
      <div class="waiting-host-label">EN ATTENTE DU<br>MAÎTRE DE JEU</div>
      <div class="waiting-dots" style="margin:18px 0;"><span></span><span></span><span></span></div>
      <button class="btn-recap-mini" onclick="showPlayerRecap()">📊 Voir mes scores</button>
    </div>`;
}

// Modal plein écran récap des scores joueur
function showPlayerRecap() {
  const s = state.playerSession;
  const myPlayer = state.players.find(p => p.id === s?.playerId || p.playerId === s?.playerId);
  const myTeamId = s?.teamId || myPlayer?.teamId;
  const teammates = myTeamId
    ? state.leaderboardPlayers.filter(p => p.teamId === myTeamId && (p.playerId || p.id) !== s?.playerId)
    : [];

  // Classement global (top 10)
  const top10 = state.leaderboardPlayers.slice(0, 10);
  const myRank = state.leaderboardPlayers.find(p => (p.playerId || p.id) === s?.playerId);

  const teammateRows = teammates.length
    ? `<div style="margin-bottom:18px;">
        <div class="recap-section-title">⚽ Coéquipiers — ${s?.teamName || ''}</div>
        ${teammates.map(p => `
          <div class="recap-player-row">
            <span>${p.pseudo}</span>
            <strong style="color:#f59e0b;">${p.scoreTotal ?? 0} pts</strong>
          </div>`).join('')}
      </div>` : '';

  const rankRows = top10.map((p, i) => {
    const isMine = (p.playerId || p.id) === s?.playerId;
    return `<div class="recap-player-row ${isMine ? 'recap-mine' : ''}">
      <span><strong style="color:rgba(255,255,255,.4);">#${i+1}</strong> ${p.pseudo}${isMine ? ' 👈' : ''}</span>
      <strong style="color:${isMine ? '#38ef7d' : '#f59e0b'};">${p.scoreTotal ?? 0} pts</strong>
    </div>`;
  }).join('');

  const existing = document.getElementById('player-recap-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'player-recap-overlay';
  overlay.className = 'recap-overlay';
  overlay.innerHTML = `
    <div class="recap-modal">
      <div class="recap-header">
        <h2>📊 Scores en direct</h2>
        <button class="btn-close-recap" onclick="closePlayerRecap()">✕ Fermer</button>
      </div>
      <div class="recap-my-score">
        <div style="font-size:2.5rem;">${myPlayer?.avatar || s?.avatar || '🎮'}</div>
        <div class="recap-my-name">${s?.pseudo || '—'}</div>
        <div class="recap-my-pts">${myPlayer?.scoreTotal ?? 0} pts</div>
        ${myRank ? `<div class="muted" style="font-size:.85rem;">Rang #${myRank.rank ?? '?'}</div>` : ''}
      </div>
      ${teammateRows}
      <div>
        <div class="recap-section-title">🏆 Classement général</div>
        ${rankRows}
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closePlayerRecap(); });
  document.body.appendChild(overlay);
}

function closePlayerRecap() {
  document.getElementById('player-recap-overlay')?.remove();
}

// Affiche un message ciblé directement sur l'écran du joueur
function showPlayerDirectMessage(bm) {
  const existing = document.getElementById('player-direct-message');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'player-direct-message';
  overlay.style.cssText = `
    position:fixed;bottom:0;left:0;right:0;z-index:9999;
    background:linear-gradient(135deg,rgba(240,147,251,.95),rgba(245,87,108,.95));
    padding:20px;border-radius:16px 16px 0 0;
    box-shadow:0 -4px 24px rgba(0,0,0,.4);
    animation:slide-up-msg .3s ease;
  `;
  overlay.innerHTML = `
    <style>
      @keyframes slide-up-msg { from{transform:translateY(100%)} to{transform:translateY(0)} }
    </style>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div style="flex:1;">
        <div style="font-size:.72rem;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">📡 Message du maître de jeu</div>
        ${bm.imageUrl ? `<img src="${bm.imageUrl}" style="max-width:100%;max-height:180px;border-radius:10px;margin-bottom:10px;object-fit:contain;">` : ''}
        ${bm.text ? `<p style="font-size:1.1rem;font-weight:600;color:#fff;">${bm.text}</p>` : ''}
      </div>
      <button onclick="document.getElementById('player-direct-message')?.remove()" style="background:rgba(255,255,255,.2);border:none;border-radius:8px;padding:6px 12px;color:#fff;cursor:pointer;font-size:1rem;flex-shrink:0;">✕</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Auto-fermer après 12 secondes
  setTimeout(() => overlay?.remove(), 12000);
}

// Fermer le récap automatiquement lors d'un changement de question
let _lastQuestionId = null;
function checkAndCloseRecapOnNewQuestion() {
  const qId = state.gameState?.currentQuestion?.id;
  if (qId && qId !== _lastQuestionId) {
    _lastQuestionId = qId;
    closePlayerRecap();
  }
}

function sendAnswer(sessionCode, playerId, answer) {
  const s = state.playerSession;
  playSound('answer');
  state.socket.emit('player:answer', { sessionCode: s?.sessionCode || sessionCode, playerId, answer }, (res) => {
    if (!res?.ok) alert$('player-alert', res?.error || 'Erreur', 'error');
  });
}

function sendTextAnswer(sessionCode, playerId) {
  const val = ($('#text-answer')?.value || '').trim();
  if (!val) { alert$('player-alert', 'Réponse vide', 'error'); return; }
  sendAnswer(sessionCode, playerId, val);
}

function sendBuzzer(sessionCode) {
  const s = state.playerSession;
  playSound('buzzer');
  state.socket.emit('player:buzzer', { sessionCode: s?.sessionCode || sessionCode, playerId: s?.playerId }, (res) => {
    if (!res?.ok) alert$('player-alert', res?.error || 'Buzzer non disponible', 'error');
    const btn = $('#buzzer-btn');
    if (btn) btn.disabled = true;
  });
}

// Fonction index-safe pour réponse MCQ (évite le problème d'échappement des guillemets dans onclick)
function sendAnswerByIndex(optIndex) {
  const q = state.gameState?.currentQuestion;
  const opts = Array.isArray(q?.options) ? q.options : [];
  const opt = opts[optIndex];
  const label = typeof opt === 'object' ? (opt.text || '') : String(opt || '');
  const s = state.playerSession;
  sendAnswer(s?.sessionCode, s?.playerId, label);
}

function sendVote(voteIndex) {
  const s = state.playerSession;
  state.socket.emit('player:vote', {
    sessionCode: s?.sessionCode,
    playerId: s?.playerId,
    voteIndex,
  }, (res) => {
    if (!res?.ok) alert$('player-alert', res?.error || 'Erreur de vote', 'error');
  });
}

function logoutPlayer() {
  state.playerSession = null;
  localStorage.removeItem('quiz_player_session');
  navigate('home');
}

// ── Page : HOST ──────────────────────────────────────────────
pageInits.host = function() {
  // Si déjà connecté (ex: passage depuis doLaunchGame), on reste sur l'écran de jeu
  if (state.host.connected) {
    renderHostGame();
    return;
  }
  const savedCode = localStorage.getItem('quiz_host_session_code') || '';
  const savedKey  = localStorage.getItem('quiz_host_key') || 'demo-host';
  state.host.sessionCode = savedCode;
  state.host.hostKey     = savedKey;
  state.host.connected   = false;
  renderHostConnect();
};

function renderHostConnect() {
  html('page-host', `
    <div class="row" style="justify-content:space-between;margin-bottom:20px;">
      <h1>🎮 Maître de jeu</h1>
      <button class="btn-secondary" onclick="navigate('home')">Accueil</button>
    </div>
    <div id="host-alert"></div>
    <div class="card">
      <h2>Connexion</h2>
      <div class="grid2" style="margin-top:12px;">
        <div>
          <label>Code de session</label>
          <input id="host-code" value="${state.host.sessionCode}" placeholder="ex: 1234" style="text-transform:uppercase;letter-spacing:3px;">
        </div>
        <div>
          <label>Clé host</label>
          <input id="host-key" value="${state.host.hostKey}" placeholder="ex: demo-host">
        </div>
      </div>
      <button class="btn-success" style="width:100%;margin-top:16px;" onclick="connectHost()">
        🎮 Se connecter en tant que Maître de jeu
      </button>
    </div>
  `);
}

function connectHost() {
  const code = ($('#host-code')?.value || '').trim().toUpperCase();
  const key  = ($('#host-key')?.value  || '').trim();
  if (!code) { alert$('host-alert', 'Code requis', 'error'); return; }

  state.host.sessionCode = code;
  state.host.hostKey     = key;

  state.socket.emit('join:host', { sessionCode: code, hostKey: key }, (res) => {
    if (!res?.ok) { alert$('host-alert', res?.error || 'Connexion impossible', 'error'); return; }
    state.host.connected = true;
    localStorage.setItem('quiz_host_session_code', code);
    localStorage.setItem('quiz_host_key', key);
    renderHostGame();
  });
}

// ── Host : Onglets principaux ──────────────────────────────────
let hostMainTab = 'gestion'; // 'gestion' | 'pilotage'
const hostExpandedRounds = new Set();

function switchHostMainTab(tab) {
  hostMainTab = tab;
  renderHostGame();
}

function toggleRoundAccordion(idx) {
  if (hostExpandedRounds.has(idx)) {
    hostExpandedRounds.delete(idx);
  } else {
    hostExpandedRounds.add(idx);
  }
  renderHostGame();
}

function openDisplayPopup() {
  const sc = state.host.sessionCode;
  if (!sc) { alert$('host-alert', 'Pas de session active', 'error'); return; }
  const url = `${window.location.origin}/?display-session=${encodeURIComponent(sc)}#display`;
  // Ouverture dans un nouvel onglet (_blank) pour éviter le blocage des popups
  const tab = window.open(url, '_blank');
  if (!tab) alert$('host-alert', '🚫 Ouverture bloquée — autorisez les fenêtres contextuelles pour ce site.', 'error');
}

function renderHostGame() {
  if (!state.host.connected) return;
  const gs    = state.gameState;
  const phase = gs?.status || 'lobby';
  const sc    = state.host.sessionCode;

  const joinLink = `${window.location.origin}/?join=${sc}`;

  const phaseBadge = {
    lobby:          '<span class="badge blue">🎪 Lobby</span>',
    round_intro:    '<span class="badge orange">📢 Présentation manche</span>',
    question:       '<span class="badge orange">❓ Question</span>',
    waiting:        '<span class="badge orange">⏳ Traitement</span>',
    answer_reveal:  '<span class="badge green">📋 Révélation</span>',
    manual_scoring: '<span class="badge orange">⚖️ Arbitrage</span>',
    round_end:      '<span class="badge green">🏁 Fin de manche</span>',
    results:        '<span class="badge blue">📊 Résultats</span>',
    end:            '<span class="badge green">🎉 Fin</span>',
  }[phase] || `<span class="badge">${phase}</span>`;

  let html_ = `
    <style>
      .host-main-tabs { display:flex; background:rgba(0,0,0,.25); border-bottom:2px solid rgba(255,255,255,.08); }
      .host-main-tab {
        flex:1; padding:15px 8px; border:none; border-bottom:3px solid transparent;
        background:transparent; color:rgba(255,255,255,.5); font-family:inherit;
        font-size:1rem; font-weight:600; cursor:pointer; transition:all .2s; text-align:center;
        margin-bottom:-2px;
      }
      .host-main-tab:hover { color:rgba(255,255,255,.85); background:rgba(255,255,255,.04); }
      .host-main-tab.active { color:#fff; border-bottom-color:#f093fb; background:rgba(240,147,251,.08); }
      @keyframes pulse-scale {
        0%,100% { transform:scale(1); box-shadow:0 0 0 0 rgba(56,239,125,.4); }
        50% { transform:scale(1.04); box-shadow:0 0 0 8px rgba(56,239,125,0); }
      }
      .hbtn-pulse {
        animation: pulse-scale 1.4s ease-in-out infinite;
        border-color: rgba(56,239,125,.6) !important;
      }
      .hbtn-pulse.hbtn-success { background:linear-gradient(135deg,#38ef7d,#11998e) !important; color:#fff !important; }
      .hbtn-pulse.hbtn-primary { background:linear-gradient(135deg,#f093fb,#f5576c) !important; color:#fff !important; }
      .hbtn-pulse.hbtn-nav-fwd { background:rgba(99,179,237,.2) !important; border-color:rgba(99,179,237,.5) !important; }
      .answer-tile-vote {
        display:block; width:100%; padding:16px 20px; text-align:left;
        background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.15);
        border-radius:12px; cursor:pointer; transition:all .15s;
        font-family:inherit; font-size:1rem; font-weight:600; color:#fff;
      }
      .answer-tile-vote:hover { background:rgba(240,147,251,.2); border-color:rgba(240,147,251,.5); }
      .host-tab-body { padding:16px; }
      .ctrl-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      @media(min-width:560px){ .ctrl-grid { grid-template-columns:repeat(3,1fr); } }
      .round-accordion { border:1px solid rgba(255,255,255,.1); border-radius:12px; overflow:hidden; margin-bottom:10px; }
      .round-acc-hdr {
        display:flex; align-items:center; gap:10px; padding:13px 16px;
        background:rgba(255,255,255,.05); cursor:pointer; border:none;
        width:100%; color:#fff; font-family:inherit; text-align:left; transition:background .15s;
      }
      .round-acc-hdr:hover { background:rgba(255,255,255,.09); }
      .round-acc-hdr.cur-round { background:rgba(240,147,251,.1); border-left:3px solid #f093fb; }
      .round-acc-body { padding:12px 16px; background:rgba(0,0,0,.15); }
      .q-line {
        display:flex; justify-content:space-between; align-items:flex-start; gap:10px;
        padding:9px 12px; border-radius:8px; margin-bottom:6px;
        background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07);
        transition:background .15s;
      }
      .q-line.q-active { background:rgba(99,179,237,.12); border-color:rgba(99,179,237,.3); }
    </style>
    <div class="session-banner">
      <span>Session : <strong class="session-code">${sc}</strong></span>
      ${phaseBadge}
      <span>👥 ${state.players.length}</span>
      <button class="btn-secondary" style="padding:4px 10px;font-size:.8rem;margin-left:auto;" onclick="copyToClipboard('${joinLink}','host-alert')">📋 Lien joueurs</button>
    </div>
    <div id="host-alert" style="padding:0 16px;"></div>
    <div class="host-main-tabs">
      <button class="host-main-tab ${hostMainTab==='gestion'?'active':''}" onclick="switchHostMainTab('gestion')">🎯 Gestion de partie</button>
      <button class="host-main-tab ${hostMainTab==='pilotage'?'active':''}" onclick="switchHostMainTab('pilotage')">🎮 Partie en cours</button>
    </div>
    <div class="host-tab-body">
  `;

  if (hostMainTab === 'gestion') {
    html_ += renderHostGestionTab(gs, phase, sc);
  } else {
    html_ += renderHostPilotageTab(gs, phase);
  }

  html_ += '</div>';
  html('page-host', html_);
}

// ── TAB 1 : Gestion de partie ─────────────────────────────────
function renderHostGestionTab(gs, phase, sc) {
  let out = '';

  // Quiz info + sélection
  const quizTitle = gs?.quizTitle || '—';
  out += `
    <div class="card" style="margin-bottom:14px;">
      <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
        <div>
          <div class="muted" style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">QUIZ CHARGÉ</div>
          <h3 style="margin:0;">📚 ${quizTitle}</h3>
        </div>
        <button class="btn-secondary" style="font-size:.8rem;padding:6px 14px;" onclick="toggleQuizPicker()">🔄 Changer de quiz</button>
      </div>
    </div>
    <div id="quiz-picker-wrap" style="display:none;margin-bottom:14px;"></div>
  `;

  // Joueurs connectés
  const playerRows = state.players.map(p => `
    <tr>
      <td style="width:14px;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${p.connected?'#38ef7d':'#555'};"></span></td>
      <td style="font-size:1.2rem;text-align:center;padding:4px 6px;">${p.avatar || '🎮'}</td>
      <td><strong>${p.pseudo}</strong></td>
      <td>
        <select onchange="hostAction('assign_team',{playerId:'${p.id||p.playerId}',teamId:this.value||null})"
          style="font-size:.78rem;padding:3px 6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#fff;max-width:130px;">
          <option value="">— aucune —</option>
          ${state.teams.slice(0,20).map(t => `<option value="${t.id}" ${p.teamId===t.id?'selected':''}>${t.name}</option>`).join('')}
        </select>
      </td>
      <td style="color:#f59e0b;font-weight:600;">${p.scoreTotal ?? 0} pts</td>
      <td><button class="btn-danger" style="padding:3px 7px;font-size:.78rem;" onclick="hostAction('remove_player',{playerId:'${p.id||p.playerId}'})">✕</button></td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:16px;">Aucun joueur connecté</td></tr>';

  out += `
    <div class="card" style="margin-bottom:14px;">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <h3 style="margin:0;">👥 Joueurs (${state.players.length})</h3>
        <div class="row" style="gap:6px;">
          <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="hostAction('reset_scores')">🔄 Scores</button>
          <button class="btn-danger" style="font-size:.78rem;padding:5px 10px;" onclick="clearPlayers()">🗑️ Vider</button>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;min-width:280px;">
          <thead><tr><th></th><th></th><th>Joueur</th><th>Équipe</th><th>Score</th><th></th></tr></thead>
          <tbody>${playerRows}</tbody>
        </table>
      </div>
      <div class="row" style="margin-top:14px;flex-wrap:wrap;gap:8px;">
        <input id="bot-name" placeholder="Nom du bot" style="flex:1;min-width:110px;max-width:180px;">
        <select id="bot-team" style="width:140px;flex-shrink:0;">
          <option value="">— sans équipe —</option>
          ${state.teams.slice(0,20).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
        <button class="btn-success" style="white-space:nowrap;flex-shrink:0;" onclick="addBot()">🤖 Ajouter bot</button>
      </div>
    </div>`;

  // Équipes (avec membres et score)
  const teamsWithPlayers = state.teams.filter(t => state.players.some(p => p.teamId === t.id));
  const teamsToShow = (teamsWithPlayers.length > 0 ? teamsWithPlayers : state.teams).slice(0, 12);
  if (teamsToShow.length) {
    const teamsHtml = teamsToShow.map(t => {
      const members = state.players.filter(p => p.teamId === t.id).map(p => p.pseudo).join(', ');
      return `
        <div style="background:rgba(255,255,255,.05);border-radius:10px;padding:12px;">
          <div class="row" style="gap:6px;margin-bottom:6px;">
            <input id="rename-${t.id}" value="${t.name}" style="flex:1;font-size:.85rem;padding:6px 10px;">
            <button class="btn-secondary" style="padding:5px 10px;font-size:.8rem;flex-shrink:0;" onclick="renameTeam('${t.id}')">✅</button>
          </div>
          ${members ? `<p class="muted" style="font-size:.75rem;">👤 ${members}</p>` : '<p class="muted" style="font-size:.75rem;">Aucun joueur</p>'}
          <p style="font-size:.78rem;margin-top:3px;color:#f59e0b;font-weight:600;">${t.scoreTotal ?? 0} pts</p>
        </div>`;
    }).join('');
    out += `
      <div class="card" style="margin-bottom:14px;">
        <h3>⚽ Équipes</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:10px;margin-top:12px;">
          ${teamsHtml}
        </div>
      </div>`;
  }

  // Zone de lancement / progression
  if (phase === 'lobby') {
    out += `
      <div class="card" style="text-align:center;padding:28px;border:2px solid rgba(56,239,125,.2);background:rgba(56,239,125,.04);margin-bottom:14px;">
        <h2 style="margin-bottom:8px;">🎉 Écran d'accueil</h2>
        <p class="muted" style="margin-bottom:4px;">${state.players.filter(p=>p.connected).length} joueur(s) connecté(s) · Quiz : <strong>${quizTitle}</strong></p>
        <p class="muted" style="font-size:.8rem;margin-bottom:18px;">L'écran TV affiche la page de bienvenue avec les joueurs connectés.</p>
        <button class="hbtn hbtn-success hbtn-wide hbtn-pulse" style="font-size:1.1rem;padding:14px 36px;margin-bottom:12px;" onclick="hostAction('start_quiz')">
          ▶️ Lancer la partie
        </button>
        <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap;">
          <button class="hbtn hbtn-warning" onclick="hostAction('start_training_video')">🏋️ Vidéo d'entraînement</button>
          <button class="hbtn hbtn-secondary" onclick="showChangeQuizModal()">🔄 Changer de quiz</button>
          <button class="hbtn hbtn-secondary" onclick="hostAction('reset_game')">🔁 Reset</button>
          <button class="hbtn hbtn-danger" onclick="if(confirm('Réinitialiser TOUT ?'))hostAction('reset_all')">💥 Reset général</button>
        </div>
      </div>`;
  } else {
    out += `
      <div class="card" style="padding:14px;border:1px solid rgba(255,165,0,.2);background:rgba(255,165,0,.04);margin-bottom:14px;">
        <div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <p>Phase : <strong style="color:#ffa500;">${phase}</strong></p>
          <button class="btn-primary btn-sm" onclick="switchHostMainTab('pilotage')">🎮 Panneau de contrôle →</button>
        </div>
        <div class="row" style="justify-content:flex-start;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn-secondary btn-sm" onclick="hostAction('reset_game')">🔁 Reset partie</button>
          <button class="btn-outline-danger btn-sm" onclick="if(confirm('Stopper la partie en cours ?'))hostAction('stop_session')">⏹ Stopper la partie</button>
          <button class="btn-outline-danger btn-sm" onclick="if(confirm('Réinitialiser TOUT ? (joueurs, scores, progression)'))hostAction('reset_all')">💥 Reset général</button>
        </div>
      </div>`;
  }

  return out;
}

// ── TAB 2 : Partie en cours (Pilotage) ────────────────────────
function renderHostPilotageTab(gs, phase) {
  let out = '';

  const currentRoundIdx    = gs?.currentRoundIndex ?? -1;
  const currentQIdx        = gs?.currentQuestionIndex ?? -1;
  const currentRound       = gs?.currentRound;
  const currentQ           = gs?.currentQuestion;
  const isPaused           = gs?.phaseMeta?.paused === true;
  const isBurger           = (currentRound?.type === 'burger' || currentQ?.type === 'burger');
  const isBuzzer           = gs?.phaseMeta?.answerMode === 'buzzer';
  const isLocked           = gs?.phaseMeta?.playerScreenLocked === true;
  const timerInfo          = gs?.phaseMeta?.timer;
  const isVideoChallenge   = currentRound?.type === 'video_challenge' || currentQ?.type === 'video_challenge';

  // ── Barre supérieure : phase + TV ──────────────────────────────
  const phaseLabelMap = {
    lobby:          '<span class="badge blue">🎪 Lobby</span>',
    round_intro:    '<span class="badge orange">📢 Présentation manche</span>',
    training_video: '<span class="badge orange">🏋️ Vidéo entraînement</span>',
    get_ready:      '<span class="badge" style="background:rgba(56,239,125,.15);color:#38ef7d;border-color:rgba(56,239,125,.4);">🎯 Tenez-vous prêts</span>',
    question:       isPaused ? '<span class="badge red">⏸️ Pause</span>' : '<span class="badge orange">❓ Question</span>',
    waiting:        '<span class="badge orange">⏳ En attente</span>',
    answer_reveal:  '<span class="badge green">📋 Révélation</span>',
    manual_scoring: '<span class="badge orange">⚖️ Buzzer/Arbitrage</span>',
    round_end:      '<span class="badge green">🏁 Fin de manche</span>',
    results:        '<span class="badge blue">📊 Résultats manche</span>',
    end:            '<span class="badge green">🎉 Fin du quiz</span>',
  };
  out += `
    <div class="host-status-bar">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        ${phaseLabelMap[phase] || `<span class="badge">${phase}</span>`}
        ${isLocked ? '<span class="badge red" style="font-size:.72rem;">🔒 Verrouillé</span>' : '<span class="badge green" style="font-size:.72rem;">🔓 Ouvert</span>'}
      </div>
      <div class="row" style="gap:6px;">
        <button class="btn-secondary btn-sm" onclick="showBroadcastModal()">💬 Message</button>
        <button class="btn-primary btn-sm" onclick="openDisplayPopup()">📺 TV ↗</button>
      </div>
    </div>`;

  // ── Info question courante ──────────────────────────────────────
  if (currentRound && currentQ) {
    const answeredCount = Object.keys(gs?.answers?.[currentQ.id] || {}).length;
    const connectedCount = state.players.filter(p => p.connected).length;
    out += `
      <div class="host-question-info">
        <div style="flex:1;min-width:0;">
          <div class="muted" style="font-size:.65rem;text-transform:uppercase;margin-bottom:3px;">Manche ${currentRoundIdx+1} · Q${currentQIdx+1} · ${(currentRound.type||'').toUpperCase()}</div>
          <p style="font-size:.9rem;font-weight:600;margin-bottom:4px;">${currentQ.content||'—'}</p>
          ${currentQ.correctAnswer ? `<p style="color:#38ef7d;font-size:.78rem;">✓ ${currentQ.correctAnswer}</p>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <p style="font-size:1.3rem;font-weight:700;color:#f59e0b;">${answeredCount}<span class="muted" style="font-size:.75rem;">/${connectedCount}</span></p>
          <p class="muted" style="font-size:.65rem;">réponses</p>
        </div>
      </div>`;
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 1 : GESTION DE LA PARTIE EN COURS
  // ═══════════════════════════════════════════════════════════

  // "Tenez-vous prêts" : l'admin contrôle manuellement le démarrage de la question
  if (phase === 'get_ready') {
    const _grQ    = gs?.currentQuestion;
    const _grQNum = (gs?.currentQuestionIndex ?? 0) + 1;
    const _grTotal = (gs?.currentRound?.questions || []).length;
    out += `
      <div class="host-section" style="border-left:3px solid #38ef7d;background:rgba(56,239,125,0.07);text-align:center;padding:18px 16px;">
        <div class="host-section-label">🎯 TENEZ-VOUS PRÊTS</div>
        <p style="font-size:.85rem;color:rgba(255,255,255,.7);margin-bottom:6px;">
          Question <strong style="color:#fff;">${_grQNum}</strong>${_grTotal ? ` / ${_grTotal}` : ''}
          ${_grQ?.content ? ` — <em style="color:rgba(255,255,255,.5);font-size:.8rem;">${_grQ.content.substring(0,60)}${_grQ.content.length>60?'…':''}</em>` : ''}
        </p>
        <p class="muted" style="font-size:.78rem;margin-bottom:14px;">
          Les joueurs voient l'écran d'attente. Lancez la question quand tout le monde est prêt.
        </p>
        <div class="host-ctrl-row" style="justify-content:center;gap:10px;">
          <button class="hbtn hbtn-success hbtn-wide hbtn-pulse" style="font-size:1rem;padding:12px 28px;" onclick="hostAction('start_question')">
            ▶ Lancer la question
          </button>
        </div>
      </div>`;
    return out;
  }

  // Lobby : bouton principal de lancement
  if (phase === 'lobby') {
    out += `
      <div class="host-section host-section-primary" style="text-align:center;padding:20px 16px;">
        <div class="host-section-label">🎪 LOBBY</div>
        <p class="muted" style="margin-bottom:14px;font-size:.85rem;">
          ${state.players.filter(p=>p.connected).length} joueur(s) connecté(s) — Quiz : <strong>${gs?.quizTitle || '—'}</strong>
        </p>
        <button class="hbtn hbtn-success hbtn-wide hbtn-pulse" style="font-size:1.1rem;padding:14px 36px;" onclick="hostAction('start_quiz')">
          ▶️ Lancer la partie
        </button>
      </div>`;
  }

  if (['question','waiting','answer_reveal','manual_scoring','round_intro','training_video','round_end'].includes(phase)) {
    out += `<div class="host-section host-section-primary">
      <div class="host-section-label">⚡ PARTIE EN COURS</div>
      <div class="host-ctrl-row">`;

    if (isPaused) {
      out += `<button class="hbtn hbtn-success hbtn-wide hbtn-pulse" onclick="hostAction('resume_game')">▶ Reprendre</button>`;
    } else if (['question','waiting'].includes(phase)) {
      out += `<button class="hbtn hbtn-warning" onclick="hostAction('pause_game')">⏸ Pause</button>`;
    }

    if (['question','waiting','manual_scoring'].includes(phase)) {
      // On retire le bouton "fin de timer" et on garde seulement "Montrer la solution"
      if (!isBurger && !isBuzzer && !isVideoChallenge) {
        const isVote = gs?.phaseMeta?.answerMode === 'vote_input' || gs?.phaseMeta?.answerMode === 'vote_voting';
        if (!isVote) {
          out += `<button class="hbtn hbtn-secondary hbtn-pulse" onclick="hostAction('reveal_answer')">📋 Montrer la solution</button>`;
        }
      }
      // Masquer "Reset Q" pendant les phases de vote (évite de vider les réponses accidentellement)
      const isVotePhaseNow = gs?.phaseMeta?.answerMode === 'vote_input' || gs?.phaseMeta?.answerMode === 'vote_voting';
      if (!isVotePhaseNow) {
        out += `<button class="hbtn hbtn-secondary" onclick="hostAction('refresh_question')">🔁 Reset Q</button>`;
      }
    }

    if (phase === 'answer_reveal') {
      out += `<button class="hbtn hbtn-secondary" onclick="hostAction('reveal_answer')">📋 Réafficher solution</button>`;
      out += `<button class="hbtn hbtn-primary hbtn-pulse" onclick="hostAction('return_to_question')">↩ Retour question</button>`;
    }

    out += `</div></div>`;
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 2 : NAVIGATION (MANCHES & QUESTIONS)
  // ═══════════════════════════════════════════════════════════
  // Bouton "Question suivante" en surbrillance pulsée quand on est en question active
  const _burgerScored   = phase === 'manual_scoring' && !!(gs?.burgerFinalScore);
  const _voteRevealed   = gs?.phaseMeta?.answerMode === 'vote_revealed';
  const _videoScored    = isVideoChallenge && gs?.videoState?.phase === 'scored';
  const nextQPulse = (
    ['round_intro','training_video','answer_reveal'].includes(phase) ||
    _burgerScored ||
    _voteRevealed ||
    _videoScored
  ) ? 'hbtn-pulse' : '';
  out += `<div class="host-section host-section-nav">
    <div class="host-section-label">🧭 NAVIGATION</div>
    <div class="host-nav-grid">
      <button class="hbtn hbtn-nav" onclick="hostAction('prev_round')" title="Manche précédente">◀ Manche</button>
      <button class="hbtn hbtn-nav" onclick="hostAction('prev_question')" title="Question précédente">◀ Question</button>
      <button class="hbtn hbtn-nav hbtn-nav-fwd ${nextQPulse}" onclick="hostAction('next_question')" title="Question suivante">Question ▶</button>
      <button class="hbtn hbtn-nav hbtn-nav-fwd" onclick="hostAction('next_round')" title="Manche suivante">Manche ▶</button>
    </div>
    <div class="host-ctrl-row" style="margin-top:6px;">
      ${['question','waiting','answer_reveal','manual_scoring'].includes(phase) ? `
        <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('show_results')">📊 Scores</button>
        <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('start_round')">🔁 Refaire manche</button>
      ` : ''}
      ${phase === 'round_end' ? `
        <button class="hbtn hbtn-success hbtn-pulse hbtn-wide" onclick="hostAction('next_round')">▶▶ Manche suivante</button>
        <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('show_results')">📊 Voir les scores</button>
        <button class="hbtn hbtn-danger hbtn-sm" onclick="hostAction('finish_quiz')">🏁 Terminer le quiz</button>
      ` : ''}
      ${phase === 'results' ? `
        <button class="hbtn hbtn-success hbtn-pulse hbtn-sm" onclick="hostAction('next_round')">▶ Manche suivante</button>
        <button class="hbtn hbtn-danger hbtn-sm" onclick="hostAction('finish_quiz')">🏁 Terminer le quiz</button>
      ` : ''}
    </div>
  </div>`;

  // ═══════════════════════════════════════════════════════════
  // SECTION 3 : GESTION DE L'AFFICHAGE
  // ═══════════════════════════════════════════════════════════
  const _voteAM = gs?.phaseMeta?.answerMode;
  const isVotePhase = _voteAM === 'vote_input' || _voteAM === 'vote_voting' || _voteAM === 'vote_revealing' || _voteAM === 'vote_revealed';
  const isVoteRevealing = _voteAM === 'vote_revealing';
  const voteRevCursor = gs?.voteState?.revealCursor ?? 0;
  const voteRevTotal  = gs?.voteState?.options?.length ?? 0;
  out += `<div class="host-section host-section-display">
    <div class="host-section-label">📺 AFFICHAGE</div>
    <div class="host-ctrl-row">
      ${['question','waiting','manual_scoring','round_end','answer_reveal'].includes(phase) ? `
        <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('show_results')">📊 Scores</button>` : ''}
      ${!isBurger && !isBuzzer && !isVotePhase && !isVideoChallenge && ['question','waiting','manual_scoring'].includes(phase) ? `
        <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('reveal_answer')">📋 Solution</button>` : ''}
      ${_voteAM === 'vote_input' ? (() => {
        const _vConnected = state.players.filter(p => p.connected);
        const _vConnCount = _vConnected.length;
        const _vAnswers = gs?.answers?.[gs?.currentQuestion?.id] || {};
        const _vPropCount = Object.values(_vAnswers).filter(a => a?.answer?.trim()).length;
        // Afficher uniquement la barre de progression (le bouton "Lancer les votes" est dans la section VOTE)
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,.05);border-radius:8px;">
              <span style="font-size:.82rem;color:rgba(255,255,255,.55);">⏳ Propositions reçues :</span>
              <strong style="color:#f7971e;font-size:.9rem;">${_vPropCount}/${_vConnCount}</strong>
              <div style="flex:1;height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${_vConnCount>0?Math.round(_vPropCount/_vConnCount*100):0}%;background:linear-gradient(90deg,#f7971e,#ffd700);border-radius:3px;transition:width .4s;"></div>
              </div>
            </div>`;
      })() : ''}
      ${_voteAM === 'vote_voting' ? (() => {
        const _vvConnected = state.players.filter(p => p.connected);
        const _vvConnCount = _vvConnected.length;
        const _vvVoteCount = Object.keys(gs?.voteState?.votes || {}).length;
        const _vvAllVoted = _vvVoteCount >= _vvConnCount && _vvConnCount > 0;
        return _vvAllVoted
          ? `<button class="hbtn hbtn-success hbtn-pulse" onclick="hostAction('vote_reveal')">📋 Révéler les votes</button>`
          : `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,.05);border-radius:8px;">
              <span style="font-size:.82rem;color:rgba(255,255,255,.55);">⏳ Votes reçus :</span>
              <strong style="color:#38ef7d;font-size:.9rem;">${_vvVoteCount}/${_vvConnCount}</strong>
              <div style="flex:1;height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${_vvConnCount>0?Math.round(_vvVoteCount/_vvConnCount*100):0}%;background:linear-gradient(90deg,#38ef7d,#4ade80);border-radius:3px;transition:width .4s;"></div>
              </div>
            </div>`;
      })() : ''}
      ${isVoteRevealing ? `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button class="hbtn hbtn-success hbtn-pulse" onclick="hostAction('vote_reveal_next')" ${voteRevCursor >= voteRevTotal ? 'disabled' : ''}>
            ▶ Révéler suivant <span style="font-size:.78rem;opacity:.7;">(${voteRevCursor}/${voteRevTotal})</span>
          </button>
          ${voteRevCursor >= voteRevTotal ? `<button class="hbtn hbtn-primary hbtn-sm" onclick="hostAction('next_question')">➡ Question suivante</button>` : ''}
        </div>` : ''}
      ${phase === 'answer_reveal' && !isVoteRevealing ? `
        <button class="hbtn hbtn-primary hbtn-sm" onclick="hostAction('return_to_question')">↩ Retour question</button>` : ''}
      <button class="hbtn hbtn-secondary hbtn-sm" onclick="showBroadcastModal()">📡 Message</button>
    </div>
  </div>`;

  // ═══════════════════════════════════════════════════════════
  // SECTION 4 : CHRONOMÈTRE
  // ═══════════════════════════════════════════════════════════
  if (['question','waiting','manual_scoring'].includes(phase)) {
    const pct = timerInfo?.totalSec > 0 ? Math.round(timerInfo.remainingSec / timerInfo.totalSec * 100) : 0;
    // Déterminer si la barre est urgente (moins de 20%)
    const timerUrgent = timerInfo && pct < 20;
    out += `<div class="host-section">
      <div class="host-section-label">⏱️ CHRONOMÈTRE</div>
      ${timerInfo ? `
        <div style="margin-bottom:10px;">
          <div class="row" style="justify-content:space-between;margin-bottom:6px;">
            <span class="muted" style="font-size:.82rem;">Temps restant</span>
            <strong style="color:${timerUrgent?'#eb3349':'#ff9a56'};font-size:1.5rem;${timerUrgent?'animation:pulse-scale 0.6s ease-in-out infinite;':''}">${timerInfo.remainingSec}s</strong>
          </div>
          <div class="progress-bar"><div class="fill" style="width:${pct}%;background:${timerUrgent?'linear-gradient(90deg,#eb3349,#ff6b7a)':''}"></div></div>
        </div>` : ''}
      <div class="timer-presets">
        ${[5,10,20,30,45,60].map(s => `<button class="timer-preset-btn" onclick="setTimerPreset(${s})">${s}s</button>`).join('')}
      </div>
      <div class="row" style="gap:6px;margin-top:6px;">
        <input type="number" id="timer-sec" value="${timerInfo?.remainingSec || 30}" min="1" max="300" style="width:76px;flex-shrink:0;font-size:.9rem;">
        <button class="hbtn hbtn-success" style="flex:1;" onclick="startTimer()">⏱ Timer</button>
      </div>
    </div>`;
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 5 : BUZZER (si actif) — remontée en priorité
  // ═══════════════════════════════════════════════════════════
  if ((isBuzzer || gs?.buzzerState?.firstPseudo) && currentQ?.type !== 'vote') {
    const bz = gs?.buzzerState;
    const buzzerQueuePseudos = (gs.buzzerQueue || [])
      .map(pid => state.players.find(p => (p.id||p.playerId) === pid)?.pseudo || pid)
      .filter(Boolean);
    const allConnected = state.players.filter(p => p.connected).length;
    const blr = gs?.buzzerLastResult;

    out += `<div class="host-section host-section-buzzer">
      <div class="host-section-label">🔔 BUZZER</div>`;

    if (!bz?.firstPseudo && isLocked) {
      // Buzzer verrouillé — bouton "Activer" très visible avec pulse
      out += `
        <div style="text-align:center;padding:16px 8px;">
          <p class="muted" style="margin-bottom:14px;font-size:.9rem;">🔒 Buzzers désactivés — les joueurs voient un buzzer gris</p>
          <button class="hbtn hbtn-success hbtn-wide hbtn-pulse" style="font-size:1.1rem;padding:16px;" onclick="hostAction('activate_buzzer')">🔔 ACTIVER LES BUZZERS</button>
        </div>`;
    } else if (bz?.firstPseudo) {
      // Un joueur a buzzé
      const buzzerPlayer = state.players.find(p => (p.id||p.playerId) === bz.firstPlayerId);
      out += `
        <div class="buzzer-host-card ${blr?.result === 'correct' ? 'buzzer-host-correct' : blr?.result === 'wrong' ? 'buzzer-host-wrong' : ''}">
          <div class="row" style="gap:10px;align-items:center;margin-bottom:10px;">
            <span style="font-size:2rem;">${buzzerPlayer?.avatar || '🎮'}</span>
            <div>
              <strong style="font-size:1.1rem;">${bz.firstPseudo}</strong>
              <p class="muted" style="font-size:.8rem;">a buzzé — interrogez oralement</p>
              ${buzzerQueuePseudos.length > 1 ? `<p class="muted" style="font-size:.72rem;">File (${buzzerQueuePseudos.length}/${allConnected}) : ${buzzerQueuePseudos.join(' → ')}</p>` : ''}
              ${blr ? `<p style="font-size:.85rem;font-weight:700;margin-top:4px;color:${blr.result==='correct'?'#38ef7d':'#eb3349'};">${blr.result==='correct'?'✅ Bonne réponse !':'❌ Mauvaise réponse'}</p>` : ''}
            </div>
          </div>
          <div class="host-ctrl-row">
            <button class="hbtn hbtn-success hbtn-pulse" style="flex:1;" onclick="hostAction('award_buzzer_correct')">✅ Bonne (+1)</button>
            <button class="hbtn hbtn-danger" style="flex:1;" onclick="hostAction('buzzer_mark_wrong')">❌ Mauvaise</button>
          </div>
          <div class="host-ctrl-row" style="margin-top:6px;">
            <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('reveal_answer')">📋 Afficher réponse</button>
            <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('next_question')">⏭ Question suiv.</button>
          </div>
        </div>`;
    } else {
      // Buzzers actifs, en attente
      out += `
        <div style="text-align:center;padding:10px;">
          <p style="color:#ffa500;font-weight:600;">🔔 Buzzers actifs — en attente d'un joueur…</p>
          <p class="muted" style="font-size:.8rem;margin-top:4px;">${buzzerQueuePseudos.length}/${allConnected} ont déjà participé</p>
          <button class="hbtn hbtn-secondary hbtn-sm" style="margin-top:8px;" onclick="hostAction('reveal_answer')">📋 Afficher réponse</button>
        </div>`;
    }
    out += `</div>`;
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 5.5 : VOTE (si type vote actif)
  // ═══════════════════════════════════════════════════════════
  const isVoteActive = currentQ?.type === 'vote' && ['question','waiting','manual_scoring','answer_reveal'].includes(phase);
  if (isVoteActive) {
    const voteState = gs?.voteState;
    const answerMode = gs?.phaseMeta?.answerMode;
    const answersForQ = gs?.answers?.[currentQ?.id] || {};
    const submittedCount = Object.values(answersForQ).filter(a => a.answer?.trim()).length;
    const connectedCount = state.players.filter(p => p.connected).length;

    out += `<div class="host-section host-section-buzzer">
      <div class="host-section-label">🗳️ VOTE</div>`;

    if (answerMode === 'vote_input') {
      // Phase 1 : collecte des réponses texte
      out += `
        <div style="text-align:center;padding:12px 8px;">
          <p style="font-size:1.6rem;font-weight:700;color:#f59e0b;margin-bottom:4px;">${submittedCount}<span class="muted" style="font-size:.9rem;">/${connectedCount}</span></p>
          <p class="muted" style="font-size:.8rem;margin-bottom:14px;">réponses reçues</p>
          <div class="host-ctrl-row">
            <button class="hbtn hbtn-primary hbtn-wide hbtn-pulse" onclick="hostAction('vote_start_voting')">🗳️ Lancer les votes</button>
          </div>
        </div>`;
      // Liste des réponses reçues (anonymisées dans l'ordre d'arrivée)
      const submittedAnswers = Object.values(answersForQ).filter(a => a.answer?.trim());
      if (submittedAnswers.length) {
        out += `<div style="margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px;">
          <p class="muted" style="font-size:.68rem;text-transform:uppercase;margin-bottom:6px;">Réponses collectées (visible MJ uniquement)</p>`;
        for (const a of submittedAnswers) {
          out += `<div style="padding:5px 10px;border-radius:7px;background:rgba(255,255,255,.05);margin-bottom:4px;font-size:.83rem;display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#f59e0b;font-size:.72rem;font-weight:600;">${a.pseudo || '?'}</span>
            <span style="flex:1;margin-left:8px;">${a.answer}</span>
          </div>`;
        }
        out += `</div>`;
      }
    } else if (answerMode === 'vote_proposal_reveal') {
      // Phase 1b : révélation des propositions une par une sur le TV
      const prs = gs?.proposalRevealState;
      const cursor = prs?.revealCursor || 0;
      const total  = prs?.proposals?.length || 0;
      const current = total > 0 && cursor > 0 ? prs.proposals[cursor - 1] : null;
      out += `
        <div style="text-align:center;padding:10px 8px;">
          <p class="muted" style="font-size:.8rem;margin-bottom:10px;">Révélation des propositions — <strong>${cursor}/${total}</strong> affichée(s)</p>
          ${current ? `<div style="padding:8px 12px;border-radius:10px;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);margin-bottom:10px;text-align:left;">
            <span style="font-size:.7rem;color:#f59e0b;display:block;margin-bottom:3px;">👁 Proposition affichée :</span>
            <strong>"${current.answer}"</strong>
          </div>` : '<p class="muted" style="margin-bottom:10px;font-size:.8rem;">Appuyez sur le bouton pour afficher la première proposition.</p>'}
          <div class="host-ctrl-row">
            ${cursor < total ? `<button class="hbtn hbtn-success hbtn-wide hbtn-pulse" onclick="hostAction('vote_proposal_reveal_next')">▶ Proposition suivante (${total - cursor} restante${total - cursor > 1 ? 's' : ''})</button>` : `<p class="muted" style="font-size:.8rem;">✅ Toutes les propositions ont été affichées</p>`}
          </div>
        </div>`;
    } else if (answerMode === 'vote_voting') {
      // Phase 2 : vote en cours
      const options = voteState?.options || [];
      const votes = voteState?.votes || {};
      const voterCount = Object.keys(votes).length;
      out += `
        <div style="text-align:center;padding:6px 8px 12px;">
          <p class="muted" style="font-size:.8rem;margin-bottom:10px;">Vote en cours — <strong>${voterCount}/${connectedCount}</strong> ont voté</p>
        </div>`;
      if (options.length) {
        out += `<div style="border-top:1px solid rgba(255,255,255,.08);padding-top:8px;">
          <p class="muted" style="font-size:.68rem;text-transform:uppercase;margin-bottom:6px;">Options (votes en direct)</p>`;
        for (const opt of options) {
          const voteCount = Object.values(votes).filter(v => v === opt.idx).length;
          const decoyBadge = opt.isDecoy ? `<span style="background:#eb334920;color:#eb3349;border-radius:4px;padding:1px 5px;font-size:.65rem;margin-left:4px;">LEURRE</span>` : '';
          out += `<div style="padding:6px 10px;border-radius:7px;background:rgba(255,255,255,.05);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;font-size:.83rem;">
            <span>${opt.text}${decoyBadge}</span>
            <strong style="color:#f59e0b;flex-shrink:0;margin-left:8px;">${voteCount} 🗳️</strong>
          </div>`;
        }
        out += `</div>`;
      }
    } else if (answerMode === 'vote_revealed') {
      // Phase 3 : résultats révélés
      const options = voteState?.options || [];
      const votes = voteState?.votes || {};
      out += `<p class="muted" style="font-size:.8rem;margin-bottom:8px;text-align:center;">✅ Résultats révélés</p>`;
      if (options.length) {
        const sorted = [...options].sort((a, b) => {
          const vA = Object.values(votes).filter(v => v === a.idx).length;
          const vB = Object.values(votes).filter(v => v === b.idx).length;
          return vB - vA;
        });
        out += `<div>`;
        for (const opt of sorted) {
          const voteCount = Object.values(votes).filter(v => v === opt.idx).length;
          const decoyBadge = opt.isDecoy ? `<span style="background:#eb334920;color:#eb3349;border-radius:4px;padding:1px 5px;font-size:.65rem;margin-left:4px;">LEURRE</span>` : '';
          out += `<div style="padding:6px 10px;border-radius:7px;background:rgba(255,255,255,.05);margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;font-size:.83rem;">
            <span>${opt.text}${decoyBadge}</span>
            <strong style="color:${voteCount>0?'#38ef7d':'#aaa'};flex-shrink:0;margin-left:8px;">${voteCount} 🗳️</strong>
          </div>`;
        }
        out += `</div>`;
      }
    }

    out += `</div>`;
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 6 : BURGER
  // ═══════════════════════════════════════════════════════════
  if (isBurger && ['question','waiting','manual_scoring'].includes(phase)) {
    const selectedPlayerId = gs?.burgerSelectedPlayerId || null;
    const selectedTeamId   = gs?.burgerSelectedTeamId   || null;
    const isSelected       = !!(selectedPlayerId || selectedTeamId);
    const selectedPseudo   = gs?.burgerSelectedPseudo   || null;
    const burgerState      = gs?.burgerState;
    const totalItems       = gs?.currentQuestion?.items?.length || 10;
    const allItemsShown    = burgerState && burgerState.currentItemIndex >= totalItems - 1;
    const burgerFinalScore = gs?.burgerFinalScore;

    const connectedPlayers = state.players.filter(p => p.connected);
    const availableTeams   = state.leaderboardTeams;

    const playerBtns = connectedPlayers.map(p => `
      <button class="burger-player-btn ${p.playerId === selectedPlayerId ? 'selected' : ''}"
        onclick="hostAction('burger_select_player',{playerId:'${p.playerId}'})">
        <span style="font-size:1.2rem;display:block;margin-bottom:3px;">${p.avatar || '🎮'}</span>
        <span style="font-size:.75rem;">${p.pseudo}</span>
      </button>`).join('');

    const teamBtns = availableTeams.map(t => `
      <button class="burger-player-btn ${t.teamId === selectedTeamId ? 'selected' : ''}"
        style="background:${t.teamId === selectedTeamId ? 'rgba(247,151,30,.3)' : 'rgba(255,255,255,.06)'};"
        onclick="hostAction('burger_select_team',{teamId:'${t.teamId}'})">
        <span style="font-size:1.2rem;display:block;margin-bottom:3px;">⚽</span>
        <span style="font-size:.75rem;">${t.name}</span>
      </button>`).join('');

    const scoreForm = `
      <div style="margin-top:12px;padding:14px;background:rgba(247,151,30,.1);border:1px solid rgba(247,151,30,.4);border-radius:12px;">
        ${phase === 'question' ? `
          <div class="host-ctrl-row" style="margin-bottom:10px;">
            <button class="hbtn hbtn-warning hbtn-wide hbtn-pulse" onclick="hostAction('burger_pass')">
              ⏭ Passer — afficher "[${selectedPseudo}] répond"
            </button>
          </div>` : ''}
        <p style="font-size:.88rem;color:#f7971e;margin-bottom:10px;font-weight:600;">🎯 Saisissez le score (0–10) :</p>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <input type="number" min="0" max="10" id="burger-score-input" placeholder="0-10"
            style="width:80px;text-align:center;font-size:1.5rem;font-weight:700;padding:8px;border-radius:10px;
            background:rgba(255,255,255,.1);border:2px solid rgba(247,151,30,.6);color:#fff;">
          <button class="hbtn hbtn-success hbtn-wide ${burgerFinalScore ? '' : 'hbtn-pulse'}" onclick="submitBurgerScore()">✅ Valider le score</button>
        </div>
        ${burgerFinalScore ? `<p style="margin-top:8px;font-size:.85rem;color:#38ef7d;">✓ Score de ${burgerFinalScore.score}/10 attribué à <strong>${burgerFinalScore.pseudo}</strong>${selectedTeamId ? ' (équipe — chaque membre a reçu les points)' : ''}</p>` : ''}
      </div>`;

    out += `
      <div class="host-section">
        <div class="host-section-label">🍔 BURGER — PILOTAGE</div>
        ${!isSelected ? `
          <div style="background:rgba(255,180,0,.15);border:2px solid rgba(255,180,0,.7);border-radius:10px;padding:10px 14px;margin-bottom:10px;text-align:center;animation:pulse-scale 1.4s ease-in-out infinite;">
            <span style="font-size:1.4rem;">⚠️</span>
            <span style="font-weight:700;color:#fbbf24;font-size:.92rem;margin-left:6px;">Sélectionnez un participant pour commencer !</span>
          </div>
          ${availableTeams.length ? `
            <p class="muted" style="font-size:.73rem;margin-bottom:4px;">⚽ Équipes :</p>
            <div class="burger-player-grid">${teamBtns}</div>
            <p class="muted" style="font-size:.73rem;margin-bottom:4px;margin-top:8px;">🎮 Joueurs :</p>` : ''}
          <div class="burger-player-grid">${playerBtns || '<p class="muted">Aucun joueur connecté</p>'}</div>
        ` : `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;background:rgba(247,151,30,.12);border-radius:10px;">
            <span style="font-size:1.3rem;">${selectedTeamId ? '⚽' : '🎮'}</span>
            <span style="font-weight:700;color:#f7971e;">${selectedPseudo}</span>
            <span class="muted" style="font-size:.75rem;">${selectedTeamId ? '(équipe)' : '(joueur)'}</span>
            <button class="hbtn hbtn-secondary hbtn-sm" style="margin-left:auto;" onclick="hostAction('burger_select_player',{playerId:null})">✕</button>
          </div>
          ${availableTeams.length ? `
            <details style="margin-bottom:6px;">
              <summary class="muted" style="cursor:pointer;font-size:.78rem;">Changer de participant</summary>
              <div style="margin-top:6px;">
                ${availableTeams.length ? `<p class="muted" style="font-size:.73rem;margin-bottom:4px;">⚽ Équipes</p><div class="burger-player-grid">${teamBtns}</div>` : ''}
                <p class="muted" style="font-size:.73rem;margin-bottom:4px;margin-top:6px;">🎮 Joueurs</p>
                <div class="burger-player-grid">${playerBtns}</div>
              </div>
            </details>` : `
            <div class="burger-player-grid" style="margin-bottom:6px;">${playerBtns}</div>`}
          ${!allItemsShown ? `
            <div class="host-ctrl-row" style="margin-top:6px;gap:6px;">
              ${burgerState && burgerState.currentItemIndex > 0 ? `
                <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('burger_prev_item')" title="Revenir à l'élément précédent">
                  ← Précédent
                </button>` : ''}
              <button class="hbtn hbtn-success hbtn-wide hbtn-pulse" onclick="hostAction('burger_next_item')">
                🍔 ${burgerState && burgerState.currentItemIndex >= 0 ? `Élément suivant (${burgerState.currentItemIndex+1}/${totalItems})` : 'Démarrer'}
              </button>
            </div>` : scoreForm}
        `}
      </div>`;
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 6b : CHALLENGE VIDÉO
  // ═══════════════════════════════════════════════════════════
  if (isVideoChallenge && ['question','waiting','manual_scoring'].includes(phase)) {
    const vs = gs?.videoState;
    const vPhase = vs?.phase || 'select';
    const vPseudo = vs?.selectedPseudo;
    const connPlayers = state.players.filter(p => p.connected);
    const availTeams = state.teams?.filter(t => connPlayers.some(p => p.teamId === t.id)) || [];

    const playerBtns = connPlayers.map(p =>
      `<button class="burger-player-btn ${vs?.selectedPlayerId===p.id?'selected':''}"
        onclick="hostAction('video_select_player',{playerId:'${p.id}'})">${p.avatar||'🎮'} ${p.pseudo}</button>`
    ).join('');
    const teamBtns = availTeams.map(t =>
      `<button class="burger-player-btn ${vs?.selectedTeamId===t.id?'selected':''}"
        onclick="hostAction('video_select_team',{teamId:'${t.id}'})">⚽ ${t.name}</button>`
    ).join('');

    const videoUrl = gs?.currentQuestion?.mediaUrl ? resolveMedia(gs.currentQuestion.mediaUrl) : null;

    const scoreForm = `
      <div style="padding:8px 0;">
        <div style="font-size:.85rem;color:rgba(255,255,255,.6);margin-bottom:8px;text-align:center;">Attribuez un score pour <strong style="color:#f7971e;">${vPseudo}</strong></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="number" id="video-score-input" min="0" max="10" step="1" value="5"
            style="width:70px;text-align:center;font-size:1.4rem;font-weight:700;padding:8px;">
          <span class="muted" style="font-size:.85rem;">/10</span>
          <button class="hbtn hbtn-success hbtn-pulse" style="flex:1;" onclick="submitVideoScore()">✅ Valider le score</button>
        </div>
        ${vs?.score != null ? `<p style="margin-top:8px;font-size:.85rem;color:#38ef7d;text-align:center;">✓ Score de ${vs.score}/10 attribué à <strong>${vPseudo}</strong></p>` : ''}
      </div>`;

    out += `<div class="host-section host-section-buzzer">
      <div class="host-section-label">🎬 CHALLENGE VIDÉO</div>`;

    const qTrainUrl = gs?.currentQuestion?.trainingVideoUrl;

    if (vPhase === 'select') {
      const _vNoSel = !vs?.selectedPlayerId && !vs?.selectedTeamId;
      if (_vNoSel) {
        out += `<div style="background:rgba(255,180,0,.15);border:2px solid rgba(255,180,0,.7);border-radius:10px;padding:10px 14px;margin-bottom:10px;text-align:center;animation:pulse-scale 1.4s ease-in-out infinite;">
          <span style="font-size:1.4rem;">⚠️</span>
          <span style="font-weight:700;color:#fbbf24;font-size:.92rem;margin-left:6px;">Sélectionnez un participant pour commencer !</span>
        </div>`;
      }
      out += `<p class="muted" style="font-size:.8rem;margin-bottom:10px;">Choisissez qui réalise l'épreuve :</p>`;
      if (availTeams.length) {
        out += `<p class="muted" style="font-size:.73rem;margin-bottom:4px;">⚽ Équipes</p><div class="burger-player-grid">${teamBtns}</div>`;
        out += `<p class="muted" style="font-size:.73rem;margin-bottom:4px;margin-top:6px;">🎮 Joueurs</p>`;
      }
      out += `<div class="burger-player-grid">${playerBtns || '<p class="muted">Aucun joueur connecté</p>'}</div>`;
      if (vs?.selectedPlayerId || vs?.selectedTeamId) {
        out += `<div class="host-ctrl-row" style="margin-top:10px;">`;
        if (qTrainUrl) {
          // Si une vidéo d'entraînement est configurée sur la question : passer par l'étape entraînement
          out += `<button class="hbtn hbtn-warning hbtn-wide hbtn-pulse" onclick="hostAction('video_start_training_ready')">🏋️ Attention entraînement →</button>`;
        } else {
          // Sinon : aller directement à l'écran "Tenez-vous prêt"
          out += `<button class="hbtn hbtn-success hbtn-wide hbtn-pulse" onclick="hostAction('video_mark_ready')">▶ Écran "Tenez-vous prêt" →</button>`;
        }
        out += `</div>`;
      }
    } else if (vPhase === 'training_ready') {
      out += `<div style="text-align:center;padding:8px;">
        <div style="font-size:1.1rem;font-weight:700;color:#ffd700;margin-bottom:12px;">🏋️ Entraînement — ${vPseudo}</div>
        <p class="muted" style="font-size:.85rem;margin-bottom:14px;">L'écran affiche "Attention entraînement !"</p>
        <button class="hbtn hbtn-warning hbtn-wide hbtn-pulse" onclick="hostAction('video_start_training_playing')">▶ Lancer la vidéo d'entraînement</button>
      </div>`;
    } else if (vPhase === 'training_playing') {
      const isTrainPlaying = vs?.trainingVideoControl?.action === 'play';
      out += `<div style="text-align:center;padding:8px;">
        <div style="font-size:1.1rem;font-weight:700;color:#ffd700;margin-bottom:8px;">🏋️ Entraînement en cours — ${vPseudo}</div>
        <div class="host-ctrl-row" style="margin-bottom:10px;">
          ${isTrainPlaying
            ? `<button class="hbtn hbtn-warning hbtn-sm" onclick="hostAction('video_training_control',{ctrl:'pause'})">⏸ Pause</button>`
            : `<button class="hbtn hbtn-success hbtn-sm" onclick="hostAction('video_training_control',{ctrl:'play'})">▶ Play</button>`}
          <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('video_training_control',{ctrl:'rewind'})">⏮ Début</button>
        </div>
        <button class="hbtn hbtn-success hbtn-wide hbtn-pulse" onclick="hostAction('video_mark_ready')">▶ Écran "Tenez-vous prêt" →</button>
      </div>`;
    } else if (vPhase === 'ready') {
      out += `<div style="text-align:center;padding:8px;">
        <div style="font-size:1.1rem;font-weight:700;color:#f7971e;margin-bottom:12px;">🎬 ${vPseudo}</div>
        <p class="muted" style="font-size:.85rem;margin-bottom:14px;">L'écran affiche "Tenez-vous prêt !"</p>
        <button class="hbtn hbtn-success hbtn-wide hbtn-pulse" onclick="hostAction('video_start_playing')">▶ Lancer la vidéo</button>
      </div>`;
    } else if (vPhase === 'playing') {
      const isVidPlaying = vs?.videoControl?.action === 'play';
      out += `<div style="text-align:center;padding:8px;">
        <div style="font-size:1.1rem;font-weight:700;color:#f7971e;margin-bottom:8px;">🎬 Vidéo en cours — ${vPseudo}</div>
        <div class="host-ctrl-row" style="margin-bottom:10px;">
          ${isVidPlaying
            ? `<button class="hbtn hbtn-warning hbtn-sm" onclick="hostAction('video_control',{ctrl:'pause'})">⏸ Pause</button>`
            : `<button class="hbtn hbtn-success hbtn-sm" onclick="hostAction('video_control',{ctrl:'play'})">▶ Play</button>`}
          <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('video_control',{ctrl:'rewind'})">⏮ Début</button>
        </div>
        <button class="hbtn hbtn-primary hbtn-wide hbtn-pulse" onclick="hostAction('video_start_eval')">⏭ Passer à l'évaluation</button>
      </div>`;
    } else if (vPhase === 'eval') {
      out += scoreForm;
    } else if (vPhase === 'scored') {
      out += `<div style="text-align:center;padding:12px;">
        <div style="font-size:2.5rem;font-weight:900;color:#f7971e;">${vs.score}<span style="font-size:1rem;color:rgba(255,255,255,.4);">/10</span></div>
        <div style="font-size:.9rem;margin-top:4px;">Score attribué à <strong style="color:#f7971e;">${vPseudo}</strong></div>
      </div>`;
    }

    out += `</div>`;
  }

  // ═══════════════════════════════════════════════════════════
  // SECTION 7 : ATTRIBUTION DE POINTS
  // ═══════════════════════════════════════════════════════════
  if (['manual_scoring','answer_reveal','waiting','question','results'].includes(phase)) {
    const allPlayers = state.leaderboardPlayers.slice(0, 20);
    const allTeams = state.leaderboardTeams; // déjà filtrées côté serveur (uniquement équipes avec joueurs)

    if (allPlayers.length) {
      out += `
        <div class="host-section">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
            <div class="host-section-label" style="margin:0;">🏅 POINTS</div>
            <div class="row" style="gap:5px;">
              <button class="hbtn hbtn-success hbtn-sm" onclick="awardAll(1)">+1 Tous</button>
              <button class="hbtn hbtn-danger hbtn-sm" onclick="awardAll(-1)">-1 Tous</button>
            </div>
          </div>
          <div class="player-point-grid">
            ${allPlayers.map(p => `
              <div class="player-point-card">
                <span class="p-avatar">${p.avatar || '🎮'}</span>
                <div class="p-pseudo">${p.pseudo}</div>
                <div class="p-score">${p.scoreTotal ?? 0} pts</div>
                <div class="pt-btns">
                  <button class="pt-btn pt-btn-minus" onclick="awardPoints('${p.playerId}',-1)">-1</button>
                  <button class="pt-btn pt-btn-plus" onclick="awardPoints('${p.playerId}',1)">+1</button>
                </div>
              </div>`).join('')}
          </div>
          ${allTeams.length ? `
            <div style="margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px;">
              <div class="host-section-label" style="margin-bottom:7px;">⚽ PAR ÉQUIPE</div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;">
                ${allTeams.map(t => `
                  <div style="background:rgba(255,255,255,.05);border-radius:10px;padding:8px;text-align:center;">
                    <div style="font-size:.82rem;font-weight:600;margin-bottom:2px;">${t.name}</div>
                    <div style="font-size:.72rem;color:#f59e0b;margin-bottom:6px;">${t.scoreTotal??0} pts</div>
                    <div class="pt-btns">
                      <button class="pt-btn pt-btn-minus" onclick="awardTeam('${t.id}','${t.name?.replace(/'/g,"\\'") || t.id}',-1)">-1</button>
                      <button class="pt-btn pt-btn-plus" onclick="awardTeam('${t.id}','${t.name?.replace(/'/g,"\\'") || t.id}',1)">+1</button>
                    </div>
                  </div>`).join('')}
              </div>
            </div>` : ''}
        </div>`;
    }
  }

  // ── Révélation des réponses ───────────────────────────────────
  if (phase === 'answer_reveal' && gs?.revealedAnswer) {
    const revealed = gs.revealedAnswer;
    const correctNorm = (revealed.correctAnswer || '').trim().toLowerCase();
    const isTFReveal  = gs?.phaseMeta?.answerMode === 'true_false';
    const showExpl    = !!gs?.phaseMeta?.showTFExplanation;
    const expl        = revealed.explanation || '';

    const answerRows = (revealed.answers || []).map(a => {
      const isCorrect = (a.answer || '').trim().toLowerCase() === correctNorm;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:8px;background:${isCorrect?'rgba(56,239,125,.1)':'rgba(235,51,73,.08)'};margin-bottom:4px;">
        <span style="font-weight:600;font-size:.88rem;">${a.pseudo || '—'}</span>
        <span style="color:${isCorrect?'#38ef7d':'#eb3349'};font-size:.85rem;">${isTFReveal ? formatTrueFalseAnswer(a.answer) : (a.answer || '—')} ${isCorrect?'✅':'❌'}</span>
      </div>`;
    }).join('') || '<p class="muted">Aucune réponse</p>';

    out += `
      <div class="host-section">
        <div class="host-section-label">📋 RÉPONSES RÉVÉLÉES</div>
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(56,239,125,.08);border:1px solid rgba(56,239,125,.25);border-radius:8px;margin-bottom:8px;">
          <div style="flex:1;">
            <p class="muted" style="font-size:.65rem;margin-bottom:2px;">BONNE RÉPONSE</p>
            <p style="font-size:1.2rem;font-weight:700;color:#38ef7d;">${isTFReveal ? formatTrueFalseAnswer(revealed.correctAnswer) : (revealed.correctAnswer || '—')}</p>
          </div>
          ${isTFReveal ? `
            <div style="display:flex;flex-direction:column;gap:4px;">
              ${expl && !showExpl ? `
                <button class="hbtn hbtn-success hbtn-sm hbtn-pulse" onclick="hostAction('reveal_tf_explanation')" title="Afficher l'explication sur le TV">
                  💡 Afficher l'explication
                </button>` : ''}
              ${showExpl ? `
                <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('hide_tf_explanation')" title="Masquer l'explication">
                  🙈 Masquer l'explication
                </button>` : ''}
              ${!expl ? `<span class="muted" style="font-size:.72rem;font-style:italic;">Aucune explication saisie</span>` : ''}
            </div>` : ''}
        </div>
        ${isTFReveal && expl ? `
          <div style="padding:8px 12px;background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.2);border-radius:8px;margin-bottom:8px;">
            <p class="muted" style="font-size:.65rem;margin-bottom:3px;">💡 EXPLICATION (visible admin)</p>
            <p style="font-size:.88rem;line-height:1.4;color:rgba(255,255,255,.85);">${expl}</p>
          </div>` : ''}
        ${(revealed.revealImage || revealed.revealText || revealed.revealAudio) ? `
          <div style="margin-bottom:8px;">
            <p class="muted" style="font-size:.65rem;margin-bottom:4px;">✨ CONTENU DE RÉVÉLATION (affiché sur TV)</p>
            ${renderRevealMedia(revealed, 'host')}
          </div>` : ''}
        <div>${answerRows}</div>
      </div>`;
  }

  // ── Bilan de manche ───────────────────────────────────────────
  if (phase === 'results') {
    const rnd = gs?.currentRound;
    const questions = Array.isArray(rnd?.questions) ? rnd.questions : [];
    if (questions.length) {
      const qRows = questions.map((q, i) => {
        const answersArr = Object.values(gs?.answers?.[q.id] || {});
        const correctNorm = (q.correctAnswer || '').trim().toLowerCase();
        const correctCount = answersArr.filter(a => (a.answer||'').trim().toLowerCase() === correctNorm).length;
        return `<div style="padding:8px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:5px;">
          <div style="display:flex;justify-content:space-between;gap:10px;">
            <div style="flex:1;">
              <span class="muted" style="font-size:.68rem;">${i+1}. ${(q.type||'?').toUpperCase()}</span>
              <p style="margin:2px 0;font-weight:600;font-size:.88rem;">${q.content||'—'}</p>
              ${q.correctAnswer ? `<p style="color:#38ef7d;font-size:.76rem;">✓ ${q.correctAnswer}</p>` : ''}
            </div>
            ${answersArr.length ? `<div style="text-align:right;"><strong>${correctCount}/${answersArr.length}</strong><p class="muted" style="font-size:.65rem;">correct</p></div>` : ''}
          </div>
        </div>`;
      }).join('');
      out += `<div class="host-section">
        <div class="host-section-label">📊 BILAN — ${rnd?.title||'MANCHE'}</div>
        ${qRows}
      </div>`;
    }
    out += renderScoreboard(state.leaderboardPlayers, '🏆 Classement');
    if (state.leaderboardTeams.length) {
      out += `<div class="card"><h3>👥 Équipes</h3>
        <table><thead><tr><th>Rang</th><th>Équipe</th><th>Score</th></tr></thead>
        <tbody>${state.leaderboardTeams.map((t,i) => `<tr class="rank-${i+1}"><td>${t.rank??i+1}</td><td>${t.name}</td><td><strong>${t.scoreTotal??0}</strong></td></tr>`).join('')}</tbody></table>
      </div>`;
    }
  }

  // ── Fin + cérémonie ───────────────────────────────────────────
  if (phase === 'end') {
    const fc = gs?.phaseMeta?.finalCeremony;
    if (!fc) {
      out += `<div class="host-section" style="text-align:center;">
        <p class="muted" style="margin-bottom:12px;">Lancez la cérémonie pour révéler le classement progressivement</p>
        <button class="hbtn hbtn-primary hbtn-wide hbtn-pulse" onclick="hostAction('final_ceremony_init')">🎊 Cérémonie finale</button>
        <div class="host-ctrl-row" style="margin-top:10px;">
          <button class="hbtn hbtn-secondary" onclick="hostAction('reset_game')">🔁 Nouvelle partie</button>
          <button class="hbtn hbtn-warning hbtn-sm" onclick="if(confirm('Éjecter tous les joueurs et changer de quiz ?')){hostAction('eject_players');}">🚪 Éjecter & changer quiz</button>
          <button class="hbtn hbtn-danger" onclick="if(confirm('Terminer et retourner à l\\'accueil ?'))hostAction('stop_session');navigate('home');">✕ Fermer</button>
        </div>
      </div>`;
    } else {
      const remaining = fc.revealOrder.length - fc.revealCursor;
      const teamsRemaining = (fc.teamsRevealOrder?.length || 0) - (fc.teamsRevealCursor || 0);
      const cvPlayers = state.admin.ceremonyView !== 'teams';
      const hasTeams = state.leaderboardTeams && state.leaderboardTeams.length > 0;
      out += `<div class="host-section">
        <div class="host-section-label">🎊 CÉRÉMONIE FINALE</div>
        ${hasTeams ? `<div class="host-ctrl-row" style="margin-bottom:8px;">
          <button class="hbtn hbtn-sm ${cvPlayers ? 'hbtn-primary' : 'hbtn-secondary'}" onclick="toggleCeremonyView('players')">👤 Joueurs</button>
          <button class="hbtn hbtn-sm ${!cvPlayers ? 'hbtn-primary' : 'hbtn-secondary'}" onclick="toggleCeremonyView('teams')">⚽ Équipes</button>
        </div>` : ''}
        <div class="host-ctrl-row">
          ${cvPlayers && remaining > 0 ? `<button class="hbtn hbtn-success hbtn-wide hbtn-pulse" onclick="hostAction('final_ceremony_reveal_next')">▶ Révéler (${remaining} restant${remaining>1?'s':''})</button>` : ''}
          ${!cvPlayers && teamsRemaining > 0 ? `<button class="hbtn hbtn-success hbtn-wide hbtn-pulse" onclick="hostAction('final_ceremony_reveal_next_team')">▶ Révéler équipe (${teamsRemaining} restant${teamsRemaining>1?'es':''})</button>` : ''}
          <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('final_ceremony_reset')">↩</button>
        </div>
        ${cvPlayers ? `<p class="muted" style="font-size:.75rem;margin-top:8px;">${fc.revealCursor}/${fc.revealOrder.length} révélé(s)</p>` : ''}
        ${!cvPlayers && fc.teamsRevealOrder ? `<p class="muted" style="font-size:.75rem;margin-top:8px;">${fc.teamsRevealCursor||0}/${fc.teamsRevealOrder.length} équipe(s) révélée(s)</p>` : ''}
        <div class="host-ctrl-row" style="margin-top:10px;">
          <button class="hbtn hbtn-secondary hbtn-sm" onclick="hostAction('reset_game')">🔁 Nouvelle partie</button>
          <button class="hbtn hbtn-warning hbtn-sm" onclick="if(confirm('Éjecter tous les joueurs et changer de quiz ?')){hostAction('eject_players');}">🚪 Éjecter & changer quiz</button>
          <button class="hbtn hbtn-danger hbtn-sm" onclick="if(confirm('Terminer et retourner à l\\'accueil ?')){hostAction('stop_session');navigate('home');}">✕ Fermer l'application</button>
        </div>
      </div>`;
      out += renderFinalCeremony(gs, state.leaderboardPlayers, state.leaderboardTeams);
    }
  }

  // Accordion des manches
  out += renderRoundsAccordion(gs);

  return out;
}

// ── Boutons actions de jeu (sans navigation) ──────────────────
function buildHostGameActions(gs, phase, isPaused, isBuzzer, isBurger) {
  const btns = [];
  if (phase === 'lobby') {
    btns.push({ label: '🏋️ Vidéo d\'entraînement', style: 'warning', onclick: "hostAction('start_training_video')" });
    btns.push({ label: '▶️ Démarrer le quiz', style: 'success', onclick: "hostAction('start_quiz')" });
  }
  if (phase === 'round_intro') {
    const hasTrainVid = !!(gs?.currentRound?.trainingVideoUrl);
    if (hasTrainVid) {
      btns.push({ label: '🏋️ Vidéo d\'entraînement', style: 'warning', onclick: "hostAction('start_training_video')" });
    }
    btns.push({ label: '▶️ Première question', style: 'success', onclick: "hostAction('next_question')" });
    btns.push({ label: '🔁 Réafficher intro', style: 'secondary', onclick: "hostAction('start_round')" });
  }
  if (phase === 'training_video') {
    btns.push({ label: '▶ Play', style: 'success', onclick: "hostAction('training_video_control',{ctrl:'play'})" });
    btns.push({ label: '⏸ Pause', style: 'warning', onclick: "hostAction('training_video_control',{ctrl:'pause'})" });
    btns.push({ label: '⏮ Début', style: 'secondary', onclick: "hostAction('training_video_control',{ctrl:'rewind'})" });
    btns.push({ label: '⏭ Première question', style: 'success', onclick: "hostAction('stop_training_video')" });
  }
  if (['question','waiting'].includes(phase)) {
    if (isPaused) {
      btns.push({ label: '▶️ Reprendre', style: 'success', onclick: "hostAction('resume_game')" });
    } else {
      btns.push({ label: '⏸️ Pause', style: 'warning', onclick: "hostAction('pause_game')" });
    }
    if (isBurger) {
      btns.push({ label: '🍔 Élément suivant', style: 'success', onclick: "hostAction('burger_next_item')" });
    } else {
      btns.push({ label: '📋 Révéler réponse', style: 'secondary', onclick: "hostAction('reveal_answer')" });
    }
    btns.push({ label: '🔁 Refresh question', style: 'secondary', onclick: "hostAction('refresh_question')" });
    btns.push({ label: '📊 Afficher scores', style: 'secondary', onclick: "hostAction('show_results')" });
  }
  if (phase === 'answer_reveal') {
    btns.push({ label: '📊 Résultats manche', style: 'secondary', onclick: "hostAction('show_results')" });
  }
  if (phase === 'results') {
    btns.push({ label: '⏭️ Manche suivante', style: 'success', onclick: "hostAction('next_round')" });
    btns.push({ label: '🏁 Terminer le quiz', style: 'danger', onclick: "hostAction('finish_quiz')" });
  }
  if (phase === 'manual_scoring') {
    if (isBuzzer) {
      btns.push({ label: '✅ Bonne réponse (+1)', style: 'success', onclick: "hostAction('award_buzzer_correct')" });
      btns.push({ label: '❌ Mauvaise (suivant)', style: 'danger', onclick: "hostAction('award_buzzer_wrong')" });
    }
    if (isBurger) {
      btns.push({ label: '🍔 Élément suivant', style: 'success', onclick: "hostAction('burger_next_item')" });
    }
    btns.push({ label: '📋 Révéler réponse', style: 'secondary', onclick: "hostAction('reveal_answer')" });
    btns.push({ label: '📊 Résultats manche', style: 'secondary', onclick: "hostAction('show_results')" });
  }
  if (phase === 'end') {
    btns.push({ label: '🔁 Nouvelle partie', style: 'secondary', onclick: "hostAction('reset_game')" });
  }
  return btns;
}

// Accordion des manches pour le pilotage
function renderRoundsAccordion(gs) {
  if (!gs || !gs.currentRound) return '';
  const currentRoundIdx = gs.currentRoundIndex ?? -1;
  const currentQIdx     = gs.currentQuestionIndex ?? -1;
  const questions = Array.isArray(gs.currentRound?.questions) ? gs.currentRound.questions : [];
  if (!questions.length) return '';

  const isExpanded = hostExpandedRounds.has(currentRoundIdx);
  const questionsSummary = isExpanded ? questions.map((q, qi) => {
    const isCurrent = qi === currentQIdx;
    const answeredCount = gs.answers?.[q.id] ? Object.keys(gs.answers[q.id]).length : 0;
    const connectedCount = state.players.filter(p => p.connected).length;
    return `
      <div class="q-line ${isCurrent ? 'q-active' : ''}">
        <div style="flex:1;min-width:0;">
          <span class="muted" style="font-size:.7rem;">${qi+1}. ${(q.type||'').toUpperCase()}</span>
          <p style="font-size:.87rem;font-weight:${isCurrent?'700':'400'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:2px 0;">${q.content || '—'}</p>
          ${q.correctAnswer ? `<p style="font-size:.74rem;color:#38ef7d;">✓ ${q.correctAnswer}</p>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:8px;">
          ${isCurrent ? '<span class="badge blue" style="font-size:.68rem;padding:2px 7px;">▶ En cours</span>' : ''}
          ${answeredCount > 0 ? `<p class="muted" style="font-size:.72rem;margin-top:3px;">${answeredCount}/${connectedCount} rép.</p>` : ''}
        </div>
      </div>`;
  }).join('') : '';

  return `
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px;">
      <button class="round-acc-hdr ${currentRoundIdx >= 0 ? 'cur-round' : ''}" onclick="toggleRoundAccordion(${currentRoundIdx})">
        <span style="font-size:1rem;">${isExpanded ? '▼' : '▶'}</span>
        <div style="flex:1;">
          <div class="muted" style="font-size:.68rem;text-transform:uppercase;margin-bottom:1px;">Manche ${currentRoundIdx+1}</div>
          <strong style="font-size:.95rem;">${gs.currentRound.title || 'Manche en cours'}</strong>
        </div>
        <span class="muted" style="font-size:.78rem;">${questions.length} question(s)</span>
      </button>
      ${isExpanded ? `<div class="round-acc-body">${questionsSummary}</div>` : ''}
    </div>`;
}

// Sélecteur de quiz (toggle)
function toggleQuizPicker() {
  const wrap = document.getElementById('quiz-picker-wrap');
  if (!wrap) return;
  if (wrap.style.display !== 'none') { wrap.style.display = 'none'; return; }
  wrap.innerHTML = '<div class="card"><p class="muted">Chargement des quiz…</p></div>';
  wrap.style.display = '';

  apiFetch('/api/quizzes').then(d => {
    const quizzes = d.quizzes || [];
    if (!quizzes.length) {
      wrap.innerHTML = '<div class="card"><p class="muted">Aucun quiz disponible. Créez-en un dans l\'admin.</p></div>';
      return;
    }
    wrap.innerHTML = `
      <div class="card" style="border-color:rgba(99,179,237,.25);">
        <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h3 style="margin:0;">📚 Choisir un quiz</h3>
          <button class="btn-secondary" style="font-size:.8rem;padding:5px 10px;" onclick="document.getElementById('quiz-picker-wrap').style.display='none'">✕ Fermer</button>
        </div>
        <div style="display:grid;gap:8px;">
          ${quizzes.map(q => `
            <div class="row" style="background:rgba(255,255,255,.04);padding:10px 14px;border-radius:10px;gap:10px;">
              <div style="flex:1;">
                <strong>${q.title}</strong>
                <span class="muted" style="margin-left:8px;font-size:.82rem;">${q.rounds?.length||0} manche(s)</span>
              </div>
              <button class="btn-primary" style="font-size:.82rem;padding:5px 12px;white-space:nowrap;" onclick="switchSessionQuiz('${q.id}','${(q.title||'').replace(/'/g,"\\'")}')">Charger</button>
            </div>`).join('')}
        </div>
      </div>`;
  }).catch(() => {
    wrap.innerHTML = '<div class="card"><p class="muted">Erreur lors du chargement des quiz</p></div>';
  });
}

async function switchSessionQuiz(quizId, quizTitle) {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  if (!confirm(`Charger "${quizTitle}" ? La partie sera réinitialisée.`)) return;
  try {
    const d = await apiFetch(`/api/sessions/${sc}/quiz`, {
      method: 'PATCH',
      body: JSON.stringify({ quizId, hostKey: hk }),
    });
    if (!d.ok) { alert$('host-alert', d.error || 'Erreur', 'error'); return; }
    alert$('host-alert', `✅ Quiz "${quizTitle}" chargé !`, 'success');
    const wrap = document.getElementById('quiz-picker-wrap');
    if (wrap) wrap.style.display = 'none';
  } catch { alert$('host-alert', 'Erreur réseau', 'error'); }
}

// buildHostActionButtons conservé pour compatibilité (plus utilisé en principal)
function buildHostActionButtons(phase) { return []; }

function setTimerPreset(sec) {
  const inp = document.getElementById('timer-sec');
  if (inp) inp.value = sec;
  $$('.timer-preset-btn').forEach(b => b.classList.remove('active'));
  event?.target?.classList.add('active');
}

function hostAction(action, extra = {}) {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  const gs = state.gameState;

  // Actions spéciales rapidité buzzer
  if (action === 'buzzer_mark_wrong') {
    // Marquer mauvais + passer au joueur suivant immédiatement (géré côté serveur)
    const wrongPseudo = gs?.buzzerState?.firstPseudo || '?';
    state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'buzzer_mark_wrong' }, (res) => {
      if (!res?.ok) { alert$('host-alert', res?.error || 'Erreur', 'error'); return; }
      alert$('host-alert', `<span style="color:#eb3349;font-weight:700;">❌ Mauvaise réponse — ${wrongPseudo}</span>`, 'error');
      setTimeout(() => alert$('host-alert', ''), 2000);
      playSound('wrong');
    });
    return;
  }
  if (action === 'award_buzzer_correct') {
    const buzzerId = gs?.buzzerState?.firstPlayerId;
    const correctPseudo = gs?.buzzerState?.firstPseudo || '?';
    if (!buzzerId) { alert$('host-alert', 'Aucun joueur n\'a buzzé', 'error'); return; }
    // 1. Marquer comme correct (attribue les points + feedback visuel sur display)
    state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'buzzer_mark_correct' }, (res) => {
      if (!res?.ok) { alert$('host-alert', res?.error || 'Erreur', 'error'); return; }
      alert$('host-alert', `<span style="color:#38ef7d;font-weight:700;">✅ Bonne réponse — +1 pt → ${correctPseudo}</span>`, 'success');
      setTimeout(() => alert$('host-alert', ''), 2000);
      playSound('correct');
    });
    return;
  }
  if (action === 'award_buzzer_wrong') {
    // buzzer_mark_wrong marque la mauvaise réponse ET passe au joueur suivant (ou réouvre les buzzers)
    state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'buzzer_mark_wrong' }, (res) => {
      if (!res?.ok) { alert$('host-alert', res?.error || 'Erreur', 'error'); return; }
      playSound('wrong');
    });
    return;
  }

  state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action, ...extra }, (res) => {
    if (!res?.ok) alert$('host-alert', res?.error || 'Action impossible', 'error');
  });
}

function startTimer() {
  const sec = parseInt($('#timer-sec')?.value) || 30;
  hostAction('start_timer', { seconds: sec });
}

function awardPoints(playerId, points) {
  const player = state.players.find(p => (p.playerId || p.id) === playerId);
  const pseudo = player?.pseudo || playerId;
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  if (!sc || !hk) return;
  state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'award_manual_points', playerId, points }, (res) => {
    if (!res?.ok) { alert$('host-alert', res?.error || 'Erreur', 'error'); return; }
    const msg = points > 0
      ? `<span style="color:#38ef7d;font-weight:700;">+${points} pt(s) attribué(s) à ${pseudo}</span>`
      : `<span style="color:#eb3349;font-weight:700;">${points} pt(s) retiré(s) à ${pseudo}</span>`;
    alert$('host-alert', msg, points > 0 ? 'success' : 'error');
    setTimeout(() => alert$('host-alert', ''), 2200);
    playSound(points > 0 ? 'cashRegister' : 'deduct');
  });
}

function awardAll(points) {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  if (!sc || !hk) return;
  state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'award_all', points }, (res) => {
    if (!res?.ok) { alert$('host-alert', res?.error || 'Erreur', 'error'); return; }
    const msg = points > 0
      ? `<span style="color:#38ef7d;font-weight:700;">+${points} pt(s) attribué(s) à tous les joueurs</span>`
      : `<span style="color:#eb3349;font-weight:700;">${points} pt(s) retiré(s) à tous les joueurs</span>`;
    alert$('host-alert', msg, points > 0 ? 'success' : 'error');
    setTimeout(() => alert$('host-alert', ''), 2200);
    playSound(points > 0 ? 'cashRegister' : 'deduct');
  });
}

function awardTeam(teamId, teamName, points) {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  if (!sc || !hk) return;
  state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'award_team', teamId, points }, (res) => {
    if (!res?.ok) { alert$('host-alert', res?.error || 'Erreur', 'error'); return; }
    const msg = points > 0
      ? `<span style="color:#38ef7d;font-weight:700;">+${points} pt(s) attribué(s) à l'équipe ${teamName}</span>`
      : `<span style="color:#eb3349;font-weight:700;">${points} pt(s) retiré(s) à l'équipe ${teamName}</span>`;
    alert$('host-alert', msg, points > 0 ? 'success' : 'error');
    setTimeout(() => alert$('host-alert', ''), 2200);
    playSound(points > 0 ? 'cashRegister' : 'deduct');
  });
}

function submitVideoScore() {
  const input = document.getElementById('video-score-input');
  const val = input ? Number(input.value) : NaN;
  if (!Number.isFinite(val) || val < 0 || val > 10) {
    alert$('host-alert', 'Entrez un score entre 0 et 10', 'error');
    return;
  }
  const vPseudo = state.gameState?.videoState?.selectedPseudo || '?';
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  if (!sc || !hk) return;
  state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'video_set_score', score: val }, (res) => {
    if (!res?.ok) { alert$('host-alert', res?.error || 'Erreur', 'error'); return; }
    alert$('host-alert', `<span style="color:#38ef7d;font-weight:700;">Score ${val}/10 attribué à ${vPseudo}</span>`, 'success');
    setTimeout(() => alert$('host-alert', ''), 2200);
    playSound('correct');
  });
}
window.submitVideoScore = submitVideoScore;

function submitBurgerScore() {
  const input = document.getElementById('burger-score-input');
  const val = input ? Number(input.value) : NaN;
  if (!Number.isFinite(val) || val < 0 || val > 10) {
    alert$('host-alert', 'Entrez un score entre 0 et 10', 'error');
    return;
  }
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  if (!sc || !hk) { alert$('host-alert', 'Session non active', 'error'); return; }
  const bPseudo = state.gameState?.burgerSelectedPseudo || '?';
  state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'burger_set_score', score: val }, (res) => {
    if (!res?.ok) { alert$('host-alert', res?.error || 'Erreur', 'error'); return; }
    alert$('host-alert', `<span style="color:#38ef7d;font-weight:700;">Score ${val}/10 attribué à ${bPseudo}</span>`, 'success');
    setTimeout(() => alert$('host-alert', ''), 2200);
    playSound('correct');
  });
}

function addBot() {
  const name = ($('#bot-name')?.value || '').trim();
  const teamId = $('#bot-team')?.value || null;
  if (!name) { alert$('host-alert', 'Nom du bot requis', 'error'); return; }
  hostAction('add_bot', { pseudo: name, teamId });
  if ($('#bot-name')) $('#bot-name').value = '';
}

function renameTeam(teamId) {
  const newName = ($(`#rename-${teamId}`)?.value || '').trim();
  if (!newName) return;
  hostAction('rename_team', { teamId, newName });
}

function clearPlayers() {
  if (!confirm('Supprimer tous les joueurs ?')) return;
  hostAction('clear_players');
}

// ── Page : DISPLAY ───────────────────────────────────────────
pageInits.display = function() {
  // Priorité : param URL (popup) > localStorage > session host courante
  const urlParams = new URLSearchParams(window.location.search);
  const urlCode = (urlParams.get('display-session') || '').trim().toUpperCase();
  const savedCode = urlCode || localStorage.getItem('quiz_display_code') || state.host.sessionCode || '';
  state.display.connected = false;

  html('page-display', `
    <div class="row" style="justify-content:space-between;margin-bottom:20px;">
      <h1>📺 Écran TV</h1>
      <button class="btn-secondary" onclick="navigate('home')">Accueil</button>
    </div>
    <div id="display-alert"></div>
    <div class="card" id="display-connect-card">
      <h2>Se connecter à une session</h2>
      <div class="row" style="margin-top:12px;gap:12px;">
        <input id="display-code" placeholder="Code de session" value="${savedCode}" style="flex:1;font-size:1.2rem;letter-spacing:4px;text-transform:uppercase;">
        <button class="btn-primary" onclick="connectDisplay()">📺 Afficher</button>
      </div>
    </div>
    <div id="display-content"></div>
  `);

  // Auto-connexion si code fourni (via popup URL ou localStorage)
  if (savedCode) {
    setTimeout(() => {
      const inp = $('#display-code');
      if (inp) inp.value = savedCode;
      connectDisplay();
    }, 300);
  }
};

function connectDisplay() {
  const code = ($('#display-code')?.value || '').trim().toUpperCase();
  if (!code) { alert$('display-alert', 'Code requis', 'error'); return; }

  state.socket.emit('join:display', { sessionCode: code }, (res) => {
    if (!res?.ok) { alert$('display-alert', res?.error || 'Session introuvable', 'error'); return; }
    state.display.sessionCode = code;
    state.display.connected   = true;
    localStorage.setItem('quiz_display_code', code);
    hide('display-connect-card');
    renderDisplay();
  });
}

function renderDisplay() {
  if (!state.display.connected) return;
  const gs   = state.gameState;
  const phase = gs?.status || 'lobby';
  const sc    = state.display.sessionCode;

  // Fond d'écran de la manche courante (utilisé pour les phases non-lobby)
  const roundBg = gs?.currentRound?.backgroundUrl ? resolveMedia(gs.currentRound.backgroundUrl) : '';

  // Fond et musique de la cérémonie de clôture
  const ceremonyBg    = gs?.ceremonyBackgroundUrl ? resolveMedia(gs.ceremonyBackgroundUrl) : '';
  const ceremonyMusic = gs?.ceremonyMusicUrl ? resolveMedia(gs.ceremonyMusicUrl) : '';

  // Musique sélectionnée selon la phase
  const _phaseMusic = (() => {
    const r = gs?.currentRound;
    if (phase === 'lobby') return gs?.quizWelcomeMusicUrl ? resolveMedia(gs.quizWelcomeMusicUrl) : '';
    if (phase === 'end') return ceremonyMusic || '';
    if (phase === 'round_intro') return (r?.introMusicUrl || r?.musicUrl) ? resolveMedia(r.introMusicUrl || r.musicUrl) : '';
    if (['get_ready','question','waiting','manual_scoring','answer_reveal'].includes(phase))
      return (r?.gameMusicUrl || r?.musicUrl) ? resolveMedia(r.gameMusicUrl || r.musicUrl) : '';
    if (['round_end','results'].includes(phase)) return r?.endMusicUrl ? resolveMedia(r.endMusicUrl) : '';
    return '';
  })();

  // Musique gérée en dehors du re-render pour éviter le redémarrage à chaque mise à jour
  updateRoundMusic(_phaseMusic);

  // ── OPTIMISATION LOBBY : mise à jour incrémentale des joueurs ─────────────────
  // Si on est déjà en lobby et que l'écran lobby est déjà affiché, on ne
  // re-rend PAS toute la page (ce qui ferait clignoter les chips joueurs).
  // On patche uniquement la zone joueurs.
  if (phase === 'lobby' && document.querySelector('.lobby-welcome-screen')) {
    const connPlayers = state.players.filter(p => p.connected);
    const labelEl = document.querySelector('.lobby-players-label');
    const listEl  = document.querySelector('.lobby-players-list');
    if (labelEl) labelEl.textContent = `${connPlayers.length} joueur(s) connecté(s)`;
    if (listEl) {
      // Ajouter uniquement les nouveaux joueurs (ceux pas encore dans le DOM)
      const existingIds = new Set([...listEl.querySelectorAll('.lobby-player-chip')].map(el => el.dataset.pid));
      const newPlayers  = connPlayers.filter(p => !existingIds.has(p.id || p.playerId));
      // Supprimer les chips des joueurs déconnectés
      listEl.querySelectorAll('.lobby-player-chip').forEach(el => {
        if (!connPlayers.find(p => (p.id || p.playerId) === el.dataset.pid)) el.remove();
      });
      // Ajouter les nouveaux
      newPlayers.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'lobby-player-chip';
        chip.dataset.pid = p.id || p.playerId;
        chip.innerHTML = `<span class="lobby-player-avatar">${p.avatar || '🎮'}</span><span class="lobby-player-name">${p.pseudo || '?'}</span>`;
        listEl.appendChild(chip);
      });
      if (connPlayers.length === 0) {
        listEl.innerHTML = '<span class="lobby-waiting-text">En attente de joueurs…</span>';
      }
    }
    return; // Ne pas re-rendre le reste
  }

  // Background : cérémonie en priorité si phase 'end'
  const activeBg = (phase === 'end' && ceremonyBg) ? ceremonyBg : roundBg;
  const bgStyle = activeBg
    ? `background-image:url('${activeBg}');background-size:cover;background-position:center;background-repeat:no-repeat;`
    : '';
  const bgOverlay = activeBg
    ? `<div class="display-bg-overlay"></div>`
    : '';

  let content = `
    <div class="session-banner">
      <span>Session : <strong class="session-code">${sc}</strong></span>
      <span>${state.players.length} joueur(s)</span>
    </div>
    <div class="display-stage" style="${bgStyle}">
    ${bgOverlay}`;

  const isPaused = gs?.phaseMeta?.paused === true;

  if (isPaused) {
    content += `
      <div class="pause-screen" style="padding:80px 20px;">
        <div class="pause-icon">⏸️</div>
        <h1>Pause</h1>
        <p class="muted" style="font-size:1.1rem;margin-top:10px;">Le maître de jeu a mis la partie en pause</p>
        <div class="waiting-dots"><span></span><span></span><span></span></div>
      </div>`;
  } else if (phase === 'lobby') {
    const welcomeImg = gs?.quizWelcomeImageUrl ? resolveMedia(gs.quizWelcomeImageUrl) : '';
    const connPlayers = state.players.filter(p => p.connected);
    const playerAvatars = connPlayers.map(p => `
      <div class="lobby-player-chip">
        <span class="lobby-player-avatar">${p.avatar || '🎮'}</span>
        <span class="lobby-player-name">${p.pseudo || '?'}</span>
      </div>`).join('');
    content += `
      <div class="lobby-welcome-screen" ${welcomeImg ? `style="background-image:url('${welcomeImg}');background-size:cover;background-position:center;"` : ''}>
        <div class="lobby-welcome-overlay"></div>
        <div class="lobby-welcome-content">
          <div class="lobby-welcome-icon">🎮</div>
          <h1 class="lobby-welcome-title">${gs?.quizTitle || 'Quiz Live'}</h1>
          <div class="lobby-welcome-code">
            <span class="lobby-code-label">Code de session</span>
            <span class="session-code lobby-code-value">${sc}</span>
          </div>
        </div>
        <div class="lobby-players-zone">
          <div class="lobby-players-label">${connPlayers.length} joueur(s) connecté(s)</div>
          <div class="lobby-players-list">${playerAvatars || '<span class="lobby-waiting-text">En attente de joueurs…</span>'}</div>
        </div>
      </div>`;
  } else if (phase === 'round_intro') {
    const round = gs?.currentRound;
    const _rtIcons  = { qcm:'🔘', rapidite:'⚡', speed:'⚡', true_false:'✅', burger:'🍔', vote:'🗳️', video_challenge:'🎬' };
    const _rtLabels = { qcm:'QCM', rapidite:'Rapidité', speed:'Rapidité', true_false:'Vrai / Faux', burger:'Burger', vote:'Vote', video_challenge:'Challenge Vidéo' };
    const _rtIcon  = _rtIcons[round?.type]  || '🎯';
    const _rtLabel = _rtLabels[round?.type] || (round?.type || '');
    const hasBg = !!(round?.backgroundUrl);
    const bgStyle = hasBg ? `background-image:url('${resolveMedia(round.backgroundUrl)}');` : '';
    // Quand il y a un fond d'image, on entoure le texte d'un cartouche lisible
    const innerContent = `
      ${round?.type ? `<div class="display-round-type-badge display-badge-${round.type}">${_rtIcon} ${_rtLabel}</div>` : ''}
      <div class="display-round-intro-icon">${_rtIcon}</div>
      <h1 class="display-round-intro-title">${round?.title || 'Nouvelle manche'}</h1>
      ${round?.shortRules ? `<div class="display-round-intro-rules">${round.shortRules}</div>` : ''}`;
    content += `
      <div class="display-round-intro-screen${hasBg ? ' has-bg' : ''}" style="${bgStyle}">
        ${hasBg
          ? `<div class="ri-cartouche">${innerContent}</div>`
          : innerContent}
      </div>`;
  } else if (phase === 'training_video') {
    const tvUrl = gs?.currentRound?.trainingVideoUrl ? resolveMedia(gs.currentRound.trainingVideoUrl) : null;
    const tvCtrl = gs?.trainingVideoControl;
    content += `
      <div class="card" style="padding:20px;background:#000;border-color:rgba(255,215,0,.3);">
        <div style="font-size:.9rem;color:rgba(255,215,0,.7);text-align:center;margin-bottom:12px;">🏋️ Vidéo d'entraînement — ${gs?.currentRound?.title || ''}</div>
        ${tvUrl ? `<video id="display-training-video"
          src="${tvUrl}"
          data-ctrl-action="${tvCtrl?.action || 'pause'}"
          data-ctrl-at="${tvCtrl?.at || ''}"
          style="width:100%;max-height:70vh;border-radius:12px;background:#000;"
          playsinline></video>` : '<p class="muted" style="text-align:center;padding:40px;">Aucune vidéo configurée</p>'}
      </div>`;
  } else if (phase === 'get_ready') {
    const _grRound = gs?.currentRound;
    const _grIcons = { qcm:'🔘', rapidite:'⚡', speed:'⚡', true_false:'✅', vote:'🗳️' };
    const _grIcon  = _grIcons[_grRound?.type] || '🎯';
    const _grQNum  = (gs?.currentQuestionIndex ?? 0) + 1;
    content += `
      <div class="get-ready-screen">
        <div class="get-ready-content">
          <div class="get-ready-icon">${_grIcon}</div>
          <div class="get-ready-label">Tenez-vous prêts !</div>
          <div class="get-ready-sub">Question ${_grQNum}</div>
          <div class="waiting-dots" style="margin-top:28px;"><span></span><span></span><span></span></div>
        </div>
      </div>`;
  } else if (phase === 'question' || phase === 'waiting') {
    content += renderDisplayQuestion(gs);
  } else if (phase === 'answer_reveal') {
    const revealed = gs?.revealedAnswer;
    const isBuzzerReveal = gs?.phaseMeta?.answerMode === 'buzzer' || (gs?.buzzerState?.firstPseudo && !gs?.phaseMeta?.finalCeremony);
    const isTrueFalseReveal = gs?.phaseMeta?.answerMode === 'true_false';
    const isVoteReveal = gs?.phaseMeta?.answerMode === 'vote_revealed';
    const isVoteRevealing = gs?.phaseMeta?.answerMode === 'vote_revealing';
    const showExpl = !!gs?.phaseMeta?.showTFExplanation;

    if ((isVoteReveal || isVoteRevealing) && gs?.voteState) {
      content += renderDisplayVoteRevealing(gs);
    } else if (isTrueFalseReveal) {
      // ── Révélation Vrai / Faux : deux tuiles visuelles ──────────────
      const correctNorm = (revealed?.correctAnswer || '').trim().toLowerCase();
      const isCorrectVrai = correctNorm === 'vrai';
      const expl = revealed?.explanation || '';
      // Comptage des votes
      const answers = revealed?.answers || [];
      const nVrai = answers.filter(a => (a.answer||'').toLowerCase() === 'vrai').length;
      const nFaux = answers.filter(a => (a.answer||'').toLowerCase() === 'faux').length;
      const nTotal = answers.length;
      const pctVrai = nTotal > 0 ? Math.round(nVrai / nTotal * 100) : 0;
      const pctFaux = nTotal > 0 ? Math.round(nFaux / nTotal * 100) : 0;

      content += `
        <div class="tf-reveal-screen">
          <div class="tf-reveal-tiles">
            <!-- Tuile VRAI -->
            <div class="tf-reveal-tile tf-tile-vrai ${isCorrectVrai ? 'tf-tile-correct' : 'tf-tile-wrong'}">
              <div class="tf-tile-icon">${isCorrectVrai ? '✅' : '✗'}</div>
              <div class="tf-tile-label">VRAI</div>
              <div class="tf-tile-votes">${nVrai} joueur${nVrai>1?'s':''} · ${pctVrai}%</div>
              <div class="tf-tile-bar"><div style="width:${pctVrai}%;height:100%;background:rgba(255,255,255,0.5);border-radius:4px;transition:width 0.8s;"></div></div>
            </div>
            <!-- Tuile FAUX -->
            <div class="tf-reveal-tile tf-tile-faux ${!isCorrectVrai ? 'tf-tile-correct' : 'tf-tile-wrong'}">
              <div class="tf-tile-icon">${!isCorrectVrai ? '✅' : '✗'}</div>
              <div class="tf-tile-label">FAUX</div>
              <div class="tf-tile-votes">${nFaux} joueur${nFaux>1?'s':''} · ${pctFaux}%</div>
              <div class="tf-tile-bar"><div style="width:${pctFaux}%;height:100%;background:rgba(255,255,255,0.5);border-radius:4px;transition:width 0.8s;"></div></div>
            </div>
          </div>
          ${showExpl && expl ? `
            <div class="tf-reveal-explanation" style="animation:tf-expl-in 0.5s cubic-bezier(0.34,1.4,0.64,1) both;">
              <div class="tf-expl-icon">💡</div>
              <p class="tf-expl-text">${expl}</p>
            </div>` : ''}
          ${renderRevealMedia(revealed, 'tv')}
        </div>
        ${renderAnswerList(answers, true)}`;
    } else if (isBuzzerReveal) {
      // Pour le buzzer : on affiche la réponse mais PAS les scores
      content += `
        <div class="card" style="text-align:center;padding:40px;">
          <h2>📋 Bonne réponse</h2>
          <div style="font-size:2.5rem;font-weight:700;color:#38ef7d;margin:20px 0;">${formatTrueFalseAnswer(revealed?.correctAnswer)}</div>
          ${renderRevealMedia(revealed, 'tv')}
        </div>
        ${renderAnswerList(revealed?.answers || [], false)}`;
    } else {
      // Mode standard : afficher la réponse + les scores
      content += `
        <div class="card" style="text-align:center;padding:40px;">
          <h2>📋 Bonne réponse</h2>
          <div style="font-size:2.5rem;font-weight:700;color:#38ef7d;margin:20px 0;">${revealed?.correctAnswer ?? '—'}</div>
          ${renderRevealMedia(revealed, 'tv')}
        </div>
        ${renderAnswerList(revealed?.answers || [], false)}`;
    }
  } else if (phase === 'round_end') {
    const round = gs?.currentRound;
    content += `
      <div class="display-round-end-screen">
        <div class="display-round-end-frame">
          <div class="display-round-end-icon">🏁</div>
          <h1 class="display-round-end-title">Manche terminée !</h1>
          ${round?.title ? `<p class="display-round-end-subtitle">${round.title}</p>` : ''}
        </div>
        <div class="waiting-dots" style="margin-top:36px;"><span></span><span></span><span></span></div>
      </div>`;
  } else if (phase === 'results') {
    content += renderScoreboard(state.leaderboardPlayers, '📊 Classement de la manche');
    if (state.leaderboardTeams.length) {
      content += renderScoreboard(state.leaderboardTeams, '⚽ Équipes', true);
    }
  } else if (phase === 'end') {
    content += renderFinalCeremony(gs, state.leaderboardPlayers, state.leaderboardTeams);
  } else if (phase === 'manual_scoring') {
    const isVideoManual  = gs?.currentRound?.type === 'video_challenge' || gs?.currentQuestion?.type === 'video_challenge';
    const isBurgerManual = !isVideoManual && (gs?.currentRound?.type === 'burger' || gs?.currentQuestion?.type === 'burger');
    if (isVideoManual) {
      content += renderDisplayVideoChallenge(gs);
    } else if (isBurgerManual) {
      const bfScore = gs?.burgerFinalScore;
      const bPseudo = gs?.burgerSelectedPseudo || '?';
      const bIsTeam = !!(gs?.burgerSelectedTeamId);
      content += bfScore ? `
        <div class="card" style="text-align:center;padding:60px 20px;background:rgba(247,151,30,.1);border-color:rgba(247,151,30,.5);">
          <div style="font-size:4rem;margin-bottom:16px;">🍔</div>
          <div style="font-size:.9rem;color:rgba(255,255,255,.45);margin-bottom:6px;">${bfScore.teamId ? '⚽ Équipe' : '🎮 Joueur'}</div>
          <h2 style="color:#f7971e;font-size:2.2rem;">${bfScore.pseudo}</h2>
          <div style="font-size:7rem;font-weight:900;color:#f7971e;line-height:1;margin:16px 0;">${bfScore.score}<span style="font-size:2.5rem;color:rgba(255,255,255,.4);">/10</span></div>
          ${bfScore.teamId ? `<p class="muted" style="font-size:.9rem;">Chaque membre de l'équipe a reçu ${bfScore.score} point(s)</p>` : ''}
        </div>` : `
        <div class="card" style="text-align:center;padding:80px 20px;background:rgba(247,151,30,.07);border-color:rgba(247,151,30,.3);">
          <div style="font-size:4rem;margin-bottom:16px;animation:end-bounce 1s ease-in-out infinite;">🎤</div>
          <div style="font-size:.9rem;color:rgba(255,255,255,.45);margin-bottom:6px;">${bIsTeam ? '⚽ Équipe' : '🎮 Joueur'}</div>
          <h2 style="color:#f7971e;font-size:2.2rem;">${bPseudo}</h2>
          <p style="margin-top:20px;font-size:1.4rem;font-weight:600;">répond !</p>
          <p class="muted" style="margin-top:10px;">Le maître de jeu va attribuer le score.</p>
        </div>`;
    } else {
      const blr = gs?.buzzerLastResult;
      if (blr?.result === 'correct') {
        // Affichage gagnant buzzer sur TV
        const winnerPlayer = state.players.find(p => (p.id || p.playerId) === blr.playerId);
        const winnerAvatar = winnerPlayer?.avatar || '🎮';
        content += `
          <div class="card buzzer-winner-display" style="text-align:center;padding:60px 20px;
            background:radial-gradient(ellipse at 50% 40%,rgba(56,239,125,.18) 0%,rgba(8,6,24,.9) 70%);
            border:2px solid rgba(56,239,125,.6);animation:buzzer-winner-pop 0.5s cubic-bezier(0.34,1.4,0.64,1) both;">
            <div style="font-size:5rem;margin-bottom:10px;animation:end-bounce 0.8s ease-in-out infinite;">${winnerAvatar}</div>
            <div style="font-size:.9rem;letter-spacing:2px;color:rgba(56,239,125,.7);font-weight:700;text-transform:uppercase;margin-bottom:8px;">✅ Bonne réponse !</div>
            <h1 style="font-size:clamp(2.2rem,7vw,4.5rem);font-weight:900;color:#38ef7d;text-shadow:0 0 30px rgba(56,239,125,.6);margin:0;">${blr.pseudo}</h1>
            <div style="margin-top:24px;font-size:2rem;">🏆</div>
          </div>`;
        // Bruitage joyeux déclenché une seule fois par victoire
        const winnerId = blr.playerId + '_' + (blr.questionId || '');
        if (_lastBuzzerWinnerId !== winnerId) {
          _lastBuzzerWinnerId = winnerId;
          playBuzzerCorrectSound();
        }
      } else {
        content += `
          <div class="card" style="text-align:center;padding:40px;">
            <div style="font-size:3rem;">⚖️</div>
            <h2>Notation en cours…</h2>
            ${gs?.buzzerState?.firstPseudo ? `<p style="margin-top:16px;font-size:1.5rem;">🔔 <strong>${gs.buzzerState.firstPseudo}</strong> a buzzé en premier</p>` : ''}
          </div>`;
      }
    }
  }

  // Message de diffusion hôte
  if (gs?.phaseMeta?.broadcastMessage) {
    const bm = gs.phaseMeta.broadcastMessage;
    content += `
      <div class="card" style="margin-top:14px;border-color:rgba(240,147,251,.4);background:rgba(240,147,251,.07);text-align:center;padding:20px;">
        ${bm.imageUrl ? `<img src="${bm.imageUrl}" style="max-width:100%;max-height:280px;border-radius:12px;margin-bottom:12px;object-fit:contain;">` : ''}
        ${bm.text ? `<p style="font-size:1.1rem;font-weight:600;">${bm.text}</p>` : ''}
      </div>`;
  }

  content += '</div>';

  // ── Sauvegarder la position des vidéos avant de remplacer le DOM ─────────────
  // Évite que pause/rewind ne remettent la vidéo au début (le html() recrée l'élément
  // à currentTime=0 ; on restaure ensuite la position avant d'appliquer le contrôle).
  const _savedVidTimes = {};
  ['display-challenge-video', 'display-challenge-training-video', 'display-training-video'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.readyState >= 1 && el.src) {
      _savedVidTimes[id] = { currentTime: el.currentTime, src: el.src };
    }
  });

  html('display-content', content);

  // Animer la question card uniquement quand la question change (évite le blink au tick timer)
  applyQuestionCardAnimation();

  // Animer le compteur de réponses + son de cloche quand une nouvelle réponse arrive
  const _currentQ = gs?.currentQuestion;
  const _answered = _currentQ?.id ? Object.keys(gs?.answers?.[_currentQ.id] || {}).length : 0;
  applyAnswerCountAnimation(_answered);

  // Restaurer les positions AVANT d'appliquer le contrôle (pause au bon endroit)
  // Exception : si l'action est 'rewind', ne pas restaurer (sinon la restauration écrase le retour à 0)
  Object.entries(_savedVidTimes).forEach(([id, saved]) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Si la nouvelle commande est un rewind, skip : on laisse _applyVidCtrl mettre currentTime=0
    if (el.dataset.ctrlAction === 'rewind') return;
    const sameFile = el.src && (el.src === saved.src ||
      decodeURIComponent(el.src).split('/').pop() === decodeURIComponent(saved.src).split('/').pop());
    if (!sameFile) return;
    const restore = () => { el.currentTime = saved.currentTime; };
    if (el.readyState >= 1) restore();
    else el.addEventListener('loadedmetadata', restore, { once: true });
  });

  applyDisplayVideoControl(gs);
}

// ── Animation question card uniquement au changement de question ──────────────
function applyQuestionCardAnimation() {
  const card = document.querySelector('.display-question-card');
  if (!card) { _displayQuestionId = null; return; }
  const qid = card.dataset.qid || '';
  if (qid !== _displayQuestionId) {
    _displayQuestionId = qid;
    _displayAnswerCount = -1; // réinitialiser le compteur pour la nouvelle question
    card.classList.remove('qc-animate');
    // forcer reflow pour que l'animation reparte
    void card.offsetWidth;
    card.classList.add('qc-animate');
    card.addEventListener('animationend', () => card.classList.remove('qc-animate'), { once: true });
  }
}

// ── Animation compteur réponses TV + son cloche ────────────────────────────────
function applyAnswerCountAnimation(answered) {
  if (answered == null || answered < 0) return;
  if (answered > _displayAnswerCount && _displayAnswerCount >= 0) {
    // Nouvelle réponse reçue : animer le compteur et jouer un son de cloche
    playBellSound();
    const el = document.getElementById('tv-answer-count');
    if (el) {
      el.classList.remove('tv-answer-bump');
      void el.offsetWidth; // reflow
      el.classList.add('tv-answer-bump');
      el.addEventListener('animationend', () => el.classList.remove('tv-answer-bump'), { once: true });
    }
  }
  _displayAnswerCount = answered;
}

function playBellSound() {
  try {
    const a = new Audio('/sounds/bell.mp3');
    a.volume = 0.70;
    a.play().catch(() => {});
  } catch { /* noop */ }
}

// ── Bip du compte à rebours (son chaleureux, pas aigu) ───────────────────────
function playCountdownBeep(isLast) {
  // Non utilisé activement — fichier countdown.mp3 disponible si besoin
  try {
    const a = new Audio('/sounds/countdown.mp3');
    a.volume = 0.60;
    a.play().catch(() => {});
  } catch { /* noop */ }
}

// ── Contrôle effectif de la vidéo TV après rendu du DOM ──────────────────────
// Les <script> dans innerHTML ne s'exécutent pas → on applique le contrôle ici.
// IMPORTANT : on stocke le suivi sur l'élément lui-même (_lastAppliedAt) et NON
// dans une variable globale. Ainsi, chaque fois que html() recrée l'élément,
// il repart à zéro et la commande en cours (play, pause, rewind) est ré-appliquée.
function _applyVidCtrl(vid, action, at) {
  if (!vid) return;
  if (vid._lastAppliedAt !== at) {
    vid._lastAppliedAt = at;
    if (action === 'play') {
      // Si autoplay bloqué par le navigateur (pas de gesture), on retente en muet
      vid.play().catch(() => {
        vid.muted = true;
        vid.play().catch(() => {});
      });
    } else if (action === 'pause') {
      vid.pause();
    } else if (action === 'rewind') {
      vid.currentTime = 0; vid.pause();
    }
  }
}
function applyDisplayVideoControl(gs) {
  // Tous les éléments vidéo controlés portent leurs data-attrs : on les applique uniformément
  let anyVideoPlaying = false;
  ['display-challenge-video', 'display-challenge-training-video', 'display-training-video'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      _applyVidCtrl(el, el.dataset.ctrlAction || 'pause', el.dataset.ctrlAt || '');
      if (el.dataset.ctrlAction === 'play') anyVideoPlaying = true;
    }
  });
  // Couper la musique de fond quand une vidéo est en lecture, la reprendre sinon
  const bgMusic = document.getElementById('bg-round-music');
  if (bgMusic) {
    if (anyVideoPlaying && !bgMusic.paused) {
      bgMusic._pausedByVideo = true;
      bgMusic.pause();
    } else if (!anyVideoPlaying && bgMusic._pausedByVideo && !_musicMuted) {
      bgMusic._pausedByVideo = false;
      bgMusic.play().catch(() => {});
    }
  }
}

function renderDisplayQuestion(gs) {
  const q  = gs?.currentQuestion;
  const pm = gs?.phaseMeta || {};

  if (!q) return `<div class="card" style="text-align:center;padding:40px;"><p class="muted">En attente…</p></div>`;

  let media = '';
  if (q.mediaUrl) {
    const url = resolveMedia(q.mediaUrl);
    if (/\.(mp3|wav|ogg)$/i.test(url)) media = `<div class="media-block"><audio controls autoplay src="${url}"></audio></div>`;
    else if (/\.(mp4|webm|mov)$/i.test(url)) media = `<div class="media-block"><video controls autoplay src="${url}" style="max-height:50vh;"></video></div>`;
    else media = `<div class="media-block"><img src="${url}" alt="media"></div>`;
  }

  let timerHtml = '';
  if (pm.timer?.remainingSec != null) {
    const pct = pm.timer.totalSec > 0 ? Math.max(0, pm.timer.remainingSec/pm.timer.totalSec*100) : 0;
    timerHtml = `
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <strong>⏱️ Temps</strong>
          <strong style="font-size:1.8rem;color:#ff9a56;">${pm.timer.remainingSec}s</strong>
        </div>
        <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  // Votes vrai/faux
  let votes = '';
  if (pm.answerMode === 'true_false') {
    const yes  = pm.trueFalseVotes?.yes?.length ?? gs.trueFalseVotes?.yes?.length ?? 0;
    const no   = pm.trueFalseVotes?.no?.length  ?? gs.trueFalseVotes?.no?.length  ?? 0;
    const tot  = yes + no;
    votes = `
      <div class="card">
        <div class="grid2" style="text-align:center;">
          <div>
            <div style="font-size:2rem;color:#38ef7d;">✅ VRAI</div>
            <div style="font-size:3rem;font-weight:700;">${yes}</div>
            <div class="progress-bar" style="margin-top:8px;"><div class="fill" style="background:linear-gradient(90deg,#00c851,#38ef7d);width:${tot>0?Math.round(yes/tot*100):0}%"></div></div>
          </div>
          <div>
            <div style="font-size:2rem;color:#eb3349;">❌ FAUX</div>
            <div style="font-size:3rem;font-weight:700;">${no}</div>
            <div class="progress-bar" style="margin-top:8px;"><div class="fill" style="background:linear-gradient(90deg,#eb3349,#ff6b7a);width:${tot>0?Math.round(no/tot*100):0}%"></div></div>
          </div>
        </div>
      </div>`;
  }

  // Options QCM (avec support médias par option)
  let opts = '';
  if (pm.answerMode === 'mcq' && Array.isArray(q.options) && q.options.length) {
    const labelColors = ['#4ade80','#60a5fa','#f59e0b','#f87171'];
    const labels = ['A','B','C','D'];
    opts = `<div class="answer-grid" style="grid-template-columns:1fr 1fr;">${q.options.slice(0,4).map((o, i) => {
      const label = typeof o === 'object' ? (o.text || '') : String(o || '');
      const optMedia = typeof o === 'object' && o.mediaUrl ? resolveMedia(o.mediaUrl) : '';
      const isImg = optMedia && /\.(jpg|jpeg|png|gif|webp)$/i.test(optMedia);
      const isAudio = optMedia && /\.(mp3|wav|ogg)$/i.test(optMedia);
      const mediaEl = isImg ? `<img src="${optMedia}" style="max-height:70px;border-radius:6px;margin-bottom:6px;">` :
                      isAudio ? `<audio controls src="${optMedia}" style="height:28px;margin-bottom:6px;"></audio>` : '';
      return `<div class="answer-btn" style="border-color:${labelColors[i]};flex-direction:column;padding:14px;">
        ${mediaEl}<span style="color:${labelColors[i]};font-weight:700;margin-bottom:6px;">${labels[i]}.</span><span style="margin-left:4px;">${label}</span>
      </div>`;
    }).join('')}</div>`;
  }

  // Buzzer rapidité — avec feedback visuel correct/mauvais
  let buzzerDisplay = '';
  if (pm.answerMode === 'buzzer') {
    const bz = gs.buzzerState;
    const blr = gs.buzzerLastResult;
    if (bz?.firstPseudo) {
      // Trouver l'avatar du joueur
      const buzzerPlayer = state.players.find(p => (p.id || p.playerId) === bz.firstPlayerId);
      const buzzerAvatar = buzzerPlayer?.avatar || '🎮';

      let resultOverlay = '';
      if (blr && blr.playerId === bz.firstPlayerId) {
        if (blr.result === 'correct') {
          resultOverlay = `<div class="buzzer-result-badge buzzer-correct-badge">✅ BONNE RÉPONSE !</div>`;
        } else if (blr.result === 'wrong') {
          resultOverlay = `<div class="buzzer-result-badge buzzer-wrong-badge">❌ MAUVAISE RÉPONSE</div>`;
        }
      }

      buzzerDisplay = `
        <div class="buzzer-player-display ${blr?.playerId === bz.firstPlayerId && blr?.result === 'correct' ? 'buzzer-correct' : blr?.playerId === bz.firstPlayerId && blr?.result === 'wrong' ? 'buzzer-wrong' : ''}">
          <div class="buzzer-player-avatar">${buzzerAvatar}</div>
          <div class="buzzer-player-pseudo">${bz.firstPseudo}</div>
          <div style="font-size:.85rem;color:rgba(255,255,255,.5);">🔔 a buzzé en premier</div>
          ${resultOverlay}
        </div>`;
    } else if (!bz?.firstPseudo) {
      // Buzzer actif mais personne n'a encore buzzé
      buzzerDisplay = `
        <div class="card" style="text-align:center;padding:24px;border:2px solid rgba(255,165,0,.3);">
          <div style="font-size:2.5rem;margin-bottom:8px;">🔔</div>
          <p style="color:#ffa500;font-weight:600;">Buzzers actifs — prêts à répondre !</p>
        </div>`;
    }
  }

  // Burger : afficher l'item courant (ou message d'attente / grand "?")
  let burgerDisplay = '';
  const isBurgerQ = q.type === 'burger' || gs?.currentRound?.type === 'burger';
  if (isBurgerQ) {
    const bs = gs.burgerState;
    const items = q.items || [];
    const selectedPseudo = gs?.burgerSelectedPseudo || null;
    const burgerFinalScore = gs?.burgerFinalScore;

    if (burgerFinalScore) {
      // Score validé — afficher le résultat
      burgerDisplay = `
        <div class="card" style="text-align:center;padding:50px 20px;background:rgba(247,151,30,.1);border-color:rgba(247,151,30,.5);">
          <div style="font-size:4rem;margin-bottom:16px;">🍔</div>
          <h2 style="color:#f7971e;">${burgerFinalScore.pseudo}</h2>
          <div style="font-size:5rem;font-weight:900;color:#f7971e;margin:16px 0;">${burgerFinalScore.score}<span style="font-size:2rem;color:rgba(255,255,255,.4);">/10</span></div>
          <p class="muted">Score attribué par le maître de jeu</p>
        </div>`;
    } else if (!bs || bs.currentItemIndex < 0) {
      // Pas encore commencé — message "Prêts ?"
      burgerDisplay = `
        <div class="card" style="text-align:center;padding:60px 20px;background:rgba(247,151,30,.07);border-color:rgba(247,151,30,.3);">
          <div style="font-size:5rem;margin-bottom:20px;">🍔</div>
          <h2 style="font-size:2rem;">Épreuve Burger</h2>
          ${selectedPseudo ? `<p style="font-size:1.3rem;margin-top:12px;"><strong style="color:#f7971e;">${selectedPseudo}</strong> passe l'épreuve</p>` : '<p class="muted" style="margin-top:12px;">En attente de la sélection du joueur…</p>'}
          <p class="muted" style="margin-top:16px;font-size:1rem;">Le maître de jeu va dévoiler les éléments un par un.</p>
          <div class="waiting-dots" style="margin-top:20px;"><span></span><span></span><span></span></div>
        </div>`;
    } else {
      const curItem = items[bs.currentItemIndex];
      const itemUrl = curItem?.mediaUrl ? resolveMedia(curItem.mediaUrl) : '';
      const isImg = itemUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(itemUrl);
      const isAudio = itemUrl && /\.(mp3|wav|ogg)$/i.test(itemUrl);
      burgerDisplay = `
        <div class="card" style="text-align:center;padding:30px;background:rgba(247,151,30,.07);border-color:rgba(247,151,30,.3);">
          <div style="font-size:.85rem;color:rgba(255,255,255,.4);margin-bottom:14px;letter-spacing:1px;">🍔 ÉLÉMENT ${bs.currentItemIndex+1} / ${items.length}</div>
          ${isImg ? `<img src="${itemUrl}" style="max-height:220px;border-radius:12px;margin-bottom:16px;">` : ''}
          ${isAudio ? `<audio controls autoplay src="${itemUrl}" style="margin-bottom:14px;"></audio>` : ''}
          ${curItem ? `<p style="font-size:clamp(1.6rem,5vw,2.4rem);font-weight:700;line-height:1.2;">${curItem.text || ''}</p>` : ''}
          <div style="margin-top:16px;display:flex;justify-content:center;gap:6px;">
            ${items.map((_, i) => `<span style="width:10px;height:10px;border-radius:50%;background:${i <= bs.currentItemIndex ? '#f7971e' : 'rgba(255,255,255,.2)'}; display:inline-block;"></span>`).join('')}
          </div>
        </div>`;
    }
  }

  // Vote : affichage selon la phase
  let voteDisplay = '';
  if (pm.answerMode === 'vote_input') {
    const answered = gs.answers?.[q.id] ? Object.keys(gs.answers[q.id]).length : 0;
    const connected = state.players.filter(p => p.connected).length;
    voteDisplay = `
      <div class="card" style="text-align:center;padding:30px;">
        <div style="font-size:2.5rem;margin-bottom:12px;">✍️</div>
        <h2>Répondez maintenant !</h2>
        <p class="muted" style="margin-top:10px;font-size:1rem;">${answered}/${connected} réponse(s) reçue(s)</p>
        <div class="progress-bar" style="margin-top:12px;"><div class="fill" style="width:${connected > 0 ? Math.round(answered/connected*100) : 0}%"></div></div>
      </div>`;
  } else if (pm.answerMode === 'vote_proposal_reveal') {
    // Phase intermédiaire : révélation des propositions avant le vote
    const prs = gs?.proposalRevealState;
    const cursor = prs?.revealCursor || 0;
    const total  = prs?.proposals?.length || 0;
    const current = total > 0 && cursor > 0 ? prs.proposals[cursor - 1] : null;

    // Afficher le média de la question (image/vidéo/audio)
    const qUrl = q?.mediaUrl ? resolveMedia(q.mediaUrl) : '';
    const qIsImg   = qUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(qUrl);
    const qIsVid   = qUrl && /\.(mp4|webm|mov)$/i.test(qUrl);
    const qIsAudio = qUrl && /\.(mp3|wav|ogg)$/i.test(qUrl);
    const qMedia   = qIsImg ? `<img src="${qUrl}" style="max-height:200px;border-radius:12px;margin-bottom:16px;">` :
                     qIsVid ? `<video src="${qUrl}" controls style="max-height:200px;border-radius:12px;margin-bottom:16px;"></video>` :
                     qIsAudio ? `<audio controls src="${qUrl}" style="margin-bottom:14px;"></audio>` : '';

    voteDisplay = `
      <div class="card" style="padding:30px 24px;background:rgba(167,139,250,.07);border-color:rgba(167,139,250,.3);">
        <div style="font-size:.85rem;color:rgba(167,139,250,.7);text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px;">🗳️ PROPOSITION ${cursor > 0 ? cursor : '—'} / ${total}</div>
        <div class="display-question-text" style="margin-bottom:${qMedia?'14px':'0'};font-size:clamp(1.4rem,4vw,2rem);">${q.content || ''}</div>
        ${qMedia}
        ${current ? `
          <div style="margin-top:20px;padding:20px 24px;border-radius:14px;background:rgba(255,255,255,.06);border:2px solid rgba(167,139,250,.4);">
            <div style="font-size:.8rem;color:rgba(167,139,250,.6);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">Proposition</div>
            <div style="font-size:clamp(1.4rem,5vw,2.2rem);font-weight:800;line-height:1.25;">"${current.answer}"</div>
          </div>` : `
          <div style="margin-top:20px;text-align:center;padding:24px;border-radius:14px;background:rgba(255,255,255,.03);">
            <div class="waiting-dots"><span></span><span></span><span></span></div>
            <p class="muted" style="margin-top:12px;">Le maître de jeu va révéler les propositions…</p>
          </div>`}
      </div>`;
  } else if (pm.answerMode === 'vote_voting') {
    voteDisplay = renderDisplayVoteVoting(gs);
  }

  // Challenge Vidéo : affichage selon la phase (y compris les nouvelles phases training)
  const _videoModes = ['video_select','video_training_ready','video_training_playing','video_ready','video_playing','video_eval','video_scored'];
  let videoDisplay = '';
  if (_videoModes.includes(pm.answerMode)) {
    videoDisplay = renderDisplayVideoChallenge(gs);
  }

  // Compteur de réponses (pas pour burger/buzzer/vote/vidéo)
  const answered = gs.answers?.[q.id] ? Object.keys(gs.answers[q.id]).length : 0;
  const connected = state.players.filter(p => p.connected).length;
  const noCounterModes = ['buzzer','vote_input','vote_voting','vote_proposal_reveal',..._videoModes];
  const showCounter = !noCounterModes.includes(pm.answerMode) && q.type !== 'burger' && q.type !== 'rapidite' && q.type !== 'video_challenge';

  if (_videoModes.includes(pm.answerMode)) {
    return videoDisplay;
  }

  return `
    ${timerHtml}
    <div class="display-question-card" data-qid="${q.id || ''}">
      <div class="display-question-text">${q.content || ''}</div>
      ${pm.answerMode !== 'vote_proposal_reveal' ? media : ''}
      ${showCounter ? `<p id="tv-answer-count" class="muted" style="margin-top:8px;font-size:.9rem;">${answered}/${connected} réponse(s)</p>` : ''}
    </div>
    ${opts}
    ${votes}
    ${buzzerDisplay}
    ${burgerDisplay}
    ${voteDisplay}`;
}

// ── Display : challenge vidéo ──────────────────────────────
function renderDisplayVideoChallenge(gs) {
  const vs = gs?.videoState;
  const phase = vs?.phase || 'select';
  const pseudo = vs?.selectedPseudo || '?';
  const q = gs?.currentQuestion;
  const videoUrl = q?.mediaUrl ? resolveMedia(q.mediaUrl) : null;
  const trainingVideoUrl = q?.trainingVideoUrl ? resolveMedia(q.trainingVideoUrl) : null;

  if (phase === 'select') {
    return `
      <div class="card" style="text-align:center;padding:60px 20px;background:rgba(255,215,0,.05);border-color:rgba(255,215,0,.2);">
        <div style="font-size:5rem;margin-bottom:20px;">🎬</div>
        <h2 style="color:#ffd700;font-size:2rem;">Challenge Vidéo</h2>
        <p class="muted" style="margin-top:16px;font-size:1.1rem;">Le maître de jeu choisit un participant…</p>
        <div class="waiting-dots" style="margin-top:20px;"><span></span><span></span><span></span></div>
      </div>`;
  }

  if (phase === 'training_ready') {
    return `
      <div class="card" style="text-align:center;padding:60px 20px;background:rgba(255,215,0,.07);border-color:rgba(255,215,0,.3);">
        <div style="font-size:5rem;margin-bottom:20px;animation:pulse-pause 1.5s ease-in-out infinite;">🏋️</div>
        <h2 style="color:#ffd700;font-size:clamp(1.8rem,6vw,3rem);">${pseudo}</h2>
        <div style="font-size:clamp(1.8rem,6vw,3.2rem);font-weight:900;color:#ffd700;margin:20px 0;letter-spacing:.02em;">ATTENTION</div>
        <div style="font-size:clamp(1.2rem,4vw,2rem);font-weight:700;color:#fff;letter-spacing:.05em;">ENTRAÎNEMENT</div>
        <div class="waiting-dots" style="margin-top:20px;"><span></span><span></span><span></span></div>
      </div>`;
  }

  if (phase === 'training_playing') {
    const tCtrl = vs?.trainingVideoControl;
    return `
      <div class="card" style="padding:20px;background:#000;border-color:rgba(255,215,0,.3);">
        <div style="font-size:.85rem;color:rgba(255,215,0,.7);text-align:center;margin-bottom:12px;">🏋️ Entraînement — ${pseudo} — ${q?.content || ''}</div>
        ${trainingVideoUrl ? `
          <video id="display-challenge-training-video"
            src="${trainingVideoUrl}"
            data-ctrl-action="${tCtrl?.action || 'pause'}"
            data-ctrl-at="${tCtrl?.at || ''}"
            style="width:100%;max-height:60vh;border-radius:12px;background:#000;"
            playsinline></video>` : '<p class="muted" style="text-align:center;padding:40px;">Aucune vidéo d\'entraînement configurée</p>'}
      </div>`;
  }

  if (phase === 'ready') {
    return `
      <div class="card" style="text-align:center;padding:60px 20px;background:rgba(255,215,0,.07);border-color:rgba(255,215,0,.3);">
        <div style="font-size:5rem;margin-bottom:20px;animation:pulse-pause 1.5s ease-in-out infinite;">🎬</div>
        <h2 style="color:#ffd700;font-size:clamp(1.8rem,6vw,3rem);">${pseudo}</h2>
        <div style="font-size:clamp(2rem,8vw,4rem);font-weight:900;color:#fff;margin:20px 0;letter-spacing:.02em;">TENEZ-VOUS PRÊT !</div>
        <div class="waiting-dots" style="margin-top:16px;"><span></span><span></span><span></span></div>
      </div>`;
  }

  if (phase === 'playing' || phase === 'eval') {
    const ctrl = vs?.videoControl;
    // Note: le contrôle effectif de la vidéo est appliqué dans applyDisplayVideoControl()
    // appelée après chaque rendu — les scripts inline dans innerHTML ne s'exécutent pas.
    return `
      <div class="card" style="padding:20px;background:#000;border-color:rgba(255,215,0,.2);">
        <div style="font-size:.85rem;color:rgba(255,215,0,.6);text-align:center;margin-bottom:12px;">🎬 ${pseudo} — ${q?.content || ''}</div>
        ${videoUrl ? `
          <video id="display-challenge-video"
            src="${videoUrl}"
            data-ctrl-action="${ctrl?.action || 'pause'}"
            data-ctrl-at="${ctrl?.at || ''}"
            style="width:100%;max-height:55vh;border-radius:12px;background:#000;"
            playsinline></video>` : '<p class="muted" style="text-align:center;padding:40px;">Aucune vidéo configurée pour ce challenge</p>'}
        ${phase === 'eval' ? `<div style="text-align:center;margin-top:14px;padding:14px;background:rgba(255,255,255,.05);border-radius:10px;">
          <p style="font-size:1rem;color:rgba(255,255,255,.6);">Le maître de jeu attribue le score…</p>
          <div class="waiting-dots" style="margin-top:10px;"><span></span><span></span><span></span></div>
        </div>` : ''}
      </div>`;
  }

  if (phase === 'scored') {
    return `
      <div class="card" style="text-align:center;padding:50px 20px;background:rgba(247,151,30,.1);border-color:rgba(247,151,30,.5);">
        <div style="font-size:4rem;margin-bottom:16px;">🎬</div>
        <h2 style="color:#f7971e;font-size:clamp(1.6rem,5vw,2.4rem);">${pseudo}</h2>
        <div style="font-size:clamp(5rem,18vw,9rem);font-weight:900;color:#f7971e;line-height:1;margin:16px 0;">${vs.score}<span style="font-size:2.5rem;color:rgba(255,255,255,.4);">/10</span></div>
        <p class="muted">Score attribué par le maître de jeu</p>
      </div>`;
  }

  return '';
}

// ── Révélation progressive du vote (step-by-step, style burger) ──
function renderDisplayVoteRevealing(gs) {
  const vs = gs?.voteState;
  if (!vs || !vs.options) return '<div class="card" style="text-align:center;padding:40px;"><p class="muted">Révélation…</p></div>';

  const cursor = vs.revealCursor ?? 0;
  const done   = gs?.phaseMeta?.answerMode === 'vote_revealed';
  const total  = vs.options.length;

  // Trier les options : d'abord celles déjà révélées (par ordre d'apparition), puis les cachées
  const rows = vs.options.map((opt, i) => {
    const revealed = i < cursor;
    const votes    = opt.voteCount || 0;
    const isDecoy  = opt.isDecoy;
    const hasVotes = votes > 0;

    if (!revealed) {
      // Option encore cachée
      return `
        <div style="padding:14px 16px;border-radius:12px;background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.1);margin-bottom:8px;opacity:.35;">
          <div style="font-weight:600;font-size:1rem;filter:blur(6px);">████████</div>
        </div>`;
    }

    // Option révélée
    const bgColor     = isDecoy ? 'rgba(235,51,73,.15)' : 'rgba(56,239,125,.1)';
    const borderColor = isDecoy ? 'rgba(235,51,73,.4)'  : 'rgba(56,239,125,.3)';
    const scoreTag    = isDecoy && hasVotes
      ? `<span class="float-score float-score-neg" style="animation-delay:0.1s;">-1</span>`
      : (!isDecoy && hasVotes
        ? `<span class="float-score float-score-pos" style="animation-delay:0.1s;">+1</span>`
        : '');
    const isNew = i === cursor - 1; // la toute dernière révélée

    return `
      <div style="padding:14px 16px;border-radius:12px;background:${bgColor};border:1px solid ${borderColor};
        margin-bottom:8px;position:relative;${isNew ? 'animation:podium-entry .45s ease forwards;' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${done ? '8px' : '0'};">
          <span style="font-weight:600;font-size:1rem;">${opt.text}</span>
          <div style="display:flex;align-items:center;gap:8px;position:relative;">
            ${isDecoy ? '<span style="color:#eb3349;font-size:.75rem;font-weight:700;">🎭 LEURRE</span>' : ''}
            <strong style="font-size:1.3rem;color:${isDecoy?'#eb3349':'#38ef7d'};">${votes} 🗳️</strong>
            ${isNew ? scoreTag : ''}
          </div>
        </div>
        ${done ? `<div class="progress-bar"><div class="fill" style="width:${Math.round((votes / Math.max(...vs.options.map(o=>o.voteCount||0),1)) * 100)}%;background:${isDecoy?'linear-gradient(90deg,#eb3349,#ff6b7a)':'linear-gradient(90deg,#38ef7d,#00b09b)'}"></div></div>` : ''}
      </div>`;
  }).join('');

  const progressLabel = done
    ? '<p class="muted" style="text-align:center;font-size:.85rem;margin-bottom:16px;">✅ Tous les résultats révélés</p>'
    : `<p class="muted" style="text-align:center;font-size:.85rem;margin-bottom:16px;">Révélation en cours… (${cursor}/${total})</p>`;

  return `
    <div class="card" style="padding:30px;">
      <h2 style="text-align:center;margin-bottom:12px;">🗳️ Résultats du vote</h2>
      ${progressLabel}
      ${rows}
    </div>`;
}

// ── Animation floating score déclenchée sur le display ──
function triggerVoteRevealAnimation(gs) {
  const vs = gs?.voteState;
  if (!vs || !vs.options) return;
  const cursor = vs.revealCursor ?? 0;
  if (cursor <= 0) return;
  const justRevealedOpt = vs.options[cursor - 1];
  if (!justRevealedOpt) return;

  const container = document.getElementById('display-content');
  if (!container) return;

  const isDecoy = justRevealedOpt.isDecoy;
  const hasVotes = (justRevealedOpt.voteCount || 0) > 0;
  if (!hasVotes) return; // pas d'animation si aucun vote

  const floater = document.createElement('span');
  floater.textContent = isDecoy ? '-1' : '+1';
  floater.className = `float-score ${isDecoy ? 'float-score-neg' : 'float-score-pos'}`;
  floater.style.cssText = `
    position:fixed;
    right:${20 + Math.random() * 60}px;
    top:${30 + Math.random() * 40}%;
    font-size:3.5rem;
    font-weight:900;
    z-index:9999;
    pointer-events:none;
  `;
  document.body.appendChild(floater);
  floater.addEventListener('animationend', () => floater.remove());
}

// ── Affichage des résultats de vote sur le display ────────────
function renderDisplayVoteResults(gs) {
  const vs = gs?.voteState;
  if (!vs || !vs.options) return '<div class="card" style="text-align:center;padding:40px;"><p class="muted">Résultats du vote…</p></div>';

  const maxVotes = Math.max(...vs.options.map(o => o.voteCount || 0), 1);

  const optionRows = vs.options
    .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
    .map((opt, i) => {
      const votes = opt.voteCount || 0;
      const pct = Math.round((votes / maxVotes) * 100);
      const isDecoy = opt.isDecoy;
      const bgColor = isDecoy ? 'rgba(235,51,73,.15)' : 'rgba(56,239,125,.1)';
      const borderColor = isDecoy ? 'rgba(235,51,73,.4)' : 'rgba(56,239,125,.3)';
      return `
        <div style="padding:14px 16px;border-radius:12px;background:${bgColor};border:1px solid ${borderColor};margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:600;font-size:1rem;">${opt.text}</span>
            <div style="display:flex;align-items:center;gap:8px;">
              ${isDecoy ? '<span style="color:#eb3349;font-size:.75rem;font-weight:700;">🎭 LEURRE</span>' : ''}
              <strong style="font-size:1.3rem;color:${isDecoy?'#eb3349':'#38ef7d'};">${votes} 🗳️</strong>
            </div>
          </div>
          <div class="progress-bar"><div class="fill" style="width:${pct}%;background:${isDecoy?'linear-gradient(90deg,#eb3349,#ff6b7a)':'linear-gradient(90deg,#38ef7d,#00b09b)'}"></div></div>
        </div>`;
    }).join('');

  return `
    <div class="card" style="padding:30px;">
      <h2 style="text-align:center;margin-bottom:20px;">🗳️ Résultats du vote</h2>
      ${optionRows}
    </div>`;
}

// ── Affichage du vote en cours sur le display (pendant vote_voting) ──
function renderDisplayVoteVoting(gs) {
  const vs = gs?.voteState;
  if (!vs) return '';

  const totalPlayers = state.players.filter(p => p.connected).length;
  const totalVotes = Object.keys(vs.votes || {}).length;

  const options = vs.options || [];
  return `
    <div class="card" style="padding:30px;">
      <h2 style="text-align:center;margin-bottom:6px;">🗳️ Votez !</h2>
      <p class="muted" style="text-align:center;margin-bottom:20px;">${totalVotes}/${totalPlayers} votes enregistrés</p>
      <div style="display:grid;gap:10px;">
        ${options.map((opt, i) => `
          <div style="padding:16px 20px;border-radius:12px;background:rgba(255,255,255,.07);
            border:1px solid rgba(255,255,255,.12);font-size:1.1rem;font-weight:600;text-align:center;">
            ${opt.text}
          </div>`).join('')}
      </div>
    </div>`;
}

// ── Bloc de médias de révélation (image / texte / audio) ─────────────────
// context : 'tv' | 'player' | 'host'
function renderRevealMedia(revealed, context) {
  if (!revealed) return '';
  const img   = revealed.revealImage || '';
  const txt   = revealed.revealText  || '';
  const audio = revealed.revealAudio || '';
  if (!img && !txt && !audio) return '';

  const isTV     = context === 'tv';
  const isPlayer = context === 'player';

  const parts = [];

  if (img) parts.push(`
    <div class="reveal-media-image">
      <img src="${resolveMedia(img)}" alt="Image de révélation"
           style="max-width:100%;max-height:${isTV?'380px':'220px'};border-radius:${isTV?'16px':'12px'};object-fit:contain;box-shadow:0 8px 32px rgba(0,0,0,0.55);">
    </div>`);

  if (txt) parts.push(`
    <div class="reveal-media-text">
      <div class="reveal-media-text-icon">💬</div>
      <p class="reveal-media-text-body" style="font-size:${isTV?'clamp(1rem,2vw,1.3rem)':isPlayer?'0.85rem':'0.9rem'};">${txt.replace(/\n/g,'<br>').replace(/</g,'&lt;').replace(/&lt;br>/g,'<br>')}</p>
    </div>`);

  if (audio) parts.push(`
    <div class="reveal-media-audio">
      <div class="reveal-media-audio-icon">🎵</div>
      <audio controls src="${resolveMedia(audio)}" id="reveal-audio-player"
             style="height:${isTV?'40px':'32px'};max-width:${isTV?'400px':'280px'};"></audio>
    </div>`);

  return `<div class="reveal-media-block">${parts.join('')}</div>`;
}

function formatTrueFalseAnswer(answer) {
  if (!answer) return '—';
  const lower = answer.trim().toLowerCase();
  if (lower === 'vrai') return '<span style="color:#22c55e;font-weight:900;text-transform:uppercase;">VRAI</span>';
  if (lower === 'faux') return '<span style="color:#ef4444;font-weight:900;text-transform:uppercase;">FAUX</span>';
  return answer.toUpperCase();
}

function formatAnswerText(answer, isTrueFalse) {
  if (!isTrueFalse) return answer || '';
  return formatTrueFalseAnswer(answer);
}

function renderAnswerList(answers, isTrueFalse = false) {
  if (!answers.length) return '';
  const rows = answers.map(a => `
    <tr><td><strong>${a.pseudo}</strong></td><td>${formatAnswerText(a.answer, isTrueFalse)}</td></tr>`).join('');
  return `
    <div class="card">
      <h3>Réponses des joueurs</h3>
      <table style="margin-top:10px;"><thead><tr><th>Joueur</th><th>Réponse</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

// ── Page : ADMIN ─────────────────────────────────────────────
pageInits.admin = function() {
  loadQuizList();
};

async function loadQuizList() {
  html('page-admin', `
    <div class="row" style="justify-content:space-between;margin-bottom:20px;">
      <h1>⚙️ Admin Quiz</h1>
      <div class="row">
        <button class="btn-primary" onclick="startNewQuiz()">+ Nouveau quiz</button>
        <button class="btn-secondary" onclick="navigate('home')">Accueil</button>
      </div>
    </div>
    <div id="admin-alert"></div>
    <div class="card" id="quiz-list-card">
      <p class="muted">Chargement…</p>
    </div>
  `);

  try {
    const d = await apiFetch('/api/quizzes');
    state.admin.quizzes = d.quizzes || [];
    renderQuizList();
  } catch (e) {
    alert$('admin-alert', 'Impossible de charger les quiz', 'error');
  }
}

function renderQuizList() {
  const qs = state.admin.quizzes;
  if (!qs.length) {
    html('quiz-list-card', '<p class="muted" style="text-align:center;padding:20px;">Aucun quiz. Créez-en un !</p>');
    return;
  }
  html('quiz-list-card', `
    <h2>Mes quiz (${qs.length})</h2>
    <div style="margin-top:14px;display:grid;gap:10px;">
      ${qs.map(q => `
        <div class="row" style="background:rgba(255,255,255,.04);padding:12px 16px;border-radius:10px;gap:12px;">
          <div style="flex:1;">
            <strong>${q.title}</strong>
            <span class="muted" style="margin-left:8px;font-size:.85rem;">${q.rounds?.length||0} manche(s)</span>
          </div>
          <button class="btn-secondary" style="font-size:.85rem;" onclick="editQuiz('${q.id}')">✏️ Éditer</button>
          <button class="btn-success"   style="font-size:.85rem;" onclick="launchQuiz('${q.id}')">▶️ Lancer</button>
          <button class="btn-danger"    style="font-size:.85rem;" onclick="deleteQuiz('${q.id}')">🗑️</button>
        </div>`).join('')}
    </div>`);
}

function startNewQuiz() {
  state.admin.editingQuiz = emptyQuiz();
  renderQuizEditor();
}

async function editQuiz(id) {
  try {
    const d = await apiFetch(`/api/quizzes/${id}`);
    state.admin.editingQuiz = d.quiz;
    renderQuizEditor();
  } catch { alert$('admin-alert', 'Impossible de charger le quiz', 'error'); }
}

async function deleteQuiz(id) {
  if (!confirm('Supprimer ce quiz ?')) return;
  try {
    await apiFetch(`/api/quizzes/${id}`, { method: 'DELETE' });
    await loadQuizList();
  } catch { alert$('admin-alert', 'Erreur suppression', 'error'); }
}

async function launchQuiz(quizId) {
  const quiz = state.admin.quizzes.find(q => q.id === quizId);
  const code = randCode();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'launch-modal';
  modal.innerHTML = `
    <div class="modal">
      <h2>▶️ Lancer le quiz</h2>
      <p class="muted" style="margin-bottom:16px;">📚 <strong>${quiz?.title || 'Quiz'}</strong></p>
      <div style="display:grid;gap:14px;">
        <div class="grid2">
          <div>
            <label>Code de session</label>
            <input id="launch-code" value="${code}" placeholder="ex: 1234"
              style="text-transform:uppercase;letter-spacing:4px;text-align:center;"
              oninput="this.value=this.value.toUpperCase()">
          </div>
          <div>
            <label>Clé host</label>
            <input id="launch-hostkey" value="demo-host" placeholder="demo-host">
          </div>
        </div>
      </div>
      <div id="launch-alert" style="margin-top:12px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px;">
        <div style="background:rgba(56,239,125,.06);border:1px solid rgba(56,239,125,.25);border-radius:16px;padding:16px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:8px;">🎮</div>
          <h3 style="font-size:1rem;margin-bottom:6px;">Partie réelle</h3>
          <p class="muted" style="font-size:.8rem;margin-bottom:12px;">Les joueurs rejoignent avec le code</p>
          <button class="btn-success" style="width:100%;" onclick="doLaunchGame('${quizId}',false)">▶️ Lancer la partie</button>
        </div>
        <div style="background:rgba(245,87,108,.06);border:1px solid rgba(245,87,108,.25);border-radius:16px;padding:16px;text-align:center;">
          <div style="font-size:2rem;margin-bottom:8px;">🧪</div>
          <h3 style="font-size:1rem;margin-bottom:6px;">Mode test</h3>
          <p class="muted" style="font-size:.8rem;margin-bottom:12px;">Simulez avec des bots</p>
          <div style="margin-bottom:8px;">
            <label style="font-size:.78rem;color:rgba(255,255,255,.5);">Bots :</label>
            <input type="number" id="launch-bots" value="3" min="0" max="20" style="width:60px;margin-left:6px;">
          </div>
          <button class="btn-warning" style="width:100%;" onclick="doLaunchGame('${quizId}',true)">🧪 Tester</button>
        </div>
      </div>
      <div style="text-align:right;margin-top:16px;">
        <button class="btn-secondary" onclick="closeModal('launch-modal')">Annuler</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('launch-modal'); });
  document.body.appendChild(modal);
}

async function doLaunchGame(quizId, isTestMode) {
  const code     = ($('#launch-code')?.value    || '').trim().toUpperCase() || randCode();
  const hostKey  = ($('#launch-hostkey')?.value || '').trim() || 'demo-host';
  const botCount = isTestMode ? (parseInt($('#launch-bots')?.value) || 3) : 0;
  if (!code) { alert$('launch-alert', 'Code requis', 'error'); return; }
  try {
    const d = await apiFetch('/api/sessions/from-quiz', {
      method: 'POST',
      body: JSON.stringify({ quizId, sessionCode: code, hostKey }),
    });
    if (!d.ok) { alert$('launch-alert', d.error || 'Erreur', 'error'); return; }
    const sessionCode = d.session.sessionCode;
    // *** FIX CRITIQUE : sauvegarder dans localStorage AVANT navigate ***
    localStorage.setItem('quiz_host_session_code', sessionCode);
    localStorage.setItem('quiz_host_key', hostKey);
    state.host.sessionCode = sessionCode;
    state.host.hostKey     = hostKey;
    closeModal('launch-modal');
    navigate('host');
    state.socket.emit('join:host', { sessionCode, hostKey }, (res) => {
      if (!res?.ok) { alert$('host-alert', res?.error || 'Connexion impossible', 'error'); return; }
      state.host.connected = true;
      if (isTestMode && botCount > 0) {
        const botNames = ['Alice','Bob','Charlie','David','Eva','Frank','Grace','Hugo'];
        for (let i = 0; i < botCount; i++) {
          const pseudo = botNames[i % botNames.length];
          state.socket.emit('host:action', { sessionCode, hostKey, action: 'add_bot', pseudo }, () => {});
        }
      }
      renderHostGame();
    });
  } catch { alert$('launch-alert', 'Erreur réseau', 'error'); }
}

function emptyQuiz() {
  return { id: '', title: 'Nouveau quiz', welcomeImageUrl: '', welcomeMusicUrl: '', rounds: [], closingCeremony: { rankComments: {}, backgroundUrl: '', musicUrl: '' } };
}

// ── Cérémonie de clôture : helpers ──────────────────────────────────────────
function renderCeremonyRankList(q) {
  const rc = q?.closingCeremony?.rankComments || {};
  const entries = Object.entries(rc).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  if (!entries.length) {
    return `<p class="muted" style="font-size:.8rem;font-style:italic;">Aucun commentaire personnalisé. Le texte par défaut sera utilisé.</p>`;
  }
  return entries.map(([rank, comment]) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
      <span style="min-width:68px;font-size:.82rem;color:#f59e0b;font-weight:700;flex-shrink:0;">🏅 Rang ${rank}</span>
      <input type="text" value="${comment.replace(/"/g,'&quot;')}" style="flex:1;font-size:.82rem;"
        onchange="updateRankComment(${rank}, this.value)" placeholder="Commentaire…">
      <button class="btn-danger" style="padding:3px 8px;font-size:.75rem;flex-shrink:0;" onclick="removeRankComment(${rank})">✕</button>
    </div>`).join('');
}

function addRankComment() {
  const rankInput    = document.getElementById('new-rank-number');
  const commentInput = document.getElementById('new-rank-comment');
  const rank    = parseInt(rankInput?.value);
  const comment = commentInput?.value?.trim();
  if (!rank || rank < 1 || !comment) return;
  if (!state.admin.editingQuiz.closingCeremony) state.admin.editingQuiz.closingCeremony = { rankComments: {} };
  if (!state.admin.editingQuiz.closingCeremony.rankComments) state.admin.editingQuiz.closingCeremony.rankComments = {};
  state.admin.editingQuiz.closingCeremony.rankComments[String(rank)] = comment;
  rankInput.value   = '';
  commentInput.value = '';
  const listEl = document.getElementById('ceremony-rank-list');
  if (listEl) listEl.innerHTML = renderCeremonyRankList(state.admin.editingQuiz);
}

function updateRankComment(rank, value) {
  if (!state.admin.editingQuiz.closingCeremony) state.admin.editingQuiz.closingCeremony = { rankComments: {} };
  if (!state.admin.editingQuiz.closingCeremony.rankComments) state.admin.editingQuiz.closingCeremony.rankComments = {};
  if (value.trim()) {
    state.admin.editingQuiz.closingCeremony.rankComments[String(rank)] = value.trim();
  } else {
    delete state.admin.editingQuiz.closingCeremony.rankComments[String(rank)];
  }
}

function removeRankComment(rank) {
  if (state.admin.editingQuiz?.closingCeremony?.rankComments) {
    delete state.admin.editingQuiz.closingCeremony.rankComments[String(rank)];
  }
  const listEl = document.getElementById('ceremony-rank-list');
  if (listEl) listEl.innerHTML = renderCeremonyRankList(state.admin.editingQuiz);
}

// ── Upload/suppression médias cérémonie de clôture ──────────────────────────
async function uploadCeremonyMedia(field, accept) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      if (!state.admin.editingQuiz.closingCeremony) state.admin.editingQuiz.closingCeremony = { rankComments: {} };
      state.admin.editingQuiz.closingCeremony[field] = d.file.mediaUrl;
      alert$('admin-alert', '✅ Fichier uploadé !', 'success');
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}
window.uploadCeremonyMedia = uploadCeremonyMedia;

function clearCeremonyMedia(field) {
  if (state.admin.editingQuiz?.closingCeremony) {
    state.admin.editingQuiz.closingCeremony[field] = '';
    renderQuizEditor();
  }
}
window.clearCeremonyMedia = clearCeremonyMedia;

function emptyRound(idx = 0) {
  return {
    id: uid('round'),
    title: `Manche ${idx + 1}`,
    type: 'qcm',
    scoringMode: 'auto',
    scoringTarget: 'individual', // 'individual' | 'team'
    shortRules: '',
    backgroundUrl: '',
    musicUrl: '',        // kept for backward compat (fallback)
    introMusicUrl: '',   // musique écran de présentation
    gameMusicUrl: '',    // musique pendant la phase de jeu
    endMusicUrl: '',     // musique écran de fin de manche
    questions: [],
  };
}

function emptyQuestion(type = 'qcm') {
  const base = { id: uid('q'), content: '', mediaUrl: '' };
  // QCM : 4 options avec texte (+ optionnellement un mediaUrl par option)
  if (type === 'qcm' || type === 'questionnaire' || type === 'mcq') {
    return {
      ...base,
      type: 'qcm',
      options: [
        { id: uid('opt'), text: 'Réponse A', mediaUrl: '' },
        { id: uid('opt'), text: 'Réponse B', mediaUrl: '' },
        { id: uid('opt'), text: 'Réponse C', mediaUrl: '' },
        { id: uid('opt'), text: 'Réponse D', mediaUrl: '' },
      ],
      correctOptionIndex: 0,
      correctAnswer: 'Réponse A',
    };
  }
  // Vrai/Faux
  if (type === 'true_false') {
    return { ...base, type: 'true_false', correctAnswer: 'vrai' };
  }
  // Rapidité (buzzer) — le host interroge oralement et donne les points
  if (type === 'rapidite' || type === 'speed') {
    return { ...base, type: 'rapidite' };
  }
  // Burger — liste de 10 items que le host défile
  if (type === 'burger') {
    return {
      ...base,
      type: 'burger',
      items: Array.from({ length: 10 }, (_, i) => ({
        id: uid('item'),
        text: `Élément ${i + 1}`,
        mediaUrl: '',
      })),
    };
  }
  // Vote — les joueurs proposent une réponse, puis votent parmi toutes les réponses + leurres
  if (type === 'vote') {
    return {
      ...base,
      type: 'vote',
      fakeAnswers: [''],
    };
  }
  // Challenge Vidéo — une vidéo est jouée, les joueurs répondent à l'oral
  if (type === 'video_challenge') {
    return {
      ...base,
      type: 'video_challenge',
    };
  }
  return { ...base, type: type };
}

function renderQuizEditor() {
  const q = state.admin.editingQuiz;
  const rounds = q.rounds || [];
  if (state.admin.activeRoundIndex >= rounds.length) {
    state.admin.activeRoundIndex = Math.max(0, rounds.length - 1);
  }
  const ari = state.admin.activeRoundIndex;
  const activeRound = rounds[ari] || null;

  // Sidebar : liste des manches (drag & drop)
  const sidebarItems = rounds.length
    ? rounds.map((r, ri) => `
        <div class="editor-sidebar-item ${ari===ri?'active':''}"
             draggable="true"
             data-round-idx="${ri}"
             ondragstart="onRoundDragStart(event,${ri})"
             ondragover="onRoundDragOver(event,${ri})"
             ondragleave="onRoundDragLeave(event)"
             ondrop="onRoundDrop(event,${ri})"
             ondragend="onRoundDragEnd(event)"
             onclick="switchRound(${ri})">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="drag-handle" title="Déplacer" onclick="event.stopPropagation()">⠿</span>
            <div style="min-width:0;">
              <div style="font-size:.7rem;color:rgba(255,255,255,.4);margin-bottom:2px;">Manche ${ri+1}</div>
              <div style="font-weight:${ari===ri?'700':'400'};font-size:.86rem;color:${ari===ri?'#79b8ff':'rgba(255,255,255,.8)'};
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${r.title || `Manche ${ri+1}`}
              </div>
              <div style="font-size:.7rem;color:rgba(255,255,255,.35);margin-top:3px;">
                ${(r.questions||[]).length} q · ${r.type||'qcm'}
              </div>
            </div>
          </div>
        </div>`).join('')
    : '<p class="muted" style="font-size:.8rem;text-align:center;">Aucune manche</p>';

  html('page-admin', `
    <div class="row" style="justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
      <h1>✏️ Éditeur de quiz</h1>
      <div class="row">
        <button class="btn-success"   onclick="saveQuiz()">💾 Enregistrer</button>
        <button class="btn-secondary" onclick="loadQuizList()">← Retour</button>
      </div>
    </div>
    <div id="admin-alert"></div>

    <div class="editor-layout">
      <!-- Colonne principale -->
      <div>
        <div class="card" style="border-color:rgba(99,179,237,.2);">
          <h3>📝 Informations générales</h3>
          <div style="margin-top:12px;">
            <label>Titre du quiz</label>
            <input id="quiz-title" value="${q.title || ''}" placeholder="Nom du quiz">
          </div>
        </div>

        <!-- Page de bienvenue -->
        <div class="card" style="border-color:rgba(240,147,251,.2);background:rgba(240,147,251,.03);">
          <h3>🎉 Page de bienvenue</h3>
          <p class="muted" style="font-size:.8rem;margin:6px 0 14px;">Affiché sur l'écran TV pendant l'attente des joueurs (lobby).</p>
          <div class="grid2" style="gap:12px;">
            <div>
              <label style="font-size:.8rem;">Image / fond d'accueil</label>
              <div class="row" style="gap:6px;margin-top:4px;">
                <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadQuizMedia('welcomeImageUrl','image/*')">🖼️ Choisir image</button>
                ${q.welcomeImageUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearQuizMedia('welcomeImageUrl')">✕</button>` : ''}
              </div>
              ${q.welcomeImageUrl ? `<img src="${resolveMedia(q.welcomeImageUrl)}" style="max-height:80px;border-radius:8px;opacity:.75;margin-top:6px;">` : ''}
            </div>
            <div>
              <label style="font-size:.8rem;">Musique d'accueil</label>
              <div class="row" style="gap:6px;margin-top:4px;">
                <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadQuizMedia('welcomeMusicUrl','audio/*')">🎵 Choisir musique</button>
                ${q.welcomeMusicUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearQuizMedia('welcomeMusicUrl')">✕</button>` : ''}
              </div>
              ${q.welcomeMusicUrl ? `<audio controls src="${resolveMedia(q.welcomeMusicUrl)}" style="height:32px;width:100%;margin-top:6px;"></audio>` : ''}
            </div>
          </div>
        </div>

        <div id="rounds-container">
          ${activeRound
            ? renderRoundBlock(activeRound, ari)
            : `<div class="card" style="text-align:center;padding:40px;border:2px dashed rgba(255,255,255,.12);">
                <div style="font-size:2.5rem;margin-bottom:10px;">📋</div>
                <p class="muted">Aucune manche. Ajoutez-en une dans le panneau de droite.</p>
               </div>`}
        </div>

        <!-- Cérémonie de clôture -->
        <div class="card" style="border-color:rgba(255,215,0,.25);background:rgba(255,215,0,.04);margin-top:18px;">
          <h3 style="margin-bottom:6px;">🏆 Cérémonie de clôture</h3>
          <p class="muted" style="font-size:.8rem;margin-bottom:14px;">
            Personnalisez l'ambiance et les commentaires de la cérémonie finale.
          </p>

          <!-- Fond d'écran et musique -->
          <div class="grid2" style="gap:12px;margin-bottom:14px;">
            <div>
              <label style="font-size:.8rem;">Image de fond cérémonie</label>
              <div class="row" style="gap:6px;margin-top:4px;">
                <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadCeremonyMedia('backgroundUrl','image/*')">🖼️ Choisir image</button>
                ${q.closingCeremony?.backgroundUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearCeremonyMedia('backgroundUrl')">✕</button>` : ''}
              </div>
              ${q.closingCeremony?.backgroundUrl ? `<img src="${resolveMedia(q.closingCeremony.backgroundUrl)}" style="max-height:80px;border-radius:8px;opacity:.75;margin-top:6px;">` : ''}
            </div>
            <div>
              <label style="font-size:.8rem;">Musique de cérémonie</label>
              <div class="row" style="gap:6px;margin-top:4px;">
                <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadCeremonyMedia('musicUrl','audio/*')">🎵 Choisir musique</button>
                ${q.closingCeremony?.musicUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearCeremonyMedia('musicUrl')">✕</button>` : ''}
              </div>
              ${q.closingCeremony?.musicUrl ? `<audio controls src="${resolveMedia(q.closingCeremony.musicUrl)}" style="height:32px;width:100%;margin-top:6px;"></audio>` : ''}
            </div>
          </div>

          <!-- Commentaires par rang -->
          <label style="font-size:.8rem;display:block;margin-bottom:8px;">Commentaires par rang</label>
          <p class="muted" style="font-size:.75rem;margin-bottom:10px;">Laissez vide pour utiliser le texte par défaut.</p>
          <div id="ceremony-rank-list">
            ${renderCeremonyRankList(q)}
          </div>
          <div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input type="number" id="new-rank-number" min="1" max="100" placeholder="Rang" style="width:80px;">
            <input type="text" id="new-rank-comment" placeholder="Commentaire pour ce rang…" style="flex:1;min-width:160px;">
            <button class="btn-primary" style="padding:7px 14px;font-size:.82rem;" onclick="addRankComment()">+ Ajouter</button>
          </div>
        </div>
      </div>

      <!-- Sidebar manches -->
      <div class="editor-sidebar">
        <div class="card" style="padding:14px;border-color:rgba(99,179,237,.2);">
          <div style="font-size:.72rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">
            📋 Manches (${rounds.length})
          </div>
          ${sidebarItems}
          <button class="btn-primary" style="width:100%;padding:9px;font-size:.82rem;margin-top:10px;" onclick="addRound()">
            + Nouvelle manche
          </button>
        </div>
      </div>
    </div>
  `);
}

function switchRound(idx) {
  // Sauvegarder le titre du quiz en cours avant de changer de manche
  const titleInput = document.getElementById('quiz-title');
  if (titleInput && state.admin.editingQuiz) {
    state.admin.editingQuiz.title = titleInput.value.trim() || state.admin.editingQuiz.title;
  }
  state.admin.activeRoundIndex = idx;
  renderQuizEditor();
}

// ── Drag & Drop — Manches (sidebar) ──────────────────────────────────────────
function onRoundDragStart(event, ri) {
  _dragSrcRoundIdx = ri;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(ri));
  // Déclencher la classe dragging après un tick (sinon la ghost image est grisée)
  setTimeout(() => {
    const el = document.querySelector(`.editor-sidebar-item[data-round-idx="${ri}"]`);
    if (el) el.classList.add('is-dragging');
  }, 0);
}
function onRoundDragOver(event, ri) {
  if (_dragSrcRoundIdx === null || _dragSrcRoundIdx === ri) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  // Afficher l'indicateur drop-over uniquement sur la cible courante
  document.querySelectorAll('.editor-sidebar-item').forEach(el => el.classList.remove('drag-over'));
  const el = document.querySelector(`.editor-sidebar-item[data-round-idx="${ri}"]`);
  if (el) el.classList.add('drag-over');
}
function onRoundDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}
function onRoundDrop(event, targetRi) {
  event.preventDefault();
  if (_dragSrcRoundIdx === null || _dragSrcRoundIdx === targetRi) { onRoundDragEnd(event); return; }
  const rounds = state.admin.editingQuiz?.rounds;
  if (!rounds) return;
  // Réordonner le tableau
  const [moved] = rounds.splice(_dragSrcRoundIdx, 1);
  rounds.splice(targetRi, 0, moved);
  // Ajuster l'index actif si besoin
  let ari = state.admin.activeRoundIndex;
  if (ari === _dragSrcRoundIdx) {
    ari = targetRi;
  } else if (_dragSrcRoundIdx < ari && targetRi >= ari) {
    ari--;
  } else if (_dragSrcRoundIdx > ari && targetRi <= ari) {
    ari++;
  }
  state.admin.activeRoundIndex = ari;
  _dragSrcRoundIdx = null;
  renderQuizEditor();
}
function onRoundDragEnd(event) {
  _dragSrcRoundIdx = null;
  document.querySelectorAll('.editor-sidebar-item').forEach(el => {
    el.classList.remove('is-dragging', 'drag-over');
  });
}
window.onRoundDragStart = onRoundDragStart;
window.onRoundDragOver  = onRoundDragOver;
window.onRoundDragLeave = onRoundDragLeave;
window.onRoundDrop      = onRoundDrop;
window.onRoundDragEnd   = onRoundDragEnd;

// ── Drag & Drop — Questions ───────────────────────────────────────────────────
function onQuestionDragStart(event, roundId, qi) {
  _dragSrcQIdx    = qi;
  _dragSrcQRoundId = roundId;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(qi));
  setTimeout(() => {
    const el = document.querySelector(`.question-row[data-qidx="${qi}"][data-round-id="${roundId}"]`);
    if (el) el.classList.add('is-dragging');
  }, 0);
}
function onQuestionDragOver(event, roundId, qi) {
  if (_dragSrcQIdx === null || (_dragSrcQIdx === qi && _dragSrcQRoundId === roundId)) return;
  if (_dragSrcQRoundId !== roundId) return; // pas de déplacement inter-manches
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.question-row').forEach(el => el.classList.remove('drag-over'));
  const el = document.querySelector(`.question-row[data-qidx="${qi}"][data-round-id="${roundId}"]`);
  if (el) el.classList.add('drag-over');
}
function onQuestionDragLeave(event) {
  event.currentTarget.classList.remove('drag-over');
}
function onQuestionDrop(event, roundId, targetQi) {
  event.preventDefault();
  if (_dragSrcQIdx === null || _dragSrcQRoundId !== roundId || _dragSrcQIdx === targetQi) {
    onQuestionDragEnd(event); return;
  }
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  if (!round?.questions) return;
  const [moved] = round.questions.splice(_dragSrcQIdx, 1);
  round.questions.splice(targetQi, 0, moved);
  _dragSrcQIdx     = null;
  _dragSrcQRoundId = null;
  renderQuizEditor();
}
function onQuestionDragEnd(event) {
  _dragSrcQIdx     = null;
  _dragSrcQRoundId = null;
  document.querySelectorAll('.question-row').forEach(el => {
    el.classList.remove('is-dragging', 'drag-over');
  });
}
window.onQuestionDragStart = onQuestionDragStart;
window.onQuestionDragOver  = onQuestionDragOver;
window.onQuestionDragLeave = onQuestionDragLeave;
window.onQuestionDrop      = onQuestionDrop;
window.onQuestionDragEnd   = onQuestionDragEnd;

function renderRoundBlock(round, ri) {
  const roundTypes = [
    { v:'qcm',             l:'🔘 QCM (choix multiple)' },
    { v:'rapidite',        l:'⚡ Rapidité (buzzer)' },
    { v:'true_false',      l:'✅ Vrai / Faux' },
    { v:'burger',          l:'🍔 Burger (liste révélée)' },
    { v:'vote',            l:'🗳️ Vote (propositions + votes)' },
    { v:'video_challenge', l:'🎬 Challenge Vidéo' },
  ];

  const bgPreview = round.backgroundUrl
    ? `<div style="margin-top:6px;"><img src="${resolveMedia(round.backgroundUrl)}" style="max-height:80px;border-radius:8px;opacity:.7;"></div>` : '';
  const musicPreview = round.musicUrl
    ? `<div style="margin-top:6px;"><audio controls src="${resolveMedia(round.musicUrl)}" style="height:32px;width:100%;"></audio></div>` : '';

  const nbQ = round.questions?.length || 0;
  const qLabel = round.type === 'burger' ? 'Question(s) burger' : 'Questions';

  return `
    <div class="round-panel" id="round-${round.id}">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        <strong style="font-size:1rem;">📋 Manche ${ri+1}</strong>
        <button class="btn-danger" style="padding:4px 10px;font-size:.8rem;" onclick="removeRound('${round.id}')">🗑️ Supprimer cette manche</button>
      </div>

      <!-- Infos de base -->
      <div class="grid2" style="gap:10px;margin-bottom:12px;">
        <div>
          <label>Titre</label>
          <input value="${round.title||''}" onchange="updateRound('${round.id}','title',this.value)" placeholder="Titre de la manche">
        </div>
        <div>
          <label>Type de questions</label>
          <select onchange="updateRound('${round.id}','type',this.value)">
            ${roundTypes.map(t => `<option value="${t.v}" ${round.type===t.v?'selected':''}>${t.l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label>Points attribués à</label>
          <select onchange="updateRound('${round.id}','scoringTarget',this.value)">
            <option value="individual" ${(round.scoringTarget||'individual')==='individual'?'selected':''}>👤 Individuel</option>
            <option value="team"       ${round.scoringTarget==='team'?'selected':''}>👥 Équipe</option>
          </select>
        </div>
        <div>
          <label>Mode de scoring</label>
          <select onchange="updateRound('${round.id}','scoringMode',this.value)">
            <option value="auto"    ${round.scoringMode==='auto'?'selected':''}>Auto (vérification auto)</option>
            <option value="arbitre" ${round.scoringMode==='arbitre'?'selected':''}>Arbitre (attribution manuelle)</option>
          </select>
        </div>
        <div>
          <label>Règles courtes (affichées aux joueurs)</label>
          <input value="${round.shortRules||''}" onchange="updateRound('${round.id}','shortRules',this.value)" placeholder="Règles courtes">
        </div>
      </div>

      <!-- Personnalisation fond & musique -->
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px;margin-bottom:14px;">
        <div style="font-size:.78rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🎨 Personnalisation</div>
        <div class="grid2" style="gap:10px;">
          <div>
            <label style="font-size:.8rem;">Fond d'écran (intro manche)</label>
            <div class="row" style="gap:6px;margin-top:4px;">
              <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadRoundMedia('${round.id}','backgroundUrl','image/*')">🖼️ Choisir image</button>
              ${round.backgroundUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearRoundMedia('${round.id}','backgroundUrl')">✕</button>` : ''}
            </div>
            ${bgPreview}
          </div>
          <div>
            <label style="font-size:.8rem;">🎵 Musique intro (écran présentation)</label>
            <div class="row" style="gap:6px;margin-top:4px;">
              <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadRoundMedia('${round.id}','introMusicUrl','audio/*')">🎵 Choisir</button>
              ${round.introMusicUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearRoundMedia('${round.id}','introMusicUrl')">✕</button>` : ''}
            </div>
            ${round.introMusicUrl ? `<audio controls src="${resolveMedia(round.introMusicUrl)}" style="height:28px;width:100%;margin-top:4px;"></audio>` : ''}
          </div>
          <div>
            <label style="font-size:.8rem;">🎮 Musique de jeu (questions)</label>
            <div class="row" style="gap:6px;margin-top:4px;">
              <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadRoundMedia('${round.id}','gameMusicUrl','audio/*')">🎵 Choisir</button>
              ${round.gameMusicUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearRoundMedia('${round.id}','gameMusicUrl')">✕</button>` : ''}
            </div>
            ${round.gameMusicUrl ? `<audio controls src="${resolveMedia(round.gameMusicUrl)}" style="height:28px;width:100%;margin-top:4px;"></audio>` : ''}
          </div>
          <div>
            <label style="font-size:.8rem;">🏁 Musique fin de manche</label>
            <div class="row" style="gap:6px;margin-top:4px;">
              <button class="btn-secondary" style="font-size:.78rem;padding:5px 10px;" onclick="uploadRoundMedia('${round.id}','endMusicUrl','audio/*')">🎵 Choisir</button>
              ${round.endMusicUrl ? `<button class="btn-danger" style="font-size:.75rem;padding:4px 8px;" onclick="clearRoundMedia('${round.id}','endMusicUrl')">✕</button>` : ''}
            </div>
            ${round.endMusicUrl ? `<audio controls src="${resolveMedia(round.endMusicUrl)}" style="height:28px;width:100%;margin-top:4px;"></audio>` : ''}
          </div>
        </div>
        <p class="muted" style="font-size:.72rem;margin-top:8px;">💡 La musique s'adapte automatiquement à la phase de jeu. Un bouton mute est disponible sur l'écran TV.</p>
      </div>

      ${''/* Vidéo d'entraînement déplacée au niveau de la question video_challenge */}

      <!-- Questions -->
      <div>
        <div class="row" style="justify-content:space-between;margin-bottom:8px;">
          <span style="font-size:.85rem;color:rgba(255,255,255,.6);">${qLabel} (${nbQ})</span>
          <button class="btn-secondary" style="padding:4px 10px;font-size:.8rem;" onclick="addQuestion('${round.id}')">+ Question</button>
        </div>
        <div id="questions-${round.id}">
          ${(round.questions || []).map((q, qi) => renderQuestionRow(q, qi, round.id, round.type || 'qcm')).join('')}
        </div>
      </div>
    </div>`;
}

function renderQuestionRow(q, qi, roundId, roundType) {
  const effectiveType = q.type || roundType || 'qcm';
  const labels = ['A','B','C','D'];
  const labelColors = ['#4ade80','#60a5fa','#f59e0b','#f87171'];

  // Aperçu média de la question
  function mediaPreview(url, cls='') {
    if (!url) return '';
    const resolved = resolveMedia(url);
    if (/\.(mp3|wav|ogg)$/i.test(resolved))
      return `<audio controls src="${resolved}" style="height:28px;max-width:200px;${cls}"></audio>`;
    return `<img src="${resolved}" style="max-height:48px;border-radius:6px;opacity:.8;${cls}">`;
  }

  const qMediaBtn = `<button class="btn-secondary" style="padding:4px 8px;font-size:.78rem;white-space:nowrap;" onclick="openMediaUpload('${q.id}')">🖼️</button>`;
  const qMediaPreview = q.mediaUrl ? mediaPreview(q.mediaUrl,'margin-left:6px;') : '';
  const removeBtn = `<button class="btn-danger" style="padding:4px 8px;font-size:.8rem;flex-shrink:0;" onclick="removeQuestion('${roundId}','${q.id}')">✕</button>`;

  // Ligne commune : handle + numéro + contenu + média + supprimer
  const headerRow = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <span class="drag-handle question-drag-handle" title="Déplacer la question">⠿</span>
      <span class="muted" style="min-width:18px;font-size:.82rem;flex-shrink:0;text-align:right;">${qi+1}.</span>
      <input value="${(q.content||'').replace(/"/g,'&quot;')}" placeholder="Énoncé de la question"
        onchange="updateQuestion('${roundId}','${q.id}','content',this.value)"
        style="flex:1;min-width:160px;">
      ${qMediaBtn}
      ${qMediaPreview}
      ${removeBtn}
    </div>`;

  let body = '';

  // ── QCM ──────────────────────────────────────────────────
  if (effectiveType === 'qcm' || effectiveType === 'questionnaire' || effectiveType === 'mcq') {
    const opts = Array.isArray(q.options) && q.options.length
      ? q.options.map(o => typeof o === 'object' ? o : { id: uid('opt'), text: String(o||''), mediaUrl: '' })
      : [{ id:uid('opt'),text:'Réponse A',mediaUrl:'' },{ id:uid('opt'),text:'Réponse B',mediaUrl:'' },
         { id:uid('opt'),text:'Réponse C',mediaUrl:'' },{ id:uid('opt'),text:'Réponse D',mediaUrl:'' }];
    const correctIdx = typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0;
    // Labels étendus pour supporter plus de 4 options
    const extLabels = ['A','B','C','D','E','F','G','H'];
    const extColors = ['#4ade80','#60a5fa','#f59e0b','#f87171','#c084fc','#34d399','#fb923c','#38bdf8'];

    body = `
      <div style="margin:8px 0 4px 28px;padding:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:10px;">
        <div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">Options de réponse</div>
        <div style="display:grid;gap:6px;">
          ${opts.map((opt, i) => `
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="radio" name="correct-${q.id}" ${correctIdx===i?'checked':''} title="Bonne réponse"
                onchange="updateQcmCorrect('${roundId}','${q.id}',${i})"
                style="accent-color:#4ade80;width:16px;height:16px;flex-shrink:0;">
              <span style="font-size:.78rem;font-weight:700;color:${extColors[i]||'#fff'};min-width:18px;">${extLabels[i]||String.fromCharCode(65+i)}</span>
              <input value="${(opt.text||'').replace(/"/g,'&quot;')}" placeholder="Option ${extLabels[i]||i+1}"
                oninput="updateQcmOptionText('${roundId}','${q.id}',${i},this.value)"
                style="flex:1;font-size:.82rem;padding:5px 8px;">
              <button class="btn-secondary" style="padding:3px 7px;font-size:.75rem;" onclick="uploadOptionMedia('${roundId}','${q.id}',${i})" title="Image/Son pour cette option">🖼️</button>
              ${i >= 4 ? `<button class="btn-danger" style="padding:3px 7px;font-size:.75rem;" onclick="removeQcmOption('${roundId}','${q.id}',${i})" title="Supprimer">✕</button>` : ''}
              ${opt.mediaUrl ? mediaPreview(opt.mediaUrl) : ''}
            </div>`).join('')}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap;gap:6px;">
          <span style="font-size:.75rem;color:rgba(255,255,255,.4);">🔘 Cocher le bouton radio = bonne réponse</span>
          ${opts.length < 8 ? `<button class="btn-secondary" style="padding:4px 10px;font-size:.78rem;" onclick="addQcmOption('${roundId}','${q.id}')">+ Option</button>` : ''}
        </div>
      </div>`;
  }

  // ── VRAI/FAUX ────────────────────────────────────────────
  else if (effectiveType === 'true_false') {
    const isVrai = (q.correctAnswer||'vrai').toLowerCase() === 'vrai';
    body = `
      <div style="margin:8px 0 4px 28px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:.78rem;color:rgba(255,255,255,.5);white-space:nowrap;">✅ Bonne réponse :</span>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:6px 12px;border-radius:8px;border:2px solid ${isVrai?'#38ef7d':'rgba(56,239,125,.2)'};background:${isVrai?'rgba(56,239,125,.1)':'transparent'};transition:.15s;">
            <input type="radio" name="tf-${q.id}" value="vrai" ${isVrai?'checked':''}
              onchange="updateQuestion('${roundId}','${q.id}','correctAnswer','vrai');renderQuizEditor()"
              style="accent-color:#38ef7d;">
            <span style="color:#38ef7d;font-weight:700;">✅ VRAI</span>
          </label>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:6px 12px;border-radius:8px;border:2px solid ${!isVrai?'#eb3349':'rgba(235,51,73,.2)'};background:${!isVrai?'rgba(235,51,73,.1)':'transparent'};transition:.15s;">
            <input type="radio" name="tf-${q.id}" value="faux" ${!isVrai?'checked':''}
              onchange="updateQuestion('${roundId}','${q.id}','correctAnswer','faux');renderQuizEditor()"
              style="accent-color:#eb3349;">
            <span style="color:#eb3349;font-weight:700;">❌ FAUX</span>
          </label>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:.78rem;color:rgba(255,255,255,.45);white-space:nowrap;padding-top:7px;">💡 Explication :</span>
          <textarea rows="2" placeholder="Explication de la réponse (affichée par l'admin après révélation…)"
            oninput="updateQuestion('${roundId}','${q.id}','explanation',this.value)"
            style="flex:1;font-size:.82rem;padding:6px 10px;border-radius:8px;resize:vertical;min-height:48px;">${(q.explanation||'').replace(/</g,'&lt;')}</textarea>
        </div>
      </div>`;
  }

  // ── RAPIDITÉ ─────────────────────────────────────────────
  else if (effectiveType === 'rapidite' || effectiveType === 'speed') {
    body = `
      <div style="margin:6px 0 4px 28px;background:rgba(255,165,0,.08);border:1px solid rgba(255,165,0,.2);border-radius:8px;padding:10px;font-size:.82rem;color:rgba(255,165,0,.9);">
        ⚡ Mode <strong>Rapidité</strong> : un buzzer apparaît sur l'écran du joueur. Le premier qui clique est interrogé oralement. Le maître de jeu attribue le point manuellement.
      </div>
      <div style="margin:8px 0 4px 28px;display:flex;align-items:center;gap:8px;">
        <label style="font-size:.78rem;color:rgba(255,255,255,.5);white-space:nowrap;">💡 Solution (optionnelle) :</label>
        <input value="${(q.correctAnswer||'').replace(/"/g,'&quot;')}" placeholder="Réponse à afficher après révélation"
          onchange="updateQuestion('${roundId}','${q.id}','correctAnswer',this.value)"
          style="flex:1;font-size:.82rem;padding:5px 8px;">
      </div>`;
  }

  // ── BURGER ───────────────────────────────────────────────
  else if (effectiveType === 'burger') {
    const items = Array.isArray(q.items) ? q.items : [];
    body = `
      <div style="margin:8px 0 4px 28px;padding:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:10px;">
        <div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">🍔 Liste des éléments (le host les révèle un par un)</div>
        <div style="display:grid;gap:6px;">
          ${items.map((item, i) => `
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:.78rem;color:rgba(255,255,255,.4);min-width:22px;flex-shrink:0;">${i+1}.</span>
              <input value="${(item.text||'').replace(/"/g,'&quot;')}" placeholder="Élément ${i+1}"
                oninput="updateBurgerItem('${roundId}','${q.id}',${i},this.value)"
                style="flex:1;font-size:.82rem;padding:5px 8px;">
              <button class="btn-secondary" style="padding:3px 7px;font-size:.75rem;" onclick="uploadItemMedia('${roundId}','${q.id}',${i})" title="Image/Son">🖼️</button>
              ${item.mediaUrl ? mediaPreview(item.mediaUrl) : ''}
            </div>`).join('')}
        </div>
        <div style="margin-top:10px;font-size:.75rem;color:rgba(255,255,255,.4);">🎯 Après les 10 éléments, le maître de jeu attribue de 0 à 10 points</div>
      </div>`;
  }

  // ── VOTE ─────────────────────────────────────────────────
  if (effectiveType === 'vote') {
    const fakeAnswers = Array.isArray(q.fakeAnswers) && q.fakeAnswers.length > 0 ? q.fakeAnswers : [''];
    body = `
      <div style="margin:8px 0 4px 28px;padding:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:10px;">
        <div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">🗳️ Leurres (facultatifs — réponses piège)</div>
        <p style="font-size:.78rem;color:rgba(255,255,255,.5);margin-bottom:8px;">
          Ces réponses seront mélangées avec celles des joueurs. Voter pour un leurre = -1 point.<br>
          <em>Laissez vide pour ne pas afficher ce leurre.</em>
        </p>
        <div style="display:grid;gap:6px;">
          ${fakeAnswers.map((fa, i) => `
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:.78rem;color:#eb3349;min-width:22px;flex-shrink:0;">🎭${i+1}</span>
              <input value="${(fa||'').replace(/"/g,'&quot;')}" placeholder="Leurre ${i+1} (laisser vide pour ignorer)"
                oninput="updateFakeAnswer('${roundId}','${q.id}',${i},this.value)"
                style="flex:1;font-size:.82rem;padding:5px 8px;">
              ${fakeAnswers.length > 1 ? `<button class="btn-secondary" style="padding:3px 7px;font-size:.75rem;color:#eb3349;" onclick="removeFakeAnswer('${roundId}','${q.id}',${i})">✕</button>` : ''}
            </div>`).join('')}
        </div>
        <button class="btn-secondary" style="margin-top:8px;padding:4px 10px;font-size:.78rem;" onclick="addFakeAnswer('${roundId}','${q.id}')">+ Ajouter un leurre</button>
        <div style="margin-top:10px;font-size:.75rem;color:rgba(255,255,255,.4);">📋 Déroulement : 1. Les joueurs écrivent une réponse · 2. Toutes les réponses + leurres non-vides sont affichés anonymement · 3. Les joueurs votent · 4. +1pt par vote reçu, -1pt si vote pour un leurre</div>
      </div>`;
  }

  // ── CHALLENGE VIDÉO ──────────────────────────────────────
  if (effectiveType === 'video_challenge') {
    const tvUrl = q.trainingVideoUrl || '';
    body = `
      <div style="margin:8px 0 4px 28px;padding:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:10px;">
        <div style="font-size:.72rem;color:rgba(255,255,255,.4);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">🎬 Challenge Vidéo</div>

        <!-- Vidéo d'entraînement (optionnelle) -->
        <div style="background:rgba(255,215,0,.05);border:1px solid rgba(255,215,0,.2);border-radius:8px;padding:10px;margin-bottom:12px;">
          <div style="font-size:.72rem;color:rgba(255,215,0,.7);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">🏋️ Vidéo d'entraînement (optionnelle)</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button class="btn-secondary" style="padding:4px 10px;font-size:.78rem;white-space:nowrap;" onclick="uploadQuestionTrainingVideo('${roundId}','${q.id}')">📤 Uploader</button>
            ${tvUrl
              ? `<span style="font-size:.75rem;color:rgba(255,255,255,.4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px;" title="${tvUrl}">${tvUrl.split('/').pop()}</span>
                 <button class="btn-secondary" style="padding:2px 6px;font-size:.72rem;color:#eb3349;" onclick="updateQuestion('${roundId}','${q.id}','trainingVideoUrl','');renderQuizEditor()" title="Supprimer">✕</button>`
              : `<span style="font-size:.75rem;color:rgba(255,255,255,.3);font-style:italic;">Aucune vidéo</span>`
            }
          </div>
          ${tvUrl ? `<div style="margin-top:6px;"><video src="${resolveMedia(tvUrl)}" controls style="max-width:100%;max-height:100px;border-radius:6px;"></video></div>` : ''}
        </div>

        <!-- Vidéo du challenge (principale) -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <label style="font-size:.78rem;color:rgba(255,255,255,.5);white-space:nowrap;">🎥 Vidéo du challenge :</label>
          <button class="btn-secondary" style="padding:5px 12px;font-size:.82rem;" onclick="openMediaUpload('${q.id}')">📤 Uploader une vidéo</button>
          ${q.mediaUrl
            ? `<span style="font-size:.75rem;color:rgba(255,255,255,.4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;" title="${q.mediaUrl}">${q.mediaUrl.split('/').pop()}</span>
               <button class="btn-secondary" style="padding:2px 6px;font-size:.72rem;color:#eb3349;" onclick="updateQuestion('${roundId}','${q.id}','mediaUrl','');renderQuizEditor()" title="Supprimer la vidéo">✕</button>`
            : `<span style="font-size:.75rem;color:rgba(255,255,255,.3);font-style:italic;">Aucune vidéo uploadée</span>`
          }
        </div>
        ${q.mediaUrl ? `<div style="margin-bottom:10px;"><video src="${resolveMedia(q.mediaUrl)}" controls style="max-width:100%;max-height:120px;border-radius:8px;"></video></div>` : ''}
        <div style="margin-top:8px;font-size:.75rem;color:rgba(255,255,255,.4);">📋 Déroulement : 1. Host choisit joueur/équipe · 2. (Entraînement si vidéo configurée) · 3. "Tenez-vous prêt" · 4. Vidéo du challenge · 5. Host attribue 0–10 pts</div>
      </div>`;
  }

  // ── SECTION RÉVÉLATION — commune à tous les types de question ──────────
  const _ri = q.revealImage || '';
  const _rt = q.revealText  || '';
  const _ra = q.revealAudio || '';
  const revealSection = `
    <div style="margin:8px 0 2px 28px;padding:10px 12px;background:rgba(99,179,237,.05);border:1px solid rgba(99,179,237,.18);border-radius:10px;">
      <div style="font-size:.7rem;color:rgba(99,179,237,.7);text-transform:uppercase;letter-spacing:.5px;margin-bottom:9px;display:flex;align-items:center;gap:6px;">
        <span>✨</span><span>Contenu à afficher lors de la révélation</span>
        <span style="font-size:.65rem;color:rgba(255,255,255,.25);font-style:italic;text-transform:none;letter-spacing:0;">(optionnel)</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:.78rem;color:rgba(255,255,255,.45);min-width:68px;flex-shrink:0;">🖼️ Image :</span>
          <button class="btn-secondary" style="padding:3px 9px;font-size:.75rem;white-space:nowrap;"
            onclick="openRevealMediaUpload('${roundId}','${q.id}','revealImage','image/*')">Uploader</button>
          ${_ri
            ? `<span style="font-size:.72rem;color:rgba(255,255,255,.32);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;" title="${_ri}">${_ri.split('/').pop()}</span>
               <button class="btn-secondary" style="padding:2px 5px;font-size:.72rem;color:#eb3349;" onclick="updateQuestion('${roundId}','${q.id}','revealImage','');renderQuizEditor()" title="Supprimer">✕</button>
               <img src="${resolveMedia(_ri)}" style="max-height:38px;border-radius:5px;opacity:.8;">`
            : `<span style="font-size:.72rem;color:rgba(255,255,255,.22);font-style:italic;">Aucune image</span>`}
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:.78rem;color:rgba(255,255,255,.45);min-width:68px;flex-shrink:0;padding-top:6px;">📝 Texte :</span>
          <textarea rows="2" placeholder="Texte à afficher lors de la révélation (anecdote, explication…)"
            oninput="updateQuestion('${roundId}','${q.id}','revealText',this.value)"
            style="flex:1;font-size:.8rem;padding:5px 8px;border-radius:8px;resize:vertical;min-height:44px;">${(_rt).replace(/</g,'&lt;')}</textarea>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:.78rem;color:rgba(255,255,255,.45);min-width:68px;flex-shrink:0;">🎵 Musique :</span>
          <button class="btn-secondary" style="padding:3px 9px;font-size:.75rem;white-space:nowrap;"
            onclick="openRevealMediaUpload('${roundId}','${q.id}','revealAudio','audio/*')">Uploader</button>
          ${_ra
            ? `<span style="font-size:.72rem;color:rgba(255,255,255,.32);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;" title="${_ra}">${_ra.split('/').pop()}</span>
               <button class="btn-secondary" style="padding:2px 5px;font-size:.72rem;color:#eb3349;" onclick="updateQuestion('${roundId}','${q.id}','revealAudio','');renderQuizEditor()" title="Supprimer">✕</button>
               <audio controls src="${resolveMedia(_ra)}" style="height:26px;max-width:180px;"></audio>`
            : `<span style="font-size:.72rem;color:rgba(255,255,255,.22);font-style:italic;">Aucune musique</span>`}
        </div>
      </div>
    </div>`;
  body += revealSection;

  return `
    <div class="question-row" id="question-${q.id}"
         draggable="true"
         data-qidx="${qi}" data-qid="${q.id}" data-round-id="${roundId}"
         ondragstart="onQuestionDragStart(event,'${roundId}',${qi})"
         ondragover="onQuestionDragOver(event,'${roundId}',${qi})"
         ondragleave="onQuestionDragLeave(event)"
         ondrop="onQuestionDrop(event,'${roundId}',${qi})"
         ondragend="onQuestionDragEnd(event)"
         style="flex-direction:column;align-items:stretch;gap:4px;margin-bottom:10px;">
      ${headerRow}
      ${body}
    </div>`;
}

function updateQcmOptionText(roundId, qId, optIndex, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  if (!Array.isArray(q.options)) q.options = [{text:'',mediaUrl:''},{text:'',mediaUrl:''},{text:'',mediaUrl:''},{text:'',mediaUrl:''}];
  const opt = q.options[optIndex];
  if (typeof opt === 'string') q.options[optIndex] = { id: uid('opt'), text: value, mediaUrl: '' };
  else if (opt) opt.text = value;
  // recalculer correctAnswer depuis correctOptionIndex
  const idx = typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0;
  q.correctAnswer = (q.options[idx]?.text || q.options[idx] || '').toString();
}

function updateQcmCorrect(roundId, qId, optIndex) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  q.correctOptionIndex = optIndex;
  const opt = q.options?.[optIndex];
  q.correctAnswer = typeof opt === 'object' ? (opt.text || '') : String(opt || '');
}

function addQcmOption(roundId, qId) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  if (!Array.isArray(q.options)) q.options = [];
  if (q.options.length >= 8) return;
  q.options.push({ id: uid('opt'), text: '', mediaUrl: '' });
  renderQuizEditor();
}
window.addQcmOption = addQcmOption;

function removeQcmOption(roundId, qId, optIndex) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q || !Array.isArray(q.options) || q.options.length <= 4) return;
  q.options.splice(optIndex, 1);
  // Recaler correctOptionIndex si besoin
  if (typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= q.options.length) {
    q.correctOptionIndex = q.options.length - 1;
  }
  const idx = q.correctOptionIndex ?? 0;
  q.correctAnswer = (q.options[idx]?.text || '').toString();
  renderQuizEditor();
}
window.removeQcmOption = removeQcmOption;

function updateBurgerItem(roundId, qId, itemIndex, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q || !Array.isArray(q.items)) return;
  if (q.items[itemIndex]) q.items[itemIndex].text = value;
}

function updateFakeAnswer(roundId, qId, idx, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  if (!Array.isArray(q.fakeAnswers)) q.fakeAnswers = [];
  q.fakeAnswers[idx] = value;
}

function addFakeAnswer(roundId, qId) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  if (!Array.isArray(q.fakeAnswers)) q.fakeAnswers = [];
  q.fakeAnswers.push('');
  renderQuizEditor();
}

function removeFakeAnswer(roundId, qId, idx) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (!q || !Array.isArray(q.fakeAnswers)) return;
  q.fakeAnswers.splice(idx, 1);
  if (q.fakeAnswers.length === 0) q.fakeAnswers = [''];
  renderQuizEditor();
}

// ── Upload vidéo d'entraînement au niveau de la question (video_challenge) ───
async function uploadQuestionTrainingVideo(roundId, qId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'video/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
      const q = round?.questions?.find(q => q.id === qId);
      if (q) { q.trainingVideoUrl = d.file.mediaUrl; renderQuizEditor(); }
      alert$('admin-alert', '✅ Vidéo d\'entraînement uploadée !', 'success');
    } catch(e) { alert$('admin-alert', 'Erreur réseau upload : ' + e.message, 'error'); }
  };
  input.click();
}
window.uploadQuestionTrainingVideo = uploadQuestionTrainingVideo;

// ── Upload vidéo d'entraînement au niveau de la manche (conservé pour compatibilité) ───────────────────────
async function uploadRoundTrainingVideo(roundId) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'video/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
      if (round) { round.trainingVideoUrl = d.file.mediaUrl; renderQuizEditor(); }
      alert$('admin-alert', '✅ Vidéo d\'entraînement uploadée !', 'success');
    } catch(e) { alert$('admin-alert', 'Erreur réseau upload : ' + e.message, 'error'); }
  };
  input.click();
}
window.uploadRoundTrainingVideo = uploadRoundTrainingVideo;

function addRound() {
  // Sauvegarder le titre du quiz avant de re-rendre (comme dans switchRound)
  const titleInput = document.getElementById('quiz-title');
  if (titleInput && state.admin.editingQuiz) {
    state.admin.editingQuiz.title = titleInput.value.trim() || state.admin.editingQuiz.title;
  }
  const q = state.admin.editingQuiz;
  q.rounds = q.rounds || [];
  const newRound = emptyRound(q.rounds.length);
  // Pour une manche QCM, ajouter une première question par défaut
  // Pour les autres types (vote, burger, true_false, rapidite…), laisser vide
  if (newRound.type === 'qcm') {
    newRound.questions = [emptyQuestion('qcm')];
  } else {
    newRound.questions = [];
  }
  q.rounds.push(newRound);
  state.admin.activeRoundIndex = q.rounds.length - 1;
  renderQuizEditor();
}

function removeRound(roundId) {
  const titleInput = document.getElementById('quiz-title');
  if (titleInput && state.admin.editingQuiz) {
    state.admin.editingQuiz.title = titleInput.value.trim() || state.admin.editingQuiz.title;
  }
  const q = state.admin.editingQuiz;
  q.rounds = (q.rounds || []).filter(r => r.id !== roundId);
  renderQuizEditor();
}

function updateRound(roundId, field, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  if (round) {
    round[field] = value;
    // Quand le type de manche change, réinitialiser les questions :
    // - QCM → ajouter une question vide adaptée
    // - autres types → vider (chaque question est unique à ce type)
    if (field === 'type') {
      if (value === 'qcm') {
        round.questions = [emptyQuestion('qcm')];
      } else {
        round.questions = [];
      }
    }
    renderQuizEditor();
  }
}

function addQuestion(roundId) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  if (!round) return;
  const roundType = round.type || 'qcm';
  round.questions = round.questions || [];
  round.questions.push(emptyQuestion(roundType));
  renderQuizEditor();
}

function removeQuestion(roundId, qId) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  if (!round) return;
  round.questions = (round.questions || []).filter(q => q.id !== qId);
  renderQuizEditor();
}

function updateQuestion(roundId, qId, field, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q = round?.questions?.find(q => q.id === qId);
  if (q) q[field] = value;
}

function updateQuestionOption(roundId, qId, optIndex, value) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q     = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  if (!Array.isArray(q.options)) q.options = ['', '', '', ''];
  q.options[optIndex] = value;
  const labels = ['A','B','C','D'];
  const selects = document.querySelectorAll(`#question-${qId} select`);
  selects.forEach(sel => {
    if (sel.options[optIndex]) sel.options[optIndex].value = value;
    if (sel.options[optIndex]) sel.options[optIndex].textContent = `${labels[optIndex]}: ${value || '?'}`;
  });
}

function changeQuestionType(roundId, qId, newType) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  const q     = round?.questions?.find(q => q.id === qId);
  if (!q) return;
  q.type = newType;
  if (newType === 'mcq') {
    if (!Array.isArray(q.options) || !q.options.length) {
      q.options = ['Option A', 'Option B', 'Option C', 'Option D'];
    }
    if (!q.correctAnswer) q.correctAnswer = q.options[0] || 'Option A';
  }
  renderQuizEditor();
}

async function uploadRoundMedia(roundId, field, accept) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
      if (round) { round[field] = d.file.mediaUrl; }
      alert$('admin-alert', '✅ Fichier uploadé !', 'success');
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}

function clearRoundMedia(roundId, field) {
  const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
  if (round) { round[field] = ''; renderQuizEditor(); }
}

async function uploadQuizMedia(field, accept) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      if (state.admin.editingQuiz) { state.admin.editingQuiz[field] = d.file.mediaUrl; }
      alert$('admin-alert', '✅ Fichier uploadé !', 'success');
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}
window.uploadQuizMedia = uploadQuizMedia;

function clearQuizMedia(field) {
  if (state.admin.editingQuiz) { state.admin.editingQuiz[field] = ''; renderQuizEditor(); }
}
window.clearQuizMedia = clearQuizMedia;

async function uploadOptionMedia(roundId, qId, optIndex) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,audio/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
      const q = round?.questions?.find(q => q.id === qId);
      if (q && Array.isArray(q.options) && q.options[optIndex]) {
        q.options[optIndex].mediaUrl = d.file.mediaUrl;
      }
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}

async function uploadItemMedia(roundId, qId, itemIndex) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,audio/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
      const q = round?.questions?.find(q => q.id === qId);
      if (q && Array.isArray(q.items) && q.items[itemIndex]) {
        q.items[itemIndex].mediaUrl = d.file.mediaUrl;
      }
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}

async function openMediaUpload(qId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,audio/*,video/*,image/gif';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      // Trouver la question dans tous les rounds et mettre à jour
      for (const round of state.admin.editingQuiz?.rounds || []) {
        const q = (round.questions || []).find(q => q.id === qId);
        if (q) { q.mediaUrl = d.file.mediaUrl; break; }
      }
      alert$('admin-alert', '✅ Fichier uploadé : ' + d.file.filename, 'success');
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}

// Upload d'un fichier de révélation (image ou audio) vers un champ spécifique de la question
async function openRevealMediaUpload(roundId, qId, field, accept) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept || 'image/*,audio/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/uploads/media`, { method: 'POST', body: fd });
      const d   = await res.json();
      if (!d.ok) { alert$('admin-alert', d.error || 'Erreur upload', 'error'); return; }
      const round = state.admin.editingQuiz?.rounds?.find(r => r.id === roundId);
      const q = round?.questions?.find(q => q.id === qId);
      if (q) q[field] = d.file.mediaUrl;
      alert$('admin-alert', '✅ Fichier uploadé : ' + d.file.filename, 'success');
      renderQuizEditor();
    } catch { alert$('admin-alert', 'Erreur réseau upload', 'error'); }
  };
  input.click();
}

async function saveQuiz() {
  const q = state.admin.editingQuiz;
  q.title = ($('#quiz-title')?.value || '').trim() || q.title;

  if (!q.title) { alert$('admin-alert', 'Titre requis', 'error'); return; }

  try {
    const method = q.id ? 'PUT' : 'POST';
    const path   = q.id ? `/api/quizzes/${q.id}` : '/api/quizzes';
    const d = await apiFetch(path, { method, body: JSON.stringify({ quiz: q }) });
    if (!d.ok) { alert$('admin-alert', d.error || 'Erreur save', 'error'); return; }
    alert$('admin-alert', '✅ Quiz enregistré !', 'success');
    state.admin.editingQuiz = d.quiz;
    state.admin.quizzes = await apiFetch('/api/quizzes').then(r => r.quizzes || []);
    // Re-synchroniser le game state de la session active (si elle utilise ce quiz)
    // pour que l'écran TV reçoive immédiatement les nouveaux champs (image/musique d'accueil, titre…)
    if (state.host.connected) {
      hostAction('sync_quiz');
    }
  } catch { alert$('admin-alert', 'Erreur réseau', 'error'); }
}

// ── Composants partagés ──────────────────────────────────────
function renderScoreboard(leaderboard, title = 'Classement') {
  if (!leaderboard?.length) return `<div class="card"><p class="muted">Aucun score</p></div>`;
  const rows = leaderboard.slice(0, 15).map((p, i) =>
    `<tr class="rank-${i+1}"><td><strong>${p.rank ?? i+1}</strong></td><td>${p.pseudo}</td><td class="muted">${p.teamName || '—'}</td><td><strong>${p.scoreTotal ?? 0}</strong></td></tr>`
  ).join('');
  return `
    <div class="card">
      <h2>${title}</h2>
      <table style="margin-top:12px;"><thead><tr><th>Rang</th><th>Joueur</th><th>Équipe</th><th>Score</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

function renderPodiumStage(revealed, total) {
  // Affichage visuel du podium (3 marches) avec les places selon révélation
  const p1 = revealed.find(p => p.rank === 1);
  const p2 = revealed.find(p => p.rank === 2);
  const p3 = revealed.find(p => p.rank === 3);
  const podiumSlot = (player, label, height, color, shadow) => player
    ? `<div class="podium-stage-slot podium-slot-filled" style="height:${height}px;background:${color};box-shadow:0 0 30px ${shadow};">
        <span style="font-size:1.8rem;">${label}</span>
        <div style="font-size:.95rem;font-weight:700;margin-top:4px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${player.pseudo}</div>
        <div style="font-size:.85rem;opacity:.8;">${player.scoreTotal ?? 0} pts</div>
       </div>`
    : `<div class="podium-stage-slot podium-slot-empty" style="height:${height}px;">
        <span style="font-size:2rem;opacity:.2;">${label}</span>
       </div>`;
  return `
    <div class="podium-stage">
      ${podiumSlot(p2, '🥈', 120, 'linear-gradient(180deg,rgba(192,192,192,.35),rgba(150,150,150,.15))', 'rgba(192,192,192,.3)')}
      ${podiumSlot(p1, '🥇', 160, 'linear-gradient(180deg,rgba(255,215,0,.4),rgba(255,170,0,.2))', 'rgba(255,215,0,.5)')}
      ${podiumSlot(p3, '🥉', 90, 'linear-gradient(180deg,rgba(205,127,50,.35),rgba(160,100,40,.15))', 'rgba(205,127,50,.3)')}
    </div>
    ${total > 3 && revealed.length === 0 ? `<p class="muted" style="text-align:center;margin-top:8px;font-size:.85rem;">Le maître de jeu va révéler les résultats…</p>` : ''}`;
}

function toggleCeremonyView(view) {
  state.admin.ceremonyView = view || (state.admin.ceremonyView === 'players' ? 'teams' : 'players');
  renderHostGame();
  // Propager la vue au serveur pour que l'écran TV se mette à jour
  if (state.host?.sessionCode && state.host?.hostKey) {
    state.socket.emit('host:action', {
      sessionCode: state.host.sessionCode,
      hostKey: state.host.hostKey,
      action: 'ceremony_view',
      view: state.admin.ceremonyView,
    });
  }
  // Si on est sur la même machine que le display, le rafraîchir directement
  if (state.display?.connected) renderDisplay();
}
window.toggleCeremonyView = toggleCeremonyView;

function renderFinalCeremony(gs, leaderboard, leaderboardTeams) {
  const fc = gs?.phaseMeta?.finalCeremony;

  // Pas de cérémonie lancée : afficher le podium vide en attente
  if (!fc) {
    return `
      <div class="ceremony-container">
        <div class="card" style="text-align:center;padding:24px;margin-bottom:16px;">
          <div style="font-size:3.5rem;margin-bottom:10px;">🏆</div>
          <h2>Fin du Quiz !</h2>
          <p class="muted" style="margin-top:6px;">En attente de la cérémonie…</p>
        </div>
        ${renderPodiumStage([], leaderboard?.length || 0)}
      </div>`;
  }

  // Mode équipes : révélation progressive ou statique
  const showTeams = state.admin?.ceremonyView === 'teams';
  if (showTeams) {
    // Révélation progressive si les données existent dans fc
    const hasTeamsReveal = fc.teamsRevealOrder && fc.teamsRevealOrder.length > 0;
    const teamsToShow = hasTeamsReveal
      ? fc.teamsRevealOrder.filter(t => t.revealed).sort((a, b) => b.rank - a.rank)
      : (leaderboardTeams || []);

    const teamRows = teamsToShow.map((t, i) => {
      const rank = t.rank ?? (teamsToShow.length - i);
      const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
      const isNew = hasTeamsReveal && i === teamsToShow.length - 1;
      return `<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:12px;
        background:${rank<=3 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)'};
        border:1px solid rgba(255,255,255,${rank<=3 ? '.12' : '.06'});margin-bottom:8px;
        ${isNew ? 'animation:podium-entry .45s ease forwards;' : ''}">
        <span style="font-size:1.6rem;min-width:36px;">${rankEmoji}</span>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:1rem;">${t.name || '—'}</div>
        </div>
        <div style="font-size:1.1rem;font-weight:700;color:#f7971e;">${t.scoreTotal ?? 0} <span style="font-size:.7rem;opacity:.6;">pts</span></div>
      </div>`;
    }).join('');

    const waitingMsg = hasTeamsReveal && teamsToShow.length === 0
      ? `<p class="muted" style="text-align:center;margin-top:24px;font-size:.9rem;">Le maître de jeu va révéler les équipes…</p>` : '';

    return `
      <div class="ceremony-container">
        <div style="text-align:center;padding:16px 8px 8px;">
          <div style="font-size:2.5rem;margin-bottom:8px;">⚽</div>
          <h2>Classement par équipes</h2>
        </div>
        ${waitingMsg}
        <div style="margin-top:16px;">${teamRows}</div>
      </div>`;
  }

  // Mode joueurs : révélation progressive avec podium
  const revealed = fc.revealOrder.filter(p => p.revealed);

  // Séparer : 4e+ et podium (top 3)
  const revealedTop3 = revealed.filter(p => p.rank <= 3);
  const revealedOthers = revealed.filter(p => p.rank > 3).sort((a, b) => a.rank - b.rank); // ordre croissant de rang

  const rankEmoji = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;
  const rankClass = r => r === 1 ? 'rank-1-card' : r === 2 ? 'rank-2-card' : r === 3 ? 'rank-3-card' : 'rank-other-card';

  // Déclencher confettis si le 1er vient d'être révélé
  const first = revealed.find(p => p.rank === 1);
  const confettiJs = first ? '<script>if(window.launchConfetti)launchConfetti();<\/script>' : '';

  // Liste 4e et au-delà (triée du dernier vers le 4e = ordre croissant de rang)
  const othersListHtml = revealedOthers.length ? `
    <div style="margin-bottom:20px;">
      <p class="muted" style="font-size:.75rem;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;text-align:center;">Classement</p>
      ${revealedOthers.map((p, i) => {
        const isNew = i === revealedOthers.length - 1 && revealedTop3.length === 0;
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:6px;
          ${isNew ? 'animation:podium-entry .45s ease forwards;' : ''}">
          <span style="font-size:1.1rem;min-width:32px;text-align:center;">${rankEmoji(p.rank)}</span>
          <div style="flex:1;font-weight:600;font-size:.95rem;">${p.pseudo}</div>
          ${p.teamName ? `<span style="font-size:.75rem;color:rgba(255,255,255,.4);">⚽ ${p.teamName}</span>` : ''}
          <span style="font-size:.95rem;font-weight:700;color:rgba(255,255,255,.7);">${p.scoreTotal ?? 0} pts</span>
        </div>`;
      }).join('')}
    </div>` : '';

  // Cartes podium (top 3, révélées progressivement)
  const sortedTop3 = [...revealedTop3].sort((a, b) => b.rank - a.rank);
  const newestRevealIndex = sortedTop3.length - 1;
  const podiumCards = sortedTop3.map((p, i) => {
    const isNew = i === newestRevealIndex;
    const animStyle = isNew ? 'animation-delay:0s;' : 'animation:none;';
    return `<div class="podium-card ${rankClass(p.rank)}" style="${animStyle}">
      <span class="podium-rank">${rankEmoji(p.rank)}</span>
      <div class="podium-pseudo">${p.pseudo}</div>
      ${p.teamName ? `<div class="muted" style="font-size:.78rem;margin-top:2px;">⚽ ${p.teamName}</div>` : ''}
      <div class="podium-score">${p.scoreTotal ?? 0} pts</div>
      <div class="podium-nickname">${p.nickname || ''}</div>
    </div>`;
  }).join('');

  return `
    <div class="ceremony-container">
      ${confettiJs}
      ${othersListHtml}
      ${renderPodiumStage(revealedTop3, fc.revealOrder.length)}
      ${revealedTop3.length ? `<div class="podium-revealed-list" style="margin-top:16px;">${podiumCards}</div>` : ''}
    </div>`;
}

// ── Confettis (lancés côté display/player au moment de la révélation du 1er) ──
function launchConfetti() {
  const colors = ['#f093fb','#f5576c','#38ef7d','#ffcc00','#4facfe','#ff9a56'];
  const container = document.body;
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left:${Math.random() * 100}vw;
      top:-20px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      width:${6 + Math.random() * 8}px;
      height:${10 + Math.random() * 12}px;
      animation-duration:${2.5 + Math.random() * 3}s;
      animation-delay:${Math.random() * 1.5}s;
    `;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}
window.launchConfetti = launchConfetti;

// ── Modal de changement de quiz ────────────────────────────────
async function showChangeQuizModal() {
  closeModal('change-quiz-modal');
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'change-quiz-modal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="row" style="justify-content:space-between;margin-bottom:16px;">
        <h2>🔄 Changer de quiz</h2>
        <button class="btn-secondary btn-sm" onclick="closeModal('change-quiz-modal')">✕</button>
      </div>
      <div id="change-quiz-list"><p class="muted">Chargement…</p></div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('change-quiz-modal'); });
  document.body.appendChild(modal);

  try {
    const d = await apiFetch('/api/quizzes');
    const quizzes = d.quizzes || [];
    const currentId = state.gameState?.quizId;
    const listHtml = quizzes.length
      ? quizzes.map(q => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;
            padding:10px 14px;border-radius:10px;margin-bottom:8px;
            background:${q.id === currentId ? 'rgba(56,239,125,.08)' : 'rgba(255,255,255,.04)'};
            border:1px solid ${q.id === currentId ? 'rgba(56,239,125,.3)' : 'rgba(255,255,255,.08)'};">
            <div>
              <div style="font-weight:600;font-size:.95rem;">${q.title || 'Sans titre'}</div>
              <div style="font-size:.75rem;color:rgba(255,255,255,.4);">${(q.rounds||[]).length} manche(s)</div>
            </div>
            ${q.id === currentId
              ? `<span style="font-size:.75rem;color:#38ef7d;">✓ Actuel</span>`
              : `<button class="hbtn hbtn-primary hbtn-sm" onclick="confirmChangeQuiz('${q.id}','${(q.title||'').replace(/'/g,"\\'")}')">Sélectionner</button>`}
          </div>`).join('')
      : '<p class="muted">Aucun quiz disponible</p>';
    const el = document.getElementById('change-quiz-list');
    if (el) el.innerHTML = listHtml;
  } catch (e) {
    const el = document.getElementById('change-quiz-list');
    if (el) el.innerHTML = `<p class="muted" style="color:#eb3349;">Erreur : ${e.message}</p>`;
  }
}
window.showChangeQuizModal = showChangeQuizModal;

function confirmChangeQuiz(quizId, quizTitle) {
  if (!confirm(`Changer le quiz pour "${quizTitle}" ?`)) return;
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  state.socket.emit('host:action', { sessionCode: sc, hostKey: hk, action: 'set_session_quiz', quizId }, (res) => {
    closeModal('change-quiz-modal');
    if (!res?.ok) { alert('Erreur : ' + (res?.error || 'Inconnue')); return; }
    renderHostGame();
  });
}
window.confirmChangeQuiz = confirmChangeQuiz;

// ── Modal de diffusion ─────────────────────────────────────────
function showBroadcastModal() {
  const sc = state.host.sessionCode;
  const playerOptions = state.players.map(p => `<option value="${p.id}">${p.pseudo}</option>`).join('');
  const teamOptions = state.teams.filter(t => state.players.some(p => p.teamId === t.id))
    .map(t => `<option value="team:${t.id}">${t.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'broadcast-modal';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="row" style="justify-content:space-between;margin-bottom:16px;">
        <h2>📡 Diffuser un message</h2>
        <button class="btn-secondary btn-sm" onclick="document.getElementById('broadcast-modal')?.remove()">✕</button>
      </div>
      <div style="margin-bottom:12px;">
        <label>Destinataire</label>
        <select id="bc-target">
          <option value="all">📢 Tous les joueurs</option>
          ${teamOptions ? `<optgroup label="Équipes">${teamOptions}</optgroup>` : ''}
          ${playerOptions ? `<optgroup label="Joueurs">${playerOptions}</optgroup>` : ''}
        </select>
      </div>
      <div style="margin-bottom:12px;">
        <label>Message texte</label>
        <textarea id="bc-text" rows="3" placeholder="Votre message…" style="resize:vertical;"></textarea>
      </div>
      <div style="margin-bottom:12px;">
        <label>Image / GIF (URL)</label>
        <input id="bc-image" type="url" placeholder="https://…">
      </div>
      <div id="bc-preview" style="margin-bottom:12px;"></div>
      <div class="row" style="gap:8px;">
        <button class="btn-primary" style="flex:1;" onclick="sendBroadcast()">📡 Envoyer</button>
        <button class="btn-secondary" style="flex:0 0 auto;" onclick="clearBroadcast()" title="Effacer le message diffusé">🗑 Effacer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Preview image
  document.getElementById('bc-image')?.addEventListener('input', function() {
    const prev = document.getElementById('bc-preview');
    if (prev) prev.innerHTML = this.value ? `<img src="${this.value}" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:contain;">` : '';
  });
}

function sendBroadcast() {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  const target = document.getElementById('bc-target')?.value || 'all';
  const text = (document.getElementById('bc-text')?.value || '').trim();
  const imageUrl = (document.getElementById('bc-image')?.value || '').trim();
  if (!text && !imageUrl) { alert('Message vide'); return; }

  state.socket.emit('host:action', {
    sessionCode: sc, hostKey: hk,
    action: 'broadcast_message',
    target, text, imageUrl,
  }, (res) => {
    if (!res?.ok) alert$('host-alert', res?.error || 'Diffusion impossible', 'error');
    else {
      alert$('host-alert', '✅ Message diffusé !', 'success');
      document.getElementById('broadcast-modal')?.remove();
    }
  });
}

function clearBroadcast() {
  const sc = state.host.sessionCode;
  const hk = state.host.hostKey;
  state.socket.emit('host:action', {
    sessionCode: sc, hostKey: hk,
    action: 'broadcast_clear',
  }, (res) => {
    if (res?.ok) {
      alert$('host-alert', '🗑 Message effacé', 'success');
      document.getElementById('broadcast-modal')?.remove();
    }
  });
}

// ── Utilitaires divers ───────────────────────────────────────
function copyToClipboard(text, alertId = '') {
  navigator.clipboard.writeText(text).then(() => {
    if (alertId) alert$(alertId, '📋 Lien copié !', 'success');
  }).catch(() => {
    if (alertId) alert$(alertId, 'Copie impossible', 'error');
  });
}

// ── Bootstrap ────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
// SYSTÈME DE THÈMES
// ════════════════════════════════════════════════════════════

const THEMES = {
  default: {
    label: '🌌 Default',
    name:  'Classique',
    brand: '🎮 Quiz Live',
    desc:  'Sombre & violet',
  },
  corporate: {
    label: '💼 Corporate',
    name:  'Corporate',
    brand: '📊 QuizzGeek Pro',
    desc:  'Enterprise SaaS',
  },
  party: {
    label: '🎉 Party',
    name:  'Party',
    brand: '🎉 QuizzGeek Party!',
    desc:  'Néons & fiesta',
  },
  tvshow: {
    label: '📺 TV Show',
    name:  'TV Show',
    brand: '⭐ QUIZZGEEK',
    desc:  'Dorée & dramatique',
  },
};

let _currentTheme = 'default';

function setTheme(themeKey) {
  if (!THEMES[themeKey]) themeKey = 'default';
  _currentTheme = themeKey;

  // Appliquer sur body
  document.body.setAttribute('data-theme', themeKey === 'default' ? '' : themeKey);

  // Mettre à jour le brand
  const brandEl = document.querySelector('.nav-brand');
  if (brandEl) brandEl.textContent = THEMES[themeKey].brand;

  // Sauvegarder
  try { localStorage.setItem('quiz_theme', themeKey); } catch(e) {}

  // Jouer un son de confirmation de thème
  playSound('nav');

  // Mettre à jour le picker si visible
  renderThemePicker();
}

function renderThemePicker() {
  const container = document.getElementById('theme-picker-container');
  if (!container) return;

  const entries = Object.entries(THEMES);
  container.innerHTML = entries.map(([key, t]) => `
    <button
      onclick="setTheme('${key}');closeThemePicker();"
      style="
        display:flex;align-items:center;gap:12px;
        width:100%;padding:12px 14px;border-radius:10px;
        border:${_currentTheme===key ? '2px solid rgba(240,147,251,0.8)' : '1px solid rgba(255,255,255,0.1)'};
        background:${_currentTheme===key ? 'rgba(240,147,251,0.12)' : 'rgba(255,255,255,0.05)'};
        cursor:pointer;text-align:left;color:#fff;font-family:inherit;
        transition:all 0.15s;margin-bottom:6px;
      "
      onmouseover="this.style.background='rgba(255,255,255,0.1)'"
      onmouseout="this.style.background='${_currentTheme===key ? 'rgba(240,147,251,0.12)' : 'rgba(255,255,255,0.05)'}'">
      <span style="font-size:1.5rem;">${t.label.split(' ')[0]}</span>
      <div>
        <div style="font-weight:700;font-size:.92rem;">${t.name}${_currentTheme===key ? ' ✓' : ''}</div>
        <div style="font-size:.75rem;opacity:.55;">${t.desc}</div>
      </div>
    </button>`).join('');
}

function openThemePicker() {
  if (document.getElementById('theme-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'theme-modal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:500;
    display:flex;align-items:center;justify-content:center;padding:20px;
  `;
  modal.innerHTML = `
    <div style="
      background:#1a1740;border:1px solid rgba(255,255,255,.15);
      border-radius:18px;padding:22px;width:100%;max-width:380px;
    ">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <h3 style="margin:0;font-size:1.1rem;">🎨 Choisir un thème</h3>
        <button onclick="closeThemePicker()" style="
          background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);
          border-radius:8px;color:#fff;padding:5px 10px;cursor:pointer;font-size:.85rem;
          font-family:inherit;font-weight:600;
        ">✕</button>
      </div>
      <div id="theme-picker-container"></div>
      <p style="margin-top:14px;font-size:.72rem;color:rgba(255,255,255,.35);text-align:center;">
        Le thème s'applique à tous les écrans (joueur, host, display)
      </p>
    </div>`;
  modal.addEventListener('click', (e) => { if (e.target === modal) closeThemePicker(); });
  document.body.appendChild(modal);
  renderThemePicker();
}

function closeThemePicker() {
  const el = document.getElementById('theme-modal');
  if (el) el.remove();
}

// (anciens sons thématiques Web Audio API supprimés — remplacés par MP3)

document.addEventListener('DOMContentLoaded', () => {
  // Charger le thème sauvegardé
  try {
    const savedTheme = localStorage.getItem('quiz_theme') || 'default';
    if (savedTheme && savedTheme !== 'default') {
      _currentTheme = savedTheme;
      document.body.setAttribute('data-theme', savedTheme);
      const brandEl = document.querySelector('.nav-brand');
      if (brandEl) brandEl.textContent = THEMES[savedTheme]?.brand || '🎮 Quiz Live';
    }
  } catch(e) {}

  // Ajouter le bouton thème dans la nav
  const nav = document.querySelector('nav');
  if (nav) {
    const themeBtn = document.createElement('button');
    themeBtn.id = 'theme-toggle-btn';
    themeBtn.innerHTML = '🎨';
    themeBtn.title = 'Changer de thème';
    themeBtn.style.cssText = 'margin-left:auto;flex-shrink:0;padding:6px 10px;font-size:1rem;';
    themeBtn.onclick = openThemePicker;
    nav.appendChild(themeBtn);
  }

  initSocket();

  // ── Feedback visuel global sur les boutons .hbtn ──────────────
  // Ajoute brièvement la classe .hbtn-clicked sur tout bouton cliqué
  // pour confirmer visuellement que l'action a bien été prise en compte.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.hbtn, .btn-primary, .btn-secondary, .btn-success, .btn-danger, .btn-warning, .btn-outline-danger, .btn-sm');
    if (!btn || btn.disabled) return;
    btn.classList.remove('hbtn-clicked'); // reset si déjà en cours
    void btn.offsetWidth; // force reflow pour relancer l'animation
    btn.classList.add('hbtn-clicked');
    btn.addEventListener('animationend', () => btn.classList.remove('hbtn-clicked'), { once: true });
  }, { capture: true });

  // Navigation hash
  const hash = window.location.hash.replace('#', '') || 'home';
  const _urlParams = new URLSearchParams(window.location.search);
  const urlCode = _urlParams.get('join');
  const urlDisplayCode = _urlParams.get('display-session');
  // Priorité : ?join → player | ?display-session → display | #hash → page
  navigate(urlCode ? 'player' : urlDisplayCode ? 'display' : hash);

  // Écouter les changements de hash
  window.addEventListener('hashchange', () => {
    const h = window.location.hash.replace('#', '') || 'home';
    navigate(h);
  });
});
