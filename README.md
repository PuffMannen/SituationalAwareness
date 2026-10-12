# Situational Awareness

A Foundry Virtual Tabletop module that extends Fog of War with tools that help players keep track of the battlefield.

Requires Foundry VTT V14. It is built only on the public client API: hooks, settings, user flags, the module socket and `CONFIG.Token.objectClass`.

## Features

### Last known positions

When a tracked token leaves your sight, a marker stays where you last saw it.

- A dashed ring in the token's disposition color, with a faded ghost of its image.
- An arrow showing the direction it was moving when you last saw it.
- A label with how many rounds ago it was seen. Outside combat, elapsed game time is converted to rounds.
- The marker disappears as soon as the token is seen again, or when it is deleted.
- When you see a marked spot again and the token is gone, the marker fades out after a short delay. This only happens once the spot has been out of your sight, so a token slipping around a corner still leaves its marker.
- Markers are saved in your user flags, so they survive reloads and scene changes.
- With sharing enabled, a sighting by one player reaches every other player. A newer sighting replaces an older one.
- Tokens hidden by the GM do not leave a marker.
- Allies, meaning player-owned or friendly tokens you do not own, can leave markers too. Turn this on or off with Track Allies.

The GM decides how markers look for everyone. Open Configure Settings, find Situational Awareness and click Customize Markers. Enemies and allies each have their own tab with the same options.

Start from a preset to match your game world: Classic, Modern tactical, Espionage, Science fiction, Arcane fantasy, Horror, Western, Tracker or Minimal. A preset fills in the form, and you can adjust any field before saving. The dialog controls:

- **Color:** the token's disposition color, or one custom color.
- **Size and opacity** of the whole marker.
- **Shape:** circle, square, diamond, triangle, hexagon, star, pentagram, target cross or target bullseye.
- **Outline:** dashed, solid or none, and its thickness. An optional fill colors the inside of the shape.
- **Heading arrow:** off, a small arrowhead on the edge, or a large arrow through the marker.
- **Image:** the token's own image, a custom image such as a question mark, or none. Opacity and grayscale are adjustable.
- **Label:** time since seen, custom text, or none. Custom text can include `{rounds}` for the age in rounds.
- **Animation:** none, pulsing fade, pulsing size, pulsing glow or rotation, with an adjustable cycle length.

Changes apply to every connected player as soon as the GM saves.

Clear all markers on a scene with the button in the Token controls, or bind a key under Configure Controls.

### Proximity awareness

Allied tokens within a set range of one of your tokens stay visible, even around corners or in darkness. You choose whether this covers player-owned tokens, friendly tokens or all tokens, and whether walls block it. Tokens with a secret disposition are never revealed.

## Settings

| Setting | Scope | Default |
| --- | --- | --- |
| Proximity Awareness | World | On |
| Proximity Range | World | 2 grid spaces |
| Proximity Targets | World | Player-owned and friendly |
| Walls Block Proximity | World | Off |
| Last Known Positions | World | On |
| Tracked Tokens | World | Hostile |
| Track Allies | World | On |
| Share Sightings With Party | World | On |
| Marker Lifetime | World | 0, meaning never expire |
| Clear Empty Markers | World | On |
| Clear Delay | World | 2 seconds |
| Show Markers to GM | Client | Off |
| Marker Appearance | World, GM only | Dashed ring, token image, time label, for enemies and allies alike |

## API

Other modules and macros can use `game.modules.get("situational-awareness").api`:

```js
const api = game.modules.get("situational-awareness").api;
api.clearMarkers();           // Remove this user's markers on the current scene
api.getSightings();           // Array of sighting data for the current scene
api.isProximityAware(token);  // Whether proximity keeps this token visible
api.refresh();                // Re-evaluate all features
```

## Development

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

### Layout

```
module.json                          Manifest
tools/build.mjs                      Build and deploy script
lang/en.json                         English strings
scripts/main.mjs                     Entry point: hooks, keybinding, scene control, API
scripts/settings.mjs                 Setting registration
scripts/constants.mjs                Module id, socket name
scripts/helpers/observers.mjs        Which tokens the user sees through, distances, wall tests
scripts/features/proximity-awareness.mjs
scripts/features/last-known-positions.mjs
scripts/canvas/last-known-marker.mjs PIXI marker graphic
scripts/data/marker-style.mjs        Marker style schema
scripts/data/marker-presets.mjs      Ready-made marker styles
scripts/apps/marker-style-config.mjs GM dialog for the marker style
templates/marker-style-config.hbs    Template for that dialog
```

### How it hooks in

- **Proximity awareness** extends `CONFIG.Token.objectClass` during `setup`, after systems have registered their own Token class. It overrides only the `isVisible` getter and defers to core first. Core draws token images beneath the fog, so a revealed ally also gets a detection filter, the same mechanism core uses for tremorsense. Core then draws a copy above the fog, tinted like explored fog.
- **Last known positions** draws its markers just above the token layer, because visible tokens erase their footprint from anything beneath it. It listens to `refreshToken` and records a sighting when a token's `visible` flips from true to false. It ignores transitions for half a second after the canvas loads, while vision initializes.

## Manual test checklist

1. As a player, move a token so a hostile token leaves line of sight. A marker appears with an arrow along its last movement.
2. Move back into sight. The marker disappears.
3. Reload. Markers that were still active are restored.
4. With two players connected, one loses sight of a hostile. The other player sees the marker unless they can currently see that token.
5. Place a friendly token behind a wall within range. It stays visible. Enable Walls Block Proximity and it disappears.
6. As GM with no token selected, nothing from this module is drawn.

## Known limitations

- Proximity is measured between token centers in straight-line grid spaces, not with the grid's diagonal rules.
- Sightings are recorded by each client from its own vision. Two players with different vision may record different positions for the same token.
