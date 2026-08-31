// module/scripts/darkness-activated-tiles.js
class DarknessActivatedTiles {
  static ID = "darkness-activated-tiles";
  static DEFAULT_APPEARANCE_DURATION = 1;
  static MAX_APPEARANCE_DURATION = 60;

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
          <label>Appearance duration (seconds)</label>
          <div class="form-fields">
            <input type="number" step="0.1" min="0" max="${this.MAX_APPEARANCE_DURATION}"
                  name="flags.${ID}.darkness.appearanceDuration" value="${appearanceDuration}">
          </div>
          <p class="hint">How long the tile takes to fade in. Set to 0 for instant appearance.</p>
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
    if (!game.user.isGM) return;
    const level = canvas.scene?.environment?.darknessLevel ?? 0;
    for (const tile of canvas.scene.tiles) this.applyTileVisibilityAndAlpha(tile, level);
  }

  static onUpdateTile(tile, changed) {
    if (changed.hidden === true) {
      this.stopAppearanceAnimation(tile);
      return;
    }

    if (changed.hidden !== false) return;

    const darkness = tile.getFlag(this.ID, "darkness");
    if (!darkness?.enabled) return;

    void this.animateTileAppearance(tile);
  }

  static getAppearanceDuration(tile) {
    const configured = Number(tile.getFlag(this.ID, "darkness.appearanceDuration"));
    if (!Number.isFinite(configured) || configured < 0) return this.DEFAULT_APPEARANCE_DURATION;
    return Math.min(configured, this.MAX_APPEARANCE_DURATION);
  }

  static getAppearanceAnimationName(tile) {
    return `${this.ID}.appearance.${tile.parent?.id ?? "scene"}.${tile.id}`;
  }

  static stopAppearanceAnimation(tile) {
    foundry.canvas.animation.CanvasAnimation.terminateAnimation(this.getAppearanceAnimationName(tile));
  }

  static async animateTileAppearance(tile) {
    const placeable = tile.object;
    if (!placeable?.mesh) return;

    // Apply Foundry's pending visibility flags first, then animate from fully
    // transparent to the alpha selected in the tile configuration.
    placeable.applyRenderFlags();

    const mesh = placeable.mesh;
    const targetAlpha = mesh.alpha;
    const duration = this.getAppearanceDuration(tile) * 1000;
    if (duration === 0 || targetAlpha <= 0) return;

    mesh.alpha = 0;

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

  static async applyTileVisibilityAndAlpha(tile, level) {
    const ID = this.ID;
    const darkness = tile.getFlag(ID, "darkness");
    if (!darkness) return;

    const min = darkness.min ?? 0;
    const max = darkness.max ?? 1;
    const enabled = !!darkness.enabled;
    const usealpha = !!darkness.usealpha;

    const notVisible = enabled && (level < min || level > max);
    const updates = {};

    if (enabled) {
      if (tile.hidden !== notVisible) updates.hidden = notVisible;
    }

    if (usealpha) {
      let baseAlpha = 1;

      const targetAlpha = notVisible ? 0 : baseAlpha;
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
