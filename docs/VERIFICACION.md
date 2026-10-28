# Verificación (sección 10 del encargo)

Pruebas hechas en el navegador integrado con el servidor de desarrollo, en 1280×720, 800×450 y
375×812 (emulación de móvil). Las capturas están en [evidencia/](evidencia/). Las pruebas
automatizadas se hicieron dentro de la página, inyectando agarres y soltadas sobre los pingüinos
reales y registrando sus estados.

| # | Requisito | Estado | Evidencia |
|---|---|---|---|
| 1 | Intro completa sin intervención | ✅ | Hitos medidos (segundos desde el inicio): mira 4.5 · apagón 4.8 · luz 7.1 · reunidos 15.4 · escalera llega 18.7 · de pie 22.2 · armada 25.3 · **corte 31.4** · reveal 34.1 · Home 35.8. Capturas 01–04 |
| 2 | Corte temprano con una cuerda; sin Skip; sin doble caída | ✅ | Clic a los ~1 s y segundo clic sobre otra cuerda: un solo corte (`isCut` idempotente). Los rezagados entran caminando. Captura 05 |
| 3 | Arrastre en intro y Home; ojos grandes; en el aire | ✅ | `scared → dragged` en todos los intentos. Captura 13 (por delante del título) |
| 4 | Tres caídas aleatorias, impacto según altura, levantarse y retomar | ✅ | 6 lanzamientos: `fall_flap`, `fall_spin`, `fall_normal`. Impactos `light` (60 px), `medium` (360 px) y `heavy` (635 px, 1832 px/s). Tarea retomada: wander→wander, greet→greet, nap→nap |
| 5 | Choques y reacciones en cadena sin atascos | ✅ | Pingüinos lanzados que derriban a otros (`projectileHit`, profundidad ≤ 3). Soak de 2 min: 0 errores, 0 pingüinos fuera de pantalla |
| 6 | Actividades aleatorias comunes y estacionales | ✅ | Soak por estación: invierno 15 tareas, otoño 13, verano 17, primavera 14 tareas distintas |
| 7 | Invierno: nieve, letras con escarcha, bufanda solo para comunes, actividades | ✅ | Captura 07; muñeco de nieve, bolas, hielo y tiritar registrados |
| 8 | Otoño: hojas, lluvia **siempre**, charcos, botas/paraguas | ✅ | Captura 08. El emisor de lluvia sigue activo al cambiar día/noche (la noche no lo reinicia). Charcos y hojas registrados |
| 9 | Primavera: flores, pétalos, sin outfit | ✅ | Captura 06; mariposas, oler flores, flor que crece y sentarse en el pasto |
| 10 | Verano: playa, mar, protector, agua | ✅ | Captura 09; protector, nadar, castillo y pelota registrados |
| 11 | Día/noche × 4 sin reiniciar pingüinos | ✅ | Capturas 10 y 12; cambio con fundido sin recrear sprites |
| 12 | Ingeniero solo con casco | ✅ | Verificado en los 65 clips (auditoría) y en pantalla en las 4 estaciones. Al intercambiar el casco en invierno, quien lo recoge se quita la bufanda **antes** |
| 13 | Móvil/touch | ⚠️ parcial | Emulación 375×812: nombre en 2 líneas, escalera, reveal y controles compactos (capturas 11–12). Falta un **teléfono físico** |
| 14 | Continuidad visual (sin saltos de escala o pivote) | ✅ | Corregido el 87 % del rig aéreo: altura y posición iguales ±2 px entre `scared` y `dragged`. Impacto → get_up continuo (verificado por Codex y en pantalla) |
| 15 | Rendimiento | ⚠️ no medido con carga real | El panel de pruebas estaba oculto y el navegador frena su bucle. Memoria por estación verificada (texturas de invierno liberadas al pasar a otoño). Degradación automática de partículas implementada |
| 16 | Contenido: nombre correcto, O → hOme, legibilidad, accesibilidad | ✅ | La O real del nombre vuela al título y se funde con la O del HTML. Tab → cuerda (foco visible, captura 14) → Enter corta. Controles con roles `radiogroup`/`switch` |

Segunda ronda (correcciones de Oziel):

| Corrección | Estado | Evidencia |
|---|---|---|
| Aletas unidas al cuerpo al caminar | ✅ | Capturas 18 y 22; hojas en `rig_preview/` |
| Al escalar, aletas detrás del cuerpo | ✅ | Captura 21; `rig_preview/*_intro_01_contact.png` |
| Limpieza del botón (`wipe`) | ✅ | Captura 19. Se ejecutó sola en la prueba de resistencia |
| Agua de verano: nado, línea de agua, espuma y salpicaduras | ✅ | Captura 20. Nado, entrada y salida registrados sin errores |
| Entrar al mar sin "nadar en la arena" | ✅ | Captura 23 en cuatro fases: arena mojada (cuerpo entero), entrando, nadando y saliendo; todas dentro del mar. Captura 24, vista general |
| Escarcha sobre cada letra (título, nombre y letras de la intro) | ✅ | Capturas 16–17. Se derrite al salir del invierno |
| Prueba de resistencia de 40 s en verano e invierno | ✅ | 0 errores. Corregido además un error latente: un brote de flor podía actualizarse tras cambiar de estación |

Otras comprobaciones:

- `npm run build` sin errores; `tsc` sin errores.
- Test de Codex `runtime_test.mjs`: PASS (solo lectura).
- Intercambio del casco en plena escalera: el nuevo ingeniero empieza a subir desde abajo y corta
  la cuerda (`cutBy = climber`). El anterior vuelve a mirar (bug corregido durante las pruebas).
- Cargador soltado a mitad de camino: la escalera cae tumbada, otro pingüino la recoge y se arma igual.
- Movimiento reducido (`?reduced=1`): Home a los ~28 s.
- Texturas SD (`?sd=1`): atlases de 1024 px que se ven del tamaño correcto.
