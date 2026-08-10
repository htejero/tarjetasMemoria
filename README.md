# Tarjetas de memoria

Tarjetas de memoria con **repetición espaciada**: la app decide cuándo volver a
enseñarte cada tarjeta según lo bien que la recuerdes, para que repases lo justo
antes de olvidarlo.

Es una web estática (HTML, CSS y JavaScript, sin dependencias ni servidor)
pensada para el móvil. Los datos se guardan en el propio navegador, así que no
hay cuentas ni internet de por medio.

## Cómo se usa

Cuatro pestañas abajo:

| Pestaña | Para qué |
| --- | --- |
| **Estudiar** | Toca la tarjeta para ver la respuesta y valora cómo te ha ido |
| **Tarjetas** | Ver, buscar, editar y borrar |
| **Añadir** | Importar en bloque, y copias de seguridad |
| **Ajustes** | Mazos, límites diarios y progreso |

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

**Copia de seguridad**: *Exportar todo* descarga un JSON con las tarjetas y todo
el progreso; *Restaurar* lo vuelve a cargar. Como los datos viven solo en el
navegador, conviene exportar de vez en cuando.

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
- Hay límites diarios (por defecto 20 nuevas y 200 repasos) para que un mazo
  grande recién importado no se convierta en un muro. Se cambian en *Ajustes*.
- Lo que ya has empezado a aprender se termina aunque hayas llegado al límite.

## El proyecto por dentro

```
index.html              una sola página con las cuatro vistas
css/app.css             estilos, móvil primero, claro y oscuro
js/srs.js               el motor de repetición espaciada (funciones puras)
js/store.js             guardado en localStorage
js/parse.js             lectura de texto pegado y ficheros
js/app.js               la interfaz
sw.js                   caché para funcionar sin conexión
tools/serve.mjs         servidor local
tools/make-icons.mjs    genera los iconos PNG
tests/                  pruebas del motor y del importador
ejemplos/               mazos de ejemplo
```

`js/srs.js` no toca el navegador: recibe una tarjeta y devuelve otra. Por eso se
puede probar con Node directamente y por eso sería reutilizable si algún día la
app pasa a nativa.

```bash
npm test      # 40 pruebas, sin dependencias
```

## Posibles pasos siguientes

- Sincronizar entre dispositivos (hoy los datos son de un solo navegador).
- Tarjetas con imágenes o audio.
- Estadísticas con la previsión de carga de los próximos días.
- Modo escritura, para teclear la respuesta en vez de autoevaluarse.
