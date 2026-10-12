# Changelog

## Unreleased

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
