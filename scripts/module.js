const DAT = {
	SCOPE: "darkness-activated-tiles",
	LOG_PREFIX: "Darkness Activated Tiles | "
};

class DarknessActivatedTiles {
	constructor() {
		Hooks.on("renderTileConfig", this.onRenderTileConfig.bind(this));
		Hooks.on("preUpdateTile", this.onPreUpdateTile.bind(this));
		Hooks.on("preCreateTile", this.onPreCreateTile.bind(this));
		Hooks.on("lightingRefresh", this.onLightingRefresh.bind(this));
	}

	onRenderTileConfig(app, html, data) {
		let flags = {};

		if (data.data.flags && data.data.flags[DAT.SCOPE]) {
			flags = data.data.flags[DAT.SCOPE];
		}

		const contents = `
			<div class="form-group">
				<label>${game.i18n.localize("LIGHT.DarknessRange")}</label>
				<div class="form-fields">
					<label for="${DAT.SCOPE}.min">${game.i18n.localize("Between")}</label>
					<input type="number" name="${DAT.SCOPE}.min" value="0" min="0" max="1" step="any" placeholder="0">
					<label for="${DAT.SCOPE}.max">${game.i18n.localize("and")}</label>
					<input type="number" name="${DAT.SCOPE}.max" value="1" min="0" max="1" step="any" placeholder="1">
				</div>
				<p class="hint">${game.i18n.localize("DAT.DarknessRangeHint")}</p>
			</div>
		`;

		html.find(`div[data-tab="basic"] .form-group`).last().after(contents);

		html.find(`input[name="${DAT.SCOPE}.min"]`).prop("value", flags.min);
		html.find(`input[name="${DAT.SCOPE}.max"]`).prop("value", flags.max);
		
		if (data.document.data.flags[DAT.SCOPE].min == null) {
			data.document.data.flags[DAT.SCOPE].min = 0;
		}
	}

	onPreUpdateTile(tile, change, options, userId) {
		if (change[DAT.SCOPE]) {
			if (change[DAT.SCOPE].min == null) tile.setFlag(DAT.SCOPE, "min", 0);
			if (change[DAT.SCOPE].min == 0) tile.setFlag(DAT.SCOPE, "min", 0);
			
			if (change[DAT.SCOPE].min) tile.setFlag(DAT.SCOPE, "min", change[DAT.SCOPE].min);
			if (change[DAT.SCOPE].max) tile.setFlag(DAT.SCOPE, "max", change[DAT.SCOPE].max);
		}
	}

	onPreCreateTile(tile, data, options, userId) {
		Hooks.once("createTile", (tile, options, userId) => {
			tile.setFlag(DAT.SCOPE, "min", 0);
			tile.setFlag(DAT.SCOPE, "max", 1);
		});
	}


	onLightingRefresh(lighting) {
		if (!game.user.isGM) {
			return;
		}

		let darknessLevel = lighting.darknessLevel;

		canvas.background.tiles.forEach(tile => {
			let flags = tile.data.flags;

			if (flags && flags[DAT.SCOPE]) {
				if (darknessLevel >= flags[DAT.SCOPE].min && darknessLevel <= flags[DAT.SCOPE].max) {
					tile.document.update({ hidden: false });
				} else {
					tile.document.update({ hidden: true });
				}
			}
		});
	}
}

console.log(DAT.LOG_PREFIX, "Loaded");
Hooks.on("init", () => game.darknessActivatedTiles = new DarknessActivatedTiles());
