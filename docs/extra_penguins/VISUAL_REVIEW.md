# Revisión visual de los pingüinos extra

Revisión hecha abriendo las imágenes, además de las comprobaciones automáticas de `tools/extras/validate.cjs`. Las hojas se generan con `node tools/extras/review.cjs` a partir de los atlas que carga el juego.

## Qué se revisó

| Hoja | Qué muestra | Resultado |
|---|---|---|
| [compare.png](compare.png) | Cada referencia junto a reposo, andar, saludar, celebrar, caer, aplastarse, sentarse, reír y trepar | Los nueve conservan su dibujo exacto (pelo, gafas, ropa, estampados, objetos). El reposo es el PNG tal cual. |
| [review/&lt;id&gt;.png](review/) | Las 72 acciones de cada uno: primer, medio y último fotograma | Revisadas completas las de Zorro negro y RMLIV. Las demás se generan igual y se muestrearon en compare.png y en las pruebas de poses. |
| `<id>.png` | Tira por personaje a tamaño de celda | Igual que compare.png, una por personaje. |

## Cosas comprobadas y corregidas durante la producción

- **Primer intento descartado.** Redibujar a los personajes con el rig vectorial de los pingüinos base no se parecía a las referencias: pelo superpuesto en el perfil y ropa que tapaba la forma del pingüino. Se sustituyó por marionetas del propio PNG.
- **Aletas.** Con el corte en el codo, el antebrazo salía de la cintura. Ahora cada aleta es la manga entera, cortada por su costura (medida sobre las líneas de tinta) y girando desde el hombro por detrás del torso. Al levantarla aparece una axila con contorno, sin huecos ni líneas flotantes.
- **Pelo y objetos.** El pelo de Aylen cae por delante de las mangas y no se mueve con ellas. El vaso de Tats, con su pajita sobre el pelo, se mueve entero con su aleta, sin dejar copia en el torso. El portátil de Chiquito solo se inclina un poco y sube o baja. La ramita de Shadow Frederick se mueve con suavidad para conservar su pose. El capucho de zorro queda en el hombro de Zorro negro. El antebrazo de RMLIV con el celular gira desde el codo con su propio contorno redondeado, sin rellenos ni cortes rectos; los mechones naranjas que caen sobre su hombro derecho se quedan con la cabeza y la manga sale por debajo de ellos.
- **Rellenos.** Lo que tapaban el vaso y el portátil se rellena con la tela de alrededor, fila a fila y solo dentro de la silueta original: sin manchas grises ni píxeles fuera del dibujo.
- **Ojos.** Parpadeo, dormido, risa (^ ^) y susto se dibujan sobre los ojos originales con el color de piel de alrededor. Tats no tiene gestos de ojos (gafas de sol opacas): sus acciones se mueven con el cuerpo y las aletas.
- **Dirección.** Hasta el 6 de noviembre de 2026, mirar a la derecha usaba el mismo dibujo sin reflejar y parecían caminar de espaldas. Ahora se refleja, como en los pingüinos base. De ese lado el SIS de Tats y la L de Chalquits se leen al revés, y el tatuaje de Zorro y los objetos sostenidos pasan al otro lado.

## Limitaciones conocidas

- Los personajes no se giran de perfil ni de espaldas, porque no hay dibujo de perfil ni de espalda y no se inventa: hacia la derecha se muestra su dibujo reflejado. Al caminar se balancean y dan pasos. Trepar y limpiar el botón desde la escalera se hacen de frente.
- Reflejados, el texto de la ropa (SIS, L) se lee al revés.
- La forma del torso bajo una manga levantada no existe en el dibujo original. Se resuelve con la costura de la manga como contorno del torso (que queda algo más estrecho), no con tela inventada.
