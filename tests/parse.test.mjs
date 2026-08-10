import test from 'node:test';
import assert from 'node:assert/strict';

import { parseInput, splitLine } from '../js/parse.js';

test('lee líneas separadas por barra vertical', () => {
  const { kind, cards } = parseInput('¿Capital de Francia? | París\n¿Capital de Italia? | Roma');
  assert.equal(kind, 'cards');
  assert.deepEqual(cards, [
    { front: '¿Capital de Francia?', back: 'París', tags: [] },
    { front: '¿Capital de Italia?', back: 'Roma', tags: [] },
  ]);
});

test('lee CSV con cabecera y etiquetas', () => {
  const { cards } = parseInput('front,back,tags\nhola,hello,idiomas;ingles');
  assert.deepEqual(cards, [{ front: 'hola', back: 'hello', tags: ['idiomas', 'ingles'] }]);
});

test('acepta cabeceras en español', () => {
  const { cards } = parseInput('pregunta;respuesta\nuno;one');
  assert.deepEqual(cards, [{ front: 'uno', back: 'one', tags: [] }]);
});

test('respeta las comas dentro de comillas', () => {
  const { cards } = parseInput('"Rojo, verde y azul",Los colores primarios de la luz');
  assert.deepEqual(cards, [
    { front: 'Rojo, verde y azul', back: 'Los colores primarios de la luz', tags: [] },
  ]);
});

test('las comillas dobles escapadas se conservan', () => {
  assert.deepEqual(splitLine('"dice ""hola""",saludo', ','), ['dice "hola"', 'saludo']);
});

test('lee TSV', () => {
  const { cards } = parseInput('perro\tdog\ngato\tcat');
  assert.equal(cards.length, 2);
  assert.equal(cards[1].front, 'gato');
});

test('ignora líneas vacías y comentarios', () => {
  const { cards } = parseInput('# mi mazo\n\nuno | one\n\n dos | two \n');
  assert.deepEqual(
    cards.map((c) => c.front),
    ['uno', 'dos'],
  );
});

test('lee JSON con claves en inglés o en español', () => {
  const { cards } = parseInput(
    '[{"front":"a","back":"b"},{"pregunta":"c","respuesta":"d","etiquetas":["x"]}]',
  );
  assert.deepEqual(cards, [
    { front: 'a', back: 'b', tags: [] },
    { front: 'c', back: 'd', tags: ['x'] },
  ]);
});

test('lee JSON con nombre de mazo', () => {
  const { cards, deckName } = parseInput('{"mazo":"Francés","tarjetas":[["chien","perro"]]}');
  assert.equal(deckName, 'Francés');
  assert.deepEqual(cards, [{ front: 'chien', back: 'perro', tags: [] }]);
});

test('reconoce una copia de seguridad completa', () => {
  const backup = { version: 1, decks: [{ id: 'd', name: 'x' }], cards: [], settings: {} };
  const parsed = parseInput(JSON.stringify(backup));
  assert.equal(parsed.kind, 'backup');
  assert.deepEqual(parsed.backup.decks[0].name, 'x');
});

test('convierte \\n en saltos de línea reales', () => {
  const { cards } = parseInput('["pregunta|linea uno\\nlinea dos"]');
  assert.equal(cards[0].back, 'linea uno\nlinea dos');
});

test('avisa cuando falta la respuesta', () => {
  assert.throws(() => parseInput('uno | one\ndos |'), /Línea 2/);
});

test('avisa cuando no hay separador', () => {
  assert.throws(() => parseInput('esto no es una tarjeta'), /separador/);
});

test('avisa cuando el JSON está mal formado', () => {
  assert.throws(() => parseInput('[{"front":'), /JSON no es válido/);
});

test('avisa cuando no hay nada que importar', () => {
  assert.throws(() => parseInput('   '), /nada que importar/);
});
