# Cobertura de recursos de los pingüinos extra

Generado por `node tools/extras/validate.cjs`. Resultado: **9 personajes: 648 clips, 4617 fotogramas y 81 atlas con validación estructural correcta**. La comprobación cubre archivos, transparencia, recortes, contratos, anclas y que ninguna animación sea estática. El parecido con las referencias y el movimiento se revisan aparte, con las hojas de control y en el juego ([VISUAL_REVIEW.md](VISUAL_REVIEW.md)).

Cada personaje es una marioneta de recortes de su propio PNG ([IDENTITY.md](IDENTITY.md)). Tiene un único traje, su ropa propia, con las 72 acciones del pingüino base (`penguin`): mismos nombres, número de fotogramas, fps, bucle y origen. Al mirar a la derecha el juego refleja el mismo dibujo (`flipX`), como con los pingüinos base; no hay `<acción>__right`.

Fuentes: referencias intactas en `assets_overrides/ExtraPenguins/*.png` (SHA-256 coincidente). Recorte en `generated/<id>/cutout.png`. Piezas en `generated/<id>/rig/`. Atlas en `generated/<id>/atlases/`. Manifiesto en `generated/animations.json`. Registro en `src/game/extraPenguins.json`. [Correspondencia exacta por personaje, acción, atlas y fotograma](coverage.json).

## Totales por personaje

Memoria de textura de lo que se carga en juego (grupos base, tasks, daily y weather más la estación más pesada): escritorio / móvil.

| Personaje | Id | Clips | Fotogramas | Atlas | MiB en juego |
|---|---|---:|---:|---:|---:|
| Aylen | aylen | 72 | 513 | 9 | 31.1 / 7.8 |
| Boris | boris | 72 | 513 | 9 | 31.0 / 7.8 |
| Chalquits | chalquits | 72 | 513 | 9 | 34.7 / 8.7 |
| Chiquito | chiquito | 72 | 513 | 9 | 26.9 / 6.7 |
| oror | oror | 72 | 513 | 9 | 30.5 / 7.6 |
| RMLIV | rmliv | 72 | 513 | 9 | 28.7 / 7.2 |
| Shadow Frederick | shadow-frederick | 72 | 513 | 9 | 30.3 / 7.6 |
| Tats | tats | 72 | 513 | 9 | 29.4 / 7.4 |
| zorro negro | zorro-negro | 72 | 513 | 9 | 37.4 / 9.4 |

## Matriz de las 72 acciones

✓ N: la acción existe con todos sus fotogramas, anclas de aletas y cabeza, duración y bucle; N es el número de imágenes distintas de la secuencia. Frames/fps es el número de fotogramas y su velocidad; un ciclo dura frames/fps segundos. `tasks` agrupa los clips de la intro que el comportamiento normal reutiliza (escalera y celebración).

| Acción | Grupo | Frames / fps / repetición | Uso por un extra | Aylen | Boris | Chalquits | Chiquito | oror | RMLIV | Shadow Frederick | Tats | zorro negro |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | base | 6 / 6 / bucle | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| blink | base | 4 / 10 / una vez | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| walk | base | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| run | base | 8 / 14 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| look_up | base | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| look_around | base | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| curious | base | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| confused | base | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| scared | base | 4 / 10 / una vez | Alcanzable tras la intro | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| dragged | base | 4 / 10 / bucle | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| fall_normal | base | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 5 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 |
| fall_spin | base | 12 / 10 / bucle | Alcanzable tras la intro | ✓ 12 | ✓ 12 | ✓ 12 | ✓ 12 | ✓ 12 | ✓ 12 | ✓ 12 | ✓ 12 | ✓ 12 |
| fall_flap | base | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| impact_light | base | 5 / 10 / una vez | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| impact_medium | base | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| impact_heavy | base | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 |
| get_up | base | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 |
| stumble | base | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| bump | base | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| push | base | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| sit_down | base | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| sit_idle | base | 4 / 10 / bucle | Alcanzable tras la intro | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| stand_up | base | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| enter | intro | 8 / 10 / una vez | No se carga: coreografía exclusiva de la intro, anterior a cualquier invocación | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 |
| switch_light | intro | 8 / 10 / una vez | No se carga: coreografía exclusiva de la intro, anterior a cualquier invocación | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| notice_name | intro | 6 / 10 / una vez | No se carga: coreografía exclusiva de la intro, anterior a cualquier invocación | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| group_look_up | intro | 6 / 10 / una vez | No se carga: coreografía exclusiva de la intro, anterior a cualquier invocación | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| carry_ladder | tasks | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| place_ladder | tasks | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| assemble_ladder | intro | 8 / 10 / una vez | No se carga: coreografía exclusiva de la intro, anterior a cualquier invocación | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 |
| hold_ladder | tasks | 6 / 10 / bucle | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| climb | tasks | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 |
| reach_rope | intro | 6 / 10 / una vez | No se carga: coreografía exclusiva de la intro, anterior a cualquier invocación | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| cut_rope | intro | 8 / 10 / una vez | No se carga: coreografía exclusiva de la intro, anterior a cualquier invocación | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 |
| react_name_fall | intro | 8 / 10 / una vez | No se carga: coreografía exclusiva de la intro, anterior a cualquier invocación | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 |
| celebrate | tasks | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| wipe | tasks | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 |
| sleep | daily | 8 / 6 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| wake_up | daily | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| greet | daily | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| play | daily | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| chase | daily | 8 / 14 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| laugh | daily | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| interact_object | daily | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| pick_up_object | daily | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| put_down_object | daily | 6 / 10 / una vez | Cargado; ningún pingüino lo usa en el código actual | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| notice_weather | weather | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| weather_confused | weather | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| remove_accessories | weather | 8 / 10 / una vez | Cargado con su grupo; no alcanzable: los extras no se cambian de ropa | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| resume_after_weather | weather | 4 / 10 / una vez | Alcanzable tras la intro | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| put_scarf | winter | 8 / 10 / una vez | Cargado con su grupo; no alcanzable: los extras no se cambian de ropa | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| shiver | winter | 6 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 3 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| make_snowball | winter | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 |
| throw_snowball | winter | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 |
| ice_slide | winter | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 |
| build_snowman | winter | 12 / 10 / una vez | Alcanzable tras la intro | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 |
| put_boots | autumn | 8 / 10 / una vez | Cargado con su grupo; no alcanzable: los extras no se cambian de ropa | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| open_umbrella | autumn | 8 / 10 / una vez | Cargado con su grupo; no alcanzable: los extras no se cambian de ropa | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| walk_umbrella | autumn | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| jump_puddle | autumn | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| play_leaves | autumn | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| hide_rain | autumn | 6 / 10 / bucle | Alcanzable tras la intro | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| chase_butterfly | spring | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| smell_flower | spring | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| sit_grass | spring | 6 / 10 / bucle | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |
| watch_bloom | spring | 6 / 10 / una vez | Alcanzable tras la intro | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 5 | ✓ 6 |
| apply_sunscreen | summer | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 | ✓ 7 |
| build_sandcastle | summer | 12 / 10 / una vez | Alcanzable tras la intro | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 | ✓ 11 |
| play_beach | summer | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 3 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| enter_water | summer | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 | ✓ 8 |
| swim | summer | 8 / 10 / bucle | Alcanzable tras la intro | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 | ✓ 5 |
| shake_water | summer | 8 / 10 / una vez | Alcanzable tras la intro | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |

## Contratos comprobados

- Rutas con mayúsculas exactas; referencias originales sin modificar; 9 identidades y claves de atlas únicas.
- Sin clips `__right`: mirar a la derecha es el reflejo del mismo dibujo.
- Páginas RGBA con transparencia; tamaño de PNG, JSON y manifiesto coincidentes; celdas de 240 px (`textureScale` 0.75 sobre una celda lógica de 320, con los pies a 0,9 de su altura como en las de 256) recortadas, con rectángulos pares para que la versión móvil sea la mitad exacta.
- Nombres y orden de fotogramas; los mismos fotogramas, fps, bucle y origen que el pingüino base; anclas finitas dentro de la celda.
- Ningún fotograma vacío; ninguna secuencia estática; reposos distintos entre identidades; ningún atlas huérfano.
- El grupo `intro` contiene solo la coreografía exclusiva de la intro y nunca se carga para un extra.
