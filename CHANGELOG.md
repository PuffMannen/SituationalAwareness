# Changelog

## Unreleased

- Released under the MIT License.
- Markers fade out when you see their spot again and the token is gone. The new Clear Empty Markers and Clear Delay settings control this.
- Last known positions for allies. Player-owned and friendly tokens you do not own can leave markers, controlled by the new Track Allies setting.
- The marker dialog has an Enemies tab and an Allies tab, so allies can have their own style. Presets work on both tabs.
- Tracked Tokens now applies only to tokens that are not allies. Its "All" option is renamed "All other tokens".
- Reset to Defaults in the marker dialog now fills in the open tab instead of saving at once. Save to keep the change.
- Foundry VTT V14 is now the minimum version. V13 was never tested.
- Marker presets for different game worlds: Classic, Modern tactical, Espionage, Science fiction, Arcane fantasy, Horror, Western, Tracker and Minimal. Picking one fills in the marker dialog.
- New marker shapes: square, diamond, triangle, hexagon, star, pentagram, target cross and target bullseye. The outline can be dashed, solid or none for any shape, and the shape can be filled.
- A large heading arrow through the marker, as an alternative to the small arrowhead.
- Marker animations: pulsing fade, pulsing size, pulsing glow and rotation.
- Fixed: saving the marker dialog had no effect, so markers always used the default style.
- Fixed: the marker dialog could not scroll when it was taller than the screen.
- Fixed: with Show Markers to GM on, the GM's sightings were shared with players, revealing enemies they never saw. The GM's markers now stay with the GM.
- Fixed: shared sightings for another scene could overwrite each other when two arrived at once.
- Fixed: narrowing Tracked Tokens or turning off Track Allies left old markers for tokens no longer tracked. Markers are checked again whenever settings change.
- Fixed: changing scene quickly could leave a burst of false markers on the new scene.
- Proximity awareness and marker tracking read their settings once per refresh instead of once per token, which helps on busy scenes.
- Removed trailing fog to keep the module focused. Its settings are no longer registered, and saved fog exploration was never changed by it, so nothing needs cleaning up.

## 0.2.0

- The GM can customize last known position markers from a new settings dialog: color, size, opacity, outline, heading arrow, image and label.
- The client setting Show Ghost Image is replaced by the Image option in that dialog.
- Fixed: allies revealed by proximity were hidden by the fog of war in unexplored areas. They are now shown, tinted with the scene's explored fog color.
- Fixed: last known position markers only showed their ring. The heading arrow, label and ghost image now render.
- Fixed: markers could be cut by visible tokens standing on them. Markers now draw above the token layer.

## 0.1.0

- Proximity awareness: allied tokens near your tokens stay visible.
- Last known positions: markers with heading and age for tokens that leave your sight, persisted per user and optionally shared with the party.
- Trailing fog: explored areas fade back into fog beyond a set distance from your tokens.
