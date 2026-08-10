// Ata la especificación al código y a las pruebas.
//
//   node tools/trazabilidad.mjs           regenera specs/05-trazabilidad.md
//   node tools/trazabilidad.mjs --check   solo comprueba; sale con error si algo falla
//
// Comprueba tres cosas:
//   1. Todo requisito de verificación automática o de navegador tiene al menos
//      una prueba que lo nombra.
//   2. Ninguna prueba nombra un identificador que no existe, ni uno retirado.
//   3. Ningún identificador está declarado dos veces.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPECS = join(ROOT, 'specs');
const SALIDA = join(SPECS, '05-trazabilidad.md');

const ID = /\b(RF|RNF|INV)-\d{3}\b/g;
const TITULO = /^###\s+((?:RF|RNF|INV)-\d{3})\s+—\s+(.+?)\s*$/;
const VERIFICACION = /^\*\*Verificación:\*\*\s*(automática|navegador|manual|retirado)/;
const MANUAL_EXTRA = /^\*\*Procedimiento manual/;

// Solo el código que se ejecuta en el navegador implementa requisitos.
const FUENTES = ['js', '.'];
const PRUEBAS = ['tests', 'tests/ui'];

async function ficheros(dir, sufijos) {
  const entradas = await readdir(join(ROOT, dir), { withFileTypes: true }).catch(() => []);
  return entradas
    .filter((e) => e.isFile() && sufijos.some((s) => e.name.endsWith(s)))
    .map((e) => join(dir, e.name));
}

/** Lee los requisitos declarados en specs/, en orden de aparición. */
async function leerEspecificacion() {
  const requisitos = new Map();
  const duplicados = [];

  for (const fichero of (await ficheros('specs', ['.md'])).sort()) {
    if (fichero.endsWith('05-trazabilidad.md')) continue;
    const lineas = (await readFile(join(ROOT, fichero), 'utf8')).split('\n');

    let actual = null;
    for (const linea of lineas) {
      const titulo = TITULO.exec(linea);
      if (titulo) {
        const [, id, texto] = titulo;
        if (requisitos.has(id)) duplicados.push(id);
        actual = {
          id,
          texto,
          verificacion: 'sin declarar',
          manualExtra: false,
          fichero,
          pruebas: [],
          codigo: [],
        };
        requisitos.set(id, actual);
        continue;
      }
      if (!actual) continue;
      const verificacion = VERIFICACION.exec(linea);
      if (verificacion) actual.verificacion = verificacion[1];
      if (MANUAL_EXTRA.test(linea)) actual.manualExtra = true;
    }
  }
  return { requisitos, duplicados };
}

/** Busca "[RF-101]" en los nombres de las pruebas. */
async function leerPruebas(requisitos) {
  const desconocidos = [];
  for (const carpeta of PRUEBAS) {
    for (const fichero of (await ficheros(carpeta, ['.mjs'])).sort()) {
      const texto = await readFile(join(ROOT, fichero), 'utf8');
      for (const linea of texto.split('\n')) {
        const prueba = /^\s*(?:await\s+)?(?:test|paso)\(\s*'(.+?)'/.exec(linea);
        if (!prueba) continue;
        const nombre = prueba[1];
        for (const [, id] of nombre.matchAll(/\[((?:RF|RNF|INV)-\d{3})\]/g)) {
          const requisito = requisitos.get(id);
          if (!requisito) {
            desconocidos.push({ id, fichero, nombre });
            continue;
          }
          requisito.pruebas.push({ fichero, nombre: nombre.replaceAll(/\[.+?\]\s*/g, '') });
        }
      }
    }
  }
  return desconocidos;
}

/** Busca en el código los comentarios que citan requisitos. */
async function leerCodigo(requisitos) {
  for (const carpeta of FUENTES) {
    for (const fichero of (await ficheros(carpeta, ['.js', '.mjs'])).sort()) {
      const texto = await readFile(join(ROOT, fichero), 'utf8');
      for (const linea of texto.split('\n')) {
        if (!linea.includes('@spec')) continue;
        for (const [id] of linea.matchAll(ID)) {
          const requisito = requisitos.get(id);
          const ruta = relative(ROOT, join(ROOT, fichero));
          if (requisito && !requisito.codigo.includes(ruta)) requisito.codigo.push(ruta);
        }
      }
    }
  }
}

function familia(id) {
  return id.split('-')[0];
}

const NOMBRES = {
  RF: 'Requisitos funcionales',
  RNF: 'Requisitos no funcionales',
  INV: 'Invariantes del motor',
};

function generarInforme(requisitos) {
  const lineas = [
    '# Trazabilidad',
    '',
    '<!-- Generado por tools/trazabilidad.mjs. No editar a mano: se sobrescribe. -->',
    '',
    'Qué requisito cubre qué prueba. Se regenera con `npm run spec` y se comprueba',
    'en cada `npm test`.',
    '',
  ];

  const todos = [...requisitos.values()];
  const auto = todos.filter((r) => !['manual', 'retirado'].includes(r.verificacion));
  const cubiertos = auto.filter((r) => r.pruebas.length);
  const pruebasTotales = new Set(
    todos.flatMap((r) => r.pruebas.map((p) => `${p.fichero}::${p.nombre}`)),
  );

  lineas.push(
    '| | |',
    '| --- | --- |',
    `| Requisitos especificados | ${todos.length} |`,
    `| De verificación automática o de navegador | ${auto.length} |`,
    `| Cubiertos por al menos una prueba | ${cubiertos.length} |`,
    `| De verificación manual | ${todos.filter((r) => r.verificacion === 'manual').length} |`,
    `| Retirados | ${todos.filter((r) => r.verificacion === 'retirado').length} |`,
    `| Pruebas distintas implicadas | ${pruebasTotales.size} |`,
    '',
  );

  for (const clave of ['RF', 'RNF', 'INV']) {
    const grupo = todos.filter((r) => familia(r.id) === clave && r.verificacion !== 'retirado');
    if (!grupo.length) continue;
    lineas.push(`## ${NOMBRES[clave]}`, '');
    lineas.push('| Id | Requisito | Verificación | Código | Pruebas |');
    lineas.push('| --- | --- | --- | --- | --- |');
    for (const r of grupo) {
      const ancla = `${r.fichero.replace('specs/', '')}#${r.id.toLowerCase()}--${r.texto
        .toLowerCase()
        .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replaceAll(/\s+/g, '-')}`;
      const codigo = r.codigo.length ? r.codigo.map((c) => `\`${c}\``).join('<br>') : '—';
      const pruebas = r.pruebas.length
        ? r.pruebas.map((p) => `${p.nombre}`).join('<br>')
        : r.verificacion === 'manual'
          ? '_a mano_'
          : '**sin cubrir**';
      lineas.push(`| [${r.id}](${ancla}) | ${r.texto} | ${r.verificacion} | ${codigo} | ${pruebas} |`);
    }
    lineas.push('');
  }

  const retirados = todos.filter((r) => r.verificacion === 'retirado');
  if (retirados.length) {
    lineas.push(
      '## Requisitos retirados',
      '',
      'Su número no se reutiliza nunca, para que ningún enlace viejo acabe',
      'apuntando a otra cosa.',
      '',
      ...retirados.map((r) => `- **${r.id}** — ${r.texto}`),
      '',
    );
  }

  const manuales = todos.filter((r) => r.verificacion === 'manual' || r.manualExtra);
  if (manuales.length) {
    lineas.push(
      '## Comprobaciones manuales de cada versión',
      '',
      'Lo que ninguna prueba puede firmar por sí sola. El procedimiento está en',
      'la ficha de cada requisito.',
      '',
      ...manuales.map(
        (r) =>
          `- **${r.id}** — ${r.texto}${r.verificacion === 'manual' ? '' : ' (complementa a sus pruebas)'}`,
      ),
      '',
    );
  }

  return lineas.join('\n');
}

// --- Ejecución ------------------------------------------------------------

const soloComprobar = process.argv.includes('--check');
const { requisitos, duplicados } = await leerEspecificacion();
const desconocidos = await leerPruebas(requisitos);
await leerCodigo(requisitos);

const problemas = [];

for (const id of duplicados) {
  problemas.push(`El identificador ${id} está declarado más de una vez.`);
}
for (const { id, fichero, nombre } of desconocidos) {
  problemas.push(`${fichero}: la prueba "${nombre}" cita ${id}, que no existe en la especificación.`);
}
for (const r of requisitos.values()) {
  if (r.verificacion === 'sin declarar') {
    problemas.push(`${r.id} no declara cómo se verifica.`);
  } else if (r.verificacion === 'retirado' && r.pruebas.length) {
    problemas.push(
      `${r.id} está retirado pero todavía lo citan ${r.pruebas.length} prueba(s).`,
    );
  } else if (!['manual', 'retirado'].includes(r.verificacion) && !r.pruebas.length) {
    problemas.push(`${r.id} (${r.texto}) es de verificación ${r.verificacion} y no tiene pruebas.`);
  }
}

if (!soloComprobar) {
  await writeFile(SALIDA, `${generarInforme(requisitos)}`);
  console.log(`Escrito ${relative(ROOT, SALIDA)}`);
}

const auto = [...requisitos.values()].filter(
  (r) => !['manual', 'retirado'].includes(r.verificacion),
);
const cubiertos = auto.filter((r) => r.pruebas.length).length;
console.log(
  `Trazabilidad: ${requisitos.size} requisitos, ${cubiertos}/${auto.length} verificables cubiertos.`,
);

if (problemas.length) {
  console.error(`\n${problemas.length} problema(s) de trazabilidad:`);
  for (const p of problemas) console.error(`  · ${p}`);
  process.exit(1);
}
