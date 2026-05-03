import { useState } from 'react';
import { html, uid, emptyRound, emptyQuestion, ROUND_TYPES, resolveMedia, mediaKind } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert } from '../../components/ui.js';

const Q_TYPES = [
  { value: 'qcm',       label: 'QCM (4 options)' },
  { value: 'true_false',label: 'Vrai / Faux' },
  { value: 'rapidite',  label: 'Buzzer / rapidite' },
  { value: 'vote',      label: 'Vote' },
  { value: 'free',      label: 'Reponse libre' },
  { value: 'burger',    label: 'Burger de la mort' },
  { value: 'video_challenge', label: 'Challenge video' },
];


function MediaPreview({ url }) {
  if (!url) return null;
  const src = resolveMedia(url);
  const kind = mediaKind(src);
  // key=src : React re-monte l'élément si l'URL change → réinitialise le display:none éventuel
  const hide = e => { e.currentTarget.style.display = 'none'; };
  if (kind === 'video') return html`
    <video key=${src} src=${src} muted playsInline onError=${hide}
      className="w-full max-h-28 rounded-lg object-cover border border-white/10"
    />
  `;
  if (kind === 'audio') return html`
    <audio key=${src} src=${src} controls onError=${hide}
      className="w-full h-9"
      style=${{ colorScheme: 'dark' }}
    />
  `;
  return html`
    <img key=${src} src=${src} alt="apercu" onError=${hide}
      className="h-16 rounded-lg object-cover border border-white/10"
    />
  `;
}

function MediaField({ label, value, onChange, accept = 'image/*,audio/*,video/*', placeholder = '/uploads/...' }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const uploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/uploads/media', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || 'Upload impossible');
      onChange(data.file?.mediaUrl || data.file?.url || '');
    } catch (e) {
      setErr(e.message || 'Upload impossible');
    } finally {
      setUploading(false);
    }
  };

  return html`
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      ${label && html`<label className="text-xs font-semibold text-white/50 uppercase tracking-wider">${label}</label>`}
      <div className="flex items-center gap-2 min-w-0">
        <input
          type="text"
          value=${value || ''}
          onInput=${e => onChange(e.target.value)}
          placeholder=${placeholder}
          className="min-w-0 flex-1 bg-bg-input border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[40px]"
        />
        <label className="flex-shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-lg app-panel border border-white/10 text-white/70 text-xs font-bold cursor-pointer hover:border-accent/50 hover:text-white transition-colors min-h-[40px]">
          ${uploading ? '⏳' : '↑'}
          <input type="file" accept=${accept} className="hidden" onChange=${e => uploadFile(e.target.files?.[0])} />
        </label>
      </div>
      ${value && html`
        <div className="media-preview-wrap overflow-hidden">
          <${MediaPreview} url=${value} />
        </div>
      `}
      ${err && html`<span className="text-xs text-rose-300">${err}</span>`}
    </div>
  `;
}

function QuestionRow({ q, qi, onUpdate, onDelete, roundType }) {
  const [open, setOpen] = useState(false);

  const upd = (key, val) => onUpdate({ ...q, [key]: val });
  const updOpt = (oi, key, val) => {
    const opts = [...(q.options || [])];
    opts[oi] = { ...opts[oi], [key]: val };
    onUpdate({ ...q, options: opts });
  };
  const changeType = (type) => {
    const next = { ...q, type };
    if (type === 'true_false') {
      next.options = [
        { id: uid('opt'), text: 'Vrai', mediaUrl: '' },
        { id: uid('opt'), text: 'Faux', mediaUrl: '' },
      ];
      next.correctOptionIndex = Math.min(Number(q.correctOptionIndex || 0), 1);
    } else if (type === 'qcm' && !(q.options || []).length) {
      next.options = emptyQuestion('qcm').options;
      next.correctOptionIndex = 0;
    } else if (!['qcm', 'true_false'].includes(type)) {
      next.options = [];
    }
    if (type === 'burger' && !(q.items || []).length) next.items = emptyQuestion('burger').items;
    onUpdate(next);
  };

  const LABELS = ['A','B','C','D'];

  return html`
    <div className="rounded-lg overflow-hidden transition-all duration-150"
         style=${{ background: 'rgba(12,16,32,0.82)', border: `1px solid ${open ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.07)'}` }}>
      <!-- Row header -->
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
        onClick=${() => setOpen(!open)}
      >
        <span className=${`font-mono text-sm flex-shrink-0 w-6 transition-colors ${open ? 'text-neon-blue' : 'text-white/30'}`}>${qi+1}.</span>
        <p className="flex-1 text-sm text-white/80 truncate">${q.content || html`<em className="text-white/25">Question sans titre</em>`}</p>
        <span className="text-white/25 text-xs flex-shrink-0">${q.type || 'qcm'}</span>
        <div className="flex gap-1 flex-shrink-0 items-center">
          <button
            onClick=${e => { e.stopPropagation(); onDelete(); }}
            className="text-white/25 hover:text-rose-400 transition-colors text-sm px-1.5"
          >Suppr.</button>
          <span className=${`text-xs transition-colors ${open ? 'text-neon-blue/70' : 'text-white/25'}`}>${open ? '▲' : '▼'}</span>
        </div>
      </div>

      <!-- Row content (expanded) -->
      ${open && html`
        <div className="px-4 pb-4 border-t border-white/8 pt-4 flex flex-col gap-4" style=${{ background: 'rgba(4,6,14,0.6)' }}>

          <!-- Question text -->
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Question</label>
            <textarea
              value=${q.content || ''}
              onInput=${e => upd('content', e.target.value)}
              rows="2"
              placeholder="Enonce de la question..."
              className="bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-base placeholder-white/25 focus:border-accent/60 outline-none transition-colors resize-y"
            />
          </div>

          <${MediaField}
            label="Televerser / remplacer le media"
            value=${q.mediaUrl || ''}
            onChange=${v => upd('mediaUrl', v)}
            placeholder="https://... ou /uploads/..."
          />

          ${roundType === 'video_challenge' && html`
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <${MediaField}
                label="Video d'entrainement"
                value=${q.trainingVideoUrl || ''}
                onChange=${v => upd('trainingVideoUrl', v)}
                accept="video/*"
                placeholder="/uploads/entrainement.mp4"
              />
              <${MediaField}
                label="Video du challenge"
                value=${q.videoUrl || ''}
                onChange=${v => upd('videoUrl', v)}
                accept="video/*"
                placeholder="/uploads/challenge.mp4"
              />
            </div>
          `}

          <!-- Type + Timer -->
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Type</label>
              <select
                value=${q.type || 'qcm'}
                onChange=${e => changeType(e.target.value)}
                className="bg-bg-input border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:border-accent/60 outline-none transition-colors min-h-[42px] cursor-pointer"
              >
                ${Q_TYPES.map(t => html`<option key=${t.value} value=${t.value}>${t.label}</option>`)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Chrono (sec)</label>
              <input
                type="number"
                value=${q.timer ?? 30}
                onInput=${e => upd('timer', parseInt(e.target.value) || 30)}
                min="5" max="300"
                className="bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
          </div>

          <!-- Options (QCM / True-False) -->
          ${(q.type === 'qcm' || q.type === 'true_false' || !q.type) && (q.options || []).length > 0 && html`
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Options
                <span className="text-white/25 font-normal ml-1">(cliquer pour marquer la bonne reponse)</span>
              </label>
              ${(q.options || []).map((opt, oi) => html`
                <div key=${oi} className="flex flex-col gap-1.5 bg-white/3 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick=${() => upd('correctOptionIndex', oi)}
                      className=${`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black transition-all ${q.correctOptionIndex === oi ? 'bg-neon-green/20 border-2 border-neon-green/60 text-neon-green' : 'bg-white/5 border-2 border-transparent text-white/30 hover:border-white/20'}`}
                    >
                      ${LABELS[oi] || oi+1}
                    </button>
                    <input
                      type="text"
                      value=${opt.text || ''}
                      onInput=${e => updOpt(oi, 'text', e.target.value)}
                      placeholder=${`Option ${LABELS[oi] || oi+1}...`}
                      className="flex-1 bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
                    />
                  </div>
                  <div className="flex items-center gap-2 pl-12">
                    <${MediaField}
                      value=${opt.mediaUrl || ''}
                      onChange=${v => updOpt(oi, 'mediaUrl', v)}
                      accept="image/*"
                      placeholder="Image de l'option"
                    />
                  </div>
                </div>
              `)}
            </div>
          `}

          <!-- Correct answer (free text) -->
          ${(q.type === 'free' || q.type === 'burger') && html`
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Reponse attendue</label>
              <input
                type="text"
                value=${q.correctAnswer || ''}
                onInput=${e => upd('correctAnswer', e.target.value)}
                placeholder="Reponse correcte..."
                className="bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
          `}

          ${q.type === 'burger' && html`
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Liste des questions / ingredients</label>
              ${(q.items || []).map((item, ii) => html`
                <input
                  key=${item.id || ii}
                  type="text"
                  value=${item?.text || item || ''}
                  onInput=${e => {
                    const items = [...(q.items || [])];
                    items[ii] = { ...(typeof item === 'object' ? item : {}), id: item?.id || uid('item'), text: e.target.value };
                    upd('items', items);
                  }}
                  placeholder=${`Element ${ii + 1}`}
                  className="bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
                />
              `)}
              <button
                onClick=${() => upd('items', [...(q.items || []), { id: uid('item'), text: '', mediaUrl: '' }])}
                className="py-2 rounded-xl border border-dashed border-amber-500/30 text-amber-300/80 hover:bg-amber-500/10 text-sm font-bold"
              >
                + Ajouter un element
              </button>
            </div>
          `}

          <!-- Points -->
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Points</label>
            <input
              type="number"
              value=${q.points ?? 100}
              onInput=${e => upd('points', parseInt(e.target.value) || 100)}
              min="0" max="9999"
              className="bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:border-accent/60 outline-none transition-colors min-h-[42px]"
            />
          </div>

        </div>
      `}
    </div>
  `;
}

function RoundPanel({ round, ri, onUpdate, onDelete }) {
  const [open, setOpen] = useState(true);
  const rt = ROUND_TYPES[round.type] || { icon: '🎯', label: round.type };

  const upd = (key, val) => onUpdate({ ...round, [key]: val });

  const addQuestion = () => {
    const qTypeByRound = {
      true_false: 'true_false',
      rapidite: 'rapidite',
      speed: 'rapidite',
      vote: 'vote',
      burger: 'burger',
      video_challenge: 'video_challenge',
    };
    const q = emptyQuestion(qTypeByRound[round.type] || 'qcm');
    if (round.type === 'true_false') {
      q.options = [
        { id: uid('opt'), text: 'Vrai',  mediaUrl: '' },
        { id: uid('opt'), text: 'Faux',  mediaUrl: '' },
      ];
      q.correctOptionIndex = 0;
    }
    onUpdate({ ...round, questions: [...(round.questions || []), q] });
  };

  const updateQ = (qi, q) => {
    const qs = [...(round.questions || [])];
    qs[qi] = q;
    onUpdate({ ...round, questions: qs });
  };

  const deleteQ = (qi) => {
    if (!confirm('Supprimer cette question ?')) return;
    const qs = (round.questions || []).filter((_, i) => i !== qi);
    onUpdate({ ...round, questions: qs });
  };

  return html`
    <div className=${`rounded-xl overflow-hidden transition-all duration-200 ${open ? 'ring-1 ring-accent/30 shadow-lg shadow-black/30' : 'app-surface'}`}
         style=${open ? { background: 'linear-gradient(180deg, rgba(124,92,255,0.07), rgba(255,255,255,0.03))', border: '1px solid rgba(124,92,255,0.22)' } : {}}>
      <!-- Round header -->
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/3 transition-colors"
        onClick=${() => setOpen(!open)}
      >
        <span className="text-2xl">${rt.icon}</span>
        <div className="flex-1 min-w-0">
          <div className=${`font-bold text-sm transition-colors ${open ? 'text-white' : 'text-white/90'}`}>${round.title || `Manche ${ri+1}`}</div>
          <div className="text-xs text-white/40 mt-0.5">${rt.label} · ${(round.questions||[]).length} question(s)</div>
        </div>
        <div className="flex gap-2 flex-shrink-0 items-center">
          <button
            onClick=${e => { e.stopPropagation(); onDelete(); }}
            className="text-white/20 hover:text-rose-400 transition-colors text-sm px-1.5"
          >Suppr.</button>
          <span className=${`text-xs transition-colors ${open ? 'text-accent/80' : 'text-white/30'}`}>${open ? '▲' : '▼'}</span>
        </div>
      </div>

      ${open && html`
        <div className="px-5 pb-5 border-t border-white/8 pt-5 flex flex-col gap-5" style=${{ background: 'rgba(6,8,18,0.55)' }}>

          <!-- Round settings -->
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <${MediaField}
              label="Fond debut / manche"
              value=${round.backgroundUrl || ''}
              onChange=${v => upd('backgroundUrl', v)}
              accept="image/*"
              placeholder="/uploads/fond.jpg"
            />
            <${MediaField}
              label="Musique debut"
              value=${round.introMusicUrl || round.musicUrl || ''}
              onChange=${v => upd('introMusicUrl', v)}
              accept="audio/*"
              placeholder="/uploads/intro.mp3"
            />
            <${MediaField}
              label="Musique en cours"
              value=${round.gameMusicUrl || ''}
              onChange=${v => upd('gameMusicUrl', v)}
              accept="audio/*"
              placeholder="/uploads/jeu.mp3"
            />
            <${MediaField}
              label="Musique fin"
              value=${round.endMusicUrl || ''}
              onChange=${v => upd('endMusicUrl', v)}
              accept="audio/*"
              placeholder="/uploads/fin.mp3"
            />
          </div>

          ${round.type === 'video_challenge' && html`
            <${MediaField}
              label="Video d'entrainement de manche"
              value=${round.trainingVideoUrl || ''}
              onChange=${v => upd('trainingVideoUrl', v)}
              accept="video/*"
              placeholder="/uploads/entrainement.mp4"
            />
          `}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Titre de la manche</label>
              <input
                type="text"
                value=${round.title || ''}
                onInput=${e => upd('title', e.target.value)}
                placeholder="ex: Manche 1 - Culture G"
                className="bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Type de manche</label>
              <select
                value=${round.type || 'qcm'}
                onChange=${e => upd('type', e.target.value)}
                className="bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-accent/60 outline-none transition-colors min-h-[42px] cursor-pointer"
              >
                ${Object.entries(ROUND_TYPES).map(([v, r]) => html`
                  <option key=${v} value=${v}>${r.icon} ${r.label}</option>
                `)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Description courte</label>
              <input
                type="text"
                value=${round.shortRules || ''}
                onInput=${e => upd('shortRules', e.target.value)}
                placeholder="Resume des regles..."
                className="bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Musique (URL)</label>
              <input
                type="text"
                value=${round.musicUrl || ''}
                onInput=${e => upd('musicUrl', e.target.value)}
                placeholder="/sounds/... ou https://..."
                className="bg-bg-input border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
          </div>

          <!-- Questions -->
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/6">
              <span className="text-sm font-semibold text-neon-blue/80 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-neon-blue/60 inline-block"></span>
                Questions
                <span className="text-white/30 font-normal">(${(round.questions||[]).length})</span>
              </span>
            </div>
            <div className="flex flex-col gap-2">
              ${(round.questions || []).map((q, qi) => html`
                <${QuestionRow}
                  key=${q.id || qi}
                  q=${q}
                  qi=${qi}
                  roundType=${round.type}
                  onUpdate=${(nq) => updateQ(qi, nq)}
                  onDelete=${() => deleteQ(qi)}
                />
              `)}
            </div>
            <button
              onClick=${addQuestion}
              className="mt-3 w-full py-3.5 rounded-lg border-2 border-dashed border-accent/30 text-accent/70 hover:border-accent/60 hover:text-accent hover:bg-accent/5 transition-all text-sm font-bold flex items-center justify-center gap-2"
            >
              + Ajouter une question
            </button>
          </div>

        </div>
      `}
    </div>
  `;
}

export default function QuizEditor({ onBack }) {
  const { editingQuiz, setEditingQuiz, apiFetch, setAdminQuizzes, navigate } = useGame();
  const [alert,   setAlert]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  if (!editingQuiz) return null;

  const q = editingQuiz;
  const updQ = (key, val) => setEditingQuiz({ ...q, [key]: val });

  const addRound = () => {
    const r = emptyRound();
    r.title = `Manche ${(q.rounds || []).length + 1}`;
    setEditingQuiz({ ...q, rounds: [...(q.rounds || []), r] });
  };

  const updateRound = (ri, round) => {
    const rounds = [...(q.rounds || [])];
    rounds[ri] = round;
    setEditingQuiz({ ...q, rounds });
  };

  const deleteRound = (ri) => {
    if (!confirm('Supprimer cette manche ?')) return;
    setEditingQuiz({ ...q, rounds: (q.rounds || []).filter((_, i) => i !== ri) });
  };

  const save = async () => {
    if (!q.title?.trim()) { setAlert({ type: 'error', message: 'Titre du quiz requis.' }); return; }
    setSaving(true);
    setAlert(null);
    try {
      const isNew = !q.id || q.id.startsWith('quiz_q_') && !(await checkExists(q.id));
      const method = isNew ? 'POST' : 'PUT';
      const path   = isNew ? '/api/quizzes' : `/api/quizzes/${q.id}`;
      const d = await apiFetch(path, { method, body: JSON.stringify({ quiz: q }) });
      if (!d.ok) { setAlert({ type: 'error', message: d.error || 'Erreur sauvegarde.' }); return; }
      // Refresh quiz list
      const all = await apiFetch('/api/quizzes');
      setAdminQuizzes(all.quizzes || []);
      setAlert({ type: 'success', message: 'Quiz sauvegarde !' });
    } catch (e) {
      setAlert({ type: 'error', message: 'Erreur reseau : ' + e.message });
    } finally {
      setSaving(false);
    }
  };

  const checkExists = async (id) => {
    try { const d = await apiFetch(`/api/quizzes/${id}`); return !!d.quiz; } catch { return false; }
  };

  return html`
    <div className="flex flex-col min-h-[100dvh] bg-bg-alt">

      <!-- Sticky header -->
      <div className="sticky top-0 z-20 bg-bg-alt border-b border-white/8 px-4 py-3 flex items-center gap-3">
        <button
          onClick=${onBack}
          className="text-sm font-semibold text-white/50 hover:text-white transition-colors flex items-center gap-1.5"
        >
          ← Liste des quiz
        </button>
        <div className="flex-1 text-base font-bold text-white/80 truncate">${q.title || 'Nouveau quiz'}</div>
        <${Btn} variant="success" size="sm" onClick=${save} disabled=${saving}>
          ${saving ? '...' : 'Sauvegarder'}
        <//>
      </div>

      <!-- Content -->
      <div className="flex-1 px-4 py-5 max-w-3xl mx-auto w-full flex flex-col gap-6">

        ${alert && html`<${Alert} type=${alert.type} message=${alert.message} />`}

        <!-- Quiz meta -->
        <div className="rounded-lg app-surface p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider">Informations generales</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Titre du quiz</label>
            <input
              type="text"
              value=${q.title || ''}
              onInput=${e => updQ('title', e.target.value)}
              placeholder="ex: Quiz Famille - Mai 2026"
              className="bg-bg-input border border-white/10 rounded-lg px-4 py-3 text-white text-lg font-bold placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[52px]"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <${MediaField}
              label="Image d'accueil"
              value=${q.welcomeImageUrl || ''}
              onChange=${v => updQ('welcomeImageUrl', v)}
              accept="image/*"
              placeholder="/uploads/accueil.jpg"
            />
            <${MediaField}
              label="Musique d'accueil"
              value=${q.welcomeMusicUrl || ''}
              onChange=${v => updQ('welcomeMusicUrl', v)}
              accept="audio/*"
              placeholder="/uploads/accueil.mp3"
            />
            <${MediaField}
              label="Fond ceremonie"
              value=${q.closingCeremony?.backgroundUrl || q.ceremonyBackgroundUrl || ''}
              onChange=${v => updQ('closingCeremony', { ...(q.closingCeremony || {}), backgroundUrl: v })}
              accept="image/*"
              placeholder="/uploads/ceremonie.jpg"
            />
            <${MediaField}
              label="Musique ceremonie"
              value=${q.closingCeremony?.musicUrl || q.ceremonyMusicUrl || ''}
              onChange=${v => updQ('closingCeremony', { ...(q.closingCeremony || {}), musicUrl: v })}
              accept="audio/*"
              placeholder="/uploads/ceremonie.mp3"
            />
          </div>
        </div>

        <!-- Rounds -->
        <div>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/8">
            <h2 className="text-base font-bold text-white/90 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-accent/70 inline-block"></span>
              Manches
              <span className="text-white/35 font-normal text-sm">(${(q.rounds||[]).length})</span>
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            ${(q.rounds || []).map((round, ri) => html`
              <${RoundPanel}
                key=${round.id || ri}
                round=${round}
                ri=${ri}
                onUpdate=${(r) => updateRound(ri, r)}
                onDelete=${() => deleteRound(ri)}
              />
            `)}
          </div>
          <button
            onClick=${addRound}
            className="mt-4 w-full py-4 rounded-lg border-2 border-dashed border-violet-500/30 text-violet-400/70 hover:border-violet-500/60 hover:text-violet-400 hover:bg-violet-500/5 transition-all font-bold flex items-center justify-center gap-2 text-sm"
          >
            + Ajouter une manche
          </button>
        </div>

        <!-- Bottom save -->
        <div className="flex gap-3 pb-8">
          <${Btn} variant="success" wide pulse onClick=${save} disabled=${saving}>
            ${saving ? 'Sauvegarde...' : 'Sauvegarder le quiz'}
          <//>
          <${Btn} variant="secondary" onClick=${onBack}>Annuler<//>
        </div>

      </div>
    </div>
  `;
}

