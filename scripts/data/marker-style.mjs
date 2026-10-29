import { I18N } from "../constants.mjs";

/**
 * @typedef MarkerStyle
 * @property {"disposition"|"custom"} colorMode   Color by token disposition, or one custom color
 * @property {string} color                       Custom color as a hex string
 * @property {MarkerShape} shape                  Shape of the marker
 * @property {"dashed"|"solid"|"none"} ring       Line style of the shape's outline
 * @property {number} ringWidth                   Outline thickness as a fraction of the grid size
 * @property {number} fillOpacity                 Opacity of the fill inside the shape. 0 means no fill
 * @property {boolean} showHeading                Draw an arrow for the last direction of travel
 * @property {"edge"|"large"} headingStyle        A small arrowhead on the edge, or a large arrow
 * @property {"ghost"|"custom"|"icon"|"none"} image  Token image, a custom image, an icon, or no image
 * @property {string|null} imagePath              Path of the custom image
 * @property {string} icon                        Font Awesome classes of the icon, such as "fa-solid fa-skull"
 * @property {number} imageOpacity                Opacity of the image
 * @property {boolean} desaturate                 Render the image in grayscale
 * @property {"age"|"custom"|"none"} label        Elapsed time, custom text, or no label
 * @property {string} labelText                   Custom label text. "{rounds}" is replaced by the age
 * @property {number} scale                       Size relative to the sighted token
 * @property {number} opacity                     Opacity of the whole marker
 * @property {MarkerAnimation} animation          Looping animation
 * @property {number} animationSpeed              Length of one animation cycle in seconds
 */

/**
 * @typedef {"circle"|"square"|"diamond"|"triangle"|"hexagon"|"star"|"pentagram"|"crosshair"|"bullseye"} MarkerShape
 */

/**
 * @typedef {"none"|"pulseFade"|"pulseSize"|"pulseGlow"|"rotate"} MarkerAnimation
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
  shape: {
    circle: `${I18N}.MarkerStyle.shape.Circle`,
    square: `${I18N}.MarkerStyle.shape.Square`,
    diamond: `${I18N}.MarkerStyle.shape.Diamond`,
    triangle: `${I18N}.MarkerStyle.shape.Triangle`,
    hexagon: `${I18N}.MarkerStyle.shape.Hexagon`,
    star: `${I18N}.MarkerStyle.shape.Star`,
    pentagram: `${I18N}.MarkerStyle.shape.Pentagram`,
    crosshair: `${I18N}.MarkerStyle.shape.Crosshair`,
    bullseye: `${I18N}.MarkerStyle.shape.Bullseye`
  },
  ring: {
    dashed: `${I18N}.MarkerStyle.ring.Dashed`,
    solid: `${I18N}.MarkerStyle.ring.Solid`,
    none: `${I18N}.MarkerStyle.ring.None`
  },
  headingStyle: {
    edge: `${I18N}.MarkerStyle.headingStyle.Edge`,
    large: `${I18N}.MarkerStyle.headingStyle.Large`
  },
  image: {
    ghost: `${I18N}.MarkerStyle.image.Ghost`,
    custom: `${I18N}.MarkerStyle.image.Custom`,
    icon: `${I18N}.MarkerStyle.image.Icon`,
    none: `${I18N}.MarkerStyle.image.None`
  },
  label: {
    age: `${I18N}.MarkerStyle.label.Age`,
    custom: `${I18N}.MarkerStyle.label.Custom`,
    none: `${I18N}.MarkerStyle.label.None`
  },
  animation: {
    none: `${I18N}.MarkerStyle.animation.None`,
    pulseFade: `${I18N}.MarkerStyle.animation.PulseFade`,
    pulseSize: `${I18N}.MarkerStyle.animation.PulseSize`,
    pulseGlow: `${I18N}.MarkerStyle.animation.PulseGlow`,
    rotate: `${I18N}.MarkerStyle.animation.Rotate`
  }
});

/**
 * The kinds of marker, each with its own style setting.
 * "enemy" covers every tracked token which is not an ally.
 * @typedef {"enemy"|"ally"} MarkerKind
 */

/**
 * Schema instances by marker kind, created on first use once Foundry's field classes are available.
 * Both kinds share the same defaults. Each still needs its own instance, because core binds a
 * setting's type to that setting's path.
 * @type {Partial<Record<MarkerKind, foundry.data.fields.SchemaField>>}
 */
const markerStyleFields = {};

/**
 * The schema describing how one kind of last known position marker looks.
 * Used as the type of that kind's world setting, so stored values are cleaned and validated by core.
 * @param {MarkerKind} [kind="enemy"]
 * @returns {foundry.data.fields.SchemaField}
 */
export function getMarkerStyleField(kind="enemy") {
  markerStyleFields[kind] ??= createMarkerStyleField();
  return markerStyleFields[kind];
}

/**
 * A complete marker style: the given fields, with defaults filled in for any that are missing.
 * @param {Partial<MarkerStyle>|null|undefined} style
 * @param {MarkerKind} [kind="enemy"]
 * @returns {MarkerStyle}
 */
export function completeMarkerStyle(style, kind="enemy") {
  const defaults = getMarkerStyleField(kind).getInitialValue({});
  return foundry.utils.mergeObject(defaults, style ?? {}, {inplace: false});
}

/**
 * Construct a marker style schema.
 * @returns {foundry.data.fields.SchemaField}
 */
function createMarkerStyleField() {
  const f = foundry.data.fields;
  const C = MARKER_STYLE_CHOICES;
  return new f.SchemaField({
    colorMode: new f.StringField({required: true, blank: false, choices: C.colorMode, initial: "disposition"}),
    color: new f.ColorField({required: true, nullable: false, initial: "#e72124"}),
    shape: new f.StringField({required: true, blank: false, choices: C.shape, initial: "circle"}),
    ring: new f.StringField({required: true, blank: false, choices: C.ring, initial: "dashed"}),
    ringWidth: new f.NumberField({required: true, nullable: false, min: 0.01, max: 0.2, step: 0.01, initial: 0.04}),
    fillOpacity: new f.AlphaField({initial: 0}),
    showHeading: new f.BooleanField({initial: true}),
    headingStyle: new f.StringField({required: true, blank: false, choices: C.headingStyle, initial: "edge"}),
    image: new f.StringField({required: true, blank: false, choices: C.image, initial: "ghost"}),
    imagePath: new f.FilePathField({categories: ["IMAGE"], initial: null}),
    icon: new f.StringField({required: true, blank: false, trim: true, initial: "fa-solid fa-question"}),
    imageOpacity: new f.AlphaField({initial: 0.35}),
    desaturate: new f.BooleanField({initial: true}),
    label: new f.StringField({required: true, blank: false, choices: C.label, initial: "age"}),
    labelText: new f.StringField({required: true, blank: true, initial: "?"}),
    scale: new f.NumberField({required: true, nullable: false, min: 0.25, max: 3, step: 0.05, initial: 1}),
    opacity: new f.AlphaField({initial: 1}),
    animation: new f.StringField({required: true, blank: false, choices: C.animation, initial: "none"}),
    animationSpeed: new f.NumberField({required: true, nullable: false, min: 0.5, max: 30, step: 0.5, initial: 2})
  });
}
