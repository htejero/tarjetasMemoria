// Persistencia en localStorage. Todo vive en el móvil: no hay servidor.
// El estado completo se guarda bajo una sola clave para que exportar sea
// simplemente volcar este objeto a un fichero JSON.

import { createCard, dayStart, nowMs } from './srs.js';

const KEY = 'tarjetasMemoria.v1';
const HISTORY_LIMIT = 5000;

export const DEFAULT_SETTINGS = Object.freeze({
  newPerDay: 20,
  cutoffHour: 4,
});

function emptyState() {
  const deckId = newId();
  return {
    version: 1,
    decks: [{ id: deckId, name: 'General', createdAt: nowMs() }],
    cards: [],
    settings: { ...DEFAULT_SETTINGS },
    selection: [],
    lastBackupAt: null,
    daily: { day: dayStart(nowMs()), introduced: {} },
    history: [],
  };
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? migrate(JSON.parse(raw)) : emptyState();
  } catch (err) {
    console.error('No se pudo leer el almacenamiento, empiezo de cero', err);
    state = emptyState();
  }
  rollDay();
  return state;
}

/**
 * Olvida el estado en memoria y lo vuelve a leer del almacenamiento. Hace falta
 * cuando otra pestaña ha escrito, y en las pruebas para empezar de cero.
 */
export function reload() {
  state = null;
  return load();
}

export function save() {
  if (!state) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error('No se pudo guardar', err);
    globalThis.alert?.(
      'No se pudo guardar. Puede que el almacenamiento del navegador esté lleno.',
    );
  }
}

/**
 * Adapta estados guardados por versiones anteriores.
 *
 * @spec RF-209 RNF-107
 */
function migrate(data) {
  const base = emptyState();
  const merged = {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data.settings || {}) },
    daily: { ...base.daily, ...(data.daily || {}) },
  };
  merged.decks = Array.isArray(merged.decks) && merged.decks.length ? merged.decks : base.decks;
  merged.cards = Array.isArray(merged.cards) ? merged.cards : [];
  merged.history = Array.isArray(merged.history) ? merged.history : [];
  // Restos de cuando existía el límite diario de repasos (RF-403, retirado).
  delete merged.settings.maxReviewsPerDay;
  delete merged.daily.reviewed;
  // El cupo de nuevas pasó de ser global a ser por mazo (RF-402): un contador
  // numérico de una copia antigua ya no significa nada.
  if (typeof merged.daily.introduced !== 'object' || merged.daily.introduced === null) {
    merged.daily.introduced = {};
  }
  merged.selection = Array.isArray(merged.selection) ? merged.selection : [];
  if (typeof merged.lastBackupAt !== 'number') merged.lastBackupAt = null;
  // Las tarjetas huérfanas (mazo borrado o inexistente) van al primer mazo.
  const ids = new Set(merged.decks.map((d) => d.id));
  merged.selection = merged.selection.filter((id) => ids.has(id));
  for (const card of merged.cards) {
    if (!ids.has(card.deckId)) card.deckId = merged.decks[0].id;
    if (!Array.isArray(card.tags)) card.tags = [];
  }
  return merged;
}

/**
 * Reinicia los contadores diarios si ya estamos en otro día de estudio.
 *
 * @spec RF-405
 */
export function rollDay(now = nowMs()) {
  const s = state;
  const today = dayStart(now, s.settings.cutoffHour);
  if (s.daily.day !== today) {
    s.daily = { day: today, introduced: {} };
    save();
  }
  return s.daily;
}

// --- Mazos ---------------------------------------------------------------

export function decks() {
  return load().decks;
}

/** @spec RF-106 */
export function addDeck(name) {
  const s = load();
  const deck = { id: newId(), name: name.trim() || 'Sin nombre', createdAt: nowMs() };
  s.decks.push(deck);
  save();
  return deck;
}

export function renameDeck(id, name) {
  const deck = load().decks.find((d) => d.id === id);
  if (!deck) return;
  deck.name = name.trim() || deck.name;
  save();
}

/**
 * Borra un mazo y todas sus tarjetas. Nunca deja la app sin ningún mazo.
 *
 * @spec RF-106 RF-107
 */
export function deleteDeck(id) {
  const s = load();
  if (s.decks.length <= 1) return false;
  s.decks = s.decks.filter((d) => d.id !== id);
  s.cards = s.cards.filter((c) => c.deckId !== id);
  s.selection = s.selection.filter((deckId) => deckId !== id);
  save();
  return true;
}

/**
 * Mazos que se están estudiando. La lista vacía significa "todos".
 *
 * @spec RF-111
 */
export function selection() {
  return load().selection;
}

/** @spec RF-111 */
export function setSelection(deckIds) {
  const s = load();
  const validos = new Set(s.decks.map((d) => d.id));
  const limpia = [...new Set(deckIds)].filter((id) => validos.has(id));
  // Marcarlos todos es lo mismo que no marcar ninguno: se estudia todo.
  s.selection = limpia.length === s.decks.length ? [] : limpia;
  save();
  return s.selection;
}

/** Nombre legible de la selección para la cabecera. @spec RF-108 */
export function selectionLabel() {
  const s = load();
  if (!s.selection.length) return 'Todos los mazos';
  if (s.selection.length === 1) {
    return s.decks.find((d) => d.id === s.selection[0])?.name ?? 'Todos los mazos';
  }
  return `${s.selection.length} mazos`;
}

// --- Tarjetas ------------------------------------------------------------

/** Tarjetas de un mazo, de una lista de mazos, o de todos si no se dice nada. */
export function cards(deckId = null) {
  const all = load().cards;
  if (!deckId) return all;
  const ids = new Set(Array.isArray(deckId) ? deckId : [deckId]);
  return ids.size ? all.filter((c) => ids.has(c.deckId)) : all;
}

/** Tarjetas de los mazos seleccionados. @spec RF-111 */
export function selectedCards() {
  const s = load();
  return s.selection.length ? cards(s.selection) : s.cards;
}

/** @spec RF-101 */
export function addCard({ deckId, front, back, tags = [] }) {
  const s = load();
  const card = createCard({ id: newId(), deckId, front, back, tags });
  s.cards.push(card);
  save();
  return card;
}

/** @spec RF-102 */
export function updateCard(id, patch) {
  const card = load().cards.find((c) => c.id === id);
  if (!card) return null;
  Object.assign(card, patch);
  save();
  return card;
}

/** @spec RF-103 */
export function deleteCard(id) {
  const s = load();
  s.cards = s.cards.filter((c) => c.id !== id);
  save();
}

/**
 * Devuelve la tarjeta al estado "nueva" conservando el texto.
 *
 * @spec RF-109
 */
export function resetCard(id) {
  const card = load().cards.find((c) => c.id === id);
  if (!card) return null;
  Object.assign(card, {
    state: 'new',
    step: 0,
    interval: 0,
    ease: 2.5,
    due: nowMs(),
    reps: 0,
    lapses: 0,
    lastReviewed: null,
  });
  save();
  return card;
}

/** Guarda el resultado de una respuesta y actualiza los contadores del día. */
export function recordReview(previous, updated, grade) {
  const s = load();
  const idx = s.cards.findIndex((c) => c.id === updated.id);
  if (idx >= 0) s.cards[idx] = updated;

  rollDay();
  if (previous.state === 'new') {
    s.daily.introduced[updated.deckId] = (s.daily.introduced[updated.deckId] ?? 0) + 1;
  }

  s.history.push({ ts: nowMs(), cardId: updated.id, grade, interval: updated.interval });
  if (s.history.length > HISTORY_LIMIT) s.history = s.history.slice(-HISTORY_LIMIT);
  save();
}

// --- Ajustes -------------------------------------------------------------

export function settings() {
  return load().settings;
}

/** @spec RF-501 */
export function updateSettings(patch) {
  const s = load();
  Object.assign(s.settings, patch);
  save();
  return s.settings;
}

export function daily() {
  return rollDay();
}

// --- Copia de seguridad --------------------------------------------------

/**
 * Añade al mazo que corresponda las tarjetas de una importación ya analizada.
 *
 * El mazo destino es, por este orden: el que esté seleccionado, el que nombre
 * el fichero (creándolo si hace falta) o el primero. No se añaden preguntas que
 * ya existan en ese mazo, comparando sin distinguir mayúsculas ni espacios.
 *
 * @spec RF-205 RF-206
 */
export function importCards(parsed, activeDeckId = null) {
  const s = load();

  let deckId = activeDeckId;
  if (!deckId && parsed.deckName) {
    const existing = s.decks.find((d) => d.name === parsed.deckName);
    deckId = (existing || addDeck(parsed.deckName)).id;
  }
  if (!deckId) deckId = s.decks[0].id;

  const key = (front) => front.trim().toLowerCase();
  const seen = new Set(cards(deckId).map((c) => key(c.front)));

  let added = 0;
  let skipped = 0;
  for (const card of parsed.cards) {
    if (seen.has(key(card.front))) {
      skipped += 1;
      continue;
    }
    seen.add(key(card.front));
    addCard({ deckId, front: card.front, back: card.back, tags: card.tags });
    added += 1;
  }

  return { deckId, deckName: s.decks.find((d) => d.id === deckId)?.name ?? '', added, skipped };
}

/** @spec RF-208 */
export function exportState() {
  return JSON.stringify(load(), null, 2);
}

const BACKUP_INTERVAL_MS = 7 * 24 * 3600 * 1000;

/**
 * Si toca recordar la copia de seguridad. Un navegador no puede escribirla solo,
 * así que lo único honesto es avisar a tiempo.
 *
 * @spec RF-211
 */
export function backupStatus(now = nowMs()) {
  const s = load();
  const last = s.lastBackupAt;
  const dias = last == null ? null : Math.floor((now - last) / (24 * 3600 * 1000));
  return {
    lastBackupAt: last,
    dias,
    pendiente: s.cards.length > 0 && (last == null || now - last >= BACKUP_INTERVAL_MS),
  };
}

/** @spec RF-211 */
export function markBackup(now = nowMs()) {
  const s = load();
  s.lastBackupAt = now;
  save();
  return s.lastBackupAt;
}

/** @spec RF-208 */
export function backupFilename(now = nowMs()) {
  const d = new Date(now);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `tarjetas-${d.getFullYear()}-${mes}-${dia}.json`;
}

/**
 * Reemplaza todo el contenido por el de una copia de seguridad.
 *
 * @spec RF-209
 */
export function importState(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || !Array.isArray(data.cards)) throw new Error('El fichero no tiene tarjetas.');
  state = migrate(data);
  // Restaurar una copia demuestra que existe: no hace falta avisar mañana.
  state.lastBackupAt = nowMs();
  save();
  return state;
}

/** @spec RF-503 */
export function reset() {
  state = emptyState();
  save();
  return state;
}

/**
 * Progreso de cada mazo en los últimos 7 días.
 *
 * @spec RF-504
 */
export function deckStats(now = nowMs()) {
  const s = load();
  const desde = now - 7 * 24 * 3600 * 1000;
  const mazoDe = new Map(s.cards.map((c) => [c.id, c.deckId]));

  const porMazo = new Map(s.decks.map((d) => [d.id, { respuestas: 0, aciertos: 0 }]));
  for (const h of s.history) {
    if (h.ts < desde) continue;
    // Las respuestas a tarjetas borradas ya no cuentan en ningún mazo.
    const registro = porMazo.get(mazoDe.get(h.cardId));
    if (!registro) continue;
    registro.respuestas += 1;
    if (h.grade > 0) registro.aciertos += 1;
  }

  return s.decks.map((deck) => {
    const propias = s.cards.filter((c) => c.deckId === deck.id);
    const { respuestas, aciertos } = porMazo.get(deck.id);
    return {
      deck,
      total: propias.length,
      dominadas: propias.filter((c) => c.state === 'review' && c.interval >= 21).length,
      semana: respuestas,
      retencion: respuestas ? Math.round((aciertos / respuestas) * 100) : null,
    };
  });
}

/**
 * Estadísticas sencillas para la pantalla de ajustes.
 *
 * @spec RF-502
 */
export function stats(now = nowMs()) {
  const s = load();
  const today = dayStart(now, s.settings.cutoffHour);
  const doneToday = s.history.filter((h) => h.ts >= today).length;
  const week = s.history.filter((h) => h.ts >= now - 7 * 24 * 3600 * 1000);
  const aciertos = week.filter((h) => h.grade > 0).length;
  return {
    total: s.cards.length,
    doneToday,
    semana: week.length,
    retencion: week.length ? Math.round((aciertos / week.length) * 100) : null,
  };
}
