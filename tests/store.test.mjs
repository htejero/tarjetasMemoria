// Verifica el almacenamiento y las reglas de datos de specs/04-datos.md.
//
// Se ejecuta en Node con un localStorage de mentira, porque el guardado no
// depende del navegador más allá de esa interfaz.

import test from 'node:test';
import assert from 'node:assert/strict';

class AlmacenFalso {
  constructor() {
    this.datos = new Map();
    this.fallaAlEscribir = false;
  }
  getItem(clave) {
    return this.datos.has(clave) ? this.datos.get(clave) : null;
  }
  setItem(clave, valor) {
    if (this.fallaAlEscribir) throw new Error('QuotaExceededError');
    this.datos.set(clave, String(valor));
  }
  removeItem(clave) {
    this.datos.delete(clave);
  }
}

const almacen = new AlmacenFalso();
const avisos = [];
globalThis.localStorage = almacen;
globalThis.alert = (mensaje) => avisos.push(mensaje);

const store = await import('../js/store.js');
const { GRADE, review } = await import('../js/srs.js');

const CLAVE = 'tarjetasMemoria.v1';

function limpiar() {
  almacen.fallaAlEscribir = false;
  almacen.datos.clear();
  avisos.length = 0;
  store.reset();
}

function mazoPorDefecto() {
  return store.decks()[0].id;
}

// --- Tarjetas -------------------------------------------------------------

test('[RF-101] una tarjeta nueva nace lista para estudiarse', () => {
  limpiar();
  const card = store.addCard({ deckId: mazoPorDefecto(), front: 'a', back: 'b', tags: ['x'] });
  assert.equal(card.state, 'new');
  assert.equal(card.reps, 0);
  assert.deepEqual(card.tags, ['x']);
  assert.equal(store.cards().length, 1);
});

test('[RF-102] editar el texto no toca el progreso', () => {
  limpiar();
  const card = store.addCard({ deckId: mazoPorDefecto(), front: 'a', back: 'b' });
  const estudiada = review(card, GRADE.EASY);
  store.recordReview(card, estudiada, GRADE.EASY);

  const antes = store.cards()[0];
  store.updateCard(card.id, { front: 'a corregida', back: 'b corregida', tags: ['nueva'] });
  const despues = store.cards()[0];

  assert.equal(despues.front, 'a corregida');
  assert.deepEqual(despues.tags, ['nueva']);
  assert.equal(despues.state, antes.state);
  assert.equal(despues.interval, antes.interval);
  assert.equal(despues.ease, antes.ease);
  assert.equal(despues.due, antes.due);
  assert.equal(despues.reps, antes.reps);
});

test('[RF-103] borrar una tarjeta la quita del almacenamiento', () => {
  limpiar();
  const a = store.addCard({ deckId: mazoPorDefecto(), front: 'a', back: 'b' });
  store.addCard({ deckId: mazoPorDefecto(), front: 'c', back: 'd' });
  store.deleteCard(a.id);
  assert.deepEqual(
    store.cards().map((c) => c.front),
    ['c'],
  );
  assert.equal(JSON.parse(almacen.getItem(CLAVE)).cards.length, 1);
});

test('[RF-109] reiniciar devuelve la tarjeta a nueva sin tocar el texto', () => {
  limpiar();
  const card = store.addCard({ deckId: mazoPorDefecto(), front: 'a', back: 'b', tags: ['t'] });
  let estudiada = review(card, GRADE.EASY);
  store.recordReview(card, estudiada, GRADE.EASY);
  estudiada = review(estudiada, GRADE.AGAIN);
  store.recordReview(store.cards()[0], estudiada, GRADE.AGAIN);
  assert.ok(store.cards()[0].reps > 0);

  const reiniciada = store.resetCard(card.id);
  assert.equal(reiniciada.state, 'new');
  assert.equal(reiniciada.interval, 0);
  assert.equal(reiniciada.ease, 2.5);
  assert.equal(reiniciada.reps, 0);
  assert.equal(reiniciada.lapses, 0);
  assert.ok(reiniciada.due <= Date.now());
  assert.equal(reiniciada.front, 'a');
  assert.deepEqual(reiniciada.tags, ['t']);
});

// --- Mazos ----------------------------------------------------------------

test('[RF-106] se crean y se renombran mazos sin tocar sus tarjetas', () => {
  limpiar();
  const mazo = store.addDeck('Francés');
  store.addCard({ deckId: mazo.id, front: 'chien', back: 'perro' });
  store.renameDeck(mazo.id, 'Francés A1');
  assert.equal(store.decks().find((d) => d.id === mazo.id).name, 'Francés A1');
  assert.equal(store.cards(mazo.id).length, 1);
});

test('[RF-106] nunca se puede quedar sin mazos', () => {
  limpiar();
  assert.equal(store.decks().length, 1);
  assert.equal(store.deleteDeck(mazoPorDefecto()), false);
  assert.equal(store.decks().length, 1);
});

test('[RF-107] borrar un mazo se lleva sus tarjetas y solo las suyas', () => {
  limpiar();
  const otro = store.addDeck('Otro');
  store.addCard({ deckId: mazoPorDefecto(), front: 'queda', back: 'x' });
  store.addCard({ deckId: otro.id, front: 'se va', back: 'y' });

  assert.equal(store.deleteDeck(otro.id), true);
  assert.deepEqual(
    store.cards().map((c) => c.front),
    ['queda'],
  );
});

// --- Importación ----------------------------------------------------------

test('[RF-205] no se importan preguntas que ya existen en el mazo', () => {
  limpiar();
  const deckId = mazoPorDefecto();
  store.importCards({ cards: [{ front: 'perro', back: 'dog', tags: [] }] }, deckId);

  const resultado = store.importCards(
    {
      cards: [
        { front: '  PERRO  ', back: 'dog', tags: [] },
        { front: 'gato', back: 'cat', tags: [] },
      ],
    },
    deckId,
  );

  assert.equal(resultado.added, 1);
  assert.equal(resultado.skipped, 1);
  assert.equal(store.cards(deckId).length, 2);
});

test('[RF-205] la misma pregunta puede existir en dos mazos distintos', () => {
  limpiar();
  const otro = store.addDeck('Otro');
  store.importCards({ cards: [{ front: 'perro', back: 'dog', tags: [] }] }, mazoPorDefecto());
  const resultado = store.importCards({ cards: [{ front: 'perro', back: 'dog', tags: [] }] }, otro.id);
  assert.equal(resultado.added, 1);
});

test('[RF-206] el mazo seleccionado manda sobre el nombre del fichero', () => {
  limpiar();
  const destino = store.addDeck('Destino');
  const resultado = store.importCards(
    { deckName: 'Otro nombre', cards: [{ front: 'a', back: 'b', tags: [] }] },
    destino.id,
  );
  assert.equal(resultado.deckId, destino.id);
  assert.equal(store.decks().length, 2); // no se ha creado "Otro nombre"
});

test('[RF-206] sin mazo seleccionado se usa el que nombre el fichero, creándolo', () => {
  limpiar();
  const resultado = store.importCards(
    { deckName: 'Inglés básico', cards: [{ front: 'a', back: 'b', tags: [] }] },
    null,
  );
  assert.equal(resultado.deckName, 'Inglés básico');
  assert.equal(store.decks().length, 2);

  // La segunda vez reutiliza el mazo en lugar de duplicarlo.
  store.importCards({ deckName: 'Inglés básico', cards: [{ front: 'c', back: 'd', tags: [] }] }, null);
  assert.equal(store.decks().length, 2);
  assert.equal(store.cards(resultado.deckId).length, 2);
});

test('[RF-206] sin mazo seleccionado ni nombre se usa el primero', () => {
  limpiar();
  store.addDeck('Segundo');
  const resultado = store.importCards({ cards: [{ front: 'a', back: 'b', tags: [] }] }, null);
  assert.equal(resultado.deckId, mazoPorDefecto());
});

// --- Copia de seguridad ---------------------------------------------------

test('[RF-208] la copia de seguridad reproduce el estado exacto', () => {
  limpiar();
  const card = store.addCard({ deckId: mazoPorDefecto(), front: 'a', back: 'b' });
  store.recordReview(card, review(card, GRADE.GOOD), GRADE.GOOD);
  store.updateSettings({ newPerDay: 7 });

  const copia = store.exportState();
  const antes = JSON.parse(copia);

  store.reset();
  assert.equal(store.cards().length, 0);

  store.importState(copia);
  assert.deepEqual(store.cards(), antes.cards);
  assert.equal(store.settings().newPerDay, 7);
  assert.deepEqual(store.decks(), antes.decks);
});

test('[RF-208] el fichero se llama con la fecha del día', () => {
  assert.equal(store.backupFilename(new Date(2026, 7, 9, 18, 0).getTime()), 'tarjetas-2026-08-09.json');
});

test('[RF-209] restaurar sustituye todo el contenido anterior', () => {
  limpiar();
  store.addCard({ deckId: mazoPorDefecto(), front: 'vieja', back: 'x' });
  const copia = store.exportState();

  store.reset();
  store.addCard({ deckId: mazoPorDefecto(), front: 'intermedia', back: 'y' });
  store.importState(copia);

  assert.deepEqual(
    store.cards().map((c) => c.front),
    ['vieja'],
  );
});

test('[RF-209] una copia incompleta se completa en lugar de rechazarse', () => {
  limpiar();
  // Copia de una versión anterior: sin ajustes, sin historial, sin etiquetas y
  // con una tarjeta que apunta a un mazo que ya no existe.
  store.importState({
    version: 1,
    decks: [{ id: 'd1', name: 'Viejo' }],
    cards: [{ id: 'c1', deckId: 'borrado', front: 'a', back: 'b', state: 'new', due: 0 }],
  });

  assert.equal(store.cards().length, 1);
  assert.equal(store.cards()[0].deckId, 'd1'); // reasignada al primer mazo
  assert.deepEqual(store.cards()[0].tags, []);
  assert.equal(store.settings().newPerDay, 20);
});

test('[RF-209] un fichero sin tarjetas se rechaza con un error claro', () => {
  limpiar();
  assert.throws(() => store.importState('{"version":1}'), /no tiene tarjetas/);
});

// --- Ajustes y progreso ---------------------------------------------------

test('[RF-501] el límite por defecto es de 20 nuevas al día', () => {
  limpiar();
  assert.equal(store.settings().newPerDay, 20);
});

test('[RF-501] el límite se cambia y persiste, y no hay tope de repasos', () => {
  limpiar();
  store.updateSettings({ newPerDay: 5 });
  store.reload();
  assert.equal(store.settings().newPerDay, 5);
  assert.equal(store.settings().maxReviewsPerDay, undefined);
});

test('[RF-501] una copia antigua pierde el tope de repasos al cargarse', () => {
  limpiar();
  store.importState({
    version: 1,
    decks: [{ id: 'd1', name: 'Viejo' }],
    cards: [],
    settings: { newPerDay: 20, maxReviewsPerDay: 200, cutoffHour: 4 },
    daily: { day: 0, introduced: 0, reviewed: 41 },
  });
  assert.equal(store.settings().maxReviewsPerDay, undefined);
  assert.equal(store.daily().reviewed, undefined);
});

test('[RF-502] las estadísticas cuentan aciertos y respuestas', () => {
  limpiar();
  const card = store.addCard({ deckId: mazoPorDefecto(), front: 'a', back: 'b' });
  let actual = card;
  for (const grade of [GRADE.GOOD, GRADE.AGAIN, GRADE.GOOD, GRADE.EASY]) {
    const siguiente = review(actual, grade);
    store.recordReview(actual, siguiente, grade);
    actual = siguiente;
  }
  const st = store.stats();
  assert.equal(st.total, 1);
  assert.equal(st.doneToday, 4);
  assert.equal(st.semana, 4);
  assert.equal(st.retencion, 75); // 3 de 4 distintas de Fallo
});

test('[RF-502] sin respuestas esta semana no se inventa un 0 %', () => {
  limpiar();
  assert.equal(store.stats().retencion, null);
});

test('[RF-503] borrar todo deja un mazo vacío y los ajustes por defecto', () => {
  limpiar();
  store.addDeck('Otro');
  store.addCard({ deckId: mazoPorDefecto(), front: 'a', back: 'b' });
  store.updateSettings({ newPerDay: 99 });

  store.reset();

  assert.equal(store.cards().length, 0);
  assert.equal(store.decks().length, 1);
  assert.equal(store.settings().newPerDay, 20);
});

test('[RF-405] los contadores del día se reinician al pasar de las 4:00', () => {
  limpiar();
  const card = store.addCard({ deckId: mazoPorDefecto(), front: 'a', back: 'b' });
  store.recordReview(card, review(card, GRADE.GOOD), GRADE.GOOD);
  assert.equal(store.daily().introduced, 1);

  const manana = Date.now() + 24 * 3600 * 1000;
  assert.equal(store.rollDay(manana).introduced, 0);
});

// --- Robustez -------------------------------------------------------------

test('[RNF-107] unos datos corruptos no impiden arrancar', () => {
  limpiar();
  almacen.datos.set(CLAVE, '{esto no es json');
  const estado = store.reload();
  assert.equal(estado.cards.length, 0);
  assert.equal(estado.decks.length, 1);
});

test('[RNF-107] si el almacenamiento falla se avisa y la app sigue', () => {
  limpiar();
  almacen.fallaAlEscribir = true;

  const card = store.addCard({ deckId: mazoPorDefecto(), front: 'a', back: 'b' });

  assert.equal(card.front, 'a');
  assert.equal(store.cards().length, 1); // sigue en memoria
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /No se pudo guardar/);
});
