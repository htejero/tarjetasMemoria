# Requisitos

Cada requisito lleva un identificador estable, sus criterios de aceptación y
cómo se verifica:

- **automática** — prueba con Node (`tests/*.test.mjs`).
- **navegador** — prueba de interfaz con Playwright (`tests/ui/*.ui.mjs`).
- **manual** — hay que comprobarlo a mano; lleva escrito el procedimiento.
- **retirado** — ya no se exige. Se conserva la ficha con el motivo, porque los
  números no se reutilizan.

---

## RF-1xx · Tarjetas y mazos

### RF-101 — Crear una tarjeta a mano

**Necesidad.** Anotar algo que quieres recordar sin salir de la app.

**Criterios de aceptación.**
1. **Dado** el formulario de tarjeta nueva, **cuando** relleno pregunta y
   respuesta y guardo, **entonces** la tarjeta aparece en el mazo elegido en
   estado *nueva* y lista para estudiarse.
2. **Dado** el formulario, **cuando** dejo la pregunta o la respuesta en blanco,
   **entonces** no se guarda nada y se explica qué falta.
3. Las etiquetas son opcionales y se escriben separadas por comas.

**Verificación:** navegador

### RF-102 — Editar una tarjeta

**Necesidad.** Corregir una errata sin perder el progreso acumulado.

**Criterios de aceptación.**
1. **Dado** que edito el texto de una tarjeta ya estudiada, **cuando** guardo,
   **entonces** cambian pregunta, respuesta, etiquetas y mazo, **y** el
   intervalo, la facilidad y el vencimiento **no** cambian.

**Verificación:** automática

### RF-103 — Borrar una tarjeta

**Criterios de aceptación.**
1. **Dado** que pido borrar una tarjeta, **cuando** confirmo, **entonces**
   desaparece de la lista y de la cola de estudio.
2. **Cuando** cancelo la confirmación, **entonces** no se borra nada.

**Verificación:** automática

### RF-104 — Buscar tarjetas

**Criterios de aceptación.**
1. **Dado** un texto en el buscador, **entonces** solo se listan las tarjetas
   cuya pregunta, respuesta o etiquetas lo contengan.
2. La búsqueda ignora mayúsculas y minúsculas.

**Verificación:** navegador

### RF-105 — Ver el estado de cada tarjeta en la lista

**Necesidad.** Saber de un vistazo qué está pendiente y qué está aparcado.

**Criterios de aceptación.**
1. Cada tarjeta de la lista muestra `nueva`, `pendiente` o `en <plazo>`, y sus
   etiquetas si las tiene.

**Verificación:** navegador

### RF-106 — Gestionar mazos

**Criterios de aceptación.**
1. Puedo crear un mazo con un nombre.
2. Puedo renombrar un mazo sin afectar a sus tarjetas.
3. **Dado** que solo queda un mazo, **cuando** intento borrarlo, **entonces** no
   se borra y se avisa: siempre tiene que quedar al menos uno.

**Verificación:** automática

### RF-107 — Borrar un mazo borra sus tarjetas

**Necesidad.** No dejar tarjetas huérfanas ocupando espacio invisible.

**Criterios de aceptación.**
1. **Dado** un mazo con tarjetas, **cuando** lo borro tras confirmar,
   **entonces** desaparecen también todas sus tarjetas y ninguna otra.

**Verificación:** automática

### RF-108 — Saber siempre qué mazos estoy estudiando

**Necesidad.** Con seis temas abiertos, lo único peor que no poder elegir es no
saber qué has elegido.

**Criterios de aceptación.**
1. La cabecera muestra en todo momento la selección activa: el nombre del mazo,
   *N mazos* si hay varios, o *Todos los mazos*.
2. **Cuando** toco esa etiqueta, **entonces** voy a la pantalla de mazos.
3. La sesión de estudio, la lista de tarjetas y los contadores se limitan a la
   selección.
4. **Dado** que un mazo de la selección se borra, **entonces** desaparece de la
   selección sin dejar la app en un estado roto.

**Verificación:** navegador

### RF-109 — Reiniciar el progreso de una tarjeta

**Necesidad.** Una tarjeta que se dio por sabida hace un año, o cuyo texto ha
cambiado tanto que ya es otra pregunta, tiene que poder empezar de cero sin
borrarla y volver a escribirla.

**Criterios de aceptación.**
1. **Dado** que reinicio una tarjeta en repaso, **entonces** vuelve a estado
   *nueva*, con facilidad 2,5, intervalo 0, cero repeticiones y cero fallos, y
   vence ya.
2. El texto, las etiquetas y el mazo no cambian.

**Verificación:** automática

### RF-110 — Pantalla de mazos

**Necesidad.** El caso de uso real es abrir la app por la mañana y decidir qué
toca hoy: francés, chino, historia. Para decidir hace falta ver de un vistazo
cuánto tiene pendiente cada uno.

**Criterios de aceptación.**
1. Hay una pantalla, la primera de la aplicación, que lista todos los mazos.
2. Cada mazo muestra cuántas tarjetas le tocan hoy, desglosadas en nuevas,
   aprendiendo y repaso, y su total.
3. Las nuevas que muestra son las que de verdad se pueden estudiar hoy, ya
   descontado el cupo diario ya consumido en ese mazo.
4. Un mazo sin nada pendiente se distingue a simple vista de uno con trabajo.
5. **Cuando** toco el nombre de un mazo, **entonces** empiezo a estudiarlo.
6. Desde ahí se crean mazos y se accede a renombrarlos y borrarlos.

**Verificación:** navegador

### RF-111 — Estudiar varios mazos a la vez

**Necesidad.** Unos días toca solo chino; otros, chino e historia pero no
francés.

**Criterios de aceptación.**
1. En la pantalla de mazos puedo marcar varios y estudiarlos juntos.
2. Sin ninguno marcado se estudian todos.
3. La selección se conserva entre sesiones, y se limpia sola de mazos borrados.
4. Al estudiar varios mazos, las tarjetas se entremezclan en lugar de agotar un
   mazo antes de empezar el siguiente.

**Verificación:** navegador

---

## RF-2xx · Entrada y salida de datos

### RF-201 — Importar texto con separador

**Necesidad.** La forma más rápida de meter un mazo: pegar una lista, sea escrita
a mano o generada por una IA.

**Criterios de aceptación.**
1. **Dado** un texto con una tarjeta por línea en formato
   `pregunta | respuesta`, **entonces** se crea una tarjeta por línea.
2. Se aceptan como separador `|`, tabulador, `;` y `,`, eligiendo el que aparece
   de forma consistente en más líneas.
3. Los espacios sobrantes alrededor de cada campo se descartan.

**Verificación:** automática

### RF-202 — Importar CSV y TSV

**Criterios de aceptación.**
1. Se admite una tercera columna con etiquetas separadas por `,` o `;`.
2. Un campo entre comillas dobles puede contener el separador, y `""` dentro de
   él significa una comilla literal.
3. **Dado** que la primera fila son nombres de columna conocidos (`pregunta`,
   `respuesta`, `etiquetas`, `front`, `back`, `tags`…), **entonces** se trata
   como cabecera y no se convierte en tarjeta.

**Verificación:** automática

### RF-203 — Importar JSON

**Criterios de aceptación.**
1. Se acepta una lista de objetos, una lista de listas `[pregunta, respuesta]` o
   un objeto `{ "mazo": "...", "tarjetas": [...] }`.
2. Las claves valen en español o en inglés (`pregunta`/`front`,
   `respuesta`/`back`, `etiquetas`/`tags`).
3. La secuencia `\n` dentro de un texto se convierte en un salto de línea real.

**Verificación:** automática

### RF-204 — Importar desde fichero

**Criterios de aceptación.**
1. **Cuando** elijo un fichero `.txt`, `.csv`, `.tsv` o `.json`, **entonces** su
   contenido se importa igual que si lo hubiera pegado.

**Verificación:** navegador

### RF-205 — No duplicar tarjetas

**Necesidad.** Poder volver a pegar la misma lista, ampliada, sin acabar con la
mitad de las tarjetas repetidas.

**Criterios de aceptación.**
1. **Dado** un mazo que ya contiene una pregunta, **cuando** importo un texto que
   la incluye, **entonces** esa tarjeta se omite y las demás se añaden.
2. La comparación ignora mayúsculas y espacios alrededor, y se hace solo dentro
   del mazo destino.
3. El resultado dice cuántas se han añadido y cuántas se han omitido.

**Verificación:** automática

### RF-206 — Elegir el mazo destino al importar

**Criterios de aceptación.**
1. **Dado** un mazo seleccionado en la cabecera, **entonces** las tarjetas
   importadas van a ese mazo.
2. **Dado** *Todos los mazos* y un JSON con nombre de mazo, **entonces** se usa
   el mazo con ese nombre, creándolo si no existe.
3. **Dado** *Todos los mazos* y una entrada sin nombre de mazo, **entonces** se
   usa el primer mazo.

**Verificación:** automática

### RF-207 — Errores de importación accionables

**Necesidad.** "Formato incorrecto" no sirve de nada cuando pegas 200 líneas.

**Criterios de aceptación.**
1. **Dado** un texto donde una línea no tiene respuesta, **entonces** el error
   indica el número de línea y reproduce su contenido.
2. **Dado** un JSON mal formado, **entonces** el error lo dice explícitamente.
3. **Dado** un texto sin ningún separador reconocible, **entonces** el error
   explica el formato esperado.
4. Ningún error deja tarjetas a medio importar.

**Verificación:** automática

### RF-208 — Exportar copia de seguridad

**Necesidad.** Los datos viven en el navegador; sin exportación, un borrado de
datos de Safari se lleva meses de trabajo.

**Criterios de aceptación.**
1. **Cuando** exporto, **entonces** se descarga un JSON con mazos, tarjetas,
   ajustes e historial, con el nombre `tarjetas-AAAA-MM-DD.json`.
2. Ese fichero, restaurado, reproduce el estado exacto: mismo progreso, mismos
   vencimientos.

**Verificación:** automática

### RF-209 — Restaurar copia de seguridad

**Criterios de aceptación.**
1. **Dado** un fichero de copia de seguridad, **cuando** lo cargo y confirmo,
   **entonces** sustituye todo el contenido actual.
2. Antes de sustituir nada se pide confirmación indicando cuántas tarjetas trae.
3. Una copia de una versión anterior del formato se adapta sin perder tarjetas.

**Verificación:** automática

### RF-210 — Ignorar líneas vacías y comentarios

**Criterios de aceptación.**
1. Las líneas en blanco y las que empiezan por `#` no generan tarjetas ni
   errores.

**Verificación:** automática

### RF-211 — Copia de seguridad asistida

**Necesidad.** Los datos viven en el navegador de un solo dispositivo. Una copia
que depende de que te acuerdes de hacerla no es una copia. Un navegador **no
puede** escribir un fichero por su cuenta y sin permiso —ni en iOS ni en ningún
sitio—, así que lo máximo honesto es: avisar cuando toca y que guardarla cueste
un solo gesto.

**Criterios de aceptación.**
1. Se recuerda cuándo se hizo la última copia.
2. **Dado** que hay tarjetas y han pasado 7 días o más desde la última copia (o
   no se ha hecho ninguna), **entonces** aparece un aviso visible con un botón
   para guardarla.
3. **Cuando** guardo la copia, **entonces** el aviso desaparece y no vuelve
   hasta dentro de otros 7 días.
4. En un móvil que lo permita, el botón ofrece compartir el fichero (Archivos,
   iCloud, correo); si no, lo descarga.
5. Restaurar una copia también cuenta como copia reciente.

**Verificación:** automática

---

## RF-3xx · Sesión de estudio

### RF-301 — La respuesta está oculta hasta que se pide

**Necesidad.** Si se ve la respuesta, no hay recuerdo que medir y el dato que
alimenta el algoritmo es basura.

**Criterios de aceptación.**
1. **Dado** que aparece una tarjeta, **entonces** se ve la pregunta y no la
   respuesta.
2. Los cuatro botones de respuesta tampoco se ven hasta voltear, para que no se
   pueda responder a ciegas.

**Verificación:** navegador

### RF-302 — Voltear la tarjeta

**Criterios de aceptación.**
1. **Cuando** toco la tarjeta, **entonces** se muestra la respuesta bajo la
   pregunta, junto con los cuatro botones.

**Verificación:** navegador

### RF-303 — Cuatro niveles de respuesta

**Criterios de aceptación.**
1. Los botones son, en este orden: *Fallo*, *Difícil*, *Bien*, *Fácil*.
2. Cada uno programa la tarjeta según [`03-motor.md`](03-motor.md).

**Verificación:** navegador

### RF-304 — Ver el plazo antes de responder

**Necesidad.** Poder decidir con conocimiento de causa, y de paso entender qué
hace el algoritmo.

**Criterios de aceptación.**
1. **Dado** que la tarjeta está volteada, **entonces** bajo cada botón se lee
   cuándo volvería a aparecer si lo pulso.
2. El plazo mostrado coincide con el que se aplica al pulsar, salvo la
   dispersión de [INV-108](03-motor.md).
3. Los cuatro plazos van de menor a mayor y son distintos entre sí, salvo al
   llegar al techo de cinco años.

**Verificación:** navegador

### RF-305 — Responder y pasar a la siguiente

**Criterios de aceptación.**
1. **Cuando** pulso un botón, **entonces** se guarda el resultado y aparece la
   siguiente tarjeta de la cola, sin respuesta visible.
2. Se confirma brevemente qué he respondido y cuándo vuelve la tarjeta.
3. **Dado** que quedan otras tarjetas por estudiar, **entonces** la siguiente no
   es la que acabo de responder.

**Verificación:** navegador

### RF-306 — Explicar por qué no hay nada que estudiar

**Necesidad.** Una pantalla vacía sin explicación parece una app rota.

**Criterios de aceptación.**
1. **Dado** un mazo sin tarjetas, **entonces** se dice eso y se ofrece añadirlas.
2. **Dado** que quedan tarjetas nuevas pero se ha alcanzado el límite diario,
   **entonces** se dice cuál es el límite y cuántas quedan sin empezar.
3. **Dado** que está todo repasado, **entonces** se dice cuándo vuelve la
   siguiente tarjeta.

**Verificación:** automática

### RF-307 — Editar o borrar la tarjeta que estoy viendo

**Necesidad.** Las erratas se descubren justo al estudiar.

**Criterios de aceptación.**
1. Desde la pantalla de estudio puedo editar o borrar la tarjeta actual sin
   perder la sesión.

**Verificación:** navegador

### RF-308 — Atajos de teclado

**Criterios de aceptación.**
1. **Espacio** o **Intro** voltean la tarjeta.
2. Las teclas **1** a **4** responden *Fallo*, *Difícil*, *Bien* y *Fácil*.
3. Los atajos no actúan mientras escribo en un campo de texto ni con el editor
   abierto.

**Verificación:** navegador

---

## RF-4xx · Qué se estudia y cuándo

### RF-401 — Orden de la cola

**Necesidad.** Lo que está a punto de olvidarse va primero; lo nuevo, al final,
porque introducir material cuando ya hay atraso es lo que hunde a la gente.

**Criterios de aceptación.**
1. La cola es: repasos vencidos (el más atrasado primero), después aprendizaje
   vencido (el más atrasado primero), después tarjetas nuevas (por orden de
   creación).
2. Una tarjeta que aún no ha vencido nunca entra en la cola, salvo por el
   adelanto de [RF-406](#rf-406--no-cortar-la-sesión-por-unos-minutos).

**Verificación:** automática

### RF-402 — Límite diario de tarjetas nuevas, por mazo

**Necesidad.** El cupo tiene que ser **de cada mazo**, no del conjunto. Con un
cupo global y varios temas abiertos, el mazo que importaste primero se lo come
entero durante días y los demás no llegan a arrancar nunca: con dos mazos de 100
tarjetas, las 20 nuevas de hoy salían las 20 del primero. Con un cupo por mazo,
cada tema avanza a su ritmo y la pantalla de mazos dice la verdad.

**Criterios de aceptación.**
1. **Dado** un límite de N nuevas al día, **entonces** no se introducen más de N
   tarjetas nuevas **de cada mazo** en un mismo día de estudio.
2. El cupo consumido se cuenta por separado en cada mazo.
3. **Dado** que estudio varios mazos a la vez, **entonces** sus tarjetas nuevas
   se alternan en lugar de servirse todas las de un mazo antes que las del
   siguiente.
4. El límite no afecta a las tarjetas ya empezadas.
5. Con el límite a 0 no se introduce ninguna nueva.

**Verificación:** automática

### RF-403 — Límite diario de repasos ~~(retirado)~~

**Retirado.** Los repasos vencidos ya no se limitan: si toca, toca.

El límite venía de Anki, donde tiene sentido con mazos compartidos de miles de
tarjetas que uno no ha escrito. Aquí las tarjetas las escribes tú, así que el
volumen diario ya está acotado de forma natural por el ritmo al que las creas, y
lo que hace el límite de repasos es justo lo contrario de lo que se busca:
aplaza material que el algoritmo ha calculado que estás a punto de olvidar, y lo
acumula para mañana. El freno correcto está en la entrada de material nuevo
([RF-402](#rf-402--límite-diario-de-tarjetas-nuevas)), no en la salida.

Su número no se reutiliza.

**Verificación:** retirado

### RF-404 — El aprendizaje empezado no se corta

**Necesidad.** Dejar una tarjeta a medio aprender por un límite es lo peor de
los dos mundos: ya has gastado el esfuerzo y no consolidas.

**Criterios de aceptación.**
1. **Dado** que se ha alcanzado el límite diario de tarjetas nuevas,
   **entonces** las tarjetas en aprendizaje o reaprendizaje que ya han vencido
   se siguen ofreciendo.

**Verificación:** automática

### RF-405 — El día de estudio empieza a las 4:00

**Necesidad.** Estudiar a la una de la madrugada es "ayer por la noche", no un
día nuevo con el cupo recién puesto a cero.

**Criterios de aceptación.**
1. El contador de tarjetas nuevas introducidas se reinicia a las 4:00
   locales, no a medianoche.
2. **Dado** que respondo a las 2:00, **entonces** cuenta para el día natural
   anterior.

**Verificación:** automática

### RF-406 — No cortar la sesión por unos minutos

**Necesidad.** Con un mazo pequeño, todo lo pendiente vence "en 3 minutos" y la
sesión se quedaría en blanco esperando al reloj.

**Criterios de aceptación.**
1. **Dado** que no hay nada vencido pero sí tarjetas en aprendizaje que vencen
   dentro de los próximos 20 minutos, **entonces** se adelantan en lugar de
   terminar la sesión.
2. Este adelanto no se aplica a las tarjetas en estado *repaso*: esas esperan a
   su día.

**Verificación:** automática

### RF-407 — La pantalla se pone al día sola

**Necesidad.** Si vuelves a la app cinco horas después, lo que ves tiene que ser
lo que toca ahora, no lo que tocaba al abrirla.

**Criterios de aceptación.**
1. **Cuando** la app vuelve a primer plano, **entonces** se recalcula la cola y
   los contadores.
2. **Dado** que la pantalla de estudio está vacía y la siguiente tarjeta pasará
   a estar disponible dentro de los próximos 30 minutos, **entonces** la
   pantalla se actualiza sola en ese momento, sin recargar ni tocar nada.

**Verificación:** navegador

---

## RF-5xx · Ajustes y progreso

### RF-501 — Cambiar el límite diario de tarjetas nuevas

**Criterios de aceptación.**
1. Puedo cambiar cuántas tarjetas nuevas se introducen al día en cada mazo.
2. El valor por defecto es 20, y se aplica a todos los mazos por igual.
3. Un valor negativo o no numérico se corrige a 0.
4. El cambio tiene efecto inmediato, sin recargar.
5. No hay ningún ajuste equivalente para los repasos
   ([RF-403](#rf-403--límite-diario-de-repasos-retirado) está retirado).

**Verificación:** automática

### RF-502 — Ver el progreso

**Criterios de aceptación.**
1. Se muestran: tarjetas en total, respondidas hoy, respondidas esta semana y
   porcentaje de aciertos de los últimos 7 días.
2. Cuenta como acierto cualquier respuesta distinta de *Fallo*.
3. Sin respuestas en la semana, el porcentaje se muestra como `—` y no como 0 %.

**Verificación:** automática

### RF-503 — Borrar todo

**Criterios de aceptación.**
1. Borrar todos los datos exige dos confirmaciones seguidas.
2. Después queda un único mazo vacío y los ajustes por defecto.

**Verificación:** automática

### RF-504 — Progreso por mazo

**Necesidad.** "Aciertos: 82 %" sobre todo junto no dice nada cuando estudias
francés, chino e historia a la vez. Lo que quieres saber es en cuál vas bien.

**Criterios de aceptación.**
1. Cada mazo muestra: tarjetas en total, cuántas están dominadas (intervalo de
   21 días o más), respuestas de los últimos 7 días y porcentaje de aciertos de
   ese periodo.
2. Cuenta como acierto cualquier respuesta distinta de *Fallo*.
3. Un mazo sin respuestas en el periodo muestra `—`, no 0 %.
4. Las respuestas a tarjetas ya borradas no se cuentan en ningún mazo.

**Verificación:** automática

### RF-505 — Tarjetas problemáticas

**Necesidad.** Una tarjeta que has fallado seis veces casi nunca es un problema
de memoria: es una tarjeta mal escrita, demasiado larga o ambigua. Verlas juntas
es lo que permite arreglarlas, y arreglarlas rinde más que cualquier ajuste del
algoritmo.

**Criterios de aceptación.**
1. Hay una lista de las tarjetas con 5 fallos o más, de más a menos fallos.
2. Cada una muestra su mazo y cuántas veces se ha olvidado.
3. Desde la lista se puede editar o reiniciar la tarjeta directamente.
4. Sin tarjetas problemáticas, se dice explícitamente que no hay ninguna.

**Verificación:** automática

---

## RNF-1xx · Requisitos no funcionales

### RNF-101 — Sin dependencias en tiempo de ejecución

**Necesidad.** Que la app siga funcionando dentro de cinco años sin mantenimiento
y sin cadena de suministro que auditar.

**Criterios de aceptación.**
1. `package.json` no declara ninguna dependencia de ejecución.
2. Ningún fichero servido al navegador carga recursos de dominios externos.

**Verificación:** automática

### RNF-102 — Funciona sin conexión

**Criterios de aceptación.**
1. Tras la primera visita, la app arranca y permite estudiar en modo avión.
2. El *service worker* cachea todos los ficheros del esqueleto de la app.

**Verificación:** automática

**Procedimiento manual complementario.** Abrir la app, activar el modo avión,
cerrarla del todo y volver a abrirla: tiene que arrancar y dejar responder
tarjetas.

### RNF-103 — Instalable como app en el móvil

**Criterios de aceptación.**
1. Hay un manifiesto válido con nombre, iconos de 192 y 512 px, `display:
   standalone` y colores de tema.
2. Hay un `apple-touch-icon` PNG para iOS.
3. Instalada en iOS, se abre sin barra de navegador.

**Verificación:** automática

**Procedimiento manual complementario.** En Safari (iPhone): *Compartir → Añadir
a pantalla de inicio*; abrir desde el icono y comprobar que no hay barra de
direcciones.

### RNF-104 — Los datos no salen del dispositivo

**Necesidad.** Lo que estudias puede ser material privado, y no hay ninguna razón
técnica para que salga de tu móvil.

**Criterios de aceptación.**
1. El código no hace peticiones de red salvo para cargar sus propios ficheros.
2. No hay analítica, ni telemetría, ni identificadores de usuario.

**Verificación:** automática

### RNF-105 — Usable con una mano en un móvil

**Criterios de aceptación.**
1. Los botones de respuesta y la navegación miden al menos 44 px de alto.
2. A 390 px de ancho no aparece desplazamiento horizontal.
3. La navegación principal está abajo, al alcance del pulgar.
4. Se respetan las zonas seguras (muesca y barra inferior) del iPhone.

**Verificación:** navegador

### RNF-106 — Tema claro y oscuro

**Criterios de aceptación.**
1. La app sigue el tema del sistema sin recargar.
2. En ambos temas, el texto sobre el fondo y sobre los botones de color es
   legible.

**Verificación:** navegador

### RNF-107 — Degradar bien si el almacenamiento falla

**Necesidad.** En navegación privada, o con la cuota llena, `localStorage` lanza
excepciones.

**Criterios de aceptación.**
1. **Dado** que los datos guardados están corruptos, **cuando** arranca la app,
   **entonces** empieza con un estado vacío en lugar de quedarse en blanco.
2. **Dado** que guardar falla, **entonces** se avisa al usuario y la app sigue
   respondiendo.

**Verificación:** automática

### RNF-108 — El motor no depende del navegador

**Necesidad.** Poder probarlo exhaustivamente, y poder reutilizarlo si algún día
esto se lleva a otra plataforma.

**Criterios de aceptación.**
1. `js/srs.js` no usa `window`, `document`, `localStorage` ni ninguna API del
   navegador.
2. Sus funciones son puras: con las mismas entradas dan la misma salida y no
   modifican sus argumentos.

**Verificación:** automática