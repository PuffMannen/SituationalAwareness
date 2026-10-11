import { I18N } from "../constants.mjs";

/**
 * @typedef MarkerStyle
 * @property {"disposition"|"custom"} colorMode   Color by token disposition, or one custom color
 * @property {string} color                       Custom color as a hex string
 * @property {"dashed"|"solid"|"none"} ring       Outline drawn around the marker
 * @property {number} ringWidth                   Outline thickness as a fraction of the grid size
 * @property {boolean} showHeading                Draw an arrow for the last direction of travel
 * @property {"ghost"|"custom"|"none"} image      Token image, a custom image, or no image
 * @property {string|null} imagePath              Path of the custom image
 * @property {number} imageOpacity                Opacity of the image
 * @property {boolean} desaturate                 Render the image in grayscale
 * @property {"age"|"custom"|"none"} label        Elapsed time, custom text, or no label
 * @property {string} labelText                   Custom label text. "{rounds}" is replaced by the age
 * @property {number} scale                       Size relative to the sighted token
 * @property {number} opacity                     Opacity of the whole marker
 */

/**
 * Choices for the marker style select fields, as localization keys.
 * @type {Record<string, Record<string, string>>}
 */
export const MARKER_STYLE_CHOICES = Object.freeze({
  colorMode: {
    disposition: `${I18N}.MarkerStyle.colorMode.Disposition`,
    custom: `${I18N}.MarkerStyle.colorMode.Custom`
  },
  ring: {
    dashed: `${I18N}.MarkerStyle.ring.Dashed`,
    solid: `${I18N}.MarkerStyle.ring.Solid`,
    none: `${I18N}.MarkerStyle.ring.None`
  },
  image: {
    ghost: `${I18N}.MarkerStyle.image.Ghost`,
    custom: `${I18N}.MarkerStyle.image.Custom`,
    none: `${I18N}.MarkerStyle.image.None`
  },
  label: {
    age: `${I18N}.MarkerStyle.label.Age`,
    custom: `${I18N}.MarkerStyle.label.Custom`,
    none: `${I18N}.MarkerStyle.label.None`
  }
});

/**
 * The shared schema instance, created on first use once Foundry's field classes are available.
 * @type {foundry.data.fields.SchemaField|null}
 */
let markerStyleField = null;

/**
 * The schema describing how last known position markers look.
 * Used as the type of the world setting, so stored values are cleaned and validated by core.
 * @returns {foundry.data.fields.SchemaField}
 */
export function getMarkerStyleField() {
  markerStyleField ??= createMarkerStyleField();
  return markerStyleField;
}

/**
 * Construct the marker style schema.
 * @returns {foundry.data.fields.SchemaField}
 */
function createMarkerStyleField() {
  const f = foundry.data.fields;
  const C = MARKER_STYLE_CHOICES;
  return new f.SchemaField({
    colorMode: new f.StringField({required: true, blank: false, choices: C.colorMode, initial: "disposition"}),
    color: new f.ColorField({required: true, nullable: false, initial: "#e72124"}),
    ring: new f.StringField({required: true, blank: false, choices: C.ring, initial: "dashed"}),
    ringWidth: new f.NumberField({required: true, nullable: false, min: 0.01, max: 0.2, step: 0.01, initial: 0.04}),
    showHeading: new f.BooleanField({initial: true}),
    image: new f.StringField({required: true, blank: false, choices: C.image, initial: "ghost"}),
    imagePath: new f.FilePathField({categories: ["IMAGE"], initial: null}),
    imageOpacity: new f.AlphaField({initial: 0.35}),
    desaturate: new f.BooleanField({initial: true}),
    label: new f.StringField({required: true, blank: false, choices: C.label, initial: "age"}),
    labelText: new f.StringField({required: true, blank: true, initial: "?"}),
    scale: new f.NumberField({required: true, nullable: false, min: 0.25, max: 3, step: 0.05, initial: 1}),
    opacity: new f.AlphaField({initial: 1})
  });
}
