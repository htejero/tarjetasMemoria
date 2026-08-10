# Trazabilidad

<!-- Generado por tools/trazabilidad.mjs. No editar a mano: se sobrescribe. -->

Qué requisito cubre qué prueba. Se regenera con `npm run spec` y se comprueba
en cada `npm test`.

| | |
| --- | --- |
| Requisitos especificados | 55 |
| De verificación automática o de navegador | 54 |
| Cubiertos por al menos una prueba | 54 |
| De verificación manual | 0 |
| Retirados | 1 |
| Pruebas distintas implicadas | 112 |

## Requisitos funcionales

| Id | Requisito | Verificación | Código | Pruebas |
| --- | --- | --- | --- | --- |
| [RF-101](02-requisitos.md#rf-101--crear-una-tarjeta-a-mano) | Crear una tarjeta a mano | navegador | `js/app.js`<br>`js/store.js` | una tarjeta nueva nace lista para estudiarse<br>crear una tarjeta a mano la deja lista para estudiar<br>sin pregunta o sin respuesta no se guarda nada |
| [RF-102](02-requisitos.md#rf-102--editar-una-tarjeta) | Editar una tarjeta | automática | `js/app.js`<br>`js/store.js` | editar el texto no toca el progreso |
| [RF-103](02-requisitos.md#rf-103--borrar-una-tarjeta) | Borrar una tarjeta | automática | `js/store.js` | borrar una tarjeta la quita del almacenamiento |
| [RF-104](02-requisitos.md#rf-104--buscar-tarjetas) | Buscar tarjetas | navegador | `js/app.js` | el buscador filtra sin distinguir mayúsculas |
| [RF-105](02-requisitos.md#rf-105--ver-el-estado-de-cada-tarjeta-en-la-lista) | Ver el estado de cada tarjeta en la lista | navegador | `js/app.js` | la lista muestra el estado y las etiquetas |
| [RF-106](02-requisitos.md#rf-106--gestionar-mazos) | Gestionar mazos | automática | `js/app.js`<br>`js/store.js` | se crean y se renombran mazos sin tocar sus tarjetas<br>nunca se puede quedar sin mazos |
| [RF-107](02-requisitos.md#rf-107--borrar-un-mazo-borra-sus-tarjetas) | Borrar un mazo borra sus tarjetas | automática | `js/store.js` | borrar un mazo se lleva sus tarjetas y solo las suyas |
| [RF-108](02-requisitos.md#rf-108--elegir-el-mazo-activo) | Elegir el mazo activo | navegador | `js/app.js` | el selector de mazo limita lo que se ve |
| [RF-109](02-requisitos.md#rf-109--reiniciar-el-progreso-de-una-tarjeta) | Reiniciar el progreso de una tarjeta | automática | `js/app.js`<br>`js/store.js` | reiniciar devuelve la tarjeta a nueva sin tocar el texto<br>se puede reiniciar el progreso desde el editor<br>una tarjeta sin estudiar no ofrece reiniciar |
| [RF-201](02-requisitos.md#rf-201--importar-texto-con-separador) | Importar texto con separador | automática | `js/parse.js` | lee líneas separadas por barra vertical<br>elige el separador que parte de forma consistente<br>descarta los espacios de los extremos |
| [RF-202](02-requisitos.md#rf-202--importar-csv-y-tsv) | Importar CSV y TSV | automática | `js/parse.js` | lee CSV con cabecera y etiquetas<br>acepta cabeceras en español<br>respeta el separador dentro de comillas<br>las comillas dobles escapadas se conservan<br>lee TSV<br>una cabecera sola no se convierte en tarjeta ni desaparece la única fila |
| [RF-203](02-requisitos.md#rf-203--importar-json) | Importar JSON | automática | `js/parse.js` | lee JSON con claves en inglés o en español<br>lee JSON como lista de listas y con nombre de mazo<br>convierte \\n en saltos de línea reales |
| [RF-204](02-requisitos.md#rf-204--importar-desde-fichero) | Importar desde fichero | navegador | `js/app.js` | importar desde un fichero añade las tarjetas |
| [RF-205](02-requisitos.md#rf-205--no-duplicar-tarjetas) | No duplicar tarjetas | automática | `js/store.js` | no se importan preguntas que ya existen en el mazo<br>la misma pregunta puede existir en dos mazos distintos |
| [RF-206](02-requisitos.md#rf-206--elegir-el-mazo-destino-al-importar) | Elegir el mazo destino al importar | automática | `js/app.js`<br>`js/store.js` | el mazo seleccionado manda sobre el nombre del fichero<br>sin mazo seleccionado se usa el que nombre el fichero, creándolo<br>sin mazo seleccionado ni nombre se usa el primero |
| [RF-207](02-requisitos.md#rf-207--errores-de-importación-accionables) | Errores de importación accionables | automática | `js/parse.js` | avisa con el número de línea cuando falta la respuesta<br>avisa cuando no hay separador reconocible<br>avisa cuando el JSON está mal formado<br>avisa cuando el JSON no contiene tarjetas<br>avisa cuando no hay nada que importar<br>un error no devuelve tarjetas a medias |
| [RF-208](02-requisitos.md#rf-208--exportar-copia-de-seguridad) | Exportar copia de seguridad | automática | `js/store.js` | la copia de seguridad reproduce el estado exacto<br>el fichero se llama con la fecha del día |
| [RF-209](02-requisitos.md#rf-209--restaurar-copia-de-seguridad) | Restaurar copia de seguridad | automática | `js/app.js`<br>`js/store.js` | reconoce una copia de seguridad completa<br>restaurar sustituye todo el contenido anterior<br>una copia incompleta se completa en lugar de rechazarse<br>un fichero sin tarjetas se rechaza con un error claro |
| [RF-210](02-requisitos.md#rf-210--ignorar-líneas-vacías-y-comentarios) | Ignorar líneas vacías y comentarios | automática | `js/parse.js` | ignora líneas vacías y comentarios |
| [RF-301](02-requisitos.md#rf-301--la-respuesta-está-oculta-hasta-que-se-pide) | La respuesta está oculta hasta que se pide | navegador | `js/app.js` | la respuesta y los botones no se ven hasta voltear |
| [RF-302](02-requisitos.md#rf-302--voltear-la-tarjeta) | Voltear la tarjeta | navegador | `js/app.js` | tocar la tarjeta muestra la respuesta |
| [RF-303](02-requisitos.md#rf-303--cuatro-niveles-de-respuesta) | Cuatro niveles de respuesta | navegador | `js/app.js` | hay cuatro botones, en orden |
| [RF-304](02-requisitos.md#rf-304--ver-el-plazo-antes-de-responder) | Ver el plazo antes de responder | navegador | `js/app.js` | formatDelay usa unidades legibles<br>cada botón enseña su plazo, en orden creciente |
| [RF-305](02-requisitos.md#rf-305--responder-y-pasar-a-la-siguiente) | Responder y pasar a la siguiente | navegador | `js/app.js` | responder pasa a otra tarjeta, otra vez oculta |
| [RF-306](02-requisitos.md#rf-306--explicar-por-qué-no-hay-nada-que-estudiar) | Explicar por qué no hay nada que estudiar | automática | `js/srs.js` | un mazo vacío lo dice<br>con el límite de nuevas alcanzado se dice cuántas quedan<br>nunca se habla de un límite de repasos<br>al día se dice cuándo vuelve la siguiente tarjeta |
| [RF-307](02-requisitos.md#rf-307--editar-o-borrar-la-tarjeta-que-estoy-viendo) | Editar o borrar la tarjeta que estoy viendo | navegador | — | se puede editar la tarjeta que se está viendo |
| [RF-308](02-requisitos.md#rf-308--atajos-de-teclado) | Atajos de teclado | navegador | — | espacio voltea y las teclas 1-4 responden<br>los atajos no actúan mientras se escribe |
| [RF-401](02-requisitos.md#rf-401--orden-de-la-cola) | Orden de la cola | automática | `js/srs.js` | la cola pone primero los repasos vencidos y deja las nuevas al final<br>dentro de cada grupo va antes lo más atrasado<br>los repasos vencidos se ofrecen todos, sin tope diario<br>los contadores separan nuevas, aprendiendo y repaso |
| [RF-402](02-requisitos.md#rf-402--límite-diario-de-tarjetas-nuevas) | Límite diario de tarjetas nuevas | automática | `js/srs.js` | la cola respeta el límite diario de tarjetas nuevas |
| [RF-404](02-requisitos.md#rf-404--el-aprendizaje-empezado-no-se-corta) | El aprendizaje empezado no se corta | automática | `js/srs.js` | el aprendizaje ya empezado no se corta por los límites |
| [RF-405](02-requisitos.md#rf-405--el-día-de-estudio-empieza-a-las-400) | El día de estudio empieza a las 4:00 | automática | `js/srs.js`<br>`js/store.js` | el día de estudio empieza a las 4 de la mañana<br>los contadores del día se reinician al pasar de las 4:00 |
| [RF-406](02-requisitos.md#rf-406--no-cortar-la-sesión-por-unos-minutos) | No cortar la sesión por unos minutos | automática | `js/srs.js` | con nada vencido se adelanta el aprendizaje cercano<br>el adelanto no saca repasos antes de su día<br>sin ventana de adelanto la cola solo trae lo vencido |
| [RF-407](02-requisitos.md#rf-407--la-pantalla-se-pone-al-día-sola) | La pantalla se pone al día sola | navegador | `js/app.js`<br>`js/srs.js` | nextAvailableAt descuenta la ventana de adelanto<br>la pantalla vacía se actualiza sola al vencer la tarjeta |
| [RF-501](02-requisitos.md#rf-501--cambiar-el-límite-diario-de-tarjetas-nuevas) | Cambiar el límite diario de tarjetas nuevas | automática | `js/app.js`<br>`js/store.js` | el límite por defecto es de 20 nuevas al día<br>el límite se cambia y persiste, y no hay tope de repasos<br>una copia antigua pierde el tope de repasos al cargarse |
| [RF-502](02-requisitos.md#rf-502--ver-el-progreso) | Ver el progreso | automática | `js/app.js`<br>`js/store.js` | las estadísticas cuentan aciertos y respuestas<br>sin respuestas esta semana no se inventa un 0 % |
| [RF-503](02-requisitos.md#rf-503--borrar-todo) | Borrar todo | automática | `js/app.js`<br>`js/store.js` | borrar todo deja un mazo vacío y los ajustes por defecto |

## Requisitos no funcionales

| Id | Requisito | Verificación | Código | Pruebas |
| --- | --- | --- | --- | --- |
| [RNF-101](02-requisitos.md#rnf-101--sin-dependencias-en-tiempo-de-ejecución) | Sin dependencias en tiempo de ejecución | automática | — | no hay dependencias de ejecución<br>no se carga nada de dominios externos |
| [RNF-102](02-requisitos.md#rnf-102--funciona-sin-conexión) | Funciona sin conexión | automática | — | el service worker cachea todo lo que carga la página<br>el service worker se limpia al cambiar de versión |
| [RNF-103](02-requisitos.md#rnf-103--instalable-como-app-en-el-móvil) | Instalable como app en el móvil | automática | — | el manifiesto es válido e instalable<br>iOS encuentra su icono y su nombre |
| [RNF-104](02-requisitos.md#rnf-104--los-datos-no-salen-del-dispositivo) | Los datos no salen del dispositivo | automática | — | el código no habla con la red salvo el service worker<br>no hay analítica ni identificadores de usuario |
| [RNF-105](02-requisitos.md#rnf-105--usable-con-una-mano-en-un-móvil) | Usable con una mano en un móvil | navegador | — | la interfaz declara zonas seguras y objetivos táctiles grandes<br>a 390 px no hay desplazamiento horizontal<br>los botones se pueden pulsar con el pulgar |
| [RNF-106](02-requisitos.md#rnf-106--tema-claro-y-oscuro) | Tema claro y oscuro | navegador | — | hay paleta para tema claro y oscuro<br>el tema oscuro cambia el fondo de verdad |
| [RNF-107](02-requisitos.md#rnf-107--degradar-bien-si-el-almacenamiento-falla) | Degradar bien si el almacenamiento falla | automática | `js/store.js` | unos datos corruptos no impiden arrancar<br>si el almacenamiento falla se avisa y la app sigue |
| [RNF-108](02-requisitos.md#rnf-108--el-motor-no-depende-del-navegador) | El motor no depende del navegador | automática | — | el motor no toca ninguna API del navegador<br>el motor se puede importar sin navegador |

## Invariantes del motor

| Id | Requisito | Verificación | Código | Pruebas |
| --- | --- | --- | --- | --- |
| [INV-101](03-motor.md#inv-101--el-motor-no-muta-lo-que-recibe) | El motor no muta lo que recibe | automática | `js/srs.js` | review no modifica la tarjeta que recibe |
| [INV-102](03-motor.md#inv-102--los-cuatro-plazos-están-ordenados) | Los cuatro plazos están ordenados | automática | `js/srs.js` | una tarjeta nueva empieza en el primer paso de aprendizaje<br>"Fallo" en aprendizaje vuelve al primer paso<br>"Difícil" en aprendizaje repite el paso y espera más que "Fallo"<br>"Bien" en el último paso gradúa a repaso con 1 día<br>"Fácil" salta el aprendizaje y gradúa con 4 días<br>los cuatro plazos están siempre ordenados y son distintos |
| [INV-103](03-motor.md#inv-103--la-facilidad-tiene-suelo) | La facilidad tiene suelo | automática | `js/srs.js` | la facilidad nunca baja del mínimo |
| [INV-104](03-motor.md#inv-104--acertar-siempre-aleja-la-tarjeta) | Acertar siempre aleja la tarjeta | automática | `js/srs.js` | "Bien" en repaso multiplica el intervalo por la facilidad<br>"Difícil" alarga poco y baja la facilidad<br>"Fácil" alarga más y sube la facilidad<br>acertar siempre alarga al menos un día, incluso con facilidad mínima |
| [INV-105](03-motor.md#inv-105--hay-un-techo) | Hay un techo | automática | `js/srs.js` | el intervalo tiene un techo de cinco años |
| [INV-106](03-motor.md#inv-106--fallar-penaliza-de-forma-acotada) | Fallar penaliza de forma acotada | automática | `js/srs.js` | "Fallo" en repaso manda a reaprendizaje y parte el intervalo |
| [INV-107](03-motor.md#inv-107--recuperarse-devuelve-el-intervalo-recortado) | Recuperarse devuelve el intervalo recortado | automática | `js/srs.js` | al superar el reaprendizaje se recupera el intervalo reducido |
| [INV-108](03-motor.md#inv-108--la-dispersión-no-cambia-el-orden-de-magnitud) | La dispersión no cambia el orden de magnitud | automática | `js/srs.js` | la dispersión solo toca intervalos de 3 días o más y se queda en ±5 % |
| [INV-109](03-motor.md#inv-109--fallar-repetidamente-mantiene-la-tarjeta-cerca) | Fallar repetidamente mantiene la tarjeta cerca | automática | `js/srs.js` | fallar una y otra vez mantiene la tarjeta a pocos días |
| [INV-110](03-motor.md#inv-110--acertar-repetidamente-aleja-rápido) | Acertar repetidamente aleja rápido | automática | `js/srs.js` | acertar seis veces seguidas pasa del mes |

## Requisitos retirados

Su número no se reutiliza nunca, para que ningún enlace viejo acabe
apuntando a otra cosa.

- **RF-403** — Límite diario de repasos ~~(retirado)~~

## Comprobaciones manuales de cada versión

Lo que ninguna prueba puede firmar por sí sola. El procedimiento está en
la ficha de cada requisito.

- **RNF-102** — Funciona sin conexión (complementa a sus pruebas)
- **RNF-103** — Instalable como app en el móvil (complementa a sus pruebas)
