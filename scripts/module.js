class DarknessActivatedTiles {
    static ID = "darkness-activated-tiles";

    // Held as a single reference so the same listener can be removed when the canvas is torn down
    static darknessChangeListener = event => this.onDarknessChange(event);

    static init() {
        game.settings.register(this.ID, "migration", {
            scope: "world",
            config: false,
            type: Number,
            default: 0
        });

        Hooks.on("renderTileConfig", this.onRenderTileConfig.bind(this));
        Hooks.on("canvasReady", this.onCanvasReady.bind(this));
        Hooks.on("canvasTearDown", this.onCanvasTearDown.bind(this));
        Hooks.on("refreshTile", this.onRefreshTile.bind(this));
        Hooks.on("updateTile", this.onUpdateTile.bind(this));
        Hooks.once("ready", this.onReady.bind(this));
    }

    static async onRenderTileConfig(app, html, context) {
        const tab = html.querySelector(`.tab[data-tab="appearance"]`);

        if (!tab) {
            return;
        }

        const data = {
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

    static onCanvasReady() {
        canvas.environment.addEventListener("darknessChange", this.darknessChangeListener);
    }

    static onCanvasTearDown() {
        canvas.environment.removeEventListener("darknessChange", this.darknessChangeListener);
    }

    static onDarknessChange(event) {
        const { darknessLevel, priorDarknessLevel } = event.environmentData;

        for (const tile of canvas.tiles.placeables) {
            const darknessRange = this.getDarknessRange(tile.document);

            if (!darknessRange) {
                continue;
            }

            const { min, max } = darknessRange;

            // Darkness animates frame by frame, so only refresh the tiles that have actually changed
            if (darknessLevel.between(min, max) === priorDarknessLevel.between(min, max)) {
                continue;
            }

            tile.renderFlags.set({ refreshState: true });
        }
    }

    static onRefreshTile(tile, flags) {
        if (!flags.refreshState || !tile.mesh) {
            return;
        }

        const darknessRange = this.getDarknessRange(tile.document);

        if (!darknessRange || canvas.environment.darknessLevel.between(darknessRange.min, darknessRange.max)) {
            return;
        }

        // Render the tile the same way core renders a hidden one, faded for the GM and gone for everyone else
        tile.mesh.alpha *= game.user.isGM ? 0.5 : 0;

        // Stops the tile restricting light and weather while it's out of range
        tile.mesh.hidden = true;
    }

    static onUpdateTile(tileDocument, changed) {
        // Core only refreshes a tile's state for hidden, sort, locked and restrictions
        if (changed.flags?.[this.ID]) {
            tileDocument.object?.renderFlags.set({ refreshState: true });
        }
    }

    /**
     * Bring tiles configured by version 1.2 and earlier up to date, once per world.
     *
     * Those versions had an enabled toggle and hid out of range tiles by writing to the tile's hidden field.
     * Tiles that had the toggle turned off are reset to a full range so that they don't suddenly start
     * activating, and tiles that were hidden by the module are unhidden because nothing writes that field
     * any more.
     */
    static async onReady() {
        if (!game.user.isGM || game.settings.get(this.ID, "migration") >= 1) {
            return;
        }

        for (const scene of game.scenes) {
            const updates = [];

            for (const tile of scene.tiles) {
                const darknessRange = tile.getFlag(this.ID, "darkness");

                if (darknessRange?.enabled === undefined) {
                    continue;
                }

                if (darknessRange.enabled) {
                    if (tile.hidden) {
                        updates.push({ _id: tile.id, hidden: false });
                    }
                } else {
                    updates.push({ _id: tile.id, [`flags.${this.ID}.darkness`]: { min: 0, max: 1 } });
                }
            }

            if (updates.length) {
                await scene.updateEmbeddedDocuments("Tile", updates);
            }
        }

        await game.settings.set(this.ID, "migration", 1);
    }

    static getDarknessRange(tileDocument) {
        const darknessRange = tileDocument.getFlag(this.ID, "darkness");

        // An empty number input submits as null, which would otherwise break the comparison
        return darknessRange ? { min: darknessRange.min ?? 0, max: darknessRange.max ?? 1 } : null;
    }
}

console.log("Darkness Activated Tiles | Loaded");
Hooks.once("init", () => DarknessActivatedTiles.init());
