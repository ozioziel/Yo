# Auditoría de la biblioteca de Codex (`Recursos/assets_home_oziel`)

Fecha: 25 de octubre de 2026. La biblioteca **no se modificó**: todo lo que corregí se hizo en el
código del juego (runtime) o en `assets_overrides/`.

## Método

1. **Inventario automático de todos los archivos** con `tools/audit/audit_assets.py`
   (`npm run audit:assets`). El script comprueba:
   - que cada entrada del manifiesto exista, con el tamaño declarado;
   - que la transparencia sea real (PNG RGBA con píxeles transparentes);
   - que no haya PNG sueltos fuera del manifiesto;
   - en cada atlas: rectángulos dentro de la imagen, `meta.size` y nombres de frames;
   - en cada clip de `animations.json`: que existan los frames, que no sea estático, la diferencia
     entre frames y en la unión del bucle, la línea de los pies (pivote), recortes contra el borde
     de la celda, que el frame del atlas coincida con el PNG suelto, los colores del casco en el
     ingeniero y la ausencia de bufanda o paraguas en él;
   - las 8 composiciones de escenario.

   Resultado completo: [audit/audit_summary.md](audit/audit_summary.md) y
   [audit/audit_inventory.json](audit/audit_inventory.json).
2. **Revisión visual** de todas las hojas de contacto de `previews/`:
   - personajes `base`, `intro`, `daily` y `weather`, y las hojas por estación de cada variante;
   - props, UI/intro y los 8 ambientes;
   - comparación con las hojas de modelo y con la imagen original.
3. **Integración real en Phaser 3.90** dentro de la app, con pruebas guiadas en el navegador:
   intro completa, corte temprano, arrastre, caídas, impactos, choques, cambio de estación,
   día/noche, intercambio del casco, móvil vertical y texturas SD.
4. `integration/runtime_test.mjs` de Codex es solo lectura y lo ejecuté: **PASS**.
   No ejecuté `integration/test/run_browser_test.cjs` porque **sobrescribe archivos dentro de la
   biblioteca** (`browser_result.json` y la captura). Tampoco usé los scripts de regeneración.

## Resultado estructural

| Tipo | Archivos | Apto |
|---|---:|---:|
| Frames de personaje (sprite) | 2004 | 2004 |
| Atlases (PNG + JSON) | 47 | 47 |
| Fondos 1920×1080 | 40 | 40 |
| Props | 57 | 57 |
| Partículas | 58 | 58 |
| UI | 25 | 25 |
| Previews | 63 | 63 |
| **Total** | **2294** | **2294** |

- Clips verificados: 246 (71 `penguin`, 65 `engineer`, 55 `penguin_winter`, 55 `penguin_autumn`).
  Ninguno es estático y todos sus frames existen en el atlas.
- Errores estructurales: **0**. PNG fuera del manifiesto: **0**.
- Avisos: **11**, todos de pivote menor. Las botas y los impactos de la variante de otoño bajan
  hasta 8–18 px por debajo de la línea del suelo (y = 231). Es la puntera de la bota y no se nota
  en pantalla: **apto**.
- Ingeniero: el casco aparece en todos los frames que lo muestran. No hay bufanda ni paraguas en
  ningún clip, y no tiene los seis clips de vestuario prohibidos: **apto**.
- Las 8 combinaciones estación × día/noche tienen sus 5 capas, y el suelo empieza exactamente en
  y = 900: **apto**.

## Veredicto por recurso o funcionalidad

| Recurso / funcionalidad | Veredicto | Nota |
|---|---|---|
| Modelo del pingüino vs. original | Apto | Silueta de pera, contorno grueso, pico/patas ocre, mechones. Frente y espalda son interpretación (lo declara Codex). |
| Ingeniero (solo casco) | Apto | Verificado por color en los 65 clips y en pantalla en las 4 estaciones. |
| Variantes invierno (bufanda) / otoño (botas + paraguas) | Apto, con una limitación | El paraguas solo aparece en algunos clips de otoño: sí en idle, walk, look, curious, scared, sit, hide_rain y walk_umbrella; no en run, caídas, intro ni daily. Al pasar de un tipo de clip al otro, el paraguas aparece o desaparece. Lo atenué dando prioridad a actividades con paraguas en otoño. No se corrigió el arte. |
| Clips aéreos (dragged, fall_*) | **Necesitaba corrección (hecha en runtime)** | Están dibujados al 87 % alrededor del punto (128,46), así que el pingüino "encogía" al agarrarlo y "crecía" al aterrizar. Lo compensé en `Penguin.ts` (escala 1/0.87 sobre ese pivote) sin tocar los PNG. Verificado: misma altura y posición (±2 px). |
| Aletas de interacción | Apto, con adaptación | El anclaje `handNear` es la aleta trasera, así que el interruptor, la escalera y sostener se hacen "hacia atrás". Lo adapté así: el ingeniero pulsa el interruptor que tiene a su espalda y los que sostienen la escalera miran hacia afuera. |
| Clips con `repeat:-1` usados como gesto (hold_ladder, play_beach, look_around…) | Apto, con adaptación | El runtime trata un ciclo completo como "una vez". |
| Caídas (normal/spin/flap) e impactos (light/medium/heavy) → get_up | Apto | La continuidad impacto → get_up es exacta. `fall_spin` cambia de vista por poses discretas (lo avisa Codex): a 10 fps se lee como un giro cómico. |
| Escalera, cuerdas, interruptor, tijeras, anclas | Apto | Tamaños y orígenes según el manifiesto. |
| Efectos (cut, dust, impact, o_glow, ripple, splash, wave, butterfly) | Apto | **Corregido en runtime:** las olas deben reproducirse todas en fase; con fases aleatorias se veía una costura. |
| Props de estación (muñeco y castillo por etapas, flores, charcos, pelota, etc.) | Apto | — |
| UI (estaciones 0–3, sol/luna, cursores, indicador táctil) | Apto | Se usan con etiquetas HTML accesibles. |
| Ambientes 8× | Apto | La lluvia es por partículas (no está pintada en el cielo), así que no se interrumpe al cambiar día/noche. |
| `integration/oziel_runtime.mjs` | Útil como referencia, **no reutilizado tal cual** | Problemas: (1) `startIntroTimeline` hace caminar al ingeniero hacia la derecha sin `flipX`, y como el rig base mira a la izquierda queda de espaldas; (2) carga los 47 atlases a la vez (~460 MB de VRAM); (3) las letras se montan con un `delayedCall(1200)` fijo; (4) usa Arcade y `Math.random` sin limitar los accidentes. Sí reutilicé ideas: variante por estación, umbrales de impacto, cancelación por token y compensación del origen. |
| Letras del nombre | Faltante (por diseño) | Codex no entrega letras en imagen. Se dibujan como texto Fredoka con contorno, del mismo estilo, y el título HTML es el semántico. |
| Clip "ponerse el casco" | Faltante | Lo resolví con `pick_up_object` + tween del prop `helmet` a la cabeza + cambio de variante con un poco de polvo. |
| Poste del interruptor | Faltante | Dibujado en Phaser (madera con contorno negro, mismo estilo). |
| Marca / favicon | Faltante | Lo creé a partir del frame frontal del ingeniero (`tools/make_brand.py` → `assets_overrides/brand/`). |
| Audio | Faltante (no pedido a Codex) | Efectos sintetizados con Web Audio, sin archivos y sin música. |

## Segunda ronda: correcciones pedidas por Oziel (25/10/2026)

Tras tu revisión rehice el rig de los personajes. El script `tools/rig/build_characters.cjs` es una
copia del de Codex con correcciones; sale a `assets_overrides/characters` y la biblioteca original no
se toca. Se regenera con `npm run rig`.

| Problema reportado | Causa en el rig de Codex | Corrección |
|---|---|---|
| Al caminar, las aletas "no están pegadas al cuerpo" | La aleta visible colgaba de un solo punto **encima de la barriga blanca** y se balanceaba ±20° | Barriga lateral algo más estrecha (más fiel a tu dibujo). La aleta visible cuelga del costado oscuro y su contorno se abre en el hombro, así se funde con el cuerpo. Balanceo de ±8°. La aleta lejana va **detrás** del cuerpo |
| Al subir la escalera las aletas se ven por delante | En vista de espalda las dos aletas se dibujaban sobre la espalda | Ahora van detrás del cuerpo y estiradas hacia los peldaños: solo asoman las puntas junto a la cabeza |
| La limpieza del botón se ve mal | Usaba `interact_object`: inclinado 20° y frotando hacia atrás, de espaldas al botón | Clip nuevo `wipe`: de espaldas en la escalera, frota el botón con la aleta del lado y salen destellos en la punta |
| El agua de verano se ve muy mal | `swim` era el pingüino boca arriba, como un tronco flotando. Las olas eran una franja opaca pegada sobre el mar. La salpicadura casi no se veía | Pose de nado nueva, con la cabeza fuera del agua. En el juego hay una línea de agua real: el cuerpo se oculta bajo la superficie, con un borde de espuma. El pingüino entra caminando al mar y sale del mismo modo. Espuma de orilla animada en vez de la franja. Salpicadura de gotas con contorno y onda |
| Tercera revisión: "nadan en arena cuando están entrando al agua" | La línea de agua subía con un temporizador mientras el pingüino seguía sobre la arena; además tomé la orilla en y≈897, que es arena: la orilla pintada está en y≈832–878 y es ondulada | Medí la orilla real del mar en las capas de verano, cada 32 px (`SHORELINE` en `Environment.ts`). Ahora: (1) cruza la arena mojada con el cuerpo entero; (2) solo se hunde al pasar esa línea, según la distancia recorrida dentro del agua; (3) al nadar sigue la curva de la orilla. La espuma se dibuja sobre esa misma línea y sube y baja por la arena |
| La escarcha "vuela" sobre `hOme` | Era una sola imagen de carámbanos encima de la palabra | Nieve y carámbanos calculados sobre el **contorno real de cada letra**: título, nombre y letras colgantes de la intro (`src/game/frost.ts`) |

Revisión visual: hojas de contacto de todos los atlases regenerados en [rig_preview/](rig_preview/)
y capturas 16–22 en [evidencia/](evidencia/).

## Lo que agregué o modifiqué (rutas)

| Ruta | Qué es | Por qué |
|---|---|---|
| `assets_overrides/brand/mark.png`, `favicon.png`, `apple-touch.png` | Marca del pingüino ingeniero | La pediste: amarillo y negro sutil |
| `public/assets/**/atlases/sd/*` (generado) | Atlases a media resolución (128 px por celda) | Memoria en móviles: 4 veces menos VRAM |
| `public/assets/data/*.json` (generado) | Datos reducidos de animaciones, manifiesto y escenarios | Carga más ligera |
| `docs/audit/*` | Inventario automático | Evidencia de la auditoría |
| `assets_overrides/characters/**` (38 atlases + `animations.json`) | Rig corregido: aletas, escalada, nado y el clip nuevo `wipe` | Tus observaciones de la segunda ronda |
| `tools/rig/build_characters.cjs`, `tools/rig/peek.cjs` | Generador del rig corregido y visor de fotogramas | Reproducibilidad |
| `src/game/frost.ts`, `src/components/Frost.tsx` | Escarcha por letra | Tu observación sobre la escarcha |

`public/assets` es una copia **del subconjunto de runtime** (unos 18 MiB). Quedan fuera los frames
sueltos, las tiras, los previews, las fuentes SVG y los scripts. Se regenera con `npm run assets`.

## No verificado

- Teléfono físico real (solo emulación 375×812 en el navegador integrado) e iOS Safari.
- FPS y memoria en equipos de gama baja: el panel de pruebas estaba oculto y el navegador frena su
  bucle. Hay degradación automática de partículas si los FPS bajan de 42, pero no la medí con carga real.
- Cómo suenan los efectos (están sintetizados; no pude escucharlos).
- Lectores de pantalla reales (la estructura ARIA sí está revisada).
