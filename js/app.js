// Pegamento entre el motor de repetición, el almacenamiento y la pantalla.

import {
  DEFAULT_LOOKAHEAD_MS,
  GRADE_LABELS,
  buildQueue,
  counts,
  emptyQueueReason,
  formatDelay,
  nextAvailableAt,
  nowMs,
  previewIntervals,
  review,
} from './srs.js';
import * as store from './store.js';
import { parseInput } from './parse.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const ui = {
  view: 'study',
  deckId: null, // null = todos los mazos
  card: null,
  revealed: false,
  lastCardId: null,
  editing: null,
};

// Si lo próximo entra dentro de esta ventana, la pantalla vacía se refresca
// sola en lugar de quedarse mintiendo (RF-407).
const AUTO_REFRESH_MAX_MS = 30 * 60 * 1000;
let refreshTimer = null;

// --- Utilidades ----------------------------------------------------------

function deckCards() {
  return store.cards(ui.deckId);
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 2200);
}

function feedback(el, message, kind = '') {
  el.textContent = message;
  el.className = `feedback ${kind}`.trim();
}

// --- Navegación ----------------------------------------------------------

function showView(name) {
  ui.view = name;
  $$('.view').forEach((v) => v.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  if (name === 'study') renderStudy();
  if (name === 'cards') renderCardList();
  if (name === 'settings') renderSettings();
}

// --- Cabecera ------------------------------------------------------------

/** @spec RF-108 */
function renderDeckSelect() {
  const select = $('#deck-select');
  const decks = store.decks();
  select.innerHTML = '';
  const all = new Option('Todos los mazos', '');
  select.append(all);
  for (const deck of decks) {
    select.append(new Option(deck.name, deck.id));
  }
  select.value = ui.deckId ?? '';
  if (select.value !== (ui.deckId ?? '')) {
    // El mazo seleccionado ya no existe.
    ui.deckId = null;
    select.value = '';
  }
}

function renderCounters() {
  const c = counts(deckCards());
  const daily = store.daily();
  const s = store.settings();
  const nuevasHoy = Math.min(c.nuevas, Math.max(0, s.newPerDay - daily.introduced));
  $('#counters').innerHTML =
    `<span class="c-new" title="Nuevas pendientes hoy">${nuevasHoy}</span>` +
    `<span class="c-learn" title="Aprendiendo">${c.aprendiendo}</span>` +
    `<span class="c-due" title="Repasos pendientes">${c.repaso}</span>`;
}

// --- Estudiar ------------------------------------------------------------

/** Opciones de programación derivadas de los ajustes y del día en curso. */
function scheduling() {
  const daily = store.daily();
  const s = store.settings();
  return {
    now: nowMs(),
    newPerDay: s.newPerDay,
    maxReviewsPerDay: s.maxReviewsPerDay,
    introducedToday: daily.introduced,
    reviewedToday: daily.reviewed,
    lookaheadMs: DEFAULT_LOOKAHEAD_MS,
  };
}

/** @spec RF-305 */
function nextCard() {
  const candidates = buildQueue(deckCards(), scheduling());
  if (!candidates.length) return null;
  // Con más de una tarjeta disponible, no repetir la recién respondida.
  return candidates.find((c) => c.id !== ui.lastCardId) || candidates[0];
}

/**
 * Programa un refresco para cuando la siguiente tarjeta esté disponible, si es
 * pronto. Sin esto, la pantalla vacía se quedaría congelada.
 *
 * @spec RF-407
 */
function scheduleAutoRefresh() {
  clearTimeout(refreshTimer);
  const now = nowMs();
  const at = nextAvailableAt(deckCards(), { now, lookaheadMs: DEFAULT_LOOKAHEAD_MS });
  if (at == null) return;
  const delay = at - now;
  if (delay <= 0 || delay > AUTO_REFRESH_MAX_MS) return;
  refreshTimer = setTimeout(() => {
    if (ui.view === 'study') renderStudy();
  }, delay + 500);
}

function renderStudy() {
  renderCounters();
  const card = nextCard();
  ui.card = card;
  ui.revealed = false;

  const empty = $('#study-empty');
  const area = $('#study-card');

  if (!card) {
    area.classList.add('hidden');
    empty.classList.remove('hidden');
    $('#study-empty-detail').textContent = emptyQueueReason(deckCards(), scheduling()).message;
    scheduleAutoRefresh();
    return;
  }

  clearTimeout(refreshTimer);

  empty.classList.add('hidden');
  area.classList.remove('hidden');
  $('#face-front').textContent = card.front;
  $('#face-back').textContent = card.back;
  $('#face-back').classList.add('hidden');
  $('#face-back-label').classList.add('hidden');
  $('#face-divider').classList.add('hidden');
  $('#face-hint').classList.remove('hidden');
  $('#grades').classList.add('hidden');
}

/** @spec RF-301 RF-302 RF-304 */
function reveal() {
  if (!ui.card || ui.revealed) return;
  ui.revealed = true;
  $('#face-back').classList.remove('hidden');
  $('#face-back-label').classList.remove('hidden');
  $('#face-divider').classList.remove('hidden');
  $('#face-hint').classList.add('hidden');
  $('#grades').classList.remove('hidden');

  const preview = previewIntervals(ui.card);
  for (const grade of [0, 1, 2, 3]) {
    $(`.grade-when[data-when="${grade}"]`).textContent = formatDelay(preview[grade]);
  }
}

/** @spec RF-303 RF-305 */
function answer(grade) {
  if (!ui.card || !ui.revealed) return;
  const previous = ui.card;
  const updated = review(previous, grade);
  store.recordReview(previous, updated, grade);
  ui.lastCardId = previous.id;
  toast(`${GRADE_LABELS[grade]} · vuelve en ${formatDelay(updated.due - nowMs())}`);
  renderStudy();
}

// --- Listado de tarjetas -------------------------------------------------

function describeState(card) {
  if (card.state === 'new') return 'nueva';
  const delta = card.due - nowMs();
  if (delta <= 0) return 'pendiente';
  return `en ${formatDelay(delta)}`;
}

/** @spec RF-104 RF-105 */
function renderCardList() {
  const query = $('#card-search').value.trim().toLowerCase();
  const all = deckCards();
  const list = query
    ? all.filter((c) =>
        `${c.front} ${c.back} ${c.tags.join(' ')}`.toLowerCase().includes(query),
      )
    : all;

  $('#cards-summary').textContent = query
    ? `${list.length} de ${all.length} tarjetas`
    : `${all.length} tarjeta${all.length === 1 ? '' : 's'}`;

  const ul = $('#card-list');
  ul.innerHTML = '';
  const ordered = [...list].sort((a, b) => b.createdAt - a.createdAt);

  for (const card of ordered.slice(0, 300)) {
    const li = document.createElement('li');

    const text = document.createElement('div');
    text.className = 'card-item-text';
    const front = document.createElement('div');
    front.className = 'card-item-front';
    front.textContent = card.front;
    const back = document.createElement('div');
    back.className = 'card-item-back';
    back.textContent = card.back;
    const meta = document.createElement('div');
    meta.className = 'card-item-meta';
    meta.textContent = describeState(card) + (card.tags.length ? ` · ${card.tags.join(', ')}` : '');
    text.append(front, back, meta);

    const edit = document.createElement('button');
    edit.className = 'icon-btn';
    edit.type = 'button';
    edit.textContent = '✏️';
    edit.title = 'Editar';
    edit.addEventListener('click', () => openEditor(card));

    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.type = 'button';
    del.textContent = '🗑';
    del.title = 'Borrar';
    del.addEventListener('click', () => {
      if (!confirm(`¿Borrar la tarjeta "${card.front}"?`)) return;
      store.deleteCard(card.id);
      renderCardList();
      renderCounters();
    });

    li.append(text, edit, del);
    ul.append(li);
  }

  if (ordered.length > 300) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = `…y ${ordered.length - 300} más. Usa el buscador.`;
    ul.append(li);
  }
}

// --- Editor --------------------------------------------------------------

/** @spec RF-101 RF-102 RF-109 */
function openEditor(card = null) {
  ui.editing = card;
  const dialog = $('#editor');
  $('#editor-title').textContent = card ? 'Editar tarjeta' : 'Nueva tarjeta';

  // Reiniciar solo tiene sentido en una tarjeta que ya se ha estudiado.
  const estudiada = Boolean(card && card.state !== 'new');
  $('#editor-reset').classList.toggle('hidden', !estudiada);
  const progreso = $('#editor-progress');
  progreso.classList.toggle('hidden', !card);
  if (card) {
    progreso.textContent = estudiada
      ? `${describeState(card)} · ${card.reps} repasos · ${card.lapses} fallos`
      : 'Sin estudiar todavía.';
  }
  $('#editor-front').value = card?.front ?? '';
  $('#editor-back').value = card?.back ?? '';
  $('#editor-tags').value = card?.tags?.join(', ') ?? '';
  feedback($('#editor-feedback'), '');

  const select = $('#editor-deck');
  select.innerHTML = '';
  for (const deck of store.decks()) select.append(new Option(deck.name, deck.id));
  select.value = card?.deckId ?? ui.deckId ?? store.decks()[0].id;

  dialog.showModal();
}

function saveEditor() {
  const front = $('#editor-front').value.trim();
  const back = $('#editor-back').value.trim();
  const tags = $('#editor-tags')
    .value.split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const deckId = $('#editor-deck').value;

  if (!front || !back) {
    feedback($('#editor-feedback'), 'Hacen falta pregunta y respuesta.', 'error');
    return false;
  }

  if (ui.editing) {
    store.updateCard(ui.editing.id, { front, back, tags, deckId });
    toast('Tarjeta guardada');
  } else {
    store.addCard({ deckId, front, back, tags });
    toast('Tarjeta creada');
  }
  ui.editing = null;
  renderCounters();
  if (ui.view === 'cards') renderCardList();
  if (ui.view === 'study') renderStudy();
  return true;
}

// --- Importar / exportar -------------------------------------------------

/** @spec RF-204 RF-206 RF-209 */
function doImport(text) {
  const out = $('#import-feedback');
  let parsed;
  try {
    parsed = parseInput(text);
  } catch (err) {
    feedback(out, err.message, 'error');
    return;
  }

  if (parsed.kind === 'backup') {
    const n = parsed.backup.cards.length;
    if (!confirm(`Esto reemplaza todo por la copia de seguridad (${n} tarjetas). ¿Seguir?`)) return;
    try {
      store.importState(parsed.backup);
    } catch (err) {
      feedback(out, err.message, 'error');
      return;
    }
    ui.deckId = null;
    renderDeckSelect();
    renderCounters();
    feedback(out, `Restauradas ${n} tarjetas.`, 'ok');
    $('#import-text').value = '';
    return;
  }

  const { added, skipped, deckName } = store.importCards(parsed, ui.deckId);

  renderDeckSelect();
  renderCounters();
  $('#import-text').value = '';
  feedback(
    out,
    `Añadidas ${added} tarjetas a "${deckName}"` +
      (skipped ? ` (${skipped} repetidas, omitidas).` : '.'),
    'ok',
  );
}

function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readFile(input, onText) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    onText(String(reader.result));
    input.value = '';
  };
  reader.onerror = () => toast('No se pudo leer el fichero');
  reader.readAsText(file);
}

// --- Ajustes -------------------------------------------------------------

/** @spec RF-106 RF-501 RF-502 RF-503 */
function renderSettings() {
  const s = store.settings();
  $('#set-new').value = s.newPerDay;
  $('#set-max').value = s.maxReviewsPerDay;

  const ul = $('#deck-list');
  ul.innerHTML = '';
  for (const deck of store.decks()) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const n = store.cards(deck.id).length;
    name.textContent = `${deck.name} (${n})`;

    const actions = document.createElement('span');
    const rename = document.createElement('button');
    rename.className = 'icon-btn';
    rename.type = 'button';
    rename.textContent = '✏️';
    rename.addEventListener('click', () => {
      const value = prompt('Nuevo nombre del mazo', deck.name);
      if (value == null) return;
      store.renameDeck(deck.id, value);
      renderSettings();
      renderDeckSelect();
    });

    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.type = 'button';
    del.textContent = '🗑';
    del.addEventListener('click', () => {
      if (!confirm(`¿Borrar "${deck.name}" y sus ${n} tarjetas?`)) return;
      if (!store.deleteDeck(deck.id)) {
        toast('Tiene que quedar al menos un mazo');
        return;
      }
      if (ui.deckId === deck.id) ui.deckId = null;
      renderSettings();
      renderDeckSelect();
      renderCounters();
    });

    actions.append(rename, del);
    li.append(name, actions);
    ul.append(li);
  }

  const st = store.stats();
  $('#stats').innerHTML = [
    ['Tarjetas en total', st.total],
    ['Respondidas hoy', st.doneToday],
    ['Respondidas esta semana', st.semana],
    ['Aciertos (7 días)', st.retencion == null ? '—' : `${st.retencion} %`],
  ]
    .map(([k, v]) => `<li><span>${k}</span><strong>${v}</strong></li>`)
    .join('');
}

// --- Arranque ------------------------------------------------------------

function bind() {
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => showView(tab.dataset.view)));
  $$('[data-goto]').forEach((el) =>
    el.addEventListener('click', () => showView(el.dataset.goto)),
  );

  $('#deck-select').addEventListener('change', (e) => {
    ui.deckId = e.target.value || null;
    ui.lastCardId = null;
    renderCounters();
    if (ui.view === 'study') renderStudy();
    if (ui.view === 'cards') renderCardList();
  });

  $('#card-face').addEventListener('click', reveal);
  $$('.grade').forEach((btn) =>
    btn.addEventListener('click', () => answer(Number(btn.dataset.grade))),
  );

  $('#btn-edit-current').addEventListener('click', () => ui.card && openEditor(ui.card));
  $('#btn-delete-current').addEventListener('click', () => {
    if (!ui.card || !confirm('¿Borrar esta tarjeta?')) return;
    store.deleteCard(ui.card.id);
    renderStudy();
  });

  $('#card-search').addEventListener('input', renderCardList);
  $('#btn-new-card').addEventListener('click', () => openEditor(null));

  $('#editor-reset').addEventListener('click', () => {
    if (!ui.editing) return;
    if (!confirm('La tarjeta volverá a empezar como si fuera nueva. ¿Seguir?')) return;
    store.resetCard(ui.editing.id);
    ui.editing = null;
    $('#editor').close();
    toast('Progreso reiniciado');
    renderCounters();
    if (ui.view === 'cards') renderCardList();
    if (ui.view === 'study') renderStudy();
  });

  $('#editor-form').addEventListener('submit', (e) => {
    // El botón "Cancelar" cierra el diálogo sin guardar.
    if (e.submitter?.value !== 'save') return;
    if (!saveEditor()) e.preventDefault();
  });

  $('#btn-import').addEventListener('click', () => doImport($('#import-text').value));
  $('#import-file').addEventListener('change', (e) =>
    readFile(e.target, (text) => {
      $('#import-text').value = text;
      doImport(text);
    }),
  );
  $('#btn-export').addEventListener('click', () =>
    download(store.backupFilename(), store.exportState()),
  );
  $('#restore-file').addEventListener('change', (e) => readFile(e.target, doImport));

  $('#set-new').addEventListener('change', (e) => {
    const value = Math.max(0, Number(e.target.value) || 0);
    store.updateSettings({ newPerDay: value });
    e.target.value = value;
    renderCounters();
  });
  $('#set-max').addEventListener('change', (e) => {
    const value = Math.max(0, Number(e.target.value) || 0);
    store.updateSettings({ maxReviewsPerDay: value });
    e.target.value = value;
    renderCounters();
  });

  $('#btn-add-deck').addEventListener('click', () => {
    const input = $('#new-deck-name');
    const name = input.value.trim();
    if (!name) return;
    const deck = store.addDeck(name);
    input.value = '';
    ui.deckId = deck.id;
    renderDeckSelect();
    renderSettings();
    renderCounters();
    toast(`Mazo "${deck.name}" creado`);
  });

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Esto borra todas las tarjetas y el progreso. ¿Seguro?')) return;
    if (!confirm('No hay vuelta atrás. ¿De verdad?')) return;
    store.reset();
    ui.deckId = null;
    renderDeckSelect();
    renderSettings();
    showView('study');
  });

  document.addEventListener('keydown', (e) => {
    if (ui.view !== 'study' || $('#editor').open) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      reveal();
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      answer(Number(e.key) - 1);
    }
  });

  // Al volver a la app puede haber vencido algo (o haber cambiado el día).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ui.view === 'study') renderStudy();
  });
}

function start() {
  store.load();
  renderDeckSelect();
  bind();
  showView('study');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* sin conexión offline; la app sigue funcionando */
    });
  }
}

start();
