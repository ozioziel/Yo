# Decisiones del Home

## Lo acordado contigo (y cómo quedó)

| Tema | Decisión | Dónde |
|---|---|---|
| Proyecto | Vite + React 19 + TypeScript + Phaser 3.90.0 (la versión que probó Codex) | `package.json` |
| Contenido del Home | Solo `hOme`, tu nombre, un lema y el botón **Ver portafolio**. El lema sale de tu bio de GitHub: "Full Stack Developer · React · NestJS · Flutter · Python · AI & Cloud" | `src/pages/Home.tsx` |
| Portafolio | Ruta `/portafolio` con lo que dice tu GitHub `ozioziel`: perfil, repos y README del perfil. Datos en vivo, con una copia guardada por si la API no responde | `src/pages/Portfolio.tsx` |
| Letras | Solo la **O** forma `hOme`; las demás se desvanecen | `NameSign.ts → formTitle` |
| Pingüinos y contenido | Caminan por el suelo y las zonas libres; el texto queda arriba. Solo pasan por delante del contenido cuando el visitante los arrastra o cuando uno sube con la escalera a limpiar el botón | `Home.tsx` (`--hero-bottom`), `Brain.ts → polishButton` |
| Preferencias | Estación, día/noche y sonido se recuerdan entre visitas (`localStorage`). Por defecto: primavera de día | `src/state/prefs.ts` |
| Intro | Se repite en cada visita. Corte a los ~31 s y Home visible a los ~34 s (medido). 15 pingüinos en escritorio y 10 en móvil | `Director.ts` |
| Audio | Solo efectos (tijeras, interruptor, chillido al agarrar, golpes, letras, chispa de la O, agua, nieve, hojas, lluvia/olas ambiente muy suaves) y botón de silencio. Sin música | `src/game/sfx.ts` |
| Marca | Cabeza del ingeniero con casco sobre amarillo, y la palabra "oziel" con la **e** en amarillo. Acentos amarillo/negro, sin saturar | `assets_overrides/brand`, `global.css` |
| Interrupciones de la escalera | Si agarran a quien carga, coloca, arma o sostiene, otro pingüino toma su puesto | `Director.ts → watch()` |
| Casco (opción b) | Si agarran al ingeniero se le cae el casco. Otro lo recoge (antes se quita la ropa de estación), se lo pone y pasa a ser el ingeniero. El anterior se viste como un pingüino común. Vale en la intro y en el Home | `World.popHelmet`, `Brain.fetchHelmet`, `Director.onLostHelmet` |
| Movimiento reducido | Intro más corta (~28 s), menos partículas y sin balanceo de letras. La física se mantiene | `this.T`, `quality` |

## Decisiones técnicas propias

1. **Fondos en HTML y canvas transparente encima.** Las 4 capas traseras son `<img>` que siguen la
   misma cámara que el juego; la capa frontal (arbustos) va en Phaser. Así los pingüinos pueden pasar
   **por delante** del título y del botón. El canvas no recibe eventos: la escena escucha `pointer*`
   en `window` e ignora los clics sobre botones o enlaces, de modo que la interfaz sigue funcionando.
2. **Física propia en vez de Arcade.** El suelo es una banda con carriles de profundidad (2.5D). La
   gravedad, los rebotes en los bordes, el aterrizaje según la velocidad de llegada, los proyectiles
   (pingüinos lanzados o barridos por el visitante, letras, bolas de nieve) y los choques por carril
   están escritos a mano. Con Arcade, el orden por profundidad y los derribos en cadena se volvían
   difíciles de controlar.
3. **Máquina de estados por pingüino** con prioridades:
   arrastre > caída/impacto > reacción (choque, clima, vestirse) > tarea.
   - Las tareas son reiniciables y se cancelan con un token, así que nunca quedan oyentes huérfanos.
   - Tras cualquier interrupción se retoma la misma tarea.
4. **Accidentes con límite:**
   - Choques en el mismo carril, con espera de 3,5 s por pingüino y una separación global entre choques.
   - Derribo solo en ~18 % de los choques y como máximo uno cada 8 s, más un tropiezo espontáneo de vez en cuando.
   - Reacciones en cadena hasta una profundidad de 3, sin bucles.
   - Los pingüinos ocupados en un trabajo (escalera, casco, persecuciones) no chocan.
5. **Carga por estación.** Solo están en memoria los atlases del ingeniero y de la variante activa,
   más lo mínimo del pingüino base que necesita un ex‑ingeniero para vestirse. Al cambiar de estación
   se carga lo nuevo y se libera lo viejo cuando nadie lo usa. Uso aproximado de VRAM:
   - HD: ~200–300 MB, frente a ~460 MB si se cargara todo;
   - SD (móvil, atlases a la mitad): ~4 veces menos.
6. **Cámara.** El mundo lógico mide 1920×1080 y el suelo empieza en y = 900.
   - Pantallas anchas: se recorta el cielo.
   - Vertical: se ve una franja de 900 unidades, con cielo extendido por arriba (luna/sol añadidos) y pingüinos 18 % más grandes.
   - El nombre colgante pasa a dos líneas si no cabe en una.
7. **Corte de cuerda accesible sin botón "Saltar".** Cada cuerda tiene encima un botón transparente
   del mismo tamaño que la cuerda (44 px). Se puede usar con teclado y con lector de pantalla. No se
   ve, salvo el foco al tabular. Con el ratón aparecen las tijeras; en táctil, un indicador de tijeras
   aparece junto a la cuerda a los 3 s.
8. **Seguridad de la intro.** Si algo se atasca (por ejemplo, el visitante tiene a todos los pingüinos
   en el aire), los hitos tienen tiempos máximos. La cuerda cede sola como mucho ~40 s después de que
   se arme la escalera, y la luz siempre vuelve tras el apagón.
9. **Tipografía:** Fredoka (títulos, letras del nombre) y Nunito (texto), alojadas en el propio sitio
   (`@fontsource`, sin peticiones a Google).
10. **Calidad adaptativa:** si los FPS bajan de 42 de forma sostenida, se reduce la densidad de
    partículas. Los personajes no se tocan.

## Pendiente o a confirmar contigo

- Probar en tu teléfono (Android/iOS) y avisarme si algo va lento o se ve pequeño.
- Escuchar los efectos: ajustar el volumen o quitar alguno es un cambio de una línea en `sfx.ts`.
- Redacción del lema: ahora usa tu bio de GitHub tal cual.
- Despliegue: no publiqué nada. `npm run build` deja `dist/` listo. El servidor debe redirigir las
  rutas desconocidas a `index.html` (por `/portafolio`).
