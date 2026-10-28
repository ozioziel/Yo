# Integración de recursos Oziel en Phaser 3

El módulo `oziel_runtime.mjs` contiene ejemplos ejecutables y reutilizables para Phaser **3.90.0**. No implementa la página React ni decide el contenido personal del portafolio. La prueba `test/index.html` es una escena de control de calidad, no el Home final.

## Contrato de datos

`asset_manifest.json` ofrece `assets[]`; un atlas usa `{id,path,jsonPath,type:"atlas"}`. `animations.json` ofrece `characters[variant][clip]`. Las variantes exactas son `penguin`, `engineer`, `penguin_winter`, `penguin_autumn`. Cada clip enumera sus frames reales, atlas, FPS, repetición y origen. `effects` reúne los efectos ambientales/de intro. `metadata/environments.json` contiene `seasons[season][day|night].layers`, una lista de IDs del manifiesto.

`preloadAssets()` evita cargar los miles de PNG individuales y strips: carga atlases, props, partículas, UI y fondos. Los PNG individuales y strips permanecen disponibles para otros motores y edición. `registerAnimations()` comprueba que cada frame existe realmente; los nombres finales son `penguin:walk`, `engineer:fall_spin`, etc. `registerEffectAnimations()` usa nombres `effect:summer_wave`, `effect:spring_butterfly`, etc.

La librería conserva los mismos sprites durante todo el ciclo de vida. Cambiar estación solo cambia el atlas/clip visual del sprite existente; no destruye el personaje, no reinicia la escena y no mueve su cuerpo físico.

## Arranque mínimo

El siguiente código se ejecuta desde una página servida por HTTP. Se obtienen los JSON antes de crear Phaser, porque `preload()` no espera automáticamente promesas de `fetch()`.

```js
import {
  preloadAssets, registerAnimations, registerEffectAnimations,
  PenguinController, EnvironmentController, connectPenguinCollisions
} from './assets_home_oziel/integration/oziel_runtime.mjs';

const base = './assets_home_oziel';
const [manifest, animations, environments] = await Promise.all([
  fetch(`${base}/asset_manifest.json`).then(r => r.json()),
  fetch(`${base}/animations.json`).then(r => r.json()),
  fetch(`${base}/metadata/environments.json`).then(r => r.json())
]);

class WorldScene extends Phaser.Scene {
  preload() { preloadAssets(this, manifest, base); }
  create() {
    registerAnimations(this, animations);
    registerEffectAnimations(this, animations.effects);
    this.environment = new EnvironmentController(this, manifest, environments);
    this.environment.set(2, false); // Primavera, día. Solo habilitar selector en Home.

    const floor = this.add.rectangle(960, 925, 1920, 50, 0).setVisible(false);
    this.physics.add.existing(floor, true); // Cara superior y=900.
    const def = animations.characters.penguin.idle;
    const sprite = this.physics.add.sprite(700, 900, def.atlasKey, def.frames[0])
      .setOrigin(0.5, 0.9).setDepth(40).setScale(0.8);
    const controller = new PenguinController(this, sprite, animations, {propFloor:floor});
    this.controllers = [controller];
    this.penguins = this.physics.add.group();
    this.penguins.add(sprite);
    this.physics.add.collider(this.penguins, floor, object => object.ozielController?.landed());
    connectPenguinCollisions(this, this.penguins);
    controller.setTask('walk', {velocityX: -50, flipX: false}); // Modelo base mira a izquierda.
    this.events.once('shutdown', () => {
      this.controllers.forEach(p => p.destroy());
      this.environment.destroy();
    });
  }
  update() { this.controllers?.forEach(p => p.update()); }
}

new Phaser.Game({
  type: Phaser.AUTO, width: 1920, height: 1080,
  physics: {default:'arcade', arcade:{gravity:{y:900}}},
  scale: {mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH},
  input: {activePointers:3}, scene: WorldScene
});
```

Para carga manual de un atlas y un clip, los nombres reales del primer atlas son:

```js
// preload()
this.load.atlas('penguin_base_00',
  'assets_home_oziel/characters/penguin/atlases/penguin_base_00.png',
  'assets_home_oziel/characters/penguin/atlases/penguin_base_00.json');
// create()
this.anims.create({
  key:'walk_manual',
  frames:Array.from({length:8}, (_,i) => ({
    key:'penguin_base_00', frame:`walk_${String(i).padStart(3,'0')}`
  })),
  frameRate:10, repeat:-1
});
const p = this.add.sprite(600,900,'penguin_base_00','walk_000')
  .setOrigin(0.5,0.9).setDepth(40).setScale(0.8).setFlipX(false);
p.play('walk_manual');
```

Para velocidades definitivas usar el valor de `animations.json` en lugar del FPS ilustrativo del ejemplo manual.

## Física, arrastre e interrupciones

Cada PNG ocupa 256×256. El origen apoyado es `[0.5,0.9]`, pies próximos a y230. El origen aéreo es `[0.5,0.5]`. El controlador mantiene la posición mundial del rectángulo del frame al cambiar de origen y corrige el desfase del puntero para evitar un salto durante el arrastre. El collider recomendado inicial es `body.setSize(108,164,false).setOffset(74,66)` en unidades de celda: es una aproximación conservadora del torso. No pretende seguir cada aleta, casco o giro pintado. Phaser Arcade usa rectángulos/círculos sin rotación física; los tumbos del clip son visuales.

El controlador escucha los eventos reales `dragstart`, `drag`, `dragend` del Sprite. En drag desactiva el cuerpo, mira de frente, reproduce `scared` y después `dragged`. Al soltar reactiva el cuerpo mediante `body.reset`, aplica gravedad y elige aleatoriamente uno de `fall_normal`, `fall_spin`, `fall_flap` en cada caída. No desplaza el mundo dentro de un PNG.

`update()` acumula la mayor velocidad vertical antes del choque. `landed()` usa ese valor porque Arcade puede anular la velocidad al resolver una colisión. Los umbrales iniciales son <330 px/s leve, <650 medio y ≥650 fuerte, adaptables a la escala/gravedad del proyecto. La secuencia finita es `impact_* → get_up → actividad previa`. Un token de secuencia cancela callbacks antiguos si se agarra al personaje durante la recuperación. Una tarea narrativa que llegue mientras el personaje está sostenido o cayendo se recuerda sin quitarle el control al visitante.

`connectPenguinCollisions()` captura velocidad relativa en el callback de proceso, antes de resolver el choque. Tiene enfriamiento de 650ms por personaje, golpes pequeños y 34% de derribo cuando la velocidad relativa supera 90px/s. Una reacción en cadena puede producirse por los cuerpos activos de otros personajes; no se fuerza que todo contacto derribe siempre.

`setTask()` conserva la actividad y movimiento. Los clips finitos de una tarea quedan en el último frame hasta que la lógica de la escena elija la siguiente acción. Para una secuencia finita propia, usar `await controller.once('greet')`, comprobar su resultado booleano y luego retomar la tarea; no escuchar `animationcomplete` indiscriminadamente porque el evento podría pertenecer a otro clip. Los loops `repeat:-1` no producen final de animación; no usar `once()` con ellos.

## Estaciones, accesorios y día/noche

Los cuatro niveles son exactamente 0 invierno, 1 otoño, 2 primavera, 3 verano. El selector se habilita cuando el nombre ya cayó y el Home está activo. Desde el manejador del control:

```js
async function setWeather(level) {
  if (!homeVisible) return;
  environment.set(level, environment.night);
  await Promise.all(controllers.map(p => p.changeWeather(level)));
}
function toggleNight() {
  if (homeVisible) environment.set(environment.level, !environment.night);
}
```

La reacción es `notice_weather → weather_confused → remove_accessories` si sale de un outfit, cambio de variante, `put_scarf` o `put_boots → open_umbrella`, `resume_after_weather`, actividad recordada. En verano se usa `apply_sunscreen`; la crema es una acción, no vestimenta. Una estación solicitada durante drag/caída se aplaza hasta recuperarse. Si el usuario agarra al personaje durante un cambio, se vuelve a encolar el destino pendiente.

El ingeniero siempre usa `engineer`: el casco está integrado y sigue los giros del rig. Nunca recibe bufanda, botas o paraguas. Para actividades cotidianas/estacionales seleccionar un clip que exista en la variante actual; si la tarea anterior no existe en la variante nueva, el controlador vuelve a `idle` y la lógica de rutinas puede elegir otra actividad de la estación.

Otoño tiene lluvia continua y hojas más espaciadas. El emisor de lluvia se conserva al cambiar día/noche en otoño. Las ocho composiciones se leen de metadata y hacen un fundido de 400ms; el apagón narrativo usa otra capa independiente. Invierno emite nieve, primavera pétalos, verano utiliza `effect:summer_wave` repetido horizontalmente. No aplicar un filtro negro global sobre los personajes en la noche: las capas nocturnas ya tienen su propia paleta legible.

Las variantes otoñales no sostienen el paraguas durante `dragged`, caídas, impactos y recuperación; retienen las botas. El controlador crea un prop físico `umbrella_closed` al iniciar un drag/derribo otoñal, con posición calculada desde `handNear`, y lo elimina al recuperarse o cambiar de estación. La actividad de pie restaura entonces el paraguas del rig sin duplicarlo. Pasar `{propFloor:floor}` al constructor hace que el prop rebote sobre el mismo suelo; sin ello usa el límite del mundo. Los tamaños/gravedad del prop pueden adaptarse con `umbrellaScale`. No se crea para el ingeniero.

Profundidades originales de ambiente: sky0, far10, mid20, ground30, personajes40, foreground60; lluvia85. En una escena con otros elementos, reservar rangos coherentes y recordar que `setDepth()` no depende del orden de carga.

## Nombre, cuerdas y corte inmediato

`createEditableName()` crea una letra Text independiente por cada carácter del nombre, sin bitmap del texto entero. Reproducir ese contenido en HTML accesible, porque canvas Text por sí mismo no es accesible para lectores de pantalla.

`makeInteractiveRopes()` debe ejecutarse antes de `startIntroTimeline()`. La zona interactiva de cuerda se ensancha a 44 unidades; en pantallas pequeñas asegurar **44 píxeles CSS** mediante una zona adicional si se usa Scale.FIT. El cursor PNG usa hotspot real `(27,15)`; también existe indicador gráfico para touch. `dropAll()` es idempotente: un click/tap sobre cualquier cuerda activa gravedad en todas las letras, una sola vez. No hay botón Saltar intro.

```js
import {
  createEditableName, makeInteractiveRopes, createBlackout,
  startIntroTimeline, formHomeFromLetters
} from './assets_home_oziel/integration/oziel_runtime.mjs';

const letters = createEditableName(this);
const ropeImages = [720,1200].map(x => this.add.image(x,0,'rope_intact').setOrigin(0.5,0).setDepth(55));
const blackout = createBlackout(this);
let timeline;
const ropeControl = makeInteractiveRopes(this, ropeImages, letters, {
  cursorURL:'./assets_home_oziel/ui/scissors_cursor.png',
  touchTexture:'scissors_touch',
  onCut: () => {
    timeline?.cancel();
    blackout.reset(); // Corte inmediato también durante apagón.
    ropeImages.forEach(rope => rope.setTexture('rope_cut_top'));
    controllers.forEach(p => p.setTask('react_name_fall'));
    // Añadir collider de letters contra el suelo para que el rebote sea real.
    this.physics.add.collider(letters, floor);
    this.time.delayedCall(1600, () => formHomeFromLetters(this, letters, {
      onReady: () => { homeVisible = true; /* habilitar controles y rutinas */ }
    }));
  }
});
timeline = startIntroTimeline(this, {
  engineer, helpers, ropes:ropeControl, blackout,
  hooks: {
    enter: () => {/* colocar ingeniero al borde izquierdo */},
    stopAtSwitch: () => {/* fijar posición junto al interruptor */},
    switch: () => {/* cambiar switch_on/off en el frame de contacto */},
    arrive: () => {/* colocar ayudantes en accesos sin destruir sprites */},
    carryLadder: () => {/* alinear ladder_segment al ancla de aleta */},
    placeLadder: () => {/* dejar escalera apoyada en el suelo */},
    assembleLadder: () => {/* ensamblar módulos con prop ladder_complete */},
    climb: () => {/* mover hacia arriba y alinear manos/patas a peldaños */},
    reachRope: () => {/* detener ascenso junto a cuerda */},
    cutTool: () => {/* prop temporal de tijeras; nunca equipamiento fijo */}
  }
});
```

Los hooks vacíos del ejemplo marcan decisiones de layout que debe implementar Claude, no resultados ya construidos. El módulo solo coordina los clips reales y los tiempos; no inventa geometría de escalera ni reemplaza el layout responsive. Las acciones llegan a 16.6s; el corte por visitante funciona desde el primer frame y cancela el resto del calendario. `formHomeFromLetters()` reutiliza el Text **O** real del nombre y anima las otras letras `h`/`me` editables. Todos los pingüinos permanecen para el Home.

Para sincronizar props con aletas y eventos usar `animationupdate` y `def.frameAnchors[index]`; al anclar sobre un sprite reflejado, convertir x en `256-x`. La transformación general desde celda es `worldX=sprite.x+(anchorX-256*originX)*scaleX`, `worldY=sprite.y+(anchorY-256*originY)*scaleY`. Si se rota el GameObject, rotar ese vector local antes de sumarlo; los frames de caída ya contienen giro pintado y sus anchors ya lo incorporan. No aplicar ambos giros.

## Responsive y rutina autónoma

El ejemplo de prueba usa 1920×1080 con Scale.FIT. Para móvil estrecho, mantener el mismo mundo físico y reencuadrar/recolocar personajes y props mediante posiciones normalizadas; usar las capas individuales para conservar cielo y primer plano sin reducir todo a tamaños ilegibles. El área segura de cada composición está en metadata. Ajustar las zonas táctiles por píxeles CSS y limitar la cantidad de partículas según el dispositivo. Los PNG de escenario no contienen tipografía.

La rutina aleatoria final pertenece a la aplicación: elegir entre clips presentes en la variante actual y usar pesos/enfriamientos para dormir, jugar, saludar, caminar, explorar o interactuar. Antes de la siguiente acción comprobar que el estado del controlador sea `activity`. Las acciones narrativas/de equipamiento con contacto no deben interrumpirse por la rutina; drag del visitante sí puede interrumpirlas. No usar intervalos que sigan funcionando al destruir la Scene.

## Verificación reproducible

`node integration/runtime_test.mjs` prueba con dobles de objetos la selección de caídas, umbrales de impacto, interrupción y limpieza de listeners, reanudación de tarea narrativa, clima encolado y excepción del ingeniero. `node integration/test/run_browser_test.cjs` inicia un servidor local temporal y usa Playwright + Chrome/Chromium headless: carga los atlases reales en Phaser3.90, registra los clips y ejecuta un drag real con puntero, caída física, impactos, recuperación y equipamiento/clima. Comprueba además que el emisor de lluvia sea el mismo al pasar a noche. Guarda `test/browser_result.json` y `test/smoke_result.png`.

El runner busca `playwright` instalado normalmente; en este equipo usa como fallback el paquete del runtime de Codex. Para otro equipo se puede establecer `OZIEL_PLAYWRIGHT_MODULE` con la ruta al módulo o instalar Playwright y su Chromium. El Phaser3.90 de la prueba se incluye en `vendor/phaser-3.90.0.min.js` con [texto completo de licencia MIT](vendor/LICENSE-phaser.md); [provenance.json](vendor/provenance.json) registra versión, URL oficial de origen y SHA256 del archivo distribuido. La prueba de navegador verifica una secuencia representativa y todos los nombres/frames cargados; no es una prueba exhaustiva de cada clip ni del Home final.

## Fuentes primarias consultadas

Las APIs usadas se comprobaron contra el código oficial de **Phaser3.90.0**: [carga de atlas JSON](https://github.com/phaserjs/phaser/blob/v3.90.0/src/loader/filetypes/AtlasJSONFile.js), [entrada y drag](https://github.com/phaserjs/phaser/blob/v3.90.0/src/input/InputPlugin.js), [Arcade Body](https://github.com/phaserjs/phaser/blob/v3.90.0/src/physics/arcade/Body.js) y [fábrica de partículas desde3.60](https://github.com/phaserjs/phaser/blob/v3.90.0/src/gameobjects/particles/ParticleEmitterFactory.js). La guía oficial explica [frames y eventos de animación](https://docs.phaser.io/phaser/concepts/animations), [input unificado mouse/touch](https://docs.phaser.io/phaser/concepts/input) y [configuración de partículas](https://docs.phaser.io/phaser/concepts/gameobjects/particles). No usar la firma antigua `add.particles('key').createEmitter(...)`: desde3.60 la fábrica devuelve directamente un ParticleEmitter.
