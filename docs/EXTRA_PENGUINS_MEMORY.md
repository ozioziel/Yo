# Presupuesto de memoria de los pingüinos extra

Los extras son marionetas de recortes de sus PNG (ver [extra_penguins/IDENTITY.md](extra_penguins/IDENTITY.md)). Cada uno tiene un único traje con las 72 acciones del pingüino base. Sus atlas se generan con `tools/extras/build.cjs`:

- Su cuerpo de pingüino mide lo mismo que el de un pingüino base (`bodyScale` 1.3); con el pelo y las aletas levantadas necesitan celdas lógicas de 320 (pies a 0,9 de la altura, como en las de 256), dibujadas a 240 px (`textureScale` 0.75). El juego aplica la escala inversa.
- Fotogramas recortados a su silueta, empaquetados por grupos de acciones. Los fotogramas idénticos comparten rectángulo.
- Sin páginas para la dirección derecha: al mirar a la derecha el juego refleja los mismos fotogramas (`flipX`), como con los pingüinos base.
- Móviles: `scripts/sync-assets.mjs` publica también la mitad exacta en `atlases/sd/` (`textureScale` efectivo 0.375). Los rectángulos son pares, así que la reducción no redondea.

## Lo que se carga en el juego

Solo se piden los grupos que un extra puede usar después de la intro: `base`, `tasks` (escalera y celebración), `daily`, `weather` y la estación activa (`extraAtlases` en `src/game/assets.ts`). El grupo `intro`, coreografía exclusiva de la intro, nunca se carga. Al cambiar de estación se carga el grupo nuevo de los extras presentes y se libera el anterior, por el mismo mecanismo que usan los originales.

Las cifras exactas por personaje (memoria de textura sin comprimir, escritorio / móvil) las calcula y publica `node tools/extras/validate.cjs` en [extra_penguins/COVERAGE.md](extra_penguins/COVERAGE.md). Con la generación actual van de 27 a 37 MiB por personaje en escritorio y de 7 a 9 MiB en móvil. Los nueve a la vez suman unos 280 MiB y unos 70 MiB respectivamente.

Las apariciones son una por nombre, como máximo nueve, y comparten texturas con el resto de su identidad. Una identidad no se vuelve a cargar mientras está en escena.

## Versiones para móvil en el despliegue

Las mitades `atlases/sd/` de todos los personajes (originales y extras) las genera `scripts/sync-assets.mjs` con `sharp`, sin Python: la imagen Docker (`node:22-alpine`) no lo tiene. Antes se generaban con `tools/make_sd_atlases.py`, que allí no podía ejecutarse. El celular pedía esas mitades y nginx devolvía `index.html` en su lugar, así que Phaser dibujaba cuadrados verdes (textura ausente). Ahora `nginx.conf` responde 404 para cualquier recurso de `/assets/` que falte, en vez de devolver HTML.
