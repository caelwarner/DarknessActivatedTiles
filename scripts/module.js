class DarknessActivatedTiles {
    static ID = "darkness-activated-tiles";

    static init() {
        Hooks.on("renderTileConfig", this.onRenderTileConfig.bind(this));
        Hooks.on("closeTileConfig", this.onCloseTileConfig.bind(this));
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

    static onCloseTileConfig(config, _html) {
        const darknessRange = config.object.getFlag(this.ID, "darkness");

        if (darknessRange.enabled) {
            config.object.update({ hidden: canvas.scene.environment.darknessLevel < darknessRange.min || canvas.scene.environment.darknessLevel > darknessRange.max });
        }
    }

    static onLightingRefresh(_lighting) {
        if (!game.user.isGM) {
            return;
        }

        canvas.scene.tiles.forEach(tile => {
            const darknessRange = tile.getFlag(this.ID, "darkness");

            if (darknessRange.enabled) {
                tile.update({ hidden: canvas.scene.environment.darknessLevel < darknessRange.min || canvas.scene.environment.darknessLevel > darknessRange.max });
            }
        });
    }
}

console.log("Darkness Activated Tiles | Loaded");
Hooks.once("init", () => DarknessActivatedTiles.init());
