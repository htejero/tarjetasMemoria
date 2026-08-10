# Alcance

## El problema

Estudiar algo de memoria repasándolo "cuando toque" desperdicia tiempo por los
dos lados: se repasa de más lo que ya se sabe y se repasa de menos lo que está a
punto de olvidarse. La curva del olvido dice que el mejor momento para volver a
ver algo es justo antes de perderlo, y ese momento es distinto para cada tarjeta
y para cada persona.

La app resuelve eso: lleva la cuenta de lo bien que recuerdas cada tarjeta y
decide por ti cuándo volver a enseñártela.

## Para quién

Una sola persona, en su móvil, estudiando material que ella misma escribe o que
genera con ayuda de una IA. No hay profesor, ni clase, ni alumnos que gestionar.

De ahí salen tres decisiones que atraviesan todo el diseño:

- **Sin cuentas ni servidor.** Los datos viven en el navegador del dispositivo.
- **Sin dependencias.** HTML, CSS y JavaScript a pelo, para que esto siga
  funcionando dentro de cinco años sin tocar nada.
- **El móvil manda.** Se diseña primero para una pantalla estrecha y un pulgar.

## Dentro del alcance

1. Crear tarjetas a mano e importarlas en bloque desde texto, CSV, TSV o JSON.
2. Organizarlas en mazos.
3. Estudiar con repetición espaciada y cuatro niveles de respuesta.
4. Límites diarios para que un mazo grande no abrume.
5. Copia de seguridad exportable e importable.
6. Uso sin conexión e instalación en la pantalla de inicio del móvil.

## Fuera del alcance (por ahora)

Se dejan fuera a propósito, no por olvido:

| Queda fuera | Por qué |
| --- | --- |
| Sincronizar entre dispositivos | Obliga a servidor y cuentas; rompe la premisa de "sin infraestructura" |
| Compartir mazos con otras personas | Mismo motivo |
| Imágenes y audio en las tarjetas | Multiplica el tamaño de los datos y el almacenamiento del navegador es limitado |
| Modo escritura (teclear la respuesta) | El caso de uso es de pulgar, en el móvil; la autoevaluación es más rápida |
| Tarjetas con huecos (*cloze*) | Complica el modelo de datos antes de saber si hace falta |
| App nativa en la App Store | La PWA cubre el uso real sin proceso de revisión ni cuota de desarrollador |

Las dos primeras son las candidatas naturales a entrar más adelante; el motor
está aislado precisamente para que eso no obligue a reescribir nada.

## Vocabulario

Estos términos significan exactamente esto en toda la especificación:

- **Tarjeta** — una pregunta con su respuesta, más el estado de tu memoria sobre
  ella.
- **Mazo** — un grupo de tarjetas. Una tarjeta pertenece a un solo mazo.
- **Respuesta del usuario** — cuál de los cuatro botones pulsas: *Fallo*,
  *Difícil*, *Bien* o *Fácil*.
- **Intervalo** — días entre un repaso y el siguiente, si aciertas.
- **Facilidad** — multiplicador propio de cada tarjeta que crece cuando aciertas
  con soltura y baja cuando fallas. Empieza en 2,5.
- **Vencimiento** — el instante a partir del cual la tarjeta vuelve a tocar.
- **Tarjeta vencida** — aquella cuyo vencimiento ya ha pasado.
- **Cola** — la lista ordenada de tarjetas que toca estudiar ahora.
- **Día de estudio** — no coincide con el día natural: empieza a las 4:00 de la
  mañana, para que estudiar a la 1:00 cuente como el día anterior.
- **Sesión** — el rato seguido que pasas en la pantalla de estudiar.
