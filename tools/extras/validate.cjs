/* Checks the extra penguins against the base penguin's animation contract.
 *   node tools/extras/validate.cjs                 generated sources + coverage report
 *   node tools/extras/validate.cjs --runtime-only  what sync-assets published to public/
 * Structural checks only: likeness and motion are reviewed on the sheets and in the game.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const root = path.resolve(__dirname, '../..');
const registry = require('../../src/game/extraPenguins.json');
const base = require('../../assets_overrides/characters/animations.json');
const dir = path.join(root, 'assets_overrides');
const generated = path.join(dir, 'ExtraPenguins/generated/animations.json');
const docs = path.join(root, 'docs/extra_penguins');
// intro choreography ends before anyone can be summoned: produced, never loaded
const INTRO_ONLY = new Set(['enter', 'switch_light', 'notice_name', 'group_look_up', 'assemble_ladder', 'reach_rope', 'cut_rope', 'react_name_fall']);
// changing into seasonal clothes: the extras keep their own
const OUTFIT_ONLY = new Set(['put_scarf', 'put_boots', 'open_umbrella', 'remove_accessories']);
const runtimeUse = clip => INTRO_ONLY.has(clip) ? 'No se carga: coreografía exclusiva de la intro, anterior a cualquier invocación'
  : clip === 'put_down_object' ? 'Cargado; ningún pingüino lo usa en el código actual'
  : OUTFIT_ONLY.has(clip) ? 'Cargado con su grupo; no alcanzable: los extras no se cambian de ropa'
  : 'Alcanzable tras la intro';

const exactFile = file => {
  let current = path.parse(file).root;
  for (const part of file.slice(current.length).split(path.sep)) {
    assert(fs.readdirSync(current).includes(part), `Ruta inexistente o con mayúsculas distintas: ${file}`);
    current = path.join(current, part);
  }
};

async function pageInfo(file) {
  const meta = await sharp(file).metadata();
  const raw = await sharp(file).ensureAlpha().raw().toBuffer();
  return { meta, raw };
}

/** Visible pixels and hash of a frame rectangle. */
function rect(info, f) {
  const { meta, raw } = info, hash = crypto.createHash('sha256');
  let visible = 0;
  for (let y = f.y; y < f.y + f.h; y++) {
    const row = raw.subarray((y * meta.width + f.x) * 4, (y * meta.width + f.x + f.w) * 4);
    hash.update(row);
    for (let x = 3; x < row.length; x += 4) if (row[x] > 8) visible++;
  }
  return { visible, hash: hash.digest('hex') };
}

async function validateSources() {
  assert(fs.existsSync(generated), 'Faltan los recursos generados (node tools/extras/build.cjs)');
  const data = JSON.parse(fs.readFileSync(generated));
  assert.equal(registry.length, 8);
  assert.equal(new Set(registry.map(p => p.id)).size, 8, 'Identificadores duplicados');
  assert.equal(new Set(data.atlases.map(a => a.id)).size, data.atlases.length, 'Atlas duplicados');
  const contract = base.characters.penguin, rows = [], pages = new Map(), idle = [];
  for (const person of registry) {
    const ref = path.join(root, person.reference);
    exactFile(ref);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(ref)).digest('hex'), data.references[person.id], `Referencia alterada: ${person.id}`);
    exactFile(path.join(dir, 'ExtraPenguins/generated', person.id, 'cutout.png'));
    const clips = data.characters[person.variant];
    assert(clips, person.variant);
    assert.equal(Object.keys(clips).length, Object.keys(contract).length * 2, `${person.variant}: número de clips`);
    for (const [clip, original] of Object.entries(contract)) {
      const def = clips[clip], right = clips[`${clip}__right`];
      assert(def && right, `${person.variant}:${clip}`);
      assert.equal(def.frames.length, original.frames.length, `${clip}: fotogramas`);
      assert.equal(def.frameRate, original.frameRate);
      assert.equal(def.repeat, original.repeat);
      assert.deepEqual(def.origin, original.origin);
      assert.equal(def.flipSafe, false);
      assert.equal(def.group === 'intro', INTRO_ONLY.has(clip), `${clip}: grupo ${def.group}`);
      // facing right reuses the same drawing: never a mirrored texture
      assert.deepEqual({ ...right }, { ...def }, `${clip}__right debe ser el mismo dibujo`);
      assert.equal(def.frameAnchors.length, def.frames.length);
      for (const [i, a] of def.frameAnchors.entries()) {
        assert.equal(a.frame, def.frames[i]);
        assert.equal(def.frames[i], `${clip}_${String(i).padStart(3, '0')}`);
        for (const k of ['handNear', 'handFar', 'helmet']) {
          assert(a[k].every(Number.isFinite) && a[k][0] > -120 && a[k][0] < 376 && a[k][1] > -120 && a[k][1] < 300, `${clip}/${i}: ancla ${k} fuera de la celda`);
        }
      }
      const atlas = data.atlases.find(x => x.id === def.atlasKey);
      assert(atlas, def.atlasKey);
      if (!pages.has(atlas.id)) {
        const file = path.join(dir, atlas.png), json = path.join(dir, atlas.json);
        exactFile(file); exactFile(json);
        const info = await pageInfo(file), map = JSON.parse(fs.readFileSync(json));
        assert(info.meta.hasAlpha, `${atlas.id} sin transparencia`);
        assert.equal(info.meta.width, atlas.width); assert.equal(info.meta.height, atlas.height);
        assert.deepEqual(map.meta.size, { w: atlas.width, h: atlas.height });
        assert.equal(map.meta.image, path.basename(file));
        assert.equal(atlas.textureScale, 0.75);
        for (const [name, fr] of Object.entries(map.frames)) {
          const f = fr.frame, src = fr.spriteSourceSize;
          for (const v of [f.x, f.y, f.w, f.h, src.x, src.y, src.w, src.h]) assert.equal(v % 2, 0, `${name}: rectángulo impar`);
          assert(f.x + f.w <= atlas.width && f.y + f.h <= atlas.height, `${name}: fuera de la página`);
          assert.deepEqual(fr.sourceSize, { w: 240, h: 240 });
          assert(src.x + src.w <= 240 && src.y + src.h <= 240 && f.w === src.w && f.h === src.h, `${name}: recorte incoherente`);
        }
        pages.set(atlas.id, { info, map });
      }
      const { info, map } = pages.get(atlas.id);
      const hashes = def.frames.map(f => {
        assert(map.frames[f], `${atlas.id}: falta ${f}`);
        const r = rect(info, map.frames[f].frame);
        assert(r.visible > 1500, `${person.id}:${f} casi vacío`);
        return r.hash + JSON.stringify(map.frames[f].spriteSourceSize);
      });
      if (def.frames.length > 1) assert(new Set(hashes).size > 1, `Animación estática: ${person.id}:${clip}`);
      if (clip === 'idle') idle.push(hashes[0]);
      rows.push({ character: person.id, action: clip, group: def.group, frames: def.frames.length, fps: def.frameRate, repeat: def.repeat, atlas: atlas.png, atlasJson: atlas.json, distinctImages: new Set(hashes).size, validation: 'structural-pass' });
    }
  }
  assert.equal(new Set(idle).size, 8, 'Dos identidades comparten el mismo reposo');
  const used = new Set(registry.flatMap(p => Object.values(data.characters[p.variant]).map(d => d.atlasKey)));
  assert.equal(used.size, data.atlases.length, 'Atlas sin consumidor en el manifiesto');
  const report = { validation: 'structural-pass', visualValidation: 'Revisión visual y en el juego aparte; esta comprobación no certifica el parecido.', characters: 8, clips: rows.length, frames: rows.reduce((n, r) => n + r.frames, 0), atlases: pages.size, rows };
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(path.join(docs, 'coverage.json'), JSON.stringify(report, null, 2));
  writeCoverage(report, data);
  // the inventory contract lists, per action of the base penguin, each identity's resources
  const contractPath = path.join(root, 'docs/extra-penguins-contract.json');
  if (fs.existsSync(contractPath)) {
    const c = JSON.parse(fs.readFileSync(contractPath));
    c.description = 'Animation contract of the base penguin with the resources of the extra identities (cut-out puppets, tools/extras); structural validation only.';
    for (const entry of c.matrix) {
      entry.extraResources = {};
      for (const p of registry) entry.extraResources[p.id] = { status: 'structural-pass', use: runtimeUse(entry.clip), manifest: 'assets_overrides/ExtraPenguins/generated/animations.json', resources: rows.filter(r => r.character === p.id && r.action === entry.clip) };
    }
    fs.writeFileSync(contractPath, JSON.stringify(c, null, 2));
  }
  return report;
}

function writeCoverage(report, data) {
  const perCharacter = registry.map(p => {
    const r = report.rows.filter(x => x.character === p.id);
    const pagesHere = data.atlases.filter(a => a.variant === p.variant);
    const loaded = pagesHere.filter(a => ['base', 'tasks', 'daily', 'weather'].includes(a.group));
    const season = Math.max(...pagesHere.filter(a => ['winter', 'autumn', 'spring', 'summer'].includes(a.group)).map(a => a.width * a.height * 4));
    const mib = (loaded.reduce((s, a) => s + a.width * a.height * 4, 0) + season) / 1048576;
    return `| ${p.name} | ${p.id} | ${r.length} | ${r.reduce((n, x) => n + x.frames, 0)} | ${pagesHere.length} | ${mib.toFixed(1)} / ${(mib / 4).toFixed(1)} |`;
  });
  const contract = base.characters.penguin;
  const actionRows = Object.entries(contract).map(([clip, def]) => {
    const g = report.rows.find(r => r.action === clip).group;
    const cells = registry.map(p => `✓ ${report.rows.find(r => r.character === p.id && r.action === clip).distinctImages}`);
    return `| ${clip} | ${g} | ${def.frames.length} / ${def.frameRate} / ${def.repeat === -1 ? 'bucle' : 'una vez'} | ${runtimeUse(clip)} | ${cells.join(' | ')} |`;
  });
  const md = `# Cobertura de recursos de los ocho pingüinos

Generado por \`node tools/extras/validate.cjs\`. Resultado: **${report.clips} clips, ${report.frames} fotogramas y ${report.atlases} atlas con validación estructural correcta**. La comprobación cubre archivos, transparencia, recortes, contratos, anclas y que ninguna animación sea estática. El parecido con las referencias y el movimiento se revisan aparte, con las hojas de control y en el juego ([VISUAL_REVIEW.md](VISUAL_REVIEW.md)).

Cada personaje es una marioneta de recortes de su propio PNG ([IDENTITY.md](IDENTITY.md)). Tiene un único traje, su ropa propia, con las 72 acciones del pingüino base (\`penguin\`): mismos nombres, número de fotogramas, fps, bucle y origen. \`<acción>__right\` reutiliza los mismos fotogramas, porque estos personajes miran al espectador como en sus referencias y nunca se reflejan.

Fuentes: referencias intactas en \`assets_overrides/ExtraPenguins/*.png\` (SHA-256 coincidente). Recorte en \`generated/<id>/cutout.png\`. Piezas en \`generated/<id>/rig/\`. Atlas en \`generated/<id>/atlases/\`. Manifiesto en \`generated/animations.json\`. Registro en \`src/game/extraPenguins.json\`. [Correspondencia exacta por personaje, acción, atlas y fotograma](coverage.json).

## Totales por personaje

Memoria de textura de lo que se carga en juego (grupos base, tasks, daily y weather más la estación más pesada): escritorio / móvil.

| Personaje | Id | Clips | Fotogramas | Atlas | MiB en juego |
|---|---|---:|---:|---:|---:|
${perCharacter.join('\n')}

## Matriz de las 72 acciones

✓ N: la acción existe con todos sus fotogramas, anclas de aletas y cabeza, duración y bucle; N es el número de imágenes distintas de la secuencia. Frames/fps es el número de fotogramas y su velocidad; un ciclo dura frames/fps segundos. \`tasks\` agrupa los clips de la intro que el comportamiento normal reutiliza (escalera y celebración).

| Acción | Grupo | Frames / fps / repetición | Uso por un extra | ${registry.map(p => p.name).join(' | ')} |
|---|---|---|---|${registry.map(() => '---').join('|')}|
${actionRows.join('\n')}

## Contratos comprobados

- Rutas con mayúsculas exactas; referencias originales sin modificar; ocho identidades y claves de atlas únicas.
- Páginas RGBA con transparencia; tamaño de PNG, JSON y manifiesto coincidentes; celdas de 240 px (\`textureScale\` 0.75 sobre una celda lógica de 320, con los pies a 0,9 de su altura como en las de 256) recortadas, con rectángulos pares para que la versión móvil sea la mitad exacta.
- Nombres y orden de fotogramas; los mismos fotogramas, fps, bucle y origen que el pingüino base; anclas finitas dentro de la celda.
- Ningún fotograma vacío; ninguna secuencia estática; reposos distintos entre identidades; ningún atlas huérfano.
- El grupo \`intro\` contiene solo la coreografía exclusiva de la intro y nunca se carga para un extra.
`;
  fs.writeFileSync(path.join(docs, 'COVERAGE.md'), md);
}

async function validateRuntime() {
  const data = JSON.parse(fs.readFileSync(generated));
  const pub = path.join(root, 'public/assets');
  const manifest = JSON.parse(fs.readFileSync(path.join(pub, 'data/manifest.json')));
  const anims = JSON.parse(fs.readFileSync(path.join(pub, 'data/animations.json')));
  const resident = manifest.atlases.filter(a => a.variant?.startsWith('extra_'));
  assert.equal(resident.length, data.atlases.length);
  let frames = 0;
  for (const source of data.atlases) {
    const entry = resident.find(a => a.id === source.id);
    assert(entry, source.id);
    assert.equal(entry.png, source.png); assert.equal(entry.json, source.json);
    assert.equal(entry.textureScale, 0.75); assert.equal(entry.width, source.width); assert.equal(entry.height, source.height);
    const sd = p => p.replace('/atlases/', '/atlases/sd/');
    for (const [png, json, k] of [[entry.png, entry.json, 1], [sd(entry.png), sd(entry.json), 0.5]]) {
      exactFile(path.join(pub, png)); exactFile(path.join(pub, json));
      const meta = await sharp(path.join(pub, png)).metadata();
      assert(meta.hasAlpha);
      assert.equal(meta.width, source.width * k); assert.equal(meta.height, source.height * k);
      const map = JSON.parse(fs.readFileSync(path.join(pub, json)));
      const src = JSON.parse(fs.readFileSync(path.join(root, 'assets_overrides', source.json)));
      assert.deepEqual(Object.keys(map.frames), Object.keys(src.frames));
      for (const [name, f] of Object.entries(map.frames)) {
        for (const field of ['frame', 'spriteSourceSize']) for (const d of ['x', 'y', 'w', 'h']) assert.equal(f[field][d], src.frames[name][field][d] * k);
        assert.deepEqual(f.sourceSize, { w: 240 * k, h: 240 * k });
        if (k === 1) frames++;
      }
    }
  }
  for (const [variant, clips] of Object.entries(data.characters)) for (const [clip, def] of Object.entries(clips)) {
    const runtime = anims.characters[variant]?.[clip];
    assert(runtime, `${variant}:${clip}`);
    assert.equal(runtime.atlas, def.atlasKey); assert.deepEqual(runtime.frames, def.frames);
    assert.equal(runtime.fps, def.frameRate); assert.equal(runtime.repeat, def.repeat);
    assert.equal(runtime.anchors.length, def.frameAnchors.length);
  }
  const report = { validation: 'runtime-assets-pass', characters: 8, atlases: resident.length, frames, textureScale: 0.75, sd: 0.375 };
  fs.writeFileSync(path.join(docs, 'runtime-assets.json'), JSON.stringify(report, null, 2));
  return report;
}

async function main() {
  const r = process.argv.includes('--runtime-only') ? await validateRuntime() : await validateSources();
  console.log(JSON.stringify({ ...r, rows: undefined }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
