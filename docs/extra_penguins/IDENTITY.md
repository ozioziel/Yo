# Identidades: marionetas de recortes del propio dibujo

Cada pingüino extra está hecho con su propio PNG de referencia, no con un dibujo nuevo. El proceso tiene tres pasos:

1. **Recorte** (`tools/extras/cutout.cjs`): se elimina el fondo claro rellenando desde los bordes. El contorno negro cierra cada forma, así que los blancos de la ropa, los lentes y los brillos se conservan. El borde antialiasado se convierte en alfa sobre el color del contorno, sin halo. Se descartan las manchas sueltas que no tocan al personaje, como los puntitos junto a la cabeza de Shadow Frederick.
2. **Piezas** (`tools/extras/puppet.cjs` + `puppets.cjs`):
   - Cada aleta es su manga entera con el puño y la punta negra, cortada por la costura que ya está dibujada (medida sobre las líneas de tinta).
   - Gira desde el hombro y va detrás del torso, que conserva la costura como contorno: al levantarla aparece una axila real.
   - Las patas son su región naranja bajo el contorno inferior del cuerpo, prolongadas hacia arriba por detrás para que nunca se vea un corte.
   - Los objetos sostenidos se mueven con su aleta, por delante del cuerpo.
3. **Animación** (`tools/extras/poses.cjs` + `render.cjs` + `build.cjs`): las 72 acciones del pingüino base, con sus fotogramas, velocidad y bucles, traducidas a la vista frontal de las referencias. Los gestos de ojos (parpadeo, dormido, risa ^ ^, susto) se dibujan sobre los ojos originales con el color de piel de alrededor.

En reposo, cada fotograma es el PNG de referencia tal cual. Nada se refleja: mirar a la derecha usa los mismos dibujos, así el texto, el tatuaje y el objeto sostenido siguen en su lado.

| Archivo exacto | Rasgos que se conservan (son píxeles del original) | Piezas móviles |
|---|---|---|
| `Aylen.png` | Pelo castaño oscuro largo y liso con raya al medio; gafas transparentes; dos bolitas de piercing en la ceja; sudadera blanca con capucha, cordones y bolsillo. | Mangas blancas con aleta, por detrás del pelo, que cae por delante de los hombros. |
| `boris.png` | Pelo negro rizado y voluminoso; gafas rectangulares negras; jersey de camuflaje. | Mangas de camuflaje completas. |
| `Chalquits.png` | Pelo corto oscuro peinado de lado; gafas negras estrechas; chaqueta universitaria granate con mangas crema, cremallera, ribetes, la gran L y el bordado. | Mangas crema con puños a rayas. |
| `Chiquito.png` | Pelo negro corto con puntas barridas; mejillas rosadas; sudadera negra con capucha y cremallera; portátil plateado con la manzana. | Portátil y las dos aletas que lo sostienen, como un solo conjunto: se inclina poco y sube o baja. |
| `oror.png` | Pelo negro corto despeinado; gafas redondas; jersey beige de pico sobre camisa blanca con puños blancos. | Mangas beige con el puño blanco. |
| `Shadow Frederick.png` | Pelo negro con mechones; cara y vientre marrón cálido; gafas; camisa de cuadros abierta sobre camiseta gris; auriculares al cuello; ramita en la aleta. | Aleta levantada con la ramita (movimiento suave: es su pose característica) y manga de cuadros derecha. |
| `Tats.png` | Pelo negro ondulado; gafas de sol de ojo de gato rosas; sudadera negra con SIS morado y cordones; vaso rosa con pajita. | Vaso, aleta que lo sostiene y manga, girando desde el hombro; manga negra derecha. Sin gestos de ojos: lleva gafas opacas. |
| `zorro negro.png` | Pelo oscuro con mechones abiertos; tatuaje en la mejilla; chaqueta naranja y crema con cremallera, bolsillos y puños negros; capucha con cara de zorro. | Mangas naranjas con manopla negra; el capucho de zorro y los bolsillos quedan en el torso. |
