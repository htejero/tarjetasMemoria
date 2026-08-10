# Cómo se trabaja en este proyecto

Desarrollo dirigido por especificación (*specification driven development*). La
regla es una sola:

> **La especificación es la fuente de verdad. El código existe para cumplirla y
> las pruebas existen para demostrarlo.**

Si el código y la especificación no coinciden, uno de los dos está mal y hay que
arreglarlo antes de seguir. Nunca se cierra la diferencia "de palabra".

## Los documentos

| Documento | Qué contiene |
| --- | --- |
| [`01-alcance.md`](01-alcance.md) | Para qué es esto, para quién, qué queda fuera y el vocabulario |
| [`02-requisitos.md`](02-requisitos.md) | Requisitos funcionales (`RF-nnn`) y no funcionales (`RNF-nnn`) con sus criterios de aceptación |
| [`03-motor.md`](03-motor.md) | Especificación formal del motor de repetición espaciada: estados, transiciones e invariantes (`INV-nnn`) |
| [`04-datos.md`](04-datos.md) | Esquema de los datos guardados y gramática de los formatos de importación |
| [`05-trazabilidad.md`](05-trazabilidad.md) | Matriz generada: qué requisito cubre qué prueba. **No se edita a mano** |

## Los identificadores

Cada requisito e invariante tiene un identificador estable:

- `RF-nnn` — requisito funcional. Qué tiene que hacer la app.
- `RNF-nnn` — requisito no funcional. Cómo tiene que comportarse.
- `INV-nnn` — invariante del motor. Algo que se cumple siempre, en cualquier
  secuencia de respuestas.

Los identificadores **no se reciclan**. Si un requisito desaparece se marca
como retirado, pero su número no vuelve a usarse: así los enlaces viejos nunca
apuntan a otra cosa.

## El ciclo de trabajo

Para cualquier cambio, en este orden:

1. **Especificar.** Se escribe o se modifica el requisito, con sus criterios de
   aceptación en forma *dado / cuando / entonces*. Un criterio que no se puede
   comprobar no es un criterio: hay que reescribirlo.
2. **Probar.** Se escribe la prueba que falla, con el identificador del
   requisito entre corchetes en su nombre:
   ```js
   test('[RF-205] no se importa una pregunta que ya existe en el mazo', () => { … })
   ```
   Ese corchete es lo que ata la prueba al requisito; sin él, la trazabilidad no
   lo ve.
3. **Implementar.** El código mínimo que hace pasar la prueba. En el fuente se
   marca con un comentario `@spec RF-205` la función responsable, para poder ir
   del requisito al código.
4. **Verificar.** `npm test` ejecuta las pruebas **y** comprueba la
   trazabilidad. Falla si algún requisito de verificación automática se ha
   quedado sin prueba.

```bash
npm test          # pruebas + comprobación de trazabilidad
npm run spec      # regenera specs/05-trazabilidad.md
```

## Verificación automática y manual

Cada requisito declara cómo se comprueba:

- **automática** — hay al menos una prueba que lo cubre. Es lo normal y lo
  exigido por defecto.
- **manual** — no se puede comprobar con Node (que la app se instale en el
  iPhone, que se vea bien en oscuro). Lleva escrito el procedimiento concreto
  para repetirlo a mano, y la matriz lo lista aparte para que no se olvide.

Marcar algo como manual por comodidad es hacer trampa. Solo cuando de verdad no
hay forma de automatizarlo aquí.
