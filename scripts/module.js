// module/scripts/darkness-activated-tiles.js
class DarknessActivatedTiles {
  static ID = "darkness-activated-tiles";

  static init() {
    Hooks.on("renderTileConfig", this.onRenderTileConfig.bind(this));
    Hooks.on("closeTileConfig", this.onCloseTileConfig.bind(this));
    Hooks.on("lightingRefresh", this.onLightingRefresh.bind(this));
  }

  static onRenderTileConfig(app, html) {
    const ID = DarknessActivatedTiles.ID;

    const enabled = app.document.getFlag(ID, "darkness.enabled") ?? false;
    const usealpha = app.document.getFlag(ID, "darkness.usealpha") ?? false;
    const min = app.document.getFlag(ID, "darkness.min") ?? 0;
    const max = app.document.getFlag(ID, "darkness.max") ?? 1;

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