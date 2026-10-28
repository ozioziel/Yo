import Phaser from 'phaser';
import { ASSET_BASE, atlasesForSeason, EFFECT_ATLASES, queueAtlases, queueImages, registerCharacterAnims, registerEffectAnims } from '../assets';
import { bridge } from '../bridge';
import type { AnimData, EnvData, GameData, ManifestLite, Season } from '../types';
import { SEASON_KEYS } from '../types';
import { DISPLAY_FONT } from '../world/NameSign';

/** Loads data, the current season's atlases and small props, then the brand font. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    bridge.emit('phase', 'loading');
    this.load.json('anims', `${ASSET_BASE}/data/animations.json`);
    this.load.json('manifest', `${ASSET_BASE}/data/manifest.json`);
    this.load.json('env', `${ASSET_BASE}/data/environments.json`);
  }

  create() {
    const data: GameData = {
      anims: this.cache.json.get('anims') as AnimData,
      manifest: this.cache.json.get('manifest') as ManifestLite,
      env: this.cache.json.get('env') as EnvData,
    };
    const season = (bridge.get('season') ?? 2) as Season;
    const night = bridge.get('night') ?? false;

    queueAtlases(this, data, atlasesForSeason(data, season));
    queueAtlases(this, data, EFFECT_ATLASES);
    const small = Object.entries(data.manifest.images)
      .filter(([, v]) => v.type === 'prop' || v.type === 'particle' || v.type === 'ui')
      .map(([id]) => id);
    queueImages(this, data, small);
    const fg = `environments_${SEASON_KEYS[season]}_${night ? 'night' : 'day'}_foreground`;
    queueImages(this, data, [fg, 'expression_curiosity', 'expression_surprise']);

    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => bridge.emit('progress', v));
    this.load.once(Phaser.Loader.Events.COMPLETE, async () => {
      registerCharacterAnims(this, data);
      registerEffectAnims(this, data);
      try {
        await Promise.race([
          document.fonts.load(`600 100px ${DISPLAY_FONT}`),
          new Promise(resolve => setTimeout(resolve, 2500)),
        ]);
      } catch {
        /* the fallback font still works */
      }
      this.scene.start('world', { data });
    });
    this.load.start();
  }
}
