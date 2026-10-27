/**
 * Situational Awareness: Fog of War enhancements for Foundry Virtual Tabletop.
 * Entry point. Wires settings, hooks and the public module API.
 * @module
 */

import { I18N, MODULE_ID } from "./constants.mjs";
import { registerSettings } from "./settings.mjs";
import { ProximityAwareness } from "./features/proximity-awareness.mjs";
import { LastKnownPositions } from "./features/last-known-positions.mjs";
import { registerShareControls } from "./apps/share-sightings-controls.mjs";

Hooks.once("init", () => {
  registerSettings({
    refreshVisibility: () => ProximityAwareness.refresh(),
    refreshMarkers: () => LastKnownPositions.refresh(),
    resetTracking: () => LastKnownPositions.resetTracking()
  });

  game.keybindings.register(MODULE_ID, "clearMarkers", {
    name: `${I18N}.Keybindings.ClearMarkers.Name`,
    hint: `${I18N}.Keybindings.ClearMarkers.Hint`,
    editable: [],
    onDown: () => {
      LastKnownPositions.clear();
      return true;
    }
  });

  LastKnownPositions.registerHooks();
  registerShareControls();
});

/* -------------------------------------------- */

// Systems replace CONFIG.Token.objectClass during their own init. Extending it in setup
// layers this module on top of the system's class instead of overwriting it.
Hooks.once("setup", () => ProximityAwareness.extendTokenClass());

/* -------------------------------------------- */

Hooks.once("ready", () => {
  LastKnownPositions.activateSocket();

  /**
   * Public API, available as game.modules.get("situational-awareness").api
   */
  game.modules.get(MODULE_ID).api = Object.freeze({
    clearMarkers: () => LastKnownPositions.clear(),
    getSightings: () => LastKnownPositions.getSightings(),
    debugMarkers: () => LastKnownPositions.debug(),
    isProximityAware: token => ProximityAwareness.isAware(token),
    refresh: () => {
      ProximityAwareness.refresh();
      LastKnownPositions.refresh();
    }
  });
});

/* -------------------------------------------- */

Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls.tokens;
  if ( !tokens?.tools ) return;
  tokens.tools.situationalAwarenessClear = {
    name: "situationalAwarenessClear",
    title: `${I18N}.Controls.ClearMarkers`,
    icon: "fa-solid fa-location-crosshairs",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => LastKnownPositions.clear()
  };
});
