# Situational Awareness

A Foundry Virtual Tabletop module that extends Fog of War with tools that help players keep track of the battlefield.

Targets Foundry VTT V13 and V14. It is built only on the public client API: hooks, settings, user flags, the module socket and `CONFIG.Token.objectClass`.

## Features

### Last known positions

When a tracked token leaves your sight, a marker stays where you last saw it.

- A dashed ring in the token's disposition color, with a faded ghost of its image.
- An arrow showing the direction it was moving when you last saw it.
- A label with how many rounds ago it was seen. Outside combat, elapsed game time is converted to rounds.
- The marker disappears as soon as the token is seen again, or when it is deleted.
- Markers are saved in your user flags, so they survive reloads and scene changes.
- With sharing enabled, a sighting by one player reaches every other player. A newer sighting replaces an older one.
- Tokens hidden by the GM do not leave a marker.

The GM decides how markers look for everyone. Open Configure Settings, find Situational Awareness and click Customize Markers. The dialog controls:

- **Color:** the token's disposition color, or one custom color.
- **Size and opacity** of the whole marker.
- **Outline:** dashed circle, solid circle or none, and its thickness.
- **Heading arrow:** on or off.
- **Image:** the token's own image, a custom image such as a question mark, or none. Opacity and grayscale are adjustable.
- **Label:** time since seen, custom text, or none. Custom text can include `{rounds}` for the age in rounds.

Changes apply to every connected player as soon as the GM saves.

Clear all markers on a scene with the button in the Token controls, or bind a key under Configure Controls.

### Proximity awareness

Allied tokens within a set range of one of your tokens stay visible, even around corners or in darkness. You choose whether this covers player-owned tokens, friendly tokens or all tokens, and whether walls block it. Tokens with a secret disposition are never revealed.

### Trailing fog

Explored areas fade back into fog the further they are from your tokens. Everything inside the trail distance stays clear, then fades out over the fade length. Anything currently in line of sight is never covered. This is a visual overlay only: saved fog exploration is not changed, and turning the feature off restores the normal view.

## Settings

| Setting | Scope | Default |
| --- | --- | --- |
| Proximity Awareness | World | On |
| Proximity Range | World | 2 grid spaces |
| Proximity Targets | World | Player-owned and friendly |
| Walls Block Proximity | World | Off |
| Last Known Positions | World | On |
| Tracked Tokens | World | Hostile |
| Share Sightings With Party | World | On |
| Marker Lifetime | World | 0, meaning never expire |
| Show Markers to GM | Client | Off |
| Marker Appearance | World, GM only | Dashed ring, token image, time label |
| Trailing Fog | World | On |
| Trailing Fog Distance | World | 12 grid spaces |
| Trailing Fog Fade Length | World | 8 grid spaces |
| Trailing Fog Strength | World | 0.85 |
| Trailing Fog Resolution | Client | 0.25 |

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

Link the folder into your Foundry data directory so the module id matches the folder name:

```sh
ln -s "$(pwd)" "<FoundryData>/Data/modules/situational-awareness"
```

Lint with ESLint:

```sh
npm install
npm run lint
```

### Layout

```
module.json                          Manifest
lang/en.json                         English strings
scripts/main.mjs                     Entry point: hooks, keybinding, scene control, API
scripts/settings.mjs                 Setting registration
scripts/constants.mjs                Module id, socket name
scripts/helpers/observers.mjs        Which tokens the user sees through, distances, wall tests
scripts/features/proximity-awareness.mjs
scripts/features/last-known-positions.mjs
scripts/features/trailing-fog.mjs
scripts/canvas/last-known-marker.mjs PIXI marker graphic
scripts/data/marker-style.mjs        Marker style schema
scripts/apps/marker-style-config.mjs GM dialog for the marker style
templates/marker-style-config.hbs    Template for that dialog
```

### How it hooks in

- **Proximity awareness** extends `CONFIG.Token.objectClass` during `setup`, after systems have registered their own Token class. It overrides only the `isVisible` getter and defers to core first. Core draws token images beneath the fog, so a revealed ally also gets a detection filter, the same mechanism core uses for tremorsense. Core then draws a copy above the fog, tinted like explored fog.
- **Last known positions** draws its markers just above the token layer, because visible tokens erase their footprint from anything beneath it. It listens to `refreshToken` and records a sighting when a token's `visible` flips from true to false. It ignores transitions for half a second after the canvas loads, while vision initializes.
- **Trailing fog** renders a mask into a render texture on `sightRefresh`. The mask is a full-scene fill with radial gradients and current line of sight erased from it. It is tinted with the scene's unexplored fog color and placed at the bottom of the interface group.

## Manual test checklist

1. As a player, move a token so a hostile token leaves line of sight. A marker appears with an arrow along its last movement.
2. Move back into sight. The marker disappears.
3. Reload. Markers that were still active are restored.
4. With two players connected, one loses sight of a hostile. The other player sees the marker unless they can currently see that token.
5. Place a friendly token behind a wall within range. It stays visible. Enable Walls Block Proximity and it disappears.
6. Walk a token away from an explored area. The area fades to fog beyond the trail distance.
7. As GM with no token selected, nothing from this module is drawn.

## Known limitations

- Trailing fog tints with the unexplored fog color. Scenes using a custom fog overlay image show a flat color in faded areas instead of that image.
- Proximity is measured between token centers in straight-line grid spaces, not with the grid's diagonal rules.
- Sightings are recorded by each client from its own vision. Two players with different vision may record different positions for the same token.
