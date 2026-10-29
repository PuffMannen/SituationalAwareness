import { I18N } from "../constants.mjs";
import { completeMarkerStyle } from "./marker-style.mjs";

/** @import { MarkerKind, MarkerStyle } from "./marker-style.mjs" */

/**
 * Ready-made marker styles for different kinds of game worlds. Each preset lists only the
 * fields that differ from the default style, plus any fields that differ again for allies.
 * Applying one fills in the marker style dialog.
 * @type {Readonly<Record<string, {label: string, style: Partial<MarkerStyle>, ally?: Partial<MarkerStyle>}>>}
 */
export const MARKER_PRESETS = Object.freeze({
  classic: {
    label: `${I18N}.MarkerStyle.Presets.Classic`,
    style: {}
  },
  tactical: {
    label: `${I18N}.MarkerStyle.Presets.Tactical`,
    style: {
      shape: "crosshair", ring: "solid", ringWidth: 0.03,
      colorMode: "custom", color: "#ff3b30",
      image: "none"
    },
    ally: {color: "#0a84ff"}
  },
  espionage: {
    label: `${I18N}.MarkerStyle.Presets.Espionage`,
    style: {
      shape: "bullseye", ring: "solid", ringWidth: 0.025,
      colorMode: "custom", color: "#fff76b",
      image: "none", showHeading: false,
      animation: "pulseSize", animationSpeed: 1.5
    },
    ally: {color: "#74a7fe"}
  },
  scifi: {
    label: `${I18N}.MarkerStyle.Presets.SciFi`,
    style: {
      shape: "hexagon", ring: "solid", ringWidth: 0.03, fillOpacity: 0.12,
      colorMode: "custom", color: "#00e5ff",
      image: "none", label: "custom", labelText: "SIGNAL LOST",
      animation: "pulseGlow", animationSpeed: 2
    },
    ally: {color: "#ff9f0a"}
  },
  arcane: {
    label: `${I18N}.MarkerStyle.Presets.Arcane`,
    style: {
      shape: "pentagram", ring: "solid", ringWidth: 0.025,
      colorMode: "custom", color: "#b388ff",
      imageOpacity: 0.25, label: "none",
      animation: "rotate", animationSpeed: 12
    },
    ally: {color: "#ffd54f"}
  },
  horror: {
    label: `${I18N}.MarkerStyle.Presets.Horror`,
    style: {
      shape: "circle", ring: "dashed",
      colorMode: "custom", color: "#c0001a",
      showHeading: false, imageOpacity: 0.3,
      label: "custom", labelText: "?",
      animation: "pulseFade", animationSpeed: 3
    },
    ally: {color: "#e0e0e0"}
  },
  western: {
    label: `${I18N}.MarkerStyle.Presets.Western`,
    style: {
      shape: "star", ring: "solid", ringWidth: 0.03, fillOpacity: 0.1,
      colorMode: "custom", color: "#d58400"
    },
    ally: {color: "#6d9eeb"}
  },
  tracker: {
    label: `${I18N}.MarkerStyle.Presets.Tracker`,
    style: {
      ring: "none", headingStyle: "large", image: "none"
    }
  },
  minimal: {
    label: `${I18N}.MarkerStyle.Presets.Minimal`,
    style: {
      ring: "none", fillOpacity: 0.5, scale: 0.4,
      showHeading: false, image: "none", label: "none"
    }
  }
});

/**
 * The complete marker style for a preset, applied to one kind of marker.
 * @param {string} key                A key of {@link MARKER_PRESETS}
 * @param {MarkerKind} [kind="enemy"]
 * @returns {MarkerStyle}
 */
export function getPresetStyle(key, kind="enemy") {
  const preset = MARKER_PRESETS[key];
  const style = kind === "ally" ? {...preset?.style, ...preset?.ally} : preset?.style;
  return completeMarkerStyle(style, kind);
}
