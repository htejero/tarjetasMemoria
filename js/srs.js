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
    // Vuelve al intervalo reducido que se guardó al fallar; "Fácil" lo premia.
    const base = Math.max(config.minLapseInterval, card.interval || config.graduatingInterval);
    next.interval = clampInterval(easy ? base * config.easyBonus : base, config);
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

  let ease = card.ease;
  let days;

  if (grade === GRADE.HARD) {
    ease = clampEase(card.ease - 0.15, config);
    days = prev * config.hardFactor;
  } else if (grade === GRADE.GOOD) {
    days = prev * card.ease;
  } else {
    ease = clampEase(card.ease + 0.15, config);
    days = prev * card.ease * config.easyBonus;
  }

  // Garantiza progreso: siempre al menos un día más que el intervalo anterior.
  days = Math.max(days, prev + 1);

  next.state = 'review';
  next.step = 0;
  next.ease = ease;
  next.interval = clampInterval(applyFuzz(clampInterval(days, config), config, rng), config);
  next.due = now + next.interval * DAY;
  return next;
}

/**
 * Calcula, sin modificar nada, cuándo volvería cada tarjeta según la respuesta.
 * Se usa para pintar el intervalo debajo de cada botón.
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

/** Momento en el que empieza el "día de estudio" (por defecto, las 4 de la mañana). */
export function dayStart(ts, cutoffHour = 4) {
  const d = new Date(ts);
  if (d.getHours() < cutoffHour) d.setDate(d.getDate() - 1);
  d.setHours(cutoffHour, 0, 0, 0);
  return d.getTime();
}

export function isDue(card, now = nowMs()) {
  return card.due <= now;
}

/**
 * Construye la cola de estudio del momento.
 *
 * Prioridad: primero lo que ya toca repasar (lo más atrasado antes), luego las
 * tarjetas en aprendizaje que ya han vencido, y al final las nuevas del día.
 * Los límites diarios evitan que un mazo grande se convierta en un muro.
 */
export function buildQueue(cards, opts = {}) {
  const now = opts.now ?? nowMs();
  const newPerDay = opts.newPerDay ?? 20;
  const maxReviewsPerDay = opts.maxReviewsPerDay ?? 200;
  const introducedToday = opts.introducedToday ?? 0;
  const reviewedToday = opts.reviewedToday ?? 0;

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
  fresh.sort((a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));

  const reviewSlots = Math.max(0, maxReviewsPerDay - reviewedToday);
  const newSlots = Math.max(0, newPerDay - introducedToday);

  return [...due.slice(0, reviewSlots), ...learning, ...fresh.slice(0, newSlots)];
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
