class DarknessActivatedTiles {
    static ID = "darkness-activated-tiles";

    static init() {
        Hooks.on("renderTileConfig", this.onRenderTileConfig.bind(this));
        Hooks.on("closeTileConfig", this.onCloseTileConfig.bind(this));
        Hooks.on("lightingRefresh", this.onLightingRefresh.bind(this));
    }

    static async onRenderTileConfig(app, html, context) {
        const tab = html.querySelector(`.tab[data-tab="appearance"]`);

        if (!tab) {
            return;
        }

        const data = {
            enabled: false,
            min: 0,
            max: 1,
            ...app.document.getFlag(this.ID, "darkness"),
            rootId: context.rootId
        };
        const contents = await foundry.applications.handlebars.renderTemplate(`modules/${this.ID}/templates/tile-darkness-range.hbs`, data);

        const fragment = document.createElement("template");
        fragment.innerHTML = contents;

        // A null reference node appends, so this still works if the video options are ever dropped from the tab
        tab.insertBefore(fragment.content, tab.querySelector("fieldset[data-video-options]"));
    }

    static onCloseTileConfig(app) {
        const tile = app.document;

        // A tile that's still being created isn't in the scene's collection yet and can't be updated
        if (!tile.collection?.has(tile.id)) {
            return;
        }

        const darknessRange = tile.getFlag(this.ID, "darkness");

        if (darknessRange?.enabled) {
            tile.update({ hidden: canvas.environment.darknessLevel < darknessRange.min || canvas.environment.darknessLevel > darknessRange.max });
        }
    }

    static onLightingRefresh(_lighting) {
        if (!game.user.isGM) {
            return;
        }

        canvas.scene.tiles.forEach(tile => {
            const darknessRange = tile.getFlag(this.ID, "darkness");

            if (darknessRange.enabled) {
                tile.update({ hidden: canvas.environment.darknessLevel < darknessRange.min || canvas.environment.darknessLevel > darknessRange.max });
            }
        });
    }
}

console.log("Darkness Activated Tiles | Loaded");
Hooks.once("init", () => DarknessActivatedTiles.init());
