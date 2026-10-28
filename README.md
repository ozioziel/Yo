# hOme · Oziel Rodman Ramos Torrez

Pestaña **Home** del portafolio: un pequeño mundo 2D de pingüinos (React + Phaser 3.90).
Una intro cuenta cómo el ingeniero y sus amigos bajan el nombre colgado; la **O de Oziel**
se convierte en el título `hOme` y los pingüinos se quedan viviendo en la página.

- Reporte de auditoría de los recursos de Codex: [docs/AUDITORIA.md](docs/AUDITORIA.md)
- Decisiones de diseño y técnicas: [docs/DECISIONES.md](docs/DECISIONES.md)
- Verificación de los 16 puntos del encargo y capturas: [docs/VERIFICACION.md](docs/VERIFICACION.md), [docs/evidencia/](docs/evidencia/)
- Inventario automático (2294 archivos): [docs/audit/audit_summary.md](docs/audit/audit_summary.md)

## Ejecutar

Requisitos: Node 20+ (probado con Node 24) y Python 3 con Pillow (solo para generar los atlases de móvil).

```bash
npm install
```

```bash
npm run dev
```

Abre http://localhost:5173. `npm run dev` copia antes los recursos necesarios a `public/assets` si aún no existen.

```bash
npm run build
```

Genera `dist/` (sitio estático). Para servirlo hace falta que el servidor devuelva `index.html`
en rutas desconocidas (`/portafolio`), como en cualquier SPA.

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run assets` | Vuelve a copiar el subconjunto de runtime desde `Recursos/assets_home_oziel` y regenera los atlases SD |
| `npm run audit:assets` | Re-ejecuta la auditoría automática de toda la biblioteca de Codex |
| `npm run rig` | Regenera los personajes con el rig corregido (`tools/rig/`) y vuelve a sincronizar |
| `npm run typecheck` | Comprueba los tipos |
| `node scripts/github-snapshot.mjs` | Actualiza la copia de respaldo del GitHub usada por /portafolio |

Parámetros de prueba (no visibles para el visitante): `?hd=1` / `?sd=1` fuerzan la calidad de
texturas, `?reduced=1` simula movimiento reducido y `?loop=timeout` mantiene el bucle de Phaser
vivo en pestañas ocultas (pruebas automatizadas).

## Estructura

```text
Recursos/assets_home_oziel/   biblioteca original de Codex (no se modifica)
assets_overrides/             recursos propios: marca y personajes del rig corregido (characters/)
public/assets/                copia de runtime generada por scripts/sync-assets.mjs (no editar)
scripts/                      sincronización de assets y snapshot de GitHub
tools/                        auditoría (Python), atlases SD, marca
src/
  pages/Home.tsx              contenido semántico, controles, puente con el juego
  pages/Portfolio.tsx         /portafolio: perfil, repos y README de GitHub
  components/                 Backdrop (fondos HTML), GameCanvas, controles accesibles
  state/prefs.ts              estación, día/noche y sonido recordados (localStorage)
  game/
    bridge.ts                 único canal React ↔ Phaser
    layout.ts                 cámara y mundo lógico 1920×1080 (suelo en y=900)
    assets.ts                 carga por estación, registro y liberación de atlases
    sfx.ts                    efectos de sonido sintetizados (sin música, sin archivos)
    scenes/                   BootScene (carga) y WorldScene (mundo + entrada)
    world/
      Penguin.ts              entidad + máquina de estados (tareas, reacciones, arrastre, caída)
      World.ts                orquestador: colisiones, casco del ingeniero, clima
      Director.ts             coreografía de la intro con roles reasignables
      Brain.ts                vida autónoma y actividades por estación
      NameSign.ts             nombre colgante, cuerdas, corte, letras físicas, O → hOme
      Ladder.ts               escalera (cargada, tumbada, de pie)
      Environment.ts          capa frontal, partículas, props y efectos por estación
```

## Cómo funciona (resumen)

**Capas.** Los fondos (cielo, lejanía, plano medio, suelo) son imágenes HTML debajo del contenido;
el canvas de Phaser es transparente y va **encima** del contenido, así los pingüinos pasan por delante
del texto. El canvas no recibe eventos: la escena escucha `pointer*` en `window` e ignora los que
caen sobre botones/enlaces, de modo que la interfaz HTML sigue funcionando normal.

**Estados de un pingüino.** `normal` (ejecuta una tarea reiniciable) → `reaction` (choque, clima,
vestirse) → `grabbed` → `airborne` (caída `fall_normal|fall_spin|fall_flap` elegida al azar en cada
soltada) → `down` (`impact_light|medium|heavy` según la velocidad de llegada, luego `get_up`) →
vuelve a la **misma tarea** que tenía. Cada rutina lleva un token: al interrumpirse, sus esperas se
cancelan y no quedan oyentes huérfanos.

**Intro.** Hitos como banderas + roles (cargador, colocador, ensambladores, sostenedores) que el
director reasigna si alguien es arrastrado. El ingeniero es quien lleva el casco: si lo agarran, el
casco cae, otro pingüino lo recoge, se quita su ropa de estación y pasa a ser el ingeniero (el
anterior se viste como los demás). Cortar **cualquier** cuerda en cualquier momento (clic, toque o
teclado) ejecuta el mismo final, una sola vez.

**Eventos React ↔ Phaser** (`src/game/bridge.ts`): `season`, `night`, `muted`, `cutRope` (de React
al juego) y `camera`, `phase`, `ropes`, `progress` (del juego a React). React expone además dos
funciones de medida: dónde está la "O" del título y dónde está el botón de portafolio.

## Mantenimiento

- Para cambiar recursos, edita la biblioteca de Codex o añade archivos en `assets_overrides/` y
  ejecuta `npm run assets`. No edites `public/assets` a mano.
- Textos del Home: `src/pages/Home.tsx`. El lema viene de la bio de GitHub de Oziel.
- Ritmos de la intro: `Director.ts` (`planArrivals`, esperas con `this.T`).
- Pesos de actividades: `Brain.ts → catalog()`.
"# Yo" 
