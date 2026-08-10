// Verifica los formatos de entrada de specs/04-datos.md y los requisitos
// RF-2xx de specs/02-requisitos.md.

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseInput, splitLine } from '../js/parse.js';

test('[RF-201] lee líneas separadas por barra vertical', () => {
  const { kind, cards } = parseInput('¿Capital de Francia? | París\n¿Capital de Italia? | Roma');
  assert.equal(kind, 'cards');
  assert.deepEqual(cards, [
    { front: '¿Capital de Francia?', back: 'París', tags: [] },
    { front: '¿Capital de Italia?', back: 'Roma', tags: [] },
  ]);
});

test('[RF-201] elige el separador que parte de forma consistente', () => {
  // Las comas del texto no deben ganarle al separador real.
  const { cards } = parseInput('Rojo, verde y azul | Colores primarios\nDo, re, mi | Notas');
  assert.deepEqual(
    cards.map((c) => c.front),
    ['Rojo, verde y azul', 'Do, re, mi'],
  );
});

test('[RF-201] descarta los espacios de los extremos', () => {
  const { cards } = parseInput('   uno   |   one   ');
  assert.deepEqual(cards, [{ front: 'uno', back: 'one', tags: [] }]);
});

test('[RF-202] lee CSV con cabecera y etiquetas', () => {
  const { cards } = parseInput('front,back,tags\nhola,hello,idiomas;ingles');
  assert.deepEqual(cards, [{ front: 'hola', back: 'hello', tags: ['idiomas', 'ingles'] }]);
});

test('[RF-202] acepta cabeceras en español', () => {
  const { cards } = parseInput('pregunta;respuesta\nuno;one');
  assert.deepEqual(cards, [{ front: 'uno', back: 'one', tags: [] }]);
});

test('[RF-202] respeta el separador dentro de comillas', () => {
  const { cards } = parseInput('"Rojo, verde y azul",Los colores primarios de la luz');
  assert.deepEqual(cards, [
    { front: 'Rojo, verde y azul', back: 'Los colores primarios de la luz', tags: [] },
  ]);
});

test('[RF-202] las comillas dobles escapadas se conservan', () => {
  assert.deepEqual(splitLine('"dice ""hola""",saludo', ','), ['dice "hola"', 'saludo']);
});

test('[RF-202] lee TSV', () => {
  const { cards } = parseInput('perro\tdog\ngato\tcat');
  assert.equal(cards.length, 2);
  assert.equal(cards[1].front, 'gato');
});

test('[RF-202] una cabecera sola no se convierte en tarjeta ni desaparece la única fila', () => {
  // Con una sola línea no hay cabecera que valga: es una tarjeta.
  const { cards } = parseInput('pregunta,respuesta');
  assert.deepEqual(cards, [{ front: 'pregunta', back: 'respuesta', tags: [] }]);
});

test('[RF-210] ignora líneas vacías y comentarios', () => {
  const { cards } = parseInput('# mi mazo\n\nuno | one\n\n dos | two \n');
  assert.deepEqual(
    cards.map((c) => c.front),
    ['uno', 'dos'],
  );
});

test('[RF-203] lee JSON con claves en inglés o en español', () => {
  const { cards } = parseInput(
    '[{"front":"a","back":"b"},{"pregunta":"c","respuesta":"d","etiquetas":["x"]}]',
  );
  assert.deepEqual(cards, [
    { front: 'a', back: 'b', tags: [] },
    { front: 'c', back: 'd', tags: ['x'] },
  ]);
});

test('[RF-203] lee JSON como lista de listas y con nombre de mazo', () => {
  const { cards, deckName } = parseInput('{"mazo":"Francés","tarjetas":[["chien","perro"]]}');
  assert.equal(deckName, 'Francés');
  assert.deepEqual(cards, [{ front: 'chien', back: 'perro', tags: [] }]);
});

test('[RF-203] convierte \\n en saltos de línea reales', () => {
  const { cards } = parseInput('[["pregunta","linea uno\\\\nlinea dos"]]');
  assert.equal(cards[0].back, 'linea uno\nlinea dos');
});

test('[RF-209] reconoce una copia de seguridad completa', () => {
  const backup = { version: 1, decks: [{ id: 'd', name: 'x' }], cards: [], settings: {} };
  const parsed = parseInput(JSON.stringify(backup));
  assert.equal(parsed.kind, 'backup');
  assert.equal(parsed.backup.decks[0].name, 'x');
});

test('[RF-207] avisa con el número de línea cuando falta la respuesta', () => {
  assert.throws(() => parseInput('uno | one\ndos |'), /Línea 2.*dos/s);
});

test('[RF-207] avisa cuando no hay separador reconocible', () => {
  assert.throws(() => parseInput('esto no es una tarjeta'), /separador/);
});

test('[RF-207] avisa cuando el JSON está mal formado', () => {
  assert.throws(() => parseInput('[{"front":'), /JSON no es válido/);
});

test('[RF-207] avisa cuando el JSON no contiene tarjetas', () => {
  assert.throws(() => parseInput('{"algo":1}'), /lista de tarjetas/);
});

test('[RF-207] avisa cuando no hay nada que importar', () => {
  assert.throws(() => parseInput('   '), /nada que importar/);
  assert.throws(() => parseInput('\n#solo comentarios\n'), /nada que importar/);
});

test('[RF-207] un error no devuelve tarjetas a medias', () => {
  // La primera línea es válida; la segunda no. No debe salir nada.
  let resultado = 'sin ejecutar';
  try {
    resultado = parseInput('uno | one\nesto-no-vale');
  } catch {
    resultado = 'error';
  }
  assert.equal(resultado, 'error');
});
