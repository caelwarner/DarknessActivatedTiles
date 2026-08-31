// module/scripts/darkness-activated-tiles.js
class DarknessActivatedTiles {
  static ID = "darkness-activated-tiles";
  static DEFAULT_APPEARANCE_DURATION = 1;
  static MAX_APPEARANCE_DURATION = 60;
  static disappearingTiles = new Set();
  static pendingHideUpdates = new Set();

  static init() {
    Hooks.on("renderTileConfig", this.onRenderTileConfig.bind(this));
    Hooks.on("closeTileConfig", this.onCloseTileConfig.bind(this));
    Hooks.on("lightingRefresh", this.onLightingRefresh.bind(this));
    Hooks.on("updateTile", this.onUpdateTile.bind(this));
  }

  static onRenderTileConfig(app, html) {
    const ID = DarknessActivatedTiles.ID;

    const enabled = app.document.getFlag(ID, "darkness.enabled") ?? false;
    const usealpha = app.document.getFlag(ID, "darkness.usealpha") ?? false;
    const min = app.document.getFlag(ID, "darkness.min") ?? 0;
    const max = app.document.getFlag(ID, "darkness.max") ?? 1;
    const appearanceDuration = this.getAppearanceDuration(app.document);

    const injectHtml = `
      <fieldset>
        <legend>Darkness Activation</legend>

        <div class="form-group">
          <label>Enable hide by darkness</label>
          <div class="form-fields">
            <input type="checkbox" name="flags.${ID}.darkness.enabled" ${enabled ? 'checked=""' : ""}>
          </div>
        </div>

        <div class="form-group slim">
          <label>Darkness range (0–1)</label>
          <div class="form-fields">
            <label>Min</label>
            <input type="number" step="0.01" min="0" max="1"
                  name="flags.${ID}.darkness.min" value="${min}">
            <label>Max</label>
            <input type="number" step="0.01" min="0" max="1"
                  name="flags.${ID}.darkness.max" value="${max}">
          </div>
        </div>

        <div class="form-group">
          <label>Set alpha to 0 when hidden</label>
          <div class="form-fields">
            <input type="checkbox" name="flags.${ID}.darkness.usealpha" ${usealpha ? 'checked=""' : ""}>
          </div>
        </div>

        <div class="form-group">
          <label>Fade duration (seconds)</label>
          <div class="form-fields">
            <input type="number" step="0.1" min="0" max="${this.MAX_APPEARANCE_DURATION}"
                  name="flags.${ID}.darkness.appearanceDuration" value="${appearanceDuration}">
          </div>
          <p class="hint">How long the tile takes to fade in or out. Set to 0 for instant transitions.</p>
        </div>
      </fieldset>
      `;

    const root = html instanceof jQuery ? html[0] : html;
    const form = root.querySelector("form") ?? root;

    const anchors = [
      '[name="texture.tint"]',
      '[name="alpha"]',
      'div[data-tab="appearance"] .form-group:last-of-type',
      'div[data-tab="basic"] .form-group:last-of-type',
      ".form-group:last-of-type"
    ];
    let anchor = null;
    for (const sel of anchors) { if ((anchor = root.querySelector(sel))) break; }

    if (anchor?.closest(".form-group")) {
      anchor.closest(".form-group").insertAdjacentHTML("afterend", injectHtml);
    } else {
      form.insertAdjacentHTML("beforeend", injectHtml);
    }

    try { app.setPosition({ height: "auto" }); } catch { }
  }

  static onCloseTileConfig(config) {
    const doc = config.document ?? config.object;
    const darkness = doc.getFlag(this.ID, "darkness");
    if (!darkness) return;

    const level = canvas.scene?.environment?.darknessLevel ?? 0;
    this.applyTileVisibilityAndAlpha(doc, level);
  }

  static onLightingRefresh() {
    const level = canvas.scene?.environment?.darknessLevel ?? 0;
    for (const tile of canvas.scene.tiles) {
      if (game.user.isGM) void this.applyTileVisibilityAndAlpha(tile, level);
      else this.applyLocalDarknessTransition(tile, level);
    }
  }

  static onUpdateTile(tile, changed) {
    if (changed.hidden === true) {
      this.disappearingTiles.delete(this.getTileKey(tile));
      this.stopAppearanceAnimation(tile);
      this.stopDisappearanceAnimation(tile);
      return;
    }

    if (changed.hidden !== false) return;

    this.disappearingTiles.delete(this.getTileKey(tile));
    this.stopDisappearanceAnimation(tile);

    const darkness = tile.getFlag(this.ID, "darkness");
    if (!darkness?.enabled) return;

    void this.animateTileAppearance(tile);
  }

  static getTileKey(tile) {
    return `${tile.parent?.id ?? "scene"}.${tile.id}`;
  }

  static isOutsideDarknessRange(tile, level) {
    const darkness = tile.getFlag(this.ID, "darkness");
    if (!darkness?.enabled) return false;

    const min = darkness.min ?? 0;
    const max = darkness.max ?? 1;
    return level < min || level > max;
  }

  static applyLocalDarknessTransition(tile, level) {
    if (this.isOutsideDarknessRange(tile, level) && !tile.hidden) {
      void this.animateTileDisappearance(tile);
    } else {
      this.cancelTileDisappearance(tile);
    }
  }

  static getAppearanceDuration(tile) {
    const configured = Number(tile.getFlag(this.ID, "darkness.appearanceDuration"));
    if (!Number.isFinite(configured) || configured < 0) return this.DEFAULT_APPEARANCE_DURATION;
    return Math.min(configured, this.MAX_APPEARANCE_DURATION);
  }

  static getAppearanceAnimationName(tile) {
    return `${this.ID}.appearance.${this.getTileKey(tile)}`;
  }

  static getDisappearanceAnimationName(tile) {
    return `${this.ID}.disappearance.${this.getTileKey(tile)}`;
  }

  static stopAppearanceAnimation(tile) {
    foundry.canvas.animation.CanvasAnimation.terminateAnimation(this.getAppearanceAnimationName(tile));
  }

  static stopDisappearanceAnimation(tile) {
    foundry.canvas.animation.CanvasAnimation.terminateAnimation(this.getDisappearanceAnimationName(tile));
  }

  static cancelTileDisappearance(tile) {
    const tileKey = this.getTileKey(tile);
    if (!this.disappearingTiles.delete(tileKey)) return;

    this.stopDisappearanceAnimation(tile);
    if (!tile.hidden) void this.animateTileAppearance(tile, { fromCurrent: true });
  }

  static async animateTileAppearance(tile, { fromCurrent = false } = {}) {
    const placeable = tile.object;
    if (!placeable?.mesh) return;

    this.stopAppearanceAnimation(tile);

    if (!fromCurrent) {
      // Apply Foundry's pending visibility flags first, then animate from fully
      // transparent to the alpha selected in the tile configuration.
      placeable.applyRenderFlags();
    }

    const mesh = placeable.mesh;
    const targetAlpha = fromCurrent ? Number(tile.alpha ?? 1) : mesh.alpha;
    const duration = this.getAppearanceDuration(tile) * 1000;
    if (!fromCurrent) mesh.alpha = 0;

    if (duration === 0 || targetAlpha <= 0) {
      mesh.alpha = targetAlpha;
      return;
    }

    const CanvasAnimation = foundry.canvas.animation.CanvasAnimation;
    try {
      await CanvasAnimation.animate(
        [{ parent: mesh, attribute: "alpha", to: targetAlpha }],
        {
          name: this.getAppearanceAnimationName(tile),
          context: mesh,
          duration,
          easing: CanvasAnimation.easeInOutCosine
        }
      );
    } catch (error) {
      if (!tile.hidden && placeable.mesh === mesh) mesh.alpha = targetAlpha;
      console.error(`${this.ID} | Failed to animate tile appearance`, tile, error);
    }
  }

  static async animateTileDisappearance(tile) {
    const placeable = tile.object;
    if (!placeable?.mesh) return true;

    const CanvasAnimation = foundry.canvas.animation.CanvasAnimation;
    const animationName = this.getDisappearanceAnimationName(tile);
    const runningAnimation = CanvasAnimation.getAnimation(animationName);
    if (runningAnimation) return runningAnimation.promise;

    this.stopAppearanceAnimation(tile);

    const mesh = placeable.mesh;
    const duration = this.getAppearanceDuration(tile) * 1000;
    this.disappearingTiles.add(this.getTileKey(tile));

    if (duration === 0 || mesh.alpha <= 0) {
      mesh.alpha = 0;
      return true;
    }

    try {
      return await CanvasAnimation.animate(
        [{ parent: mesh, attribute: "alpha", to: 0 }],
        {
          name: animationName,
          context: mesh,
          duration,
          easing: CanvasAnimation.easeInOutCosine
        }
      );
    } catch (error) {
      this.disappearingTiles.delete(this.getTileKey(tile));
      if (!tile.hidden && placeable.mesh === mesh) mesh.alpha = Number(tile.alpha ?? 1);
      console.error(`${this.ID} | Failed to animate tile disappearance`, tile, error);
      return false;
    }
  }

  static async applyTileVisibilityAndAlpha(tile, level) {
    const ID = this.ID;
    let darkness = tile.getFlag(ID, "darkness");
    if (!darkness) return;

    let notVisible = this.isOutsideDarknessRange(tile, level);
    const tileKey = this.getTileKey(tile);

    if (notVisible && !tile.hidden) {
      if (this.pendingHideUpdates.has(tileKey)) return;
      this.pendingHideUpdates.add(tileKey);

      try {
        const completed = await this.animateTileDisappearance(tile);
        darkness = tile.getFlag(ID, "darkness");
        const currentLevel = canvas.scene?.environment?.darknessLevel ?? level;
        notVisible = this.isOutsideDarknessRange(tile, currentLevel);

        if (!completed || !notVisible || tile.hidden) {
          if (!notVisible) this.cancelTileDisappearance(tile);
          return;
        }

        const updates = { hidden: true };
        if (darkness?.usealpha && Math.abs(tile.alpha ?? 1) > 0.001) updates.alpha = 0;
        await tile.update(updates);
      } catch (error) {
        this.cancelTileDisappearance(tile);
        console.error(`${this.ID} | Failed to hide tile`, tile, error);
      } finally {
        this.pendingHideUpdates.delete(tileKey);
      }
      return;
    }

    this.cancelTileDisappearance(tile);

    const updates = {};
    if (darkness.enabled && tile.hidden !== notVisible) updates.hidden = notVisible;

    if (darkness.usealpha) {
      const targetAlpha = notVisible ? 0 : 1;
      if (Math.abs((tile.alpha ?? 1) - targetAlpha) > 0.001) updates.alpha = targetAlpha;
    }

    if (Object.keys(updates).length) {
      try { await tile.update(updates); }
      catch (e) { console.error(`${this.ID} | Failed to update tile`, tile, updates, e); }
    }
  }
}

console.log("Darkness Activated Tiles | Loaded (v13)");
Hooks.once("init", () => DarknessActivatedTiles.init());
