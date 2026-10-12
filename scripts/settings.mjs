import { I18N, MODULE_ID } from "./constants.mjs";
import { getMarkerStyleField } from "./data/marker-style.mjs";
import { MarkerStyleConfig } from "./apps/marker-style-config.mjs";

/**
 * Setting keys registered by this module.
 * @enum {string}
 */
export const SETTINGS = Object.freeze({
  PROXIMITY_ENABLED: "proximityEnabled",
  PROXIMITY_RANGE: "proximityRange",
  PROXIMITY_TARGETS: "proximityTargets",
  PROXIMITY_WALLS: "proximityWallsBlock",
  LAST_KNOWN_ENABLED: "lastKnownEnabled",
  LAST_KNOWN_DISPOSITIONS: "lastKnownDispositions",
  LAST_KNOWN_ALLIES: "lastKnownAllies",
  LAST_KNOWN_SHARE: "lastKnownShare",
  LAST_KNOWN_LIFETIME: "lastKnownLifetime",
  LAST_KNOWN_CLEAR: "lastKnownClearEmpty",
  LAST_KNOWN_CLEAR_DELAY: "lastKnownClearDelay",
  LAST_KNOWN_GM: "lastKnownShowGM",
  LAST_KNOWN_STYLE: "lastKnownStyle",
  LAST_KNOWN_ALLY_STYLE: "lastKnownAllyStyle"
});

/**
 * Read one of this module's settings.
 * @param {string} key    A value of {@link SETTINGS}
 * @returns {*}
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * The setting holding each kind of marker style.
 * @type {Readonly<Record<import("./data/marker-style.mjs").MarkerKind, string>>}
 */
export const STYLE_SETTINGS = Object.freeze({
  enemy: SETTINGS.LAST_KNOWN_STYLE,
  ally: SETTINGS.LAST_KNOWN_ALLY_STYLE
});

/**
 * The GM-configured style for one kind of marker, with defaults filled in for any missing field.
 * @param {import("./data/marker-style.mjs").MarkerKind} [kind="enemy"]
 * @returns {import("./data/marker-style.mjs").MarkerStyle}
 */
export function getMarkerStyle(kind="enemy") {
  const defaults = getMarkerStyleField(kind).getInitialValue({});
  return foundry.utils.mergeObject(defaults, getSetting(STYLE_SETTINGS[kind]) ?? {}, {inplace: false});
}

/* -------------------------------------------- */

/**
 * Register all module settings. Called during the init hook.
 * @param {object} callbacks                        Feature callbacks invoked when settings change
 * @param {Function} callbacks.refreshVisibility    Re-evaluate token visibility
 * @param {Function} callbacks.refreshMarkers       Redraw last-known-position markers
 */
export function registerSettings({refreshVisibility, refreshMarkers}) {
  const register = (key, data) => game.settings.register(MODULE_ID, key, {
    name: `${I18N}.Settings.${key}.Name`,
    hint: `${I18N}.Settings.${key}.Hint`,
    config: true,
    ...data
  });

  // Proximity awareness
  register(SETTINGS.PROXIMITY_ENABLED, {scope: "world", type: Boolean, default: true, onChange: refreshVisibility});
  register(SETTINGS.PROXIMITY_RANGE, {
    scope: "world", type: Number, default: 2, range: {min: 1, max: 20, step: 1}, onChange: refreshVisibility
  });
  register(SETTINGS.PROXIMITY_TARGETS, {
    scope: "world", type: String, default: "friendly", onChange: refreshVisibility,
    choices: {
      party: `${I18N}.Settings.${SETTINGS.PROXIMITY_TARGETS}.Party`,
      friendly: `${I18N}.Settings.${SETTINGS.PROXIMITY_TARGETS}.Friendly`,
      all: `${I18N}.Settings.${SETTINGS.PROXIMITY_TARGETS}.All`
    }
  });
  register(SETTINGS.PROXIMITY_WALLS, {scope: "world", type: Boolean, default: false, onChange: refreshVisibility});

  // Last known positions
  register(SETTINGS.LAST_KNOWN_ENABLED, {scope: "world", type: Boolean, default: true, onChange: refreshMarkers});
  register(SETTINGS.LAST_KNOWN_DISPOSITIONS, {
    scope: "world", type: String, default: "hostile", onChange: refreshMarkers,
    choices: {
      hostile: `${I18N}.Settings.${SETTINGS.LAST_KNOWN_DISPOSITIONS}.Hostile`,
      hostileNeutral: `${I18N}.Settings.${SETTINGS.LAST_KNOWN_DISPOSITIONS}.HostileNeutral`,
      all: `${I18N}.Settings.${SETTINGS.LAST_KNOWN_DISPOSITIONS}.All`
    }
  });
  register(SETTINGS.LAST_KNOWN_ALLIES, {scope: "world", type: Boolean, default: true, onChange: refreshMarkers});
  register(SETTINGS.LAST_KNOWN_SHARE, {scope: "world", type: Boolean, default: true});
  register(SETTINGS.LAST_KNOWN_LIFETIME, {
    scope: "world", type: Number, default: 0, range: {min: 0, max: 100, step: 1}, onChange: refreshMarkers
  });
  register(SETTINGS.LAST_KNOWN_CLEAR, {scope: "world", type: Boolean, default: true, onChange: refreshMarkers});
  register(SETTINGS.LAST_KNOWN_CLEAR_DELAY, {
    scope: "world", type: Number, default: 2, range: {min: 0, max: 30, step: 1}, onChange: refreshMarkers
  });
  register(SETTINGS.LAST_KNOWN_GM, {scope: "client", type: Boolean, default: false, onChange: refreshMarkers});

  // Marker appearance, edited by the GM through its own form rather than the settings list
  for ( const [kind, key] of Object.entries(STYLE_SETTINGS) ) {
    const styleField = getMarkerStyleField(kind);
    game.settings.register(MODULE_ID, key, {
      scope: "world",
      config: false,
      type: styleField,
      default: styleField.getInitialValue({}),
      onChange: refreshMarkers
    });
  }
  game.settings.registerMenu(MODULE_ID, `${SETTINGS.LAST_KNOWN_STYLE}Menu`, {
    name: `${I18N}.Settings.${SETTINGS.LAST_KNOWN_STYLE}.Name`,
    label: `${I18N}.Settings.${SETTINGS.LAST_KNOWN_STYLE}.Label`,
    hint: `${I18N}.Settings.${SETTINGS.LAST_KNOWN_STYLE}.Hint`,
    icon: "fa-solid fa-location-crosshairs",
    type: MarkerStyleConfig,
    restricted: true
  });

}
