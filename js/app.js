// Pegamento entre el motor de repetición, el almacenamiento y la pantalla.

import {
  DEFAULT_LOOKAHEAD_MS,
  GRADE_LABELS,
  buildQueue,
  counts,
  deckSummaries,
  emptyQueueReason,
  formatDelay,
  leeches,
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
  view: 'decks',
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
  return store.selectedCards();
}

/** Opciones de programación derivadas de los ajustes y del día en curso. */
function scheduling() {
  return {
    now: nowMs(),
    newPerDay: store.settings().newPerDay,
    introducedByDeck: store.daily().introduced,
    lookaheadMs: DEFAULT_LOOKAHEAD_MS,
  };
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 2600);
}

function feedback(el, message, kind = '') {
  el.textContent = message;
  el.className = `feedback ${kind}`.trim();
}

function boton(clase, texto, titulo, onClick) {
  const b = document.createElement('button');
  b.className = clase;
  b.type = 'button';
  b.textContent = texto;
  if (titulo) b.title = titulo;
  b.addEventListener('click', onClick);
  return b;
}

// --- Navegación ----------------------------------------------------------

function showView(name) {
  ui.view = name;
  $$('.view').forEach((v) => v.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  if (name === 'decks') renderDecks();
  if (name === 'study') renderStudy();
  if (name === 'cards') renderCardList();
  if (name === 'settings') renderSettings();
}

// --- Cabecera ------------------------------------------------------------

/** @spec RF-108 */
function renderHeader() {
  $('#deck-label-text').textContent = store.selectionLabel();

  const c = counts(deckCards());
  const resumenes = deckSummaries(store.decks(), deckCards(), scheduling());
  const nuevasHoy = resumenes.reduce((n, r) => n + r.nuevasHoy, 0);
  $('#counters').innerHTML =
    `<span class="c-new" title="Nuevas pendientes hoy">${nuevasHoy}</span>` +
    `<span class="c-learn" title="Aprendiendo">${c.aprendiendo}</span>` +
    `<span class="c-due" title="Repasos pendientes">${c.repaso}</span>`;
}

// --- Pantalla de mazos ---------------------------------------------------

/** @spec RF-110 RF-111 */
function renderDecks() {
  renderHeader();
  renderBackupBanner();

  const seleccion = store.selection();
  const marcado = (id) => seleccion.length === 0 || seleccion.includes(id);
  const resumenes = deckSummaries(store.decks(), store.cards(), scheduling());

  const ul = $('#deck-cards');
  ul.innerHTML = '';

  for (const r of resumenes) {
    const li = document.createElement('li');
    if (r.pendientes === 0) li.className = 'al-dia';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'deck-check';
    check.checked = marcado(r.deck.id);
    check.dataset.deck = r.deck.id;
    check.title = `Incluir ${r.deck.name}`;
    check.addEventListener('change', aplicarSeleccion);

    const abrir = document.createElement('button');
    abrir.className = 'deck-open';
    abrir.type = 'button';
    const nombre = document.createElement('div');
    nombre.className = 'deck-name';
    nombre.textContent = r.deck.name;
    const detalle = document.createElement('div');
    detalle.className = 'deck-detail';
    detalle.innerHTML = r.total
      ? `<b class="n-new">${r.nuevasHoy}</b> nuevas · <b class="n-learn">${r.aprendiendo}</b> aprendiendo · ` +
        `<b class="n-due">${r.repaso}</b> repaso <span class="muted">· ${r.total} en total</span>`
      : 'Sin tarjetas todavía';
    abrir.append(nombre, detalle);
    abrir.addEventListener('click', () => {
      store.setSelection([r.deck.id]);
      showView('study');
    });

    const pendientes = document.createElement('div');
    pendientes.className = `deck-pending${r.pendientes ? '' : ' cero'}`;
    pendientes.textContent = r.pendientes || '✓';

    li.append(check, abrir, pendientes);
    ul.append(li);
  }
}

/** @spec RF-111 */
function aplicarSeleccion() {
  const marcados = $$('.deck-check')
    .filter((c) => c.checked)
    .map((c) => c.dataset.deck);
  store.setSelection(marcados);
  if (!marcados.length) toast('Sin mazos marcados se estudian todos');
  renderDecks();
}

// --- Copia de seguridad --------------------------------------------------

/** @spec RF-211 */
function renderBackupBanner() {
  const estado = store.backupStatus();
  $('#backup-banner').classList.toggle('hidden', !estado.pendiente);
  if (!estado.pendiente) return;
  $('#backup-detail').textContent =
    estado.dias == null
      ? 'Todo vive solo en este dispositivo. Guarda una copia para no depender de él.'
      : `Han pasado ${estado.dias} días desde la última copia.`;
}

/**
 * Guarda la copia. En el móvil ofrece compartirla (Archivos, iCloud, correo);
 * si el navegador no lo permite, la descarga.
 *
 * @spec RF-208 RF-211
 */
async function saveBackup() {
  const contenido = store.exportState();
  const nombre = store.backupFilename();
  const fichero = new File([contenido], nombre, { type: 'application/json' });

  try {
    if (navigator.canShare?.({ files: [fichero] })) {
      await navigator.share({ files: [fichero], title: 'Copia de las tarjetas' });
    } else {
      download(nombre, contenido);
    }
  } catch (err) {
    // Cancelar el diálogo de compartir no es un error que contar.
    if (err?.name === 'AbortError') return;
    download(nombre, contenido);
  }

  store.markBackup();
  renderBackupBanner();
  toast('Copia guardada');
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

// --- Estudiar ------------------------------------------------------------

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
  renderHeader();
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

function deckName(deckId) {
  return store.decks().find((d) => d.id === deckId)?.name ?? '';
}

/** Construye una fila de tarjeta con sus botones de editar y borrar. */
function cardRow(card, { meta, onChange }) {
  const li = document.createElement('li');

  const text = document.createElement('div');
  text.className = 'card-item-text';
  const front = document.createElement('div');
  front.className = 'card-item-front';
  front.textContent = card.front;
  const back = document.createElement('div');
  back.className = 'card-item-back';
  back.textContent = card.back;
  const info = document.createElement('div');
  info.className = 'card-item-meta';
  info.textContent = meta;
  text.append(front, back, info);

  li.append(
    text,
    boton('icon-btn', '✏️', 'Editar', () => openEditor(card, onChange)),
    boton('icon-btn', '🗑', 'Borrar', () => {
      if (!confirm(`¿Borrar la tarjeta "${card.front}"?`)) return;
      store.deleteCard(card.id);
      onChange();
    }),
  );
  return li;
}

/** @spec RF-104 RF-105 */
function renderCardList() {
  renderHeader();
  const query = $('#card-search').value.trim().toLowerCase();
  const all = deckCards();
  const list = query
    ? all.filter((c) => `${c.front} ${c.back} ${c.tags.join(' ')}`.toLowerCase().includes(query))
    : all;

  $('#cards-summary').textContent = query
    ? `${list.length} de ${all.length} tarjetas`
    : `${all.length} tarjeta${all.length === 1 ? '' : 's'}`;

  const ul = $('#card-list');
  ul.innerHTML = '';
  const ordered = [...list].sort((a, b) => b.createdAt - a.createdAt);

  for (const card of ordered.slice(0, 300)) {
    const etiquetas = card.tags.length ? ` · ${card.tags.join(', ')}` : '';
    ul.append(cardRow(card, { meta: describeState(card) + etiquetas, onChange: renderCardList }));
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
function openEditor(card = null, onChange = null) {
  ui.editing = card;
  ui.onEditorChange = onChange;
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
  select.value = card?.deckId ?? store.selection()[0] ?? store.decks()[0].id;

  dialog.showModal();
}

/** Vuelve a pintar la vista que se esté viendo. */
function refreshView() {
  if (ui.view === 'decks') renderDecks();
  else if (ui.view === 'study') renderStudy();
  else if (ui.view === 'cards') renderCardList();
  else if (ui.view === 'settings') renderSettings();
  else renderHeader();
}

function afterEdit() {
  const onChange = ui.onEditorChange;
  ui.editing = null;
  ui.onEditorChange = null;
  if (onChange) onChange();
  else refreshView();
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
  afterEdit();
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
    renderHeader();
    feedback(out, `Restauradas ${n} tarjetas.`, 'ok');
    $('#import-text').value = '';
    return;
  }

  const destino = store.selection().length === 1 ? store.selection()[0] : null;
  const { added, skipped, deckName: nombre } = store.importCards(parsed, destino);

  renderHeader();
  $('#import-text').value = '';
  feedback(
    out,
    `Añadidas ${added} tarjetas a "${nombre}"` +
      (skipped ? ` (${skipped} repetidas, omitidas).` : '.'),
    'ok',
  );
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

/** @spec RF-106 RF-501 RF-502 RF-503 RF-504 RF-505 */
function renderSettings() {
  renderHeader();
  $('#set-new').value = store.settings().newPerDay;

  // Mazos: renombrar y borrar.
  const ul = $('#deck-list');
  ul.innerHTML = '';
  for (const deck of store.decks()) {
    const li = document.createElement('li');
    const n = store.cards(deck.id).length;
    const name = document.createElement('span');
    name.textContent = `${deck.name} (${n})`;

    const acciones = document.createElement('span');
    acciones.append(
      boton('icon-btn', '✏️', 'Renombrar', () => {
        const value = prompt('Nuevo nombre del mazo', deck.name);
        if (value == null) return;
        store.renameDeck(deck.id, value);
        renderSettings();
      }),
      boton('icon-btn', '🗑', 'Borrar', () => {
        if (!confirm(`¿Borrar "${deck.name}" y sus ${n} tarjetas?`)) return;
        if (!store.deleteDeck(deck.id)) {
          toast('Tiene que quedar al menos un mazo');
          return;
        }
        renderSettings();
      }),
    );
    li.append(name, acciones);
    ul.append(li);
  }

  // Progreso por mazo.
  $('#deck-stats').innerHTML = store
    .deckStats()
    .map(
      (d) =>
        `<li><div class="deck-name">${escapar(d.deck.name)}</div>` +
        `<div class="deck-detail">${d.total} tarjetas · ${d.dominadas} dominadas · ` +
        `${d.semana} respuestas esta semana · aciertos ${
          d.retencion == null ? '—' : `${d.retencion} %`
        }</div></li>`,
    )
    .join('');

  const st = store.stats();
  $('#stats').innerHTML = [
    ['Tarjetas en total', st.total],
    ['Respondidas hoy', st.doneToday],
    ['Respondidas esta semana', st.semana],
    ['Aciertos (7 días)', st.retencion == null ? '—' : `${st.retencion} %`],
  ]
    .map(([k, v]) => `<li><span>${k}</span><strong>${v}</strong></li>`)
    .join('');

  // Tarjetas problemáticas.
  const lista = $('#leech-list');
  lista.innerHTML = '';
  const problematicas = leeches(store.cards());
  if (!problematicas.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Ninguna por ahora. Aparecerán aquí a partir de 5 olvidos.';
    lista.append(li);
  }
  for (const card of problematicas.slice(0, 50)) {
    lista.append(
      cardRow(card, {
        meta: `${card.lapses} olvidos · ${deckName(card.deckId)}`,
        onChange: renderSettings,
      }),
    );
  }
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// --- Arranque ------------------------------------------------------------

function bind() {
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => showView(tab.dataset.view)));
  $$('[data-goto]').forEach((el) => el.addEventListener('click', () => showView(el.dataset.goto)));

  // Pantalla de mazos.
  $('#btn-select-all').addEventListener('click', () => {
    store.setSelection([]);
    renderDecks();
  });
  $('#btn-study-selection').addEventListener('click', () => showView('study'));
  $('#btn-add-deck').addEventListener('click', () => {
    const input = $('#new-deck-name');
    const name = input.value.trim();
    if (!name) return;
    const deck = store.addDeck(name);
    input.value = '';
    renderDecks();
    toast(`Mazo "${deck.name}" creado`);
  });
  $('#btn-backup').addEventListener('click', saveBackup);

  // Estudiar.
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

  // Tarjetas.
  $('#card-search').addEventListener('input', renderCardList);
  $('#btn-new-card').addEventListener('click', () => openEditor(null));

  // Editor.
  $('#editor-reset').addEventListener('click', () => {
    if (!ui.editing) return;
    if (!confirm('La tarjeta volverá a empezar como si fuera nueva. ¿Seguir?')) return;
    store.resetCard(ui.editing.id);
    $('#editor').close();
    toast('Progreso reiniciado');
    afterEdit();
  });
  $('#editor-form').addEventListener('submit', (e) => {
    // El botón "Cancelar" cierra el diálogo sin guardar.
    if (e.submitter?.value !== 'save') {
      ui.editing = null;
      ui.onEditorChange = null;
      return;
    }
    if (!saveEditor()) e.preventDefault();
  });

  // Añadir.
  $('#btn-import').addEventListener('click', () => doImport($('#import-text').value));
  $('#import-file').addEventListener('change', (e) =>
    readFile(e.target, (text) => {
      $('#import-text').value = text;
      doImport(text);
    }),
  );
  $('#btn-export').addEventListener('click', saveBackup);
  $('#restore-file').addEventListener('change', (e) => readFile(e.target, doImport));

  // Ajustes.
  $('#set-new').addEventListener('change', (e) => {
    const value = Math.max(0, Number(e.target.value) || 0);
    store.updateSettings({ newPerDay: value });
    e.target.value = value;
    renderHeader();
  });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Esto borra todas las tarjetas y el progreso. ¿Seguro?')) return;
    if (!confirm('No hay vuelta atrás. ¿De verdad?')) return;
    store.reset();
    showView('decks');
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
    if (document.visibilityState !== 'visible') return;
    if (ui.view === 'study') renderStudy();
    if (ui.view === 'decks') renderDecks();
  });
}

function start() {
  store.load();
  bind();
  showView('decks');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* sin conexión offline; la app sigue funcionando */
    });
  }
}

start();
