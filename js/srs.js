// Motor de repetición espaciada (variante de SM-2 con pasos de aprendizaje).
//
// Estados de una tarjeta:
//   new         -> nunca estudiada
//   learning    -> en los pasos cortos de aprendizaje (minutos)
//   review      -> intervalos largos (días)
//   relearning  -> ha fallado una tarjeta de repaso y vuelve a pasos cortos
//
// Todas las funciones son puras: reciben la tarjeta y devuelven una tarjeta
// nueva, sin tocar la original. Así el motor se puede probar sin navegador.

export const GRADE = Object.freeze({
  AGAIN: 0, // Fallo
  HARD: 1, // Difícil
  GOOD: 2, // Bien
  EASY: 3, // Fácil
});

export const GRADE_LABELS = Object.freeze({
  [GRADE.AGAIN]: 'Fallo',
  [GRADE.HARD]: 'Difícil',
  [GRADE.GOOD]: 'Bien',
  [GRADE.EASY]: 'Fácil',
});

export const DEFAULT_CONFIG = Object.freeze({
  learningSteps: [1, 10], // minutos
  relearningSteps: [10], // minutos
  graduatingInterval: 1, // días, al terminar los pasos con "Bien"
  easyInterval: 4, // días, al salir de aprendizaje con "Fácil"
  startingEase: 2.5,
  minEase: 1.3,
  easyBonus: 1.3,
  hardFactor: 1.2,
  lapseFactor: 0.5, // al fallar, el intervalo se reduce a la mitad
  minLapseInterval: 1, // días
  maxInterval: 365 * 5,
  fuzz: true, // dispersa un poco los vencimientos para no acumular días
});

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function nowMs() {
  return Date.now();
}

function clampEase(ease, config) {
  return Math.max(config.minEase, Math.round(ease * 100) / 100);
}

function clampInterval(days, config) {
  return Math.min(config.maxInterval, Math.max(1, Math.round(days)));
}

// Dispersión tipo Anki: ±5% (mínimo 1 día) para intervalos de 3 días o más.
function applyFuzz(days, config, rng) {
  if (!config.fuzz || days < 3) return days;
  const spread = Math.max(1, Math.round(days * 0.05));
  const delta = Math.round((rng() * 2 - 1) * spread);
  return Math.max(1, days + delta);
}

/** Crea una tarjeta nueva lista para entrar en el sistema. */
export function createCard({ id, deckId, front, back, tags = [], createdAt = nowMs() }) {
  return {
    id,
    deckId,
    front,
    back,
    tags,
    createdAt,
    state: 'new',
    step: 0,
    interval: 0, // días (solo relevante en review/relearning)
    ease: DEFAULT_CONFIG.startingEase,
    due: createdAt,
    reps: 0,
    lapses: 0,
    lastReviewed: null,
  };
}

/**
 * Aplica una respuesta a una tarjeta y devuelve la tarjeta actualizada.
 *
 * @spec INV-101 INV-103 INV-104 INV-105 INV-106 INV-107 INV-108 INV-109 INV-110
 * @param {object} card
 * @param {number} grade  uno de GRADE
 * @param {object} [opts] { now, config, rng }
 */
export function review(card, grade, opts = {}) {
  const config = { ...DEFAULT_CONFIG, ...(opts.config || {}) };
  const now = opts.now ?? nowMs();
  const rng = opts.rng ?? Math.random;

  const next = { ...card, reps: card.reps + 1, lastReviewed: now };

  const state = card.state === 'new' ? 'learning' : card.state;

  if (state === 'learning' || state === 'relearning') {
    return scheduleLearning(next, card, grade, state, config, now);
  }
  return scheduleReview(next, card, grade, config, now, rng);
}

function scheduleLearning(next, card, grade, state, config, now) {
  const steps = state === 'relearning' ? config.relearningSteps : config.learningSteps;
  // Las tarjetas nuevas empiezan siempre por el primer paso.
  const step = card.state === 'new' ? 0 : Math.min(card.step, steps.length - 1);

  if (grade === GRADE.AGAIN) {
    next.state = state;
    next.step = 0;
    next.due = now + steps[0] * MINUTE;
    return next;
  }

  if (grade === GRADE.HARD) {
    // Se queda en el mismo paso, pero espera algo más que al fallar: la media
    // con el paso siguiente (o media vez más si ya es el último).
    const nextStep = steps[step + 1];
    const delay = nextStep ? (steps[step] + nextStep) / 2 : steps[step] * 1.5;
    next.state = state;
    next.step = step;
    next.due = now + delay * MINUTE;
    return next;
  }

  if (grade === GRADE.EASY) {
    return graduate(next, card, config, now, /* easy */ true, state);
  }

  // GOOD: avanza un paso; si no quedan pasos, gradúa.
  if (step + 1 < steps.length) {
    next.state = state;
    next.step = step + 1;
    next.due = now + steps[step + 1] * MINUTE;
    return next;
  }
  return graduate(next, card, config, now, /* easy */ false, state);
}

function graduate(next, card, config, now, easy, state) {
  next.state = 'review';
  next.step = 0;
  if (state === 'relearning') {
    // Vuelve al intervalo reducido que se guardó al fallar; "Fácil" lo premia
    // con al menos un día más, para no empatar con "Bien" (INV-102).
    const base = clampInterval(
      Math.max(config.minLapseInterval, card.interval || config.graduatingInterval),
      config,
    );
    next.interval = easy ? clampInterval(Math.max(base * config.easyBonus, base + 1), config) : base;
  } else {
    next.interval = clampInterval(easy ? config.easyInterval : config.graduatingInterval, config);
  }
  next.due = now + next.interval * DAY;
  return next;
}

function scheduleReview(next, card, grade, config, now, rng) {
  const prev = Math.max(1, card.interval || 1);

  if (grade === GRADE.AGAIN) {
    next.state = 'relearning';
    next.step = 0;
    next.lapses = card.lapses + 1;
    next.ease = clampEase(card.ease - 0.2, config);
    next.interval = clampInterval(
      Math.max(config.minLapseInterval, prev * config.lapseFactor),
      config,
    );
    next.due = now + config.relearningSteps[0] * MINUTE;
    return next;
  }

  // Los tres intervalos se calculan encadenados —cada uno al menos un día por
  // encima del anterior— para que los tres botones nunca den el mismo plazo,
  // ni siquiera con la facilidad en el suelo o con intervalos de un día
  // (INV-102, INV-104). El único empate posible es al llegar al techo.
  const hard = clampInterval(Math.max(prev * config.hardFactor, prev + 1), config);
  const good = clampInterval(Math.max(prev * card.ease, hard + 1), config);
  const easy = clampInterval(Math.max(prev * card.ease * config.easyBonus, good + 1), config);

  let ease = card.ease;
  let days;

  if (grade === GRADE.HARD) {
    ease = clampEase(card.ease - 0.15, config);
    days = hard;
  } else if (grade === GRADE.GOOD) {
    days = good;
  } else {
    ease = clampEase(card.ease + 0.15, config);
    days = easy;
  }

  next.state = 'review';
  next.step = 0;
  next.ease = ease;
  next.interval = clampInterval(applyFuzz(days, config, rng), config);
  next.due = now + next.interval * DAY;
  return next;
}

/**
 * Calcula, sin modificar nada, cuándo volvería cada tarjeta según la respuesta.
 * Se usa para pintar el intervalo debajo de cada botón.
 *
 * @spec INV-102
 */
export function previewIntervals(card, opts = {}) {
  const config = { ...DEFAULT_CONFIG, ...(opts.config || {}) };
  const now = opts.now ?? nowMs();
  const out = {};
  for (const grade of [GRADE.AGAIN, GRADE.HARD, GRADE.GOOD, GRADE.EASY]) {
    const result = review(card, grade, { now, config, rng: () => 0.5 });
    out[grade] = result.due - now;
  }
  return out;
}

/** Formatea una duración en milisegundos como "10 min", "3 d", "2,1 meses". */
export function formatDelay(ms) {
  const minutes = ms / MINUTE;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} d`;
  const months = days / 30.44;
  if (months < 12) return `${months.toFixed(1).replace('.', ',')} meses`;
  return `${(days / 365.25).toFixed(1).replace('.', ',')} años`;
}

/**
 * Momento en el que empieza el "día de estudio" (por defecto, las 4 de la mañana).
 *
 * @spec RF-405
 */
export function dayStart(ts, cutoffHour = 4) {
  const d = new Date(ts);
  if (d.getHours() < cutoffHour) d.setDate(d.getDate() - 1);
  d.setHours(cutoffHour, 0, 0, 0);
  return d.getTime();
}

export function isDue(card, now = nowMs()) {
  return card.due <= now;
}

/** Ventana por defecto para adelantar el aprendizaje (RF-406). */
export const DEFAULT_LOOKAHEAD_MS = 20 * 60 * 1000;

function isLearning(card) {
  return card.state === 'learning' || card.state === 'relearning';
}

/**
 * Construye la cola de estudio del momento.
 *
 * Prioridad: primero lo que ya toca repasar (lo más atrasado antes), luego las
 * tarjetas en aprendizaje que ya han vencido, y al final las nuevas del día.
 * Los límites diarios evitan que un mazo grande se convierta en un muro.
 *
 * @spec RF-401 RF-402 RF-404 RF-406
 */
export function buildQueue(cards, opts = {}) {
  const now = opts.now ?? nowMs();
  const lookaheadMs = opts.lookaheadMs ?? 0;

  const due = [];
  const learning = [];
  const fresh = [];

  for (const card of cards) {
    if (card.state === 'new') {
      fresh.push(card);
    } else if (card.due <= now) {
      if (card.state === 'review') due.push(card);
      else learning.push(card);
    }
  }

  due.sort((a, b) => a.due - b.due);
  learning.sort((a, b) => a.due - b.due);

  // Los repasos vencidos no se recortan: el freno está en la entrada de
  // material nuevo, no en la salida (RF-403, retirado).
  const queue = [...due, ...learning, ...selectNew(fresh, opts)];
  if (queue.length || !lookaheadMs) return queue;

  // Nada vencido: antes de dar la sesión por terminada, adelanta el
  // aprendizaje que está a punto de tocar. Los repasos esperan a su día.
  return cards
    .filter((card) => isLearning(card) && card.due > now && card.due <= now + lookaheadMs)
    .sort((a, b) => a.due - b.due);
}

/**
 * Elige las tarjetas nuevas del día: hasta `newPerDay` por mazo, descontando lo
 * que ya se haya introducido hoy en cada uno, y alternando entre mazos para que
 * uno grande no monopolice la sesión (RF-402).
 */
function selectNew(fresh, opts) {
  const newPerDay = opts.newPerDay ?? 20;
  const introduced = opts.introducedByDeck ?? {};

  const porMazo = new Map();
  const orden = [...fresh].sort(
    (a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)),
  );
  for (const card of orden) {
    if (!porMazo.has(card.deckId)) porMazo.set(card.deckId, []);
    const cupo = Math.max(0, newPerDay - (introduced[card.deckId] ?? 0));
    const lista = porMazo.get(card.deckId);
    if (lista.length < cupo) lista.push(card);
  }

  // Reparto por turnos: una de cada mazo, y vuelta a empezar.
  const salida = [];
  const listas = [...porMazo.values()];
  for (let i = 0; salida.length < listas.reduce((n, l) => n + l.length, 0); i += 1) {
    for (const lista of listas) if (i < lista.length) salida.push(lista[i]);
  }
  return salida;
}

/**
 * Cuántas tarjetas nuevas de un mazo se pueden estudiar todavía hoy.
 *
 * @spec RF-402
 */
export function newAllowedToday(deckId, opts = {}) {
  const newPerDay = opts.newPerDay ?? 20;
  const introduced = opts.introducedByDeck ?? {};
  return Math.max(0, newPerDay - (introduced[deckId] ?? 0));
}

/**
 * Instante en el que la primera tarjeta pasará a estar disponible, o null si no
 * hay ninguna esperando. Sirve para refrescar la pantalla sola (RF-407).
 *
 * @spec RF-407
 */
export function nextAvailableAt(cards, opts = {}) {
  const now = opts.now ?? nowMs();
  const lookaheadMs = opts.lookaheadMs ?? 0;
  let best = null;
  for (const card of cards) {
    if (card.state === 'new') continue;
    const at = isLearning(card) ? card.due - lookaheadMs : card.due;
    if (at <= now) return now;
    if (best == null || at < best) best = at;
  }
  return best;
}

/**
 * Por qué no hay nada que estudiar. Devuelve un código estable (para poder
 * probarlo) y el texto que se enseña.
 *
 * @spec RF-306
 */
export function emptyQueueReason(cards, opts = {}) {
  const now = opts.now ?? nowMs();
  const newPerDay = opts.newPerDay ?? 20;

  if (!cards.length) {
    return { code: 'sin-tarjetas', message: 'Aquí todavía no hay tarjetas.' };
  }

  const c = counts(cards, { now });

  // El cupo es por mazo, así que solo se ha agotado si ningún mazo con nuevas
  // pendientes tiene hueco libre.
  const conHueco = new Set(
    cards
      .filter((card) => card.state === 'new')
      .map((card) => card.deckId)
      .filter((deckId) => newAllowedToday(deckId, opts) > 0),
  );

  if (c.nuevas > 0 && conHueco.size === 0) {
    return {
      code: 'limite-nuevas',
      message: `Has alcanzado el límite de ${newPerDay} tarjetas nuevas por mazo de hoy. Quedan ${c.nuevas} sin empezar.`,
    };
  }

  const next = nextAvailableAt(cards, { now });
  if (next != null && next > now) {
    return {
      code: 'al-dia',
      message: `Todo repasado. La siguiente tarjeta vuelve en ${formatDelay(next - now)}.`,
    };
  }
  return { code: 'al-dia', message: 'Todo repasado por hoy.' };
}

/**
 * Resumen de un mazo para la pantalla de mazos: lo que toca hoy, ya descontado
 * el cupo de nuevas consumido.
 *
 * @spec RF-110
 */
export function deckSummary(deck, cards, opts = {}) {
  const now = opts.now ?? nowMs();
  const propias = cards.filter((c) => c.deckId === deck.id);
  const c = counts(propias, { now });
  const nuevasHoy = Math.min(c.nuevas, newAllowedToday(deck.id, opts));
  return {
    deck,
    total: c.total,
    nuevas: c.nuevas,
    nuevasHoy,
    aprendiendo: c.aprendiendo,
    repaso: c.repaso,
    pendientes: nuevasHoy + c.aprendiendo + c.repaso,
  };
}

/** @spec RF-110 */
export function deckSummaries(decks, cards, opts = {}) {
  return decks.map((deck) => deckSummary(deck, cards, opts));
}

/**
 * Tarjetas que se olvidan una y otra vez. Casi siempre están mal escritas, no
 * mal memorizadas.
 *
 * @spec RF-505
 */
export function leeches(cards, opts = {}) {
  const minLapses = opts.minLapses ?? 5;
  return cards
    .filter((c) => c.lapses >= minLapses)
    .sort((a, b) => b.lapses - a.lapses || String(a.id).localeCompare(String(b.id)));
}

/** Contadores para la cabecera de la sesión. */
export function counts(cards, opts = {}) {
  const now = opts.now ?? nowMs();
  const out = { nuevas: 0, aprendiendo: 0, repaso: 0, total: cards.length };
  for (const card of cards) {
    if (card.state === 'new') out.nuevas += 1;
    else if (card.due <= now) {
      if (card.state === 'review') out.repaso += 1;
      else out.aprendiendo += 1;
    }
  }
  return out;
}
