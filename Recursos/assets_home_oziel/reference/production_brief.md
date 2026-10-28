# PROMPT MAESTRO PARA CODEX — PRODUCCIÓN DE TODOS LOS ASSETS DEL HOME DE OZIEL

> **Instrucción para Codex:** ejecuta este encargo de principio a fin dentro de tu carpeta de trabajo actual. El usuario te entregará, junto con este prompt, **una imagen de referencia del pingüino**. Tienes autorización para crear los archivos y subcarpetas necesarios dentro de esa carpeta. Tu trabajo principal es **producir imágenes y animaciones reales, utilizables y verificadas**, no construir todavía el sitio web. Al terminar, entrega un `documento.md` exhaustivo que permita a Claude implementar las animaciones, además de manifiestos JSON y una lista franca de lo completado y lo pendiente.

## 0. Objetivo y criterio de éxito

Preparar **todos los recursos visuales 2D** necesarios para la introducción interactiva y la pantalla `hOme` del portafolio personal de **Oziel Rodman Ramos Torrez**. Es un pequeño mundo animado habitado por pingüinos; no es pixel art. Claude recibirá después **la carpeta completa** de recursos, y debe poder integrar las imágenes en **React + Phaser**, animar personajes, construir escenarios y resolver interacciones sin redibujar nada esencial.

El resultado debe incluir, cuando corresponda:

1. Diseño maestro consistente del pingüino y sus vistas/poses de referencia.
2. **Fotogramas PNG RGBA transparentes auténticos** para cada animación requerida.
3. **Spritesheets PNG** (secuencias de fotogramas) organizados por personaje/función, además de sus **atlases JSON compatibles con Phaser**.
4. Variantes del pingüino ingeniero con **solo casco** y de pingüinos normales, con accesorios estacionales en estos últimos.
5. Objetos, fondos, capas, partículas, elementos de interfaz y efectos visuales para las cuatro estaciones, día/noche e introducción.
6. Previsualizaciones de las animaciones (GIF/APNG o tira de fotogramas y hojas de contacto), útiles para control de calidad, pero no necesarias en producción.
7. Un `asset_manifest.json` legible por máquinas, un `animations.json` de configuración y un **`documento.md` en español** explicando cada ruta, dimensiones, formato, fotogramas, velocidades, continuidad, estados, transiciones y ejemplos de carga/reproducción para Claude.
8. Un informe final de faltantes, problemas técnicos, decisiones tomadas y **assets adicionales creados por iniciativa propia**.

**No basta con escribir scripts, prompts o listas de imágenes:** los PNG/spritesheets finales deben existir realmente. No sustituyas una animación con fotogramas repetidos para simular que la creaste. No llames “terminado” a lo que solo está especificado. Si una herramienta falla o un recurso no alcanza calidad aceptable, inténtalo por otra vía segura y documenta lo que no se consiguió.

**Prioridades si el tiempo o las herramientas son limitados:** (P0) pingüino maestro + física de arrastrar/caer/levantarse + intro, (P1) cambios de clima y elementos principales de estaciones, (P2) actividades normales y estacionales, (P3) detalles secundarios. Continúa todo lo que puedas de manera autónoma y reporta exactamente la cobertura.

## 1. Contexto completo del proyecto

### 1.1. Historia de la introducción

- Un pingüino **ingeniero** entra caminando. **Su único accesorio es un casco de construcción**, sin ropa ni herramientas fijas.
- Sobre él cuelga, sostenido por cuerdas, el nombre **«Oziel Rodman Ramos Torrez»**. El pingüino se detiene y mira hacia arriba.
- Acciona un interruptor: se apaga la luz y desaparece dentro de la oscuridad. Al volver a encenderse, aparece nuevamente.
- Llegan progresivamente más pingüinos, curiosos por lo que ven. Observan al ingeniero y luego miran hacia el nombre.
- Se reúnen debajo; uno trae una escalera, otros colaboran para colocarla, armarla/sostenerla y subir.
- Al alcanzar la cuerda, uno de ellos la corta. **Todo el nombre cae**, las letras rebotan y se reorganizan para revelar el Home. La letra **O** del nombre se integra visualmente en el título estilizado **`hOme`**.
- **No existe un botón de «Saltar intro».** Desde el **primer segundo**, el visitante puede apuntar a **cualquier cuerda interactiva**: el cursor se convierte en tijeras y, al hacer clic, **cortar una sola cuerda desprende todo el nombre** y provoca la transición inmediata al Home. Si no lo hace, los pingüinos completan la historia.
- Para móvil/táctil, prepara un indicador de tijeras junto a la cuerda seleccionada, porque allí no hay cursor; la interacción equivalente será tocarla.
- La animación de apagón es independiente del modo permanente día/noche.
- Al terminar la introducción, **todos los pingüinos permanecen en el Home** e interactúan con el mundo.

**Importante para los recursos tipográficos:** entregar cuerda(s), puntos de anclaje, efecto de corte, tijeras de cursor, sombras y, si se requiere, piezas/efectos de letras. No hornear todo el nombre en un solo bitmap inseparable: Claude debe poder soltar cada letra y moverla con física, formar `hOme`, y mantener editable el texto. Puedes proponer una tipografía coherente e incluir una referencia gráfica; las letras reales pueden quedar como texto/vector generado en ejecución.

### 1.2. Interacción con los pingüinos

- Todos los pingüinos pueden ser agarrados y arrastrados **durante la intro y en el Home**. El visitante puede levantarlos a cualquier altura de la escena, como si los hiciera volar mientras los sostiene.
- Al agarrarlos, **miran directamente hacia la pantalla**, sus ojos **se agrandan mucho** y su expresión se vuelve **ligeramente asustada** (sin necesidad de agitar aletas mientras están sujetos).
- Al soltarlos por encima del suelo, caen con gravedad. Una de tres animaciones se selecciona **aleatoriamente en cada caída**: `fall_normal`, `fall_spin` o `fall_flap` (esta última agita las aletas).
- El golpe al aterrizar depende de la **altura/energía**: caída baja, media o alta. Cuanto más intensa, más caricaturesco el impacto y la recuperación. Sin heridas ni daño persistente.
- Después se levantan y **retoman la actividad que realizaban antes** (mirar hacia arriba, caminar, construir la escalera, jugar, etc.).
- Pueden chocar entre sí. A veces solo se empujan; otras veces uno derriba a otro y puede haber **reacciones en cadena**. Las respuestas tienen variabilidad, no todas las colisiones derriban a todos.
- Fuera de las acciones narrativas, eligen aleatoriamente entre caminar, explorar, mirar, sentarse, dormir, despertar, jugar, perseguirse, saludarse, interactuar con objetos, chocarse, tropezar y recuperarse.

### 1.3. Clima, estaciones y día/noche

El control de clima está **solo en el Home**, no en la introducción. Niveles exactos:

| Nivel | Estación | Ambiente y partículas | Respuesta de pingüinos normales |
|---|---|---|---|
| `0` | Invierno | Nieve, suelo nevado, hielo/congelamiento visual sobre las letras, colores fríos | Miran arriba confundidos; se ponen **bufanda**; bolas de nieve, muñeco de nieve, deslizamiento en hielo |
| `1` | Otoño | Hojas que caen, ocres y marrones, **lluvia constante** y charcos | Miran arriba confundidos; se ponen **botas y paraguas**; saltan charcos, juegan con hojas, se refugian |
| `2` | Primavera | Vegetación, flores, pétalos, tonos verdes y rosados | Miran arriba confundidos; **sin outfit especial**; persiguen mariposas, observan flores, descansan entre plantas |
| `3` | Verano | Playa, arena, mar/olas, iluminación cálida | Miran arriba confundidos; se **aplican protector solar**; castillos de arena, juego de playa y agua |

Cada cambio de temperatura provoca: **pausa breve de actividades → mirar hacia arriba → expresión de confusión → reacción/preparación de estación → retomar actividades**, sin reiniciar la escena ni reemplazar a los personajes. En otoño siempre se ve lluvia (pueden variar detalles y salpicaduras, pero no dejar de llover).

El ingeniero **conserva únicamente su casco en las cuatro estaciones**: nada de bufanda, botas, paraguas, sombreros o gafas. Puede reaccionar a la temperatura y realizar actividades apropiadas, sin cambiar de vestimenta. Los pingüinos comunes sí utilizan los accesorios indicados.

Existe además un interruptor sol/luna para **día y noche**, independiente de las cuatro estaciones: **ocho combinaciones**. Deben existir propuestas visuales coherentes para invierno/otoño/primavera/verano, cada una de día y de noche. En la noche los personajes y elementos interactivos permanecen legibles.

## 2. Referencia visual: fidelidad obligatoria

El usuario facilitará una imagen del pingüino. **Inspecciónala antes de dibujar cualquier cosa**. Esa imagen es la autoridad principal para las formas, proporciones, colores y acabado. No sustituyas el estilo por otro pingüino genérico de IA.

Rasgos observados que debes conservar (salvo que la propia referencia entregada difiera):

- Ilustración **2D cartoon de líneas suaves**, NO pixel art, NO 3D, NO fotorrealismo.
- Silueta redondeada, ligeramente de pera, cuerpo **gris carbón / casi negro**, vientre/frente grande **gris muy claro o blanco**.
- **Contornos negros gruesos, continuos y bien suavizados**, con curvas limpias.
- **Pico y patas ocre/marrón cálido**, pequeñas aletas oscuras; sombreado muy sencillo y controlado, de aspecto vectorial plano.
- Cabeza conectada al cuerpo, con **pequeños mechones/puntas en la parte superior**, como la referencia.
- Ojo normal muy sencillo, oscuro y pequeño; cuando el visitante lo agarra cambia a ojos **notablemente grandes y expresivos** sin deformar permanentemente su identidad.
- Volumen simple con algún matiz suave, sin texturas ruidosas, bordes dentados ni degradados excesivos.
- La referencia puede mostrar un objeto en una aleta o pequeños signos gráficos alrededor: **no los interpretes como parte anatómica ni accesorio obligatorio**. El personaje base debe estar **sin objetos en las manos**.

Antes de las animaciones crea una hoja maestra `character_model_sheet.png` con vistas **perfil izquierdo, perfil derecho (puede derivar por flip), frente, tres cuartos y espalda**, más tres expresiones: normal, mirando arriba, asustado de ojos grandes. Respeta la misma cabeza, pico, vientre, patas, mechones y grosor de trazo. Crea también `engineer_model_sheet.png` con el mismo pingüino y **un casco de construcción claramente colocado sobre la cabeza**.

**No generes una mascota distinta en cada frame**. La consistencia entre imágenes tiene prioridad sobre añadir detalles ornamentales. Prefiere construir/reutilizar piezas o rigs vectoriales coherentes si el generador de imágenes no puede mantenerlas. Puedes usar imagegen para concept art, SVG para poses y renders, edición de imágenes o composición programática, según las herramientas disponibles, siempre que el resultado visual sea fiel a la referencia.

## 3. Normas de producción y exportación

### 3.1. Dimensiones y formato

- Fotogramas de personajes: **PNG RGBA, fondo totalmente transparente, 256 × 256 px** como formato de producción. Opcionalmente conservar másteres `512 × 512 px` o SVG editables de alta resolución.
- Personaje centrado y sin recortes. Mantener un **pivote consistente** por animación (recomendado `originX = 0.5`, `originY ≈ 0.90` para poses apoyadas en suelo). Ajustar pivotes de poses aéreas según corresponda y declararlos explícitamente.
- Todos los fotogramas de una misma animación deben compartir canvas; evitar que el cuerpo “salte” involuntariamente de posición. Solo animar traslaciones cuando la acción lo requiera.
- Entregar **PNG strip horizontal por animación** en `clips/` (`ancho = número de frames × 256`, alto `256`), además de PNG individuales en `frames/` si no es demasiado costoso.
- Construir **atlases con celdas de 256 × 256 y máximo ocho columnas**, con la cantidad de filas necesaria. No es necesario poner todas las animaciones en un único atlas gigante: dividir por `base`, `intro`, `daily`, `winter`, `autumn`, `spring`, `summer`, y variantes del ingeniero cuando sean necesarias.
- El atlas debe tener **JSON en formato Phaser TexturePacker JSON Hash** con `frames`, rectángulos `x/y/w/h`, `rotated:false`, `trimmed:false`, `spriteSourceSize`, `sourceSize`, `pivot`, `meta.image` y `meta.size`. Usar claves semánticas como `walk_000`, `walk_001` o `fall_spin_000`.
- Entregar también `animations.json` con nombre de animación, atlas, lista exacta de frames en orden, FPS, `repeat`, origen, si es interrumpible, estado siguiente y notas de sincronización. No inventar una capacidad de Phaser: verificar que el JSON realmente cargue.
- Para props: PNG RGBA con límites transparentes precisos y dimensiones declaradas por archivo. Para fondos/capas: PNG sin textos integrados; ofrecer bases 1920 × 1080 cuando sea adecuado, además de capas reutilizables/tileables o composición apta para pantallas estrechas. No forzar el sitio a un único tamaño de pantalla.
- Mantener sombras de suelo, halos, partículas y accesorios **separados** cuando ello facilite la composición o las colisiones.

### 3.2. Continuidad, velocidad y ciclos

- `idle`, `walk`, `run`, `look_around`, respiración, lluvia, nieve, olas y similares deben ciclar suavemente, sin salto visible entre último y primer frame.
- Acciones como `look_up`, `scared`, `fall`, `impact`, `get_up`, `put_scarf`, `open_umbrella`, `cut_rope`, `apply_sunscreen` son transiciones o clips de una sola vez; documentar **qué estado viene después**.
- Para estados de arrastre, proporcionar imagen/clip **sostenible mientras se mantiene el botón** (`dragged`) y una transición hacia cualquiera de las tres caídas al soltar.
- La física de movimiento/caída y los choques los decidirá Phaser; no pintar el desplazamiento completo de la pantalla dentro de cada frame. Animar **pose, expresión y rotación**, no toda la trayectoria mundial.
- Caídas aleatorias: tres clips claramente diferentes. Impacto según severidad: al menos `light`, `medium` y `heavy`; una recuperación válida después de cada uno.
- Definir secuencias de equipamiento/remoción estacional o variantes visuales suficientes para pasar de una estación a otra sin accesorios fantasma. El ingeniero jamás recibe esos accesorios.
- Los pingüinos comunes pueden reflejarse horizontalmente para caminar hacia izquierda/derecha cuando sea visualmente válido; documentar excepciones (pico, paraguas, casco, interacción con escalera).

### 3.3. Convenciones

- Nombres de archivo en `snake_case`, ASCII, sin espacios; índices de fotograma desde cero con tres dígitos (`_000`).
- Manifestar todos los tamaños en píxeles, pivotes y escalas recomendadas; no ocultar valores esenciales en comentarios.
- Si decides variar counts/FPS para conseguir una mejor animación, hazlo de forma explícita en manifiestos y `documento.md`, nunca en silencio.
- No crear PNG opacos con falso patrón cuadriculado de transparencia, marcas de agua, textos promocionales ni logos.

## 4. Inventario obligatorio de animaciones del personaje

Los números de frames son **objetivos mínimos orientativos**. Lo crucial es que la acción sea reconocible y la animación esté bien construida. Es válido incluir fotogramas intermedios extra para mejorar fluidez. Para cada entrada proporciona PNG/spritesheet y metadata de duración, loop, pivote, interrupciones y condiciones.

### 4.1. P0 — `penguin_base` / acciones fundamentales

| Clip | Frames objetivo | Uso y poses exigidas |
|---|---:|---|
| `idle` | 6 | Respira y parpadea suavemente, bucle estable |
| `blink` | 4 | Parpadeo breve combinable con otras poses |
| `walk` | 8 | Caminar natural, patas alternadas y ligero balanceo |
| `run` | 8 | Carrera más rápida para persecuciones |
| `look_up` | 6 | Eleva cabeza progresivamente hasta mirar las letras o el cielo |
| `look_around` | 8 | Mira a ambos lados con curiosidad |
| `curious` | 6 | Se acerca o inclina la cabeza intrigado |
| `confused` | 6 | Inclinación de cabeza y pausa de confusión |
| `scared` | 4 | Mira de frente, ojos grandes, leve miedo al ser agarrado |
| `dragged` | 4 | Pose suspendida que se mantiene mientras se arrastra |
| `fall_normal` | 8 | Caída asustada sin giro especial |
| `fall_spin` | 12 | Rotación perceptible, tumbos, expresión de sorpresa |
| `fall_flap` | 8 | Aletea de forma desesperada mientras desciende |
| `impact_light` | 5 | Aterrizaje/tropiezo leve |
| `impact_medium` | 6 | Choque notable, compresión moderada |
| `impact_heavy` | 8 | Aplastamiento cómico y aturdimiento breve |
| `get_up` | 8 | Se incorpora tras cualquier caída, termina en pose neutra |
| `stumble` | 6 | Pierde el equilibrio después de tropezar |
| `bump` | 6 | Reacción a golpe/empujón de otro pingüino |
| `push` | 6 | Pequeño empujón con aleta/cuerpo |
| `sit_down` | 6 | Pasa de pie a sentado |
| `sit_idle` | 4 | Sentado descansando, bucle |
| `stand_up` | 6 | Se levanta desde sentado |

### 4.2. P0 — `penguin_intro` / historia

Crear versiones con casco para el ingeniero y sin casco para ayudantes según la acción. Puedes reutilizar los clips base si no es necesario duplicarlos, pero documenta qué variante corresponde a cada personaje.

| Clip | Frames objetivo | Uso |
|---|---:|---|
| `enter` | 8 | Entrada inicial (reutiliza caminata si encaja) |
| `switch_light` | 8 | Extiende aleta, pulsa interruptor, se retira |
| `notice_name` | 6 | Descubre el nombre colgante y mira arriba |
| `group_look_up` | 6 | Reacción de los recién llegados hacia el nombre |
| `carry_ladder` | 8 | Camina transportando escalera/segmento |
| `place_ladder` | 8 | Deposita y acomoda escalera |
| `assemble_ladder` | 8 | Alinea/fija segmento si la puesta en escena lo requiere |
| `hold_ladder` | 6 | Sostiene escalera mientras otro sube |
| `climb` | 8 | Sube por peldaños; loop estable y manos/patas alineables |
| `reach_rope` | 6 | Se estira para llegar a la cuerda |
| `cut_rope` | 8 | Corte claro con herramienta temporal de escena |
| `react_name_fall` | 8 | Reacciona al desprendimiento de las letras |
| `celebrate` | 6 | Reacción de logro breve, opcional al acabar |

**El ingeniero no lleva tijeras permanentemente**: la herramienta de cortar es un prop temporal; del mismo modo la rama/objeto de la foto de referencia no define su equipamiento. El visitante tiene su propio cursor de tijeras al pasar sobre la cuerda.

### 4.3. P1 — `penguin_daily` / vida cotidiana en Home

| Clip | Frames objetivo | Uso |
|---|---:|---|
| `sleep` | 8 | Dormita/respira, bucle |
| `wake_up` | 6 | Abre ojos, se incorpora |
| `greet` | 6 | Saluda con aleta |
| `play` | 8 | Juego amistoso con otro pingüino |
| `chase` | 8 | Persigue a otro; puede reutilizar `run` cuando encaje |
| `laugh` | 6 | Se ríe de una situación cómica |
| `interact_object` | 8 | Examina o toca un objeto del escenario |
| `pick_up_object` | 6 | Recoge un objeto pequeño |
| `put_down_object` | 6 | Lo deja en el suelo |

Incluir suficientes expresiones/poses para que la rutina aleatoria no se reduzca a caminar eternamente. La lógica de selección aleatoria es responsabilidad futura de Claude; tú produces todos los clips disponibles.

### 4.4. P1 — transiciones estacionales generales

| Clip | Frames objetivo | Uso |
|---|---:|---|
| `notice_weather` | 6 | Interrumpe actividad, levanta la cabeza |
| `weather_confused` | 6 | Breve desconcierto ante estación nueva |
| `remove_accessories` | 8 | Se quita accesorios de la estación anterior (solo pingüino común) |
| `resume_after_weather` | 4 | Vuelve a atención normal; la actividad previa se reanuda por lógica |

### 4.5. P1 — `penguin_winter` (nivel 0)

| Clip | Frames objetivo | Uso |
|---|---:|---|
| `put_scarf` | 8 | Saca/coloca bufanda en pingüino común |
| `shiver` | 6 | Tirita por el frío |
| `make_snowball` | 8 | Forma bola de nieve |
| `throw_snowball` | 8 | Lanza bola de nieve |
| `ice_slide` | 8 | Se desliza sobre el hielo |
| `build_snowman` | 12 | Construye muñeco, preferiblemente por etapas |

Proporcionar variante visual persistente **con bufanda** para los clips base necesarios (`idle`, `walk`, `look_up`, `scared`, `dragged`, `fall_*`, `impact_*`, `get_up`) o un sistema de capas/rig **realmente probado** que adhiera la bufanda a cabeza/cuello sin flotaciones. Para el ingeniero, reutilizar la variante de casco, **sin bufanda**.

### 4.6. P1 — `penguin_autumn` (nivel 1)

| Clip | Frames objetivo | Uso |
|---|---:|---|
| `put_boots` | 8 | Se pone botas |
| `open_umbrella` | 8 | Despliega paraguas |
| `walk_umbrella` | 8 | Camina sosteniéndolo bajo lluvia |
| `jump_puddle` | 8 | Salta y salpica un charco |
| `play_leaves` | 8 | Juega con un montón de hojas |
| `hide_rain` | 6 | Se refugia bajo paraguas |

Variantes persistentes **botas + paraguas** de pingüinos comunes, al menos para idle/walk/look_up/scared y una solución coherente para arrastrar, caer y levantarse. El paraguas debe poder soltarse/plegarse o moverse con el personaje; documenta el comportamiento, en especial durante caídas. La lluvia **nunca se detiene** mientras está activo otoño.

### 4.7. P2 — `penguin_spring` (nivel 2)

| Clip | Frames objetivo | Uso |
|---|---:|---|
| `chase_butterfly` | 8 | Sigue una mariposa |
| `smell_flower` | 8 | Se acerca y huele/observa flor |
| `sit_grass` | 6 | Descansa en la hierba |
| `watch_bloom` | 6 | Reacciona a floración cercana |

**Sin outfit añadido**. Los clips base funcionan sin accesorios; puede haber props florales alrededor.

### 4.8. P2 — `penguin_summer` (nivel 3)

| Clip | Frames objetivo | Uso |
|---|---:|---|
| `apply_sunscreen` | 8 | Se echa protector solar (acción visible) |
| `build_sandcastle` | 12 | Levanta castillo por etapas |
| `play_beach` | 8 | Juega en arena |
| `enter_water` | 8 | Se introduce en el agua |
| `swim` | 8 | Nada con aletas, loop |
| `shake_water` | 8 | Se sacude gotas al salir |

No convertir el protector solar en ropa permanente: debe ser una **acción**; una leve marca de crema durante la aplicación es opcional. El ingeniero conserva su casco.

### 4.9. Variantes, expresiones y físicas imprescindibles

- Pingüino normal y pingüino ingeniero. Para casco del ingeniero: variante completa o capa anclada que respete movimientos de cabeza, giros, caída y levantarse; **no dejar el casco flotando**.
- Mínimo vistas **perfil y frente** allí donde las animaciones las necesitan (`scared` mira hacia pantalla). Para `fall_spin`, resolver los cambios de orientación coherentemente, incluyendo espalda/3⁄4.
- Ajustar aletas, pico y ojos durante las expresiones: que el personaje se reconozca como el de la imagen.
- No crear frames que solo cambien el PNG de lugar sin verdadera articulación corporal.
- Conservar una variante neutral de pingüino normal para primavera, y una clara ruta de `outfit change` desde cualquiera de las demás estaciones.
- Si técnicamente conviene, proveer capas PNG `penguin_body`, `helmet`, `scarf`, `boots`, `umbrella_open`, `umbrella_closed` y puntos de anclaje por frame; **no usarlas como sustituto de probar visualmente composiciones completas**.

## 5. Objetos, fondos y efectos — inventario obligatorio

### 5.1. Introducción

- Interruptor de pared `switch_off`/`switch_on`, brazo/posición de interacción y una versión compatible con día/noche si requiere contraste.
- Oscuridad/capa de apagón y recursos necesarios para desaparición/reaparición del ingeniero.
- Cuerda(s) colgantes separadas, soportes, tensión/curvatura, cabo cortado, fragmentos, sombra y **zona visual clara para interacción**. Entregar imagen del **cursor de tijeras** y efecto de corte. No atar visualmente las letras de manera inseparable.
- Escalera completa, segmentos o módulos para representar su armado, peldaños, estado transportado/colocado, pequeños efectos de golpe/apoyo y sombras.
- Herramienta de corte del pingüino como prop temporal para `cut_rope`, cuando sea necesaria.
- Efectos reutilizables para letras: impacto con suelo, rebote/polvo suave, congelamiento en invierno, brillo o énfasis al formar la **O de `hOme`**. Mantener tipografía legible; el contenido del nombre debe poder componerse como letras independientes.
- Pequeñas expresiones gráficas de sorpresa/curiosidad opcionales, siempre en el estilo de la referencia.

### 5.2. Escenario general / Home

- Suelo/plataforma donde apoyan patas, zonas transitables, sombras de contacto suaves y capas de primer plano/segundo plano.
- Fondos y capas **sin texto** para las ocho combinaciones: `winter_day`, `winter_night`, `autumn_day`, `autumn_night`, `spring_day`, `spring_night`, `summer_day`, `summer_night`.
- Idealmente capas `sky`, `far_background`, `midground`, `ground`, `foreground`, con fondos amplios/extendibles para adaptar a desktop y móvil. El área central debe permitir texto legible y no tapar la interacción.
- Sol, luna, estrellas, nubes, reflejos e iluminación o overlays de día/noche. Diferenciar visualmente noche de día incluso en invierno/verano.
- Elementos de ambiente comunes: sombras y variaciones de suelo, vegetación/rocas discretas, objetos manipulables, elementos para que pingüinos se sienten o jueguen.

### 5.3. Invierno

- Múltiples variantes de copos de nieve para partículas, bancos de nieve, acumulación de nieve en suelo/objetos.
- Hielo, placas deslizantes, escarcha/frost en letras y su estado derretido/no congelado.
- Bufanda(s) para pingüinos normales; bolas de nieve, etapas de muñeco de nieve, pequeñas nubes de aliento o temblor si favorecen el resultado.

### 5.4. Otoño

- Hojas ocres de varias formas/orientaciones, hojas acumuladas y montones manipulables.
- Gotas de lluvia y salpicaduras animables; **lluvia continua** mientras otoño esté seleccionado; charcos, ondas/ondas concéntricas y splash para `jump_puddle`.
- Botas, paraguas plegado y abierto, estados para sostenerlo/cerrarlo, vegetación/árboles otoñales.

### 5.5. Primavera

- Hierba, plantas, flores de varias formas/colores y etapas de crecimiento/floración.
- Pétalos flotantes, mariposas con al menos un pequeño ciclo de aleteo, puntos del escenario para que el pingüino se acerque a observar flores.

### 5.6. Verano

- Arena y variaciones de suelo de playa, mar por capas, sprites de ondas/olas en loop, espuma y salpicaduras.
- Protector solar/botella y crema visible al aplicar, castillo de arena en **varias etapas**, elementos de juego de playa y algo de vegetación costera.
- Variantes playa día/noche; un verano de noche debe seguir siendo playa, no un escenario genérico oscuro.

### 5.7. Interfaz visual

- Selector de estaciones / temperatura con **cuatro niveles exactos 0–3** e iconos identificables; estados normal, hover, seleccionado y foco si corresponden.
- Switch **sol/luna** con sus dos estados y contrastes adecuados.
- Cursor de tijeras `scissors_cursor.png`, potencial icono táctil de tijeras y feedback de corte.
- Referencia gráfica de `hOme`, con **O mayúscula** especial derivada de la caída de las letras. El texto HTML final debe seguir siendo accesible/editable; no entregar toda la página como una imagen.
- Elementos visuales de feedback para agarrar pingüinos solo si contribuyen (por ejemplo cambio de cursor); no añadir un botón de saltar intro.

**No todas las partículas necesitan spritesheets tradicionales:** puedes suministrar PNG individuales de nieve, hojas, lluvia, pétalos, etc., y metadatos para que Claude los emita/rote/desplace con Phaser. El criterio es que la composición final se vea animada y consistente, sin desperdiciar cientos de fotogramas equivalentes.

## 6. Estructura de carpetas recomendada

Trabaja dentro de un único directorio de entrega, por ejemplo `assets_home_oziel/` en el CWD. Puedes añadir subcarpetas necesarias, pero mantén lo siguiente y **documenta toda desviación**:

```text
assets_home_oziel/
├── documento.md                 # GUÍA HUMANA COMPLETA PARA CLAUDE (OBLIGATORIA)
├── asset_manifest.json          # Índice máquina: paths, tamaños, tipos, dependencias
├── animations.json              # FPS, frames, repeat, next state, pivotes
├── production_report.md         # Qué se produjo, qué falta, extras y decisiones
├── reference/
│   ├── character_model_sheet.png
│   ├── engineer_model_sheet.png
│   └── style_palette.json
├── characters/
│   ├── penguin/
│   │   ├── frames/              # Fotogramas individuales organizados por clip
│   │   ├── clips/               # PNG strips de cada animación
│   │   └── atlases/             # penguin_base.png + .json, etc.
│   ├── engineer/
│   │   ├── frames/
│   │   ├── clips/
│   │   └── atlases/
│   └── accessories/             # Helmet, scarf, boots, umbrella, anchors si aplica
├── intro/
│   ├── ropes/
│   ├── ladder/
│   ├── switch/
│   ├── tools/
│   └── letters_fx/
├── environments/
│   ├── winter/{day,night,props,particles}/
│   ├── autumn/{day,night,props,particles}/
│   ├── spring/{day,night,props,particles}/
│   └── summer/{day,night,props,particles}/
├── ui/
├── previews/                    # Contact sheets y GIF/APNG de revisión
├── scripts/                     # Si hacen falta scripts de pack/validación
└── sources/                     # SVGs/archivos editables cuando existan
```

Las llaves de la estructura son abreviatura conceptual: crea directorios reales `day`, `night`, `props` y `particles`, no directorios con llaves. No dejes assets huérfanos sin inventario.

## 7. Metadata e integración con Phaser: lo que Claude necesita

`asset_manifest.json` debe listar **cada imagen de producción** con:

- `id` estable, `path` relativo a `assets_home_oziel/`, `type` (`atlas`, `sprite`, `background`, `particle`, `prop`, `ui`, `preview`), `width`, `height`, `format`, `alpha`, `season`, `dayNight`, `characterVariant`, `notes` y, cuando aplique, `dependencies`.
- Para atlases: ruta de PNG y JSON, dimensiones de celdas, columna/fila, nombres de frames, clips incluidos.
- Para accesorios: `attachTo`, transformaciones/pivotes, combinaciones compatibles; regla ingeniero sin outfit.
- Para escena: escala/encuadre recomendado, z-index/capa, si es repetible/tileable y si debe adaptarse por composición a móvil.

`animations.json` debe incluir entradas de esta naturaleza (ajusta valores y rutas a **los archivos que realmente generes**):

```json
{
  "characters": {
    "penguin": {
      "walk": {
        "atlasKey": "penguin_base",
        "frames": ["walk_000", "walk_001", "walk_002"],
        "frameRate": 10,
        "repeat": -1,
        "origin": [0.5, 0.9],
        "interruptible": true,
        "next": null,
        "notes": "La lista final debe incluir TODOS los frames reales, no solo estos tres ejemplos."
      }
    }
  }
}
```

En `documento.md`, escribir **código JS/Phaser 3 real**, verificado, que muestre:

1. Cómo cargar un atlas PNG + JSON mediante `this.load.atlas(...)`.
2. Cómo definir un clip `this.anims.create(...)` mediante `frames` reales del atlas y cómo usar `sprite.play(...)`.
3. Cómo configurar `origin`, escala, `flipX`, profundidad y hitboxes recomendadas.
4. Cómo detectar arrastre con puntero/touch, pasar a `scared`/`dragged`, aplicar gravedad al soltar, elegir aleatoriamente entre tres clips `fall_*`, seleccionar impacto según velocidad/altura y después `get_up`, reanudando actividad anterior.
5. Cómo responder a choque entre pingüinos y cuándo activar `stumble`, `bump` o caída, sin bloquear el juego.
6. Cómo usar las acciones de temporada para que el cambio de clima primero haga mirar arriba/confundirse y después cambiar accesorios/actividad.
7. Cómo resolver la excepción permanente del ingeniero y cómo anclar su casco (si es accesorio en capa).
8. Cómo cargar/componer las **ocho combinaciones** de día/noche/estación y emitir lluvia, nieve, hojas, pétalos y olas sin reiniciar los pingüinos.
9. Cómo hacer clic/tap en la cuerda desde el primer segundo, usar `scissors_cursor`, cortar **una** cuerda para soltar **todo** el nombre y permitir tanto la intro automática como la transición por interacción.
10. Cómo combinar secuencias cuando termine un clip (`animationcomplete`): `impact_* → get_up → retomar actividad`, y dónde no conviene interrumpir un clip.

Si el motor o librería exacta no admite alguna API pretendida, corrige el ejemplo con una API válida; no inventes métodos. Claude necesita ejemplos que pueda pegar y adaptar, no pseudocódigo disfrazado de código ejecutable.

## 8. Pipeline de trabajo autónomo (sin esperar confirmaciones a cada paso)

1. **Analiza referencia y entorno:** identifica la imagen proporcionada, inspecciona dimensiones/herramientas disponibles, confirma la carpeta actual, prepara `assets_home_oziel/`. No modifiques archivos externos ni archivos previos no relacionados.
2. **Fija el modelo visual:** paleta, proporciones, silueta, outline, perfil/frente/espalda, ingeniero con casco. Guarda hojas maestras. Rechaza desviaciones claras de la referencia.
3. **Produce primero los P0:** `idle`, `walk`, `look_up`, `confused`, `scared`, `dragged`, tres `fall`, tres intensidades de impacto, `get_up`, `stumble`, y acciones narrativas. Valida continuidad antes de multiplicar variantes.
4. **Deriva variantes con consistencia:** pingüino común/ingeniero y accesorios de estación. No generes un personaje distinto para cada situación.
5. **Produce las actividades P1/P2** y las acciones de clima; combina las animaciones con props necesarios.
6. **Produce escenarios, capas, objetos, interfaz, partículas** y referencias de transición de letras; no crear una captura plana de la web.
7. **Empaqueta fotogramas y atlases**, genera JSON auténtico, vistas previas y manifest.
8. **Valida todo lo producido**, corrige defectos y documenta resultados.
9. **Escribe `documento.md` y `production_report.md`** basándote solo en rutas y datos que existen. En el reporte, explica cualquier recurso adicional que detectaste como necesario y creaste, o que falta crear.

Si detectas algo esencial para que Claude pueda crear el Home y que este prompt no contempló, **créalo con criterio propio** mientras permanezca dentro de recursos gráficos y documenta: **qué agregaste, por qué y dónde está**. No te desvíes a construir la página React/Phaser entera; esa será tarea de Claude.

## 9. Control de calidad obligatorio

Realiza controles visuales y automáticos (por ejemplo Pillow/OpenCV/scripts propios) de todos los recursos:

- **Existencia:** cada entrada de manifest tiene archivo real, y cada ruta enlazada existe.
- **Dimensiones:** cada frame tiene exactamente 256 × 256; cada tira, ancho múltiplo de 256; atlas y metadata coinciden.
- **Transparencia:** personajes, props y partículas tienen alfa real, bordes suaves; sin fondos blancos accidentales ni cuadrículas incrustadas.
- **Continuidad:** misma forma, color, barriga, pico, patas, mechones y grosor de línea entre fotogramas. Comparar en hojas de contacto y reproducir clips de prueba.
- **Movimiento auténtico:** frames no idénticos salvo pausas deliberadas; las patas/aletitas cambian coherentemente; ciclos sin saltos; pies no patinan de forma involuntaria.
- **No recortes:** aletas, casco, paraguas y efectos dentro de su canvas o con metadatos que expliquen sobresalientes.
- **Pivotes y colisiones:** pies sobre línea de suelo en idle/walk; pivote estable durante impacto/get_up; alturas y orientación coherentes en caídas.
- **Ingeniero:** casco en todas sus poses y estaciones, **ningún otro accesorio estacional**.
- **Estaciones:** invierno con nieve y hielo; otoño con hojas, charcos y **lluvia continua**; primavera flores/pétalos; verano playa/sol/protector solar. Todas deben admitir día/noche.
- **Legibilidad:** escenarios permiten ver ojos/cuerpo de pingüinos y futuro contenido del Home. Noche no totalmente negra.
- **Carga real:** validar al menos un atlas importado con su JSON y una secuencia completa. Si no puedes ejecutar Phaser, verifica esquema/rectángulos/keys de los JSON con un script y decláralo.
- **No duplicados ficticios:** evita archivos vacíos, promesas de producción futura, nombres sin contenido y “placeholder final”.
- **Previews:** al menos una hoja de contacto por atlas y vista de los estados importantes; guardar en `previews/`.

## 10. Contenido obligatorio de `documento.md`

Escribe la guía pensando en Claude como integrador externo que **no participó en la generación**. Debe ser suficientemente precisa para evitar preguntas básicas.

Estructura requerida:

1. **Resumen del Home** y su historia exacta, controles y restricciones.
2. **Árbol real de archivos** relevantes con rutas relativas copiables.
3. **Ficha del estilo visual** (colores aproximados, contornos, proporciones, reglas de ingeniero).
4. **Tabla maestra de recursos** (ID, archivo, tamaño, transparencia, variante, estación/día-noche, uso).
5. **Tabla maestra de animaciones** (clip, atlas, frame keys/rango real, count, FPS, loop, pivote, siguiente estado, interrupciones).
6. **Carga de atlases en Phaser** y cómo reproducir cada acción, con ejemplos verificables y nombres exactos.
7. **Máquina de estados y continuidad:** intro, agarrado, tres caídas aleatorias, impactos variables, `get_up`, recuerdo de tarea; colisiones en cadena; cambios de clima.
8. **Objetos y transiciones:** interruptor, escalera, cuerda/corte, caída de nombre/O hacia `hOme`, efectos, partículas.
9. **Composición de estaciones + día/noche:** capas, orden visual, emisiones/loops, cambios progresivos, lluvia otoñal permanente.
10. **Accesorios/capas de personaje:** cómo adjuntarlos y retirar los anteriores; excepción del casco del ingeniero.
11. **Adaptación responsive y táctil:** hit areas, escala, touch drag y cortar cuerda sin cursor físico.
12. **Verificación de assets** y comandos/scripts de prueba, si existen.
13. **Limitaciones, recursos faltantes, decisiones propias y próximos pasos** para Claude.

Incluye preferiblemente un diagrama textual de estados o Mermaid en Markdown, pero prioriza precisión de tablas y código. No describas recursos inexistentes como si estuvieran listos.

## 11. Entrega final que deberás comunicar

Al finalizar, muestra:

- Ruta absoluta de la carpeta `assets_home_oziel/`.
- Número total de PNG, atlases, clips, fotogramas, escenarios y props **realmente generados**.
- Qué porcentaje/cantidad de animaciones del inventario quedó completado, con nombres faltantes si los hay.
- Resultado del QA y problemas detectados/corregidos.
- Ruta a `documento.md`, `asset_manifest.json`, `animations.json` y previews clave.
- Lista separada de **assets o decisiones extra** que agregaste porque hacían falta para implementar bien el Home.
- Cualquier punto pendiente de decisión del usuario; no lo resuelvas inventando biografía, enlaces, redes o contenido personal.

**Regla final:** se te pidió entregar una **biblioteca visual útil** para que Claude construya el Home después. Sé exhaustivo, consistente con la imagen de referencia, transparente con las limitaciones y autónomo para producir todos los recursos que estén a tu alcance. No finalices después de generar una única imagen bonita: produce secuencias animables, empaquétalas, pruébalas y documéntalas.
