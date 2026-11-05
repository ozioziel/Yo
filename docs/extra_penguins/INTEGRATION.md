# Pingüinos extra: invocación por nombre

Tras la intro aparece arriba un campo de texto discreto, sin texto de ayuda ni botón: no dice para qué sirve. Al escribir un nombre registrado y pulsar Enter (o «Ir» en el teclado del móvil), ese pingüino cae desde arriba dentro del mundo Phaser. Aterriza con el impacto y la recuperación de siempre y, desde ese momento, es un pingüino más: el mismo `Brain`, las mismas colisiones, reacciones, arrastre con el puntero, clima, día/noche y estaciones, con su propia ropa en todos los estados. Al escribir **oziel**, todos los pingüinos se paran a mirar arriba durante unos 3 s mientras salen destellos por la escena y la O de hOme se ilumina.

## Registro y nombres

Registro único: [`src/game/extraPenguins.json`](../../src/game/extraPenguins.json), tipado y resuelto en [`src/game/characters.ts`](../../src/game/characters.ts). El mismo archivo alimenta el pipeline de recursos (`tools/extras/`). Los fotogramas generados nunca se descubren como personajes y el texto escrito solo se compara contra este registro; nunca se usa para construir una ruta.

| Id | Nombre visible | Se acepta | Referencia intacta | Variante de animación | Apariencia |
|---|---|---|---|---|---|
| aylen | Aylen | aylen | `assets_overrides/ExtraPenguins/Aylen.png` | `extra_aylen__penguin` | `puppets.cjs#aylen` |
| boris | Boris | boris | `assets_overrides/ExtraPenguins/boris.png` | `extra_boris__penguin` | `puppets.cjs#boris` |
| chalquits | Chalquits | chalquits | `assets_overrides/ExtraPenguins/Chalquits.png` | `extra_chalquits__penguin` | `puppets.cjs#chalquits` |
| chiquito | Chiquito | chiquito | `assets_overrides/ExtraPenguins/Chiquito.png` | `extra_chiquito__penguin` | `puppets.cjs#chiquito` |
| oror | oror | oror | `assets_overrides/ExtraPenguins/oror.png` | `extra_oror__penguin` | `puppets.cjs#oror` |
| shadow-frederick | Shadow Frederick | shadow frederick, shadow-frederick | `assets_overrides/ExtraPenguins/Shadow Frederick.png` | `extra_shadow-frederick__penguin` | `puppets.cjs#shadow-frederick` |
| tats | Tats | tats | `assets_overrides/ExtraPenguins/Tats.png` | `extra_tats__penguin` | `puppets.cjs#tats` |
| zorro-negro | zorro negro | zorro negro, zorro-negro | `assets_overrides/ExtraPenguins/zorro negro.png` | `extra_zorro-negro__penguin` | `puppets.cjs#zorro-negro` |

Normalización (`normalizePenguinName`): NFKC, sin espacios al principio ni al final, minúsculas, y los espacios repetidos o guiones cuentan como un solo espacio. `Tats`, `tats`, `TATS`, `  Shadow   FREDERICK ` y `Zorro-Negro` funcionan. No hay apodos inventados, y al cargar el módulo se rechaza cualquier alias ambiguo entre dos personajes.

El campo no muestra mensajes: un texto vacío, desconocido o ya presente no hace nada (no hay pingüino genérico de sustitución). Si el pingüino llega, o ya está en escena, el campo se vacía. Mientras carga, el campo se atenúa.

Decisiones del usuario: los extras llevan siempre su ropa (sin bufanda, botas ni casco de ingeniero), hay uno por nombre (como máximo los 8) y no se recuerdan al recargar la página.

## Cuándo aparece el campo

`World.ready` (señal `sceneReady` del puente) se activa cuando `phase === 'home'` **y** `NameSign.cleared`, es decir, cuando ha terminado la retirada de cuerdas y anclas (`finish()`: 900 ms de espera + 1100 ms de tween). La fase `home` se emite 1700 ms después de formarse el título, así que por sí sola llegaba antes de que la escena quedara limpia. Sirve igual para la intro normal y para cortar la cuerda (saltarla). Al desmontar la escena se emite `sceneReady: false`, `bridge.reset()` borra el último valor y `bridge.summon` vuelve a «no listo». Al volver de `/portafolio`, la intro empieza desde cero y el campo vuelve a ocultarse.

Ubicación: a partir de 1040 px, centrado en la barra como el título; por debajo, pequeño (180 px) bajo los controles, a la derecha. Es semitransparente y solo se marca al enfocarlo. Usa 16 px (iOS no amplía al enfocar) y `user-select: text` dentro del `.home`, que no permite seleccionar texto. Lleva `data-ui`, de modo que el puntero de la escena lo ignora. Phaser no tiene teclado, así que escribir no activa nada del mundo. En pantallas táctiles el campo pierde el foco tras invocar, para cerrar el teclado y que se vea la caída.

Un envío es una sola aparición: Enter dispara el `submit` del formulario, un `ref` bloquea los envíos mientras hay uno en curso, y `World.summon` reserva el id antes de cargar, de modo que dos peticiones simultáneas dan «falling» y «present».

## Carga, creación y caída

1. `World.summon(id)` reserva el id y carga con el cargador del proyecto (`loadAtlases`) solo los atlas de su variante: `base`, `tasks`, `daily`, `weather` y la estación activa (`extraAtlases`). Si la estación cambia mientras carga, también carga la nueva. El grupo `intro` no se pide nunca.
2. Comprueba que todos los clips de esos atlas están registrados: nunca se crea un pingüino a medio vestir.
3. `World.create`, la misma fábrica que usa `spawn()` para los 15 originales, crea la entidad con tamaño aleatorio 0,5–0,6 (×1,18 en vertical), un carril y el tinte actual. Sus dibujos están escalados para que el cuerpo de pingüino (sin el pelo) mida lo mismo que un pingüino base (`bodyScale` 1.3 en el registro). Por eso usan celdas lógicas de 320 con los pies a 0,9 de la altura, como las de 256, y el juego los coloca igual. Con `bodyScale` crecen también el área para agarrarlos, la sombra y la altura de globos y estrellas. `texScale` es la escala real del atlas: 0,75 en escritorio (celdas de 240 px) y 0,375 en móvil (`atlases/sd/`, la mitad exacta).
4. `dropIn` la coloca con los pies justo por encima del borde superior visible, en una x libre, con una orientación aleatoria, y llama a `launch()`: caída aleatoria (`fall_normal`, `fall_spin` o `fall_flap`), gravedad de 2600 u/s², rebotes laterales y colisiones con los pingüinos sobre los que cae. El techo de la física solo frena cuerpos que suben, así que entrar desde arriba no se teletransporta.
5. `land()` → `impact_*` (estrellas si es fuerte) → `get_up` → `afterRecovery()` → `Brain`.

## Mismo sistema, apariencia propia

- `Penguin.identity` marca a un extra. `targetVariant()` devuelve su propia variante, `weatherRoutine` le aplica la rama de «no cambia de ropa» (notice → confused → shiver/protector → resume) y `updateHelmet` no lo elige para el casco.
- Sin espejo: cada clip tiene `clip` y `clip__right`, que apunta a los mismos fotogramas (`flipSafe=false`). Estos personajes miran al espectador como en sus referencias, así que al ir a la derecha no se refleja la textura: el texto SIS, la L, el tatuaje, el vaso o el portátil siguen en su lado. `Penguin.play()`/`face()` eligen esa versión cuando existe y, al girar a mitad de clip, conservan el fotograma. Las rutinas que esperan un clip lo reconocen en cualquiera de sus dos nombres. Las anclas (`hn`, `hf`, `hm`) se leen del dibujo activo. Los usos de `sprite.flipX` como «mira a la derecha» (globo, accesorios, aliento, escalera) pasan a `facing`, equivalente para los originales.
- Carga y descarga por estación: `atlasesForSeason(data, season, extras)` incluye a los extras presentes o en carga. Al cambiar de estación se carga su grupo nuevo y se libera el anterior. Las texturas en uso se toman de `sprite.texture.key`.
- Limpieza: los extras están en `world.penguins`, así que `World.destroy()` los destruye junto con sus sprites, sombras, globos y listeners; `WorldScene.teardown` restablece el puente.

## Verificación

Ejecutado el 2 de noviembre de 2026:

| Comprobación | Comando | Resultado |
|---|---|---|
| Recursos frente al contrato (72 acciones × 8, anclas, recortes, transparencia, sin animaciones estáticas, referencias intactas) | `node tools/extras/validate.cjs` | Correcto: 576 clips, 4104 fotogramas y 72 atlas ([COVERAGE.md](COVERAGE.md)) |
| Copia publicada (HD 0,75 y móvil 0,375, mitades exactas) | `node tools/extras/validate.cjs --runtime-only` | Correcto |
| Tipos y compilación de producción | `npm run build` | Correcto |
| Extremo a extremo en Chrome headless | `npm run test:extras` (con `npm run dev`) | Correcto ([evidence/integration-report.json](evidence/integration-report.json)) |

La prueba de extremo a extremo cubre:

- El campo está oculto durante la intro y aparece cuando la escena queda limpia.
- Nombre vacío y nombre desconocido: avisan y no crean ningún pingüino.
- Los ocho nombres, escritos con mayúsculas, espacios y guiones distintos, caen, aterrizan (`impact_*`), se levantan (`get_up`) y vuelven a `normal`.
- Ninguno atraviesa el suelo, se refleja ni usa otra textura.
- Un nombre repetido se rechaza y un doble envío (dos `submit` y un clic) produce una sola aparición.
- Después conviven con los originales y recorren `walk`, `chase`, `bump`, `push`, `greet`, `laugh`, `sleep`, `sit_grass`, `celebrate`, `hold_ladder`, `carry_ladder`, `climb`, `wipe`, `fall_flap`… mirando a ambos lados sin reflejarse.
- La consola no registra errores, avisos ni respuestas fallidas.

En el navegador integrado se comprobó además:

- Saltar la intro cortando la cuerda.
- Ir a `/portafolio` y volver: el mundo anterior se destruye y la intro vuelve a empezar sin campo.
- Invierno y noche con extras presentes: reaccionan al clima sin cambiar de ropa, se carga su grupo de invierno, se libera el de primavera y se tiñen de noche.
- Agarrarlos y lanzarlos con el puntero.
- Móvil a 375×812: campo en segunda fila, teclado cerrado tras invocar y solo atlas `sd/` a escala 0,375.
