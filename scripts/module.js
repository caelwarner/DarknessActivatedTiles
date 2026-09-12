class DarknessActivatedTiles {
    static ID = "darkness-activated-tiles";

    // The fade state of each tile, keyed by placeable so that it's dropped along with the tile
    static states = new WeakMap();

    // Held as a single reference so the same listener can be removed when the canvas is torn down
    static darknessChangeListener = event => this.onDarknessChange(event);

    static init() {
        game.settings.register(this.ID, "migration", {
            scope: "world",
            config: false,
            type: Number,
            default: 0
        });

        for (const fade of ["fadeIn", "fadeOut"]) {
            game.settings.register(this.ID, fade, {
                name: `${this.ID}.${fade}`,
                hint: `${this.ID}.${fade}Hint`,
                scope: "world",
                config: true,
                type: Number,
                default: 1000,
                range: { min: 0, max: 10000, step: 100 }
            });
        }

        Hooks.on("renderTileConfig", this.onRenderTileConfig.bind(this));
        Hooks.on("canvasReady", this.onCanvasReady.bind(this));
        Hooks.on("canvasTearDown", this.onCanvasTearDown.bind(this));
        Hooks.on("refreshTile", this.onRefreshTile.bind(this));
        Hooks.on("updateTile", this.onUpdateTile.bind(this));
        Hooks.on("destroyTile", this.onDestroyTile.bind(this));
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
            rootId: context.rootId,
            defaultFadeIn: game.settings.get(this.ID, "fadeIn"),
            defaultFadeOut: game.settings.get(this.ID, "fadeOut")
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
            const active = darknessLevel.between(min, max);

            // Darkness animates frame by frame, so only fade the tiles that have actually changed
            if (active === priorDarknessLevel.between(min, max)) {
                continue;
            }

            this.fadeTo(tile, active);
        }
    }

    static onRefreshTile(tile, flags) {
        if (!flags.refreshState || !tile.mesh) {
            return;
        }

        const darknessRange = this.getDarknessRange(tile.document);

        if (!darknessRange) {
            return;
        }

        const active = canvas.environment.darknessLevel.between(darknessRange.min, darknessRange.max);
        const state = this.getState(tile, active);

        // Core has just recalculated the tile's alpha, so take that as the value the fade scales
        state.baseAlpha = tile.mesh.alpha;
        this.applyAlpha(tile, state);

        if (!active) {
            // Stops the tile restricting light and weather while it's out of range
            tile.mesh.hidden = true;
        }
    }

    static onUpdateTile(tileDocument, changed) {
        const tile = tileDocument.object;

        // Core only refreshes a tile's state for hidden, sort, locked and restrictions
        if (!changed.flags?.[this.ID] || !tile) {
            return;
        }

        const darknessRange = this.getDarknessRange(tileDocument);

        // The tile is no longer darkness activated, so drop its fade and let core's alpha stand
        if (!darknessRange) {
            this.states.delete(tile);
            tile.renderFlags.set({ refreshState: true });
            return;
        }

        this.fadeTo(tile, canvas.environment.darknessLevel.between(darknessRange.min, darknessRange.max));
    }

    static onDestroyTile(tile) {
        const state = this.states.get(tile);

        if (state) {
            foundry.canvas.animation.CanvasAnimation.terminateAnimation(state.name);
        }
    }

    static fadeTo(tile, active) {
        const state = this.getState(tile, active);
        const duration = this.getFadeDuration(tile.document, active);
        const factor = active ? 1 : 0;

        // Lets the tile pick up its new hidden state and recalculate the alpha the fade scales
        tile.renderFlags.set({ refreshState: true });

        if (duration <= 0) {
            state.factor = factor;
            this.applyAlpha(tile, state);
            return;
        }

        // Reusing the name terminates the running fade, so reversing part way through turns around cleanly
        foundry.canvas.animation.CanvasAnimation.animate([{ parent: state, attribute: "factor", to: factor }], {
            name: state.name,
            duration,
            ontick: () => this.applyAlpha(tile, state)
        });
    }

    static applyAlpha(tile, state) {
        // A faded out tile still shows at half alpha for the GM, the same way core renders a hidden one
        const visibility = game.user.isGM ? 0.5 + (0.5 * state.factor) : state.factor;

        tile.mesh.alpha = state.baseAlpha * visibility;
    }

    static getState(tile, active) {
        let state = this.states.get(tile);

        if (!state) {
            // Tiles start at their final alpha, they only fade once the darkness level changes
            state = { factor: active ? 1 : 0, baseAlpha: tile.mesh.alpha, name: Symbol(this.ID) };
            this.states.set(tile, state);
        }

        return state;
    }

    static getFadeDuration(tileDocument, active) {
        const fade = active ? "fadeIn" : "fadeOut";

        return tileDocument.getFlag(this.ID, "darkness")?.[fade] ?? game.settings.get(this.ID, fade);
    }

    /**
     * Bring tiles configured by version 1.2 and earlier up to date, once per world.
     *
     * Those versions had an enabled toggle and hid out of range tiles by writing to the tile's hidden field.
     * Tiles that had the toggle turned off are reset to a full range so that they don't suddenly start
     * activating, and tiles that were hidden by the module are unhidden because nothing writes that field
     * anymore.
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
