# Contributing

Situational Awareness is a Foundry VTT V14 module. It is built only on the public client API: hooks, settings, user flags, the module socket and `CONFIG.Token.objectClass`.

## Building

Build the package into the ignored `situational-awareness/` folder, or build it and install it into a local Foundry:

```sh
npm run build
npm run deploy
```

Deploy replaces `Data/modules/situational-awareness` in the Foundry user data folder. It defaults to the macOS desktop app location. Set `FOUNDRY_DATA` to use another folder. Reload the world in each client afterwards.

Lint with ESLint:

```sh
npm install
npm run lint
```

## Releasing

1. Set the new version in `module.json` and `package.json`.
2. Rename the changelog's Unreleased heading to that version, such as `## 1.0.0`.
3. Commit, then tag and push: `git tag v1.0.0 && git push origin main v1.0.0`.

The Release workflow checks that the tag matches the version in `module.json` and `package.json`, builds `module.zip` and publishes a GitHub release with `module.json` and `module.zip` attached. The release notes come from the changelog section. Foundry finds the latest release through the manifest link, which only works while the repository is public.

To build the zip locally, run `npm run zip`.

## Layout

```
module.json                          Manifest
tools/build.mjs                      Build, zip and deploy script
.github/workflows/release.yml        Publishes a release for each version tag
lang/en.json                         English strings
scripts/main.mjs                     Entry point: hooks, keybinding, scene control, API
scripts/settings.mjs                 Setting registration
scripts/constants.mjs                Module id, socket name
scripts/helpers/observers.mjs        Which tokens the user sees through, distances, wall tests
scripts/helpers/cache.mjs            Values computed once per task, such as settings read during a refresh
scripts/features/proximity-awareness.mjs
scripts/features/last-known-positions.mjs
scripts/canvas/last-known-marker.mjs PIXI marker graphic
scripts/data/marker-style.mjs        Marker style schema
scripts/data/marker-presets.mjs      Ready-made marker styles
scripts/apps/marker-style-config.mjs GM dialog for the marker style
templates/marker-style-config.hbs    Template for that dialog
```

## How it hooks in

- **Proximity awareness** extends `CONFIG.Token.objectClass` during `setup`, after systems have registered their own Token class. It overrides only the `isVisible` getter and defers to core first. Core draws token images beneath the fog, so a revealed ally also gets a detection filter, the same mechanism core uses for tremorsense. Core then draws a copy above the fog, tinted like explored fog.
- **Last known positions** draws its markers just above the token layer, because visible tokens erase their footprint from anything beneath it. It listens to `refreshToken` and records a sighting when a token's `visible` flips from true to false. It ignores transitions for half a second after the canvas loads, while vision initializes. Sightings made by the GM are never shared.

## Manual test checklist

1. As a player, move a token so a hostile token leaves line of sight. A marker appears with an arrow along its last movement.
2. Move back into sight. The marker disappears.
3. Look away from a marker, then back at its spot after the token has left. The marker fades out after the clear delay.
4. Reload. Markers that were still active are restored.
5. With two players connected, one loses sight of a hostile. The other player sees the marker unless they can currently see that token.
6. Place a friendly token behind a wall within range. It stays visible. Enable Walls Block Proximity and it disappears.
7. As GM with no token selected, nothing from this module is drawn.
8. As GM, open Customize Markers, pick a preset on each tab and save. Every player's markers change.
