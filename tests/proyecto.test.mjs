// Verifica los requisitos no funcionales que se pueden comprobar leyendo el
// propio proyecto: sin dependencias, sin red, cacheado completo e instalable.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (ruta) => readFile(join(ROOT, ruta), 'utf8');
const existe = (ruta) => access(join(ROOT, ruta)).then(() => true).catch(() => false);

const FUENTES_NAVEGADOR = ['index.html', 'css/app.css', 'js/app.js', 'js/srs.js', 'js/store.js', 'js/parse.js'];

test('[RNF-101] no hay dependencias de ejecución', async () => {
  const pkg = JSON.parse(await leer('package.json'));
  assert.deepEqual(pkg.dependencies ?? {}, {});
});

test('[RNF-101] no se carga nada de dominios externos', async () => {
  for (const fichero of [...FUENTES_NAVEGADOR, 'sw.js', 'manifest.webmanifest']) {
    const texto = await leer(fichero);
    const externos = [...texto.matchAll(/(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+/g)];
    assert.deepEqual(
      externos.map((m) => m[0]),
      [],
      `${fichero} carga recursos externos`,
    );
  }
});

test('[RNF-104] el código no habla con la red salvo el service worker', async () => {
  for (const fichero of FUENTES_NAVEGADOR) {
    const texto = await leer(fichero);
    for (const prohibido of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource']) {
      assert.ok(!texto.includes(prohibido), `${fichero} usa ${prohibido}`);
    }
  }
});

test('[RNF-104] no hay analítica ni identificadores de usuario', async () => {
  for (const fichero of [...FUENTES_NAVEGADOR, 'sw.js']) {
    const texto = (await leer(fichero)).toLowerCase();
    for (const rastro of ['analytics', 'gtag', 'googletagmanager', 'telemetry', 'userid', 'track(']) {
      assert.ok(!texto.includes(rastro), `${fichero} menciona ${rastro}`);
    }
  }
});

test('[RNF-102] el service worker cachea todo lo que carga la página', async () => {
  const html = await leer('index.html');
  const sw = await leer('sw.js');

  const referencias = [...html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((ruta) => !/^(https?:)?\/\/|^data:|^#/.test(ruta));

  assert.ok(referencias.length >= 4, 'no he encontrado las referencias del index');

  for (const ruta of referencias) {
    assert.ok(sw.includes(`'${ruta}'`), `sw.js no cachea ${ruta}`);
    assert.ok(await existe(ruta), `${ruta} no existe en el proyecto`);
  }

  // Los módulos que importa app.js también tienen que estar en la caché.
  for (const modulo of ['js/srs.js', 'js/store.js', 'js/parse.js']) {
    assert.ok(sw.includes(`'${modulo}'`), `sw.js no cachea ${modulo}`);
  }
});

test('[RNF-102] el service worker se limpia al cambiar de versión', async () => {
  const sw = await leer('sw.js');
  assert.match(sw, /CACHE_VERSION/);
  assert.match(sw, /caches\.delete/);
});

test('[RNF-103] el manifiesto es válido e instalable', async () => {
  const manifest = JSON.parse(await leer('manifest.webmanifest'));
  assert.ok(manifest.name && manifest.short_name);
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.start_url);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);

  const tamanos = manifest.icons.map((i) => i.sizes);
  assert.ok(tamanos.includes('192x192'), 'falta el icono de 192');
  assert.ok(tamanos.includes('512x512'), 'falta el icono de 512');
  assert.ok(
    manifest.icons.some((i) => (i.purpose ?? '').includes('maskable')),
    'falta un icono recortable',
  );

  for (const icono of manifest.icons) {
    assert.ok(await existe(icono.src), `no existe ${icono.src}`);
  }
});

test('[RNF-103] iOS encuentra su icono y su nombre', async () => {
  const html = await leer('index.html');
  const apple = /<link[^>]+rel="apple-touch-icon"[^>]+href="([^"]+)"/.exec(html);
  assert.ok(apple, 'falta el apple-touch-icon');
  assert.ok(apple[1].endsWith('.png'), 'el apple-touch-icon tiene que ser PNG');
  assert.ok(await existe(apple[1]));
  assert.match(html, /name="apple-mobile-web-app-capable"\s+content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-title"/);
  assert.match(html, /<link[^>]+rel="manifest"/);
});

test('[RNF-108] el motor no toca ninguna API del navegador', async () => {
  const srs = await leer('js/srs.js');
  for (const global of ['window', 'document', 'localStorage', 'navigator', 'alert(']) {
    assert.ok(!srs.includes(global), `js/srs.js usa ${global}`);
  }
});

test('[RNF-108] el motor se puede importar sin navegador', async () => {
  const { review, GRADE, createCard } = await import('../js/srs.js');
  const card = createCard({ id: '1', deckId: 'd', front: 'a', back: 'b' });
  assert.equal(review(card, GRADE.GOOD).state, 'learning');
});

test('[RNF-105] la interfaz declara zonas seguras y objetivos táctiles grandes', async () => {
  const css = await leer('css/app.css');
  const html = await leer('index.html');

  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /overflow-x:\s*hidden/);

  const alturas = [...css.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(alturas.length > 0 && alturas.every((h) => h >= 44), `alturas mínimas: ${alturas}`);
});

test('[RNF-106] hay paleta para tema claro y oscuro', async () => {
  const css = await leer('css/app.css');
  assert.match(css, /color-scheme:\s*light dark/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
});
