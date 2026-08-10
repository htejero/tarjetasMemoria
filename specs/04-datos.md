# Datos y formatos

## Dónde viven los datos

Todo el estado se guarda en `localStorage`, bajo **una sola clave**:
`tarjetasMemoria.v1`. Una sola clave y no varias porque así exportar es volcar
ese objeto tal cual, y restaurar es escribirlo de vuelta: no hay forma de que
una copia de seguridad quede a medias ([RF-208](02-requisitos.md)).

No hay servidor, ni cookies, ni identificadores ([RNF-104](02-requisitos.md)).

## Esquema del estado

```jsonc
{
  "version": 1,
  "decks": [
    { "id": "uuid", "name": "General", "createdAt": 1767225600000 }
  ],
  "cards": [
    {
      "id": "uuid",
      "deckId": "uuid",
      "front": "¿Capital de Francia?",
      "back": "París",
      "tags": ["geografia"],
      "createdAt": 1767225600000,

      // Estado de memoria — ver 03-motor.md
      "state": "review",          // new | learning | review | relearning
      "step": 0,
      "interval": 12,             // días
      "ease": 2.5,
      "due": 1768262400000,       // instante en milisegundos
      "reps": 4,
      "lapses": 1,
      "lastReviewed": 1767225600000
    }
  ],
  "settings": {
    "newPerDay": 20,
    "cutoffHour": 4
  },
  "daily": {
    "day": 1767243600000,         // inicio del día de estudio en curso
    "introduced": 3               // nuevas introducidas hoy
  },
  "history": [
    { "ts": 1767225600000, "cardId": "uuid", "grade": 2, "interval": 12 }
  ]
}
```

### Reglas

1. **`id`** es un UUID v4 (`crypto.randomUUID`), con reserva a un identificador
   aleatorio si el navegador no lo soporta. Se usan cadenas opacas, no índices,
   para que una restauración parcial nunca mezcle tarjetas.
2. **Una tarjeta pertenece a un solo mazo.** Al cargar, cualquier tarjeta cuyo
   `deckId` no exista se reasigna al primer mazo en vez de desaparecer.
3. **Siempre hay al menos un mazo** ([RF-106](02-requisitos.md)).
4. **`daily`** se reinicia solo cuando cambia el día de estudio, que empieza a
   `cutoffHour` ([RF-405](02-requisitos.md)). Solo lleva la cuenta de las
   tarjetas nuevas introducidas: los repasos no se limitan
   ([RF-403](02-requisitos.md), retirado), así que no hay nada que contar.
   Las copias de seguridad antiguas traen un `maxReviewsPerDay` y un `reviewed`
   que se descartan al cargarlas.
5. **`history`** se recorta a las 5000 respuestas más recientes. Sirve para las
   estadísticas ([RF-502](02-requisitos.md)), no para reconstruir el estado, así
   que perder la cola vieja no rompe nada. El tope evita que el almacenamiento
   del navegador se llene con los años.
6. **`version`** identifica el formato. Al cargar un estado más antiguo o
   incompleto se rellenan los huecos con los valores por defecto en lugar de
   rechazarlo ([RF-209](02-requisitos.md)).

## Formatos de importación

La entrada se detecta sola: si el texto empieza por `{` o `[` se lee como JSON;
si no, como texto delimitado.

### Texto delimitado

```
línea      = comentario | vacía | tarjeta
comentario = "#" ...
tarjeta    = campo separador campo [ separador campo ]
separador  = "|" | TAB | ";" | ","
campo      = texto | '"' texto_con_separadores '"'
```

- El separador se detecta eligiendo, entre los cuatro candidatos, el que parte
  en más de un campo el mayor número de líneas.
- Los campos son, en orden: pregunta, respuesta y etiquetas (opcional, separadas
  por `,` o `;`).
- Dentro de comillas dobles, `""` es una comilla literal.
- Se descartan los espacios de los extremos de cada campo.
- Las líneas vacías y las que empiezan por `#` se ignoran
  ([RF-210](02-requisitos.md)).
- Si la primera fila son nombres de columna conocidos, es cabecera.

Nombres de columna reconocidos:

| Papel | Nombres aceptados |
| --- | --- |
| Pregunta | `front`, `pregunta`, `anverso`, `q`, `question`, `termino`, `término` |
| Respuesta | `back`, `respuesta`, `reverso`, `a`, `answer`, `definicion`, `definición` |
| Etiquetas | `tags`, `etiquetas`, `tag`, `etiqueta` |

### JSON

Cuatro formas, todas válidas:

```jsonc
// 1 · lista de objetos
[{ "pregunta": "perro", "respuesta": "dog", "etiquetas": ["animales"] }]

// 2 · lista de listas
[["perro", "dog"], ["gato", "cat"]]

// 3 · objeto con nombre de mazo
{ "mazo": "Inglés", "tarjetas": [ ... ] }

// 4 · copia de seguridad completa (se reconoce por traer "decks" y "cards")
{ "version": 1, "decks": [...], "cards": [...], "settings": {...} }
```

La forma 4 **sustituye** todo el contenido tras confirmar; las tres primeras
**añaden** tarjetas al mazo destino ([RF-206](02-requisitos.md)).

La secuencia `\n` dentro de un texto se convierte en salto de línea real, para
poder escribir respuestas de varias líneas en una sola línea de CSV.

## Errores

La importación es **todo o nada**: si una sola línea está mal, no se añade
ninguna tarjeta y el mensaje dice qué línea y qué le pasa
([RF-207](02-requisitos.md)).

| Situación | Mensaje |
| --- | --- |
| Entrada vacía | `No hay nada que importar.` |
| Sin separador reconocible | `No encuentro el separador. Usa una línea por tarjeta con el formato: pregunta \| respuesta` |
| Falta pregunta o respuesta | `Línea N: falta la pregunta o la respuesta ("...").` |
| JSON inválido | `El JSON no es válido: ...` |
| JSON que no es una lista de tarjetas | `Esperaba una lista de tarjetas o una copia de seguridad.` |
