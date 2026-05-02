import { useState, useCallback } from 'react';
import { html, uid, emptyRound, emptyQuestion, ROUND_TYPES, resolveMedia } from '../../utils.js';
import { useGame } from '../../contexts/GameContext.js';
import { Btn, Alert, Badge } from '../../components/ui.js';

const Q_TYPES = [
  { value: 'qcm',       label: 'QCM (4 options)' },
  { value: 'true_false',label: 'Vrai / Faux' },
  { value: 'free',      label: 'Réponse libre' },
  { value: 'burger',    label: 'Burger de la mort' },
];

const SCORING_MODES   = [{ value:'auto', label:'Auto' },{ value:'manual', label:'Manuel' }];
const SCORING_TARGETS = [{ value:'individual', label:'Individuel' },{ value:'team', label:'Équipe' }];

function QuestionRow({ q, qi, onUpdate, onDelete, roundType }) {
  const [open, setOpen] = useState(false);

  const upd = (key, val) => onUpdate({ ...q, [key]: val });
  const updOpt = (oi, key, val) => {
    const opts = [...(q.options || [])];
    opts[oi] = { ...opts[oi], [key]: val };
    onUpdate({ ...q, options: opts });
  };

  const LABELS = ['A','B','C','D'];

  return html`
    <div className="rounded-xl border border-white/8 bg-bg-card overflow-hidden">
      <!-- Row header -->
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
        onClick=${() => setOpen(!open)}
      >
        <span className="text-white/30 font-mono text-sm flex-shrink-0 w-6">${qi+1}.</span>
        <p className="flex-1 text-sm text-white/80 truncate">${q.content || html`<em className="text-white/25">Question sans titre</em>`}</p>
        <span className="text-white/25 text-xs flex-shrink-0">${q.type || 'qcm'}</span>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick=${e => { e.stopPropagation(); onDelete(); }}
            className="text-white/25 hover:text-rose-400 transition-colors text-sm px-1.5"
          >🗑</button>
          <span className="text-white/25 text-sm">${open ? '▲' : '▼'}</span>
        </div>
      </div>

      <!-- Row content (expanded) -->
      ${open && html`
        <div className="px-4 pb-4 border-t border-white/5 pt-4 flex flex-col gap-4">

          <!-- Question text -->
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Question</label>
            <textarea
              value=${q.content || ''}
              onInput=${e => upd('content', e.target.value)}
              rows="2"
              placeholder="Énoncé de la question…"
              className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-base placeholder-white/25 focus:border-accent/60 outline-none transition-colors resize-y"
            />
          </div>

          <!-- Media URL + preview -->
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Image / Vidéo (URL)</label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value=${q.mediaUrl || ''}
                onInput=${e => upd('mediaUrl', e.target.value)}
                placeholder="https://… ou /pictures/…"
                className="flex-1 bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
              ${q.mediaUrl && html`
                <img
                  src=${resolveMedia(q.mediaUrl)}
                  alt="aperçu"
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-white/15"
                  onError=${e => { e.target.style.display='none'; }}
                />
              `}
            </div>
          </div>

          <!-- Type + Timer -->
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Type</label>
              <select
                value=${q.type || 'qcm'}
                onChange=${e => upd('type', e.target.value)}
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
                className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
          </div>

          <!-- Options (QCM / True-False) -->
          ${(q.type === 'qcm' || q.type === 'true_false' || !q.type) && (q.options || []).length > 0 && html`
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Options
                <span className="text-white/25 font-normal ml-1">(cliquer pour marquer la bonne réponse)</span>
              </label>
              ${(q.options || []).map((opt, oi) => html`
                <div key=${oi} className="flex flex-col gap-1.5 bg-white/3 rounded-xl p-3 border border-white/5">
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
                      placeholder=${`Option ${LABELS[oi] || oi+1}…`}
                      className="flex-1 bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
                    />
                  </div>
                  <div className="flex items-center gap-2 pl-12">
                    <input
                      type="text"
                      value=${opt.mediaUrl || ''}
                      onInput=${e => updOpt(oi, 'mediaUrl', e.target.value)}
                      placeholder="Image de l'option (URL ou /pictures/…)"
                      className="flex-1 bg-bg-input border border-white/8 rounded-lg px-3 py-1.5 text-white text-xs placeholder-white/20 focus:border-accent/50 outline-none transition-colors"
                    />
                    ${opt.mediaUrl && html`
                      <img
                        src=${resolveMedia(opt.mediaUrl)}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10"
                        onError=${e => { e.target.style.display='none'; }}
                      />
                    `}
                  </div>
                </div>
              `)}
            </div>
          `}

          <!-- Correct answer (free text) -->
          ${(q.type === 'free' || q.type === 'burger') && html`
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Réponse attendue</label>
              <input
                type="text"
                value=${q.correctAnswer || ''}
                onInput=${e => upd('correctAnswer', e.target.value)}
                placeholder="Réponse correcte…"
                className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
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
              className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm font-mono focus:border-accent/60 outline-none transition-colors min-h-[42px]"
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
    const q = emptyQuestion(round.type === 'true_false' ? 'true_false' : round.type === 'vote' ? 'free' : 'qcm');
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
    <div className="rounded-2xl border border-white/10 bg-bg-alt overflow-hidden">
      <!-- Round header -->
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/3 transition-colors"
        onClick=${() => setOpen(!open)}
      >
        <span className="text-2xl">${rt.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-white/90">${round.title || `Manche ${ri+1}`}</div>
          <div className="text-xs text-white/35 mt-0.5">${rt.label} · ${(round.questions||[]).length} question(s)</div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick=${e => { e.stopPropagation(); onDelete(); }}
            className="text-white/20 hover:text-rose-400 transition-colors text-sm px-1.5"
          >🗑</button>
          <span className="text-white/30">${open ? '▲' : '▼'}</span>
        </div>
      </div>

      ${open && html`
        <div className="px-5 pb-5 border-t border-white/5 pt-4 flex flex-col gap-5">

          <!-- Round settings -->
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Titre de la manche</label>
              <input
                type="text"
                value=${round.title || ''}
                onInput=${e => upd('title', e.target.value)}
                placeholder="ex: Manche 1 — Culture G"
                className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Type de manche</label>
              <select
                value=${round.type || 'qcm'}
                onChange=${e => upd('type', e.target.value)}
                className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-accent/60 outline-none transition-colors min-h-[42px] cursor-pointer"
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
                placeholder="Résumé des règles…"
                className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wider">Musique (URL)</label>
              <input
                type="text"
                value=${round.musicUrl || ''}
                onInput=${e => upd('musicUrl', e.target.value)}
                placeholder="/sounds/… ou https://…"
                className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
          </div>

          <!-- Questions -->
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white/60">
                Questions <span className="text-white/30">(${(round.questions||[]).length})</span>
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
              className="mt-3 w-full py-3.5 rounded-xl border-2 border-dashed border-accent/30 text-accent/70 hover:border-accent/60 hover:text-accent hover:bg-accent/5 transition-all text-sm font-bold flex items-center justify-center gap-2"
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
      setAlert({ type: 'success', message: '✅ Quiz sauvegardé !' });
    } catch (e) {
      setAlert({ type: 'error', message: 'Erreur réseau : ' + e.message });
    } finally {
      setSaving(false);
    }
  };

  const checkExists = async (id) => {
    try { const d = await apiFetch(`/api/quizzes/${id}`); return !!d.quiz; } catch { return false; }
  };

  return html`
    <div className="flex flex-col min-h-[100dvh] bg-bg">

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
          ${saving ? '⏳' : '💾 Sauvegarder'}
        <//>
      </div>

      <!-- Content -->
      <div className="flex-1 px-4 py-5 max-w-3xl mx-auto w-full flex flex-col gap-6">

        ${alert && html`<${Alert} type=${alert.type} message=${alert.message} />`}

        <!-- Quiz meta -->
        <div className="rounded-2xl border border-white/10 bg-bg-card p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider">Informations générales</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-white/70">Titre du quiz</label>
            <input
              type="text"
              value=${q.title || ''}
              onInput=${e => updQ('title', e.target.value)}
              placeholder="ex: Quiz Famille — Mai 2025"
              className="bg-bg-input border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-bold placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[52px]"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Image d'accueil (URL)</label>
              <input
                type="text"
                value=${q.welcomeImageUrl || ''}
                onInput=${e => updQ('welcomeImageUrl', e.target.value)}
                placeholder="https://… ou /pictures/…"
                className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-white/70">Musique d'accueil (URL)</label>
              <input
                type="text"
                value=${q.welcomeMusicUrl || ''}
                onInput=${e => updQ('welcomeMusicUrl', e.target.value)}
                placeholder="/sounds/… ou https://…"
                className="bg-bg-input border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:border-accent/60 outline-none transition-colors min-h-[42px]"
              />
            </div>
          </div>
        </div>

        <!-- Rounds -->
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white/80">
              Manches <span className="text-white/30 font-medium">({(q.rounds||[]).length})</span>
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
            className="mt-4 w-full py-4 rounded-2xl border-2 border-dashed border-violet-500/30 text-violet-400/70 hover:border-violet-500/60 hover:text-violet-400 hover:bg-violet-500/5 transition-all font-bold flex items-center justify-center gap-2 text-sm"
          >
            + Ajouter une manche
          </button>
        </div>

        <!-- Bottom save -->
        <div className="flex gap-3 pb-8">
          <${Btn} variant="success" wide pulse onClick=${save} disabled=${saving}>
            ${saving ? '⏳ Sauvegarde…' : '💾 Sauvegarder le quiz'}
          <//>
          <${Btn} variant="secondary" onClick=${onBack}>Annuler<//>
        </div>

      </div>
    </div>
  `;
}
