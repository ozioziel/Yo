# Inventario previo de pingüinos extra

Este documento describe el proyecto inspeccionado antes de la integración. La validación final de recursos debe consultarse en el informe de cobertura generado por el pipeline de extras; no se infiere de este inventario.

## Arquitectura y contratos

- Stack comprobado: React 19.2, TypeScript 5.9, Vite 7.1, Phaser 3.90; sin motor físico Arcade ni servidor necesario. Entradas: index.html → src/main.tsx → src/App.tsx → src/pages/Home.tsx → src/components/GameCanvas.tsx → src/game/createGame.ts → BootScene → WorldScene. /portafolio es una ruta separada.
- Comandos existentes: npm run dev (predev sincroniza solo si falta), build (tsc --noEmit + vite build), typecheck, assets, rig, audit:assets; preview sirve dist. npm run rig regenera los cuatro personajes originales con tools/rig/build_characters.cjs y sincroniza.
- Se buscaron AGENTS.md en el repositorio y todos sus ancestros: no se encontraron. Estado git inicial: únicamente assets_overrides/ExtraPenguins/ sin seguimiento. Las ocho referencias se conservan; no hay cambios rastreados previos.
- UI: src/pages/Home.tsx; estilos src/styles/home.css y global.css. Fredoka para títulos, Nunito para cuerpo, locales @fontsource. Contorno #080c0b, crema #f7efdf, amarillo #efb83d. Fondo HTML z=0, hero z=1, canvas transparente z=2, cuerdas accesibles z=3, topbar z=4, loader z=6. Topbar 76 px, 64 px en ≤640; controles táctiles adaptados a ≤360. Hero reserva suelo y 175 unidades sobre él.
- Canvas no recibe puntero; WorldScene escucha window.pointer*, excluyendo button/a/input/select/textarea/label/[data-ui]. Phaser input está deshabilitado, incluido teclado. SeasonPicker tiene flechas locales. No hay atajos mundiales de teclado.
- Preferencias localStorage en src/state/prefs.ts: estación, día/noche, sonido. ResizeObserver en createGame actualiza canvas/cámara; computeLayout define mundo 1920×1080, banda de suelo y=900, carriles y=934..1012 (1028 vertical). Visible mínimo 900 u vertical, 1180 horizontal; cámara puede tener top negativo.
- BootScene carga manifiesto, animaciones, ambientes; después atlases estacionales, props/partículas/UI, frente activo y expresiones; registra animaciones y espera Fredoka. WorldScene mide/aplica cámara antes de new World. World crea Environment, Ladder, NameSign, Brain, 15 pingüinos (10 compacto), Director; los originales inician fuera de escena.
- Intro: Director asigna roles reiniciables (ingeniero, cargador, colocador, ensambladores y sostenedores). La cuerda se corta con puntero/botón accesible (equivale a saltarla), por ingeniero o timeout. NameSign.cut es idempotente. Fases puente: loading → intro → falling → reveal → home. NameSign.formTitle mueve O; finish marca titleFormed y reveal. Director.onTitleFormed programa home 1700 ms después; la retirada real de cuerdas dura 900+1100 ms. Por tanto home por sí solo no garantiza escena estable. Extras requieren una señal adicional ligada a final de transición y mundo/carga preparados.
- Fábrica actual World.spawn crea Penguin y registra en world.penguins. Actualización World.update: entidad, colisiones, nombre, escalera, casco, director, Brain. Desmontaje GameCanvas destruye juego; WorldScene elimina listeners; World.destroy destruye entidades y escena. Penguin.destroy cancela tareas/timers/listeners de rutina y sprites/props adjuntos.
- Modos Penguin: normal → reaction; grabbed → airborne → down → normal. Rutinas Act con token, cancelación, timers y hooks ANIMATION_UPDATE por índice 0-based; once espera COMPLETE o REPEAT. Tras aterrizaje regresa a tarea reiniciable, vestido/clima pendiente y Brain.
- Física manual: gravedad 2600 u/s²; dt limitado a 50 ms; fricción horizontal 0.7^dt; rebote lateral −0.45 vx; suelo laneY; impactos <900/900..1499/≥1500. Techo actual top+200*size: hay que permitir cruzarlo desde arriba al invocar para evitar teletransporte. Colisión halfW=44*size; hitTest elipse 64×108*size independiente del margen transparente. Personajes tamaño 0.5..0.6, ingeniero .58, ×1.18 vertical.
- Choques World.collisions por carril (14 u), proyectiles por altura/carril (70 u), derribo encadenado máximo 3, enfriamientos globales e individuales. Brain usa la misma lista para parejas, juego, clima, casco y escalera; no hace falta otra IA.
- Casco: World.popHelmet cambia a penguin; Brain.fetchHelmet usa pick_up_object hook 3, remove_accessories, ancla hm y World.wearHelmet cambia a engineer. Identidad extra debe sobrevivir a esos cambios. No se puede simplemente sustituir idle.

## Pipeline visual real

Fuente editable vigente: tools/rig/build_characters.cjs (derivada de la biblioteca original Recursos/assets_home_oziel, que no se modifica). pose(clip,i,n) calcula articulación, expresiones, orientación, escala, giros, asiento y props; rig dibuja SVG 256×256 lógico rasterizado mediante sharp. Exporta pose/svg/png/groups. Recursos vigentes: assets_overrides/characters/animations.json y <variant>/atlases/*.png,json. scripts/sync-assets.mjs fusiona y reduce datos a public/assets/data/animations.json y manifest.json. tools/make_sd_atlases.py produce SD 128² con alpha premultiplicada.

Los frames son poses articuladas rasterizadas, no la trayectoria de la entidad. Caminar alterna patas/aletas; subir alterna patas/aletas en espalda; nadar bate aletas. Trayectoria, gravedad, squash de choque, profundidad de agua, sombras, props externos y partículas pertenecen a Phaser. No se necesitan fotogramas de desplazamiento intermedio adicionales.

Todas las celdas HD: 256×256, RGBA transparente real, sin trim ni rotación; atlas hasta 8 columnas y 64 celdas (2048² máximo). Orden de frames clip_000... consecutivo. Origen suelo [0.5,0.9], apoyo lógico [128,230] (runtime ORIGIN.y=230.4). Aéreos dragged/fall_* usan [0.5,0.5] en datos, pero Penguin.sync compensa alrededor y=46 con escala ×1/0.87 para evitar saltos. Anclas por cada frame: handNear/handFar/helmet (hn/hf/hm runtime), también neck y ground en fuente. El contrato completo numérico por frame está en extra-penguins-contract.json.

Dirección original lateral mira izquierda. Penguin.face invierte sprite con flipX para derecha; aunque flipSafe aparece en metadatos, el runtime no lo consulta. Para extras con texto/tatuajes/asimetrías hacen falta direcciones explícitas o corrección por capas, no espejo indiscriminado.

La biblioteca vigente tiene 72 clips, 513 frames por penguin. Variantes originales: penguin 72 clips; engineer 66 clips; penguin_winter 56 clips; penguin_autumn 56 clips. Engineer omite seis equipamientos; invierno y otoño solo incorporan sus grupos estacionales además de base/intro/daily/weather.

Inspección visual realizada sobre las 11 hojas docs/rig_preview/penguin_*_contact.png: base (3), intro (2), daily, weather y cuatro estaciones. Confirmados contorno, poses, blanco del cuerpo, brazos unidos, alternancia de patas, vistas de espalda y giro, objetos rasterizados, apoyo y coherencia entre impacto/get_up. Son hojas ya existentes; no equivalen a validación visual de extras ni de ejecución actual.

## Matriz exhaustiva del contrato base

Duración nominal = frames/fps; los bucles se mantienen el tiempo de la tarea. En acciones no cíclicas el último frame representa la pose final; Act determina la transición, no una transición autónoma del atlas. Todos comparten dimensiones/alpha/anclas anteriores; atlas abreviado reside en assets_overrides/characters/penguin/atlases/. Las variantes concretas y consumidores con línea están en el JSON.

| Estado/acción | Grupo | Vistas en secuencia | Frames/orden | fps; ms/ciclo; bucle | Atlas | Alcance | Consumidor, evento y transición |
|---|---|---|---|---|---|---|---|
| idle | base | side | 6; 000–005 | 6; 1000; sí | penguin_base_00.png | post-intro | Reposo, espera y transición entre tareas; respiración y párpados. |
| blink | base | side | 4; 000–003 | 10; 400; no | penguin_base_00.png | post-intro | Parpadeo durante paseo y despertar. |
| walk | base | side | 8; 000–007 | 10; 800; sí | penguin_base_00.png | post-intro | Patas y aletas alternas; traslación en Act.walkTo (110–190 u/s normalmente). |
| run | base | side | 8; 000–007 | 14; 571; sí | penguin_base_00.png | post-intro | Patas/aletas rápidas; traslación 230–330 u/s. |
| look_up | base | side | 6; 000–005 | 10; 600; no | penguin_base_00.png | post-intro | Observación del cielo y nombre; inclinación de cabeza. |
| look_around | base | side, front | 8; 000–007 | 10; 800; sí | penguin_base_00.png | post-intro | Espera/observación con giro lateral → frontal → lateral. |
| curious | base | side, front | 6; 000–005 | 10; 600; no | penguin_base_00.png | post-intro | Curiosidad después de interactuar con objetos. |
| confused | base | side, front | 6; 000–005 | 10; 600; no | penguin_base_00.png | post-intro | Respuesta a empujón, colisión y bola de nieve. |
| scared | base | front | 4; 000–003 | 10; 400; no | penguin_base_00.png | post-intro | Agarre: ANIMATION_COMPLETE → dragged. |
| dragged | base | front | 4; 000–003 | 10; 400; sí | penguin_base_00.png | post-intro | Sostener con puntero; interpolación hacia dragTarget y bob de 3 u en runtime. |
| fall_normal | base | front | 8; 000–007 | 10; 800; sí | penguin_base_01.png | post-intro | Caída con giro leve; gravedad y desplazamiento runtime. |
| fall_spin | base | front, side, back, quarter | 12; 000–011 | 10; 1200; sí | penguin_base_01.png | post-intro | Vuelta completa: frontal 0–2, lateral 3–5, espalda 6–8, cuarto 9–11. |
| fall_flap | base | front | 8; 000–007 | 10; 800; sí | penguin_base_01.png | post-intro | Caída con batido alterno de ambas aletas. |
| impact_light | base | side | 5; 000–004 | 10; 500; no | penguin_base_01.png | post-intro | Llegada <900 u/s → get_up. |
| impact_medium | base | side | 6; 000–005 | 10; 600; no | penguin_base_01.png | post-intro | Llegada 900–1499 u/s → get_up. |
| impact_heavy | base | side | 8; 000–007 | 10; 800; no | penguin_base_01.png | post-intro | Llegada ≥1500 u/s → espera 420 ms + get_up; estrellas 1700 ms. |
| get_up | base | side | 8; 000–007 | 10; 800; no | penguin_base_01.png | post-intro | Recuperación → vestido/clima pendiente → misma tarea o Brain. |
| stumble | base | side | 6; 000–005 | 10; 600; no | penguin_base_01.png | post-intro | Tropiezo y retroceso, puede lanzar knockDown. |
| bump | base | side | 6; 000–005 | 10; 600; no | penguin_base_02.png | post-intro | Reacción a colisión o nieve. |
| push | base | side | 6; 000–005 | 10; 600; no | penguin_base_02.png | post-intro | Empujar a otro; World.stagger desplaza al receptor. |
| sit_down | base | side | 6; 000–005 | 10; 600; no | penguin_base_02.png | post-intro | Sentarse → sit_idle. |
| sit_idle | base | side | 4; 000–003 | 10; 400; sí | penguin_base_02.png | post-intro | Descanso 3500–7500 ms. |
| stand_up | base | side | 6; 000–005 | 10; 600; no | penguin_base_02.png | post-intro | Fin del descanso. |
| enter | intro | side | 8; 000–007 | 10; 800; no | penguin_intro_00.png | available-unused | Existe en atlas pero entradas reales usan walk/run. |
| switch_light | intro | side | 8; 000–007 | 10; 800; no | penguin_intro_00.png | intro-only | Intro: hooks 3 apagan/encienden interruptor externo. |
| notice_name | intro | side | 6; 000–005 | 10; 600; no | penguin_intro_00.png | intro-only | Intro: ingeniero mira nombre. |
| group_look_up | intro | side | 6; 000–005 | 10; 600; no | penguin_intro_00.png | intro-only | Intro: grupo observa nombre. |
| carry_ladder | intro | side | 8; 000–007 | 10; 800; sí | penguin_intro_00.png | post-intro | Intro y mantenimiento: Ladder.img externo sigue hn; desplazamiento walkTo. |
| place_ladder | intro | side | 8; 000–007 | 10; 800; no | penguin_intro_00.png | post-intro | Intro y mantenimiento: Ladder.raise mueve y rota prop separado. |
| assemble_ladder | intro | side | 8; 000–007 | 10; 800; no | penguin_intro_00.png | intro-only | Intro: hooks 2 agrega pie de escalera y 5 tok. |
| hold_ladder | intro | side | 6; 000–005 | 10; 600; sí | penguin_intro_00.png | post-intro | Intro y mantenimiento: sostiene escalera externa. |
| climb | intro | back | 8; 000–007 | 10; 800; sí | penguin_intro_01.png | post-intro | Intro y pulido: espalda, aletas/patas alternas; moveTo sube peldaños de hasta 48*scale. |
| reach_rope | intro | side | 6; 000–005 | 10; 600; no | penguin_intro_01.png | intro-only | Intro: alcanza cuerda. |
| cut_rope | intro | side | 8; 000–007 | 10; 800; no | penguin_intro_01.png | intro-only | Intro: tijeras rasterizadas; hook 4 corta cuerda externa. |
| react_name_fall | intro | front | 8; 000–007 | 10; 800; no | penguin_intro_01.png | intro-only | Reacción a caída del nombre, exclusivamente antes de home. |
| celebrate | intro | front | 6; 000–005 | 10; 600; no | penguin_intro_01.png | post-intro | Festejo compartido: intro, casco, muñeco/castillo/brote y pulido. |
| wipe | intro | back | 8; 000–007 | 10; 800; sí | penguin_intro_01.png | post-intro | Pulido post-intro: espalda, aleta de lejos limpia; hook 2 genera destello en hf, 4 ciclos. |
| sleep | daily | side | 8; 000–007 | 6; 1333; sí | penguin_daily_00.png | post-intro | Dormir 5000–9000 ms. |
| wake_up | daily | side | 6; 000–005 | 10; 600; no | penguin_daily_00.png | post-intro | Despertar después de sleep. |
| greet | daily | front | 6; 000–005 | 10; 600; no | penguin_daily_00.png | post-intro | Saludo mutuo; respuesta del compañero por react. |
| play | daily | front | 8; 000–007 | 10; 800; sí | penguin_daily_00.png | post-intro | Juego frontal 1600–3200 ms. |
| chase | daily | side | 8; 000–007 | 14; 571; sí | penguin_daily_00.png | post-intro | Persecución 235 u/s; otro huye con run 250 u/s. |
| laugh | daily | front | 6; 000–005 | 10; 600; no | penguin_daily_00.png | post-intro | Reacción compartida al juego/interacciones. |
| interact_object | daily | side | 8; 000–007 | 10; 800; no | penguin_daily_00.png | post-intro | Examinar roca/asiento externo. |
| pick_up_object | daily | side | 6; 000–005 | 10; 600; no | penguin_daily_00.png | post-intro | Hook 3 vincula casco/escalera a hn. |
| put_down_object | daily | side | 6; 000–005 | 10; 600; no | penguin_daily_00.png | available-unused | Existe, sin consumidor runtime actual. |
| notice_weather | weather | side | 6; 000–005 | 10; 600; no | penguin_weather_00.png | post-intro | Cambio de estación → weather_confused. |
| weather_confused | weather | side, front | 6; 000–005 | 10; 600; no | penguin_weather_00.png | post-intro | Espera carga estación; puede continuar look_around. |
| remove_accessories | weather | front | 8; 000–007 | 10; 800; no | penguin_weather_00.png | post-intro | Quita SOLO accesorios estacionales antes de cambiar estación o tomar casco. |
| resume_after_weather | weather | side | 4; 000–003 | 10; 400; no | penguin_weather_00.png | post-intro | Retoma tarea tras reacción climática. |
| put_scarf | winter | front | 8; 000–007 | 10; 800; no | penguin_winter_00.png | post-intro | Invierno: bufanda progresa 0→1; cambia a variante vestida. |
| shiver | winter | side | 6; 000–005 | 10; 600; sí | penguin_winter_00.png | post-intro | Temblor articulado + vapor runtime. |
| make_snowball | winter | front | 8; 000–007 | 10; 800; sí | penguin_winter_00.png | post-intro | Bola rasterizada entre aletas, preparar 900–1500 ms. |
| throw_snowball | winter | side | 8; 000–007 | 10; 800; no | penguin_winter_00.png | post-intro | Bola rasterizada hasta frame 4; hook 5 proyectil externo desde hn. |
| ice_slide | winter | side | 8; 000–007 | 10; 800; sí | penguin_winter_00.png | post-intro | Deslizamiento runtime 330 u/s por zona hielo. |
| build_snowman | winter | side | 12; 000–011 | 10; 1200; no | penguin_winter_00.png | post-intro | Hook 3/7/11 etapas del muñeco externo. |
| put_boots | autumn | side | 8; 000–007 | 10; 800; no | penguin_autumn_00.png | post-intro | Botas progresan 0→1. |
| open_umbrella | autumn | side | 8; 000–007 | 10; 800; no | penguin_autumn_00.png | post-intro | Paraguas se abre en hn; parte del raster. |
| walk_umbrella | autumn | side | 8; 000–007 | 10; 800; sí | penguin_autumn_00.png | post-intro | Patas/aletas de caminar, paraguas sujeto a hn. |
| jump_puddle | autumn | side | 8; 000–007 | 10; 800; no | penguin_autumn_00.png | post-intro | Arco corto dibujado; hook 4 salpicadura externa. |
| play_leaves | autumn | side | 8; 000–007 | 10; 800; no | penguin_autumn_00.png | post-intro | Hook 4 hojas externas y rustle. |
| hide_rain | autumn | side | 6; 000–005 | 10; 600; sí | penguin_autumn_00.png | post-intro | Protegido por paraguas; 3000–6000 ms. |
| chase_butterfly | spring | side | 8; 000–007 | 10; 800; sí | penguin_spring_00.png | post-intro | Aleteo/patas rápidas; mariposa externa delante del pico. |
| smell_flower | spring | side | 8; 000–007 | 10; 800; no | penguin_spring_00.png | post-intro | Hook 4 pétalos de flor externa. |
| sit_grass | spring | side | 6; 000–005 | 10; 600; sí | penguin_spring_00.png | post-intro | Descanso en pasto 4000–8000 ms. |
| watch_bloom | spring | side, front | 6; 000–005 | 10; 600; no | penguin_spring_00.png | post-intro | Hook 2 cambia etapa de brote externo. |
| apply_sunscreen | summer | front | 8; 000–007 | 10; 800; no | penguin_summer_00.png | post-intro | Frontal; botella en hn y crema rasterizadas. |
| build_sandcastle | summer | side | 12; 000–011 | 10; 1200; no | penguin_summer_00.png | post-intro | Hook 3/7/11 etapas de castillo externo. |
| play_beach | summer | side | 8; 000–007 | 10; 800; sí | penguin_summer_00.png | post-intro | Pelota externa; hook 2 primer golpe, alternancia con compañero. |
| enter_water | summer | side | 8; 000–007 | 10; 800; no | penguin_summer_00.png | available-unused | Existe pero Brain.swim usa walk + profundidad runtime para entrar. |
| swim | summer | side | 8; 000–007 | 10; 800; sí | penguin_summer_00.png | post-intro | Pose inclinada, aletas/patas batidas; traslación 70 u/s, recorte y water_ring runtime. |
| shake_water | summer | front | 8; 000–007 | 10; 800; no | penguin_summer_00.png | post-intro | Salida del agua, giro corporal y gotas rasterizadas. |

## Exclusiones y recursos compartidos

intro-only significa imposible para extras invocados después de escena estable: switch_light, notice_name, group_look_up, assemble_ladder, reach_rope, cut_rope, react_name_fall. No justifica excluir todo el atlas intro: carry_ladder, place_ladder, hold_ladder, climb, celebrate y wipe se usan después. enter, put_down_object y enter_water existen pero no son llamados actualmente (entrada de agua usa walk). Producirlos mantiene equivalencia completa y evita huecos ante nuevas tareas.

Recursos compartidos ya cargados: environments_common_props_contact_shadow; expression_curiosity/surprise; estrellas; helmet, escalera y pies (Ladder.ts); fx_dust/fx_impact y props de nieve/hielo/hojas/charcos/flores/castillo/pelota/agua (Environment.ts); water_ring para recorte; mariposa y efectos splash/wave. Deben seguir siendo compartidos y vinculados a hn/hf/hm, no duplicados por personaje. Paraguas, bufanda, botas, bola de nieve antes del lanzamiento, crema/botella, tijeras y gotas son parte del rig rasterizado.

## Referencias y cobertura de producción inicial

Los ocho nombres reales en disco, comprobados sin recursión:

| Identificador | Referencia intacta | Dimensiones | Alpha declarado | Estado al inventariar |
|---|---|---|---|---|
| aylen | assets_overrides/ExtraPenguins/Aylen.png | 1254×1254 | false | Pendiente producción/validación de todos los clips |
| boris | assets_overrides/ExtraPenguins/boris.png | 1254×1254 | false | Pendiente producción/validación de todos los clips |
| chalquits | assets_overrides/ExtraPenguins/Chalquits.png | 1254×1254 | false | Pendiente producción/validación de todos los clips |
| chiquito | assets_overrides/ExtraPenguins/Chiquito.png | 1254×1254 | false | Pendiente producción/validación de todos los clips |
| oror | assets_overrides/ExtraPenguins/oror.png | 1254×1254 | false | Pendiente producción/validación de todos los clips |
| shadow-frederick | assets_overrides/ExtraPenguins/Shadow Frederick.png | 1254×1254 | false | Pendiente producción/validación de todos los clips |
| tats | assets_overrides/ExtraPenguins/Tats.png | 1254×1254 | false | Pendiente producción/validación de todos los clips |
| zorro-negro | assets_overrides/ExtraPenguins/zorro negro.png | 1254×1254 | false | Pendiente producción/validación de todos los clips |

extra-penguins-contract.json cruza cada estado con las ocho identidades; sus campos extraResources son el registro de faltantes inicial. La cobertura final deberá referenciar el manifiesto generado real, detectar rutas/mayúsculas/dimensiones/rectángulos/anclas/frames faltantes, y separar validación estructural de revisión visual y runtime. No registrar un clip como válido solo porque exista el archivo.

Reproducir inventario: node tools/audit/inventory_extra_penguins.cjs. Este script solo lee referencias/rig y genera documentos; no altera fuentes ni imágenes originales.
