# Darkness Activated Tiles

![GitHub all releases](https://img.shields.io/github/downloads/caelwarner/darkness-activated-tiles/total?style=for-the-badge) ![FoundryVTT Version](https://img.shields.io/badge/FoundryVTT-v13%20%7C%20v14-orange?style=for-the-badge) ![GitHub License](https://img.shields.io/github/license/caelwarner/darkness-activated-tiles?color=blue&style=for-the-badge)

Darkness Activated Tiles allows tiles to be hidden when the darkness level in a scene goes outside a customizable range. It works the same as the darkness activation range works with ambient lights and sounds.

![Video](https://github.com/caelwarner/DarknessActivatedTiles/blob/feb436be94d8b8cf93588f0f2ac70fe1376be6ed/video.gif?raw=true)

## Usage

Using Darkness Activated Tiles is simple. In a tile config menu, under the **Appearance** tab, there is a setting called **Darkness Activation Range**. Just change the values to your liking and the tile will only be visible whenever the darkness level in the scene is within the range or equal to the minimum/maximum. Leaving the range at 0 to 1 means the tile is always visible, exactly like the darkness activation range on ambient lights and sounds.
![Tile Config](https://i.gyazo.com/114efe01cd5479b4ea87054eea276db9.png)

## Installation

Installation can be done with either Foundry's built-in module browser or by using the URL below:

> https://github.com/caelwarner/DarknessActivatedTiles/releases/latest/download/module.json

Remember to enable the module in the **Manage Modules** menu in Foundry.

## Supported Versions

FoundryVTT v13 and v14 work. For FoundryVTT v12 use version 1.2.x and for FoundryVTT v11 use version 1.1.x. Versions lower than FoundryVTT v10 will not work. Use version 0.2.0 for older versions of FoundryVTT, however, note that version 0.2.0 has bugs.

## Found a Bug?

Check the issues on this GitHub repository to see if it's already there. If not, please report it by creating a new issue. Thanks!

## Changelog

- 1.3:
  - Update to FoundryVTT v13 and v14
  - Tile visibility is now worked out locally by each client, the same way ambient lights handle darkness activation. The module no longer changes a tile's Hidden setting and no longer needs a GM to be connected
  - Removed the *Enabled* toggle. A range of 0 to 1 now means the tile is always visible, matching ambient lights and sounds. Tiles that had the range disabled are reset to 0 to 1 automatically, and tiles hidden by earlier versions are unhidden
  - Fixed tiles not updating when the darkness level changed if any tile in the scene had never been configured (#10)
  - Fixed a conflict with Monk's Active Tile Triggers that stopped its trigger dropdown from opening (#7)
- 1.2:
  - Update to FoundryVTT v12
- 1.1:
  - Update to FoundryVTT v11
- 1.0:
  - Rewrote the whole module to fix bugs and improve stability
  - Added toggle to enable the darkness activation range. This allows the user to manually show and hide their own tiles without having this module constantly trying to override those changes.
- 0.2: 
  - Fixed module.js not being included in module.zip, therefore there was no code to load
  - Moved module.js to scripts/module.js
- 0.1: 
  - First version.
