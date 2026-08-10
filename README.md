# Tarjetas de memoria

Tarjetas de memoria con **repetición espaciada**: la app decide cuándo volver a
enseñarte cada tarjeta según lo bien que la recuerdes, para que repases lo justo
antes de olvidarlo.

Es una web estática (HTML, CSS y JavaScript, sin dependencias ni servidor)
pensada para el móvil. Los datos se guardan en el propio navegador, así que no
hay cuentas ni internet de por medio.

## Cómo se usa

Cinco pestañas abajo:

| Pestaña | Para qué |
| --- | --- |
| **Mazos** | La pantalla de inicio: cada mazo con lo que le toca hoy. Toca uno y empiezas |
| **Estudiar** | Toca la tarjeta para ver la respuesta y valora cómo te ha ido |
| **Tarjetas** | Ver, buscar, editar y borrar |
| **Añadir** | Importar en bloque, y copias de seguridad |
| **Ajustes** | Mazos, límite diario, progreso por mazo y tarjetas problemáticas |

En **Mazos** ves de un vistazo *Francés 29 · Chino 32 · Historia ✓*. Tocas el
nombre de uno y lo estudias; o marcas varios con las casillas y le das a
*Estudiar* para mezclarlos. Sin ninguno marcado se estudian todos.

Al responder eliges entre cuatro botones, y debajo de cada uno ves cuándo
volvería a aparecer la tarjeta:

- **Fallo** — no te acordabas. Vuelve en un minuto y su intervalo se parte por la mitad.
- **Difícil** — te ha costado. Crece poco y la tarjeta se marca como más costosa.
- **Bien** — la respuesta correcta normal. Es la opción por defecto.
- **Fácil** — inmediata. Se va mucho más lejos en el tiempo.

Con teclado (si lo usas desde el ordenador): **espacio** voltea la tarjeta y las
teclas **1-4** responden.

## Cargar tarjetas

En la pestaña **Añadir**, pegando texto o subiendo un fichero. Se aceptan:

**Una línea por tarjeta** (lo más cómodo para escribir a mano o pedírselo a una IA):

```
¿Capital de Francia? | París
¿Capital de Italia? | Roma
```

**CSV o TSV**, con cabecera opcional y una tercera columna de etiquetas:

```
pregunta,respuesta,etiquetas
"Rojo, verde y azul",Los colores primarios de la luz,fisica
```

**JSON**, con las claves en inglés o en español:

```json
{
  "mazo": "Inglés básico",
  "tarjetas": [{ "pregunta": "perro", "respuesta": "dog", "etiquetas": ["animales"] }]
}
```

Tienes ejemplos listos para pegar en la carpeta [`ejemplos/`](ejemplos/).

Detalles útiles:

- Se ignoran las líneas vacías y las que empiecen por `#`.
- No se importan tarjetas cuya pregunta ya exista en ese mazo, así que puedes
  volver a pegar la misma lista ampliada sin duplicar nada.
- Las tarjetas entran en el mazo seleccionado arriba; si tienes puesto
  "Todos los mazos" y el JSON trae nombre de mazo, se crea ese mazo.

**Copia de seguridad**: *Exportar todo* guarda un JSON con las tarjetas y todo el
progreso; *Restaurar* lo vuelve a cargar. En el móvil, el botón abre el menú de
compartir, así que puedes mandarla a Archivos o iCloud de un toque.

Los datos viven **solo en el navegador de este dispositivo**, no en un servidor.
Por eso la pantalla de Mazos avisa cuando han pasado más de 7 días desde la
última copia. Ningún navegador puede escribir el fichero por su cuenta —ni en
iOS ni en ningún sitio—, así que el aviso es lo máximo que se puede automatizar:
guardarla sigue siendo un gesto tuyo, pero solo uno.

## Ponerla en el móvil

La forma más simple es publicarla con GitHub Pages:

1. En GitHub: **Settings → Pages**.
2. *Source*: **Deploy from a branch**; rama `main`, carpeta `/ (root)`.
3. A los pocos minutos tendrás una dirección tipo
   `https://htejero.github.io/tarjetasMemoria/`.

En el iPhone, abre esa dirección en Safari → **Compartir → Añadir a pantalla de
inicio**. Queda como una app: icono propio, sin barra del navegador y funciona
sin cobertura (hay un *service worker* que guarda la app en el móvil). Esto ya
es una PWA; no hace falta App Store para el uso normal.

Para probar en local:

```bash
npm start     # http://localhost:8080, y también por la IP de tu wifi
```

Hace falta un servidor: la app usa módulos de JavaScript y no funciona abriendo
`index.html` con doble clic.

## Cómo decide cuándo repetir

La especificación completa del algoritmo, con la tabla de transiciones y los
invariantes, está en [`specs/03-motor.md`](specs/03-motor.md). En resumen:

Variante de **SM-2** (el algoritmo clásico de Anki y SuperMemo) con pasos de
aprendizaje. Cada tarjeta lleva un *intervalo* (días hasta el próximo repaso) y
una *facilidad* (multiplicador, empieza en 2,5 y nunca baja de 1,3).

1. **Nueva**: se enseña en pasos cortos, 1 minuto y 10 minutos. Con *Fácil* se
   salta los pasos y se va directa a 4 días.
2. **Repaso**: al acertar, el intervalo se multiplica por la facilidad
   (*Bien*), por 1,2 (*Difícil*, que además baja la facilidad 0,15) o por la
   facilidad × 1,3 (*Fácil*, que la sube 0,15).
3. **Fallo**: la facilidad baja 0,2, el intervalo se reduce a la mitad y la
   tarjeta vuelve a pasos cortos hasta que la recuerdes.

El resultado es que lo que dominas se aleja rápido (días → semanas → meses) y lo
que se te resiste sigue apareciendo a diario, que es justo lo que maximiza el
recuerdo por minuto estudiado.

Además:

- Los intervalos largos llevan una dispersión de ±5 % para que no se te
  acumulen todas las tarjetas el mismo día.
- El día de estudio empieza a las 4 de la mañana, no a medianoche.
- Hay un límite diario de tarjetas **nuevas** (20 por defecto, se cambia en
  *Ajustes*) para que un mazo grande recién importado no se convierta en un
  muro. El cupo es **de cada mazo**, y cuando estudias varios a la vez sus
  tarjetas nuevas se alternan: así el francés no se come el cupo del chino.
  Los repasos que toquen se muestran todos: no hay tope, porque aplazar algo
  que estás a punto de olvidar es justo lo contrario de lo que se busca.
- Lo que ya has empezado a aprender se termina aunque hayas llegado al límite.

## Cómo se desarrolla: la especificación manda

El proyecto se construye con **desarrollo dirigido por especificación**. La
carpeta [`specs/`](specs/) no es documentación escrita a posteriori: es la
fuente de verdad, y el código existe para cumplirla.

| Documento | Qué contiene |
| --- | --- |
| [`specs/01-alcance.md`](specs/01-alcance.md) | Para qué es esto, qué queda fuera y por qué |
| [`specs/02-requisitos.md`](specs/02-requisitos.md) | 49 requisitos vigentes con criterios de aceptación |
| [`specs/03-motor.md`](specs/03-motor.md) | El algoritmo: estados, transiciones y 10 invariantes |
| [`specs/04-datos.md`](specs/04-datos.md) | Esquema guardado y gramática de los formatos |
| [`specs/05-trazabilidad.md`](specs/05-trazabilidad.md) | Matriz generada: qué prueba cubre qué requisito |

Cada requisito tiene un identificador estable (`RF-205`, `INV-102`) que aparece
en tres sitios: la ficha del requisito, un comentario `@spec` en la función que
lo implementa y el nombre de la prueba que lo demuestra.

```js
test('[RF-205] no se importan preguntas que ya existen en el mazo', () => { … })
```

Ese vínculo no es decorativo: `npm test` ejecuta las pruebas **y** comprueba la
trazabilidad, y **falla** si algún requisito verificable se queda sin prueba, si
una prueba cita un identificador inexistente o si un identificador está
duplicado. El orden de trabajo para cualquier cambio es: especificar → escribir
la prueba que falla → implementar → verificar. Está detallado en
[`specs/README.md`](specs/README.md).

## El proyecto por dentro

```
index.html              una sola página con las cuatro vistas
css/app.css             estilos, móvil primero, claro y oscuro
js/srs.js               el motor de repetición espaciada (funciones puras)
js/store.js             guardado en localStorage
js/parse.js             lectura de texto pegado y ficheros
js/app.js               la interfaz
sw.js                   caché para funcionar sin conexión
specs/                  la especificación y la matriz de trazabilidad
tests/                  pruebas con Node: motor, datos, formatos y proyecto
tests/ui/               pruebas de interfaz sobre Chromium
tools/serve.mjs         servidor local
tools/make-icons.mjs    genera los iconos PNG
tools/trazabilidad.mjs  ata especificación, código y pruebas
ejemplos/               mazos de ejemplo
```

`js/srs.js` no toca el navegador: recibe una tarjeta y devuelve otra. Por eso se
puede probar con Node directamente y por eso sería reutilizable si algún día la
app pasa a nativa.

```bash
npm test        # 117 pruebas + comprobación de trazabilidad, sin dependencias
npm run spec    # regenera specs/05-trazabilidad.md
npm run test:ui # 28 pruebas de interfaz (necesita Playwright)
```

Las pruebas de interfaz son lo único que necesita una dependencia, y solo de
desarrollo: si Playwright no está instalado, se saltan con un aviso.

```bash
npm install --no-save playwright && npm run test:ui
```

## Posibles pasos siguientes

- Sincronizar entre dispositivos (hoy los datos son de un solo navegador).
- Tarjetas con imágenes o audio.
- Estadísticas con la previsión de carga de los próximos días.
- Modo escritura, para teclear la respuesta en vez de autoevaluarse.
