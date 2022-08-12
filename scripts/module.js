class DarknessActivatedTiles {
    static ID = "darkness-activated-tiles";

    constructor() {
        Hooks.on("renderTileConfig", this.onRenderTileConfig.bind(this));
        Hooks.on("lightingRefresh", this.onLightingRefresh.bind(this));
    }

    async onRenderTileConfig(config, html, tile) {
        if (!config.object.getFlag(DarknessActivatedTiles.ID, "darkness"))
            // Can't use setFlag because at this point the tile doesn't have an id yet
            tile.data.flags[DarknessActivatedTiles.ID] = { "darkness": { "min": 0, "max": 1 }};

        const contents = await renderTemplate(`modules/${DarknessActivatedTiles.ID}/templates/tile-darkness-range.hbs`, tile);
        html.find(`div[data-tab="basic"] .form-group`).last().after(contents);

        config.activateListeners(html);
        config.setPosition({ height: "auto", width: "auto" });
    }

    onLightingRefresh(lighting) {
        if (!game.user.isGM) {
            return;
        }

        canvas.background.tiles.forEach(tile => {
            const darknessRange = tile.document.getFlag(DarknessActivatedTiles.ID, "darkness");

            tile.document.update({ hidden: lighting.darknessLevel < darknessRange.min || lighting.darknessLevel > darknessRange.max })
        });
    }
}

console.log("Darkness Activated Tiles | Loaded");
Hooks.once("init", () => game.darknessActivatedTiles = new DarknessActivatedTiles());
