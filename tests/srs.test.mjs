// Verifica specs/03-motor.md (invariantes) y los requisitos RF-4xx de
// specs/02-requisitos.md. El identificador entre corchetes es lo que ata cada
// prueba a su requisito; lo comprueba tools/trazabilidad.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CONFIG,
  DEFAULT_LOOKAHEAD_MS,
  GRADE,
  buildQueue,
  counts,
  createCard,
  dayStart,
  emptyQueueReason,
  formatDelay,
  nextAvailableAt,
  previewIntervals,
  review,
} from '../js/srs.js';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

// Sin dispersión aleatoria, para poder comprobar intervalos exactos.
const opts = { now: NOW, config: { ...DEFAULT_CONFIG, fuzz: false }, rng: () => 0.5 };

function fresh(overrides = {}) {
  const base = createCard({ id: 'c1', deckId: 'd1', front: 'a', back: 'b', createdAt: NOW });
  return { ...base, ...overrides };
}

function reviewing(interval, ease = 2.5) {
  return fresh({ state: 'review', interval, ease, due: NOW, reps: 3 });
}

// --- Pasos de aprendizaje -------------------------------------------------

test('[INV-102] una tarjeta nueva empieza en el primer paso de aprendizaje', () => {
  const out = review(fresh(), GRADE.GOOD, opts);
  assert.equal(out.state, 'learning');
  assert.equal(out.step, 1);
  assert.equal(out.due - NOW, 10 * MIN);
});

test('[INV-102] "Fallo" en aprendizaje vuelve al primer paso', () => {
  const out = review(fresh({ state: 'learning', step: 1 }), GRADE.AGAIN, opts);
  assert.equal(out.step, 0);
  assert.equal(out.due - NOW, 1 * MIN);
});

test('[INV-102] "Difícil" en aprendizaje repite el paso y espera más que "Fallo"', () => {
  const primera = review(fresh(), GRADE.HARD, opts);
  assert.equal(primera.step, 0);
  assert.equal(primera.due - NOW, 5.5 * MIN); // media entre 1 y 10 minutos

  const ultima = review(fresh({ state: 'learning', step: 1 }), GRADE.HARD, opts);
  assert.equal(ultima.step, 1);
  assert.equal(ultima.due - NOW, 15 * MIN);
});

test('[INV-102] "Bien" en el último paso gradúa a repaso con 1 día', () => {
  const out = review(fresh({ state: 'learning', step: 1 }), GRADE.GOOD, opts);
  assert.equal(out.state, 'review');
  assert.equal(out.interval, 1);
  assert.equal(out.due - NOW, DAY);
});

test('[INV-102] "Fácil" salta el aprendizaje y gradúa con 4 días', () => {
  const out = review(fresh(), GRADE.EASY, opts);
  assert.equal(out.state, 'review');
  assert.equal(out.interval, 4);
});

// --- Repaso ---------------------------------------------------------------

test('[INV-104] "Bien" en repaso multiplica el intervalo por la facilidad', () => {
  const out = review(reviewing(10, 2.5), GRADE.GOOD, opts);
  assert.equal(out.interval, 25);
  assert.equal(out.ease, 2.5);
});

test('[INV-104] "Difícil" alarga poco y baja la facilidad', () => {
  const out = review(reviewing(10, 2.5), GRADE.HARD, opts);
  assert.equal(out.interval, 12);
  assert.equal(out.ease, 2.35);
});

test('[INV-104] "Fácil" alarga más y sube la facilidad', () => {
  const out = review(reviewing(10, 2.5), GRADE.EASY, opts);
  assert.equal(out.interval, 33); // 10 × 2,5 × 1,3
  assert.equal(out.ease, 2.65);
});

test('[INV-104] acertar siempre alarga al menos un día, incluso con facilidad mínima', () => {
  for (const ease of [1.3, 1.5, 2.5]) {
    for (const prev of [1, 2, 3, 10, 100]) {
      for (const grade of [GRADE.HARD, GRADE.GOOD, GRADE.EASY]) {
        const out = review(reviewing(prev, ease), grade, opts);
        assert.ok(
          out.interval >= prev + 1,
          `p=${prev} f=${ease} respuesta=${grade}: ${out.interval} no supera a ${prev}`,
        );
      }
    }
  }
});

test('[INV-103] la facilidad nunca baja del mínimo', () => {
  let card = reviewing(5, 1.35);
  for (let i = 0; i < 5; i += 1) card = review(card, GRADE.AGAIN, opts);
  assert.equal(card.ease, DEFAULT_CONFIG.minEase);
});

test('[INV-105] el intervalo tiene un techo de cinco años', () => {
  const out = review(reviewing(DEFAULT_CONFIG.maxInterval, 2.5), GRADE.EASY, opts);
  assert.equal(out.interval, DEFAULT_CONFIG.maxInterval);
});

test('[INV-106] "Fallo" en repaso manda a reaprendizaje y parte el intervalo', () => {
  const out = review(reviewing(20, 2.5), GRADE.AGAIN, opts);
  assert.equal(out.state, 'relearning');
  assert.equal(out.lapses, 1);
  assert.equal(out.ease, 2.3);
  assert.equal(out.interval, 10);
  assert.equal(out.due - NOW, 10 * MIN);
});

test('[INV-107] al superar el reaprendizaje se recupera el intervalo reducido', () => {
  const fallada = review(reviewing(60, 2.5), GRADE.AGAIN, opts);
  const recuperada = review(fallada, GRADE.GOOD, { ...opts, now: NOW + 10 * MIN });
  assert.equal(recuperada.state, 'review');
  assert.equal(recuperada.interval, 30);
});

// --- Invariantes generales ------------------------------------------------

test('[INV-101] review no modifica la tarjeta que recibe', () => {
  const card = reviewing(10);
  const copia = structuredClone(card);
  review(card, GRADE.EASY, opts);
  assert.deepEqual(card, copia);
});

test('[INV-102] los cuatro plazos están siempre ordenados y son distintos', () => {
  const casos = [fresh(), fresh({ state: 'learning', step: 0 }), fresh({ state: 'learning', step: 1 })];
  for (const ease of [1.3, 1.6, 2.0, 2.5, 3.4]) {
    for (const interval of [1, 2, 3, 7, 21, 90, 400]) {
      casos.push(reviewing(interval, ease));
      casos.push(fresh({ state: 'relearning', step: 0, interval, ease }));
    }
  }

  for (const card of casos) {
    const p = previewIntervals(card, opts);
    const etiqueta = `${card.state} i=${card.interval} f=${card.ease}`;
    assert.ok(p[GRADE.AGAIN] < p[GRADE.HARD], `${etiqueta}: Fallo no es menor que Difícil`);
    assert.ok(p[GRADE.HARD] < p[GRADE.GOOD], `${etiqueta}: Difícil no es menor que Bien`);
    assert.ok(p[GRADE.GOOD] < p[GRADE.EASY], `${etiqueta}: Bien no es menor que Fácil`);
  }
});

test('[INV-108] la dispersión solo toca intervalos de 3 días o más y se queda en ±5 %', () => {
  const sinDispersion = review(reviewing(100, 2.5), GRADE.GOOD, opts).interval;

  for (const valor of [0, 0.25, 0.5, 0.75, 1]) {
    const conDispersion = review(reviewing(100, 2.5), GRADE.GOOD, {
      now: NOW,
      rng: () => valor,
    }).interval;
    const desvio = Math.abs(conDispersion - sinDispersion) / sinDispersion;
    assert.ok(desvio <= 0.06, `desvío del ${(desvio * 100).toFixed(1)} % con rng=${valor}`);
  }

  // Un intervalo de 2 días no se dispersa: se repite exacto con cualquier azar.
  const cortos = new Set(
    [0, 0.5, 1].map(
      (valor) => review(fresh({ state: 'learning', step: 1 }), GRADE.GOOD, { now: NOW, rng: () => valor }).interval,
    ),
  );
  assert.equal(cortos.size, 1);
});

test('[INV-109] fallar una y otra vez mantiene la tarjeta a pocos días', () => {
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

test('[INV-110] acertar seis veces seguidas pasa del mes', () => {
  let card = fresh();
  let now = NOW;
  for (let i = 0; i < 6; i += 1) {
    card = review(card, GRADE.GOOD, { ...opts, now });
    now = card.due;
  }
  assert.ok(card.interval > 30, `esperaba más de 30 días, salió ${card.interval}`);
});

// --- Cola de estudio ------------------------------------------------------

test('[RF-401] la cola pone primero los repasos vencidos y deja las nuevas al final', () => {
  const cards = [
    fresh({ id: 'nueva' }),
    reviewing(5),
    fresh({ id: 'aprendiendo', state: 'learning', due: NOW - MIN }),
    fresh({ id: 'futura', state: 'review', interval: 5, due: NOW + DAY }),
  ];
  assert.deepEqual(
    buildQueue(cards, { now: NOW }).map((c) => c.id),
    ['c1', 'aprendiendo', 'nueva'],
  );
});

test('[RF-401] dentro de cada grupo va antes lo más atrasado', () => {
  const cards = [
    { ...reviewing(5), id: 'reciente', due: NOW - MIN },
    { ...reviewing(5), id: 'antigua', due: NOW - 5 * DAY },
    { ...reviewing(5), id: 'media', due: NOW - DAY },
  ];
  assert.deepEqual(
    buildQueue(cards, { now: NOW }).map((c) => c.id),
    ['antigua', 'media', 'reciente'],
  );
});

test('[RF-402] la cola respeta el límite diario de tarjetas nuevas', () => {
  const cards = [fresh({ id: 'a' }), fresh({ id: 'b' }), fresh({ id: 'c' })];
  assert.equal(buildQueue(cards, { now: NOW, newPerDay: 2 }).length, 2);
  assert.equal(buildQueue(cards, { now: NOW, newPerDay: 2, introducedToday: 2 }).length, 0);
  assert.equal(buildQueue(cards, { now: NOW, newPerDay: 0 }).length, 0);
});

test('[RF-401] los repasos vencidos se ofrecen todos, sin tope diario', () => {
  const cards = Array.from({ length: 300 }, (_, i) => ({
    ...reviewing(5),
    id: `c${i}`,
    due: NOW - (i + 1) * MIN,
  }));
  assert.equal(buildQueue(cards, { now: NOW, newPerDay: 0 }).length, 300);
});

test('[RF-404] el aprendizaje ya empezado no se corta por los límites', () => {
  const cards = [
    fresh({ id: 'l', state: 'learning', due: NOW - MIN }),
    fresh({ id: 'r', state: 'relearning', due: NOW - MIN, interval: 3 }),
  ];
  const queue = buildQueue(cards, { now: NOW, newPerDay: 0, introducedToday: 999 });
  assert.equal(queue.length, 2);
});

test('[RF-406] con nada vencido se adelanta el aprendizaje cercano', () => {
  const cards = [
    fresh({ id: 'pronto', state: 'learning', due: NOW + 3 * MIN }),
    fresh({ id: 'tarde', state: 'learning', due: NOW + 60 * MIN }),
  ];
  const queue = buildQueue(cards, { now: NOW, lookaheadMs: DEFAULT_LOOKAHEAD_MS });
  assert.deepEqual(
    queue.map((c) => c.id),
    ['pronto'],
  );
});

test('[RF-406] el adelanto no saca repasos antes de su día', () => {
  const cards = [fresh({ id: 'r', state: 'review', interval: 5, due: NOW + 3 * MIN })];
  assert.equal(buildQueue(cards, { now: NOW, lookaheadMs: DEFAULT_LOOKAHEAD_MS }).length, 0);
});

test('[RF-406] sin ventana de adelanto la cola solo trae lo vencido', () => {
  const cards = [fresh({ id: 'pronto', state: 'learning', due: NOW + 3 * MIN })];
  assert.equal(buildQueue(cards, { now: NOW }).length, 0);
});

test('[RF-407] nextAvailableAt descuenta la ventana de adelanto', () => {
  const cards = [fresh({ id: 'l', state: 'learning', due: NOW + 25 * MIN })];
  assert.equal(
    nextAvailableAt(cards, { now: NOW, lookaheadMs: DEFAULT_LOOKAHEAD_MS }),
    NOW + 5 * MIN,
  );
  assert.equal(nextAvailableAt([fresh()], { now: NOW }), null);
});

test('[RF-401] los contadores separan nuevas, aprendiendo y repaso', () => {
  const cards = [
    fresh(),
    fresh({ id: 'l', state: 'learning', due: NOW - MIN }),
    reviewing(5),
    fresh({ id: 'futura', state: 'review', interval: 5, due: NOW + DAY }),
  ];
  assert.deepEqual(counts(cards, { now: NOW }), { nuevas: 1, aprendiendo: 1, repaso: 1, total: 4 });
});

// --- Por qué no hay nada que estudiar -------------------------------------

test('[RF-306] un mazo vacío lo dice', () => {
  assert.equal(emptyQueueReason([], { now: NOW }).code, 'sin-tarjetas');
});

test('[RF-306] con el límite de nuevas alcanzado se dice cuántas quedan', () => {
  const cards = [fresh({ id: 'a' }), fresh({ id: 'b' })];
  const motivo = emptyQueueReason(cards, { now: NOW, newPerDay: 5, introducedToday: 5 });
  assert.equal(motivo.code, 'limite-nuevas');
  assert.match(motivo.message, /límite de 5/);
  assert.match(motivo.message, /Quedan 2/);
});

test('[RF-306] nunca se habla de un límite de repasos', () => {
  // Un repaso vencido nunca deja la cola vacía, así que el único motivo posible
  // con tarjetas pendientes es el de las nuevas.
  const motivo = emptyQueueReason([{ ...reviewing(5), due: NOW + 2 * DAY }], {
    now: NOW,
    newPerDay: 20,
  });
  assert.equal(motivo.code, 'al-dia');
  assert.match(motivo.message, /vuelve en 2 d/);
});

test('[RF-306] al día se dice cuándo vuelve la siguiente tarjeta', () => {
  const motivo = emptyQueueReason([{ ...reviewing(5), due: NOW + 3 * DAY }], { now: NOW });
  assert.equal(motivo.code, 'al-dia');
  assert.match(motivo.message, /3 d/);
});

// --- Utilidades -----------------------------------------------------------

test('[RF-304] formatDelay usa unidades legibles', () => {
  assert.equal(formatDelay(60 * 1000), '1 min');
  assert.equal(formatDelay(45 * MIN), '45 min');
  assert.equal(formatDelay(3 * 60 * MIN), '3 h');
  assert.equal(formatDelay(5 * DAY), '5 d');
  assert.equal(formatDelay(60 * DAY), '2,0 meses');
  assert.equal(formatDelay(400 * DAY), '1,1 años');
});

test('[RF-405] el día de estudio empieza a las 4 de la mañana', () => {
  const madrugada = new Date(2026, 0, 15, 2, 30).getTime();
  const tarde = new Date(2026, 0, 15, 22, 0).getTime();
  assert.equal(dayStart(madrugada), new Date(2026, 0, 14, 4, 0, 0, 0).getTime());
  assert.equal(dayStart(tarde), new Date(2026, 0, 15, 4, 0, 0, 0).getTime());
});
