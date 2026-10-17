# Situational Awareness

Fog of War hides what your players can't see. Situational Awareness helps them remember what they *did* see.

When an enemy slips out of sight, a marker stays where it was last seen, pointing the way it was heading and showing how long ago that was. Allies standing right next to you stay visible, even around a corner or in the dark. The table spends less time asking "wait, where was the orc?" and more time playing.

![Last known position markers in Foundry VTT: dashed rings with heading arrows and "Just now" labels where tokens left the players' sight](docs/situational-awareness.png)

- **Last known positions:** a marker where each enemy was last seen, with its heading and time since.
- **Shared sightings:** what one player sees, the whole party knows.
- **Proximity awareness:** allies within a few squares never vanish into the fog.
- **Your look, your world:** nine ready-made marker styles, from Western to Horror, and full control over every detail.
- **System agnostic:** built to work with any game system on Foundry VTT V14.

## Installation

In Foundry, open **Add-on Modules** and click **Install Module**. Search for Situational Awareness, or paste this manifest URL:

```
https://github.com/PuffMannen/SituationalAwareness/releases/latest/download/module.json
```

Then enable the module in your world under **Manage Modules**. Both features are on by default.

## Last known positions

When a token you're tracking leaves your sight, a marker appears where you last saw it.

- A faded ghost of the token's image inside a ring in its disposition color, so you know who it was.
- An arrow showing which way it was moving.
- A label with how many rounds ago you saw it. Outside combat, elapsed game time counts as rounds.

The marker goes away when you see the token again, or when it's deleted. If you look back at the marked spot and the token isn't there, the marker fades out after a short delay. That only happens once the spot has been out of your sight, so an enemy ducking around a corner still leaves its marker.

Markers are saved per player, so they survive reloads and scene changes. With sharing on, what one player sees, the whole party knows. While any player can see a tracked token, everyone else sees a marker that follows it. When the last player loses sight of it, the marker stays where it was last seen. The newest sighting of a token wins. Tokens the GM hides are removed from play, not lost from sight, so they never leave a marker, and hiding a token clears any marker it already had.

By default only hostile tokens are tracked. You can track neutral tokens too, and allies you don't own, which get their own marker style.

To clear every marker on a scene, use the button in the Token controls, or bind a key under **Configure Controls**.

### Customizing markers

As GM, open **Configure Settings**, find Situational Awareness and click **Customize Markers**. Enemies and allies each have a tab, so you can tell them apart at a glance.

Start from a preset that matches your game: Classic, Modern tactical, Espionage, Science fiction, Arcane fantasy, Horror, Western, Tracker or Minimal. A preset fills in the form, and you can adjust anything before saving. You control:

- **Color:** the token's disposition color, or one color of your choice.
- **Size and opacity** of the whole marker.
- **Shape:** circle, square, diamond, triangle, hexagon, star, pentagram, target cross or target bullseye.
- **Outline:** dashed, solid or none, its thickness, and an optional fill.
- **Heading arrow:** off, a small arrowhead on the edge, or a large arrow through the marker.
- **Image:** the token's own image, a custom image such as a question mark, or none, with adjustable opacity and grayscale.
- **Label:** time since seen, your own text, or none. Your text can include `{rounds}` for the age in rounds.
- **Animation:** none, pulsing fade, pulsing size, pulsing glow or rotation, at the speed you choose.

Saving updates the markers for every connected player straight away.

## Proximity awareness

Allied tokens close to one of your tokens stay visible, even outside your line of sight or in darkness. You always know where the people standing next to you are. A sensed ally is tinted like explored fog, so it's clear you're aware of it rather than seeing it.

Choose the range, whether it covers player-owned tokens, friendly tokens or all tokens, and whether walls block it. Tokens with a secret disposition are never revealed.

## Settings

All settings are under **Configure Settings → Situational Awareness**.

| Setting | Default | What it does |
| --- | --- | --- |
| Proximity Awareness | On | Keep nearby allies visible. |
| Proximity Range | 2 grid spaces | How close an ally must be, measured between token centers. |
| Proximity Targets | Player-owned and friendly | Which tokens proximity keeps visible. |
| Walls Block Proximity | Off | A sight-blocking wall between two tokens cancels proximity. |
| Last Known Positions | On | Leave markers where tracked tokens were last seen. |
| Tracked Tokens | Hostile | Which tokens other than allies leave markers: hostile, hostile and neutral, or all. |
| Track Allies | On | Leave markers for allies you don't own. |
| Share Sightings With Party | On | Show every player a marker for tracked tokens any other player can see or last saw. |
| Marker Lifetime | 0 (never) | Remove markers after this many rounds. |
| Clear Empty Markers | On | Fade out a marker when you see its spot again and the token is gone. |
| Clear Delay | 2 seconds | How long an empty spot must stay in view before its marker fades. |
| Show Markers to GM | Off | Let the GM get markers while controlling tokens. Set per GM client. The GM's markers are never shared with players. |
| Customize Markers | Dashed ring, ghost image, time label | How markers look for every player, for enemies and allies. |

Every setting except Show Markers to GM applies to the whole world, and only the GM can change it.

## Good to know

- Each player's markers come from their own vision. Two players who see differently can have different markers for the same token.
- Proximity is measured in a straight line between token centers, not with the grid's diagonal rules.
- The GM gets no markers unless Show Markers to GM is on, and then only while controlling a token, because with no token selected the GM sees everything.

## For macro and module authors

Other modules and macros can use the module's API:

```js
const api = game.modules.get("situational-awareness").api;
api.clearMarkers();           // Remove this user's markers on the current scene
api.getSightings();           // Array of sighting data for the current scene
api.isProximityAware(token);  // Whether proximity keeps this token visible
api.refresh();                // Re-evaluate all features
```

Building, testing and releasing the module is covered in [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

- **Questions, ideas and feedback:** start a thread in [Discussions](https://github.com/PuffMannen/SituationalAwareness/discussions).
- **Something broken:** open an [issue](https://github.com/PuffMannen/SituationalAwareness/issues). Include your Foundry version, your game system and what you expected to happen.

## License

Released under the [MIT License](LICENSE). Foundry Virtual Tabletop itself is covered by Foundry's own terms.
