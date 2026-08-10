import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CONFIG,
  GRADE,
  buildQueue,
  counts,
  createCard,
  dayStart,
  formatDelay,
  previewIntervals,
  review,
} from '../js/srs.js';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

// Sin dispersión aleatoria, para poder comprobar intervalos exactos.
const opts = { now: NOW, config: { ...DEFAULT_CONFIG, fuzz: false }, rng: () => 0.5 };

function fresh(overrides = {}) {
  return { ...createCard({ id: 'c1', deckId: 'd1', front: 'a', back: 'b', createdAt: NOW }), ...overrides };
}

function reviewing(interval, ease = 2.5) {
  return fresh({ state: 'review', interval, ease, due: NOW, reps: 3 });
}

test('una tarjeta nueva empieza en el primer paso de aprendizaje', () => {
  const out = review(fresh(), GRADE.GOOD, opts);
  assert.equal(out.state, 'learning');
  assert.equal(out.step, 1);
  assert.equal(out.due - NOW, 10 * MIN);
});

test('"Fallo" en aprendizaje vuelve al primer paso', () => {
  const learning = fresh({ state: 'learning', step: 1 });
  const out = review(learning, GRADE.AGAIN, opts);
  assert.equal(out.step, 0);
  assert.equal(out.due - NOW, 1 * MIN);
});

test('"Difícil" en aprendizaje repite el paso y espera más que "Fallo"', () => {
  const primera = review(fresh(), GRADE.HARD, opts);
  assert.equal(primera.step, 0);
  assert.equal(primera.due - NOW, 5.5 * MIN); // media entre 1 y 10 minutos

  const ultima = review(fresh({ state: 'learning', step: 1 }), GRADE.HARD, opts);
  assert.equal(ultima.step, 1);
  assert.equal(ultima.due - NOW, 15 * MIN);
});

test('en una tarjeta nueva los cuatro botones dan plazos distintos', () => {
  const preview = previewIntervals(fresh(), opts);
  const plazos = [preview[0], preview[1], preview[2], preview[3]];
  assert.deepEqual(plazos, [...plazos].sort((a, b) => a - b));
  assert.equal(new Set(plazos).size, 4);
});

test('"Bien" en el último paso gradúa a repaso con 1 día', () => {
  const out = review(fresh({ state: 'learning', step: 1 }), GRADE.GOOD, opts);
  assert.equal(out.state, 'review');
  assert.equal(out.interval, 1);
  assert.equal(out.due - NOW, DAY);
});

test('"Fácil" salta el aprendizaje y gradúa con 4 días', () => {
  const out = review(fresh(), GRADE.EASY, opts);
  assert.equal(out.state, 'review');
  assert.equal(out.interval, 4);
});

test('"Bien" en repaso multiplica el intervalo por la facilidad', () => {
  const out = review(reviewing(10, 2.5), GRADE.GOOD, opts);
  assert.equal(out.interval, 25);
  assert.equal(out.ease, 2.5);
});

test('"Difícil" alarga poco y baja la facilidad', () => {
  const out = review(reviewing(10, 2.5), GRADE.HARD, opts);
  assert.equal(out.interval, 12);
  assert.equal(out.ease, 2.35);
});

test('"Fácil" alarga más y sube la facilidad', () => {
  const out = review(reviewing(10, 2.5), GRADE.EASY, opts);
  assert.equal(out.interval, 33); // 10 * 2.5 * 1.3
  assert.equal(out.ease, 2.65);
});

test('el intervalo siempre crece al menos un día', () => {
  const out = review(reviewing(10, 1.3), GRADE.HARD, opts);
  assert.ok(out.interval > 10, `esperaba > 10, salió ${out.interval}`);
});

test('"Fallo" en repaso manda a reaprendizaje y parte el intervalo', () => {
  const out = review(reviewing(20, 2.5), GRADE.AGAIN, opts);
  assert.equal(out.state, 'relearning');
  assert.equal(out.lapses, 1);
  assert.equal(out.ease, 2.3);
  assert.equal(out.interval, 10);
  assert.equal(out.due - NOW, 10 * MIN);
});

test('al superar el reaprendizaje se recupera el intervalo reducido', () => {
  const fallada = review(reviewing(20, 2.5), GRADE.AGAIN, opts);
  const recuperada = review(fallada, GRADE.GOOD, { ...opts, now: NOW + 10 * MIN });
  assert.equal(recuperada.state, 'review');
  assert.equal(recuperada.interval, 10);
});

test('la facilidad nunca baja del mínimo', () => {
  let card = reviewing(5, 1.35);
  for (let i = 0; i < 5; i += 1) card = review(card, GRADE.AGAIN, opts);
  assert.equal(card.ease, DEFAULT_CONFIG.minEase);
});

test('el intervalo tiene un techo', () => {
  const out = review(reviewing(DEFAULT_CONFIG.maxInterval, 2.5), GRADE.EASY, opts);
  assert.equal(out.interval, DEFAULT_CONFIG.maxInterval);
});

test('review no modifica la tarjeta original', () => {
  const card = reviewing(10);
  const copy = { ...card };
  review(card, GRADE.EASY, opts);
  assert.deepEqual(card, copy);
});

test('acertar siempre da un plazo mayor que fallar', () => {
  const preview = previewIntervals(reviewing(10), opts);
  assert.ok(preview[GRADE.AGAIN] < preview[GRADE.HARD]);
  assert.ok(preview[GRADE.HARD] < preview[GRADE.GOOD]);
  assert.ok(preview[GRADE.GOOD] < preview[GRADE.EASY]);
});

test('un mal recuerdo repetido mantiene la tarjeta cerca en el tiempo', () => {
  // Diez ciclos de fallo -> aprobado justo: el intervalo no se dispara.
  let card = fresh();
  let now = NOW;
  for (let i = 0; i < 10; i += 1) {
    card = review(card, GRADE.AGAIN, { ...opts, now });
    now = card.due;
    card = review(card, GRADE.GOOD, { ...opts, now });
    now = card.due;
  }
  assert.ok(card.interval <= 3, `esperaba un intervalo corto, salió ${card.interval}`);
});

test('una tarjeta bien recordada se espacia rápido', () => {
  let card = fresh();
  let now = NOW;
  for (let i = 0; i < 6; i += 1) {
    card = review(card, GRADE.GOOD, { ...opts, now });
    now = card.due;
  }
  assert.ok(card.interval > 30, `esperaba más de 30 días, salió ${card.interval}`);
});

// --- Cola de estudio ------------------------------------------------------

test('la cola pone primero los repasos vencidos y deja las nuevas al final', () => {
  const cards = [
    fresh({ id: 'nueva' }),
    reviewing(5),
    fresh({ id: 'aprendiendo', state: 'learning', due: NOW - MIN }),
    fresh({ id: 'futura', state: 'review', interval: 5, due: NOW + DAY }),
  ];
  const queue = buildQueue(cards, { now: NOW });
  assert.deepEqual(
    queue.map((c) => c.id),
    ['c1', 'aprendiendo', 'nueva'],
  );
});

test('la cola respeta el límite diario de tarjetas nuevas', () => {
  const cards = [fresh({ id: 'a' }), fresh({ id: 'b' }), fresh({ id: 'c' })];
  const queue = buildQueue(cards, { now: NOW, newPerDay: 2 });
  assert.equal(queue.length, 2);
  assert.equal(buildQueue(cards, { now: NOW, newPerDay: 2, introducedToday: 2 }).length, 0);
});

test('la cola respeta el límite diario de repasos', () => {
  const cards = [reviewing(5), { ...reviewing(5), id: 'c2' }];
  const queue = buildQueue(cards, { now: NOW, maxReviewsPerDay: 1, newPerDay: 0 });
  assert.equal(queue.length, 1);
});

test('el aprendizaje pendiente no se corta por el límite de repasos', () => {
  const cards = [fresh({ id: 'l', state: 'learning', due: NOW - MIN })];
  const queue = buildQueue(cards, { now: NOW, maxReviewsPerDay: 0, newPerDay: 0 });
  assert.equal(queue.length, 1);
});

test('los contadores separan nuevas, aprendiendo y repaso', () => {
  const cards = [
    fresh(),
    fresh({ id: 'l', state: 'learning', due: NOW - MIN }),
    reviewing(5),
    fresh({ id: 'futura', state: 'review', interval: 5, due: NOW + DAY }),
  ];
  assert.deepEqual(counts(cards, { now: NOW }), {
    nuevas: 1,
    aprendiendo: 1,
    repaso: 1,
    total: 4,
  });
});

// --- Utilidades -----------------------------------------------------------

test('formatDelay usa unidades legibles', () => {
  assert.equal(formatDelay(60 * 1000), '1 min');
  assert.equal(formatDelay(45 * MIN), '45 min');
  assert.equal(formatDelay(3 * 60 * MIN), '3 h');
  assert.equal(formatDelay(5 * DAY), '5 d');
  assert.equal(formatDelay(60 * DAY), '2,0 meses');
  assert.equal(formatDelay(400 * DAY), '1,1 años');
});

test('el día de estudio empieza a las 4 de la mañana', () => {
  const madrugada = new Date(2026, 0, 15, 2, 30).getTime();
  const tarde = new Date(2026, 0, 15, 22, 0).getTime();
  assert.equal(dayStart(madrugada), new Date(2026, 0, 14, 4, 0, 0, 0).getTime());
  assert.equal(dayStart(tarde), new Date(2026, 0, 15, 4, 0, 0, 0).getTime());
});
