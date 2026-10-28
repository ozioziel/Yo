# Informe de producción · Home de Oziel

Fecha de entrega: 25 de octubre de 2026 · Hora local de Bolivia.

## Resultado

Biblioteca gráfica real producida en esta carpeta. La entrega incluye personajes articulados, utilería, ocho ambientes por capas, partículas, controles, animaciones, metadatos y ejemplos comprobados de Phaser. La página React/Phaser final queda para el integrador, conforme al encargo.

| Recuento | Cantidad real |
|---|---:|
| PNG inventariados, incluyendo referencias y previews | 2294 |
| Atlases PNG + JSON | 47 |
| Atlases de personajes | 38 |
| Clips de personajes, sumando variantes | 246 |
| Fotogramas de personajes exportados individualmente | 1718 |
| Tiras horizontales de personajes | 246 |
| Clips de efectos | 9 |
| Escenarios estación × día/noche | 8 |
| Capas de escenario 1920×1080 | 40 |
| Props clasificados en el manifiesto | 57 |
| Partículas/fotogramas de efecto ambiental | 58 |
| Imágenes UI | 25 |
| PNG de referencia/revisión | 63 |
| GIF de revisión | 43 |
| SVG editables | 970 |
| Tamaño aproximado de carpeta | 80.5 MiB |

Los recuentos describen distintos formatos de los mismos recursos: los frames individuales, tiras y atlases no son tres animaciones diferentes. Los 1718 fotogramas incluyen variantes de vestuario; no se presentan como 1718 acciones únicas. Los PNG de partículas incluyen fotogramas de efectos, sin contar sus atlases otra vez dentro de esa categoría.

## Cobertura

**71/71 acciones nominales (100%)** del inventario original presentes en `penguin`. Esta cifra mide cobertura del inventario gráfico, no porcentaje de implementación del sitio.

| Variante | Clips |
|---|---:|
| penguin | 71 |
| engineer | 65 |
| penguin_winter | 55 |
| penguin_autumn | 55 |

El ingeniero conserva solo el casco. Sus seis omisiones son intencionales: `put_scarf`, `put_boots`, `open_umbrella`, `walk_umbrella`, `hide_rain` y `remove_accessories`. Las variantes de invierno y otoño contienen las acciones base, diarias, narrativas y de clima necesarias para continuar sin perder outfit; cada una añade su grupo estacional. Primavera y verano usan el común y el ingeniero, sin ropa especial.

Faltantes nominales: Ninguno del inventario nominal de 71 acciones.

## Pruebas y correcciones

- Existencia y dimensiones de todos los PNG del manifiesto comprobadas.
- Todos los frames de personaje son RGBA 256×256; cada tira tiene altura256 y ancho múltiplo de256.
- Atlas TexturePacker Hash: rectángulos, tamaños, sourceSize, pivotes, nombres y dependencias comprobados; máximo2048² en personajes, hasta ocho columnas.
- Cada frame del atlas se comparó con el PNG individual y con la tira. Alfa exacto; se tolera como máximo1/255 de redondeo RGB al componer bordes suavizados.
- Cada clip contiene movimiento real y más de un fotograma único; no se aceptan secuencias enteramente estáticas. Las simetrías y pausas dentro de un gesto sí pueden repetir alguna pose.
- Continuidad píxel a píxel entre el último frame de los tres impactos y el primero de `get_up`, en las cuatro variantes.
- Revisión visual de hojas de modelo, caídas/impactos, estados de miedo, personajes vestidos, objetos e interfaz y ocho escenarios. GIF y visor local disponibles para revisión adicional.
- Se corrigieron ojos inicialmente poco expresivos, apertura de paraguas estática, desbordamiento del paraguas, pies y utilería recortados y el salto entre impacto y recuperación.
- Los únicos bordes intencionales de efectos son las olas repetibles. Las capas de escenario ocupan su lienzo por diseño.
- Phaser **3.90.0** en Chromium: 47 atlases cargados; 246 animaciones de personajes registradas. Arrastre real de ratón, caída, recuperación, cambio de outfit y excepción del ingeniero comprobados. Persistencia de lluvia al alternar día/noche: True.
- Los resultados adicionales de utilería y de consola del navegador están en `integration/test/browser_result.json`; las pruebas de estados están en `integration/runtime_test.mjs`.

Errores estructurales pendientes: **0**.

Ninguno.

Avisos de bordes de personaje: **0**.

Ninguna en los fotogramas de personaje.

## Decisiones y recursos adicionales

1. Rig SVG determinista para mantener identidad y articulación en todos los clips. Fuentes editables y scripts incluidos, sin producir una mascota distinta por fotograma.
2. Variantes completas de invierno y otoño para no depender de accesorios superpuestos sin probar. Casco integrado en todas las poses del ingeniero.
3. Anclajes transformados por frame para manos, cuello, casco y suelo; utilería temporal separada para montar la escalera y los juegos.
4. Paraguas cerrado físico temporal al agarrar/derribar al común de otoño; retirada tras recuperación. Prop independiente abierto/cerrado y botas/bufanda/casco para preparación y utilería.
5. Bases de escalera, soporte y sombra de cuerda, fragmento cortado, sombra de contacto, escarcha modular y estado derretido.
6. Tijeras de cursor32px con punto activo(27,15), indicador táctil96px y estados de foco para controles.
7. Árboles y vegetación sueltos para recomposición responsive. Mariposa articulada, ondas, salpicaduras y olas con ciclos reales.
8. Visor HTML local de todos los clips; catálogos exhaustivos y diagnósticos de bucles, además de las hojas de contacto.
9. Ejemplos de control de estados resistentes a interrupciones, con pruebas Node y Phaser fijado3.90.0. Se incluye la licencia del motor usado en las pruebas.

## Límites concretos y trabajo del integrador

- La referencia se reinterpretó en SVG. Las vistas frontal/trasera y nuevas expresiones son diseño derivado; no se afirma calco exacto ni animación tradicional a mano.
- Las acciones usan un rig con deformación y poses muestreadas. Los cambios de vista en `fall_spin` son discretos; evaluar su cadencia al tamaño y FPS finales. La revisión visual no sustituye la dirección artística del Home integrado.
- El montaje espacial de la intro, rutas de personajes, posiciones de objetos, alineación a peldaños y progreso de construcciones requieren los hooks y anclajes documentados. Las imágenes de escenario no contienen una intro ya renderizada.
- La lógica definitiva de actividades aleatorias, navegación y contenido personal corresponde a la página. Los módulos de integración se pueden reutilizar, pero la prueba de QA no es el producto final.
- Las pruebas comprueban un arrastre real en navegador y la API de puntero; no se ha probado en un teléfono físico. Ajustar áreas táctiles a44px CSS y probar orientación vertical y zoom.
- El visor HTML repite las acciones para revisarlas aunque su configuración de producción sea de una sola ejecución.
- El cargador de la prueba carga toda la biblioteca para validar claves. La aplicación debe decidir carga por estación y presupuesto de memoria. No se realizó una certificación de rendimiento en móviles de gama baja.
- No se han inventado biografía, redes sociales, enlaces ni contenido personal. Tampoco se ha creado un botón de salto de intro.

No hay decisiones pendientes que impidan utilizar los recursos. El usuario puede revisar la interpretación del personaje y ajustar dirección artística; Claude deberá decidir composición final y coreografía dentro de las reglas del brief.

## Archivos de entrada para Claude

1. `documento.md` — guía completa con restricciones, estados, carga y ejemplos.
2. `asset_manifest.json` — índice de cada PNG real.
3. `animations.json` — secuencias y configuración exacta.
4. `resources_catalog.md` y `animations_catalog.md` — tablas humanas completas.
5. `integration/integration_notes.md` y `integration/oziel_runtime.mjs` — código verificado y puntos de montaje.
6. `previews/animation_review.html`, `previews/environments_all_eight.png` y hojas/GIF — revisión visual.
7. `qa_report.json` y `integration/test/browser_result.json` — evidencia reproducible de las pruebas.
