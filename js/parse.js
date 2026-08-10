// Lectura de tarjetas desde texto pegado o desde un fichero.
//
// Formatos aceptados:
//   - JSON: copia de seguridad completa, o lista de objetos {front, back, tags}
//     (también valen las claves en español: pregunta/respuesta, anverso/reverso).
//   - CSV / TSV con comillas al estilo hoja de cálculo.
//   - Texto plano con un separador por línea: "pregunta | respuesta".
//
// Devuelve siempre { kind, cards, deckName } o lanza un Error con un mensaje
// que se pueda enseñar tal cual al usuario.

const FRONT_KEYS = ['front', 'pregunta', 'anverso', 'q', 'question', 'termino', 'término'];
const BACK_KEYS = ['back', 'respuesta', 'reverso', 'a', 'answer', 'definicion', 'definición'];
const TAG_KEYS = ['tags', 'etiquetas', 'tag', 'etiqueta'];

const HEADER_WORDS = new Set([...FRONT_KEYS, ...BACK_KEYS, ...TAG_KEYS]);

export function parseInput(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) throw new Error('No hay nada que importar.');

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJson(trimmed);
  }
  return { kind: 'cards', cards: parseDelimited(trimmed), deckName: null };
}

function parseJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`El JSON no es válido: ${err.message}`);
  }

  // Copia de seguridad completa de la propia app.
  if (data && !Array.isArray(data) && Array.isArray(data.cards) && Array.isArray(data.decks)) {
    return { kind: 'backup', backup: data, cards: data.cards, deckName: null };
  }

  // { nombre: "Mazo", tarjetas: [...] }
  let list = data;
  let deckName = null;
  if (!Array.isArray(data) && data && typeof data === 'object') {
    deckName = data.deck || data.mazo || data.nombre || data.name || null;
    list = data.cards || data.tarjetas || data.items || null;
  }
  if (!Array.isArray(list)) {
    throw new Error('Esperaba una lista de tarjetas o una copia de seguridad.');
  }

  const cards = [];
  list.forEach((item, i) => {
    if (Array.isArray(item)) {
      cards.push(makeCard(item[0], item[1], item[2], i));
      return;
    }
    if (typeof item === 'string') {
      const parts = splitLine(item, detectDelimiter([item]));
      cards.push(makeCard(parts[0], parts[1], parts[2], i));
      return;
    }
    if (!item || typeof item !== 'object') {
      throw new Error(`La entrada ${i + 1} no es una tarjeta.`);
    }
    const front = pick(item, FRONT_KEYS);
    const back = pick(item, BACK_KEYS);
    const tags = pick(item, TAG_KEYS);
    cards.push(makeCard(front, back, tags, i));
  });

  return { kind: 'cards', cards, deckName };
}

function pick(obj, keys) {
  for (const key of Object.keys(obj)) {
    if (keys.includes(key.toLowerCase().trim())) return obj[key];
  }
  return undefined;
}

function makeCard(front, back, tags, index) {
  const f = clean(front);
  const b = clean(back);
  if (!f || !b) {
    throw new Error(`La tarjeta ${index + 1} necesita pregunta y respuesta.`);
  }
  return { front: f, back: b, tags: normalizeTags(tags) };
}

function clean(value) {
  if (value == null) return '';
  return String(value).replace(/\\n/g, '\n').trim();
}

function normalizeTags(tags) {
  if (!tags) return [];
  const list = Array.isArray(tags) ? tags : String(tags).split(/[,;]/);
  return list.map((t) => String(t).trim()).filter(Boolean);
}

// --- Texto delimitado ----------------------------------------------------

const CANDIDATES = ['\t', '|', ';', ','];

export function detectDelimiter(lines) {
  let best = '\t';
  let bestScore = 0;
  for (const delim of CANDIDATES) {
    // Cuenta en cuántas líneas aparece: el separador bueno es el más constante.
    const score = lines.reduce((acc, line) => acc + (splitLine(line, delim).length > 1 ? 1 : 0), 0);
    if (score > bestScore) {
      best = delim;
      bestScore = score;
    }
  }
  if (bestScore === 0) {
    throw new Error(
      'No encuentro el separador. Usa una línea por tarjeta con el formato: pregunta | respuesta',
    );
  }
  return best;
}

/** Divide una línea respetando las comillas dobles al estilo CSV. */
export function splitLine(line, delim) {
  const out = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.trim() === '') {
      quoted = true;
      field = '';
    } else if (ch === delim) {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

export function parseDelimited(text) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (!lines.length) throw new Error('No hay nada que importar.');

  const delim = detectDelimiter(lines);
  const rows = lines.map((raw) => ({ raw, fields: splitLine(raw, delim).map((f) => f.trim()) }));

  // Salta la cabecera si la primera fila son nombres de columna conocidos.
  const first = rows[0].fields.map((f) => f.toLowerCase());
  if (rows.length > 1 && first.every((f) => HEADER_WORDS.has(f))) rows.shift();

  return rows.map(({ raw, fields }, i) => {
    if (fields.length < 2 || !fields[0] || !fields[1]) {
      throw new Error(`Línea ${i + 1}: falta la pregunta o la respuesta ("${raw}").`);
    }
    return makeCard(fields[0], fields[1], fields[2], i);
  });
}
