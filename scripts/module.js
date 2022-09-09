class DarknessActivatedTiles {
    static ID = "darkness-activated-tiles";

    static init() {
        Hooks.on("renderTileConfig", this.onRenderTileConfig.bind(this));
        Hooks.on("lightingRefresh", this.onLightingRefresh.bind(this));
    }

    static async onRenderTileConfig(config, html, tile) {
        if (!config.object.getFlag(this.ID, "darkness"))
            // Can't use setFlag because at this point the tile doesn't have an id yet
            tile.data.flags[this.ID] = { "darkness": { "enabled": false, "min": 0, "max": 1 }};

        const contents = await renderTemplate(`modules/${this.ID}/templates/tile-darkness-range.hbs`, tile);
        html.find(`div[data-tab="basic"] .form-group`).last().after(contents);

        config.activateListeners(html);
        config.setPosition({ height: "auto", width: "500" });
    }

    static onLightingRefresh(lighting) {
        if (!game.user.isGM) {
            return;
        }

        canvas.scene.tiles.forEach(tile => {
            const darknessRange = tile.getFlag(this.ID, "darkness");

            if (darknessRange.enabled) {
                console.log(canvas.scene.darkness < darknessRange.min || canvas.scene.darkness > darknessRange.max);

                tile.update({ hidden: canvas.scene.darkness < darknessRange.min || canvas.scene.darkness > darknessRange.max });
            }
        });
    }
}

console.log("Darkness Activated Tiles | Loaded");
Hooks.once("init", () => DarknessActivatedTiles.init());
