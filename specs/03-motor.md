# El motor de repetición espaciada

Especificación del algoritmo. Es la parte del sistema que decide **cuándo** se
vuelve a ver cada tarjeta, y la única que no puede tener sorpresas: un error
aquí no se ve, se nota meses después en forma de material olvidado.

Implementación: [`js/srs.js`](../js/srs.js). Sin acceso al navegador y con
funciones puras ([RNF-108](02-requisitos.md)), para poder comprobarlo entero
desde Node.

## Origen y por qué este algoritmo

Es una variante de **SM-2**, el algoritmo de SuperMemo que popularizó Anki, con
pasos de aprendizaje cortos añadidos. Se elige por tres razones: está validado
por décadas de uso, se explica en un párrafo, y cada decisión que toma se puede
justificar ante el usuario en la propia pantalla ([RF-304](02-requisitos.md)).

No se usa FSRS —el algoritmo moderno basado en un modelo de memoria ajustado con
datos— porque necesita miles de repasos previos para valer la pena y añade una
tabla de pesos imposible de explicar. Si algún día hay historial suficiente, el
motor está aislado para poder sustituirlo.

## Estado de una tarjeta

| Campo | Tipo | Significado |
| --- | --- | --- |
| `state` | `new` \| `learning` \| `review` \| `relearning` | En qué fase está |
| `step` | entero ≥ 0 | Paso de aprendizaje actual (solo en `learning`/`relearning`) |
| `interval` | días ≥ 0 | Días hasta el próximo repaso si se acierta |
| `ease` | número ≥ 1,3 | Facilidad: cuánto se multiplica el intervalo al acertar |
| `due` | instante | Cuándo vuelve a tocar |
| `reps` | entero | Veces respondida |
| `lapses` | entero | Veces olvidada estando en repaso |
| `lastReviewed` | instante \| null | Última respuesta |

## Parámetros

Valores por defecto, en `DEFAULT_CONFIG`:

| Parámetro | Valor | Papel |
| --- | --- | --- |
| `learningSteps` | `[1, 10]` min | Pasos de una tarjeta nueva |
| `relearningSteps` | `[10]` min | Pasos tras olvidar una tarjeta |
| `graduatingInterval` | 1 día | Primer intervalo al salir de aprendizaje con *Bien* |
| `easyInterval` | 4 días | Primer intervalo al salir con *Fácil* |
| `startingEase` | 2,5 | Facilidad inicial |
| `minEase` | 1,3 | Suelo de la facilidad |
| `easyBonus` | 1,3 | Multiplicador extra de *Fácil* |
| `hardFactor` | 1,2 | Multiplicador de *Difícil* |
| `lapseFactor` | 0,5 | Recorte del intervalo al fallar |
| `maxInterval` | 1825 días (5 años) | Techo |
| `fuzz` | activada | Dispersión ±5 % |

## Máquina de estados

```
                  Bien (último paso) / Fácil
      ┌──────────────────────────────────────────────┐
      │                                              ▼
   ┌──────┐  1ª respuesta   ┌──────────┐         ┌────────┐
   │ new  │ ──────────────► │ learning │         │ review │
   └──────┘                 └──────────┘         └────────┘
                              ▲      │               │  ▲
                Fallo/Difícil │      │ Bien          │  │ Bien (último paso)
                              └──────┘        Fallo  │  │ / Fácil
                                                     ▼  │
                                              ┌────────────┐
                                              │ relearning │
                                              └────────────┘
                                                  ▲     │
                                    Fallo/Difícil │     │ Bien
                                                  └─────┘
```

## Tabla de transiciones

`p` = intervalo anterior en días, `f` = facilidad anterior, `s` = paso actual.

### Desde `new` / `learning` (pasos `[1, 10]` min)

| Respuesta | Estado siguiente | Paso | Próxima aparición |
| --- | --- | --- | --- |
| Fallo | `learning` | 0 | 1 min |
| Difícil | `learning` | `s` (sin avanzar) | media entre el paso actual y el siguiente; en el último, paso × 1,5 |
| Bien | `learning` si queda paso, si no `review` | `s+1` | siguiente paso, o **1 día** al graduarse |
| Fácil | `review` | — | **4 días** |

Una tarjeta `new` entra siempre por el paso 0, responda lo que responda.

### Desde `review`

| Respuesta | Estado siguiente | Facilidad | Intervalo nuevo |
| --- | --- | --- | --- |
| Fallo | `relearning`, paso 0 | `f − 0,20` | `máx(1, p × 0,5)`, guardado para cuando se recupere. Vuelve en 10 min |
| Difícil | `review` | `f − 0,15` | `p × 1,2` |
| Bien | `review` | `f` | `p × f` |
| Fácil | `review` | `f + 0,15` | `p × f × 1,3` |

Al acertar, el intervalo resultante se redondea, se le aplica la dispersión y
nunca queda por debajo de `p + 1` día ([INV-104](#inv-104--acertar-siempre-aleja-la-tarjeta)).

### Desde `relearning` (pasos `[10]` min)

Igual que `learning`, con una diferencia al graduarse: la tarjeta **no** vuelve
a 1 día, sino al intervalo recortado que se guardó al fallar (× 1,3 si se
gradúa con *Fácil*). Olvidar algo no borra el historial, solo lo penaliza.

## Invariantes

Se cumplen para **cualquier** secuencia de respuestas, no solo para las
probadas. Cada uno tiene su prueba.

### INV-101 — El motor no muta lo que recibe

`review(tarjeta, respuesta)` devuelve una tarjeta nueva y deja la original
intacta. Sin esto no se puede previsualizar un plazo sin aplicarlo, que es
justo lo que necesita [RF-304](02-requisitos.md).

**Verificación:** automática

### INV-102 — Los cuatro plazos están ordenados

Para cualquier tarjeta y en cualquier estado, sobre los plazos nominales (los
que se muestran en pantalla, antes de la dispersión de INV-108):

```
plazo(Fallo) < plazo(Difícil) < plazo(Bien) < plazo(Fácil)
```

Los cuatro son estrictamente distintos. Si dos botones dieran lo mismo, uno de
los dos sobraría y la escala de cuatro niveles sería mentira.

Conseguirlo no es gratis: con un intervalo de un día, `× 1,2`, `× facilidad` y
`× facilidad × 1,3` se redondean todos al mismo número. Por eso los tres
intervalos de acierto se calculan **encadenados**, cada uno al menos un día por
encima del anterior. Única excepción: al llegar al techo de INV-105, donde por
definición empatan.

**Verificación:** automática

### INV-103 — La facilidad tiene suelo

`ease ≥ 1,3` siempre. Sin suelo, una racha de fallos deja la facilidad cerca de
cero y la tarjeta no vuelve a espaciarse nunca, aunque después se domine.

**Verificación:** automática

### INV-104 — Acertar siempre aleja la tarjeta

En estado `review`, cualquier respuesta distinta de *Fallo* produce un intervalo
estrictamente mayor que el anterior: al menos `p + 1` días. Esto importa con
facilidad baja, donde `p × 1,2` redondeado podría devolver el mismo número y
dejar la tarjeta congelada repitiéndose para siempre.

**Verificación:** automática

### INV-105 — Hay un techo

`interval ≤ 1825` días. Más allá de cinco años el intervalo deja de significar
nada.

**Verificación:** automática

### INV-106 — Fallar penaliza de forma acotada

Fallar en `review`: `lapses` sube en 1, la facilidad baja 0,20 (con el suelo de
INV-103), el intervalo pasa a `máx(1, p × 0,5)` y la tarjeta vuelve en 10
minutos. El intervalo se recorta, nunca se pierde del todo.

**Verificación:** automática

### INV-107 — Recuperarse devuelve el intervalo recortado

Al superar el reaprendizaje, la tarjeta vuelve a `review` con el intervalo que
se guardó al fallar, no con 1 día. Una tarjeta que estaba en 60 días y se
olvidó una vez vuelve a 30, no al principio.

**Verificación:** automática

### INV-108 — La dispersión no cambia el orden de magnitud

La dispersión aleatoria de ±5 % solo se aplica a intervalos de 3 días o más, y
nunca produce un intervalo menor que 1 día. Existe para que 200 tarjetas
programadas el mismo día no caigan todas el mismo día dentro de tres meses.

**Verificación:** automática

### INV-109 — Fallar repetidamente mantiene la tarjeta cerca

Una tarjeta que se falla y se aprueba una y otra vez no se aleja: su intervalo
se mantiene en pocos días indefinidamente. Es la propiedad que hace que el
sistema sirva de algo — lo difícil sigue apareciendo.

**Verificación:** automática

### INV-110 — Acertar repetidamente aleja rápido

Seis respuestas *Bien* seguidas desde una tarjeta nueva llevan el intervalo por
encima de un mes. Es la contrapartida de INV-109: lo que se domina deja de robar
tiempo.

**Verificación:** automática
