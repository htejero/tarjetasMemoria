// Pruebas de interfaz sobre un Chromium real, a tamaño de iPhone.
//
//   npm run test:ui
//
// Cubren los requisitos marcados como "navegador" en specs/02-requisitos.md.
// Si Playwright no está instalado, la prueba se salta con un aviso en lugar de
// romper el proyecto: es la única dependencia y solo hace falta para esto.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUERTO = 8123;

let playwright;
try {
  playwright = await import('playwright');
} catch {
  console.log('Playwright no está instalado; me salto las pruebas de interfaz.');
  console.log('Para ejecutarlas:  npm install --no-save playwright && npm run test:ui');
  process.exit(0);
}

// --- Servidor estático ----------------------------------------------------

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

const servidor = createServer(async (req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const fichero = join(ROOT, normalize(ruta).replace(/^(\.\.[/\\])+/, ''));
  try {
    const cuerpo = await readFile(fichero);
    res.writeHead(200, { 'content-type': TIPOS[extname(fichero)] || 'text/plain' });
    res.end(cuerpo);
  } catch {
    res.writeHead(404).end('No encontrado');
  }
});
await new Promise((listo) => servidor.listen(PUERTO, listo));

// --- Andamiaje ------------------------------------------------------------

const fallos = [];
const erroresDeConsola = [];

async function paso(nombre, fn) {
  try {
    await fn();
    console.log(`  ✓ ${nombre}`);
  } catch (err) {
    fallos.push({ nombre, err });
    console.log(`  ✗ ${nombre}\n      ${err.message.split('\n')[0]}`);
  } finally {
    // Un paso que falla con el editor abierto bloquearía todos los siguientes.
    await page.evaluate(() => document.querySelector('#editor')?.close()).catch(() => {});
  }
}

function assert(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

/**
 * Abre Chromium. Si la versión que Playwright espera no está descargada, busca
 * cualquier Chromium en PLAYWRIGHT_BROWSERS_PATH antes de rendirse: en entornos
 * con los navegadores preinstalados el número de build no suele coincidir.
 */
async function abrirNavegador(chromium) {
  try {
    return await chromium.launch();
  } catch (err) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
    const encontrado = base ? await buscarChromium(base) : null;
    if (!encontrado) throw err;
    console.log(`  (usando ${encontrado})`);
    return chromium.launch({ executablePath: encontrado });
  }
}

async function buscarChromium(base) {
  const { readdir } = await import('node:fs/promises');
  const entradas = await readdir(base, { withFileTypes: true }).catch(() => []);
  const candidatos = entradas
    .filter((e) => e.isDirectory() && e.name.startsWith('chromium'))
    .map((e) => e.name)
    .sort()
    .reverse();
  for (const nombre of candidatos) {
    for (const relativo of [
      join('chrome-linux', 'chrome'),
      join('chrome-linux', 'headless_shell'),
      join('chrome-headless-shell-linux64', 'chrome-headless-shell'),
    ]) {
      const ruta = join(base, nombre, relativo);
      const { access } = await import('node:fs/promises');
      if (await access(ruta).then(() => true, () => false)) return ruta;
    }
  }
  return null;
}

const { chromium } = playwright;
const navegador = await abrirNavegador(chromium);
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'es-ES',
});
const page = await contexto.newPage();
page.on('pageerror', (e) => erroresDeConsola.push(`error de página: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && erroresDeConsola.push(`consola: ${m.text()}`));
page.on('dialog', (d) => d.accept());

const url = `http://localhost:${PUERTO}/`;
await page.goto(url);
await page.waitForSelector('.tabbar');

const ir = (vista) => page.click(`.tab[data-view="${vista}"]`);
const crearMazo = async (nombre) => {
  await ir('decks');
  await page.fill('#new-deck-name', nombre);
  await page.click('#btn-add-deck');
  await page.waitForTimeout(150);
};
const marcarSolo = async (nombre) => {
  await ir('decks');
  const filas = page.locator('#deck-cards li');
  const total = await filas.count();
  for (let i = 0; i < total; i += 1) {
    const texto = await filas.nth(i).locator('.deck-name').textContent();
    if (texto.trim() === nombre) {
      await filas.nth(i).locator('.deck-open').click();
      return;
    }
  }
  throw new Error(`no encuentro el mazo ${nombre}`);
};

// --- Tarjetas y mazos -----------------------------------------------------

await paso('[RF-110] la app arranca en la pantalla de mazos', async () => {
  assert(await page.locator('#view-decks').isVisible(), 'no arranca en Mazos');
  assert((await page.locator('#deck-cards li').count()) === 1, 'debería haber un mazo inicial');
  const detalle = await page.textContent('#deck-cards li .deck-detail');
  assert(detalle.includes('Sin tarjetas'), `detalle inesperado: ${detalle}`);
});

await paso('[RF-101] crear una tarjeta a mano la deja lista para estudiar', async () => {
  await ir('cards');
  await page.click('#btn-new-card');
  await page.fill('#editor-front', '¿Capital de Francia?');
  await page.fill('#editor-back', 'París');
  await page.fill('#editor-tags', 'geografia, europa');
  await page.click('#editor-save');
  await page.waitForTimeout(150);

  assert((await page.locator('#card-list li').count()) === 1, 'no aparece en la lista');
  assert(
    (await page.textContent('#card-list li .card-item-meta')).includes('nueva'),
    'no está en estado nueva',
  );
});

await paso('[RF-101] sin pregunta o sin respuesta no se guarda nada', async () => {
  await page.click('#btn-new-card');
  await page.fill('#editor-front', 'solo pregunta');
  await page.fill('#editor-back', '');
  await page.click('#editor-save');
  await page.waitForTimeout(150);

  assert(await page.locator('#editor').evaluate((d) => d.open), 'el editor se ha cerrado');
  assert((await page.locator('#card-list li').count()) === 1, 'ha guardado una tarjeta inválida');
  await page.click('#editor button[value="cancel"]');
});

await paso('[RF-105] la lista muestra el estado y las etiquetas', async () => {
  const meta = await page.textContent('#card-list li .card-item-meta');
  assert(meta.includes('geografia'), `no muestra las etiquetas: ${meta}`);
});

await paso('[RF-204] importar desde un fichero añade las tarjetas', async () => {
  await ir('import');
  await page.setInputFiles('#import-file', join(ROOT, 'ejemplos', 'capitales.txt'));
  await page.waitForTimeout(300);
  const mensaje = await page.textContent('#import-feedback');
  assert(mensaje.includes('Añadidas 9'), `mensaje inesperado: ${mensaje}`);
  // La de Francia ya existía: se omite.
  assert(mensaje.includes('1 repetida'), `no ha detectado la repetida: ${mensaje}`);
});

await paso('[RF-104] el buscador filtra sin distinguir mayúsculas', async () => {
  await ir('cards');
  await page.fill('#card-search', 'ROMA');
  await page.waitForTimeout(100);
  assert((await page.locator('#card-list li').count()) === 1, 'el filtro no ha funcionado');
  await page.fill('#card-search', '');
});

await paso('[RF-110] cada mazo enseña lo que le toca hoy', async () => {
  await crearMazo('Francés');
  const filas = page.locator('#deck-cards li');
  assert((await filas.count()) === 2, 'no aparece el mazo nuevo');

  const general = await filas.nth(0).locator('.deck-detail').textContent();
  assert(/10 nuevas/.test(general), `detalle del mazo con tarjetas: ${general}`);
  assert((await filas.nth(0).locator('.deck-pending').textContent()).trim() === '10');

  // El mazo recién creado está vacío y se distingue a simple vista.
  assert((await filas.nth(1).locator('.deck-pending').textContent()).includes('✓'));
  assert((await filas.nth(1).getAttribute('class')).includes('al-dia'));
});

await paso('[RF-108] tocar un mazo lo estudia y la cabecera lo dice', async () => {
  await marcarSolo('Francés');
  assert(await page.locator('#view-study').isVisible(), 'no ha ido a estudiar');
  assert((await page.textContent('#deck-label-text')) === 'Francés', 'la cabecera no lo refleja');

  await ir('cards');
  assert((await page.locator('#card-list li').count()) === 0, 'el mazo nuevo no está vacío');
});

await paso('[RF-111] marcar varios mazos los estudia juntos', async () => {
  await ir('decks');
  // Con "Francés" seleccionado, marcar también el primero.
  await page.locator('#deck-cards li').nth(0).locator('.deck-check').check();
  await page.waitForTimeout(150);
  assert(
    (await page.textContent('#deck-label-text')) === 'Todos los mazos',
    'marcar los dos de dos equivale a todos',
  );

  await ir('cards');
  assert((await page.locator('#card-list li').count()) === 10, 'no vuelven a verse todas');
});

await paso('[RF-111] el botón Todos limpia la selección', async () => {
  await marcarSolo('Francés');
  await ir('decks');
  await page.click('#btn-select-all');
  await page.waitForTimeout(120);
  assert((await page.textContent('#deck-label-text')) === 'Todos los mazos');
});

// --- Sesión de estudio ----------------------------------------------------

await paso('[RF-301] la respuesta y los botones no se ven hasta voltear', async () => {
  await ir('decks');
  await page.click('#btn-select-all');
  await ir('study');
  await page.waitForSelector('#study-card:not(.hidden)');
  assert(!(await page.locator('#face-back').isVisible()), 'la respuesta está a la vista');
  assert(!(await page.locator('#grades').isVisible()), 'los botones están a la vista');
});

await paso('[RF-302] tocar la tarjeta muestra la respuesta', async () => {
  await page.click('#card-face');
  assert(await page.locator('#face-back').isVisible(), 'no se ve la respuesta');
  assert(await page.locator('#grades').isVisible(), 'no se ven los botones');
});

await paso('[RF-303] hay cuatro botones, en orden', async () => {
  const nombres = await page.locator('.grade .grade-name').allTextContents();
  assert(
    JSON.stringify(nombres) === JSON.stringify(['Fallo', 'Difícil', 'Bien', 'Fácil']),
    `botones: ${nombres}`,
  );
});

await paso('[RF-304] cada botón enseña su plazo, en orden creciente', async () => {
  const plazos = await page.locator('.grade-when').allTextContents();
  assert(
    plazos.every(Boolean),
    `algún plazo está vacío: ${JSON.stringify(plazos)}`,
  );
  const enMinutos = plazos.map((texto) => {
    const [valor, unidad] = texto.replace(',', '.').split(' ');
    const factor = { min: 1, h: 60, d: 1440, meses: 43800, años: 525600 }[unidad];
    return Number(valor) * factor;
  });
  for (let i = 1; i < enMinutos.length; i += 1) {
    assert(enMinutos[i] > enMinutos[i - 1], `plazos no crecientes: ${JSON.stringify(plazos)}`);
  }
  console.log(`      plazos: ${plazos.join(' / ')}`);
});

await paso('[RF-305] responder pasa a otra tarjeta, otra vez oculta', async () => {
  const antes = await page.textContent('#face-front');
  await page.click('.grade-2');
  await page.waitForTimeout(200);
  const despues = await page.textContent('#face-front');
  assert(antes !== despues, 'sigue la misma tarjeta');
  assert(!(await page.locator('#face-back').isVisible()), 'la respuesta viene destapada');
});

await paso('[RF-308] espacio voltea y las teclas 1-4 responden', async () => {
  await page.keyboard.press('Space');
  assert(await page.locator('#grades').isVisible(), 'espacio no voltea');
  const antes = await page.textContent('#face-front');
  await page.keyboard.press('3');
  await page.waitForTimeout(200);
  assert(!(await page.locator('#grades').isVisible()), 'la tecla 3 no ha respondido');
  assert((await page.textContent('#face-front')) !== antes, 'no ha avanzado');
});

await paso('[RF-308] los atajos no actúan mientras se escribe', async () => {
  await ir('import');
  await page.fill('#import-text', '2');
  assert((await page.inputValue('#import-text')) === '2', 'la tecla no ha llegado al campo');
  await page.fill('#import-text', '');
  await ir('study');
});

await paso('[RF-307] se puede editar la tarjeta que se está viendo', async () => {
  await page.waitForSelector('#study-card:not(.hidden)');
  const original = await page.textContent('#face-front');
  await page.click('#btn-edit-current');
  await page.fill('#editor-front', `${original} (revisada)`);
  await page.click('#editor-save');
  await page.waitForTimeout(200);
  assert(
    (await page.textContent('#face-front')).includes('(revisada)'),
    'el cambio no se ve en la sesión',
  );
});

await paso('[RF-109] se puede reiniciar el progreso desde el editor', async () => {
  await ir('cards');
  await page.waitForTimeout(150);

  // El botón solo tiene sentido en una tarjeta ya estudiada: busca una.
  const items = page.locator('#card-list li');
  const total = await items.count();
  let indice = -1;
  for (let i = 0; i < total; i += 1) {
    const meta = await items.nth(i).locator('.card-item-meta').textContent();
    if (!meta.includes('nueva')) {
      indice = i;
      break;
    }
  }
  assert(indice >= 0, 'no hay ninguna tarjeta estudiada en la lista');

  await items.nth(indice).locator('.icon-btn').first().click();
  assert(await page.locator('#editor-reset').isVisible(), 'no hay botón de reiniciar');
  await page.click('#editor-reset');
  await page.waitForTimeout(250);

  const meta = await items.nth(indice).locator('.card-item-meta').textContent();
  assert(meta.includes('nueva'), `la tarjeta no ha vuelto a nueva: ${meta}`);
});

await paso('[RF-504] el progreso se desglosa por mazo', async () => {
  await ir('settings');
  const filas = page.locator('#deck-stats li');
  assert((await filas.count()) === 2, 'debería haber una fila por mazo');
  const primera = await filas.nth(0).textContent();
  assert(/tarjetas/.test(primera) && /aciertos/.test(primera), `fila: ${primera}`);
  assert(/aciertos —/.test(await filas.nth(1).textContent()), 'un mazo sin uso debe mostrar —');
});

await paso('[RF-505] sin tarjetas problemáticas se dice explícitamente', async () => {
  await ir('settings');
  const texto = await page.textContent('#leech-list');
  assert(/Ninguna por ahora/.test(texto), `lista: ${texto}`);
});

await paso('[RF-211] el aviso de copia de seguridad aparece y se puede quitar', async () => {
  await ir('decks');
  assert(await page.locator('#backup-banner').isVisible(), 'no avisa de la copia');
  const detalle = await page.textContent('#backup-detail');
  assert(/solo en este dispositivo/.test(detalle), `aviso: ${detalle}`);

  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-backup'),
  ]);
  const datos = JSON.parse(await readFile(await descarga.path(), 'utf8'));
  assert(datos.cards.length === 10, `la copia trae ${datos.cards.length} tarjetas`);
  assert(/^tarjetas-\d{4}-\d{2}-\d{2}\.json$/.test(descarga.suggestedFilename()));

  await page.waitForTimeout(200);
  assert(!(await page.locator('#backup-banner').isVisible()), 'el aviso no desaparece');
});

await paso('[RF-109] una tarjeta sin estudiar no ofrece reiniciar', async () => {
  await ir('cards');
  await page.click('#btn-new-card');
  assert(!(await page.locator('#editor-reset').isVisible()), 'ofrece reiniciar una tarjeta nueva');
  await page.click('#editor button[value="cancel"]');
});

await page.screenshot({ path: join(ROOT, 'tests', 'ui', 'ultima-sesion.png') });

// --- La pantalla se pone al día sola --------------------------------------

await paso('[RF-407] la pantalla vacía se actualiza sola al vencer la tarjeta', async () => {
  const ahora = Date.now();
  const estado = {
    version: 1,
    decks: [{ id: 'd1', name: 'Espera', createdAt: ahora }],
    cards: [
      {
        id: 'c1',
        deckId: 'd1',
        front: 'la que estaba esperando',
        back: 'ya toca',
        tags: [],
        createdAt: ahora,
        // Justo fuera de la ventana de adelanto: entra dentro de ~2 segundos.
        state: 'learning',
        step: 0,
        interval: 0,
        ease: 2.5,
        due: ahora + 20 * 60 * 1000 + 2000,
        reps: 1,
        lapses: 0,
        lastReviewed: ahora,
      },
    ],
    settings: { newPerDay: 20, maxReviewsPerDay: 200, cutoffHour: 4 },
    daily: { day: 0, introduced: 0, reviewed: 0 },
    history: [],
  };

  const pagina = await contexto.newPage();
  await pagina.addInitScript((valor) => {
    localStorage.setItem('tarjetasMemoria.v1', valor);
  }, JSON.stringify(estado));
  await pagina.goto(url);
  await pagina.click('.tab[data-view="study"]');

  await pagina.waitForSelector('#study-empty:not(.hidden)');
  const motivo = await pagina.textContent('#study-empty-detail');
  assert(/vuelve en 20 min/.test(motivo), `motivo inesperado: ${motivo}`);

  await pagina.waitForSelector('#study-card:not(.hidden)', { timeout: 10000 });
  assert(
    (await pagina.textContent('#face-front')).includes('la que estaba esperando'),
    'ha aparecido otra tarjeta',
  );
  await pagina.close();
});

// --- Aspecto --------------------------------------------------------------

await paso('[RNF-105] a 390 px no hay desplazamiento horizontal', async () => {
  for (const vista of ['decks', 'study', 'cards', 'import', 'settings']) {
    await ir(vista);
    await page.waitForTimeout(80);
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    assert(!desborda, `la vista ${vista} desborda a lo ancho`);
  }
});

await paso('[RNF-105] la barra de pestañas cabe en una sola fila', async () => {
  const arriba = await page.locator('.tab').evaluateAll((nodos) =>
    nodos.map((n) => Math.round(n.getBoundingClientRect().top)),
  );
  assert(arriba.length === 5, `esperaba 5 pestañas, hay ${arriba.length}`);
  assert(new Set(arriba).size === 1, `las pestañas se parten en varias filas: ${arriba}`);
});

await paso('[RNF-105] los botones se pueden pulsar con el pulgar', async () => {
  await ir('study');
  await page.waitForTimeout(100);
  if (await page.locator('#card-face').isVisible()) await page.click('#card-face');
  const cajas = await page.locator('.grade, .tab').evaluateAll((nodos) =>
    nodos.map((n) => n.getBoundingClientRect().height),
  );
  assert(cajas.length > 0, 'no he encontrado botones');
  assert(
    cajas.every((alto) => alto >= 44),
    `hay botones de menos de 44 px: ${cajas.map(Math.round)}`,
  );
});

await paso('[RNF-106] el tema oscuro cambia el fondo de verdad', async () => {
  const fondo = async (esquema) => {
    const ctx = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: esquema,
    });
    const p = await ctx.newPage();
    await p.goto(url);
    await p.waitForSelector('.tabbar');
    const color = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const texto = await p.evaluate(() => getComputedStyle(document.body).color);
    await ctx.close();
    return { color, texto };
  };

  const claro = await fondo('light');
  const oscuro = await fondo('dark');
  assert(claro.color !== oscuro.color, `mismo fondo en ambos temas: ${claro.color}`);
  assert(claro.texto !== oscuro.texto, `mismo color de texto en ambos temas: ${claro.texto}`);
  console.log(`      claro ${claro.color} · oscuro ${oscuro.color}`);
});

// --- Cierre ---------------------------------------------------------------

await navegador.close();
servidor.close();

if (erroresDeConsola.length) {
  console.log('\nErrores en la consola del navegador:');
  for (const e of erroresDeConsola) console.log(`  · ${e}`);
}

const total = fallos.length;
console.log(`\nInterfaz: ${total ? `${total} fallo(s)` : 'todo correcto'}.`);
if (total || erroresDeConsola.length) {
  for (const { nombre, err } of fallos) console.error(`\n${nombre}\n${err.stack}`);
  process.exit(1);
}
